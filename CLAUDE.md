# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nikolai Nekrutenko's personal site. Migrated from Hugo + hello-friend-ng to a hand-written Node build pipeline that emits pure HTML/CSS into `dist/` (April 2026). All Hugo artifacts (`public/`, `themes/` submodule, `layouts/`, `config.toml`, `archetypes/`) were deleted post-cutover; the only remnants are `layouts/shortcodes/{mkdowntable,countygrapherv1}.html` because `site/lib/shortcodes.mjs` still reads them at build-time for inline iframe markup.

Design identity is grounded in `claude-code-design-guide.html` (strict guideline — Notion/Linear-style editorial calm) with a third "parchment" theme adapted from `parchement_theme.md` (colors only — typography/radius/motion stay consistent across themes).

Live site is `https://nekrutnikolai.com/` (custom domain alias on Netlify; the underlying Netlify URL `nnekrut.netlify.app` still resolves but `nekrutnikolai.com` is the canonical for SEO/OG/feeds). Built and deployed from `master` by Netlify running `npm ci && npm run download-originals && npm run build`.

## Prerequisites

- Node ≥ 20.
- `npx playwright install chromium` — only needed for tests + the local `npm run build:pdf` script. Not required for plain `npm run build`.
- `.env` with R2 credentials — copy `.env.example` and fill in `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`. Without it the build still runs but gallery images will be broken (sharp has nothing to process).

## Commands

- `npm run dev` — start local dev server on `http://localhost:3100` with chokidar watch + SSE live-reload. Cold-build ~10 s; subsequent rebuilds ~350 ms thanks to `site/cache/images.json`.
- `npm run dev:drafts` — same as `dev` but with `DRAFTS=1` so `draft: true` posts/pages/galleries are surfaced for local preview (production deploys leave the env var unset, so drafts stay invisible there).
- `npm run build` — one-shot production build into `dist/`. No browser dependency.
- `npm run build:pdf` — local-only: build + regenerate `content/Resume.pdf` from the live `/resume/` HTML via headless chromium. Run after editing `content/resume.md`; commit the resulting PDF.
- `npm run new-gallery -- <folder>` — scaffold a new gallery from a folder of exported JPEGs (see "New gallery workflow" below).
- `npm run download-originals` — pull gallery masters from R2 (needs `.env`).
- `npm run upload-originals` — push clean + watermarked galleries to R2 after a `BUILD_ORIGINALS=1` build.
- `npm run test` — full Playwright suite (starts dev server automatically via `playwright.config.ts` `webServer`).
- `npx playwright test tests/integrity.spec.ts` — run a single spec file.
- `npx playwright test -g "broken links"` — run tests matching a name pattern.
- `npm run test:visual` / `test:a11y` / `test:perf` / `test:integrity` — single-discipline runs.
- `npm run test:update` — re-seed visual golden screenshots after intentional CSS changes.
- `npm run report` — open the Playwright HTML report after a failed run.

## Architecture

**Pure HTML output from a tiny Node build.** The pipeline is a few hundred LOC of stdlib + six runtime deps (`marked`, `gray-matter`, `sharp`, `exifr`, `chokidar`, `@aws-sdk/client-s3`). No framework, no templating engine, no CSS preprocessor. **No browser at build time** — Playwright is dev-only, used by tests and the local-only `build:pdf` script.

- `site/build.mjs` orchestrates all phases: `clearDist()` (wipe-but-preserve-gallery-image-outputs) → copy `static/` and `site/assets/` → scan content → process gallery images → render posts/pages/galleries/tags → render `/archive/` → render home → copy PDFs → write RSS (`/index.xml`) + sitemap (`/sitemap.xml`) + `/robots.txt` + `/404.html`. Per-post OG cards are generated inline during the post render loop.
- `site/serve.mjs` is `node:http` + chokidar. On any watched change it re-runs `build()` and pushes an SSE `event: reload` to connected clients via `/__events`. HTML responses get `<script src="/__livereload.js">` injected just before `</body>` so pages auto-reload on save. Unmatched paths serve `dist/404.html` with HTTP 404 (mirrors the Netlify redirect).
- `site/lib/template.mjs` is a ~80-LOC mustache-lite renderer: `{{var}}` (HTML-escaped), `{{{raw}}}` (unescaped — for already-rendered markdown bodies), `{{#list}}…{{/list}}` (iterate arrays / enter objects / truthy-block for scalars), `{{^list}}…{{/list}}` (inverse), `{{>partial}}` (inlined once at template-load, recursively, with cycle detection).
- `site/lib/shortcodes.mjs` pre-processes Hugo-style shortcodes via a single regex pass before feeding to `marked`: `figure`, `youtube`, `gallery`, `mkdowntable`, plus `pullquote` (renders an `<aside class="pullquote">` block with optional author).
- `site/lib/images.mjs` processes gallery JPEGs with `sharp` (thumbnail 300h + preview 1500w + 32w blur placeholder) and `exifr` (Make/Model/Lens/Focal/F-number/Exposure/ISO). Records sort by EXIF `DateTimeOriginal` so galleries read in shooting order; falls back to filename when no date is present. A manifest cache at `site/cache/images.json` keyed on `srcMtime + srcSize + watermarkConfigHash` makes incremental rebuilds near-instant. Concurrency capped at 8 sharp workers.
- `site/lib/og-card.mjs` renders 1200×630 PNG OG cards per post by composing an inline SVG (title + date + site name) and rasterizing through sharp's libvips pipeline. **No browser launch** — generic font fallbacks (Source Serif 4 → DejaVu Serif → Georgia → serif) keep output identical on macOS dev and Linux CI.
- `site/lib/routes.mjs` implements Hugo-compatible `slugify` (verified empirically against the original Hugo `public/` so every URL migrates bit-for-bit).
- `site/lib/content.mjs` is one-shot: walk `content/` recursively, gray-matter parse, classify into `post` / `page` / `gallery` / `gallery-standalone`, skip `draft: true` (unless `DRAFTS=1` is set — used by `npm run dev:drafts` to preview unpublished content locally), sort posts descending by date.
- `site/lib/feeds.mjs` hand-writes RSS 2.0 + sitemap XML with excerpt extraction. No dep.
- `site/lib/structured-data.mjs` builds schema.org JSON-LD blocks per page type: `personSchema` (about), `webSiteSchema` + `homeSchema` (home, combined as a `@graph`), `articleSchema` (each post), `imageGallerySchema` (each gallery). Hard-coded sitewide identity (jobTitle, employer, alma mater, social profiles); single-author site so no need to thread Person through frontmatter. Output passes through a `</script>` substring escaper to prevent script-tag breakout if a title or description ever contains it.
- `site/lib/escape.mjs` exports four named escape functions (`escapeHtml`, `escapeXml`, `escapeShortcodeAttr`, `escapeSvgText`) — same 5 entities but with subtly different policies (e.g. shortcodes don't escape `'`, watermark SVG only does `& < >`).
- `site/lib/walk.mjs` is the shared recursive directory walker (used by `copyTree` and `buildImgSizeMap` in `build.mjs`).
- `site/scripts/build-resume-pdf.mjs` is the **local-only** Resume.pdf generator: spins up a tiny http server over `dist/`, renders `/resume/` in headless chromium via Playwright, prints to PDF, writes to `content/Resume.pdf`. Triggered by `npm run build:pdf`. Not part of the Netlify build.
- `site/scripts/load-env.mjs` is a tiny stdlib `.env` autoloader. Imported for side effects from `upload-originals.mjs` and `download-originals.mjs` so they Just Work locally without `set -a; source .env; set +a` shell incantations. No-op when `.env` is absent (Netlify pre-sets env vars via the dashboard); never overrides already-set keys.

**Design system:** three themes switched via `data-theme` on `<html>` with localStorage persistence.

- `site/assets/css/tokens.css` — single source of truth on `:root` (light is default, no attribute). Light semantic colors darkened from the design-guide originals to pass WCAG 2.1 AA body-text contrast (the guide's verbatim `#2eaadc` etc. fail on white).
- `site/assets/css/themes.css` — `[data-theme="dark"]` + `[data-theme="parchment"]` blocks, palette overrides only. Parchment accent is `#8a4814` (WCAG-adjusted from the parchment guide's `#c06820`).
- `site/assets/css/layout.css` — reset, page shell (top header, main column, footer), typography rhythm, mobile breakpoint, theme switch button.
- `site/assets/css/components.css` — buttons, cards, badges, alerts, figures, blockquote, code, tables, details, inputs, focus ring, TOC, home hero, social pill buttons, drop caps, pullquote, 404 page.
- `site/assets/css/gallery.css` — CSS Grid justified layout (`grid-auto-rows: 200px`), blur-up placeholders, hover-reveal EXIF overlay, `<dialog>`-based lightbox, year-filter chips, gallery album metadata blurb, dark-mode image softening filter.
- `site/assets/css/nav.css` — single bundle for breadcrumbs, sticky TOC, reading-progress bar + back-to-top, mobile swipe affordance.
- `site/assets/js/theme.js` — single circular button cycling `light → dark → parchment → light` with SVG icon crossfade (scale + rotate + opacity). FOUC-safe inline restorer in `partials/head.html` runs synchronously before first paint.
- `site/assets/js/nav.js` — ~360 LOC. Five IIFE-scoped modules concatenated together: scroll progress, sticky-TOC IntersectionObserver, gallery year-filter, mobile swipe-nav. Each self-gates on DOM hooks so the same file is safe to load on every page.
- `site/assets/js/lightbox.js` — ~554 LOC vanilla, zero deps. Native `<dialog>`, Esc/arrow-key/swipe navigation, pinch-zoom, pan-while-zoomed at 60 Hz, preloads adjacent images, restores focus on close. Loaded only on gallery pages via the `{{#lightbox}}` flag in `partials/scripts.html`.

Dropped from the parchment guide per spec: Space Grotesk (typography stays consistent — Source Serif 4 display + IBM Plex Mono code + system sans body across all themes), 16px radius, floating orbs, glass morphism, accent glow, rgba focus-ring halos, card lifts.

## Content & URLs preserved

All URLs were migrated bit-for-bit from Hugo. Posts at `/posts/<slug>/`, galleries at `/gallery/<name>/`, tags at `/tags/<tag>/`. PDFs copied to `dist/` root. RSS at `/index.xml`, sitemap at `/sitemap.xml`. OpenGraph + Twitter meta on every page (post pages get a per-post auto-generated card at `/og/<slug>.png`). The integrity test suite verifies all of this against source markdown at runtime.

New routes added post-migration: `/archive/` (every post + gallery + tag in one view; not in main nav).

## Deployment

Netlify builds from `master` via `netlify.toml`. In production, `R2_PUBLIC_BASE` is set so gallery lightbox loads full-res images directly from R2 (skipping the heavy original-encode pass — ~5 s vs ~22 s cold build). Deploy previews unset `SITE_URL` so OG/canonical URLs fall through to Netlify's `DEPLOY_PRIME_URL`.

`netlify-plugin-cache` persists `site/cache/` (sharp manifest) and `dist/gallery/` (sharp output thumbs/previews) across deploys, so steady-state Netlify builds skip image re-encoding. `clearDist()` in build.mjs preserves those subdirs across the per-build wipe.

### Analytics

Cloudflare Web Analytics is wired in via `CF_ANALYTICS_TOKEN` env var. When set, `partials/head.html` emits the deferred beacon script. Configured in `netlify.toml` under `[context.production.environment]` so only production builds carry it; deploy previews and local dev stay silent. Empty/unset → no script in HTML, zero overhead. The token is non-secret (Cloudflare emits it in every page's HTML anyway), so committing to the toml is fine.

### SEO / structured data

Every page emits the standard SEO basics (canonical URL, OG / Twitter Card meta, sitemap entry, RSS feed for posts), plus a second tier wired into `partials/head.html` and threaded through `buildOgCtx()` in build.mjs:

- **Always-on:** `<meta name="robots" content="index,follow,max-image-preview:large">` (opts into Google's full-size image previews — important for the gallery-heavy site), `<meta name="author" content="Nikolai Nekrutenko">`, four `<link rel="me" href="…">` entries (LinkedIn, GitHub, YouTube, mailto) for IndieWeb identity verification.
- **Posts only:** `<meta property="article:published_time">`, `<meta property="article:author">`, and one `<meta property="article:tag">` per tag.
- **JSON-LD:** schema.org structured data via `site/lib/structured-data.mjs` (see lib entry above). 25 of the rendered pages emit JSON-LD; tag pages, /404, /__preview, the post/tag/gallery list pages, and /archive intentionally skip it (duplicative or non-entity).

Per-post `<meta name="description">` is hand-written via the `description:` frontmatter field on each post (search-result CTR matters more than auto-derived snippets). Galleries use the same field — falls back to `"N photos from <title>"` when frontmatter description is empty.

Validate at https://search.google.com/test/rich-results after deploys. Search Console verification token at `static/google399b09122b34817e.html` covers `nekrutnikolai.com` after the canonical URL switch.

## Test harness

Playwright config is `playwright.config.ts`. It auto-starts the dev server (`npm run dev`) before tests, reuses an existing one locally, and targets Chromium only. Visual snapshot tolerance is 1% pixel diff ratio.

Spec files (four main disciplines + three feature-focused):

- `visual.spec.ts` — golden PNGs in `tests/snapshots/` across light/dark/parchment for anchor pages, homes, posts, tags, galleries, 404. Preview page at `/__preview/` exercises every component state.
- `a11y.spec.ts` — `@axe-core/playwright` on every key page in all three themes; WCAG 2.1 AA rules. Third-party iframes (YouTube/Jovian) excluded because we don't control their DOM.
- `perf.spec.ts` — programmatic Lighthouse via `chrome-launcher` at Playwright's bundled Chromium. Home page budget: perf ≥ 95, LCP < 1500 ms. Worst-case gallery (`/gallery/maine-trip/`, 38 images) budget: perf ≥ 80, LCP < 3500 ms.
- `integrity.spec.ts` — broken-link crawler, post/tag/gallery count parity vs source markdown, PDF reachability, sitemap/RSS/robots shape, canonical + OG meta presence on every page type. Sub-modules in `tests/integrity/`.
- `lightbox.spec.ts` — gallery lightbox interaction (open/close, keyboard nav, swipe).
- `lightbox-zoom-sharpness.spec.ts` — guards the zoom rendering invariant: at 3x the painted pixels match an independent re-rasterization of the master JPEG (mean per-channel diff < 18, vs ~25+ if the implementation regressed back to `transform: scale`). Plus DOM invariant (rectW = cssW, no `scale()` in the transform), the click/wheel/keyboard zoom + pan + minimap + navigation behavior contract, and the two UX layers stacked on top: eager-load (the original-resolution fetch fires within 150 ms of opening the lightbox, no zoom required) and smooth-zoom transitions (discrete inputs — click, +/- — set a `.smoothing` class with a 180 ms width/height/transform tween; wheel/pinch/drag never set it). The test helpers `waitForSmoothingDone(page)` is essential — without it tests that read `getBoundingClientRect()` mid-tween see an interpolated value while `imgEl.style.width` already holds the target.
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
- **Playwright is dev-only.** It must NOT move back to `dependencies`. The Netlify build is intentionally browser-free; Resume.pdf comes from the locally-committed `content/Resume.pdf`. If you change the resume HTML, run `npm run build:pdf` and commit the regenerated PDF before pushing.
- **OG cards use generic font fallbacks** because sharp's libvips SVG renderer doesn't auto-fetch web fonts. On macOS dev you'll see Georgia; on Netlify Linux you'll see DejaVu Serif. Both look clean. To get pixel-identical typography, bundle the TTFs and embed via SVG `@font-face` — listed in README "Future work".
- **Image count:** `content/gallery/*/images/*.jpeg` is 146. All integrity tests derive the expected count from source at runtime.
- **Script loading:** every template includes `{{> scripts }}` (loads `theme.js` + `nav.js` + optional `lightbox.js`). To gate `lightbox.js` to gallery pages, the `gallery.html` render context sets `lightbox: true`; everywhere else the `{{#lightbox}}` section is falsy.
- **Escape semantics:** four escape functions in `lib/escape.mjs` look near-identical but each preserves a different historical policy. Don't unify them blindly — `shortcodes.esc` only does 4 entities, `watermark.escapeSvgText` only does 3. dist/ output diff is the only safety check that catches breakage here.
- **Lightbox zoom drives CSS width, not transform scale:** `applyTransform()` in `site/assets/js/lightbox.js` sets `imgEl.style.width = natW * scale` (and height) and uses `transform` only for `translate(...)`. Resist the urge to "simplify" it back to `transform: translate(...) scale(s)`. With `will-change: transform` on `.lightbox-img.zoomed`, the browser rasterizes the layer at the element's CSS size and bilinearly upscales the layer for paint — so a `scale(3)` on a fit-to-viewport (~864 px) layer paints a stretched ~864 px bitmap, not a freshly resampled crop of the 24 MP master. Two coupled pieces enforce the working setup: the JS sets the post-zoom CSS width, and `.lightbox-img { max-width: none }` in `gallery.css` overrides the site-wide `img { max-width: 100% }` rule from `layout.css` — without that override the post-zoom width gets capped to the stage and the resampling silently regresses. The `lightbox-zoom-sharpness.spec.ts` `imgEl rendered size matches its CSS size` test catches a regression of either piece.
- **Lighthouse performance budget for maine-trip** is 3500 ms LCP because 38 images + mobile throttling consistently produce ~3 s LCP even with lazy-loading. Home and other pages hold the stricter 1500 ms budget.
- **Home is intentionally minimal** — hero (kicker + title + lede + Resume/Portfolio buttons) + portrait, no recents list. Posts ship roughly quarterly so a "Recent posts" section reads stale most of the time. To reintroduce: `git log --grep="remove recent-posts"` finds the removal commit; reverting it brings the wiring + CSS back in one shot.

## Optional content features

- **Drop caps on a post**: enabled on every post by default via the `post--dropcap` class on `<article>` (subtle 1.8em first-letter styling, no float). Toggle off site-wide by removing the class from `site/templates/post.html`.
- **Pull quote in a post**: use `{{< pullquote text="..." author="..." >}}` — author optional.
- **Gallery album metadata**: add optional frontmatter to `content/gallery/<album>/index.md`:
  ```yaml
  location: "Acadia & Bar Harbor, Maine"
  dateRange: "Aug 10–18, 2024"
  description: "Coastal hike + lighthouse photography weekend."
  coords:                              # album centroid, for a map-marker view
    lat: 44.338600
    lng: -68.273300
  ```
  Renders as a muted blurb under the gallery title. `coords` is auto-populated by `npm run new-gallery` from the average of per-image GPS EXIF; edit `location` to a friendly name.

- **Per-image GPS** lives at `content/gallery/<album>/coords.json` (sidecar, structured JSON, one entry per image):
  ```json
  {
    "average": { "lat": 44.3386, "lng": -68.2733 },
    "points": [
      { "name": "IMG_1234.jpeg", "lat": 44.3401, "lng": -68.2789, "date": "2024-08-12T17:23:11.000Z" }
    ]
  }
  ```
  Used for future per-photo map visualizations or sort-by-location features. Generated by `new-gallery`; not currently consumed by the site templates.

## New gallery workflow

When you have a fresh batch of exported JPEGs (e.g. from Photos.app), use `npm run new-gallery` to scaffold the album in one shot:

```bash
# Photos.app → File → Export → Export <N> Photos → Photo Kind: JPEG, Size: Full Size
# pick a destination folder, e.g. ~/Pictures/maine-trip/

npm run new-gallery -- ~/Pictures/maine-trip
# → creates content/gallery/maine-trip/{index.md, images/}
# → frontmatter pre-populated: title, date (newest EXIF), draft: true,
#   location (lat,lng if GPS present), dateRange (if span > 1 day)

# review/edit the generated index.md (friendlier location, description, flip draft: false)
npm run dev                       # preview at /gallery/maine-trip/
npm run upload-originals          # push masters + watermarked previews to R2
git add content/gallery/maine-trip/index.md
git commit -m "add maine-trip gallery"
git push                          # Netlify builds + deploys
```

Flags:
- `--name <slug>` override the URL slug (default: slugified folder name)
- `--title "..."` override the display title (default: titlecased folder/slug)
- `--date <iso>` override frontmatter date (default: newest EXIF DateTimeOriginal)
- `--replace` wipe an existing `content/gallery/<slug>/` before scaffolding (otherwise the script refuses)

Notes:
- **24-megapixel JPEGs are fine** — the script just copies files, doesn't re-encode. Sharp's downstream pipeline resizes to thumb (300h) + preview (1500w) for the site, and to watermarked full-size originals when `BUILD_ORIGINALS=1` is set. Expect ~10–15 MB per master JPEG and proportional R2 upload time on `npm run upload-originals`.
- **HEIC is refused** — Photos.app can export either HEIC or JPEG. The script errors out with a clear message if HEIC files are present. Re-export as JPEG.
- **Filenames are preserved** — `IMG_1234.jpeg` stays `IMG_1234.jpeg`. Sharp doesn't care; URLs reference these names directly under `/gallery/<slug>/img/`.
- **GPS auto-fill** — if any image has GPS EXIF, the script writes:
  - `coords: { lat, lng }` (album centroid average) into the gallery's frontmatter
  - `coords.json` sidecar at `content/gallery/<slug>/coords.json` with **one entry per image** (`points[]`) — preserves full per-photo detail for future visualizations even after R2-only originals.
  - `location: ""` placeholder; edit to a friendly name (e.g. `"Acadia, Maine"`).

  The summary printout flags multi-cluster cases (photos from very different places) so you can spot a folder containing photos from different trips.

## Future work / suggestions

See [README.md "Future work"](./README.md#future-work) for the canonical list (kept in one place to avoid drift).
