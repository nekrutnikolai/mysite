// Mobile swipe nav — only active on touch devices and only on top-level
// section pages. Each swipe navigates to the prev/next adjacent section.
// Wraps: Portfolio → About and About → Portfolio.
(function swipeNav() {
  'use strict';

  const ORDER = [
    { url: '/',           label: 'Home' },
    { url: '/about/',     label: 'About' },
    { url: '/gallery/',   label: 'Gallery' },
    { url: '/posts/',     label: 'Posts' },
    { url: '/resume/',    label: 'Resume' },
    { url: '/portfolio/', label: 'Portfolio' },
  ];

  // Match the current pathname against the exact top-level section URLs.
  // We only want the index pages — NOT /posts/<slug>/, /gallery/<album>/, etc.
  const path = location.pathname;
  const idx = ORDER.findIndex(s => s.url === path);
  if (idx < 0) return;  // not a top-level section — bail immediately

  // Only wire up gesture handling if the device supports touch events OR
  // is a coarse-pointer device (touchscreen laptop). Skip pure mouse devices.
  const hasTouch = ('ontouchstart' in window) || window.matchMedia('(pointer: coarse)').matches;
  if (!hasTouch) return;

  const ROOT = document.documentElement;
  const main = document.querySelector('main.content');
  if (!main) return;

  // State
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let dragging = false;
  let deltaX = 0;
  let lockedAxis = null;  // 'x' | 'y' | null

  // Axis-lock threshold in pixels. At 8px we know intent clearly.
  const AXIS_LOCK_PX = 8;
  // Swipe threshold: must travel >22% of viewport width to trigger distance-based nav,
  // OR travel >10% of viewport while moving faster than 0.45 px/ms (flick).
  // Requiring a minimum distance on the velocity path avoids triggering on zero-time
  // synthetic events (and on accidental micro-flicks).
  const DIST_RATIO = 0.22;
  const VEL_THRESHOLD = 0.45; // px/ms
  const FLICK_MIN_RATIO = 0.15; // minimum distance when relying on velocity alone (≥15% viewport)

  function onStart(e) {
    // Ignore multi-touch (pinch-zoom etc.)
    if (e.touches && e.touches.length !== 1) return;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX;
    startY = t.clientY;
    startT = performance.now();
    dragging = true;
    deltaX = 0;
    lockedAxis = null;
    ROOT.classList.add('swipe-tracking');
  }

  function onMove(e) {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    deltaX = t.clientX - startX;
    const dy = t.clientY - startY;

    // Axis-lock decision: whichever axis crosses 8px first wins for this gesture.
    if (!lockedAxis) {
      const ax = Math.abs(deltaX);
      const ay = Math.abs(dy);
      if (ax > AXIS_LOCK_PX && ax > ay) {
        lockedAxis = 'x';
      } else if (ay > AXIS_LOCK_PX) {
        lockedAxis = 'y';
      }
    }

    if (lockedAxis === 'x') {
      // Prevent browser scroll-while-swiping only when we own the axis.
      if (e.cancelable) e.preventDefault();
      // Expose a normalized [-1, 1] progress value for the CSS edge indicator.
      const live = Math.max(-1, Math.min(1, deltaX / window.innerWidth));
      ROOT.style.setProperty('--swipe-progress', String(live));
      // Track the finger 1:1 for book-page feel; no transition during drag.
      main.style.transition = 'none';
      main.style.transform = 'translateX(' + deltaX + 'px)';
    }
    // If axis is 'y' (or still null), do nothing — let scroll propagate normally.
  }

  function onEnd() {
    if (!dragging) { reset(); return; }
    dragging = false;

    if (lockedAxis !== 'x') { reset(); return; }

    const dt = Math.max(1, performance.now() - startT);
    const velocity = deltaX / dt; // px/ms — positive = right-swipe, negative = left-swipe
    const absDx = Math.abs(deltaX);
    const pastThreshold = absDx > window.innerWidth * DIST_RATIO;
    // A "flick" requires BOTH enough velocity AND a minimum travel distance.
    // Requiring distance prevents zero-time synthetic events (velocity → ∞) from
    // triggering nav on a tap-drag shorter than 10% of the viewport.
    const fastEnough   = Math.abs(velocity) > VEL_THRESHOLD &&
                         absDx > window.innerWidth * FLICK_MIN_RATIO;

    if (!pastThreshold && !fastEnough) { reset(); return; }

    // Swipe left (deltaX < 0) → navigate forward (next section).
    // Swipe right (deltaX > 0) → navigate backward (prev section).
    // Wrapping: modulo arithmetic.
    const nextIdx = deltaX < 0
      ? (idx + 1) % ORDER.length
      : (idx - 1 + ORDER.length) % ORDER.length;
    const direction = deltaX < 0 ? 'left' : 'right';

    navigate(ORDER[nextIdx].url, direction);
  }

  function reset() {
    dragging = false;
    ROOT.classList.remove('swipe-tracking');
    ROOT.style.removeProperty('--swipe-progress');
    // Snap back to origin if we were dragging the page.
    if (main.style.transform) {
      main.style.transition = 'transform .22s cubic-bezier(.22,.72,.18,1)';
      main.style.transform = '';
    }
  }

  function navigate(href, direction) {
    // Continue the finger's motion off-screen in JS, then navigate. Works on
    // every browser (no View Transitions dependency) and avoids the
    // snap-back-then-slide glitch we got when handing off to the
    // cross-document VT mid-gesture. Prefetch keeps the new HTML in cache so
    // paint after location.assign is near-instant.
    const target = direction === 'left' ? -window.innerWidth : window.innerWidth;
    main.style.transition = 'transform .22s cubic-bezier(.22,.72,.18,1)';
    main.style.transform  = 'translateX(' + target + 'px)';
    setTimeout(function () { location.assign(href); }, 220);
  }

  // Attach listeners. touchmove must be non-passive so we can call preventDefault
  // when we lock to the x axis. touchstart passive: false too, so that the browser
  // doesn't commit to scrolling before we've had a chance to decide.
  window.addEventListener('touchstart',  onStart, { passive: false });
  window.addEventListener('touchmove',   onMove,  { passive: false });
  window.addEventListener('touchend',    onEnd,   { passive: true  });
  window.addEventListener('touchcancel', reset,   { passive: true  });
})();
