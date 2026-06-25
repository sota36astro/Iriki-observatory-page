(function () {
  var DOME_STATUS_URL = "latest.json";
  var REFRESH_INTERVAL_MS = 60 * 1000;

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function setStatus(text, className) {
    var status = document.querySelector("#dome-status");
    if (status) {
      status.textContent = text;
      status.className = "status-pill " + className;
    }
  }

  function toNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function renderDomeStatus(data) {
    var temperature = toNumber(data.temperature_C);
    var humidity = toNumber(data.humidity_percent);

    if (temperature === null || humidity === null) {
      throw new Error("latest.json の温湿度データが不正です。");
    }

    setText("#dome-temperature", temperature.toFixed(1));
    setText("#dome-humidity", Math.round(humidity));
    setText("#dome-updated-at", data.timestamp || "--");
    setStatus("更新中", "neutral");
  }

  function renderDomeError() {
    setStatus("取得失敗", "danger");
  }

  function loadDomeStatus() {
    fetch(DOME_STATUS_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("latest.json を取得できませんでした。");
        }
        return response.json();
      })
      .then(renderDomeStatus)
      .catch(renderDomeError);
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadDomeStatus();
    window.setInterval(loadDomeStatus, REFRESH_INTERVAL_MS);
  });
}());
