(function() {
  var app = new function() {
    var self = this;
    self.loginLoading = ko.observable(false);
    self.userName = ko.observable('');
    self.loggedIn = ko.computed(function() {
      return !!self.userName();
    });
    self.signInVisible = ko.computed(function(){
      return !self.loggedIn();
    });
    self.booksVisible = ko.computed(function(){
      return self.loggedIn();
    });
    self.booksLoading = ko.observable(false);
    self.books = ko.observableArray([]);
    self.newBookGoodreadsId = ko.observable('');
    self.addNewBook = function() {
      self.newBookLoading(true);
      socket.emit('New Book', self.newBookGoodreadsId());
    }
    self.signInLoading = ko.observable(false);
    self.signInContent = ko.computed(function() {
      return self.signInLoading()
        ? "<i class=\"fa fa-spinner fa-spin\"></i> Signing in..." 
        : "Sign In";
    });
    self.newBookLoading = ko.observable(false);
    self.addNewBookContent = ko.computed(function() {
      return self.newBookLoading()
        ? "<i class=\"fa fa-spinner fa-spin\"></i> Adding..."
        : "Add Book";
    });

    $('#sign-in-form').ajaxForm({
      beforeSubmit: function() { self.signInLoading(true); }
    });

    self.selectBook = function(book) {
      if (!!self.selectedBook() && self.selectedBook() != book)
        self.selectedBook().selected(false);

      book.selected(true);
      self.selectedBook(book);
    }
    self.selectedBook = ko.observable();
    self.bookSelected = ko.computed(function(){ return !!self.selectedBook(); });
    self.selectedBook.subscribe(function(book) {
      socket.emit('Load Reviews', book.goodreadsId);
    });

    self.saveBook = function(book) {
      self.saveBookLoading(true);
      socket.emit('Save Book', book.saveBookJson());
    }
    self.saveBookLoading = ko.observable(false);
    self.saveBookContent = ko.computed(function(){
      return self.saveBookLoading() 
        ? "<i class=\"fa fa-spinner fa-spin\"></i> Saving..."
        : "Save";
    });
    self.addBook = function(book) {
      var bookExists = !!ko.utils.arrayFirst(this.books(), function(existingBook) {
        return book.goodreadsId = existingBook.goodreadsId;
      });

      if (bookExists)
        return;

      self.books.push(new bookVm(book));
    }

    window.socket = io.connect('http://localhost:1337');
    socket.on('Authenticated', function(result) {
      $.each(result.books, function(i, e) {
        self.addBook(e);
      });

      self.userName(result.userName);
      self.signInLoading(false);
      $('.splash').slideUp();
      $('.bookshelf').slideDown();
    });
    socket.on('Book Added', function(book) {
      self.newBookGoodreadsId('');
      self.addBook(book);
      self.newBookLoading(false);
    });
    socket.on('Book Saved', function(book) {
      self.saveBookLoading(false);
    });
    socket.on('Review Loaded', function(reviewData) {
      if (self.selectedBook().goodreadsId != reviewData.goodreadsId)
        return;

      self.selectedBook().updateReviewData(reviewData);
    });
    socket.on('Review Skipped', function (reviewData) {
      if (self.selectedBook().goodreadsId != reviewData.goodreadsId)
        return;

        self.selectedBook().updateReviewData(reviewData);
    });
    socket.on('New Captcha', function(result) {
      self.selectedBook().updateCaptcha(result.captchaImageSrc, result.captchaSolution);
      if (self.selectedBook().sendingAll())
        self.selectedBook().solveCaptcha()
    });
    socket.on('Message Sent', function(reviewData) {
      console.log('received message sent');
      console.log('review data:');
      console.log(reviewData);
      console.log('selected book:');
      console.log(self.selectedBook());

      if (self.selectedBook().goodreadsId != reviewData.goodreadsId)
        return;

      vex.close();
      self.selectedBook().updateReviewData(reviewData);
      if (self.selectedBook().sendingAll())
        self.selectedBook().sendMessage(self.selectedBook().currentReview());
    });
    socket.on('Captcha', function(result) {
      self.selectedBook().updateCaptcha(result.captchaImageSrc, result.captchaSolution);
      vex.open({content: '<captcha-challenge params="captchaSolution: captchaSolution, captchaImageSrc: captchaImageSrc, solveCaptcha: solveCaptcha, solveText: solveCaptchaText"></captcha-challenge>', afterOpen: function($content) { ko.applyBindings(self.selectedBook(), $content[0]); }});
      if (self.selectedBook().sendingAll())
        self.selectedBook().solveCaptcha()
    });
    socket.on('More Loaded', function(fullReviewContent) {
      if (self.selectedBook().goodreadsId != fullReviewContent.bookGoodreadsId)
        return;

      self.selectedBook().updateReviewContent(fullReviewContent);
    });
  };

  var bookVm = function(bookInfo) {
    var self = this;

    self.title = bookInfo.title;
    self.goodreadsId = bookInfo.goodreadsId;
    self.isbn = bookInfo.isbn;
    self.coverImageSrc = bookInfo.coverImageSrc;
    self.selected = ko.observable(bookInfo.selected);
    self.messageSubject = ko.observable(bookInfo.subject);
    self.messageBody = ko.observable(bookInfo.body);

    self.saveBookJson = ko.computed(function(){
      return { goodreadsId: self.goodreadsId, subject: self.messageSubject(), body: self.messageBody() };
    });

    self.doneCount = ko.observable();
    self.totalCount = ko.observable();
    self.progressText = ko.computed(function(){ return "Sent: " + self.doneCount() + " of " + self.totalCount(); });

    self.currentReview = ko.observable(false);
    self.noReviews = ko.observable(false);
    self.complete = ko.observable(false);
    self.reviewLoading = ko.observable(true);
    self.hasCaptcha = ko.observable(false);
    self.captchaCode = ko.observable(false);
    self.solvingCaptcha = ko.observable(false);
    self.solveCaptchaText = ko.computed(function() {
      return self.solvingCaptcha() 
        ? "<i class=\"fa fa-spinner fa-spin\"></i> Solving..."
        : "Solve";
    });

    self.updateReviewData = function(reviewData) {
      self.captchaSolution('');
      self.captchaImageSrc('');
      self.solvingCaptcha(false);

      self.doneCount(reviewData.completedCount);
      self.totalCount(reviewData.totalReviews);
      self.reviewLoading(false);
      self.skippingReview(false);
      self.sendingMessage(false);
      self.noReviews(false);
      if (reviewData.complete)
      {
        self.complete(reviewData.complete);
        self.currentReview(false);
      }
      else
        self.currentReview(new reviewVm(reviewData.currentReview));
    }

    self.captchaImageSrc = ko.observable(false);
    self.updateCaptcha = function(captchaImageSrc, captchaSolution) {
      self.hasCaptcha(true);
      self.sendingMessage(false);
      self.solvingCaptcha(false);
      self.captchaSolution(captchaSolution);
      self.captchaImageSrc(captchaImageSrc);
    }
    self.captchaSolution = ko.observable('');
    self.solveCaptcha = function() {
      self.solvingCaptcha(true);
      socket.emit('Solve Captcha', { reviewGoodreadsId: self.currentReview().goodreadsId, captchaSolution: self.captchaSolution() });
    }

    self.updateReviewContent = function(fullReviewContent) {
      if (self.currentReview().goodreadsId != fullReviewContent.goodreadsId)
        return;

      self.gettingFullReview(false);
      self.currentReview().updateContent(fullReviewContent);
    }

    self.sendingMessage = ko.observable(false);
    self.sendMessageContent = ko.computed(function(){
      return self.sendingMessage() 
        ? "<i class=\"fa fa-spinner fa-spin\"></i> Sending..."
        : "Send Message";
    });
    self.sendMessage = function(review) {
      self.sendingMessage(true);
      socket.emit('Send Message', { goodreadsId: review.goodreadsId, captchaCode: self.captchaCode() });
    }

    self.skippingReview = ko.observable(false);
    self.skipReviewContent = ko.computed(function(){
      return self.skippingReview() 
        ? "<i class=\"fa fa-spinner fa-spin\"></i> Skipping..."
        : "Skip";
    });
    self.skipReview = function(review) {
      self.skippingReview(true);
      socket.emit('Skip Review', review.goodreadsId);
    }

    self.sendingAll = ko.observable(false);
    self.sendAllContent = ko.computed(function(){
      return self.sendingAll() 
        ? "<i class=\"fa fa-spinner fa-spin\"></i> Sending All..."
        : "Send All";
    });
    self.sendAll = function(review) {
      self.sendingAll(true);
      self.sendMessage(review);
    }

    self.gettingFullReview = ko.observable(false);
    self.getFullReviewContent = ko.computed(function() {
      return self.gettingFullReview() 
        ? "<i class=\"fa fa-spinner fa-spin\"></i> Getting More..."
        : "Get More";
    });
    self.getFullReview = function(review) {
      self.gettingFullReview(true);
      socket.emit('Get More', review.goodreadsId);
    }
  }

  var reviewVm = function(reviewInfo) {
    var self = this;

    var $body = $(reviewInfo.body);
    self.hasMore = ko.observable($body.find('.gr_more_link').length > 0);
    $body.find('.gr_more_link').remove();
    self.body = ko.observable($('<div>').append($body).html());
    self.goodreadsId = reviewInfo.goodreadsId;

    self.updateContent = function(content) {
      self.hasMore(false);
      self.body(content.body);
    }
  }

  ko.applyBindings(app, $('#main')[0]);
  window.app = app;
})();