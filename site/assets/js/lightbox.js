// Vanilla lightbox for gallery pages with zoom + pan + minimap. One dialog
// per page, lazy-created on first open. Supports keyboard (Esc / arrows / +-/0),
// click-cycle zoom, wheel zoom toward cursor, drag-to-pan when zoomed,
// two-finger pinch zoom, swipe-to-navigate when not zoomed, and a minimap that
// appears in the bottom-right of the stage with a viewport rectangle and
// click-to-pan. No dependencies.
(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  onReady(function () {
    var items = Array.prototype.slice.call(document.querySelectorAll(".gallery-item"));
    if (!items.length) return;

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

    // Cycle through these on plain image clicks. Wheel/pinch step continuously
    // between MIN_SCALE and MAX_SCALE.
    var CLICK_ZOOM_LEVELS = [1, 2, 3];
    var MIN_SCALE = 1;
    var MAX_SCALE = 5;

    var dialog = null;
    var stage = null;
    var imgEl = null;
    var captionEl = null;
    var minimap = null;
    var minimapRect = null;
    var currentIndex = -1;
    var lastTrigger = null;

    // Image fit + transform state (recomputed on each image load).
    var natW = 0, natH = 0;       // displayed size at scale=1 (fit-to-stage)
    var stageW = 0, stageH = 0;
    var scale = 1, tx = 0, ty = 0;

    // Mouse/touch interaction state.
    var dragging = false;
    var dragStartX = 0, dragStartY = 0;
    var dragOriginTx = 0, dragOriginTy = 0;
    var dragMoved = false;

    var pinching = false;
    var pinchStartDist = 0;
    var pinchStartScale = 1;
    var pinchStartTx = 0, pinchStartTy = 0;
    var pinchCenter = null;

    var swipeStartX = 0, swipeStartY = 0;
    var swipeCandidate = false;

    // Hot-path event handlers (mousemove, touchmove, wheel) update tx/ty/scale
    // and need to push the change to the DOM. Calling applyTransform directly
    // on every event runs the transform pipeline + minimap-rect update at
    // mouse-event rate (often 1000 Hz on modern mice), which the compositor
    // can't keep up with on big images. scheduleApply collapses any number of
    // updates within a single frame into one applyTransform call at most 60Hz.
    var rafId = 0;
    function scheduleApply() {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        rafId = 0;
        applyTransform();
      });
    }

    // Smooth-zoom transitions are opt-in PER INTERACTION. Click-cycle, +/-,
    // and 0 (reset) are discrete user actions where a 180 ms tween between
    // zoom levels reads as polish; wheel/pinch/drag fire many events per
    // second and a transition there would visibly lag the gesture. The
    // class is set just before the next applyTransform runs (so the
    // CSS interpolation kicks in on the new width/height/transform values),
    // then cleared 220 ms later — slightly longer than the transition itself
    // to absorb scheduler jitter without snapping the last few pixels.
    var smoothingTimer = 0;
    function smoothZoomStart() {
      imgEl.classList.add("smoothing");
      if (smoothingTimer) clearTimeout(smoothingTimer);
      smoothingTimer = setTimeout(function () {
        imgEl.classList.remove("smoothing");
        smoothingTimer = 0;
      }, 220);
    }
    function smoothZoomCancel() {
      if (!smoothingTimer && !imgEl.classList.contains("smoothing")) return;
      imgEl.classList.remove("smoothing");
      if (smoothingTimer) {
        clearTimeout(smoothingTimer);
        smoothingTimer = 0;
      }
    }

    // Tracks per-index full-resolution load state. Persists across re-opens
    // within a single page session: `"loading"` while a fetch is in flight,
    // `"loaded"` once the original is in the browser cache (so subsequent
    // src swaps are instant), absent otherwise (so retries are possible).
    var fullState = {};
    // When true, the next `load` event on imgEl skips layoutImage(). Used to
    // hot-swap the full-res original onto the current image without losing
    // the active zoom/pan transform.
    var suppressLayoutOnce = false;

    // Kicks off a background fetch of the original-resolution image for `idx`
    // and, if that index is still the one displayed when the load completes,
    // swaps it into `imgEl.src`. The browser rasterizes the higher-res bitmap
    // into the existing width/height box, preserving the current transform —
    // so zoom/pan state is unchanged but the pixels are now sharp.
    function maybeLoadFull(idx) {
      if (idx < 0) return;
      var entry = entries[idx];
      if (!entry || !entry.fullUrl) return;
      if (fullState[idx] === "loading") return;
      // Already fully loaded (e.g. user zoomed earlier, navigated away, then
      // re-opened this index). The browser cache holds the bytes; just swap
      // the src now so zoom past 1x lands on sharp pixels right away.
      if (fullState[idx] === "loaded") {
        if (currentIndex === idx && imgEl.src !== entry.fullUrl) {
          suppressLayoutOnce = true;
          imgEl.src = entry.fullUrl;
        }
        return;
      }
      fullState[idx] = "loading";
      var img = new Image();
      img.src = entry.fullUrl;
      // decode() resolves once bytes are decoded into a bitmap — moving that
      // work off the main thread so the eventual src swap is paint-only and
      // avoids a frame stutter when the user is mid-zoom on a 1-2 MB JPEG.
      var decoded = img.decode ? img.decode() : new Promise(function (res, rej) {
        img.onload = res; img.onerror = rej;
      });
      decoded.then(function () {
        fullState[idx] = "loaded";
        if (currentIndex === idx) {
          suppressLayoutOnce = true;
          imgEl.src = entry.fullUrl;
        }
      }).catch(function () {
        delete fullState[idx];
      });
    }

    function buildDialog() {
      dialog = document.createElement("dialog");
      dialog.className = "lightbox";
      dialog.innerHTML =
        '<div class="lightbox-inner">' +
          '<button type="button" class="lightbox-prev" aria-label="Previous image">&larr;</button>' +
          '<div class="lightbox-stage">' +
            '<img class="lightbox-img" alt="" draggable="false">' +
            '<div class="lightbox-minimap" aria-label="Zoom minimap">' +
              '<div class="lightbox-minimap-rect"></div>' +
            '</div>' +
          '</div>' +
          '<div class="lightbox-caption"></div>' +
          '<button type="button" class="lightbox-next" aria-label="Next image">&rarr;</button>' +
          '<button type="button" class="lightbox-close" aria-label="Close">&times;</button>' +
        '</div>';
      document.body.appendChild(dialog);

      stage = dialog.querySelector(".lightbox-stage");
      imgEl = dialog.querySelector(".lightbox-img");
      captionEl = dialog.querySelector(".lightbox-caption");
      minimap = dialog.querySelector(".lightbox-minimap");
      minimapRect = dialog.querySelector(".lightbox-minimap-rect");

      dialog.querySelector(".lightbox-close").addEventListener("click", close);
      dialog.querySelector(".lightbox-prev").addEventListener("click", function (e) { e.stopPropagation(); navigate(-1); });
      dialog.querySelector(".lightbox-next").addEventListener("click", function (e) { e.stopPropagation(); navigate(1); });

      // Outside the stage / caption / buttons closes; inside stage stays open
      // (clicks on the image cycle zoom — handled separately below).
      dialog.addEventListener("click", function (e) {
        if (e.target === dialog) { close(); return; }
        if (stage.contains(e.target) || e.target === captionEl || e.target.closest("button, a")) return;
        close();
      });

      dialog.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); navigate(-1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); navigate(1); }
        else if (e.key === "Escape" && scale > 1) { e.preventDefault(); resetZoom(); }
        else if (e.key === "0") { e.preventDefault(); resetZoom(); }
        else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.5); }
        else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.5); }
      });

      dialog.addEventListener("close", function () {
        if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
      });

      imgEl.addEventListener("load", function () {
        // A full-res hot-swap onto the currently-zoomed image must not reset
        // the transform — the whole point is to keep zoom/pan and just trade
        // up the bitmap. show() never sets this flag, so navigation still
        // relayouts cleanly.
        if (suppressLayoutOnce) { suppressLayoutOnce = false; return; }
        layoutImage();
      });

      // Click on image cycles zoom levels at the click point (suppressed if
      // the click closed a drag).
      imgEl.addEventListener("click", function (e) {
        if (dragMoved) { dragMoved = false; return; }
        var p = stagePoint(e);
        cycleZoom(p.x, p.y);
      });

      // Wheel zoom — toward cursor.
      stage.addEventListener("wheel", function (e) {
        e.preventDefault();
        // A wheel tick during a still-running click-cycle transition would
        // visibly fight the tween; cancel any in-flight smoothing first so
        // wheel zoom stays one-frame-instant the way the gesture demands.
        smoothZoomCancel();
        var p = stagePoint(e);
        var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        zoomTo(scale * factor, p.x, p.y);
      }, { passive: false });

      // Mouse drag pans the image when zoomed.
      imgEl.addEventListener("mousedown", function (e) {
        if (e.button !== 0 || scale <= 1) return;
        e.preventDefault();
        // Drag-pan must move 1:1 with the cursor — kill any running zoom
        // tween so the translate updates aren't tweened toward the prior
        // target.
        smoothZoomCancel();
        dragging = true;
        dragMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragOriginTx = tx;
        dragOriginTy = ty;
        imgEl.classList.add("dragging");
      });
      window.addEventListener("mousemove", function (e) {
        if (!dragging) return;
        var dx = e.clientX - dragStartX;
        var dy = e.clientY - dragStartY;
        if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
        tx = dragOriginTx + dx;
        ty = dragOriginTy + dy;
        clamp();
        scheduleApply();
      });
      window.addEventListener("mouseup", function () {
        if (!dragging) return;
        dragging = false;
        imgEl.classList.remove("dragging");
      });

      // Touch: pinch-to-zoom, drag-to-pan when zoomed, swipe-to-navigate when not.
      stage.addEventListener("touchstart", function (e) {
        if (e.touches.length === 2) {
          e.preventDefault();
          // Pinch and drag-pan are continuous gestures — never tween them.
          smoothZoomCancel();
          pinching = true;
          dragging = false;
          swipeCandidate = false;
          var t1 = e.touches[0], t2 = e.touches[1];
          pinchStartDist = touchDist(t1, t2);
          pinchStartScale = scale;
          pinchStartTx = tx;
          pinchStartTy = ty;
          pinchCenter = midpointStage(t1, t2);
        } else if (e.touches.length === 1) {
          var t = e.touches[0];
          if (scale > 1) {
            smoothZoomCancel();
            dragging = true;
            dragMoved = false;
            dragStartX = t.clientX;
            dragStartY = t.clientY;
            dragOriginTx = tx;
            dragOriginTy = ty;
          } else {
            swipeCandidate = true;
            swipeStartX = t.clientX;
            swipeStartY = t.clientY;
          }
        }
      }, { passive: false });

      stage.addEventListener("touchmove", function (e) {
        if (pinching && e.touches.length === 2) {
          e.preventDefault();
          var t1 = e.touches[0], t2 = e.touches[1];
          var d = touchDist(t1, t2);
          var ratio = d / (pinchStartDist || 1);
          var newScale = clampScale(pinchStartScale * ratio);
          // Keep pinch center pinned to the same source point.
          var sx = (pinchCenter.x - pinchStartTx) / pinchStartScale;
          var sy = (pinchCenter.y - pinchStartTy) / pinchStartScale;
          scale = newScale;
          tx = pinchCenter.x - sx * scale;
          ty = pinchCenter.y - sy * scale;
          clamp();
          scheduleApply();
        } else if (dragging && e.touches.length === 1) {
          e.preventDefault();
          var tt = e.touches[0];
          var dx = tt.clientX - dragStartX;
          var dy = tt.clientY - dragStartY;
          if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
          tx = dragOriginTx + dx;
          ty = dragOriginTy + dy;
          clamp();
          scheduleApply();
        }
      }, { passive: false });

      stage.addEventListener("touchend", function (e) {
        if (pinching && e.touches.length < 2) pinching = false;
        if (dragging && e.touches.length === 0) dragging = false;
        if (swipeCandidate && e.touches.length === 0) {
          var t = e.changedTouches && e.changedTouches[0];
          if (t && scale === 1) {
            var dx = t.clientX - swipeStartX;
            var dy = t.clientY - swipeStartY;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
              navigate(dx < 0 ? 1 : -1);
            }
          }
          swipeCandidate = false;
        }
      });

      // Click on minimap pans the main view to that source point.
      minimap.addEventListener("click", function (e) {
        if (scale <= 1) return;
        e.stopPropagation();
        var view = minimapImageRect();
        if (!view) return;
        var mr = minimap.getBoundingClientRect();
        var mx = e.clientX - mr.left - view.left;
        var my = e.clientY - mr.top - view.top;
        var srcX = (mx / view.width) * natW;
        var srcY = (my / view.height) * natH;
        tx = stageW / 2 - srcX * scale;
        ty = stageH / 2 - srcY * scale;
        clamp();
        applyTransform();
      });
    }

    // Helpers --------------------------------------------------------------

    function stagePoint(e) {
      var r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function midpointStage(t1, t2) {
      var r = stage.getBoundingClientRect();
      return {
        x: (t1.clientX + t2.clientX) / 2 - r.left,
        y: (t1.clientY + t2.clientY) / 2 - r.top,
      };
    }
    function touchDist(t1, t2) {
      var dx = t1.clientX - t2.clientX;
      var dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function clampScale(s) {
      return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
    }

    // Compute the image's displayed rect inside the minimap (background-size:
    // contain, so it letterboxes one axis when the aspect doesn't match).
    function minimapImageRect() {
      if (!natW || !natH) return null;
      var mr = minimap.getBoundingClientRect();
      var ratio = Math.min(mr.width / natW, mr.height / natH);
      var w = natW * ratio;
      var h = natH * ratio;
      return {
        left: (mr.width - w) / 2,
        top: (mr.height - h) / 2,
        width: w,
        height: h,
        ratio: ratio,
      };
    }

    function layoutImage() {
      if (!imgEl.naturalWidth) return;
      // Compute the image's fit-to-viewport size from CSS-equivalent
      // viewport-percent caps. Using window dims directly (rather than the
      // stage's rect) lets us size the stage to the image, so the stage's
      // rounded corners hug the image edges and there are no black bands
      // around tall portraits or wide landscapes. Mirrors the .lightbox-stage
      // max-width/max-height in CSS plus the mobile breakpoint.
      var isMobile = window.innerWidth <= 640;
      var maxW = window.innerWidth * (isMobile ? 0.96 : 0.92);
      var maxH = window.innerHeight * (isMobile ? 0.70 : 0.80);
      var ratio = Math.min(maxW / imgEl.naturalWidth, maxH / imgEl.naturalHeight);
      natW = imgEl.naturalWidth * ratio;
      natH = imgEl.naturalHeight * ratio;
      // Stage shrinks to the image (no letterbox); image fills the stage at
      // scale=1 so tx/ty are zero. Zoom expands the image past the stage and
      // overflow:hidden clips it.
      stage.style.width = natW + "px";
      stage.style.height = natH + "px";
      stageW = natW;
      stageH = natH;
      scale = 1;
      tx = 0;
      ty = 0;
      // Minimap reuses the same image as background; CSS `contain` letterboxes.
      minimap.style.backgroundImage = 'url("' + imgEl.src + '")';
      // applyTransform() drives imgEl.style.width/height now (zoom changes the
      // intrinsic CSS box, not just a GPU layer transform — see notes on the
      // function below).
      applyTransform();
    }

    function clamp() {
      var imgW = natW * scale;
      var imgH = natH * scale;
      if (imgW <= stageW) tx = (stageW - imgW) / 2;
      else tx = Math.min(0, Math.max(stageW - imgW, tx));
      if (imgH <= stageH) ty = (stageH - imgH) / 2;
      else ty = Math.min(0, Math.max(stageH - imgH, ty));
    }

    function applyTransform() {
      // Zoom by mutating the image's CSS box, not by GPU-scaling a fixed-size
      // layer. With `transform: scale(s)` plus `will-change: transform`, the
      // browser rasterizes <img> at its CSS size (the fit-to-viewport ~864 px
      // box) into a compositor layer, then bilinearly upscales that layer for
      // paint. So even after the 24 MP master is hot-swapped into src, you're
      // looking at an ~864 px bitmap stretched 3x. Setting width/height to the
      // post-zoom size makes the browser sample directly from the underlying
      // image bytes at the requested resolution — no GPU upscale step in the
      // pipeline. transform stays pure-translate, which the GPU still
      // composites cheaply for pan. (The site-wide `img { max-width: 100% }`
      // rule from layout.css is overridden by `max-width: none` on
      // `.lightbox-img` — without that override the post-zoom CSS width gets
      // capped to the stage and the resampling never happens.)
      imgEl.style.width = (natW * scale) + "px";
      imgEl.style.height = (natH * scale) + "px";
      imgEl.style.transform = "translate(" + tx + "px," + ty + "px)";
      var zoomed = scale > 1.001;
      imgEl.classList.toggle("zoomed", zoomed);
      minimap.classList.toggle("visible", zoomed);
      if (zoomed) updateMinimapRect();
      // Past ~1.05x the preview starts to look soft; fetch the original for the
      // current image and warm both neighbors so a swipe-while-zoomed lands on
      // sharp pixels too. Cheap if already loaded/loading (early-returns).
      if (zoomed && currentIndex >= 0) {
        var n = entries.length;
        maybeLoadFull(currentIndex);
        if (n > 1) {
          maybeLoadFull((currentIndex + 1) % n);
          maybeLoadFull((currentIndex - 1 + n) % n);
        }
      }
    }

    function updateMinimapRect() {
      var view = minimapImageRect();
      if (!view) return;
      // Visible source rect (in unzoomed display units).
      var visX = -tx / scale;
      var visY = -ty / scale;
      var visW = stageW / scale;
      var visH = stageH / scale;
      var rx = view.left + visX * view.ratio;
      var ry = view.top + visY * view.ratio;
      var rw = visW * view.ratio;
      var rh = visH * view.ratio;
      // Constrain rect to within the displayed image area in the minimap.
      if (rx < view.left) { rw -= (view.left - rx); rx = view.left; }
      if (ry < view.top)  { rh -= (view.top  - ry); ry = view.top;  }
      if (rx + rw > view.left + view.width) rw = view.left + view.width - rx;
      if (ry + rh > view.top + view.height) rh = view.top + view.height - ry;
      minimapRect.style.left = rx + "px";
      minimapRect.style.top = ry + "px";
      minimapRect.style.width = Math.max(0, rw) + "px";
      minimapRect.style.height = Math.max(0, rh) + "px";
    }

    function cycleZoom(px, py) {
      var idx = -1;
      for (var i = 0; i < CLICK_ZOOM_LEVELS.length; i++) {
        if (Math.abs(CLICK_ZOOM_LEVELS[i] - scale) < 0.05) { idx = i; break; }
      }
      var next = CLICK_ZOOM_LEVELS[(idx + 1) % CLICK_ZOOM_LEVELS.length];
      // If currently at a non-discrete zoom (after wheel/pinch), snap to first
      // level above current; otherwise advance through the cycle.
      if (idx === -1) {
        next = CLICK_ZOOM_LEVELS.find(function (s) { return s > scale + 0.05; }) || CLICK_ZOOM_LEVELS[0];
      }
      smoothZoomStart();
      zoomTo(next, px, py);
    }

    function zoomTo(newScale, px, py) {
      newScale = clampScale(newScale);
      var sx = (px - tx) / scale;
      var sy = (py - ty) / scale;
      scale = newScale;
      tx = px - sx * scale;
      ty = py - sy * scale;
      clamp();
      scheduleApply();
    }

    function zoomBy(factor) {
      smoothZoomStart();
      zoomTo(scale * factor, stageW / 2, stageH / 2);
    }

    function resetZoom() {
      smoothZoomStart();
      scale = 1;
      tx = (stageW - natW) / 2;
      ty = (stageH - natH) / 2;
      applyTransform();
    }

    function preload(url) { if (url) { var i = new Image(); i.src = url; } }

    function show(index) {
      var n = entries.length;
      currentIndex = ((index % n) + n) % n;
      var e = entries[currentIndex];
      // Reset visual state before swapping; layoutImage() will set fresh values
      // once the new image fires `load`.
      scale = 1; tx = 0; ty = 0;
      imgEl.style.transform = "";
      imgEl.classList.remove("zoomed", "dragging");
      // A pending smoothing tween from a click on the prior image must not
      // animate the new image's reset-to-fit — that'd visibly drift the
      // first paint after navigation.
      smoothZoomCancel();
      minimap.classList.remove("visible");
      // Clear any pending layout-suppress from an in-flight original swap
      // that the user navigated away from before its load event fired.
      // Without this, the new preview's load gets the suppress consumed and
      // layoutImage (which updates the minimap background) is skipped.
      suppressLayoutOnce = false;
      imgEl.src = e.previewUrl;
      imgEl.alt = e.caption;
      var html = e.caption ? escapeHtml(e.caption) : "";
      if (e.fullUrl) {
        html += (html ? "<br>" : "") +
          '<a href="' + escapeAttr(e.fullUrl) + '" target="_blank" rel="noopener">Open original</a>';
      }
      captionEl.innerHTML = html;
      dialog.dataset.index = String(currentIndex);
      preload(entries[(currentIndex + 1) % n].previewUrl);
      preload(entries[(currentIndex - 1 + n) % n].previewUrl);
      // Eager-load the current image's original immediately. HTTP/2 multiplexes
      // it alongside the preview fetch, so the original lands ~250 ms sooner
      // than under the previous setTimeout-deferred path — important because
      // any zoom click before the original arrives has to fall back to the
      // 1500 px preview as the source bitmap, which the renderer then has to
      // upsample to fill the post-zoom CSS box (visibly soft).
      maybeLoadFull(currentIndex);
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
