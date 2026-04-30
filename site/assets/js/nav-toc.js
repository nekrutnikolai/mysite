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
