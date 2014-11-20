ko.components.register('captcha-challenge', {
  viewModel: function(params) {
    this.captchaSolution = params.captchaSolution;
    this.captchaImageSrc = params.captchaImageSrc;
    this.solveText = params.solveText

    // Behaviors
    this.solveCaptcha = params.solveCaptcha.bind(this);
  },
  template:
    '<div class="captcha-challenge"> \
      <img data-bind="attr: { src: captchaImageSrc }"></img> \
      <input type="text" data-bind="value: captchaSolution " /> \
      <button data-bind="click: solveCaptcha, html: solveText">Solve</button> \
    </div>'
});