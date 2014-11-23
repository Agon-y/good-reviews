var 
  Promise = require('bluebird'),
  jsdom = require('jsdom'),
  baseRequest = require('request'),
  cookieJar = baseRequest.jar(),
  request = Promise.promisify(baseRequest.defaults({jar: cookieJar})),
  jQuery = require('fs').readFileSync('./node_modules/jquery/dist/jquery.js'),
  util = require('../util'),
  log = util.log,
  bus = util.bus,
  logError = util.logError,
  developerKey = 'wgg8Hg2ajBphs2eQnC4lLA',
  queries = require('../database/queries'),
  Throttle = require('madlib-promise-throttle'),
  DeathByCaptcha = require('deathbycaptcha'),
  dbc = new DeathByCaptcha('username', 'password'),
  fs = require('fs');

dbc.balance(function(e, credits, balance, rate) {
  log('dbc balance');
  log(e);
  log(credits);
  log(balance);
  log(rate);
});

exports.userId = false;
exports.userName = false;
exports.isAuthenticated = false;

var throttle = new Throttle(1000);

jsdom.envAsync = function(options) {
  return function() {
    return new Promise(function(resolve, reject) {
      options.done = function(e, window) {
        if (!!e) { reject(e); return; }
        resolve(window);
      };
      jsdom.env(options);
    });
  };
}

requestAsync = function(options) {
  return function() {
    return new Promise(function(resolve, reject) {
      request({url: options.url, form: options.form, method: options.method}, function(e, response, body) {
        if (!!e) { reject(e); return; }
        resolve({response: response, body: body});
      });
    });
  }
}

var goodreadsGet = function(url) {
  return throttle.connect()
    .then(jsdom.envAsync({ url: url, src: [jQuery], jar: cookieJar, features: { FetchExternalResources: ["iframe"], ProcessExternalResources: false } }))
    .catch(logError);
};

var goodreadsPost = function(options) {
  return throttle.connect()
    .then(requestAsync({url: options.url, form: options.form, method: 'POST' }))
    .catch(logError);
}

function getSignInForm(data) {
  var url = 'https://www.goodreads.com/user/sign_in';
  return goodreadsGet(url)
    .then(function(window) {
      var $ = window.$;
      var $form = $('form[name=sign_in]');
      $form.find('input#user_email').val(data.email);
      $form.find('input#user_password').val(data.password);

      var formData = {};
      $.each($form.find('input'), function(i, input) {
        formData[$(input).attr('name')] = $(input).val();
      });

      return formData;
    });
};

function signIn(data) {
  if (exports.userName)
    return Promise.resolve({ userName: exports.userName, userId: exports.userId });

  return getSignInForm(data)
  .then(function(formData) {
    return goodreadsPost({ url: 'https://www.goodreads.com/user/sign_in', form: formData });
  })
  .then(function() {
    return goodreadsGet('https://www.goodreads.com');
  })
  .then(function(window) {
    exports.userId = window.jQuery('.profileSubheader.fullName a').attr('href').match(/\/user\/show\/(\d*)-/)[1];
    exports.userName = window.jQuery('.profileSubheader.fullName a').text();
    exports.isAuthenticated = !!exports.userId;
    return { userId: exports.userId, userName: exports.userName };
  });
}

exports.getBooks = function(goodreadsId) {
  return queries.getBooks();
}

exports.getFullReview = function (goodreadsId) {
  var url = 'https://www.goodreads.com/review/show/' + goodreadsId;
  return goodreadsGet(url)
  .then(function(window) {
    var $ = window.$;
    var body = $('.big420BoxContent').html();
    var userId = $('span.reviewer a.userReview').attr('href').match(/\/user\/show\/([\d]*)-/)[1];
    return queries.updateReview(goodreadsId, body, userId);
  })
  .then(function() {
    return queries.getReviewBody(goodreadsId);
  })
  .then(function(reviewData) {
    log('got full review, returning');
    log(reviewData);
    return Promise.resolve(reviewData[0]);
  })
  .catch(logError);
}

function getCurrentReview(goodreadsId) {
  return queries
  .getReviewData(goodreadsId)
  .then(function(reviewData) {
    if (!!reviewData.currentReview || reviewData.complete)
      return Promise.resolve(reviewData);

    var isbn = reviewData.isbn;
    var page = reviewData.nextPage;
    var url = 'https://www.goodreads.com/api/reviews_widget_iframe?did=' + developerKey + '&amp;format=html&amp;isbn=' + isbn + '&amp;links=660&amp;review_back=fff&amp;stars=000&amp;text=000&min_rating=4&page=' + page;
    log('tryna get reviews for ' + url);
    return goodreadsGet(url)
    .then(function(window) { 
      var $ = window.$;
      var reviewElements = $('.gr_review_container');
      var hasNextPage = $('.next_page:visible').length > 0;
      var totalReviews = $('.gr_reviews_container .smallText').text().match(/showing[\s]*[\d]*-[\d]*[\s]*of[\s]*([,\d]*)/)[1].replace(',','')*1;
      var reviews = [];

      reviewElements.each(function(i, e) {
        var reviewBy = $(this).find('.gr_review_by a');
        
        var reviewByResult = {
          author: reviewBy.text(),
          url: href = reviewBy.attr('href'),
          goodreadsId: reviewBy.attr('href').match(/show\/(\d*)\?utm_campaign/)[1],
          bookGoodreadsId: goodreadsId,
          body: $(this).html()
        }

        reviews.push(reviewByResult);
      });

    return queries.updateBookReviews({ goodreadsId: goodreadsId, totalReviews: totalReviews, nextPage: page + 1, reviews: reviews, complete: !hasNextPage });;
    })
    .then(function() {
      return queries.getReviewData(goodreadsId);
    });
  });
}

function getBookInfo(goodreadsId) {
  log('getting book info for ' + goodreadsId);
  var url = 'https://www.goodreads.com/book/show/' + goodreadsId;

  return queries
  .getBook(goodreadsId)
  .then(function(book) {
    if (!!book)
      return Promise.resolve(book);

    return goodreadsGet(url)
      .then(function(window) {
        log('got book info');
        log(window.document.documentElement.outerHTML);

        var $ = window.$;
        var title = $('#bookTitle').text();
        
        var isbn = $('.infoBoxRowTitle:contains(ISBN)').next().text().trim().match(/([\da-zA-Z]*)/)[0];
        if (!isbn)
          isbn = $('.infoBoxRowTitle:contains(ASIN)').next().text().trim().match(/([\da-zA-Z]*)/)[0];
        
        var coverImageSrc = $('.bookCoverPrimary img').attr('src');

        var result = { goodreadsId: goodreadsId, title: title, isbn: isbn, coverImageSrc: coverImageSrc };
        return queries.saveBook(result);
      });
  });
}

function download(uri, filename) {
  return new Promise(function(resolve, reject) {
    baseRequest(uri).pipe(fs.createWriteStream(filename)).on('close', function() { 
      log('resolving download promise');
      log(uri);
      log(filename);
      resolve();
    });
  });
}

function dbcSolveCaptcha(filename) {
  return new Promise(function(resolve, reject) {
    dbc.solve(fs.readFileSync(filename), function(e, id, solution) {
      if (e) {
        log('dbcSolveCaptcha error');
        log(e);
        resolve({id: null, solution: null});
      }

      resolve({id: id, solution: solution});
    });
  });
}

function loadCaptchaFrame(reviewGoodreadsId, authenticityToken, captchaUrl) {
  log('loading captcha frame');
  log(reviewGoodreadsId);
  log(authenticityToken);
  log(captchaUrl);
  return jsdom.envAsync({url: captchaUrl, src: [jQuery], jar: cookieJar})().then(function(window) {
    log('loaded captcha frame');
    log(window.document.documentElement.outerHTML);

    var captchaImageSrc = 'https://www.google.com/recaptcha/api/' + window.$('img').attr('src');
    log('got captcha image src');
    log(captchaImageSrc);

    return captchaImageSrc;
  })
  .then(function(captchaImageSrc) {
    log('trying to download captcha image');
    var filename = __dirname + '/tmp.jpeg';

    if (fs.existsSync(filename))
      fs.unlinkSync(filename);

    return download(captchaImageSrc, filename).then(function() {
      log('done downloading');
    }).then(function() {
      log('trying to solve with dbc');
      return dbcSolveCaptcha(filename).then(function(result) {
        log('back from dbcSolveCaptcha');
        log(result);
        return { captchaImageSrc: captchaImageSrc, captchaSolution: result.solution };
      });
    });
  })
  .then(function(result) {
    log('savin the form for the client');
    return queries.saveForm(reviewGoodreadsId, authenticityToken, captchaUrl, result.captchaImageSrc, result.captchaSolution);
  });
}

function getMessageForm(userId) {
  var url = 'https://www.goodreads.com/message/new/' + userId;
  return goodreadsGet(url, true)
    .then(function(window) {
      if (!window.location.href.match(/message\/new\//)){
        log('Could not load message page - probably user is an author or something');
        log(window.document.documentElement.outerHTML);
        log(window.location.href);
        if (/author/.test(window.location.href)) {
          return { userIsAuthor: true };
        }
      }

      var $ = window.$;
      var formData = {};
      $.each($('#messageForm').find('input, textarea'), function(i, input) {
        formData[$(input).attr('name')] = $(input).val();
      });

      var iframeUrlMatches = (window.document.documentElement.outerHTML).match(/<iframe src=\"(.*)\" height/);
      var iframeUrl = false;
      if (iframeUrlMatches && iframeUrlMatches.length > 0)
        iframeUrl = iframeUrlMatches[1];
      else {
        log("regex didn't locate captcha. page contents:");
        log(url);
        log(window.document.documentElement.outerHTML);
      }

      return { form: formData, captchaUrl: iframeUrl };
    });
}

function solveCaptcha(reviewGoodreadsId, captchaSolution) {
  log('tryna load the review to solve captcha for');
  log(reviewGoodreadsId);
  log(captchaSolution);
  var captchaSubmitUrl = 'https://www.google.com/recaptcha/api/noscript?k=6LdtdMsSAAAAACwUFvXrXhs8hBJsGebEGSDzeDaa';
  return queries.getReview(reviewGoodreadsId)
  .then(function(result) {
    var review = result[0];
    return review;
  })
  .then(function(review) {
    log('loaded review to solve captcha for');
    log(review);

    var form = {
      submit: "I'm a human",
      recaptcha_challenge_field: review.captchaImageSrc.replace('https://www.google.com/recaptcha/api/image?c=', ''),
      recaptcha_response_field: captchaSolution
    };

    log('about to submit captcha');
    log(captchaSubmitUrl);
    log(form);

    return Promise.props({
      result: requestAsync({ url: captchaSubmitUrl, form: form, method: 'POST' })(),
      review: review
    });
  })
  .then(function(result) {
    log('submitted captcha, result:');
    log(result);

    var captchaCode = false;
    if (/Your answer was correct/.test(result.result.response.body)) {
      captchaCode = result.result.response.body.match(/>([0-9A-Za-z_-]*)<\/textarea>/)[1];
      log('found captcha code:');
      log(captchaCode);
      return Promise.props({
        result: 'success',
        review: exports.sendMessage(reviewGoodreadsId, captchaCode)
      });
    }
    else {
      log('did not find captcha code');
      log(result.result.response.body);
      return Promise.props({
        result: 'failure',
        newCaptcha: loadCaptchaFrame(reviewGoodreadsId, result.review.authenticityToken, captchaSubmitUrl)
      });
    }
  });
}
exports.solveCaptcha = solveCaptcha;

function sendMessage(reviewGoodreadsId, captchaCode) {
  return queries.getReview(reviewGoodreadsId)
  .then(function(result) {
    var review = result[0];
    if (!!review.authorGoodreadsId)
    {
      log('already had authorGoodreadsId, it was');
      log(review.authorGoodreadsId);
      return Promise.resolve(review);
    }

    log('fetching authorGoodreadsId');
    return exports.getFullReview(reviewGoodreadsId);
  })
  .then(function(review) {
    log('trying to fetch all the pieces for');
    log(review);
    return Promise.props({
      review: Promise.resolve(review),
      form: getMessageForm(review.authorGoodreadsId),
      format: queries.getMessageFormat(reviewGoodreadsId)
    });
  })
  .then(function(data) {
    if (!!data.form.userIsAuthor) {
      log('user was probably an author, skipping review');
      return exports.skipReview(reviewGoodreadsId);
    }
    if (!!data.form.captchaUrl && !captchaCode) {
      log('found captcha');
      log(data);

      return loadCaptchaFrame(reviewGoodreadsId, data.form.form['authenticity_token'], data.form.captchaUrl);
    }
    else
    {
      log('did not find captcha or had captcha code, trying to send message');
      log(captchaCode || "no captcha code");
      log(data);
      return exports.sendMessageWithCaptcha(data, reviewGoodreadsId, captchaCode);      
    }
  })
}

exports.sendMessageWithCaptcha = function(data, reviewGoodreadsId, captchaCode) {
  var subjectFormat = data.format.subject; 
  var bodyFormat = data.format.body;
  var author = data.review.author;

  var subject = subjectFormat.replace("{{author}}", author);
  var body = bodyFormat.replace("{{author}}", author);
  var form = data.form.form;

  form["message[subject]"] = subject;
  form["message[body_usertext]"] = body;
  form["recaptcha_repsonse_field"] = 'manual_challenge';
  form["recaptcha_challenge_field"] = captchaCode;
  
  var url = 'https://www.goodreads.com/message/new/' + form["message[to_user_id]"];
  log('sending message with captcha');
  log({url: url, form: form});
  return goodreadsPost({ url: url, form: form })
  .then(function(result) {
    return queries.messageSent(reviewGoodreadsId);
  })
  .then(function(review) {
    return getCurrentReview(review.bookGoodreadsId);
  });
}

exports.skipReview = function (goodreadsId) {
  return queries.skipReview(goodreadsId)
  .then(function(review) {
    return getCurrentReview(review.bookGoodreadsId);
  });
}

exports.getMessageForm = getMessageForm;
exports.getSignInForm = getSignInForm;
exports.sendMessage = sendMessage;
exports.signIn = signIn;
exports.getBookInfo = getBookInfo;
exports.getCurrentReview = getCurrentReview;
