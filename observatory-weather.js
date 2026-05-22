(function () {
  var FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=31.7478&lon=130.44&altitude=533";
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

  function collectRows(timeseries) {
    var rows = [];
    var now = new Date();

    for (var i = 0; i < timeseries.length && rows.length < 24; i += 1) {
      var item = timeseries[i];
      var rowTime = new Date(item.time);
      if (Number.isNaN(rowTime.getTime()) || rowTime < now) {
        continue;
      }

      var instant = item.data && item.data.instant && item.data.instant.details ? item.data.instant.details : {};
      var nextHour = item.data && item.data.next_1_hours && item.data.next_1_hours.details ? item.data.next_1_hours.details : {};

      rows.push({
        time: item.time,
        cloud: toNumber(instant.cloud_area_fraction),
        precipitation: toNumber(nextHour.precipitation_amount),
        temp: toNumber(instant.air_temperature),
        humidity: toNumber(instant.relative_humidity),
        wind: toNumber(instant.wind_speed)
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

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function setSafetyDot(className) {
    var dot = document.querySelector("#weather-safety-dot");
    if (dot) {
      dot.className = "state-dot " + className;
    }
  }

  function formatThreshold(value, suffix, decimals) {
    if (value === null) {
      return "--";
    }
    var formatted = decimals ? value.toFixed(decimals) : String(Math.round(value));
    return formatted + suffix;
  }

  function setThreshold(selector, value, exceeded) {
    var element = document.querySelector(selector);
    if (!element) {
      return;
    }
    element.textContent = value;
    element.className = exceeded ? "threshold-value exceeded" : "threshold-value";
  }

  function updateSafety(rows) {
    var current = rows[0];
    var label = document.querySelector("#weather-safety-label");
    if (!current) {
      setText("#weather-safety-text", "--");
      setText("#weather-safety-count", "データなし");
      setThreshold("#threshold-cloud", "--", false);
      setThreshold("#threshold-precipitation", "--", false);
      setThreshold("#threshold-humidity", "--", false);
      setThreshold("#threshold-wind", "--", false);
      setSafetyDot("unknown");
      if (label) {
        label.textContent = "不明";
        label.className = "status-pill neutral";
      }
      return;
    }

    var checks = [
      {
        selector: "#threshold-cloud",
        value: current.cloud,
        display: formatThreshold(current.cloud, "%", 0),
        exceeded: current.cloud !== null && current.cloud >= 40
      },
      {
        selector: "#threshold-precipitation",
        value: current.precipitation,
        display: formatThreshold(current.precipitation, " mm", 1),
        exceeded: current.precipitation !== null && current.precipitation > 0
      },
      {
        selector: "#threshold-humidity",
        value: current.humidity,
        display: formatThreshold(current.humidity, "%", 0),
        exceeded: current.humidity !== null && current.humidity >= 90
      },
      {
        selector: "#threshold-wind",
        value: current.wind,
        display: formatThreshold(current.wind, " m/s", 1),
        exceeded: current.wind !== null && current.wind >= 8
      }
    ];

    var exceededCount = 0;
    checks.forEach(function (check) {
      if (check.exceeded) {
        exceededCount += 1;
      }
      setThreshold(check.selector, check.display, check.exceeded);
    });

    setText("#weather-safety-count", exceededCount + " / " + checks.length);

    if (exceededCount >= 2) {
      setText("#weather-safety-text", "不可");
      setSafetyDot("danger");
      if (label) {
        label.textContent = "不可";
        label.className = "status-pill danger";
      }
    } else if (exceededCount === 1) {
      setText("#weather-safety-text", "注意");
      setSafetyDot("warning");
      if (label) {
        label.textContent = "注意";
        label.className = "status-pill warning";
      }
    } else {
      setText("#weather-safety-text", "可");
      setSafetyDot("safe");
      if (label) {
        label.textContent = "可";
        label.className = "status-pill safe";
      }
    }
  }

  function renderHourlyChart(data) {
    var chart = document.querySelector("#weather-chart");
    var status = document.querySelector("#hourly-status");
    var timeseries = data.properties && data.properties.timeseries ? data.properties.timeseries : [];
    if (!chart || !timeseries.length) {
      return;
    }

    var rows = collectRows(timeseries);
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
      renderMetricRow("雲量", rows, function (row) { return row.cloud; }, function (value) { return value === null ? "--" : Math.round(value) + "%"; }, 100),
      renderMetricRow("降水量", rows, function (row) { return row.precipitation; }, function (value) { return value === null ? "--" : value.toFixed(1) + " mm"; }, 10),
      renderMetricRow("湿度", rows, function (row) { return row.humidity; }, function (value) { return value === null ? "--" : Math.round(value) + "%"; }, 100),
      renderMetricRow("風速", rows, function (row) { return row.wind; }, function (value) { return value === null ? "--" : value.toFixed(1) + " m/s"; }, 15),
      renderMetricRow("気温", rows, function (row) { return row.temp; }, function (value) { return value === null ? "--" : Math.round(value) + " C"; }, 35),
      '</div>'
    ].join("");

    updateSafety(rows);

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
    fetch(FORECAST_URL, { cache: "no-store" })
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
