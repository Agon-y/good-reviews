var fs = require('fs'),
    Promise = require('bluebird'),
    wipeSql = fs.readFileSync('./database/create.sql', 'utf8'),
    util = require('../util'),
    log = util.log,
    logError = util.logError,
    $ = require ('jQuery'),
    knex = connectKnex();

function connectKnex() {
  return require('knex')({
    client: 'mysql',
    connection: {
      host: '127.0.0.1',
      user: 'root',
      password: 'password',
      database: 'good-reviews'
    }
  });
}

exports.resetDb = function() { 
  var commands = wipeSql.split(';');
  commands = commands.slice(0, commands.length - 1);

  query = knex.schema;
  for(var i = 0; i < commands.length; i++)
    query = query.raw(commands[i]);

  log(query.toString());
  knex = connectKnex(); //reconnect, because we dropped the database a moment ago
  return query.catch(logError);
}

exports.getBooks = function() { return knex.select().from('goodreadsBook').catch(logError); }

exports.getBook = function(goodreadsId) { 
  return knex.select().from('goodreadsBook').where({ goodreadsId: goodreadsId })
    .then(function(books) {
      return Promise.resolve(books[0]);
    })
    .catch(logError);
}

exports.saveBook = function(book) { 
  var query = 'insert ignore `goodreadsBook` (goodreadsId, title, isbn, coverImageSrc) values (?, ?, ?, ?)';
  return knex.raw(query, [book.goodreadsId, book.title, book.isbn, book.coverImageSrc])
    .then(function() { return exports.getBook(book.goodreadsId); })
    .catch(logError);
}

exports.saveBookData = function(bookData) {
  return knex('goodreadsBook').update({subject: bookData.subject, body: bookData.body}).where({goodreadsId: bookData.goodreadsId})
  .then(function() {
    return exports.getBook();
  });
}

exports.saveForm = function(reviewGoodreadsId, authenticityToken, captchaUrl, captchaImageSrc, captchaSolution) {
  return knex('goodreadsReview').update({authenticityToken: authenticityToken, captchaUrl: captchaUrl, captchaImageSrc: captchaImageSrc}).where({goodreadsId: reviewGoodreadsId})
  .then(function() {
    return exports.getReview(reviewGoodreadsId);
  })
  .then(function(result) {
    log('saved form');
    result[0]['captchaSolution'] = captchaSolution;
    log(result[0]);
    return result[0];
  });
}

exports.getOrCreateBook = function(isbn) {
  var query = 'insert ignore `goodreadsBook` (goodreadsId, title, isbn, coverImageSrc) values (?, ?, ?, ?)';
  return knex.raw(query, [isbn]).then(function() { return exports.getBook(isbn); }).catch(logError);
}

exports.getReview = function(goodreadsId) {
  return knex.select().from('goodreadsReview').where({goodreadsId: goodreadsId}).catch(logError);
}

exports.getMessageFormat = function(reviewGoodreadsId) {
  return knex('goodreadsReview')
    .select('goodreadsBook.subject', 'goodreadsBook.body')
    .innerJoin('goodreadsBook', 'goodreadsBook.goodreadsId', 'goodreadsReview.bookGoodreadsId')
    .where('goodreadsReview.goodreadsId', [reviewGoodreadsId])
    .then(function(result) {
      console.log('message format for reviewGoodreadsId' + reviewGoodreadsId);
      console.log(result);
      return result[0];
    });
}

exports.skipReview = function(goodreadsId) {
  return exports.getReview(goodreadsId)
    .then(function(result) {
      console.log(result);
      var review = result[0];
      console.log(review);

      return knex('goodreadsReview')
      .update({status: 'Skipped'})
      .where({goodreadsId: goodreadsId})
    })
    .then(function() {
      return exports.getReview(goodreadsId);
    })
    .then(function(result) {
      return Promise.resolve(result[0]);
    });
}

exports.messageSent = function(reviewGoodreadsId) {
  log('logging message sent for reviewGoodreadsId:' + reviewGoodreadsId);
  return knex('goodreadsReview')
  .update({status: 'Sent'})
  .where({goodreadsId: reviewGoodreadsId})
  .then(function() {
    log('getting review');
    return exports.getReview(reviewGoodreadsId);
  })
  .then(function(result) {
    log('returning review after message sent');
    log(result[0]);
    return result[0];
  });
}

exports.createOrUpdateReviews = function(reviews) {
  var query = 'insert ignore `goodreadsReview` (goodreadsId, bookGoodreadsId, author, body) values ';
  for(var i = 0; i < reviews.length; i++) {
    if (i > 0)
      query += ',';

    query += knex.raw('(?, ?, ? ,?)', [reviews[i].goodreadsId, reviews[i].bookGoodreadsId, reviews[i].author, reviews[i].body]).toString();
  }
  return knex.raw(query).catch(logError);
}

exports.updateReview = function(goodreadsId, body, userId) {
  return knex('goodreadsReview')
  .update({body: body, authorGoodreadsId: userId})
  .where({goodreadsId: goodreadsId})
  .catch(logError);
}

exports.getReviewBody = function(goodreadsId) {
  return knex.select('goodreadsId', 'bookGoodreadsId', 'body', 'author', 'authorGoodreadsId').from('goodreadsReview').where({goodreadsId: goodreadsId}).catch(logError);
}

exports.getReviewData = function(goodreadsId) {
  var query = 
    'select *,\n' +
    '(select count(*) from goodreadsreview where Status = \'Sent\' or Status = \'Skipped\' and bookGoodreadsId = goodreadsBook.goodreadsId) as completedCount\n' +
    'from goodreadsbook\n' +
    'left join (select bookGoodreadsId, goodreadsId as reviewGoodreadsId, author, body, `status` from goodreadsreview where Status = \'None\') as nextReview on nextReview.bookGoodreadsId = goodreadsBook.goodreadsId\n' +
    'where goodreadsBook.goodreadsId = ?\n' +
    'order by nextReview.reviewGoodreadsId\n' + 
    'limit 1';

  return knex.raw(query, [goodreadsId])
  .then(function(result) {
    var result = result[0][0];
    var reviewData = { goodreadsId: result.goodreadsId, isbn: result.isbn, complete: result.complete[0], nextPage: result.nextPage, totalReviews: result.totalReviews, completedCount: result.completedCount };

    if (!!result.reviewGoodreadsId)
      reviewData.currentReview  = { goodreadsId: result.reviewGoodreadsId, author: result.author, body: result.body, status: result.status };

    return Promise.resolve(reviewData);
  });
}

exports.updateBookReviews = function(book) {
  return knex('goodreadsBook')
    .update({
      complete: book.complete,
      nextPage: book.nextPage,
      totalReviews: book.totalReviews
    })
    .where({goodreadsId: book.goodreadsId})
    .then(function() {
      return exports.createOrUpdateReviews(book.reviews);
    }).catch(logError);
}