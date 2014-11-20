var 
  queries = require('../database/queries.js'),
  Promise = require('bluebird'),
  goodreads = require('..\\goodreads'),
  util = require('..\\util'),
  log = util.log,
  logError = util.logError,
  window = require('jsdom').jsdom().parentWindow,
  $ = require('jquery')(window);

exports['awesome'] = {
  setUp: function(done) {
  	done();
  },
  'getSignInForm before logging in': function(test) {
  	goodreads.getSignInForm()
      .then(function(signInForm) {
    	  test.ok(signInForm, 'Should have returned a sign in form');

    	  var html = $('<div>').append(signInForm);
    	  test.ok($(html).find('form[name=sign_in]').length, 'Html should have contained a form named sign_in');
    	  test.ok($(html).find('input#user_email').length, 'Html should have contained an input with id user_email');
    	  test.ok($(html).find('input#user_password').length, 'Html should have contained an input with id user_password');
    	  test.done();
    	})
      .catch(function(e) {
        test.ok(false, 'Should not have caught an error');
        test.done();
        console.log(e);
      });
    },
    'signing in': function(test) {
    	goodreads.getSignInForm()
        .then(function(signInForm) {
          var html = $('<div>').append(signInForm);
          
          html.find('input#user_email').val('username');
          html.find('input#user_password').val('password');
          var inputs = {};
          $.each(html.find('form input'), function(i, input) {
            inputs[$(input).attr('name')] = $(input).val();
          });

          return inputs;
        })
        .then(goodreads.signIn)
        .then(function(user) {
          test.equals(user.userName, 'Agon', 'Should have logged in as Agon');
          test.equals(user.userId, '33011000', 'Should have returned Agon\'s userId of 33011000');
          test.done();
        })
        .catch(function(e) {
          test.ok(false, 'Should not have caught an error');
          test.done();
          console.log(e);
        });
    },
    'when signed in: getting a book\'s first page of reviews': function(test) {
    	var isbn = '1451666179';
    	var startPage = 1;
    	var endPage = 1;
    	goodreads.getBookReviews({isbn: isbn, startPage: startPage, endPage: endPage})
        .then(function() { return queries.getOrCreateBook(isbn); })
        .then(function(books) {
          test.equals(books.length, 1, 'Should have returned 1 book');
          var book = books[0];

          test.equals(book.isbn, isbn, 'Should have saved book with correct isbn');
          test.ok(book.totalReviews > 4706, 'Should have calculated total reviews');
          test.equals(book.lastPageScanned, 1, 'Should have saved 1 as last page scanned');
          test.done();
        })
        .catch(function(e) {
          test.ok(false, 'Should not have caught an error');
          test.done();
          console.log(e);
        });
    },
    'when signed in: get a user\'s message form': function(test) {
      var forUserId = 9936913;
      goodreads.getMessageForm(forUserId)
        .then(function(messageForm) {
          test.ok(messageForm);
          var html = $('<div>').append(messageForm);

          test.ok($(html).find('form[name=\'messageForm\']'), 'Should have the message form');
          test.ok($(html).find('input[name=\'message[to_user_id]\']'), 'Should have the hidden toUserId input');
          test.ok($(html).find('input[name=\'message[subject]\']'), 'Should have the subject input');
          test.ok($(html).find('input[name=\'message[body_usertext]\']'), 'Should have the body input');
          test.done();
        })
        .catch(function(e) {
          test.ok(false, 'Should not have caught an error');
          test.done();
          console.log(e);
        });
    },
    'when signed in: get message form for review': function(test) {
      var reviewUrl = 'https://www.goodreads.com/review/show/354018084?book_show_action=true&page=1';
      goodreads.getMessageFormForReview(reviewUrl)
        .then(function(messageForm) {
          test.ok(messageForm);
          var html = $('<div>').append(messageForm);

          test.ok(html.find('form[name=\'messageForm\']').length, 'Should have the message form');
          test.ok(html.find('input[name=\'message[to_user_id]\']').length, 'Should have the hidden toUserId input');
          test.ok(html.find('input[name=\'message[subject]\']').length, 'Should have the subject input');
          test.ok(html.find('textarea[name=\'message[body_usertext]\']').length, 'Should have the body input');
          test.done();
        })
        .catch(function(e) {
          test.ok(false, 'Should not have caught an error');
          test.done();
          console.log(e);
        });
    },
    'when signed in: send message sends a message': function(test) {
      var reviewUrl = 'https://www.goodreads.com/review/show/354018084?book_show_action=true&page=1';
      goodreads.getMessageFormForReview(reviewUrl)
        .then(function(messageForm) {
          var html = $('<div>').append(messageForm);

          html.find('input[name=\'message[subject]\']').val('This is a Test Message');
          html.find('textarea[name=\'message[body_usertext]\']').val('Hey! It was successful!');
          var inputs = {};
          $.each(html.find('form input, form textarea'), function(i, input) {
            inputs[$(input).attr('name')] = $(input).val();
          });

          log(inputs);
          return inputs;
        })
        .then(function(inputs) { return goodreads.sendMessage(inputs['message[to_user_id]'], inputs) })
        .then(function() {
          test.ok(true);
          test.done();
        })
        .catch(function(e) {
          test.ok(false, 'Should not have caught an error');
          test.done();
          console.log(e);
        });
    }
  };