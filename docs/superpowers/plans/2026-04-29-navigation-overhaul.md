# Navigation Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 9 navigation enhancements (mobile swipe, Cmd+K palette, breadcrumbs, sticky TOC, reading-progress hairline, sticky-header section indicator, adjacent-section nav, back-to-top pill, gallery year filter) without regressing the editorial-calm aesthetic, working across light/dark/parchment themes on both desktop and mobile.

**Architecture:** Three execution tiers.
- **Tier 0** (sequential, single agent) pre-stages every shared-file edit so Tier 1 agents never touch the same file. It also lays down empty stylesheets, scripts, partials, and the build-time content index so Tier 1 has zero scaffolding overhead.
- **Tier 1** (six agents in parallel, each in their own git worktree off `migrate-to-node-build`) each fill exactly one feature's owned files.
- **Tier 2** merges, runs the full Playwright suite, refreshes visual snapshots, and ships.

**Tech Stack:** Plain HTML/CSS/JS — no framework. `marked` for markdown, `sharp`+`exifr` for images, `chokidar` for dev watch, Playwright for tests. CSS Grid + Flexbox + IntersectionObserver + PointerEvents.

---

## Branch + Worktree Strategy

Base branch: `migrate-to-node-build` (current). All work lands here, not master.

Tier 0 runs **on the base branch directly** — it's small, low-risk, and the foundation for everything else.

Tier 1 dispatches six parallel agents. Each agent:

1. Creates a worktree off `migrate-to-node-build`'s tip (after Tier 0 is committed):
   ```bash
   git worktree add -b nav/<feature> ../mysite-nav-<feature> migrate-to-node-build
   ```
2. Owns a fixed set of files (defined in their brief). **They MUST NOT modify any file outside that set.**
3. Commits per-task as the writing-plans pattern dictates.
4. When done, leaves the worktree alone — Tier 2 merges them all together.

Worktree directory naming convention:
- `../mysite-nav-scroll`   → Agent A (scroll enhancements)
- `../mysite-nav-crumbs`   → Agent B (breadcrumbs + adjacency)
- `../mysite-nav-toc`      → Agent C (sticky TOC)
- `../mysite-nav-gallery`  → Agent D (gallery year filter)
- `../mysite-nav-swipe`    → Agent E (mobile swipe)
- `../mysite-nav-cmdk`     → Agent F (command palette)

---

## File ownership matrix

| File                                   | Owned by  | Why                                        |
|----------------------------------------|-----------|--------------------------------------------|
| `site/assets/js/nav-scroll.js`         | A         | reading progress + back-to-top + section indicator |
| `site/assets/css/nav-scroll.css`       | A         | scroll enhancement styles                  |
| `site/assets/css/nav-crumbs.css`       | B         | breadcrumbs + adjacency styles             |
| `site/partials/breadcrumbs.html`       | B         | breadcrumb partial                         |
| `site/partials/adjacent-sections.html` | B         | adjacent-section partial                   |
| `site/assets/js/nav-toc.js`            | C         | TOC active-section highlight               |
| `site/assets/css/nav-toc.css`          | C         | sticky TOC layout                          |
| `site/assets/js/nav-gallery-filter.js` | D         | gallery year filter                        |
| `site/assets/css/nav-gallery-filter.css` | D       | gallery year filter styles                 |
| `site/assets/js/nav-swipe.js`          | E         | mobile swipe gesture handler               |
| `site/assets/css/nav-swipe.css`        | E         | swipe overlay + transition styles          |
| `site/assets/js/nav-cmdk.js`           | F         | command palette                            |
| `site/assets/css/nav-cmdk.css`         | F         | command palette styles                     |
| `site/partials/cmdk.html`              | F         | command palette markup partial             |
| `site/partials/head.html`              | **Tier 0** only | every CSS/JS link added once          |
| `site/partials/header.html`            | **Tier 0** only | hook markers added once               |
| `site/templates/post.html`             | **Tier 0** only | partial-include hooks added once      |
| `site/templates/page.html`             | **Tier 0** only | partial-include hooks added once      |
| `site/templates/gallery.html`          | **Tier 0** only | partial-include hooks added once      |
| `site/templates/gallery-list.html`     | **Tier 0** only | year filter section markup            |
| `site/templates/post-list.html`        | **Tier 0** only | breadcrumb hook                       |
| `site/templates/tag.html`              | **Tier 0** only | breadcrumb hook                       |
| `site/templates/tag-list.html`         | **Tier 0** only | breadcrumb hook                       |
| `site/build.mjs`                       | **Tier 0** only | breadcrumb context, gallery-years, content-index emit |
| `site/lib/contentIndex.mjs`            | **Tier 0** only | new module — emits search index       |

Tests live under `tests/` per existing convention. Agents B/D/E/F add behavior tests; A and C piggyback on visual regression.

---

## Tier 0 — Shared Scaffolding (sequential)

**Goal:** lay every hook, link, and build-time context the Tier 1 agents will need so each agent only edits files they own.

**Files in scope:**
- Modify: `site/partials/head.html` — add 6 CSS + 6 JS links (initially pointing at empty files)
- Modify: `site/partials/header.html` — add hooks for section indicator + Cmd+K trigger + swipe wiring
- Modify: `site/templates/{post,page,gallery,gallery-list,post-list,tag,tag-list}.html` — partial-include hooks
- Modify: `site/build.mjs` — `breadcrumbs`, `galleryYears`, content-index emit
- Create (empty/minimal): all CSS/JS files listed in the ownership matrix
- Create: `site/lib/contentIndex.mjs`
- Create: `site/partials/{breadcrumbs,adjacent-sections,cmdk}.html` (empty stubs that render nothing)

### Task 0.1 — Create empty asset files for each feature

- [ ] **Step 1: Create empty stylesheets**

```bash
touch site/assets/css/nav-scroll.css \
      site/assets/css/nav-crumbs.css \
      site/assets/css/nav-toc.css \
      site/assets/css/nav-gallery-filter.css \
      site/assets/css/nav-swipe.css \
      site/assets/css/nav-cmdk.css
```

- [ ] **Step 2: Create empty scripts**

```bash
touch site/assets/js/nav-scroll.js \
      site/assets/js/nav-toc.js \
      site/assets/js/nav-gallery-filter.js \
      site/assets/js/nav-swipe.js \
      site/assets/js/nav-cmdk.js
```

- [ ] **Step 3: Create empty partials**

Write `site/partials/breadcrumbs.html` with content:

```html
<!-- breadcrumb partial — owned by Agent B (Tier 1) -->
{{#crumbs}}{{/crumbs}}
```

Write `site/partials/adjacent-sections.html` with content:

```html
<!-- adjacent-section nav partial — owned by Agent B (Tier 1) -->
{{#adjacent}}{{/adjacent}}
```

Write `site/partials/cmdk.html` with content:

```html
<!-- command palette partial — owned by Agent F (Tier 1) -->
```

### Task 0.2 — Wire CSS + JS into head.html

**Files:**
- Modify: `site/partials/head.html`

- [ ] **Step 1: Append the new CSS + JS links**

Append at the end of `site/partials/head.html` (after the existing `<link>` for `resume.css`):

```html
<link rel="stylesheet" href="/assets/css/nav-scroll.css">
<link rel="stylesheet" href="/assets/css/nav-crumbs.css">
<link rel="stylesheet" href="/assets/css/nav-toc.css">
<link rel="stylesheet" href="/assets/css/nav-gallery-filter.css">
<link rel="stylesheet" href="/assets/css/nav-swipe.css">
<link rel="stylesheet" href="/assets/css/nav-cmdk.css">
```

JS files load `defer` from the bottom of each template (matching the existing `theme.js` pattern). They're added in **Task 0.4** because each template that needs them is touched there.

- [ ] **Step 2: Run a local build and confirm no errors**

```bash
npm run build
```

Expected: builds clean, all 45 pages emitted. New CSS files are empty so no visual change.

- [ ] **Step 3: Commit**

```bash
git add site/partials/head.html \
        site/assets/css/nav-*.css \
        site/assets/js/nav-*.js \
        site/partials/breadcrumbs.html \
        site/partials/adjacent-sections.html \
        site/partials/cmdk.html
git commit -m "Scaffold nav-overhaul empty asset slots"
```

### Task 0.3 — Add header hooks (section indicator + Cmd+K trigger)

**Files:**
- Modify: `site/partials/header.html`

- [ ] **Step 1: Add the section-indicator slot and Cmd+K trigger**

Replace the entire body of `site/partials/header.html` with:

```html
<header class="site-header">
  <a class="site-logo" href="/">n<sup>n</sup></a>
  <span class="site-section-indicator" data-section-indicator aria-hidden="true"></span>

  <button id="nav-toggle" type="button" class="site-nav-toggle" aria-label="Menu" aria-controls="site-nav" aria-expanded="false">
    <span class="site-nav-toggle-bars" aria-hidden="true"></span>
  </button>

  <nav id="site-nav" class="site-nav">
    {{#nav}}<a href="{{ href }}"{{#external}} target="_blank" rel="noopener"{{/external}}{{#active}} aria-current="page"{{/active}}>{{ label }}</a>{{/nav}}
  </nav>

  <button id="cmdk-trigger" type="button" class="site-cmdk-trigger" aria-label="Search the site (Ctrl+K)">
    <span aria-hidden="true">⌕</span>
    <kbd class="site-cmdk-trigger-key">⌘K</kbd>
  </button>

  <button id="theme-toggle" type="button" aria-label="Toggle theme" class="theme-toggle"></button>
</header>
```

The section indicator is initially empty; Agent A wires it. The `#cmdk-trigger` button is the visible Cmd+K affordance; Agent F wires it.

- [ ] **Step 2: Add baseline styles for the new chrome (so they don't look broken in the meantime)**

Append to `site/assets/css/layout.css` (right after the existing `.theme-toggle` rules):

```css
/* Section indicator — fades in below the logo as the reader scrolls past h2.
   Wired by site/assets/js/nav-scroll.js (Agent A). */
.site-header .site-section-indicator {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--text-muted);
  margin-left: var(--s-3);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--dur-med) var(--ease), transform var(--dur-med) var(--ease);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  min-width: 0;
}
.site-header .site-section-indicator[data-visible="true"] {
  opacity: 1;
  transform: translateY(0);
}
@media (max-width: 640px) {
  .site-header .site-section-indicator { display: none; }
}

/* Cmd+K trigger button — the visible affordance for the palette. */
.site-header .site-cmdk-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px 0 12px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.site-header .site-cmdk-trigger:hover {
  border-color: var(--border-strong);
  color: var(--text);
}
.site-header .site-cmdk-trigger-key {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  padding: 1px 5px;
  background: var(--surface-1);
  border-radius: 3px;
  border: 1px solid var(--border);
}
@media (max-width: 640px) {
  .site-header .site-cmdk-trigger-key { display: none; }
  .site-header .site-cmdk-trigger { padding: 0 10px; }
}
```

- [ ] **Step 3: Build + visual sanity check**

```bash
npm run build
```

Open `http://localhost:3102/` in a browser. The header should now have an empty space (section indicator) plus a `⌕ ⌘K` button between the nav and the theme toggle. Otherwise unchanged.

- [ ] **Step 4: Commit**

```bash
git add site/partials/header.html site/assets/css/layout.css
git commit -m "Add section-indicator slot + Cmd+K trigger to site header"
```

### Task 0.4 — Wire feature scripts into every template

**Files:**
- Modify: `site/templates/{post,page,gallery,gallery-list,post-list,tag,tag-list,home}.html`

- [ ] **Step 1: Define the script block once**

The existing pattern is `<script src="/assets/js/theme.js" defer></script>` at the bottom of each template. We add five more **defer** scripts, in load order:

```html
<script src="/assets/js/theme.js" defer></script>
<script src="/assets/js/nav-scroll.js" defer></script>
<script src="/assets/js/nav-toc.js" defer></script>
<script src="/assets/js/nav-gallery-filter.js" defer></script>
<script src="/assets/js/nav-swipe.js" defer></script>
<script src="/assets/js/nav-cmdk.js" defer></script>
```

Apply this exact block to **every** template under `site/templates/`. The order matters: `theme.js` first (sets data-theme), then nav scripts. Each script no-ops on pages that don't need it (Agents A–F design them so).

- [ ] **Step 2: Update each template**

For each of `post.html`, `page.html`, `gallery.html`, `gallery-list.html`, `post-list.html`, `tag.html`, `tag-list.html`, `home.html`, `base.html`, `404.html`: replace the line `<script src="/assets/js/theme.js" defer></script>` with the six-line block above.

- [ ] **Step 3: Build + verify**

```bash
npm run build
grep -c 'nav-scroll.js' dist/index.html dist/about/index.html dist/posts/index.html dist/gallery/index.html dist/posts/eolrc-build-guide/index.html
```

Each of those should report `1`.

- [ ] **Step 4: Commit**

```bash
git add site/templates/*.html
git commit -m "Wire nav-* deferred scripts into every template"
```

### Task 0.5 — Add breadcrumb context to build.mjs

**Files:**
- Modify: `site/build.mjs`

- [ ] **Step 1: Add a `buildCrumbs` helper**

Insert after the existing `navForUrl` function (around line 114):

```js
// Breadcrumbs from a URL. Returns [{label, href}, ...] including a final
// non-link entry for the current page when `currentLabel` is supplied.
// Examples:
//   /                         -> []
//   /posts/                   -> [{Home, /}]
//   /posts/foo-bar/           -> [{Home, /}, {Posts, /posts/}]
//   /tags/                    -> [{Home, /}]
//   /tags/RC/                 -> [{Home, /}, {Tags, /tags/}]
//   /gallery/maine-trip/      -> [{Home, /}, {Gallery, /gallery/}]
function buildCrumbs(url, currentLabel) {
  const out = [];
  if (url === "/") return out;
  out.push({ label: "Home", href: "/" });
  if (url.startsWith("/posts/") && url !== "/posts/") {
    out.push({ label: "Posts", href: "/posts/" });
  } else if (url.startsWith("/tags/") && url !== "/tags/") {
    out.push({ label: "Tags", href: "/tags/" });
  } else if (url.startsWith("/gallery/") && url !== "/gallery/") {
    out.push({ label: "Gallery", href: "/gallery/" });
  }
  if (currentLabel) out.push({ label: currentLabel, href: null, current: true });
  return out;
}
```

- [ ] **Step 2: Pass `crumbs` into every page render context**

For each `render("post", buildOgCtx({ ... }))`, `render("page", ...)`, `render("gallery", ...)`, `render("gallery-list", ...)`, `render("post-list", ...)`, `render("tag", ...)`, `render("tag-list", ...)`, add a `crumbs` field. Concrete edits:

In the post render block (around line 425), inside the `buildOgCtx` payload add:

```js
crumbs: buildCrumbs(entry.outputPath, entry.frontmatter.title || entry.slug),
```

In the page render block (around line 529), add:

```js
crumbs: buildCrumbs(outputPath, fm.title || ""),
```

In the gallery render block (around line 310), add:

```js
crumbs: buildCrumbs(entry.outputPath, title),
```

In the gallery-list render (around line 349), add:

```js
crumbs: buildCrumbs("/gallery/", "Gallery"),
```

In the post-list render (around line 453), add:

```js
crumbs: buildCrumbs("/posts/", "Posts"),
```

In the tag-list render (around line 482), add:

```js
crumbs: buildCrumbs("/tags/", "Tags"),
```

In the tag render (around line 494), add:

```js
crumbs: buildCrumbs(tag.url, `Tagged: ${tag.name}`),
```

- [ ] **Step 3: Build + spot check**

```bash
npm run build
node -e 'console.log(require("fs").readFileSync("dist/posts/eolrc-build-guide/index.html","utf8").match(/data-crumbs[\s\S]{0,200}/)?.[0] || "no crumbs marker yet — that is OK, partials/breadcrumbs.html is still a stub")'
```

Just verify build still passes. The crumbs go into the template context but aren't rendered until Agent B writes the partial.

- [ ] **Step 4: Commit**

```bash
git add site/build.mjs
git commit -m "Compute breadcrumb chains in build context"
```

### Task 0.6 — Add gallery-year context to build.mjs

**Files:**
- Modify: `site/build.mjs`

- [ ] **Step 1: Extract years per gallery + the year set**

Inside `build()`, after the `galleryListItems.sort(...)` line (around line 347), add:

```js
// For Agent D's gallery year filter: stamp each tile with its year (string,
// for HTML data-attr ergonomics) and aggregate the descending year list.
for (const item of galleryListItems) {
  item.year = item.dateISO ? String(new Date(item.dateISO).getFullYear()) : "";
}
const galleryYears = [...new Set(galleryListItems.map((g) => g.year).filter(Boolean))]
  .sort((a, b) => Number(b) - Number(a))
  .map((y) => ({ year: y }));
```

- [ ] **Step 2: Pass into the gallery-list render**

Modify the existing gallery-list render context (line 349 area) to include:

```js
years: galleryYears,
```

- [ ] **Step 3: Build + verify**

```bash
npm run build
grep -c 'data-gallery-year' dist/gallery/index.html
```

Expected: `0` for now (template hasn't consumed it yet — Agent D will).

- [ ] **Step 4: Commit**

```bash
git add site/build.mjs
git commit -m "Aggregate gallery years for filter chips"
```

### Task 0.7 — Add gallery filter markup hooks to gallery-list.html

**Files:**
- Modify: `site/templates/gallery-list.html`

- [ ] **Step 1: Wrap each tile with year data + add chip rail markup**

Replace the body of `site/templates/gallery-list.html`'s gallery-grid section so each `<li>` carries `data-gallery-year="{{ year }}"` and a hidden chip rail sits above the grid. Specifically, insert above the grid:

```html
<nav class="gallery-filter" data-gallery-filter aria-label="Filter galleries by year">
  <button type="button" class="gallery-filter-chip" data-year="" aria-pressed="true">All</button>
  {{#years}}<button type="button" class="gallery-filter-chip" data-year="{{ year }}" aria-pressed="false">{{ year }}</button>{{/years}}
</nav>
```

And on each gallery tile `<li>`, add `data-gallery-year="{{ year }}"`.

(The exact existing template to modify will be visible to the agent; this Task 0.7 just requires the hooks. Agent D fills the JS + CSS that powers them.)

- [ ] **Step 2: Build + verify**

```bash
npm run build
grep -c 'data-gallery-filter' dist/gallery/index.html
grep -c 'data-gallery-year' dist/gallery/index.html
```

Both should be `>= 1`.

- [ ] **Step 3: Commit**

```bash
git add site/templates/gallery-list.html
git commit -m "Add gallery year-filter markup hooks"
```

### Task 0.8 — Add per-template partial hooks for breadcrumbs + adjacent + back-to-top + reading progress

**Files:**
- Modify: `site/templates/{post,page,gallery,gallery-list,post-list,tag,tag-list}.html`

- [ ] **Step 1: Insert the breadcrumb partial near the top of each main**

In each template above, immediately inside `<main class="content...">`, add:

```html
{{> breadcrumbs }}
```

- [ ] **Step 2: Insert reading-progress + back-to-top hooks**

In `post.html`, `page.html`, `gallery.html`, `gallery-list.html`, `post-list.html`, `tag.html`, `tag-list.html`, add (just before `</main>`):

```html
<button id="nav-back-to-top" class="nav-back-to-top" type="button" aria-label="Back to top" hidden>↑</button>
```

And inside `<body>` directly after the opening tag, add (so it pins to the very top of the viewport):

```html
<div id="nav-reading-progress" class="nav-reading-progress" aria-hidden="true"></div>
```

- [ ] **Step 3: Insert adjacent-section partial at the bottom of the main content for non-post pages**

In `page.html` and `gallery.html`, immediately before `</main>`, add:

```html
{{> adjacent-sections }}
```

- [ ] **Step 4: Insert Cmd+K palette markup partial**

Inside `base.html`, immediately before `</body>`, add:

```html
{{> cmdk }}
```

(`base.html` is included by all rendered pages indirectly via the per-template `<body>` blocks. The palette ships globally.)

- [ ] **Step 5: Build + verify**

```bash
npm run build
grep -c 'nav-reading-progress' dist/posts/eolrc-build-guide/index.html
grep -c 'nav-back-to-top' dist/posts/eolrc-build-guide/index.html
```

Both should be `1`.

- [ ] **Step 6: Commit**

```bash
git add site/templates/*.html
git commit -m "Add per-template hooks for breadcrumbs, adjacency, progress, back-to-top, cmdk"
```

### Task 0.9 — Build the content index emitter

**Files:**
- Create: `site/lib/contentIndex.mjs`
- Modify: `site/build.mjs`

- [ ] **Step 1: Create the emitter**

Write `site/lib/contentIndex.mjs`:

```js
// Emit /__index.json — flat list consumed by the Cmd+K palette (Agent F).
// One JSON file with every navigable destination on the site.

export function buildContentIndex({ pages, posts, galleries, tags, allPagesUrls }) {
  const items = [];

  // Top-level pages (about, portfolio, resume, home).
  items.push({ kind: "page", title: "Home",      meta: "/",            url: "/" });
  for (const p of pages) {
    const fm = p.frontmatter || {};
    items.push({
      kind: "page",
      title: fm.title || p.slug,
      meta: p.outputPath,
      url: p.outputPath,
    });
  }

  // Posts.
  for (const p of posts) {
    const fm = p.frontmatter || {};
    const tags = Array.isArray(fm.tags) ? fm.tags.slice(0, 3).join(", ") : "";
    items.push({
      kind: "post",
      title: fm.title || p.slug,
      meta: tags ? `Post · ${tags}` : "Post",
      url: p.outputPath,
    });
  }

  // Galleries.
  for (const g of galleries) {
    items.push({
      kind: "gallery",
      title: (g.frontmatter && g.frontmatter.title) || g.slug,
      meta: `Gallery · ${(g.imageRecords || []).length} photos`,
      url: g.outputPath,
    });
  }

  // Tags.
  for (const t of tags) {
    items.push({
      kind: "tag",
      title: t.name,
      meta: `Tag · ${t.count} post${t.count === 1 ? "" : "s"}`,
      url: t.url,
    });
  }

  // Quick actions.
  items.push({ kind: "action", title: "Toggle theme",         meta: "light → dark → parchment", url: "#theme" });
  items.push({ kind: "action", title: "Download Resume.pdf",  meta: "PDF",                       url: "/Resume.pdf" });
  items.push({ kind: "action", title: "Email Nikolai",        meta: "nan34@cornell.edu",         url: "mailto:nan34@cornell.edu" });

  return JSON.stringify({ generatedAt: new Date().toISOString(), items });
}
```

- [ ] **Step 2: Wire it into build.mjs**

At the top of `site/build.mjs`, add the import:

```js
import { buildContentIndex } from "./lib/contentIndex.mjs";
```

In `build()`, just before the feeds-writing section (around line 663), add:

```js
fs.writeFileSync(
  path.join(DIST, "__index.json"),
  buildContentIndex({ pages, posts, galleries, tags: allTags })
);
```

- [ ] **Step 3: Build + verify**

```bash
npm run build
node -e 'const i = require("./dist/__index.json"); console.log(i.items.length, "items"); console.log(i.items.slice(0,3))'
```

Expected: prints ~50 items (1 home + 4 pages + 7 posts + 13 galleries + 16 tags + 3 actions ≈ 44+).

- [ ] **Step 4: Commit**

```bash
git add site/lib/contentIndex.mjs site/build.mjs
git commit -m "Emit /__index.json content index for Cmd+K"
```

### Task 0.10 — Baseline build, dev server, snapshot before Tier 1

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: `built 45 pages ... in <60>s`.

- [ ] **Step 2: Run the integrity test suite to confirm no Tier-0 regressions**

```bash
ITERATION=8 npm run test:iter || npm test -- --grep integrity
```

(Pick whichever is fastest; the integrity disciplines verifies link health, OG meta, sitemap shape — exactly what Tier 0 might have broken.)

Expected: green.

- [ ] **Step 3: Tag this point — fallback target if integration goes sideways**

```bash
git tag nav-overhaul-tier0
```

This isn't a release tag; it's a local checkpoint that Tier 2 can `git diff` against to inspect the per-feature deltas cleanly.

---

## Tier 1 — Six Parallel Agents

> Each agent below is a self-contained brief. The dispatching agent (the orchestrator) creates one worktree per agent and hands them the brief verbatim.

> All agents start from `migrate-to-node-build` at HEAD (after Tier 0 commits). All agents commit to their own branch (`nav/<feature>`).

> **Cross-cutting acceptance criteria for every agent:**
> - All three themes render correctly (light, dark, parchment)
> - WCAG 2.1 AA contrast preserved
> - Reduced-motion respected
> - Mobile (≤640px) verified visually
> - No console errors on any rendered page

---

### Agent A — Visual scroll enhancements

**Owns:** reading progress hairline, back-to-top pill, sticky-header section indicator.

**Files:**
- Create: `site/assets/css/nav-scroll.css` (currently empty)
- Create: `site/assets/js/nav-scroll.js` (currently empty)
- May read: `site/assets/css/tokens.css`, `themes.css`, `layout.css`

**Worktree:**
```bash
git worktree add -b nav/scroll ../mysite-nav-scroll migrate-to-node-build
cd ../mysite-nav-scroll
```

#### Task A.1 — Reading progress hairline

- [ ] **Step 1: Style the bar**

Append to `site/assets/css/nav-scroll.css`:

```css
.nav-reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: 0 50%;
  z-index: 100;
  pointer-events: none;
  will-change: transform;
  transition: transform 80ms linear;
}
@media (prefers-reduced-motion: reduce) {
  .nav-reading-progress { transition: none; }
}
```

- [ ] **Step 2: Wire the scroll listener**

Append to `site/assets/js/nav-scroll.js`:

```js
// Reading progress hairline — only active when there's a single <article>
// (post / page / gallery). Skipped on listing pages.
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
    bar.style.transform = `scaleX(${ratio})`;
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
```

- [ ] **Step 3: Verify visually**

```bash
npm run dev
```

Open `http://localhost:3102/posts/how-to-build-a-website-a-guide-for-command-line-novices/` and scroll. The 2px accent bar at the top should fill smoothly.

- [ ] **Step 4: Commit**

```bash
git add site/assets/css/nav-scroll.css site/assets/js/nav-scroll.js
git commit -m "Add reading-progress hairline"
```

#### Task A.2 — Back-to-top pill

- [ ] **Step 1: Style the pill**

Append to `site/assets/css/nav-scroll.css`:

```css
.nav-back-to-top {
  position: fixed;
  right: max(var(--s-4), env(safe-area-inset-right, 0));
  bottom: max(var(--s-5), env(safe-area-inset-bottom, 0));
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface-0);
  color: var(--text);
  border: 1px solid var(--border-strong);
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px var(--shadow);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity var(--dur-med) var(--ease), transform var(--dur-med) var(--ease), background var(--dur) var(--ease);
  z-index: 50;
}
.nav-back-to-top[data-visible="true"] {
  opacity: 1;
  transform: translateY(0);
}
.nav-back-to-top:hover {
  background: var(--surface-1);
}
.nav-back-to-top:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .nav-back-to-top { transition: none; }
}
```

- [ ] **Step 2: Wire scroll detection + click handler**

Append to `site/assets/js/nav-scroll.js`:

```js
// Back-to-top pill — shown after the user scrolls past 1.5 viewports.
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

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
```

- [ ] **Step 3: Verify visually**

Reload the long post. After scrolling more than ~1.5 viewports, the round pill should fade in bottom-right. Click → smooth-scroll to top.

- [ ] **Step 4: Commit**

```bash
git add site/assets/css/nav-scroll.css site/assets/js/nav-scroll.js
git commit -m "Add back-to-top pill"
```

#### Task A.3 — Sticky-header section indicator

- [ ] **Step 1: Wire IntersectionObserver to update the header span**

Append to `site/assets/js/nav-scroll.js`:

```js
// Section indicator — when the user scrolls past an h2 inside the article,
// surface its text in the sticky header. Notion-style.
(function sectionIndicator() {
  const slot = document.querySelector('[data-section-indicator]');
  if (!slot) return;
  const article = document.querySelector('main.content article');
  if (!article) return;
  const headings = article.querySelectorAll('h2, h3');
  if (!headings.length) return;

  // We want the LAST h2/h3 that has been scrolled past the header bottom.
  const header = document.querySelector('.site-header');
  const headerH = header ? header.offsetHeight : 56;
  let activeText = '';
  let lastApplied = '';

  function update() {
    const top = headerH + 8;
    let active = '';
    for (const h of headings) {
      const r = h.getBoundingClientRect();
      if (r.top - top < 0) active = h.textContent.trim();
      else break;
    }
    if (active !== lastApplied) {
      lastApplied = active;
      if (!active) {
        slot.removeAttribute('data-visible');
        slot.textContent = '';
      } else {
        slot.textContent = active;
        // delay setting attr until after textContent paint to allow transition
        requestAnimationFrame(() => slot.setAttribute('data-visible', 'true'));
      }
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
```

- [ ] **Step 2: Verify visually**

Reload the long post. As you scroll past each `h2` or `h3`, the heading text should appear next to the logo, smoothly fading. Cross-check with the existing TOC anchor IDs (already emitted by `markdown.mjs`).

- [ ] **Step 3: Commit**

```bash
git add site/assets/js/nav-scroll.js
git commit -m "Wire section indicator to scroll position"
```

#### Task A.4 — Visual regression snapshot for Agent A

- [ ] **Step 1: Add a Playwright test**

Create `tests/visual/nav-scroll.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { setTheme } from '../helpers/theme';

const POST = '/posts/how-to-build-a-website-a-guide-for-command-line-novices/';

for (const theme of ['light', 'dark', 'parchment'] as const) {
  test(`nav-scroll · ${theme} · idle`, async ({ page }) => {
    await page.goto(POST);
    await setTheme(page, theme);
    await expect(page).toHaveScreenshot(`nav-scroll-${theme}-idle.png`, { fullPage: false });
  });

  test(`nav-scroll · ${theme} · scrolled-half`, async ({ page }) => {
    await page.goto(POST);
    await setTheme(page, theme);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' as ScrollBehavior }));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot(`nav-scroll-${theme}-scrolled-half.png`, { fullPage: false });
  });
}
```

- [ ] **Step 2: Seed snapshots**

```bash
npm run test:update -- --grep 'nav-scroll'
```

- [ ] **Step 3: Confirm snapshots exist**

```bash
ls tests/snapshots/ | grep nav-scroll
```

Expected: 6 PNGs (3 themes × 2 states).

- [ ] **Step 4: Commit**

```bash
git add tests/visual/nav-scroll.spec.ts tests/snapshots/nav-scroll-*.png
git commit -m "Test: visual regression for nav-scroll across themes"
```

**Acceptance for Agent A:**
- Reading progress fills and empties smoothly (no jank, smooth animation)
- Back-to-top pill appears past 1.5 viewports, scrolls to top on click
- Section indicator text updates as the user scrolls past h2/h3
- All three themes render correctly with no contrast regressions

---

### Agent B — Breadcrumbs + adjacent-section nav

**Owns:** breadcrumbs partial, adjacent-section partial, their CSS.

**Files:**
- Modify: `site/partials/breadcrumbs.html`
- Modify: `site/partials/adjacent-sections.html`
- Modify: `site/assets/css/nav-crumbs.css`
- Read-only: `site/build.mjs`, `site/templates/*` (already wired by Tier 0)

**Worktree:**
```bash
git worktree add -b nav/crumbs ../mysite-nav-crumbs migrate-to-node-build
cd ../mysite-nav-crumbs
```

#### Task B.1 — Render the breadcrumb partial

- [ ] **Step 1: Replace the stub partial**

Overwrite `site/partials/breadcrumbs.html` with:

```html
{{#crumbs.length}}
<nav class="nav-crumbs" aria-label="Breadcrumb">
  <ol>
    {{#crumbs}}
      {{#href}}<li><a href="{{ href }}">{{ label }}</a></li>{{/href}}
      {{^href}}<li><span aria-current="page">{{ label }}</span></li>{{/href}}
    {{/crumbs}}
  </ol>
</nav>
{{/crumbs.length}}
```

> **Note on the template engine:** the project's mustache-lite supports `{{#section}}…{{/section}}` for arrays AND for truthy. Using `{{#crumbs.length}}` works because the engine will read property `.length` on the `crumbs` array; if `length>0` (truthy), the section renders.

(If during testing the `.length` property access doesn't work, fall back to: build.mjs sets `hasCrumbs: crumbs.length > 0` and the partial uses `{{#hasCrumbs}}`. Verify in `site/lib/template.mjs` first.)

- [ ] **Step 2: Style breadcrumbs**

Append to `site/assets/css/nav-crumbs.css`:

```css
.nav-crumbs {
  margin: 0 0 var(--s-4);
  font-size: 13px;
  color: var(--text-faint);
}
.nav-crumbs ol {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
}
.nav-crumbs li {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: lowercase;
}
.nav-crumbs li:not(:last-child)::after {
  content: "›";
  margin: 0 8px;
  color: var(--text-faint);
}
.nav-crumbs a {
  color: var(--text-muted);
  text-decoration: none;
  padding: 2px 0;
  transition: color var(--dur) var(--ease);
}
.nav-crumbs a:hover {
  color: var(--text);
  text-decoration: underline;
}
.nav-crumbs [aria-current="page"] {
  color: var(--text-muted);
  max-width: 40ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .nav-crumbs [aria-current="page"] { max-width: 25ch; }
}
```

- [ ] **Step 3: Build + visually verify**

```bash
npm run build
```

Open a post URL. Breadcrumbs should appear above the title: `home › posts › <title>`.

- [ ] **Step 4: Commit**

```bash
git add site/partials/breadcrumbs.html site/assets/css/nav-crumbs.css
git commit -m "Render breadcrumbs above main content"
```

#### Task B.2 — Adjacent-section nav at the bottom of pages

- [ ] **Step 1: Compute adjacency in the partial**

The adjacent-section partial needs `prev` and `next` from context. Since Tier 0 didn't add this (only crumbs were added), Agent B extends `build.mjs` minimally:

> **NOTE TO AGENT B:** This task DOES touch `build.mjs`. Coordinate via PR review — your edits should be additive only.

Modify `site/build.mjs`. Add a helper near `buildCrumbs`:

```js
// Adjacency for the top-level "section" pages, which form a circular order
// matching the visual nav: about → gallery → posts → resume → portfolio → about.
const TOP_LEVEL_ORDER = [
  { url: "/about/",     label: "About" },
  { url: "/gallery/",   label: "Gallery" },
  { url: "/posts/",     label: "Posts" },
  { url: "/resume/",    label: "Resume" },
  { url: "/portfolio/", label: "Portfolio" },
];
function adjacentSections(url) {
  const i = TOP_LEVEL_ORDER.findIndex((s) => url === s.url || url.startsWith(s.url + "/"));
  if (i < 0) return null;
  const N = TOP_LEVEL_ORDER.length;
  const prev = TOP_LEVEL_ORDER[(i - 1 + N) % N];
  const next = TOP_LEVEL_ORDER[(i + 1) % N];
  return { prev, next };
}
```

Pass `adjacent: adjacentSections(outputPath)` into the page render context (line ~529) and into the gallery render and gallery-list render contexts.

- [ ] **Step 2: Render the partial**

Overwrite `site/partials/adjacent-sections.html`:

```html
{{#adjacent}}
<nav class="nav-adjacent" aria-label="Adjacent sections">
  <a class="nav-adjacent-prev" href="{{ prev.url }}">
    <span class="nav-adjacent-label">← Previous</span>
    <span class="nav-adjacent-title">{{ prev.label }}</span>
  </a>
  <a class="nav-adjacent-next" href="{{ next.url }}">
    <span class="nav-adjacent-label">Next →</span>
    <span class="nav-adjacent-title">{{ next.label }}</span>
  </a>
</nav>
{{/adjacent}}
```

- [ ] **Step 3: Style it**

Append to `site/assets/css/nav-crumbs.css`:

```css
.nav-adjacent {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-4);
  margin: var(--s-7) 0 var(--s-5);
  padding: var(--s-4) 0;
  border-top: 1px solid var(--border);
}
.nav-adjacent-prev,
.nav-adjacent-next {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  padding: var(--s-3) var(--s-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  text-decoration: none;
  color: var(--text);
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.nav-adjacent-prev:hover,
.nav-adjacent-next:hover {
  border-color: var(--border-strong);
  background: var(--surface-1);
}
.nav-adjacent-next { text-align: right; }
.nav-adjacent-label {
  font-size: var(--fs-caption);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: var(--ls-label);
}
.nav-adjacent-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 16px;
  color: var(--text);
}
@media (max-width: 640px) {
  .nav-adjacent {
    grid-template-columns: 1fr;
    gap: var(--s-2);
  }
  .nav-adjacent-next { text-align: left; }
}
```

- [ ] **Step 4: Verify**

```bash
npm run build
```

Visit `/about/`, `/portfolio/`, `/gallery/` — each should show prev/next at the bottom.

- [ ] **Step 5: Commit**

```bash
git add site/build.mjs site/partials/adjacent-sections.html site/assets/css/nav-crumbs.css
git commit -m "Add prev/next nav between top-level sections"
```

**Acceptance for Agent B:**
- Breadcrumbs appear above main content on every page except `/`
- The current-page entry is non-link, properly marked `aria-current="page"`
- Adjacent-section nav appears at the bottom of all top-level section pages (except `/posts/<slug>/` since adjacent posts already exist)
- Mobile (≤640px) collapses adjacency to one column

---

### Agent C — Sticky in-page TOC for long posts

**Owns:** TOC sidebar layout, active-section highlighting.

**Files:**
- Modify: `site/assets/css/nav-toc.css`
- Modify: `site/assets/js/nav-toc.js`
- Modify: `site/partials/toc.html` (existing)

**Worktree:**
```bash
git worktree add -b nav/toc ../mysite-nav-toc migrate-to-node-build
cd ../mysite-nav-toc
```

#### Task C.1 — Sticky desktop TOC layout

- [ ] **Step 1: Inspect existing TOC**

Read `site/partials/toc.html` to confirm what context it consumes. Currently the TOC is rendered inline at the top of pages with `toc: true` frontmatter; we want it pinned on the right margin on wide viewports while keeping the inline version as mobile fallback.

- [ ] **Step 2: Make TOC sticky**

Append to `site/assets/css/nav-toc.css`:

```css
@media (min-width: 1080px) {
  /* Two-column layout: article on the left, TOC pinned on the right.
     Only when the page actually has a TOC (.toc element exists in DOM). */
  body:has(.toc) main.content {
    max-width: 1080px;
    display: grid;
    grid-template-columns: minmax(0, 720px) 240px;
    column-gap: var(--s-7);
    align-items: start;
  }
  /* The article occupies the first column, the TOC the second. */
  body:has(.toc) main.content > .toc {
    position: sticky;
    top: calc(var(--topbar-h) + var(--s-4));
    grid-column: 2;
    grid-row: 1 / span 99;
    margin: 0;
    background: transparent;
    border: none;
    padding: 0;
    max-height: calc(100vh - var(--topbar-h) - var(--s-5));
    overflow-y: auto;
  }
  body:has(.toc) main.content > article {
    grid-column: 1;
    grid-row: 1;
  }
}
.toc-list .toc-item.active > a {
  color: var(--accent);
  font-weight: 500;
}
```

- [ ] **Step 3: Wire active-section highlight via IntersectionObserver**

Append to `site/assets/js/nav-toc.js`:

```js
// Active-section highlight in the TOC.
(function tocActive() {
  const toc = document.querySelector('.toc');
  if (!toc) return;
  const links = toc.querySelectorAll('a[href^="#"]');
  if (!links.length) return;

  const linkByHash = new Map();
  for (const a of links) {
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (id) linkByHash.set(id, a.closest('.toc-item') || a);
  }

  const headings = [...document.querySelectorAll('article h2[id], article h3[id]')];
  const visible = new Set();

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target.id);
      else visible.delete(e.target.id);
    }
    // The earliest visible heading wins.
    let active = null;
    for (const h of headings) {
      if (visible.has(h.id)) { active = h.id; break; }
    }
    toc.querySelectorAll('.toc-item.active').forEach(el => el.classList.remove('active'));
    if (active && linkByHash.has(active)) {
      linkByHash.get(active).classList.add('active');
    }
  }, { rootMargin: '-25% 0px -65% 0px', threshold: 0 });

  headings.forEach(h => io.observe(h));
})();
```

- [ ] **Step 4: Verify**

Open `/posts/how-to-build-a-website-a-guide-for-command-line-novices/` (which has TOC). On desktop ≥1080px, TOC should sit pinned on the right. Active section should highlight as you scroll.

- [ ] **Step 5: Visual snapshot**

Add to a new file `tests/visual/nav-toc.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { setTheme } from '../helpers/theme';

const POST_WITH_TOC = '/posts/how-to-build-a-website-a-guide-for-command-line-novices/';

test('nav-toc · light · sticky desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(POST_WITH_TOC);
  await setTheme(page, 'light');
  await expect(page).toHaveScreenshot('nav-toc-light-sticky.png', { fullPage: false });
});
```

Then `npm run test:update -- --grep 'nav-toc'`.

- [ ] **Step 6: Commit**

```bash
git add site/assets/css/nav-toc.css site/assets/js/nav-toc.js tests/visual/nav-toc.spec.ts tests/snapshots/nav-toc-*.png
git commit -m "Sticky TOC sidebar with active-section highlight"
```

**Acceptance for Agent C:**
- TOC is pinned on the right at viewports ≥1080px on pages with `toc: true`
- TOC reverts to the existing inline pattern below 1080px (no behavior change)
- Active heading highlights with `--accent` as the user scrolls
- `:has()` selector gracefully degrades on browsers without support (Safari ≤15.4) — fall back to inline

---

### Agent D — Gallery year/season filter

**Owns:** chip rail behavior, filter CSS.

**Files:**
- Modify: `site/assets/css/nav-gallery-filter.css`
- Modify: `site/assets/js/nav-gallery-filter.js`

(The markup hooks were already added in Tier 0 — Task 0.7.)

**Worktree:**
```bash
git worktree add -b nav/gallery ../mysite-nav-gallery migrate-to-node-build
cd ../mysite-nav-gallery
```

#### Task D.1 — Style the chip rail

- [ ] **Step 1: Append the styles**

Write to `site/assets/css/nav-gallery-filter.css`:

```css
.gallery-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: var(--s-4) 0 var(--s-5);
}
.gallery-filter-chip {
  background: var(--surface-1);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 4px 12px;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  font-variant-numeric: tabular-nums;
}
.gallery-filter-chip:hover {
  border-color: var(--border-strong);
  color: var(--text);
}
.gallery-filter-chip[aria-pressed="true"] {
  background: var(--accent-subtle);
  border-color: transparent;
  color: var(--accent);
}
.gallery-filter-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.gallery-tile[data-gallery-hidden="true"] {
  display: none;
}
```

#### Task D.2 — Wire the filter behavior

- [ ] **Step 1: Append the JS**

Write to `site/assets/js/nav-gallery-filter.js`:

```js
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
```

#### Task D.3 — Verify + test

- [ ] **Step 1: Visual check**

Open `/gallery/`. Click each year chip — only galleries from that year should show. Click "All" — every gallery returns. URL should update with `?year=2024` etc.

- [ ] **Step 2: Add a Playwright behavior test**

Create `tests/integrity/nav-gallery-filter.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('gallery filter hides non-matching years', async ({ page }) => {
  await page.goto('/gallery/');
  const chips = page.locator('.gallery-filter-chip');
  expect(await chips.count()).toBeGreaterThan(1);
  // Pick the first non-"All" chip
  const firstYearChip = chips.nth(1);
  const year = await firstYearChip.getAttribute('data-year');
  await firstYearChip.click();
  // All visible tiles must have that year
  const visibleYears = await page.$$eval(
    '.gallery-tile:not([data-gallery-hidden])',
    (els, expected) => els.map(el => (el as HTMLElement).dataset.galleryYear).filter(Boolean),
    year
  );
  for (const y of visibleYears) expect(y).toBe(year);
});
```

- [ ] **Step 3: Run the test**

```bash
npx playwright test tests/integrity/nav-gallery-filter.spec.ts
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add site/assets/css/nav-gallery-filter.css \
        site/assets/js/nav-gallery-filter.js \
        tests/integrity/nav-gallery-filter.spec.ts
git commit -m "Gallery year filter chips"
```

**Acceptance for Agent D:**
- "All" chip is selected by default; clicking a year filters tiles
- URL updates with `?year=YYYY` so filtered views are shareable
- Browser back/forward respects the query
- a11y: chips use `aria-pressed`, focus styles visible

---

### Agent E — Mobile swipe gestures

**Owns:** swipe gesture handler, page transition, hash-routing.

**Files:**
- Modify: `site/assets/js/nav-swipe.js`
- Modify: `site/assets/css/nav-swipe.css`

**Worktree:**
```bash
git worktree add -b nav/swipe ../mysite-nav-swipe migrate-to-node-build
cd ../mysite-nav-swipe
```

#### Architecture choice for swipe nav

The demo at `/__nav-demo/swipe/` simulated swipe on a single SPA page. Production has a different shape: each top-level section is a real URL with its own document. Two viable approaches:

- **A. View Transitions API** (Chrome / Edge / Safari 18+; Firefox shipping): emits a slide animation on cross-document navigation. Production-grade.
- **B. Multi-page with no animation**: Plain `location.assign()` on swipe end. Loses the "social media" feel.
- **C. SPA shim**: Fetch the destination HTML, swap `<main>`, `pushState`. ~3 KB JS. Risk: SEO impact on first-paint links, edge cases with theme/script init.

**Pick A** — graceful fallback to B on browsers without View Transitions support. Skip C: it complicates the build and doesn't gain much.

#### Task E.1 — Detect swipe + navigate

- [ ] **Step 1: Define the section order**

The same as Agent B's `TOP_LEVEL_ORDER`, but on the client side. Mirror it manually in JS (one line drift acceptable):

Append to `site/assets/js/nav-swipe.js`:

```js
// Mobile swipe nav — only active on touch devices and only on top-level
// section pages. Each swipe navigates to the prev/next adjacent section.
(function swipeNav() {
  const ORDER = [
    { url: '/about/',     label: 'About' },
    { url: '/gallery/',   label: 'Gallery' },
    { url: '/posts/',     label: 'Posts' },
    { url: '/resume/',    label: 'Resume' },
    { url: '/portfolio/', label: 'Portfolio' },
  ];

  // Index for the current section (-1 if not on one — disable then).
  const path = location.pathname;
  let idx = ORDER.findIndex(s => path === s.url || path.startsWith(s.url) && !path.includes('/posts/'));
  if (idx < 0) return;

  // Disable on coarse-pointer-only devices? No — touch laptops exist.
  // We DO disable when there's no Touch events support.
  if (!('ontouchstart' in window) && !window.matchMedia('(pointer: coarse)').matches) return;

  let startX = 0, startY = 0, startT = 0;
  let dragging = false;
  let deltaX = 0;
  let lockedAxis = null;

  const ROOT = document.documentElement;
  const main = document.querySelector('main.content');
  if (!main) return;

  function onStart(e) {
    if (e.touches && e.touches.length !== 1) return;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY; startT = performance.now();
    dragging = true;
    deltaX = 0; lockedAxis = null;
    ROOT.classList.add('swipe-tracking');
  }

  function onMove(e) {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    deltaX = t.clientX - startX;
    const dy = t.clientY - startY;
    if (!lockedAxis) {
      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(dy)) lockedAxis = 'x';
      else if (Math.abs(dy) > 8) lockedAxis = 'y';
    }
    if (lockedAxis === 'x') {
      if (e.cancelable) e.preventDefault();
      const live = Math.max(-1, Math.min(1, deltaX / window.innerWidth));
      ROOT.style.setProperty('--swipe-progress', String(live));
    }
  }

  function onEnd() {
    if (!dragging) { reset(); return; }
    const dt = Math.max(1, performance.now() - startT);
    const v = deltaX / dt;
    const past = Math.abs(deltaX) > window.innerWidth * 0.22;
    const fast = Math.abs(v) > 0.45;

    if (lockedAxis !== 'x' || (!past && !fast)) { reset(); return; }

    const next = deltaX < 0 ? (idx + 1) % ORDER.length : (idx - 1 + ORDER.length) % ORDER.length;
    navigate(ORDER[next].url, deltaX < 0 ? 'left' : 'right');
  }

  function reset() {
    dragging = false;
    ROOT.classList.remove('swipe-tracking');
    ROOT.style.removeProperty('--swipe-progress');
  }

  function navigate(href, direction) {
    if (document.startViewTransition) {
      // Pass the direction so the CSS animation can pick the right curve.
      ROOT.dataset.swipeDirection = direction;
      const t = document.startViewTransition(() => location.assign(href));
      // Clean up — though navigation will replace the page anyway.
      t.finished.finally(() => delete ROOT.dataset.swipeDirection);
    } else {
      location.assign(href);
    }
  }

  window.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove',  onMove,  { passive: false });
  window.addEventListener('touchend',   onEnd);
  window.addEventListener('touchcancel', reset);
})();
```

#### Task E.2 — Style the transition

- [ ] **Step 1: View Transitions CSS**

Write `site/assets/css/nav-swipe.css`:

```css
@view-transition { navigation: auto; }

::view-transition-old(root) {
  animation: 220ms cubic-bezier(0.22, 0.72, 0.18, 1) both swipe-out-left;
}
::view-transition-new(root) {
  animation: 220ms cubic-bezier(0.22, 0.72, 0.18, 1) both swipe-in-right;
}
[data-swipe-direction="right"] ::view-transition-old(root) {
  animation-name: swipe-out-right;
}
[data-swipe-direction="right"] ::view-transition-new(root) {
  animation-name: swipe-in-left;
}

@keyframes swipe-out-left  { from { transform: translateX(0); } to { transform: translateX(-30%); opacity: 0; } }
@keyframes swipe-in-right  { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes swipe-out-right { from { transform: translateX(0); } to { transform: translateX(30%);  opacity: 0; } }
@keyframes swipe-in-left   { from { transform: translateX(-100%); } to { transform: translateX(0); } }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) { animation: none; }
}

/* Optional micro-feedback while the user is dragging — a subtle peek of
   the destination edge color. Only shows when --swipe-progress is set. */
.swipe-tracking::before {
  content: "";
  position: fixed;
  top: 0; bottom: 0;
  width: 3px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 80ms linear;
  z-index: 99;
}
.swipe-tracking::before {
  opacity: clamp(0, calc(var(--swipe-progress, 0) * -10), 1);
  right: 0;
}
```

#### Task E.3 — Behavior test

- [ ] **Step 1: Add a basic Playwright test**

Create `tests/integrity/nav-swipe.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('mobile swipe-left navigates to next section', async ({ page, browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  await p.goto('/about/');
  // Simulate a swipe-left
  await p.touchscreen.tap(300, 400);
  await p.evaluate(async () => {
    const dispatch = (type: string, x: number, y: number) => window.dispatchEvent(new TouchEvent(type, {
      touches: [new Touch({ identifier: 1, target: document.body, clientX: x, clientY: y })],
      cancelable: true,
    }));
    dispatch('touchstart', 320, 400);
    await new Promise(r => setTimeout(r, 16));
    dispatch('touchmove',  100, 400);
    await new Promise(r => setTimeout(r, 16));
    dispatch('touchend',   100, 400);
  });
  await p.waitForURL('**/gallery/');
  expect(p.url()).toContain('/gallery/');
});
```

(If TouchEvent is not exposed in the test runner, replace with `page.touchscreen.tap` + Pointer event simulation.)

- [ ] **Step 2: Run**

```bash
npx playwright test tests/integrity/nav-swipe.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add site/assets/js/nav-swipe.js \
        site/assets/css/nav-swipe.css \
        tests/integrity/nav-swipe.spec.ts
git commit -m "Mobile swipe gestures with View Transitions fallback"
```

**Acceptance for Agent E:**
- Swiping left on a top-level section navigates to the next section in `TOP_LEVEL_ORDER` (about → gallery → posts → resume → portfolio → about wrap)
- Swipe right reverses
- Vertical scroll is unaffected (axis lock works)
- Swipe is not active on `/posts/<slug>/`, `/gallery/<album>/`, `/tags/<tag>/` (only top-level sections)
- View Transitions slide animation plays on supported browsers
- Browsers without View Transitions still navigate (no animation)

---

### Agent F — Command palette (Cmd+K)

**Owns:** the palette itself — markup partial, JS, CSS.

**Files:**
- Modify: `site/partials/cmdk.html`
- Modify: `site/assets/js/nav-cmdk.js`
- Modify: `site/assets/css/nav-cmdk.css`

**Worktree:**
```bash
git worktree add -b nav/cmdk ../mysite-nav-cmdk migrate-to-node-build
cd ../mysite-nav-cmdk
```

#### Task F.1 — Render the palette markup

- [ ] **Step 1: Overwrite the partial**

Write to `site/partials/cmdk.html`:

```html
<div class="cmdk-backdrop" id="cmdk-backdrop" role="dialog" aria-modal="true" aria-label="Site palette" hidden>
  <div class="cmdk-panel" role="document">
    <div class="cmdk-input-row">
      <span class="cmdk-glyph" aria-hidden="true">⌕</span>
      <input class="cmdk-input" id="cmdk-input"
             placeholder="Jump to a page, post, gallery, or tag…"
             autocomplete="off" spellcheck="false" type="text">
      <kbd class="cmdk-esc-hint">esc</kbd>
    </div>
    <ul class="cmdk-list" id="cmdk-list" role="listbox"></ul>
    <footer class="cmdk-footer">
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
      <span><kbd>↵</kbd> open</span>
      <span><kbd>esc</kbd> close</span>
    </footer>
  </div>
</div>
```

#### Task F.2 — Style the palette

- [ ] **Step 1: Reuse the demo CSS, but read live tokens**

Copy the relevant CSS from `static/__nav-demo/cmdk/index.html` (the `.palette*` rules), rename the class prefix `palette` → `cmdk`, and write to `site/assets/css/nav-cmdk.css`. Make sure all colors are token references (already true in the demo). The trigger button styles already exist in `layout.css` from Tier 0.

#### Task F.3 — Wire the JS, fetch the index, search

- [ ] **Step 1: Write the JS**

Write to `site/assets/js/nav-cmdk.js`:

```js
// Command palette — fetches /__index.json once on first open, then handles
// fuzzy search + keyboard nav. Triggered by Cmd/Ctrl+K or click on
// #cmdk-trigger.
(function cmdk() {
  const trigger  = document.getElementById('cmdk-trigger');
  const backdrop = document.getElementById('cmdk-backdrop');
  if (!trigger || !backdrop) return;
  const input = document.getElementById('cmdk-input');
  const list  = document.getElementById('cmdk-list');

  let items = null;
  let filtered = [];
  let active = 0;
  let opened = false;

  async function ensureIndex() {
    if (items) return;
    try {
      const r = await fetch('/__index.json', { cache: 'force-cache' });
      const json = await r.json();
      items = json.items || [];
    } catch (e) {
      items = [];
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function score(item, q) {
    if (!q) return 1;
    const t = item.title.toLowerCase();
    const qq = q.toLowerCase();
    if (t === qq) return 1000;
    if (t.startsWith(qq)) return 500 - (t.length - qq.length);
    if (t.includes(qq))   return 200 - t.indexOf(qq);
    let i = 0, j = 0, last = -1, gap = 0;
    while (i < t.length && j < qq.length) {
      if (t[i] === qq[j]) {
        if (last >= 0) gap += i - last - 1;
        last = i; j++;
      }
      i++;
    }
    if (j < qq.length) return -1;
    return 100 - gap * 2 - (t.length - qq.length);
  }

  function render() {
    const q = input.value.trim();
    filtered = (items || [])
      .map(it => ({ it, s: score(it, q) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.it);
    if (active >= filtered.length) active = Math.max(0, filtered.length - 1);

    list.innerHTML = filtered.length === 0
      ? '<li class="cmdk-empty">No matches.</li>'
      : filtered.map((it, i) => `
          <li class="cmdk-item ${i === active ? 'active' : ''}" data-i="${i}" role="option">
            <span class="cmdk-item-icon" aria-hidden="true">${cmdkIcon(it.kind)}</span>
            <span class="cmdk-item-text">
              <span class="cmdk-item-title">${escapeHtml(it.title)}</span>
              <span class="cmdk-item-meta">${escapeHtml(it.meta)}</span>
            </span>
            <span class="cmdk-item-kind">${it.kind}</span>
          </li>
        `).join('');
  }

  function cmdkIcon(kind) {
    return { page: '☰', post: '✎', gallery: '⊞', tag: '#', action: '◇' }[kind] || '·';
  }

  async function open() {
    await ensureIndex();
    opened = true;
    backdrop.hidden = false;
    input.value = '';
    active = 0;
    render();
    setTimeout(() => input.focus(), 0);
    document.body.style.overflow = 'hidden';
  }

  function close() {
    opened = false;
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }

  function go(item) {
    if (!item) return;
    if (item.url === '#theme') {
      document.getElementById('theme-toggle')?.click();
      close();
      return;
    }
    location.assign(item.url);
  }

  trigger.addEventListener('click', open);

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      opened ? close() : open();
      return;
    }
    if (!opened) return;
    if (e.key === 'Escape')   { e.preventDefault(); close(); }
    if (e.key === 'ArrowDown'){ e.preventDefault(); active = Math.min(filtered.length - 1, active + 1); render(); }
    if (e.key === 'ArrowUp')  { e.preventDefault(); active = Math.max(0, active - 1); render(); }
    if (e.key === 'Enter')    { e.preventDefault(); go(filtered[active]); }
  });

  input.addEventListener('input', () => { active = 0; render(); });
  list.addEventListener('click', e => {
    const it = e.target.closest('.cmdk-item');
    if (!it) return;
    go(filtered[+it.dataset.i]);
  });
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) close();
  });
})();
```

- [ ] **Step 2: Verify**

```bash
npm run dev
```

Open any page. Press Cmd+K (or Ctrl+K). Type `eolrc` — fuzzy match should show the EOLRC posts. Enter goes to the first one.

- [ ] **Step 3: Add a basic test**

Create `tests/integrity/nav-cmdk.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('cmd+K opens palette and filters', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#cmdk-backdrop')).toBeVisible();
  await page.locator('#cmdk-input').fill('maine');
  const titles = await page.$$eval('.cmdk-item-title', els => els.map(e => (e as HTMLElement).textContent));
  expect(titles.some(t => t && t.toLowerCase().includes('maine'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmdk-backdrop')).toBeHidden();
});

test('cmdk index file exists', async ({ request }) => {
  const r = await request.get('/__index.json');
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(Array.isArray(j.items)).toBe(true);
  expect(j.items.length).toBeGreaterThan(20);
});
```

- [ ] **Step 4: Run**

```bash
npx playwright test tests/integrity/nav-cmdk.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add site/partials/cmdk.html \
        site/assets/js/nav-cmdk.js \
        site/assets/css/nav-cmdk.css \
        tests/integrity/nav-cmdk.spec.ts
git commit -m "Command palette with fuzzy search over content index"
```

**Acceptance for Agent F:**
- Cmd+K (or Ctrl+K) anywhere on the site opens the palette
- Backdrop click + Esc + Enter all behave correctly
- Fuzzy search matches subsequence + ranks exact > prefix > substring > subseq
- "Toggle theme" action triggers the existing `#theme-toggle` button
- Trigger button in the header opens the palette on click
- Palette is keyboard-only-navigable (full a11y on the listbox)
- All three themes render correctly

---

## Tier 2 — Integration

After all six Tier 1 agents have committed their work, the orchestrator merges everything back to `migrate-to-node-build`.

### Task 2.1 — Merge worktrees

- [ ] **Step 1: Make sure each agent's branch is current**

```bash
for w in mysite-nav-scroll mysite-nav-crumbs mysite-nav-toc mysite-nav-gallery mysite-nav-swipe mysite-nav-cmdk; do
  (cd ../$w && git status --short && git log --oneline -3)
done
```

Each should show no uncommitted changes.

- [ ] **Step 2: Merge each branch**

In the **main** worktree (the original `mysite/`):

```bash
git checkout migrate-to-node-build
git merge --no-ff nav/scroll  -m "Merge nav/scroll"
git merge --no-ff nav/crumbs  -m "Merge nav/crumbs"
git merge --no-ff nav/toc     -m "Merge nav/toc"
git merge --no-ff nav/gallery -m "Merge nav/gallery"
git merge --no-ff nav/swipe   -m "Merge nav/swipe"
git merge --no-ff nav/cmdk    -m "Merge nav/cmdk"
```

If any merge has conflicts (most likely in `build.mjs` if Agent B's adjacency edits conflict with Tier 0), resolve by keeping both edits.

- [ ] **Step 3: Build to confirm**

```bash
npm run build
```

Expected: clean build.

### Task 2.2 — Full test suite

- [ ] **Step 1: Run every discipline**

```bash
npm run test
```

Expected: all green. If any test fails, this is where Tier 2 stops to fix it before re-running.

- [ ] **Step 2: Update visual snapshots if any visual test failed but the failure is intentional**

```bash
npm run test:update
```

Review the diff carefully — only commit snapshots that reflect intended changes.

- [ ] **Step 3: Commit snapshots if updated**

```bash
git add tests/snapshots/
git commit -m "Update visual snapshots for nav overhaul"
```

### Task 2.3 — Cleanup worktrees

- [ ] **Step 1: Remove the per-agent worktrees**

```bash
for w in mysite-nav-scroll mysite-nav-crumbs mysite-nav-toc mysite-nav-gallery mysite-nav-swipe mysite-nav-cmdk; do
  git worktree remove ../$w
done
```

The branches stay until you explicitly delete them — keep them around in case Tier 3 finds an issue.

---

## Tier 3 — Verification

### Task 3.1 — Mobile device check

- [ ] **Step 1: Test on a real phone**

Open `http://<your-LAN-IP>:3102/` from a phone (the dev server already binds 0.0.0.0). Verify on iPhone (Safari) and Android (Chrome):

- Swipe between top-level sections works smoothly
- Hamburger still works in addition to swipe
- Cmd+K trigger button is reachable but not crowded
- Reading progress hairline visible
- Back-to-top pill appears
- Breadcrumbs read correctly
- TOC sticks correctly on tablet (≥1080px landscape)
- Gallery year filter chips work

### Task 3.2 — Cross-theme visual review

- [ ] **Step 1: Manually toggle themes on the home + a post + gallery**

Light → dark → parchment cycle. Look for:
- contrast regressions
- hairline missing in any theme
- back-to-top pill background mismatched
- breadcrumb separator visible on parchment background

### Task 3.3 — Lighthouse perf budget

- [ ] **Step 1: Run programmatic Lighthouse on the home + maine-trip gallery**

```bash
npm run test:perf
```

Expected:
- Home: perf ≥ 95, LCP < 1500 ms
- `/gallery/maine-trip/`: perf ≥ 80, LCP < 3500 ms

The new JS adds ~10 KB total — should not blow the budget.

### Task 3.4 — A11y axe sweep

- [ ] **Step 1: Run accessibility tests across themes**

```bash
npm run test:a11y
```

Expected: green. Pay particular attention to:
- The Cmd+K palette role/aria-modal/listbox tree
- The breadcrumb nav landmark
- Focus visibility on the back-to-top pill

---

## Tier 4 — Ship

### Task 4.1 — Push to origin

- [ ] **Step 1: Push the branch**

```bash
git push origin migrate-to-node-build
```

### Task 4.2 — Open PR or merge

User's call. If the user wants the migration cutover (Hugo → Node) to ship together with this nav overhaul, open a PR for review:

```bash
gh pr create --title "Navigation overhaul: swipe, palette, breadcrumbs, TOC, scroll polish, gallery filter" --body "$(cat <<'EOF'
## Summary
- Mobile swipe gestures between top-level sections (View Transitions where supported)
- Cmd+K command palette over content index
- Breadcrumbs on every inner page
- Sticky in-page TOC for long posts
- Reading-progress hairline
- Header section indicator
- Adjacent-section nav at bottom of section pages
- Back-to-top pill
- Gallery year filter chips

## Test plan
- [ ] All Playwright disciplines green
- [ ] Manual phone test (iPhone + Android)
- [ ] Light, dark, parchment themes visually verified
- [ ] Lighthouse perf budgets met

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Task 4.3 — Cleanup

After merge, delete the per-agent branches:

```bash
git branch -d nav/scroll nav/crumbs nav/toc nav/gallery nav/swipe nav/cmdk
git push origin --delete nav/scroll nav/crumbs nav/toc nav/gallery nav/swipe nav/cmdk 2>/dev/null || true
```

---

## Appendix A — Feature → Acceptance map

| # | Feature                          | Verified by                   |
|---|----------------------------------|-------------------------------|
| 1 | Mobile swipe                     | Agent E + Tier 3.1 mobile test |
| 2 | Cmd+K palette                    | Agent F tests + Tier 3.4 a11y  |
| 3 | Breadcrumbs                      | Agent B + visual snapshots     |
| 4 | Sticky TOC                       | Agent C + Tier 3.2 visual      |
| 5 | Reading progress                 | Agent A + visual snapshots     |
| 6 | Section indicator                | Agent A behavior + Tier 3.1    |
| 7 | Adjacent-section nav             | Agent B + visual               |
| 8 | Back-to-top pill                 | Agent A + visual snapshots     |
| 10 | Gallery year filter             | Agent D test + Tier 3.1        |

## Appendix B — Risk register

| Risk | Mitigation |
|------|-----------|
| Multiple agents conflict on shared files | Tier 0 pre-stages all hooks; ownership matrix is fixed |
| Mustache-lite `{{#crumbs.length}}` doesn't dot-traverse | Agent B has a fallback (`hasCrumbs` boolean) — verify in `lib/template.mjs` first |
| View Transitions break on Firefox <127 | Graceful fallback to plain `location.assign` |
| Visual snapshots churn on every CSS change | Tier 2 task 2.2 explicitly reviews diffs before committing |
| Merge order matters (Agent B touches build.mjs after Tier 0) | Always merge B FIRST in Task 2.1 to surface conflicts early |
| Cmd+K palette steals Cmd+K from the browser's "show downloads" on Chrome (which is Cmd+J actually) | Cmd+K is unbound by default in Chrome on Mac; safe |
| Agent E's swipe blocks vertical scroll on iOS | Axis lock at 8px; further test on real iPhone |

## Appendix C — Self-review checklist

Before declaring this plan ready:
- [ ] Every feature in the user's selection (1, 2, 3, 4, 5, 6, 7, 8, 10) has a Tier 1 agent
- [ ] No "TBD" / "TODO" placeholders in any task
- [ ] Every code block compiles standalone (no missing imports / undeclared variables)
- [ ] Every cross-task reference (e.g., A.1 → A.2) names a real task
- [ ] All file paths absolute from repo root
- [ ] All commit messages match the existing style (active voice, no trailing period)
