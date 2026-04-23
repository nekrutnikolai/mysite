// Vanilla lightbox for gallery pages. One dialog per page, lazy-created on
// first open. Supports keyboard (Esc / arrows), backdrop-click close, swipe,
// and preload of adjacent images. No dependencies.
(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  onReady(function () {
    var items = Array.prototype.slice.call(document.querySelectorAll(".gallery-item"));
    if (!items.length) return;

    // Flatten every gallery-item on the page into a single indexable array.
    var entries = items.map(function (li) {
      var trigger = li.querySelector(".gallery-trigger");
      var exifRaw = li.getAttribute("data-exif") || "{}";
      var exif = {};
      try { exif = JSON.parse(exifRaw); } catch (e) {}
      return {
        li: li,
        trigger: trigger,
        previewUrl: li.getAttribute("data-preview") || "",
        fullUrl: li.getAttribute("data-full") || "",
        caption: li.getAttribute("data-caption") || "",
        exif: exif,
      };
    });

    var dialog = null;
    var imgEl = null;
    var captionEl = null;
    var currentIndex = -1;
    var lastTrigger = null;
    var touchStartX = 0;
    var touchStartY = 0;

    function buildDialog() {
      dialog = document.createElement("dialog");
      dialog.className = "lightbox";
      dialog.innerHTML =
        '<div class="lightbox-inner">' +
          '<button type="button" class="lightbox-prev" aria-label="Previous image">&larr;</button>' +
          '<img class="lightbox-img" alt="">' +
          '<div class="lightbox-caption"></div>' +
          '<button type="button" class="lightbox-next" aria-label="Next image">&rarr;</button>' +
          '<button type="button" class="lightbox-close" aria-label="Close">&times;</button>' +
        '</div>';
      document.body.appendChild(dialog);

      imgEl = dialog.querySelector(".lightbox-img");
      captionEl = dialog.querySelector(".lightbox-caption");

      dialog.querySelector(".lightbox-close").addEventListener("click", close);
      dialog.querySelector(".lightbox-prev").addEventListener("click", function (e) { e.stopPropagation(); navigate(-1); });
      dialog.querySelector(".lightbox-next").addEventListener("click", function (e) { e.stopPropagation(); navigate(1); });

      // Click on dialog itself (backdrop) closes; click inside .lightbox-inner on non-interactive area also closes.
      dialog.addEventListener("click", function (e) {
        if (e.target === dialog) { close(); return; }
        if (e.target === imgEl || e.target === captionEl || e.target.closest("button, a")) return;
        close();
      });

      dialog.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); navigate(-1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); navigate(1); }
      });

      dialog.addEventListener("close", function () {
        if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
      });

      // Swipe support.
      dialog.addEventListener("touchstart", function (e) {
        if (!e.touches || !e.touches[0]) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });
      dialog.addEventListener("touchend", function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - touchStartX;
        var dy = t.clientY - touchStartY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          navigate(dx < 0 ? 1 : -1);
        }
      });
    }

    function preload(url) {
      if (!url) return;
      var i = new Image();
      i.src = url;
    }

    function show(index) {
      var n = entries.length;
      currentIndex = ((index % n) + n) % n;
      var e = entries[currentIndex];
      imgEl.src = e.previewUrl;
      imgEl.alt = e.caption;
      var html = (e.caption ? escapeHtml(e.caption) : "");
      if (e.fullUrl) {
        html += (html ? '<br>' : '') +
          '<a href="' + escapeAttr(e.fullUrl) + '" target="_blank" rel="noopener">Open original</a>';
      }
      captionEl.innerHTML = html;
      dialog.dataset.index = String(currentIndex);
      // Preload neighbors.
      preload(entries[(currentIndex + 1) % n].previewUrl);
      preload(entries[(currentIndex - 1 + n) % n].previewUrl);
    }

    function navigate(delta) { show(currentIndex + delta); }

    function open(index, trigger) {
      if (!dialog) buildDialog();
      lastTrigger = trigger || null;
      show(index);
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    function close() {
      if (!dialog) return;
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    function escapeAttr(s) { return escapeHtml(s); }

    entries.forEach(function (entry, idx) {
      if (!entry.trigger) return;
      entry.trigger.addEventListener("click", function (e) {
        e.preventDefault();
        open(idx, entry.trigger);
      });
    });
  });
})();
