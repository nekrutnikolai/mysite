// Command palette — fetches /__index.json once on first open, then handles
// fuzzy search + keyboard nav + highlight. Triggered by Cmd/Ctrl+K or click
// on #cmdk-trigger (already in the header from Tier 0).
(function cmdk() {
  var trigger  = document.getElementById('cmdk-trigger');
  var backdrop = document.getElementById('cmdk-backdrop');
  if (!trigger || !backdrop) return;

  var input  = document.getElementById('cmdk-input');
  var list   = document.getElementById('cmdk-list');

  var items    = null;  // null = not fetched yet; [] = fetched but empty
  var filtered = [];
  var active   = 0;
  var opened   = false;

  // ------------------------------------------------------------------ //
  // Index fetch (cached after first open)                               //
  // ------------------------------------------------------------------ //

  async function ensureIndex() {
    if (items !== null) return;
    try {
      var r = await fetch('/__index.json', { cache: 'force-cache' });
      var json = await r.json();
      // Cap to first 200 entries for safety (index will grow over time)
      items = (json.items || []).slice(0, 200);
    } catch (_) {
      items = [];
    }
  }

  // ------------------------------------------------------------------ //
  // Fuzzy scoring: exact > prefix > substring > subsequence             //
  // ------------------------------------------------------------------ //

  function score(item, q) {
    if (!q) return 1;
    var t  = item.title.toLowerCase();
    var qq = q.toLowerCase();
    if (t === qq)         return 1000;
    if (t.startsWith(qq)) return 500 - (t.length - qq.length);
    if (t.includes(qq))   return 200 - t.indexOf(qq);

    // Subsequence: every character of q must appear in order in t
    var i = 0, j = 0, last = -1, gap = 0;
    while (i < t.length && j < qq.length) {
      if (t[i] === qq[j]) {
        if (last >= 0) gap += i - last - 1;
        last = i;
        j++;
      }
      i++;
    }
    if (j < qq.length) return -1;       // not a subsequence match
    return 100 - gap * 2 - (t.length - qq.length);
  }

  // ------------------------------------------------------------------ //
  // HTML helpers                                                         //
  // ------------------------------------------------------------------ //

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Wrap matched substrings in <mark> for visual highlight.
  function highlight(text, q) {
    if (!q) return escapeHtml(text);
    var lo = text.toLowerCase();
    var qq = q.toLowerCase();

    // Prefer contiguous match first (substring highlight)
    var exact = lo.indexOf(qq);
    if (exact >= 0) {
      return escapeHtml(text.slice(0, exact))
           + '<mark>' + escapeHtml(text.slice(exact, exact + qq.length)) + '</mark>'
           + escapeHtml(text.slice(exact + qq.length));
    }

    // Fall back to per-character subsequence highlight
    var out = '';
    var qi = 0;
    for (var ci = 0; ci < text.length; ci++) {
      var ch = text[ci];
      if (qi < qq.length && lo[ci] === qq[qi]) {
        out += '<mark>' + escapeHtml(ch) + '</mark>';
        qi++;
      } else {
        out += escapeHtml(ch);
      }
    }
    return out;
  }

  var KIND_LABEL = {
    page:    'Pages',
    post:    'Posts',
    gallery: 'Galleries',
    tag:     'Tags',
    action:  'Actions',
  };

  var KIND_ORDER = ['action', 'page', 'post', 'gallery', 'tag'];

  function cmdkIcon(kind) {
    return { page: '☰', post: '✎', gallery: '⊞', tag: '#', action: '◇' }[kind] || '·';
  }

  // ------------------------------------------------------------------ //
  // Rendering                                                            //
  // ------------------------------------------------------------------ //

  function render() {
    var q = input.value.trim();

    // Score + filter (cap to 50 visible results)
    var scored = (items || [])
      .map(function(it) { return { it: it, s: score(it, q) }; })
      .filter(function(x) { return x.s >= 0; })
      .sort(function(a, b) { return b.s - a.s; });

    if (active >= scored.length) active = Math.max(0, scored.length - 1);

    if (scored.length === 0) {
      filtered = [];
      list.innerHTML = '<li class="cmdk-empty">No matches.</li>';
      return;
    }

    if (!q) {
      // Group by kind in the default (empty-query) state
      var groups = KIND_ORDER
        .map(function(k) {
          return { k: k, items: scored.filter(function(x) { return x.it.kind === k; }).map(function(x) { return x.it; }) };
        })
        .filter(function(g) { return g.items.length > 0; });

      var flatIndex = 0;
      var html = groups.map(function(g) {
        return '<li class="cmdk-group-label" aria-hidden="true">' + escapeHtml(KIND_LABEL[g.k]) + '</li>'
          + g.items.slice(0, 50).map(function(it) {
              return renderItem(it, flatIndex++, q);
            }).join('');
      }).join('');

      list.innerHTML = html;
      // Re-flatten so keyboard indices stay in sync
      filtered = groups.flatMap(function(g) { return g.items; }).slice(0, 50);
    } else {
      filtered = scored.slice(0, 50).map(function(x) { return x.it; });
      list.innerHTML = filtered.map(function(it, i) { return renderItem(it, i, q); }).join('');
    }

    if (active >= filtered.length) active = Math.max(0, filtered.length - 1);
    syncActive();
  }

  function renderItem(it, i, q) {
    return '<li class="cmdk-item' + (i === active ? ' active' : '') + '" data-i="' + i + '" role="option"'
         + ' aria-selected="' + (i === active ? 'true' : 'false') + '">'
         + '<span class="cmdk-item-icon" aria-hidden="true">' + cmdkIcon(it.kind) + '</span>'
         + '<span class="cmdk-item-text">'
         +   '<span class="cmdk-item-title">' + highlight(it.title, q) + '</span>'
         +   '<span class="cmdk-item-meta">' + escapeHtml(it.meta) + '</span>'
         + '</span>'
         + '<span class="cmdk-item-kind">' + escapeHtml(it.kind) + '</span>'
         + '</li>';
  }

  function syncActive() {
    list.querySelectorAll('.cmdk-item').forEach(function(el) {
      var i = +el.dataset.i;
      var isActive = i === active;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) el.scrollIntoView({ block: 'nearest' });
    });
    // Keep the input's aria-activedescendant pointing at the active option
    var activeEl = list.querySelector('.cmdk-item.active');
    if (activeEl) {
      if (!activeEl.id) activeEl.id = 'cmdk-opt-' + active;
      input.setAttribute('aria-activedescendant', activeEl.id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  // ------------------------------------------------------------------ //
  // Open / close                                                         //
  // ------------------------------------------------------------------ //

  async function open() {
    if (opened) return;
    await ensureIndex();
    opened = true;
    backdrop.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.value = '';
    active = 0;
    render();
    // Defer focus so the browser registers the element as visible first
    setTimeout(function() { input.focus(); }, 0);
    document.body.style.overflow = 'hidden';
    // Return focus to trigger on close
    _triggerForReturn = document.activeElement;
  }

  var _triggerForReturn = null;

  function close() {
    if (!opened) return;
    opened = false;
    backdrop.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    // Restore focus to element that opened the palette
    if (_triggerForReturn && typeof _triggerForReturn.focus === 'function') {
      _triggerForReturn.focus();
    }
    _triggerForReturn = null;
  }

  // ------------------------------------------------------------------ //
  // Navigation                                                           //
  // ------------------------------------------------------------------ //

  function go(item) {
    if (!item) return;
    if (item.url === '#theme') {
      // Toggle-theme action: click the existing theme-toggle button
      var btn = document.getElementById('theme-toggle');
      if (btn) btn.click();
      close();
      return;
    }
    close();
    location.assign(item.url);
  }

  // ------------------------------------------------------------------ //
  // Events                                                               //
  // ------------------------------------------------------------------ //

  // Trigger button click
  trigger.addEventListener('click', open);

  // Global Cmd/Ctrl+K shortcut
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      opened ? close() : open();
      return;
    }
    if (!opened) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        active = Math.min(filtered.length - 1, active + 1);
        syncActive();
        break;
      case 'ArrowUp':
        e.preventDefault();
        active = Math.max(0, active - 1);
        syncActive();
        break;
      case 'Enter':
        e.preventDefault();
        go(filtered[active]);
        break;
    }
  });

  // Input changes trigger re-render
  input.addEventListener('input', function() { active = 0; render(); });

  // Click on a result
  list.addEventListener('click', function(e) {
    var it = e.target.closest('.cmdk-item');
    if (!it) return;
    go(filtered[+it.dataset.i]);
  });

  // Mouse hover updates active (visual parity with keyboard)
  list.addEventListener('mousemove', function(e) {
    var it = e.target.closest('.cmdk-item');
    if (!it) return;
    var i = +it.dataset.i;
    if (i !== active) { active = i; syncActive(); }
  });

  // Click on backdrop (not the panel) closes
  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) close();
  });
})();
