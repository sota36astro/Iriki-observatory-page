(function () {
  var REFRESH_INTERVAL_MS = 60 * 1000;

  function refreshPlot(img) {
    var baseSrc = img.getAttribute("data-src") || img.getAttribute("src").split("?")[0];
    img.setAttribute("data-src", baseSrc);
    img.src = baseSrc + "?t=" + Date.now();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var plot = document.querySelector("#dome-trend-img");
    if (!plot) {
      return;
    }

    refreshPlot(plot);
    window.setInterval(function () {
      refreshPlot(plot);
    }, REFRESH_INTERVAL_MS);
  });
}());
