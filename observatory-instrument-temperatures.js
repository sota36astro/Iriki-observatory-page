(function () {
  "use strict";

  var fields = Array.prototype.slice.call(document.querySelectorAll("[data-instrument-temperature]"));
  if (!fields.length) { return; }

  var refreshers = fields.map(function (field) {
    var card = field.closest(".temperature-graph-card");
    var status = card.querySelector("[data-instrument-temperature-status]");
    var timestamp = card.querySelector("[data-instrument-temperature-timestamp]");
    var readouts = Array.prototype.slice.call(field.querySelectorAll("[data-temperature-channel]"));
    if (!readouts.length) { readouts = [field]; }
    var loading = false;

    return function () {
      if (loading) { return; }
      loading = true;
      status.textContent = "データ取得中";
      status.className = "status-pill pending";

      fetch(field.dataset.instrumentTemperature + "?t=" + Date.now(), { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) { throw new Error("HTTP " + response.status); }
          return response.json();
        })
        .then(function (data) {
          if (!data || typeof data.timestamp !== "string" || !data.timestamp.trim()) {
            throw new Error("timestamp が不正です");
          }
          var values = readouts.map(function (readout) {
            var channel = readout.dataset.temperatureChannel;
            var sensor = channel ? data[channel] : data;
            if (!sensor || typeof sensor.measured_temperature !== "number" || !Number.isFinite(sensor.measured_temperature)) {
              throw new Error((channel || "") + " measured_temperature が不正です");
            }
            return sensor.measured_temperature.toFixed(1);
          });
          readouts.forEach(function (readout, index) { readout.textContent = values[index]; });
          timestamp.textContent = data.timestamp;
          status.textContent = "取得済み";
          status.className = "status-pill safe";
        })
        .catch(function (error) {
          readouts.forEach(function (readout) { readout.textContent = "--"; });
          timestamp.textContent = "--";
          status.textContent = "取得失敗";
          status.className = "status-pill danger";
          console.error("Instrument temperature could not be loaded: " + field.dataset.instrumentTemperature, error);
        })
        .finally(function () { loading = false; });
    };
  });

  function refresh() {
    refreshers.forEach(function (refreshField) { refreshField(); });
  }

  refresh();
  window.setInterval(refresh, 60 * 1000);

  var panel = document.getElementById("instrument-temperature-panel");
  if (panel) {
    new MutationObserver(function () {
      if (!panel.hidden) { refresh(); }
    }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  }
}());
