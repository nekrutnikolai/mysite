// === Reading progress + back-to-top + section indicator ===
/* nav-scroll.js — owned by Agent A (Tier 1).
   Three scroll-driven enhancements:
     1. Reading-progress hairline (post / page / gallery only)
     2. Back-to-top pill (shown after 1.5 viewports of scroll)
     3. Sticky-header section indicator (h2/h3 tracking)
   All three are IIFE-scoped and safe to load on any page (they bail out
   immediately when their required DOM nodes are absent). */

// ── 1. Reading progress hairline ────────────────────────────────────────────
(function readingProgress() {
  const bar = document.getElementById('nav-reading-progress');
  if (!bar) return;
  const article = document.querySelector('main.content article');
  if (!article) { bar.style.display = 'none'; return; }

  function update() {
    const rect = article.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) { bar.style.transform = 'scaleX(1)'; return; }
    const scrolled = -rect.top;
    const ratio = Math.max(0, Math.min(1, scrolled / total));
    bar.style.transform = 'scaleX(' + ratio + ')';
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// ── 2. Back-to-top pill ─────────────────────────────────────────────────────
(function backToTop() {
  const btn = document.getElementById('nav-back-to-top');
  if (!btn) return;
  const threshold = window.innerHeight * 1.5;

  function update() {
    const visible = window.scrollY > threshold;
    btn.toggleAttribute('hidden', !visible);
    if (visible) btn.setAttribute('data-visible', 'true');
    else btn.removeAttribute('data-visible');
  }

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// ── 3. Sticky-header section indicator ─────────────────────────────────────
// When the user scrolls past an h2 or h3 inside the article, surface its
// text in the sticky header span. Notion-style minimal affordance.
// The span's fade-in transition is driven by [data-visible] in layout.css.
(function sectionIndicator() {
  const slot = document.querySelector('[data-section-indicator]');
  if (!slot) return;
  const article = document.querySelector('main.content article');
  if (!article) return;
  const headings = article.querySelectorAll('h2, h3');
  if (!headings.length) return;

  const header = document.querySelector('.site-header');
  const headerH = header ? header.offsetHeight : 56;
  var lastApplied = '';

  function update() {
    var top = headerH + 8;
    var active = '';
    for (var i = 0; i < headings.length; i++) {
      var r = headings[i].getBoundingClientRect();
      if (r.top - top < 0) active = headings[i].textContent.trim();
      else break;
    }
    if (active !== lastApplied) {
      lastApplied = active;
      if (!active) {
        slot.removeAttribute('data-visible');
        slot.textContent = '';
      } else {
        slot.textContent = active;
        // Defer attribute set so the transition fires after textContent paint.
        requestAnimationFrame(function () {
          slot.setAttribute('data-visible', 'true');
        });
      }
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// === Sticky TOC IntersectionObserver ===
// Active-section highlight in the TOC via IntersectionObserver.
// Works in all three themes; the .active class is styled by nav-toc.css.
// Runs on every page that includes nav-toc.js, but exits immediately if
// there is no .toc in the DOM (most pages don't have one).
(function tocActive() {
  'use strict';

  var toc = document.querySelector('.toc');
  if (!toc) return;

  var links = toc.querySelectorAll('a[href^="#"]');
  if (!links.length) return;

  // Map heading id → closest .toc-item element.
  var linkByHash = new Map();
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (id) linkByHash.set(id, a.closest('.toc-item') || a);
  }

  // Collect headings from within the article only (avoids false positives
  // from other h2/h3 elements on the page, e.g. footer, aside).
  var article = document.querySelector('article');
  var scope = article || document;
  var headings = Array.from(scope.querySelectorAll('h2[id], h3[id]'));
  if (!headings.length) return;

  // Track which headings are currently inside the viewport intersection zone.
  var visible = new Set();

  var io = new IntersectionObserver(function (entries) {
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      if (e.isIntersecting) {
        visible.add(e.target.id);
      } else {
        visible.delete(e.target.id);
      }
    }

    // The earliest-in-document visible heading wins.
    var activeId = null;
    for (var k = 0; k < headings.length; k++) {
      if (visible.has(headings[k].id)) {
        activeId = headings[k].id;
        break;
      }
    }

    // Update .active class.
    var activeItems = toc.querySelectorAll('.toc-item.active');
    for (var m = 0; m < activeItems.length; m++) {
      activeItems[m].classList.remove('active');
    }
    if (activeId && linkByHash.has(activeId)) {
      linkByHash.get(activeId).classList.add('active');
    }
  }, {
    // Top 25% of viewport is "above the fold" for the header; bottom 65% is
    // below the reading position. The narrow band in the middle is what we
    // consider the active reading zone.
    rootMargin: '-25% 0px -65% 0px',
    threshold: 0,
  });

  headings.forEach(function (h) { io.observe(h); });
})();

// === Gallery year filter ===
// Gallery year filter — toggles tile visibility based on the chip's data-year.
(function galleryYearFilter() {
  const filter = document.querySelector('[data-gallery-filter]');
  if (!filter) return;
  const chips = filter.querySelectorAll('.gallery-filter-chip');
  const tiles = document.querySelectorAll('.gallery-tile');
  if (!chips.length || !tiles.length) return;

  filter.addEventListener('click', (e) => {
    const chip = e.target.closest('.gallery-filter-chip');
    if (!chip) return;
    const year = chip.dataset.year || '';
    chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    tiles.forEach(t => {
      const tileYear = t.dataset.galleryYear || '';
      const hidden = year && tileYear !== year;
      t.toggleAttribute('data-gallery-hidden', hidden);
    });
    if (history.replaceState) {
      const u = new URL(location.href);
      if (year) u.searchParams.set('year', year);
      else u.searchParams.delete('year');
      history.replaceState(null, '', u.pathname + (u.search || ''));
    }
  });

  // Restore from query string on load.
  const initial = new URLSearchParams(location.search).get('year') || '';
  if (initial) {
    const target = filter.querySelector(`.gallery-filter-chip[data-year="${initial}"]`);
    if (target) target.click();
  }
})();

// === Mobile swipe nav between top-level sections ===
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
    // Force a reflow so the new transition value is committed before the
    // transform changes; without this the browser can batch the two style
    // writes into a single paint and skip the animation (which manifested as
    // an asymmetric snap-back, depending on sub-frame timing).
    void main.offsetWidth;
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

