(function () {
  "use strict";
  // Version 6 owns its night calculations; earlier dashboard versions are unchanged.
  // フラット開始の実測値をここで設定します（単位: 分）。
  // sunset は日没基準、sunrise は翌朝の日の出基準。
  // 負数 = 基準より前、正数 = 基準より後、0 = 同時、null = 表示しない。
  // 例: 日没10分前なら sunset.visible を -10 に設定します。
  var FLAT_START_OFFSETS = {
    sunset: { visible: 10, nir: -15 },
    sunrise: { visible: null, nir: null }
  };

  var LATITUDE = 31 + 44 / 60 + 52 / 3600;
  var LONGITUDE = 130 + 26 / 60 + 24 / 3600;
  var TIMEZONE = 9;
  var SUNRISE_SUNSET_ZENITH = 90.833;
  var ASTRONOMICAL_TWILIGHT_ZENITH = 108;
  var SYNODIC_MONTH = 29.530588853;
  var KNOWN_NEW_MOON_JD = 2451550.1;

  function dayOfYear(date) {
    var start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
    var diff = date - start;
    return Math.floor(diff / 86400000);
  }

  function normalizeDegrees(value) {
    var result = value % 360;
    return result < 0 ? result + 360 : result;
  }

  function normalizeHours(value) {
    var result = value % 24;
    return result < 0 ? result + 24 : result;
  }

  function degToRad(value) {
    return value * Math.PI / 180;
  }

  function radToDeg(value) {
    return value * 180 / Math.PI;
  }

  function calculateSolarTime(date, isRise, zenith) {
    var n = dayOfYear(date);
    var lngHour = LONGITUDE / 15;
    var approximateTime = n + ((isRise ? 6 : 18) - lngHour) / 24;
    var meanAnomaly = (0.9856 * approximateTime) - 3.289;
    var trueLongitude = normalizeDegrees(
      meanAnomaly +
      (1.916 * Math.sin(degToRad(meanAnomaly))) +
      (0.020 * Math.sin(2 * degToRad(meanAnomaly))) +
      282.634
    );

    var rightAscension = radToDeg(Math.atan(0.91764 * Math.tan(degToRad(trueLongitude))));
    rightAscension = normalizeDegrees(rightAscension);

    var longitudeQuadrant = Math.floor(trueLongitude / 90) * 90;
    var rightAscensionQuadrant = Math.floor(rightAscension / 90) * 90;
    rightAscension = (rightAscension + longitudeQuadrant - rightAscensionQuadrant) / 15;

    var sinDeclination = 0.39782 * Math.sin(degToRad(trueLongitude));
    var cosDeclination = Math.cos(Math.asin(sinDeclination));
    var cosHourAngle = (
      Math.cos(degToRad(zenith)) -
      (sinDeclination * Math.sin(degToRad(LATITUDE)))
    ) / (cosDeclination * Math.cos(degToRad(LATITUDE)));

    if (cosHourAngle > 1 || cosHourAngle < -1) {
      return null;
    }

    var hourAngle = isRise ? 360 - radToDeg(Math.acos(cosHourAngle)) : radToDeg(Math.acos(cosHourAngle));
    hourAngle = hourAngle / 15;

    var localMeanTime = hourAngle + rightAscension - (0.06571 * approximateTime) - 6.622;
    var utcTime = localMeanTime - lngHour;
    return normalizeHours(utcTime + TIMEZONE);
  }

  function julianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function moonAge(date) {
    var age = (julianDate(date) - KNOWN_NEW_MOON_JD) % SYNODIC_MONTH;
    if (age < 0) {
      age += SYNODIC_MONTH;
    }
    return age;
  }

  var MINUTE = 60000;
  var DAY = 86400000;
  var panel = document.getElementById("night-timeline-panel");
  if (!panel) { return; }
  var clock = document.getElementById("observatory-clock");
  var view = "evening";
  var lastRender = "";
  var model;
  var timeFormat = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  var dateFormat = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short"
  });

  function setText(id, value) { document.getElementById(id).textContent = value; }
  function validOffset(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= -180 && value <= 180;
  }
  function currentTime() {
    var synced = clock && Date.parse(clock.getAttribute("datetime"));
    return { epoch: Number.isFinite(synced) ? synced : Date.now(), synced: Number.isFinite(synced) };
  }

  // Calendar arithmetic uses UTC on a shifted JST date, independent of the browser timezone.
  function observingDate(epoch) {
    var jst = new Date(epoch + TIMEZONE * 3600000);
    if (jst.getUTCHours() < 9) { jst.setUTCDate(jst.getUTCDate() - 1); }
    return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  }
  function solarEpoch(date, rise, zenith) {
    var hours = calculateSolarTime(date, rise, zenith);
    return hours === null ? null : date.getTime() - TIMEZONE * 3600000 + Math.round(hours * 60) * MINUTE;
  }
  function relativeTime(epoch, reference, referenceName) {
    var minutes = Math.round((epoch - reference) / MINUTE);
    var name = referenceName || "日没";
    return name + (minutes === 0 ? " ±0分" : " " + (minutes > 0 ? "+" : "−") + Math.abs(minutes) + "分");
  }
  function eventTime(epoch, date) {
    var jst = new Date(epoch + TIMEZONE * 3600000);
    var calendarDay = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
    var prefix = calendarDay > date.getTime() ? "翌 " : "";
    return prefix + timeFormat.format(new Date(epoch));
  }
  function makeModel(epoch) {
    var date = observingDate(epoch);
    var morning = new Date(date.getTime() + DAY);
    var sunset = solarEpoch(date, false, SUNRISE_SUNSET_ZENITH);
    var dusk = solarEpoch(date, false, ASTRONOMICAL_TWILIGHT_ZENITH);
    var dawn = solarEpoch(morning, true, ASTRONOMICAL_TWILIGHT_ZENITH);
    var sunrise = solarEpoch(morning, true, SUNRISE_SUNSET_ZENITH);
    if ([sunset, dusk, dawn, sunrise].some(function (value) { return value === null; })) { return null; }
    var events = [
      { name: "日没", time: sunset, type: "sun" },
      { name: "天文薄明終了", time: dusk, type: "twilight" },
      { name: "天文薄明開始", time: dawn, type: "twilight" },
      { name: "日の出", time: sunrise, type: "sun" }
    ];
    [
      { key: "sunset", name: "日没", time: sunset, period: "夕方" },
      { key: "sunrise", name: "日の出", time: sunrise, period: "朝方" }
    ].forEach(function (reference) {
      ["visible", "nir"].forEach(function (type) {
        var offset = FLAT_START_OFFSETS[reference.key][type];
        if (offset === null) { return; }
        if (!validOffset(offset)) {
          console.warn("フラット開始設定は−180〜180分の整数、またはnullにしてください:", reference.key, type);
          return;
        }
        events.push({
          name: reference.period + "・" + (type === "visible" ? "可視光" : "NIR") + "フラット開始",
          time: reference.time + offset * MINUTE,
          type: type,
          referenceKey: reference.key,
          referenceName: reference.name,
          referenceEpoch: reference.time
        });
      });
    });
    events.sort(function (a, b) { return a.time - b.time; });
    var start = sunset - 60 * MINUTE;
    var end = view === "evening" ? sunset + 120 * MINUTE : sunrise + 30 * MINUTE;
    // Include configured flat starts even when outside the default sunset window.
    events.forEach(function (event) {
      if (event.referenceKey && (view === "night" || event.referenceKey === "sunset")) {
        start = Math.min(start, event.time - 15 * MINUTE);
        end = Math.max(end, event.time + 15 * MINUTE);
      }
    });
    return { date: date, sunset: sunset, dusk: dusk, dawn: dawn, sunrise: sunrise, events: events, start: start, end: end };
  }
  function percentage(epoch) { return 100 * (epoch - model.start) / (model.end - model.start); }
  function clamp(value) { return Math.max(0, Math.min(100, value)); }

  function render() {
    var nightDate = new Date(model.date.getTime() + 12 * 3600000);
    var morning = new Date(nightDate.getTime() + DAY);
    setText("night-date", dateFormat.format(nightDate));
    setText("sunset-time", timeFormat.format(new Date(model.sunset)));
    setText("twilight-end-time", timeFormat.format(new Date(model.dusk)));
    setText("dawn-twilight-start-time", timeFormat.format(new Date(model.dawn)));
    setText("sunrise-time", timeFormat.format(new Date(model.sunrise)));
    setText("moon-age", moonAge(new Date(model.date.getTime() - TIMEZONE * 3600000)).toFixed(1));
    setText("timeline-date", dateFormat.format(nightDate) + " → " + dateFormat.format(morning));
    setText("timeline-range", (view === "evening" ? "日没前後" : "一晩全体") + "：" + eventTime(model.start, model.date) + " 〜 " + eventTime(model.end, model.date) + " JST");
    var phase = document.getElementById("timeline-phase");
    var dusk = clamp(percentage(model.dusk));
    var dawn = clamp(percentage(model.dawn));
    var sunset = clamp(percentage(model.sunset));
    var sunrise = clamp(percentage(model.sunrise));
    phase.style.background = "linear-gradient(to right, #f7e7c3 0%, #f7e7c3 " + sunset + "%, #bdc7d6 " + sunset + "%, #6f7f96 " + dusk + "%, #15243b " + dusk + "%, #15243b " + dawn + "%, #6f7f96 " + dawn + "%, #bdc7d6 " + sunrise + "%, #f7e7c3 " + sunrise + "%, #f7e7c3 100%)";
    phase.replaceChildren();
    [
      { start: 0, end: sunset, label: "日中" },
      { start: sunset, end: dusk, label: "薄明" },
      { start: dusk, end: dawn, label: "夜間", night: true },
      { start: dawn, end: sunrise, label: "薄明" },
      { start: sunrise, end: 100, label: "日中" }
    ].forEach(function (segment) {
      if (segment.end - segment.start < 8) { return; }
      var label = document.createElement("span");
      label.className = "timeline-phase-label" + (segment.night ? " is-night" : "");
      label.style.left = segment.start + "%";
      label.style.width = segment.end - segment.start + "%";
      label.textContent = segment.label;
      phase.appendChild(label);
    });
    var axis = document.getElementById("timeline-axis");
    axis.replaceChildren();
    function tick(epoch) {
      var label = document.createElement("span");
      label.className = "timeline-tick";
      label.style.left = percentage(epoch) + "%";
      label.textContent = eventTime(epoch, model.date);
      axis.appendChild(label);
    }
    tick(model.start);
    var interval = (model.end - model.start > 6 * 3600000 ? 120 : 30) * MINUTE;
    for (var time = Math.ceil(model.start / interval) * interval; time < model.end; time += interval) {
      if (time - model.start > interval * .45 && model.end - time > interval * .45) { tick(time); }
    }
    tick(model.end);
    var rows = document.getElementById("timeline-events");
    var outside = document.getElementById("timeline-outside");
    rows.replaceChildren();
    outside.replaceChildren();
    model.events.forEach(function (event) {
      var position = percentage(event.time);
      var description = eventTime(event.time, model.date) + " / " + relativeTime(event.time, event.referenceEpoch || model.sunset, event.referenceName);
      if (position < 0 || position > 100) {
        var note = document.createElement("span");
        note.className = "timeline-outside";
        note.textContent = event.name + " " + description + (position < 0 ? "（← 範囲外）" : "（範囲外 →）");
        outside.appendChild(note);
        return;
      }
      var row = document.createElement("div");
      row.className = "timeline-event timeline-event--" + event.type;
      row.style.left = position + "%";
      row.dataset.position = position;
      var label = document.createElement("div");
      label.className = "timeline-event-label";
      label.textContent = event.name;
      var detail = document.createElement("small");
      detail.textContent = description;
      label.appendChild(detail);
      var track = document.createElement("div");
      track.className = "timeline-event-track";
      track.setAttribute("aria-hidden", "true");
      row.append(label, track);
      rows.appendChild(row);
    });
    layoutTimelineLabels();
  }

  // Use measured label widths so close events share the band without overlapping text.
  function layoutTimelineLabels() {
    var rows = document.getElementById("timeline-events");
    var width = rows.clientWidth;
    if (!width) { return; }
    var laneEnds = [];
    rows.querySelectorAll(".timeline-event").forEach(function (row) {
      var label = row.querySelector(".timeline-event-label");
      var position = Number(row.dataset.position) / 100 * width;
      var labelWidth = label.offsetWidth;
      var left = Math.max(0, Math.min(width - labelWidth, position - labelWidth / 2));
      var lane = laneEnds.findIndex(function (end) { return left >= end + 12; });
      if (lane < 0) { lane = laneEnds.length; }
      laneEnds[lane] = left + labelWidth;
      label.style.left = left - position + "px";
      row.style.setProperty("--label-top", 8 + lane * 44 + "px");
      row.style.setProperty("--line-top", 8 + lane * 44 + label.offsetHeight + 5 + "px");
    });
    var bandTop = Math.max(2, laneEnds.length) * 44 + 26;
    var plot = document.getElementById("timeline-plot");
    plot.style.setProperty("--band-top", bandTop + "px");
    plot.style.setProperty("--band-bottom", bandTop + 88 + "px");
    plot.style.height = bandTop + 140 + "px";
  }

  function update() {
    var now = currentTime();
    var signature = observingDate(now.epoch).getTime() + ":" + view;
    if (signature !== lastRender) {
      model = makeModel(now.epoch);
      if (!model) { setText("timeline-next", "夜間時刻を計算できませんでした。"); return; }
      render();
      lastRender = signature;
    }
    var next = model.events.find(function (event) { return event.time > now.epoch; });
    if (next) {
      var minutes = Math.ceil((next.time - now.epoch) / MINUTE);
      var remaining = minutes >= 60 ? Math.floor(minutes / 60) + "時間" + minutes % 60 + "分" : minutes + "分";
      setText("timeline-next", next.name + "まであと" + remaining + "（" + eventTime(next.time, model.date) + "）");
    } else { setText("timeline-next", "今夜のイベントは終了しました。次の観測日は9時に表示します。"); }
    setText("timeline-clock-source", "現在 " + timeFormat.format(new Date(now.epoch)) + " JST / " + (now.synced ? "NICT同期時計" : "端末時刻（NICT未同期）") + " / " + relativeTime(now.epoch, model.sunset));
    var nowLine = document.getElementById("timeline-now");
    var position = percentage(now.epoch);
    nowLine.hidden = position < 0 || position > 100;
    if (!nowLine.hidden) { nowLine.style.left = position + "%"; }
  }

  panel.querySelectorAll("[data-timeline-view]").forEach(function (button) {
    button.addEventListener("click", function () {
      view = button.dataset.timelineView;
      panel.querySelectorAll("[data-timeline-view]").forEach(function (item) { item.setAttribute("aria-pressed", String(item === button)); });
      update();
    });
  });
  update();
  var timelineWidth = -1;
  new ResizeObserver(function (entries) {
    var width = entries[0].contentRect.width;
    if (width === timelineWidth) { return; }
    timelineWidth = width;
    // Layout changes the plot height; run after this observer delivery to avoid a resize loop.
    window.setTimeout(layoutTimelineLabels, 0);
  }).observe(document.getElementById("timeline-plot"));
  window.setInterval(update, 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { update(); } });
}());
