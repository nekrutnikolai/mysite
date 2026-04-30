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
