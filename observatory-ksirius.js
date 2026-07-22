(function () {
  "use strict";

  var DATA_URL = "../ksirius/day.dat";
  var REFRESH_INTERVAL_MS = 5 * 60 * 1000;

  /* 日付・時刻に続く18個の数値列に対する、表示項目の位置（0始まり） */
  var METRIC_COLUMN_INDEXES = {
    dome: 0,
    coldHead: 1,
    jBand: 9,
    hBand: 10,
    ksBand: 11,
    coldPlate: 12,
    heatJ: 13,
    heatH: 14,
    heatKs: 15,
    heatCP: 16,
    vacuum: 17
  };
  var REQUIRED_METRIC_COLUMNS = 18;

  var fieldIds = {
    dome: "ksirius-dome",
    domeCelsius: "ksirius-dome-celsius",
    coldHead: "ksirius-cold-head",
    jBand: "ksirius-j-band",
    hBand: "ksirius-h-band",
    ksBand: "ksirius-ks-band",
    coldPlate: "ksirius-cold-plate",
    heatJ: "ksirius-heat-j",
    heatH: "ksirius-heat-h",
    heatKs: "ksirius-heat-ks",
    heatCP: "ksirius-heat-cp",
    vacuum: "ksirius-vacuum"
  };

  var statusElement = document.getElementById("ksirius-data-status");
  var lastUpdateElement = document.getElementById("ksirius-last-update");

  if (!statusElement || !lastUpdateElement) {
    return;
  }

  function setStatus(text, className) {
    statusElement.textContent = text;
    statusElement.className = "status-pill " + className;
  }

  function setText(field, value) {
    var element = document.getElementById(fieldIds[field]);
    if (element) {
      element.textContent = value;
    }
  }

  function formatTemperature(value, decimals, padLength) {
    return value.toFixed(decimals).padStart(padLength, "0");
  }

  function formatHeat(value) {
    return String(Math.round(value)).padStart(4, "0");
  }

  function formatVacuum(value) {
    return value.toExponential(4).replace("e", "E");
  }

  function formatJst(date) {
    if (!date || Number.isNaN(date.getTime())) {
      return "--";
    }

    var parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);
    var values = {};
    parts.forEach(function (part) {
      values[part.type] = part.value;
    });
    return values.year + "/" + values.month + "/" + values.day + " " +
      values.hour + ":" + values.minute + ":" + values.second + " (JST)";
  }

  function parseTimestamp(line, lastModified) {
    var dateTimeMatch = line.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})[ T_-]+(\d{1,2}):(\d{2}):(\d{2})/);
    if (dateTimeMatch) {
      return new Date(Date.UTC(
        Number(dateTimeMatch[1]),
        Number(dateTimeMatch[2]) - 1,
        Number(dateTimeMatch[3]),
        Number(dateTimeMatch[4]) - 9,
        Number(dateTimeMatch[5]),
        Number(dateTimeMatch[6])
      ));
    }

    var epochMatch = line.match(/(?:^|\s)(1\d{9}(?:\.\d+)?)(?:\s|$)/);
    if (epochMatch) {
      return new Date(Number(epochMatch[1]) * 1000);
    }

    return lastModified ? new Date(lastModified) : null;
  }

  function parseLatestRow(text, lastModified) {
    var lines = text.split(/\r?\n/).map(function (line) {
      return line.trim();
    }).filter(function (line) {
      return line && line.charAt(0) !== "#";
    });

    if (!lines.length) {
      throw new Error("day.dat にデータ行がありません");
    }

    var latestLine = lines[lines.length - 1];
    var numericValues = latestLine.split(/[\s,]+/).map(function (token) {
      return Number(token);
    }).filter(function (value) {
      return Number.isFinite(value);
    });

    if (numericValues.length < REQUIRED_METRIC_COLUMNS) {
      throw new Error("day.dat の列数が不足しています");
    }

    var metricValues = numericValues.slice(-REQUIRED_METRIC_COLUMNS);
    var result = { timestamp: parseTimestamp(latestLine, lastModified) };
    Object.keys(METRIC_COLUMN_INDEXES).forEach(function (name) {
      result[name] = metricValues[METRIC_COLUMN_INDEXES[name]];
    });
    return result;
  }

  function render(data) {
    setText("dome", formatTemperature(data.dome, 1, 5));
    setText("domeCelsius", (data.dome - 273.15).toFixed(1));
    setText("jBand", formatTemperature(data.jBand, 2, 6));
    setText("hBand", formatTemperature(data.hBand, 2, 6));
    setText("ksBand", formatTemperature(data.ksBand, 2, 6));
    setText("coldHead", formatTemperature(data.coldHead, 2, 6));
    setText("coldPlate", formatTemperature(data.coldPlate, 2, 6));
    setText("heatJ", formatHeat(data.heatJ));
    setText("heatH", formatHeat(data.heatH));
    setText("heatKs", formatHeat(data.heatKs));
    setText("heatCP", formatHeat(data.heatCP));
    setText("vacuum", formatVacuum(data.vacuum));
    lastUpdateElement.textContent = formatJst(data.timestamp);
    setStatus("最新値", "safe");
  }

  function refresh() {
    setStatus("データ取得中", "pending");
    fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        var lastModified = response.headers.get("Last-Modified");
        return response.text().then(function (text) {
          return parseLatestRow(text, lastModified);
        });
      })
      .then(render)
      .catch(function (error) {
        setStatus("取得失敗", "danger");
        console.error("kSIRIUS day.dat could not be loaded:", error);
      });
  }

  refresh();
  window.setInterval(refresh, REFRESH_INTERVAL_MS);
}());
