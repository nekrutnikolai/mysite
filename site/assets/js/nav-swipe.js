// Mobile swipe nav — only active on touch devices and only on top-level
// section pages. Each swipe navigates to the prev/next adjacent section.
// Wraps: Portfolio → About and About → Portfolio.
(function swipeNav() {
  'use strict';

  const ORDER = [
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
  // Swipe threshold: must travel >22% of viewport width OR velocity >0.45 px/ms.
  const DIST_RATIO = 0.22;
  const VEL_THRESHOLD = 0.45; // px/ms

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
    }
    // If axis is 'y' (or still null), do nothing — let scroll propagate normally.
  }

  function onEnd() {
    if (!dragging) { reset(); return; }
    dragging = false;

    if (lockedAxis !== 'x') { reset(); return; }

    const dt = Math.max(1, performance.now() - startT);
    const velocity = deltaX / dt; // px/ms — positive = right-swipe, negative = left-swipe
    const pastThreshold = Math.abs(deltaX) > window.innerWidth * DIST_RATIO;
    const fastEnough   = Math.abs(velocity) > VEL_THRESHOLD;

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
  }

  function navigate(href, direction) {
    if (document.startViewTransition) {
      // Stamp direction so CSS can pick the correct keyframes.
      ROOT.dataset.swipeDirection = direction;
      const transition = document.startViewTransition(() => location.assign(href));
      // Clean up the data attribute after the animation. The page replaces itself
      // so this mostly matters for any edge-case same-document fallback.
      transition.finished.finally(() => {
        delete ROOT.dataset.swipeDirection;
      });
    } else {
      // Browsers without View Transitions API: navigate normally, no animation.
      location.assign(href);
    }
  }

  // Attach listeners. touchmove must be non-passive so we can call preventDefault
  // when we lock to the x axis. touchstart passive: false too, so that the browser
  // doesn't commit to scrolling before we've had a chance to decide.
  window.addEventListener('touchstart',  onStart, { passive: false });
  window.addEventListener('touchmove',   onMove,  { passive: false });
  window.addEventListener('touchend',    onEnd,   { passive: true  });
  window.addEventListener('touchcancel', reset,   { passive: true  });
})();
