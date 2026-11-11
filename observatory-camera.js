(function () {
  "use strict";
  var REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  var OUTPUT_SIZE = 1200;

  // Read metadata from the displayed frame and neutralize Orientation before
  // browser decoding. The fixed camera's raw pixels have north at the top.
  function readMetadata(bytes) {
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var metadata = { captured: "unknown", exposure: "unknown" };
    if (bytes.length < 2 || view.getUint16(0) !== 0xffd8) {
      throw new Error("Camera image is not a JPEG");
    }
    var position = 2;
    while (position + 4 <= bytes.length) {
      if (bytes[position] !== 0xff) { throw new Error("Invalid JPEG marker"); }
      var marker = bytes[position + 1];
      if (marker === 0xda || marker === 0xd9) { break; }
      var length = view.getUint16(position + 2);
      var end = position + 2 + length;
      if (length < 2 || end > bytes.length) { throw new Error("Truncated JPEG"); }
      if (marker === 0xe1 && length >= 16 &&
          view.getUint32(position + 4) === 0x45786966 &&
          view.getUint16(position + 8) === 0) {
        var base = position + 10;
        var byteOrder = view.getUint16(base);
        if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) {
          throw new Error("Invalid EXIF byte order");
        }
        var little = byteOrder === 0x4949;
        function check(offset, count) {
          if (offset < base || offset + count > end) { throw new Error("Invalid EXIF offset"); }
        }
        function readIFD(offset, visit) {
          var start = base + offset;
          check(start, 2);
          var count = view.getUint16(start, little);
          check(start + 2, count * 12);
          for (var i = 0; i < count; i += 1) {
            var entry = start + 2 + i * 12;
            visit(view.getUint16(entry, little), view.getUint16(entry + 2, little),
              view.getUint32(entry + 4, little), entry + 8);
          }
        }
        var exifOffset = 0;
        readIFD(view.getUint32(base + 4, little), function (tag, type, count, value) {
          if (tag === 0x0112 && type === 3 && count === 1) { view.setUint16(value, 1, little); }
          if (tag === 0x8769 && type === 4 && count === 1) {
            exifOffset = view.getUint32(value, little);
          }
        });
        if (exifOffset) {
          readIFD(exifOffset, function (tag, type, count, value) {
            if (tag === 0x9003 && type === 2 && count > 4) {
              var textStart = base + view.getUint32(value, little);
              check(textStart, count);
              var text = "";
              for (var i = 0; i < count && bytes[textStart + i]; i += 1) {
                text += String.fromCharCode(bytes[textStart + i]);
              }
              if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
                metadata.captured = text.slice(0, 10).replace(/:/g, "-") + text.slice(10);
              }
            }
            if (tag === 0x829a && type === 5 && count === 1) {
              var rational = base + view.getUint32(value, little);
              check(rational, 8);
              var numerator = view.getUint32(rational, little);
              var denominator = view.getUint32(rational + 4, little);
              if (numerator > 0 && denominator > 0) {
                var seconds = numerator / denominator;
                var number = seconds < 1 ? 1 / seconds : seconds;
                metadata.exposure = (seconds < 1 ? "1/" : "") +
                  Number(number.toPrecision(6)) + " s";
              }
            }
          });
        }
      }
      position = end;
    }
    return metadata;
  }

  async function processImage(bytes) {
    var metadata = readMetadata(bytes);
    var objectURL = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
    var original = new Image();
    try {
      await new Promise(function (resolve, reject) {
        original.onload = resolve;
        original.onerror = function () { reject(new Error("Cannot decode camera image")); };
        original.src = objectURL;
      });
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUTPUT_SIZE;
      var context = canvas.getContext("2d");
      if (!context) { throw new Error("Canvas is unavailable"); }
      var side = Math.round(Math.min(original.naturalWidth, original.naturalHeight) * 0.8);
      var left = Math.floor((original.naturalWidth - side) / 2);
      var top = Math.floor((original.naturalHeight - side) / 2);
      context.drawImage(original, left, top, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      context.fillStyle = "white";
      context.font = "30px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].forEach(function (label, i) {
        var angle = i * Math.PI / 4;
        context.fillText(label, Math.round(600 - 564 * Math.sin(angle)),
          Math.round(600 - 564 * Math.cos(angle)));
      });
      context.textAlign = "left";
      context.textBaseline = "bottom";
      context.fillText("Captured: " + metadata.captured, 19, 1140);
      context.fillText("Exposure: " + metadata.exposure, 19, 1181);
      return { src: canvas.toDataURL("image/jpeg", 0.92), metadata: metadata };
    } finally {
      URL.revokeObjectURL(objectURL);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var skyCamera = document.querySelector("#sky-camera-img");
    if (!skyCamera) { return; }
    var status = document.querySelector("#sky-camera-status");
    var source = skyCamera.getAttribute("data-source") || "../capt0000.jpg";
    var refreshing = false;
    async function refreshImage() {
      if (refreshing) { return; }
      refreshing = true;
      if (status) { status.textContent = "更新中"; }
      var controller = new AbortController();
      var timeout = window.setTimeout(function () { controller.abort(); }, 30000);
      try {
        var url = new URL(source, document.baseURI);
        url.searchParams.set("t", Date.now());
        var response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) { throw new Error("Camera HTTP " + response.status); }
        var processed = await processImage(new Uint8Array(await response.arrayBuffer()));
        skyCamera.src = processed.src;
        skyCamera.setAttribute("data-captured", processed.metadata.captured);
        if (status) {
          status.textContent = "更新中";
          status.title = "撮影時刻: " + processed.metadata.captured;
        }
      } catch (error) {
        if (status) {
          status.textContent = "更新失敗（前回画像）";
          status.title = error.message;
        }
        console.warn("Sky camera update failed:", error);
      } finally {
        window.clearTimeout(timeout);
        refreshing = false;
      }
    }
    refreshImage();
    window.setInterval(refreshImage, REFRESH_INTERVAL_MS);
  });
}());
