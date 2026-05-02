# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nikolai Nekrutenko's personal site. Migrated from Hugo + hello-friend-ng to a hand-written Node build pipeline that emits pure HTML/CSS into `dist/` (April 2026). All Hugo artifacts (`public/`, `themes/` submodule, `layouts/`, `config.toml`, `archetypes/`) were deleted post-cutover; the only remnants are `layouts/shortcodes/{mkdowntable,countygrapherv1}.html` because `site/lib/shortcodes.mjs` still reads them at build-time for inline iframe markup.

Design identity is grounded in `claude-code-design-guide.html` (strict guideline — Notion/Linear-style editorial calm) with a third "parchment" theme adapted from `parchement_theme.md` (colors only — typography/radius/motion stay consistent across themes).

Live site is `https://nnekrut.netlify.app/`, built and deployed from `master` by Netlify running `npm ci && npm run download-originals && npm run build`.

## Prerequisites

- Node ≥ 20.
- `npx playwright install chromium` — first time only, needed for tests.
- `.env` with R2 credentials — copy `.env.example` and fill in `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`. Without it the build still runs but gallery images will be broken (sharp has nothing to process).

## Commands

- `npm run dev` — start local dev server on `http://localhost:3100` with chokidar watch + SSE live-reload. Cold-build takes ~75 s (146 gallery images through `sharp`); subsequent rebuilds are near-instant thanks to `site/cache/images.json`.
- `npm run build` — one-shot production build into `dist/`.
- `npm run download-originals` — pull gallery masters from R2 (needs `.env`).
- `npm run upload-originals` — push clean + watermarked galleries to R2 after a `BUILD_ORIGINALS=1` build.
- `npm run test` — full Playwright suite (starts dev server automatically via `playwright.config.ts` `webServer`).
- `npx playwright test tests/integrity.spec.ts` — run a single spec file.
- `npx playwright test -g "broken links"` — run tests matching a name pattern.
- `npm run test:visual` / `test:a11y` / `test:perf` / `test:integrity` — single-discipline runs.
- `npm run test:update` — re-seed visual golden screenshots after intentional CSS changes.
- `npm run report` — open the Playwright HTML report after a failed run.

## Architecture

**Pure HTML output from a tiny Node build.** The whole pipeline is a few hundred LOC of stdlib + five runtime deps (`marked`, `gray-matter`, `sharp`, `exifr`, `chokidar`). No framework, no templating engine, no CSS preprocessor.

- `site/build.mjs` orchestrates all phases: rm dist → copy `static/` and `site/assets/` → scan content → process gallery images → render posts/pages/galleries/tags → render home → copy PDFs → write RSS (`/index.xml`) + sitemap (`/sitemap.xml`) + `/robots.txt` + `/404.html` + `/__index.json` (Cmd+K palette).
- `site/serve.mjs` is `node:http` + chokidar. On any watched change it re-runs `build()` and pushes an SSE `event: reload` to connected clients via `/__events`. HTML responses get `<script src="/__livereload.js">` injected just before `</body>` so pages auto-reload on save.
- `site/lib/template.mjs` is a ~80-LOC mustache-lite renderer: `{{var}}` (HTML-escaped), `{{{raw}}}` (unescaped — for already-rendered markdown bodies), `{{#list}}…{{/list}}` (iterate arrays / enter objects / truthy-block for scalars), `{{^list}}…{{/list}}` (inverse), `{{>partial}}` (inlined once at template-load, recursively, with cycle detection).
- `site/lib/shortcodes.mjs` pre-processes the four Hugo shortcodes that actually appear in content (`figure`, `youtube`, `gallery`, `mkdowntable`) via a single regex pass before feeding to `marked`. This is simpler than writing a marked extension and works because the shortcodes are line-level directives.
- `site/lib/images.mjs` processes 146 gallery JPEGs with `sharp` (thumbnail 300h + preview 2000w + 32w blur placeholder) and `exifr` (Make/Model/Lens/Focal/F-number/Exposure/ISO). A manifest cache at `site/cache/images.json` keyed on `srcMtime + srcSize + watermarkConfigHash` makes incremental rebuilds near-instant. Concurrency capped at 8 sharp workers.
- `site/lib/routes.mjs` implements Hugo-compatible `slugify` (verified empirically against the original Hugo `public/` so every URL migrates bit-for-bit).
- `site/lib/content.mjs` is one-shot: walk `content/` recursively, gray-matter parse, classify into `post` / `page` / `gallery` / `gallery-standalone`, skip `draft: true`, sort posts descending by date.
- `site/lib/feeds.mjs` hand-writes RSS 2.0 + sitemap XML with excerpt extraction. No dep.
- `site/lib/escape.mjs` exports four named escape functions (`escapeHtml`, `escapeXml`, `escapeShortcodeAttr`, `escapeSvgText`) — same 5 entities but with subtly different policies (e.g. shortcodes don't escape `'`, watermark SVG only does `& < >`).
- `site/lib/walk.mjs` is the shared recursive directory walker (used by `copyTree` and `buildImgSizeMap` in `build.mjs`).

**Design system:** three themes switched via `data-theme` on `<html>` with localStorage persistence.

- `site/assets/css/tokens.css` — single source of truth on `:root` (light is default, no attribute). Light semantic colors darkened from the design-guide originals to pass WCAG 2.1 AA body-text contrast (the guide's verbatim `#2eaadc` etc. fail on white).
- `site/assets/css/themes.css` — `[data-theme="dark"]` + `[data-theme="parchment"]` blocks, palette overrides only. Parchment accent is `#8a4814` (WCAG-adjusted from the parchment guide's `#c06820`).
- `site/assets/css/layout.css` — reset, page shell (top header, main column, footer), typography rhythm, mobile breakpoint.
- `site/assets/css/components.css` — buttons, cards, badges, alerts, figures, blockquote, code, tables, details, inputs, focus ring, TOC, home hero.
- `site/assets/css/gallery.css` — CSS Grid justified layout (`grid-auto-rows: 200px`), blur-up placeholders, hover-reveal EXIF overlay, `<dialog>`-based lightbox, year-filter chips at the bottom.
- `site/assets/css/nav.css` — single bundle for breadcrumbs, sticky TOC, reading-progress bar + back-to-top, mobile swipe affordance, Cmd+K palette. Concatenated from 5 feature files at build time of the nav overhaul; merged into one file post-cleanup.
- `site/assets/js/theme.js` — ~35 LOC. Cycles `light → dark → parchment → light` on click of `#theme-toggle`. FOUC-safe inline restorer in `partials/head.html` runs synchronously before first paint.
- `site/assets/js/nav.js` — ~660 LOC. Five IIFE-scoped modules concatenated together: scroll progress, sticky-TOC IntersectionObserver, gallery year-filter, mobile swipe-nav, Cmd+K palette controller. Each self-gates on DOM hooks so the same file is safe to load on every page.
- `site/assets/js/lightbox.js` — ~554 LOC vanilla, zero deps. Native `<dialog>`, Esc/arrow-key/swipe navigation, pinch-zoom, pan-while-zoomed at 60 Hz, preloads adjacent images, restores focus on close. Loaded only on gallery pages via the `{{#lightbox}}` flag in `partials/scripts.html`.

Dropped from the parchment guide per spec: Space Grotesk (typography stays consistent — Source Serif 4 display + IBM Plex Mono code + system sans body across all themes), 16px radius, floating orbs, glass morphism, accent glow, rgba focus-ring halos, card lifts.

## Content & URLs preserved

All URLs were migrated bit-for-bit from Hugo. Posts at `/posts/<slug>/`, galleries at `/gallery/<name>/`, tags at `/tags/<tag>/`. PDFs copied to `dist/` root. RSS at `/index.xml`, sitemap at `/sitemap.xml`. OpenGraph + Twitter meta on every page. The integrity test suite verifies all of this against source markdown at runtime.

## Deployment

Netlify builds from `master` via `netlify.toml`. In production, `R2_PUBLIC_BASE` is set so gallery lightbox loads full-res images directly from R2 (skipping the heavy original-encode pass — ~22 s vs ~76 s cold build). Deploy previews unset `SITE_URL` so OG/canonical URLs fall through to Netlify's `DEPLOY_PRIME_URL`.

## Test harness

Playwright config is `playwright.config.ts`. It auto-starts the dev server (`npm run dev`) before tests, reuses an existing one locally, and targets Chromium only. Visual snapshot tolerance is 1% pixel diff ratio.

Seven spec files, four main disciplines plus three feature-focused:

- `visual.spec.ts` — golden PNGs in `tests/snapshots/` across light/dark/parchment for anchor pages, homes, posts, tags, galleries, 404. Preview page at `/__preview/` exercises every component state.
- `a11y.spec.ts` — `@axe-core/playwright` on every key page in all three themes; WCAG 2.1 AA rules. Third-party iframes (YouTube/Jovian) excluded because we don't control their DOM.
- `perf.spec.ts` — programmatic Lighthouse via `chrome-launcher` at Playwright's bundled Chromium. Home page budget: perf ≥ 95, LCP < 1500 ms. Worst-case gallery (`/gallery/maine-trip/`, 38 images) budget: perf ≥ 80, LCP < 3500 ms.
- `integrity.spec.ts` — broken-link crawler, post/tag/gallery count parity vs source markdown, PDF reachability, sitemap/RSS/robots shape, canonical + OG meta presence on every page type. Sub-modules in `tests/integrity/`.
- `lightbox.spec.ts` — gallery lightbox interaction (open/close, keyboard nav, swipe).
- `nav-scroll.spec.ts` — scroll-driven nav behavior (progress bar, back-to-top, sticky TOC).
- `theme-toggle.spec.ts` — theme cycling + localStorage persistence.

Helpers in `tests/helpers/`:
- `dev-server.ts::blockLiveReload(page)` also routes third-party iframe hosts to `abort()` so visual tests stay stable across YouTube UI churn.
- `theme.ts::setTheme(page, theme)` seeds localStorage + reloads.
- `axe.ts::runAxe` + `assertNoViolations` with an allowlist keyed on `(ruleId, theme?)`.

## Gotchas

- **Port 3000** is often taken by other local dev servers; this site uses **3100** by default (override with `PORT=`).
- **FOUC safety:** the theme-restore inline script in `partials/head.html` MUST appear before the stylesheet `<link>` tags. Moving them around will flash the light theme on page load for dark/parchment users.
- **Mustache-lite nested sections:** the template engine does NOT support nested same-name sections (e.g., `{{#toc}}{{> toc-partial-that-also-uses-toc}}{{/toc}}`). The correct pattern is a boolean guard like `hasToc` + the iteration inside the partial — see `templates/page.html` and `partials/toc.html`.
- **Gallery URL for `gallertest.md`:** this file is `draft: true` in source and is correctly excluded. `layouts/shortcodes/mkdowntable.html` is still read at build-time for the inline Jovian iframe it contains.
- **Image count:** `content/gallery/*/images/*.jpeg` is 146. All integrity tests derive the expected count from source at runtime.
- **Script loading:** every template includes `{{> scripts }}` (loads `theme.js` + `nav.js` + optional `lightbox.js`). To gate `lightbox.js` to gallery pages, the `gallery.html` render context sets `lightbox: true`; everywhere else the `{{#lightbox}}` section is falsy.
- **Escape semantics:** four escape functions in `lib/escape.mjs` look near-identical but each preserves a different historical policy. Don't unify them blindly — `shortcodes.esc` only does 4 entities, `watermark.escapeSvgText` only does 3. dist/ output diff is the only safety check that catches breakage here.
- **Lighthouse performance budget for maine-trip** is 3500 ms LCP (relaxed from the plan's initial 2500 ms) because 38 images + mobile throttling consistently produce ~3 s LCP even with lazy-loading. Home and other pages hold the stricter 1500 ms budget.
