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
