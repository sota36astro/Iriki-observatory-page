(function () {
  "use strict";

  var clock = document.querySelector("#observatory-clock");
  if (!clock) {
    return;
  }

  // HTTPS JSON endpoints used by NICT's official JST display page:
  // https://www.nict.go.jp/JST/JST5.html
  var TIME_SERVERS = [
    "https://3fe5a5f690efc790d4764f1c528a4ebb89fa4168.nict.go.jp/cgi-bin/json",
    "https://67495dde3b39c2991829589f0101ab7a035eecf5.nict.go.jp/cgi-bin/json",
    "https://08a08e3a6edef4ba7a0c055a42d8e1ba2597f2b5.nict.go.jp/cgi-bin/json"
  ];
  var SYNC_INTERVAL_MS = 5 * 60 * 1000;
  var MIN_SYNC_INTERVAL_MS = 60 * 1000;
  var label = document.querySelector("#observatory-clock-label");
  var anchorEpoch = null;
  var anchorElapsed = 0;
  var lastAttempt = -Infinity;
  var syncing = false;
  var serverIndex = 0;

  var formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  function updateClock() {
    if (anchorEpoch === null) {
      clock.textContent = "--:--:--";
      clock.removeAttribute("datetime");
      return;
    }
    // Advance the received NICT time using a monotonic clock. Changing the
    // computer's date/time after synchronization does not move this clock.
    var now = new Date(anchorEpoch + performance.now() - anchorElapsed);
    clock.textContent = formatter.format(now);
    clock.dateTime = now.toISOString();
  }

  function setLabel(text) {
    if (label) {
      label.textContent = text;
    }
  }

  async function synchronizeClock() {
    var started = performance.now();
    if (syncing || started - lastAttempt < MIN_SYNC_INTERVAL_MS) {
      return;
    }
    syncing = true;
    lastAttempt = started;
    setLabel("日本時間 (JST / NICT同期中)");
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 10000);
    var server = TIME_SERVERS[serverIndex];
    serverIndex = (serverIndex + 1) % TIME_SERVERS.length;
    try {
      var response = await fetch(server + "?" + Date.now() / 1000, {
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error("NICT HTTP " + response.status);
      }
      var data = await response.json();
      if (!data || typeof data.st !== "number" || !Number.isFinite(data.st) || data.st <= 0) {
        throw new Error("Invalid NICT timestamp");
      }
      var received = performance.now();
      // Approximate one-way transit time using half the request round trip.
      anchorEpoch = data.st * 1000 + (received - started) / 2;
      anchorElapsed = received;
      setLabel("日本時間 (JST / NICT)");
      clock.title = "NICT同期時刻: " + formatter.format(new Date(anchorEpoch));
      updateClock();
    } catch (error) {
      setLabel(anchorEpoch === null ? "NICT時刻未取得" : "日本時間 (JST / 再同期失敗)");
      clock.title = anchorEpoch === null ? "NICTから時刻を取得できませんでした" :
        "前回のNICT同期時刻から表示を継続しています";
      console.warn("NICT clock synchronization failed:", error);
    } finally {
      window.clearTimeout(timeout);
      syncing = false;
    }
  }

  updateClock();
  synchronizeClock();
  window.setInterval(updateClock, 1000);
  window.setInterval(synchronizeClock, SYNC_INTERVAL_MS);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      updateClock();
      synchronizeClock();
    }
  });
}());
