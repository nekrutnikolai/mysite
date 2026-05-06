#!/usr/bin/env node
// Iteration 2: renders posts + post archive on top of iteration 1's home
// placeholder + /__preview/ design-system showcase. Later iterations extend
// this with top-level pages, taxonomies, galleries, feeds, sitemap.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "./lib/template.mjs";
import { scanContent } from "./lib/content.mjs";
import { renderMarkdown } from "./lib/markdown.mjs";
import { slugify } from "./lib/routes.mjs";
import { processAlbum } from "./lib/images.mjs";
import { renderRSS, renderSitemap } from "./lib/feeds.mjs";
import { walkSync } from "./lib/walk.mjs";
import { generateOgCard } from "./lib/og-card.mjs";

// Agent B owns shortcodes.mjs. If it hasn't landed yet, fall through to a
// no-op expander so the rest of the pipeline is still verifiable.
let expand;
try {
  ({ expand } = await import("./lib/shortcodes.mjs"));
} catch {
  // TODO: remove once shortcodes.mjs exists in every branch
  expand = (s) => s;
}

// Stable color class for a tag name — cycles through the four semantic colors.
const TAG_COLORS = ["accent", "success", "warning", "danger"];
function tagColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return TAG_COLORS[((h % TAG_COLORS.length) + TAG_COLORS.length) % TAG_COLORS.length];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const STATIC = path.join(ROOT, "static");
const CONTENT = path.join(ROOT, "content");
const ASSETS = path.join(__dirname, "assets");

const SITE_TITLE = "Nikolai Nekrutenko";
// Build-time constant so feeds can later be retargeted to a real domain
// without changing anything else. Localhost-only for now.
// Used for absolute URLs in RSS, sitemap, canonical, OG. Override via env when
// deploying (e.g. `SITE_URL=https://nnekrut.netlify.app npm run build`). Netlify
// sets DEPLOY_PRIME_URL for preview branches — fall through to it automatically.
const IS_PROD = process.env.NODE_ENV === "production";
const SITE_URL =
  process.env.SITE_URL ||
  process.env.DEPLOY_PRIME_URL ||
  "http://localhost:3100";

if (IS_PROD && SITE_URL.startsWith("http://localhost")) {
  throw new Error(
    `build: NODE_ENV=production but SITE_URL is still "${SITE_URL}" — refusing ` +
      `to emit production artifacts with a localhost canonical. Set SITE_URL ` +
      `(or DEPLOY_PRIME_URL) before building.`
  );
}
const SITE_DESCRIPTION =
  "Nikolai Nekrutenko's blog \u2014 embedded systems, sensors, photography, and projects.";
// Site-wide default OpenGraph image used when a page hasn't supplied one of
// its own. A single Zion glacier photo is a reasonable editorial fallback.
const DEFAULT_OG_IMAGE = "/img/glacier.jpg";

// Top-level PDFs the site links to. Copied from content/ → dist/ root.
// Resume.pdf is regenerated from the live /resume/ page via the
// `npm run build:pdf` script — kept out of the Netlify build so we don't
// need a chromium binary on the build server.
const PDF_FILES = ["Resume.pdf", "Portfolio.pdf", "e_horiz_report.pdf"];

// Iteration 7 (Agent B): extend every base-layout render context with the
// fields that partials/head.html now consumes for OpenGraph / Twitter /
// canonical meta. Caller passes the output URL as `url`; we compute the
// canonical link from SITE_URL + that path. `ogType` defaults to "website";
// posts override to "article". `ogImage` defaults to DEFAULT_OG_IMAGE unless
// explicitly set to `null`. Returned object is a drop-in replacement for the
// context previously passed to render().
function buildOgCtx(pageCtx) {
  const {
    url = "/",
    title = "",
    ogType = "website",
    ogImage: explicitImage,
    ogTitle: explicitOgTitle,
  } = pageCtx;
  const ogImage = explicitImage === null ? null : explicitImage || DEFAULT_OG_IMAGE;
  const absoluteOgImage = ogImage
    ? ogImage.startsWith("http")
      ? ogImage
      : SITE_URL + ogImage
    : null;
  return {
    ...pageCtx,
    canonicalUrl: SITE_URL + url,
    defaultSiteTitle: SITE_TITLE,
    ogTitle: explicitOgTitle || title || SITE_TITLE,
    ogType,
    ogImage: absoluteOgImage,
    twitterCard: absoluteOgImage ? "summary_large_image" : "summary",
    nav: navForUrl(url),
  };
}

// Top-nav links with an `active: true` flag on the section that owns `url`.
// Resume is external (.pdf), so it never gets highlighted.
function navForUrl(url) {
  const sectionOf = (u) => {
    if (u === "/") return "home";
    if (u.startsWith("/about")) return "about";
    if (u.startsWith("/gallery")) return "gallery";
    if (u.startsWith("/posts") || u.startsWith("/tags")) return "posts";
    if (u.startsWith("/resume")) return "resume";
    if (u.startsWith("/portfolio")) return "portfolio";
    return null;
  };
  const active = sectionOf(url);
  return [
    { section: "about", label: "About", href: "/about/", external: false },
    { section: "gallery", label: "Gallery", href: "/gallery/", external: false },
    { section: "posts", label: "Posts", href: "/posts/", external: false },
    { section: "resume", label: "Resume", href: "/resume/", external: false },
    { section: "portfolio", label: "Portfolio", href: "/portfolio/", external: false },
  ].map((item) => ({ ...item, active: item.section === active }));
}

// Breadcrumbs from a URL. Returns [{label, href, current?}, ...]. The final
// entry has href:null + current:true when `currentLabel` is supplied. Examples:
//   /                    -> []
//   /posts/              -> [{Home, /}]
//   /posts/foo/          -> [{Home, /}, {Posts, /posts/}, {<title>, null, current}]
function buildCrumbs(url, currentLabel) {
  if (url === "/") return [];
  const out = [{ label: "Home", href: "/" }];
  if (url.startsWith("/posts/") && url !== "/posts/") {
    out.push({ label: "Posts", href: "/posts/" });
  } else if (url.startsWith("/tags/") && url !== "/tags/") {
    out.push({ label: "Tags", href: "/tags/" });
  } else if (url.startsWith("/gallery/") && url !== "/gallery/") {
    out.push({ label: "Gallery", href: "/gallery/" });
  }
  if (currentLabel) out.push({ label: currentLabel, href: null, current: true });
  // Boolean for templates lacking dot-property traversal in their #section.
  out.hasCrumbs = true;
  return out;
}

// Adjacency between top-level "section" pages, circular order matching the
// visual nav. Used by partials/adjacent-sections.html (Agent B).
const TOP_LEVEL_ORDER = [
  { url: "/about/",     label: "About" },
  { url: "/gallery/",   label: "Gallery" },
  { url: "/posts/",     label: "Posts" },
  { url: "/resume/",    label: "Resume" },
  { url: "/portfolio/", label: "Portfolio" },
];
function adjacentSections(url) {
  const i = TOP_LEVEL_ORDER.findIndex((s) => url === s.url);
  if (i < 0) return null;
  const N = TOP_LEVEL_ORDER.length;
  return {
    prev: TOP_LEVEL_ORDER[(i - 1 + N) % N],
    next: TOP_LEVEL_ORDER[(i + 1) % N],
  };
}

// Reading time heuristic: 220 words per minute from rendered HTML body.
function readingTime(html) {
  if (!html) return 0;
  const text = String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// Hugo's goldmark.renderer.unsafe is true, so resume.md ships with literal
// <h1 align="center">…</h1> that already owns the page title. For those files
// we suppress the template's own page-header.
const NO_PAGE_TITLE_STEMS = new Set(["resume"]);

// resume_old.md is the only top-level page whose filename contains an
// underscore. slugify() collapses `_` → `-`, which would produce /resume-old/.
// The plan pins the legacy URL as /resume_old/, so map it explicitly.
const PAGE_URL_OVERRIDES = { resume_old: "/resume_old/" };

function writePage(relUrl, html) {
  const outDir = path.join(DIST, relUrl.replace(/^\//, ""));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
}

// Recursively copy `src` into `dst`, skipping dotfiles and Hugo's lockfile.
function copyTree(src, dst) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dst, { recursive: true });
  let count = 0;
  walkSync(
    src,
    (sp, rel) => {
      fs.copyFileSync(sp, path.join(dst, rel));
      count++;
    },
    (_, rel) => {
      fs.mkdirSync(path.join(dst, rel), { recursive: true });
    }
  );
  return count;
}

function copyStatic() {
  return copyTree(STATIC, DIST);
}

// Copy site/assets/** → dist/assets/**. This is the real stylesheet + JS
// bundle — NOT part of /static, and it must land in dist or the pages are
// unstyled.
function copyAssets() {
  return copyTree(ASSETS, path.join(DIST, "assets"));
}

// Walk static/img/ and return a Map<rootRelPath, {w,h}> for every raster.
// Used by the figure shortcode to emit explicit width/height and eliminate
// CLS. Sharp's metadata() is plenty fast (~1ms per image) and we already
// depend on sharp for galleries.
async function buildImgSizeMap() {
  const map = new Map();
  const imgRoot = path.join(STATIC, "img");
  if (!fs.existsSync(imgRoot)) return map;
  const sharp = (await import("sharp")).default;
  const rasters = [];
  walkSync(imgRoot, (abs) => {
    if (/\.(png|jpe?g|webp|gif|avif)$/i.test(abs)) rasters.push(abs);
  });
  for (const p of rasters) {
    try {
      const meta = await sharp(p).metadata();
      if (meta.width && meta.height) {
        // URL path the content authors use: /img/<rest>
        const rel = "/" + path.relative(STATIC, p).split(path.sep).join("/");
        map.set(rel, { w: meta.width, h: meta.height });
      }
    } catch {
      /* unreadable image — skip, dimensions simply won't be emitted */
    }
  }
  return map;
}

const DATE_HUMAN_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDateHuman(d) {
  return d ? DATE_HUMAN_FMT.format(d) : "";
}

function formatDateISO(d) {
  return d ? d.toISOString() : "";
}

// EXIF caption helpers — "Canon EOS 7D Mark II · 400mm · f/5.6 · 1/60 · ISO 800"
// for the full alt text, and a shorter settings-only version for the
// hover-reveal overlay.
function buildCaptionPlain(exif, fallbackTitle) {
  if (!exif) return `Photo from ${fallbackTitle || ""}`.trim();
  const parts = [];
  const body = exif.model || exif.make || null;
  if (body) parts.push(String(body).trim());
  if (exif.focalLength) parts.push(exif.focalLength);
  if (exif.fNumber) parts.push(exif.fNumber);
  if (exif.exposureTime) parts.push(exif.exposureTime);
  if (exif.iso) parts.push(`ISO ${exif.iso}`);
  return parts.length ? parts.join(" \u00b7 ") : `Photo from ${fallbackTitle || ""}`.trim();
}

function buildCaptionShort(exif) {
  if (!exif) return "";
  const parts = [];
  if (exif.focalLength) parts.push(exif.focalLength);
  if (exif.fNumber) parts.push(exif.fNumber);
  if (exif.exposureTime) parts.push(exif.exposureTime);
  if (exif.iso) parts.push(`ISO ${exif.iso}`);
  return parts.join(" \u00b7 ");
}

// Wipe everything under dist/ except `dist/gallery/<album>/img` and
// `.../originals` directories — the sharp-generated thumb/preview/original
// JPEGs are expensive to regenerate (especially on cold Netlify builds at
// 24 MP), so we keep them around. images.mjs's cache check (manifest match
// + output files exist) handles re-use correctly. Orphaned albums (deleted
// from content/) become unlinked artifacts in dist/ but don't appear in
// sitemap/RSS so they're invisible to readers; clean them by hand or delete
// dist/ entirely once in a while.
function clearDist() {
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(DIST)) {
    if (entry !== "gallery") {
      fs.rmSync(path.join(DIST, entry), { recursive: true, force: true });
      continue;
    }
    const galleryDir = path.join(DIST, "gallery");
    for (const album of fs.readdirSync(galleryDir)) {
      const albumDir = path.join(galleryDir, album);
      if (!fs.statSync(albumDir).isDirectory()) {
        fs.rmSync(albumDir);
        continue;
      }
      for (const sub of fs.readdirSync(albumDir)) {
        if (sub === "img" || sub === "originals") continue;
        fs.rmSync(path.join(albumDir, sub), { recursive: true, force: true });
      }
    }
  }
}

export async function build() {
  clearDist();

  const staticCount = copyStatic();
  const assetCount = copyAssets();

  // Measure every raster under static/img/ once — shortcodes.mjs's figure
  // handler consumes the map to emit explicit width/height, eliminating CLS
  // on posts like the portfolio with its 12 figures.
  const imgSizes = await buildImgSizeMap();

  // Scan & classify source content.
  const entries = await scanContent();
  const posts = entries.filter((e) => e.kind === "post");

  // Image pipeline. For each gallery album, produce thumbs/previews/originals
  // + EXIF and attach the resulting records to the entry for Agent B's
  // gallery template to consume. Cached by mtime+size; incremental rebuilds
  // are near-instant.
  const galleries = entries.filter((e) => e.kind === "gallery");
  let galleryImageCount = 0;
  for (const entry of galleries) {
    const albumDir = path.dirname(entry.srcPath);
    const srcImagesDir = path.join(albumDir, "images");
    const distAlbumDir = path.join(DIST, "gallery", entry.slug);
    entry.imageRecords = await processAlbum(entry.slug, srcImagesDir, distAlbumDir);
    galleryImageCount += entry.imageRecords.length;
  }

  // Render each gallery page + collect tiles for the /gallery/ index.
  const galleryListItems = [];
  let galleryPageCount = 0;
  for (const entry of galleries) {
    const imageRecords = entry.imageRecords || [];
    const title = entry.frontmatter.title || entry.slug;

    // Strip the {{< gallery ... >}} shortcode (spans multiple lines in source)
    // from the body before rendering intro prose. The shortcode expander would
    // otherwise emit its placeholder into the intro, which the template slot
    // doesn't consume anyway.
    const bodyWithoutGallery = String(entry.body)
      .replace(/\{\{<\s*gallery[\s\S]*?>\}\}/g, "")
      .trim();
    const intro = bodyWithoutGallery
      ? renderMarkdown(expand(bodyWithoutGallery, { kind: "gallery", entry, imgSizes }))
      : "";

    const images = imageRecords.map((r) => ({
      ...r,
      exifJson: JSON.stringify(r.exif || {})
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&#39;"),
      captionPlain: buildCaptionPlain(r.exif, title),
      captionShort: buildCaptionShort(r.exif),
    }));

    const galleryOgImage = images[0] && images[0].previewUrl ? images[0].previewUrl : null;
    const galleryContent = render("gallery", buildOgCtx({
      url: entry.outputPath,
      title,
      siteTitle: SITE_TITLE,
      description: `${imageRecords.length} photos from ${title}`,
      crumbs: buildCrumbs(entry.outputPath, title),
      adjacent: adjacentSections(entry.outputPath),
      wide: true,
      year: new Date().getFullYear(),
      dateISO: formatDateISO(entry.frontmatter.date),
      dateHuman: formatDateHuman(entry.frontmatter.date),
      imageCount: imageRecords.length,
      imagesPlural: imageRecords.length !== 1,
      intro,
      images,
      ogImage: galleryOgImage,
      lightbox: true,
    }));
    writePage(entry.outputPath, galleryContent);
    galleryPageCount++;

    if (imageRecords.length > 0) {
      const cover = imageRecords[0];
      galleryListItems.push({
        url: entry.outputPath,
        title,
        imageCount: imageRecords.length,
        imagesPlural: imageRecords.length !== 1,
        dateISO: formatDateISO(entry.frontmatter.date),
        dateHuman: formatDateHuman(entry.frontmatter.date),
        coverThumbUrl: cover.thumbUrl,
        coverPreviewUrl: cover.previewUrl,
        coverThumbW: cover.thumbW,
        coverThumbH: cover.thumbH,
        _sortTime: entry.frontmatter.date ? +entry.frontmatter.date : 0,
      });
    }
  }

  // /gallery/ index — most recent first.
  galleryListItems.sort((a, b) => b._sortTime - a._sortTime);
  for (const t of galleryListItems) delete t._sortTime;

  // Stamp each gallery tile with its year (string) and aggregate the descending
  // year list for Agent D's filter chips. Empty year (no frontmatter date)
  // becomes "" so the JS can show those tiles only when "All" is active.
  for (const item of galleryListItems) {
    item.year = item.dateISO ? String(new Date(item.dateISO).getFullYear()) : "";
  }
  const galleryYears = [...new Set(galleryListItems.map((g) => g.year).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a))
    .map((y) => ({ year: y }));
  const galleryIndexHtml = render("gallery-list", buildOgCtx({
    url: "/gallery/",
    title: "Gallery",
    siteTitle: SITE_TITLE,
    description: "Photo galleries.",
    crumbs: buildCrumbs("/gallery/", "Gallery"),
    adjacent: adjacentSections("/gallery/"),
    wide: true,
    year: new Date().getFullYear(),
    galleries: galleryListItems,
    years: galleryYears,
  }));
  writePage("/gallery/", galleryIndexHtml);

  // gallery-standalone entries (e.g. gallerytest.md) — plain markdown pages
  // rendered with the page template. Has no images.
  const galleryStandalones = entries.filter((e) => e.kind === "gallery-standalone");
  let gallerySoloCount = 0;
  for (const entry of galleryStandalones) {
    const expandedMd = expand(entry.body, { kind: "gallery-standalone", entry, imgSizes });
    const bodyHtml = renderMarkdown(expandedMd);
    const fm = entry.frontmatter;
    const html = render("page", buildOgCtx({
      url: entry.outputPath,
      title: fm.title || entry.slug,
      siteTitle: SITE_TITLE,
      description: fm.description || SITE_TITLE,
      crumbs: buildCrumbs(entry.outputPath, fm.title || entry.slug),
      adjacent: adjacentSections(entry.outputPath),
      wide: false,
      year: new Date().getFullYear(),
      showTitle: !!String(fm.title || "").trim(),
      hasToc: false,
      toc: [],
      body: bodyHtml,
    }));
    writePage(entry.outputPath, html);
    gallerySoloCount++;
  }

  // Iteration 2 only renders posts; tags index comes in iter 3.
  // Still aggregate tags so each post's template context gets the right shape
  // — each tag expands to { name, slug } for the header chip row.
  const tagMap = new Map();
  for (const post of posts) {
    const tags = Array.isArray(post.frontmatter.tags) ? post.frontmatter.tags : [];
    for (const t of tags) {
      const key = String(t).trim();
      if (!key) continue;
      if (!tagMap.has(key)) tagMap.set(key, []);
      tagMap.get(key).push(post);
    }
  }

  // Render each post.
  // Pre-compute every post's rendered body so we can derive reading time AND
  // attach it to the home page's recent-posts list at the same time.
  // TOC is opt-in per post via `toc: true` in frontmatter.
  const postRenders = posts.map((entry) => {
    const fm = entry.frontmatter;
    const wantsToc = fm.TOC === true || fm.toc === true;
    const tocAccumulator = wantsToc ? [] : null;
    const expandedMd = expand(entry.body, { kind: "post", entry, imgSizes });
    const bodyHtml = renderMarkdown(expandedMd, { tocAccumulator });
    // Only h2/h3 belong in the sidebar TOC; deeper headings clutter it.
    const toc = tocAccumulator ? tocAccumulator.filter((h) => h.depth <= 3) : [];
    return { entry, bodyHtml, minutes: readingTime(bodyHtml), toc };
  });

  // Per-post OpenGraph cards (1200x630 PNG) live under dist/og/<slug>.png.
  // Always-regenerate is acceptable here — the build is fast enough and the
  // alternative cache would need to track template+font changes too.
  const ogDir = path.join(DIST, "og");
  fs.mkdirSync(ogDir, { recursive: true });

  let postCount = 0;
  for (let i = 0; i < postRenders.length; i++) {
    const { entry, bodyHtml, minutes, toc } = postRenders[i];
    const date = entry.frontmatter.date;
    const tagList = (Array.isArray(entry.frontmatter.tags) ? entry.frontmatter.tags : [])
      .filter((t) => String(t).trim())
      .map((t) => ({ name: String(t), slug: slugify(t), color: tagColor(String(t)) }));

    // Posts are sorted descending by date. "Newer" is the post at i-1.
    const newerPost = i > 0 ? postRenders[i - 1].entry : null;
    const olderPost = i < postRenders.length - 1 ? postRenders[i + 1].entry : null;
    const adjacent = (p) =>
      p ? { url: p.outputPath, title: p.frontmatter.title || p.slug } : null;

    // Generate the per-post OG card and use it as the post's ogImage. Replaces
    // the previous first-body-image heuristic.
    const ogTitle = entry.frontmatter.title || entry.slug;
    const ogCardPath = path.join(ogDir, `${entry.slug}.png`);
    await generateOgCard({
      title: ogTitle,
      dateHuman: formatDateHuman(date),
      siteName: SITE_TITLE,
      outPath: ogCardPath,
    });

    const html = render("post", buildOgCtx({
      url: entry.outputPath,
      title: entry.frontmatter.title || entry.slug,
      siteTitle: SITE_TITLE,
      description: entry.frontmatter.description || "",
      crumbs: buildCrumbs(entry.outputPath, entry.frontmatter.title || entry.slug),
      wide: false,
      year: new Date().getFullYear(),
      dateISO: formatDateISO(date),
      dateHuman: formatDateHuman(date),
      readingTime: minutes,
      tags: tagList,
      hasToc: toc.length > 0,
      toc,
      body: bodyHtml,
      newer: adjacent(newerPost),
      older: adjacent(olderPost),
      ogType: "article",
      ogImage: `/og/${entry.slug}.png`,
    }));
    writePage(entry.outputPath, html);
    postCount++;
  }

  // /posts/ archive.
  const archiveList = posts.map((p) => ({
    url: p.outputPath,
    title: p.frontmatter.title || p.slug,
    dateISO: formatDateISO(p.frontmatter.date),
    dateHuman: formatDateHuman(p.frontmatter.date),
  }));
  const archiveHtml = render("post-list", buildOgCtx({
    url: "/posts/",
    title: "Posts",
    siteTitle: SITE_TITLE,
    description: "All posts by Nikolai Nekrutenko.",
    crumbs: buildCrumbs("/posts/", "Posts"),
    adjacent: adjacentSections("/posts/"),
    wide: false,
    year: new Date().getFullYear(),
    posts: archiveList,
  }));
  writePage("/posts/", archiveHtml);

  // Build tag index + per-tag pages.
  const allTags = [...tagMap.entries()]
    .map(([name, tagPosts]) => ({
      name,
      slug: slugify(name),
      color: tagColor(name),
      count: tagPosts.length,
      url: `/tags/${slugify(name)}/`,
      posts: tagPosts
        .map((p) => ({
          url: p.outputPath,
          title: p.frontmatter.title || p.slug,
          dateISO: formatDateISO(p.frontmatter.date),
          dateHuman: formatDateHuman(p.frontmatter.date),
        }))
        .sort((a, b) => b.dateISO.localeCompare(a.dateISO)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tagListHtml = render("tag-list", buildOgCtx({
    url: "/tags/",
    title: "Tags",
    siteTitle: SITE_TITLE,
    description: "All tags.",
    crumbs: buildCrumbs("/tags/", "Tags"),
    wide: false,
    year: new Date().getFullYear(),
    tags: allTags,
  }));
  writePage("/tags/", tagListHtml);

  for (const tag of allTags) {
    const html = render("tag", buildOgCtx({
      url: tag.url,
      title: `Tagged: ${tag.name}`,
      siteTitle: SITE_TITLE,
      description: `Posts tagged "${tag.name}"`,
      crumbs: buildCrumbs(tag.url, `Tagged: ${tag.name}`),
      wide: false,
      year: new Date().getFullYear(),
      name: tag.name,
      count: tag.count,
      plural: tag.count !== 1,
      posts: tag.posts,
    }));
    writePage(tag.url, html);
  }

  // /archive/ — every post + gallery + tag in one human-readable page.
  const archivePageHtml = render("archive", buildOgCtx({
    url: "/archive/",
    title: "Archive",
    siteTitle: SITE_TITLE,
    description: "Every post, gallery, and tag on the site.",
    crumbs: buildCrumbs("/archive/", "Archive"),
    wide: false,
    year: new Date().getFullYear(),
    posts: archiveList,
    galleries: galleries.map((g) => ({ url: g.outputPath, title: g.frontmatter.title })),
    tags: allTags,
  }));
  writePage("/archive/", archivePageHtml);

  // Render top-level pages (about / portfolio / resume / resume_old, plus any
  // future content/*.md). TOC is opt-in via `TOC: true` or `toc: true` in
  // frontmatter (gray-matter preserves case, so we check both).
  const pages = entries.filter((e) => e.kind === "page");
  let pageCount = 0;
  for (const entry of pages) {
    const fm = entry.frontmatter;
    const wantsToc = fm.TOC === true || fm.toc === true;
    const tocAccumulator = wantsToc ? [] : null;
    const expandedMd = expand(entry.body, { kind: "page", entry, imgSizes });
    const bodyHtml = renderMarkdown(expandedMd, { tocAccumulator });

    // Only h2/h3 belong in the sidebar TOC; deeper headings clutter it.
    const toc = tocAccumulator ? tocAccumulator.filter((h) => h.depth <= 3) : [];

    const stem = path.basename(entry.srcPath, path.extname(entry.srcPath));
    const outputPath = PAGE_URL_OVERRIDES[stem] || entry.outputPath;
    const title = fm.title || "";
    const showTitle = !NO_PAGE_TITLE_STEMS.has(stem) && !!String(title).trim();

    const html = render("page", buildOgCtx({
      url: outputPath,
      title: title || SITE_TITLE,
      siteTitle: SITE_TITLE,
      description: fm.description || SITE_TITLE,
      crumbs: buildCrumbs(outputPath, title || ""),
      adjacent: adjacentSections(outputPath),
      wide: false,
      year: new Date().getFullYear(),
      showTitle,
      hasToc: toc.length > 0,
      toc,
      body: bodyHtml,
    }));
    writePage(outputPath, html);
    pageCount++;
  }

  // Top-level PDFs linked from pages + menu.
  let pdfCount = 0;
  for (const name of PDF_FILES) {
    const src = path.join(CONTENT, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, name));
      pdfCount++;
    }
  }

  // Home — editorial, calm. Hero + portrait, no recents (intentional —
  // posts ship roughly quarterly so a "Recent" list would read stale most
  // of the time; readers find content via the nav instead).
  const homeHtml = render("home", buildOgCtx({
    url: "/",
    title: SITE_TITLE,
    siteTitle: "",
    description:
      "Nikolai Nekrutenko — Avionics Hardware Development Engineer at Varda Space Industries. Embedded systems, sensors, photography.",
    wide: false,
    year: new Date().getFullYear(),
    kicker: "Hi, I'm",
    lede: `I'm an Avionics Hardware Development Engineer at <a href="https://varda.com" target="_blank" rel="noopener">Varda Space Industries</a>, working on GNC sensors and pharmaceutical instrumentation. I also enjoy <a href="/gallery/">photography</a> and <a href="/posts/">writing about projects</a>.`,
    actions: [
      { label: "Resume", href: "/resume/", class: "btn-secondary", external: false },
      { label: "Portfolio", href: "/portfolio/", class: "btn-primary", external: false },
    ],
  }));
  fs.writeFileSync(path.join(DIST, "index.html"), homeHtml);

  // /__preview/ — visual QA showcase, target of iteration-1 visual tests.
  // Dev-only; never shipped to production so search engines don't index the
  // design-system dump and sitemap stays clean.
  if (!IS_PROD) {
    const previewHtml = render("__preview", buildOgCtx({
      url: "/__preview/",
      title: "Design System Preview",
      siteTitle: SITE_TITLE,
      description: "Visual QA page for typography, components, status colors, and figures.",
      wide: false,
      year: new Date().getFullYear(),
    }));
    writePage("/__preview/", previewHtml);
  }

  // /404.html — served by Netlify (and any static host) when a URL is missing.
  // Written flat at dist/404.html (NOT dist/404/index.html) so the same file
  // is delivered regardless of directory-index behavior.
  const notFoundHtml = render("base", buildOgCtx({
    url: "/404.html",
    title: "404 — Not Found",
    siteTitle: SITE_TITLE,
    description: "Page not found.",
    wide: false,
    year: new Date().getFullYear(),
    content: render("404", {}),
  }));
  fs.writeFileSync(path.join(DIST, "404.html"), notFoundHtml);

  // /robots.txt — allow everything, point crawlers at the sitemap.
  const robotsContent = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(DIST, "robots.txt"), robotsContent);

  // Feeds — RSS at /index.xml, sitemap at /sitemap.xml. Written last so every
  // other page already exists on disk; the URL list mirrors what was rendered.
  const latestPostDate = posts.find((p) => p.frontmatter.date)?.frontmatter.date || new Date();
  const latestGalleryDate =
    galleries
      .map((g) => g.frontmatter.date)
      .filter(Boolean)
      .sort((a, b) => +b - +a)[0] || latestPostDate;
  const siteUrls = [
    { url: "/", type: "home", date: latestPostDate },
    ...pages.map((p) => ({
      url: PAGE_URL_OVERRIDES[
        path.basename(p.srcPath, path.extname(p.srcPath))
      ] || p.outputPath,
      type: "page",
      date: p.frontmatter.date || latestPostDate,
    })),
    { url: "/posts/", type: "list", date: latestPostDate },
    ...posts.map((p) => ({
      url: p.outputPath,
      type: "post",
      date: p.frontmatter.date,
    })),
    { url: "/tags/", type: "list", date: latestPostDate },
    ...allTags.map((t) => ({
      url: t.url,
      type: "tag",
      date: latestPostDate,
    })),
    { url: "/gallery/", type: "list", date: latestGalleryDate },
    ...galleries.map((g) => ({
      url: g.outputPath,
      type: "gallery",
      date: g.frontmatter.date || latestGalleryDate,
    })),
    ...galleryStandalones.map((g) => ({
      url: g.outputPath,
      type: "gallery",
      date: g.frontmatter.date || latestGalleryDate,
    })),
  ];
  fs.writeFileSync(
    path.join(DIST, "sitemap.xml"),
    renderSitemap({ siteUrl: SITE_URL, urls: siteUrls })
  );
  fs.writeFileSync(
    path.join(DIST, "index.xml"),
    renderRSS({
      siteTitle: SITE_TITLE,
      siteUrl: SITE_URL,
      description: SITE_DESCRIPTION,
      posts: posts.slice(0, 10).map((p) => ({
        title: p.frontmatter.title || p.slug,
        url: p.outputPath,
        date: p.frontmatter.date,
        body: p.body,
      })),
    })
  );

  return {
    pages: 2 + postCount + pageCount + 1 + 1 + allTags.length + galleryPageCount + 1 + gallerySoloCount,
    posts: postCount,
    topLevelPages: pageCount,
    tags: tagMap.size,
    staticFiles: staticCount,
    assets: assetCount,
    pdfs: pdfCount,
    galleries: galleries.length,
    galleryImages: galleryImageCount,
    feeds: 2,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const started = Date.now();
  const { pages, posts, topLevelPages, tags, staticFiles, assets, pdfs, galleries, galleryImages, feeds } =
    await build();
  console.log(
    `built ${pages} pages (${posts} posts, ${topLevelPages} top-level, ${tags} tags) + ${staticFiles} static + ${assets} assets + ${pdfs} pdfs + ${galleries} galleries / ${galleryImages} images + ${feeds} feeds in ${Date.now() - started}ms → ${DIST}`
  );
}
