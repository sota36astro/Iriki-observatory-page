(function () {
  var LATITUDE = 31 + 44 / 60 + 52 / 3600;
  var LONGITUDE = 130 + 26 / 60 + 24 / 3600;
  var TIMEZONE = 9;
  var SUNRISE_SUNSET_ZENITH = 90.833;
  var ASTRONOMICAL_TWILIGHT_ZENITH = 108;
  var SYNODIC_MONTH = 29.530588853;
  var KNOWN_NEW_MOON_JD = 2451550.1;

  function dayOfYear(date) {
    var start = new Date(date.getFullYear(), 0, 0);
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

  function formatHours(hours) {
    if (hours === null) {
      return "--:--";
    }

    var totalMinutes = Math.round(hours * 60) % 1440;
    var hour = Math.floor(totalMinutes / 60);
    var minute = totalMinutes % 60;
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
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

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short"
    }).format(date);
  }

  function getObservingDate(now) {
    var observingDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (now.getHours() < 9) {
      observingDate.setDate(observingDate.getDate() - 1);
    }

    return observingDate;
  }

  function updateNightInfo() {
    var now = new Date();
    var observingDate = getObservingDate(now);
    var nextMorning = new Date(observingDate.getFullYear(), observingDate.getMonth(), observingDate.getDate() + 1);
    var sunset = calculateSolarTime(observingDate, false, SUNRISE_SUNSET_ZENITH);
    var twilightEnd = calculateSolarTime(observingDate, false, ASTRONOMICAL_TWILIGHT_ZENITH);
    var dawnTwilightStart = calculateSolarTime(nextMorning, true, ASTRONOMICAL_TWILIGHT_ZENITH);
    var sunrise = calculateSolarTime(nextMorning, true, SUNRISE_SUNSET_ZENITH);

    setText("#night-date", formatDate(observingDate));
    setText("#sunset-time", formatHours(sunset));
    setText("#twilight-end-time", formatHours(twilightEnd));
    setText("#dawn-twilight-start-time", formatHours(dawnTwilightStart));
    setText("#sunrise-time", formatHours(sunrise));
    setText("#moon-age", moonAge(observingDate).toFixed(1));
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateNightInfo();
    window.setInterval(updateNightInfo, 60 * 1000);
  });
}());
