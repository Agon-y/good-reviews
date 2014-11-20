//
// Custom Binding
//
ko.bindingHandlers.loadingWhen = {
  init: function (element) {
    var 
      $element = $(element),
      currentPosition = $element.css("position"),
      $loader = $('<div>').addClass("loader")
        .append($('<span>').addClass("loading-message")).hide();

    //add the loader
    $element.append($loader);
            
    //make sure that we can absolutely position the loader against the original element
    if (currentPosition == "auto" || currentPosition == "static")
      $element.css("position", "relative");

    //center the loader
    $loader.css({
      position: "absolute",
      top: "50%",
      left: "50%",
      "margin-left": -($loader.width() / 2) + "px",
      "margin-top": -($loader.height() / 2) + "px"
    });
  },
  update: function (element, valueAccessor) {
    var 
      loadingMessage = ko.utils.unwrapObservable(valueAccessor())
      isLoading = !!loadingMessage,
      $element = $(element),
      $childrenToHide = $element.children(":not(div.loader)"),
      $loader = $element.find("div.loader");

    if (isLoading) {
      $loader.find('.loading-message').text(loadingMessage);
      $childrenToHide.css("visibility", "hidden").attr("disabled", "disabled");
      $loader.show();
      var progress = progressJs($loader[0]).setOptions({ theme: 'blueOverlayRadiusHalfOpacity', overlayMode: true }).start().autoIncrease(4, 250);
      $loader.data('progress', progress);
    }
    else {
      var progress = $loader.data('progress');
      if (!progress)
        return;

      var callback = (function($loader, $childrenToHide) {
        return function() {
          $loader.fadeOut("fast");
          $childrenToHide.css("visibility", "visible").removeAttr("disabled");
        };
      })($loader, $childrenToHide);

      progress.onafterend(callback).end();
    }
  }
};