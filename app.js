var express = require('express'),
  app = express(),
  bodyParser = require('body-parser'),
  io = require('socket.io'),
  queries = require('./database/queries.js'),
  goodreads = require('./goodreads'),
  util = require('./util'),
  log = util.log,
  bus = util.bus,
  requestingStuff = false,
  socket;

app.set('views', __dirname + '/views');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/bower_components/**/dist/*.debug.js'));
app.engine('html', require('ejs').renderFile);

app.get('/', function(req, res) {
  res.render('index.html');
});

app.get('/getSignInForm', function(req, res) {
  goodreads.getSignInForm().then(function(form) {
    res.send(form);
  });
});

app.post('/sendMessage/:userId', function(req, res) {
  goodreads.sendMessage(req.params.userId, req.body).then(function(result) {
    res.send('');
  });
});

app.get('/getMessageForm', function(req, res) {
  goodreads.getMessageFormForReview(req.query.reviewUrl).then(function(messageForm) {
    res.send(messageForm);
  });
});

app.get('/getBookReviews', function(req, res) {
  goodreads.getAllBookReviews(req.query.isbn).then(function(reviews) {
    res.send(reviews);
  });
});

app.post('/signIn', function(req, res) {
  goodreads.signIn(req.body)
  .then(function(result) {
    return goodreads.getBooks().then(function(books) {
      socket.emit('Authenticated', { userName: goodreads.userName, userId: goodreads.userId, books: books });    
    });
  });
});

function getBooks() {
  socket.emit('Loading Books');
  queries.getBooks().then(function(books) {
    socket.emit('Books', books);
  });
}

util.clearLog();
var server = app.listen(1337, function() { console.log('Listening on port %d', server.address().port); });
var io = require('socket.io').listen(server);

bus.on('progress', function(message) {
  socket.emit('progress', message);
});

io.sockets.on('connection', function(newSocket) {
  socket = newSocket;

  if (goodreads.isAuthenticated)
    goodreads.getBooks().then(function(books) {
      socket.emit('Authenticated', { userName: goodreads.userName, userId: goodreads.userId, books: books });
    })
  else
    socket.emit('Authenticate');

  socket.on('New Book', function(goodreadsId) {
    goodreads.getBookInfo(goodreadsId).then(function(bookInfo) {
      socket.emit('Book Added', bookInfo);
    });
  });
  socket.on('Save Book', function(bookData) {
    queries.saveBookData(bookData).then(function(bookData) {
      socket.emit('Book Saved', bookData);
    });
  });
  socket.on('Load Reviews', function(goodreadsId) {
    goodreads.getCurrentReview(goodreadsId).then(function(reviewData) {
      socket.emit('Review Loaded', reviewData);
    });
  });
  socket.on('Get More', function(goodreadsId) {
    goodreads.getFullReview(goodreadsId).then(function(fullReviewContent) {
      socket.emit('More Loaded', fullReviewContent);
    });
  });
  socket.on('Skip Review', function(goodreadsId) {
    goodreads.skipReview(goodreadsId).then(function(reviewData) {
      socket.emit('Review Skipped', reviewData);
    });
  });
  socket.on('Send Message', function(review) {
    log('got send message');
    log(review);
    goodreads.sendMessage(review.goodreadsId, review.captchaCode).then(function(result) {
      if (result.captchaImageSrc)
        socket.emit('Captcha', {captchaImageSrc: result.captchaImageSrc, captchaSolution: result.captchaSolution });
      else
        socket.emit('Message Sent', result);
    });
  });
  socket.on('Solve Captcha', function(data) {
    log('got solve captcha');
    log(data);
    goodreads.solveCaptcha(data.reviewGoodreadsId, data.captchaSolution).then(function(result) {
      log('done solving captcha');
      log(result);

      if (result.result == 'success')
        socket.emit('Message Sent', result.review);
      else
        socket.emit('New Captcha', result.newCaptcha);
    });
  });
});