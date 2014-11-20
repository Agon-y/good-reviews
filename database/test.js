var 
  queries = require('./queries.js'),
  log = require('..\\util').log;

exports['awesome'] = {
  setUp: function(done) {
    queries.resetDb().then(function() { 
      log('resetting db');
      done(); 
    });
  },
  'get books': function(test) {
    test.expect(2);

    queries.getBooks().then(function(books) {
      test.ok(books);
      test.equals(books.length, 0, 'should have returned 0 books');

      test.done();
    });
  },
  'get book': function(test) {
    test.expect(2);
    var isbn = '111111111'

    queries.getBook().then(function(book) {
      test.ok(book);
      test.equals(book.length, 0, 'should not have returned any books with isbn ' + isbn);

      test.done();
    });
  },
  'getOrCreateBook': function(test) {
    test.expect(2, 'should do two');
    var isbn = '123123123';

    queries.getOrCreateBook(isbn).then(function(book) {
      test.ok(book);
      test.equals(book.length, 1, 'should have returned new book with isbn ' + isbn);

      test.done();
    });
  }
};