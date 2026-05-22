(function () {
  var REFRESH_INTERVAL_MS = 5 * 60 * 1000;

  function refreshImage(img) {
    var baseSrc = img.getAttribute("data-src") || img.getAttribute("src").split("?")[0];
    img.setAttribute("data-src", baseSrc);
    img.src = baseSrc + "?t=" + Date.now();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var skyCamera = document.querySelector("#sky-camera-img");
    if (!skyCamera) {
      return;
    }

    window.setInterval(function () {
      refreshImage(skyCamera);
    }, REFRESH_INTERVAL_MS);
  });
}());
