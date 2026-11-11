(function () {
  var DOME_STATUS_URL = "latest_dome1.json";
  var OUTER_STATUS_URL = "latest_outside.json";
  var REFRESH_INTERVAL_MS = 60 * 1000;
  var sensorStates = { dome: "loading", outer: "loading" };

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function setStatus(text, className) {
    setSensorStatus("dome", text, className,
      text === "表示済み" ? "ready" : "missing");
  }

  function setSensorStatus(sensor, text, className, state) {
    var selector = sensor === "dome" ? "#dome-sensor-status" : "#outer-status";
    var status = document.querySelector(selector);
    if (status) {
      status.textContent = text;
      status.className = "status-pill " + className;
    }
    sensorStates[sensor] = state;
    var overall = document.querySelector("#dome-status");
    if (overall) {
      if (sensorStates.dome === "loading" || sensorStates.outer === "loading") {
        overall.textContent = "更新中";
      } else if (sensorStates.dome === "ready" && sensorStates.outer === "ready") {
        overall.textContent = "表示済み";
      } else if (sensorStates.dome === "ready" || sensorStates.outer === "ready") {
        overall.textContent = "一部未取得";
      } else {
        overall.textContent = "未取得";
      }
      overall.className = "status-pill neutral";
    }
  }

  function toNumber(value) {
    if (typeof value !== "number" && typeof value !== "string") {
      return null;
    }
    if (typeof value === "string" && value.trim() === "") {
      return null;
    }
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function renderDomeStatus(data) {
    var temperature = toNumber(data.temperature_C);
    var humidity = toNumber(data.humidity_percent);

    if (temperature === null || humidity === null) {
      throw new Error(DOME_STATUS_URL + " の温湿度データが不正です。");
    }

    setText("#dome-temperature", temperature.toFixed(1));
    setText("#dome-humidity", Math.round(humidity));
    setText("#dome-updated-at", data.timestamp || "--");
    setStatus("表示済み", "neutral");
  }

  function renderDomeError() {
    setText("#dome-temperature", "--");
    setText("#dome-humidity", "--");
    setText("#dome-updated-at", "--");
    setStatus("未取得", "neutral");
  }

  function loadDomeStatus() {
    fetch(DOME_STATUS_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(DOME_STATUS_URL + " を取得できませんでした。");
        }
        return response.json();
      })
      .then(renderDomeStatus)
      .catch(renderDomeError);
  }

  function setOuterStatus(text, className) {
    setSensorStatus("outer", text, className,
      text === "表示済み" ? "ready" : "missing");
  }

  function renderOuterStatus(data) {
    var temperature = toNumber(data.temperature_C);
    var humidity = toNumber(data.humidity_percent);
    if (temperature === null || humidity === null) {
      throw new Error("外気の温湿度データが不正です。");
    }
    setText("#outer-temperature", temperature.toFixed(1));
    setText("#outer-humidity", Math.round(humidity));
    setText("#outer-updated-at", data.timestamp || "--");
    setOuterStatus("表示済み", "neutral");
  }

  function loadOuterStatus() {
    if (!document.querySelector("#outer-temperature")) {
      setOuterStatus("未取得", "neutral");
      return;
    }
    fetch(OUTER_STATUS_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("外気データを取得できませんでした。");
        }
        return response.json();
      })
      .then(renderOuterStatus)
      .catch(function () {
        setText("#outer-temperature", "--");
        setText("#outer-humidity", "--");
        setText("#outer-updated-at", "--");
        setOuterStatus("未取得", "neutral");
      });
  }

  function loadStatuses() {
    setSensorStatus("dome", "更新中", "pending", "loading");
    setSensorStatus("outer", "更新中", "pending", "loading");
    loadDomeStatus();
    loadOuterStatus();
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadStatuses();
    window.setInterval(loadStatuses, REFRESH_INTERVAL_MS);
  });
}());
