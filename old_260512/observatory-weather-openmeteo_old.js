(function () {
  var HOURLY_URL = "https://api.open-meteo.com/v1/forecast?latitude=31.7478&longitude=130.44&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m&timezone=Asia%2FTokyo&forecast_days=3";
  var REFRESH_INTERVAL_MS = 60 * 60 * 1000;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatHourLabel(timeText) {
    var date = new Date(timeText);
    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    return new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function toNumber(value) {
    var number = Number(value);
    return Number.isNaN(number) ? null : number;
  }

  function collectRows(hourly) {
    var rows = [];
    var now = new Date();

    for (var i = 0; i < hourly.time.length && rows.length < 24; i += 1) {
      var rowTime = new Date(hourly.time[i]);
      if (Number.isNaN(rowTime.getTime()) || rowTime < now) {
        continue;
      }

      rows.push({
        time: hourly.time[i],
        temp: toNumber(hourly.temperature_2m[i]),
        pop: toNumber(hourly.precipitation_probability[i]),
        humidity: toNumber(hourly.relative_humidity_2m[i]),
        wind: toNumber(hourly.wind_speed_10m[i])
      });
    }

    return rows;
  }

  function renderMetricRow(label, rows, getValue, formatValue, maxValue) {
    return [
      '<div class="weather-timeline-row">',
      '<div class="weather-timeline-label">' + escapeHtml(label) + '</div>',
      '<div class="weather-timeline-cells">',
      rows.map(function (row) {
        var value = getValue(row);
        var height = value === null ? 0 : Math.max(8, Math.min(100, Math.round(value / maxValue * 100)));
        return [
          '<div class="weather-timeline-cell">',
          '<div class="weather-timeline-bar"><span style="height: ' + height + '%"></span></div>',
          '<div class="weather-timeline-value">' + escapeHtml(formatValue(value)) + '</div>',
          '</div>'
        ].join("");
      }).join(""),
      '</div>',
      '</div>'
    ].join("");
  }

  function renderHourlyChart(data) {
    var chart = document.querySelector("#weather-chart");
    var status = document.querySelector("#hourly-status");
    if (!chart || !data.hourly) {
      return;
    }

    var rows = collectRows(data.hourly);
    if (!rows.length) {
      chart.innerHTML = '<p class="data-note">表示できる時間別データがありません。</p>';
      return;
    }

    chart.innerHTML = [
      '<div class="weather-timeline">',
      '<div class="weather-timeline-row time-row">',
      '<div class="weather-timeline-label">時刻</div>',
      '<div class="weather-timeline-cells">',
      rows.map(function (row) {
        return '<div class="weather-timeline-time">' + escapeHtml(formatHourLabel(row.time)) + '</div>';
      }).join(""),
      '</div>',
      '</div>',
      renderMetricRow("降水", rows, function (row) { return row.pop; }, function (value) { return value === null ? "--" : value + "%"; }, 100),
      renderMetricRow("気温", rows, function (row) { return row.temp; }, function (value) { return value === null ? "--" : Math.round(value) + " C"; }, 35),
      renderMetricRow("湿度", rows, function (row) { return row.humidity; }, function (value) { return value === null ? "--" : value + "%"; }, 100),
      renderMetricRow("風速", rows, function (row) { return row.wind; }, function (value) { return value === null ? "--" : Math.round(value) + " km/h"; }, 40),
      '</div>'
    ].join("");

    if (status) {
      status.textContent = "更新済み";
    }
  }

  function renderHourlyError(message) {
    var chart = document.querySelector("#weather-chart");
    var status = document.querySelector("#hourly-status");
    if (chart) {
      chart.innerHTML = '<p class="data-note">' + escapeHtml(message) + '</p>';
    }
    if (status) {
      status.textContent = "取得失敗";
    }
  }

  function loadHourlyForecast() {
    fetch(HOURLY_URL, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("24時間グラフを取得できませんでした。");
        }
        return response.json();
      })
      .then(renderHourlyChart)
      .catch(function (error) {
        renderHourlyError(error.message);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadHourlyForecast();
    window.setInterval(loadHourlyForecast, REFRESH_INTERVAL_MS);
  });
}());
