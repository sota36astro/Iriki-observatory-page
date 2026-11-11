(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-tab-target]"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".page-tab-panel"));
  var temperatureImages = Array.prototype.slice.call(document.querySelectorAll("[data-temperature-graph]"));
  var instrumentSlots = Array.prototype.slice.call(document.querySelectorAll(".instrument-slot[data-instrument]"));

  if (!tabs.length || !panels.length) {
    return;
  }

  temperatureImages.forEach(function (image) {
    image.dataset.baseSrc = image.getAttribute("src");
    image.dataset.baseAlt = image.alt;
    var caption = image.parentElement.querySelector("figcaption");
    if (caption) { image.dataset.baseCaption = caption.textContent; }
  });

  function refreshTemperatureImages() {
    var cacheBuster = Date.now();
    var stoppedInstruments = Object.create(null);
    instrumentSlots.forEach(function (slot) {
      var status = slot.querySelector(".instrument-slot-header .status-pill");
      var stopped = status.textContent.trim() === "未搭載";
      stoppedInstruments[slot.dataset.instrument] = stopped;
      slot.classList.toggle("mounted", !stopped);
      slot.classList.toggle("inactive", stopped);
      if (stopped) {
        slot.removeAttribute("aria-current");
      } else {
        slot.setAttribute("aria-current", "true");
      }
      status.classList.toggle("safe", !stopped);
      status.classList.toggle("neutral", stopped);
      var description = slot.querySelector("p");
      if (description) {
        description.textContent = stopped ? "現在は搭載されていません。" : "使用可能";
      }
    });
    temperatureImages.forEach(function (image) {
      var stopped = stoppedInstruments[image.dataset.instrument] === true;
      var source = stopped ? "makeplot/stopped.png" : image.dataset.baseSrc;
      image.src = source + "?t=" + cacheBuster;
      image.alt = stopped ? "装置は停止中（未搭載）" : image.dataset.baseAlt;
      var caption = image.parentElement.querySelector("figcaption");
      if (caption) {
        caption.textContent = stopped ? "停止中（未搭載）" : image.dataset.baseCaption;
      }
    });
  }

  refreshTemperatureImages();

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
