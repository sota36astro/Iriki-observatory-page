(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-tab-target]"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".page-tab-panel"));
  var temperatureImages = Array.prototype.slice.call(document.querySelectorAll("[data-temperature-graph]"));

  if (!tabs.length || !panels.length) {
    return;
  }

  temperatureImages.forEach(function (image) {
    image.dataset.baseSrc = image.getAttribute("src");
  });

  function refreshTemperatureImages() {
    var cacheBuster = Date.now();
    temperatureImages.forEach(function (image) {
      image.src = image.dataset.baseSrc + "?t=" + cacheBuster;
    });
  }

  function activateTab(tab, updateHash) {
    var targetId = tab.dataset.tabTarget;

    tabs.forEach(function (item) {
      var isActive = item === tab;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
      item.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach(function (panel) {
      panel.hidden = panel.id !== targetId;
    });

    if (targetId === "instrument-temperature-panel") {
      refreshTemperatureImages();
    }

    if (updateHash && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + targetId);
    }
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () {
      activateTab(tab, true);
    });

    tab.addEventListener("keydown", function (event) {
      var nextIndex;
      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else {
        return;
      }

      event.preventDefault();
      tabs[nextIndex].focus();
      activateTab(tabs[nextIndex], true);
    });
  });

  var initialTab = tabs.find(function (tab) {
    return "#" + tab.dataset.tabTarget === window.location.hash;
  });

  if (initialTab) {
    activateTab(initialTab, false);
  }
}());
