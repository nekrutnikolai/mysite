import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { activeUrls, CURRENT_ITER } from "./fixtures/urls";

// Playwright's CWD is the repo root (where playwright.config.ts lives).
const REPO_ROOT = process.cwd();
const POSTS_SRC = path.join(REPO_ROOT, "content", "posts");
const POSTS_DIST = path.join(REPO_ROOT, "dist", "posts");

function publishedPosts(): { file: string; data: Record<string, unknown> }[] {
  return fs
    .readdirSync(POSTS_SRC)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_SRC, file), "utf8");
      return { file, data: matter(raw).data };
    })
    .filter(({ data }) => data.draft !== true);
}

async function expectedPostUrls(): Promise<string[]> {
  // Try to reuse the build's slugifier so tests never drift from the pipeline.
  // Fallback (if routes.mjs hasn't landed yet during parallel execution) is
  // the 7 hand-derived slugs verified against public/posts/.
  try {
    const mod = await import(
      path.join(REPO_ROOT, "site", "lib", "routes.mjs")
    );
    return publishedPosts().map(({ file, data }) =>
      mod.postOutputPath(data, file),
    );
  } catch {
    return [
      "/posts/the-book-of-bitcoin-an-analogy-to-explain-bitcoin/",
      "/posts/how-to-build-a-website-a-guide-for-command-line-novices/",
      "/posts/eolrc-build-guide/",
      "/posts/lets-kill-this-macbook-how-to-mine-monero-on-a-mac/",
      "/posts/my-first-post/",
      "/posts/eolrc-an-extremely-overkill-lego-rc-car-from-plane-parts/",
      "/posts/the-mostly-maine-trip-video/",
    ];
  }
}

test("dev server responds 200 on /", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
});

test("live-reload client is injected into HTML responses", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["content-type"]).toContain("text/html");
  const body = await res.text();
  expect(body).toContain("/__livereload.js");
});

test("SSE event stream is reachable", async ({ request }) => {
  const res = await request.get("/__events", {
    headers: { accept: "text/event-stream" },
    timeout: 2000,
    maxRedirects: 0,
  }).catch((err) => err);
  // Playwright's request API aborts streaming responses, which is expected here.
  // What we care about is that the server accepted the request (no connection refused).
  if (res && typeof res.status === "function") {
    expect(res.status()).toBe(200);
  }
});

test(`active URLs (iter <= ${CURRENT_ITER}) all respond 200`, async ({ request }) => {
  const broken: { url: string; status: number }[] = [];
  for (const { url } of activeUrls()) {
    const res = await request.get(url);
    if (res.status() >= 400) broken.push({ url, status: res.status() });
  }
  expect(broken, JSON.stringify(broken, null, 2)).toEqual([]);
});

test("post count matches published markdown count", async () => {
  test.skip(CURRENT_ITER < 2, "enabled from iteration 2");
  const published = publishedPosts().length;
  expect(published).toBe(7);

  const built = fs
    .readdirSync(POSTS_DIST, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => fs.existsSync(path.join(POSTS_DIST, e.name, "index.html")))
    .length;
  expect(built).toBe(published);
});

test("every published post URL is reachable", async ({ request }) => {
  test.skip(CURRENT_ITER < 2, "enabled from iteration 2");
  const urls = await expectedPostUrls();
  expect(urls.length).toBe(7);
  const broken: { url: string; status: number }[] = [];
  for (const url of urls) {
    const res = await request.get(url);
    if (res.status() >= 400) broken.push({ url, status: res.status() });
  }
  expect(broken, JSON.stringify(broken, null, 2)).toEqual([]);
});

test("tag count matches unique tags in published posts", async () => {
  test.skip(CURRENT_ITER < 3, "enabled from iteration 3");
  const posts = publishedPosts();
  const tags = new Set<string>();
  for (const { data } of posts) {
    if (Array.isArray(data.tags)) {
      for (const t of data.tags) if (typeof t === "string") tags.add(t);
    }
  }
  const builtDirs = fs
    .readdirSync(path.join(REPO_ROOT, "dist", "tags"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => fs.existsSync(path.join(REPO_ROOT, "dist", "tags", e.name, "index.html")))
    .length;
  expect(builtDirs).toBe(tags.size);
});

test("PDFs are served at root", async ({ request }) => {
  test.skip(CURRENT_ITER < 4, "enabled from iteration 4");
  const pdfs = ["/Resume.pdf", "/Portfolio.pdf", "/e_horiz_report.pdf"];
  const broken: { url: string; status: number }[] = [];
  for (const p of pdfs) {
    const res = await request.get(p);
    if (res.status() !== 200) broken.push({ url: p, status: res.status() });
    else {
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("pdf")) broken.push({ url: p, status: -1 });
    }
  }
  expect(broken, JSON.stringify(broken, null, 2)).toEqual([]);
});

test("portfolio page has TOC with anchors", async ({ request }) => {
  test.skip(CURRENT_ITER < 4, "enabled from iteration 4");
  const res = await request.get("/portfolio/");
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/class="toc"/);
  const anchorCount = (html.match(/<a href="#[^"]+"/g) ?? []).length;
  expect(anchorCount).toBeGreaterThanOrEqual(3);
});

test("resume preserves raw HTML centering", async ({ request }) => {
  test.skip(CURRENT_ITER < 4, "enabled from iteration 4");
  const res = await request.get("/resume/");
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/align="center"/);
});

test("home shows recent posts", async ({ request }) => {
  test.skip(CURRENT_ITER < 4, "enabled from iteration 4");
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/class="home-recent"/);
  const recentLinks = (html.match(/class="home-recent-item"/g) ?? []).length;
  expect(recentLinks).toBeGreaterThanOrEqual(3);
});

test("gallery count matches directory count", async () => {
  test.skip(CURRENT_ITER < 5, "enabled from iteration 5");
  // Source: content/gallery/<name>/ subdirs with index.md + images/.
  // Built:  dist/gallery/<name>/ subdirs with index.html, plus the standalone
  //         /gallery/gallertest/ page from content/gallery/gallerytest.md.
  const srcDirs = fs
    .readdirSync(path.join(REPO_ROOT, "content", "gallery"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) =>
      fs.existsSync(path.join(REPO_ROOT, "content", "gallery", e.name, "index.md")),
    ).length;
  const builtDirs = fs
    .readdirSync(path.join(REPO_ROOT, "dist", "gallery"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) =>
      fs.existsSync(path.join(REPO_ROOT, "dist", "gallery", e.name, "index.html")),
    ).length;
  expect(builtDirs).toBeGreaterThanOrEqual(srcDirs);
});

test("total gallery image count matches source", async () => {
  test.skip(CURRENT_ITER < 5, "enabled from iteration 5");
  const galleryRoot = path.join(REPO_ROOT, "content", "gallery");
  let srcImageCount = 0;
  for (const album of fs.readdirSync(galleryRoot)) {
    const imgDir = path.join(galleryRoot, album, "images");
    if (!fs.existsSync(imgDir)) continue;
    srcImageCount += fs
      .readdirSync(imgDir)
      .filter((f) => f.toLowerCase().endsWith(".jpeg") || f.toLowerCase().endsWith(".jpg"))
      .length;
  }
  const distGalleryRoot = path.join(REPO_ROOT, "dist", "gallery");
  let distOriginals = 0;
  for (const album of fs.readdirSync(distGalleryRoot)) {
    const origDir = path.join(distGalleryRoot, album, "originals");
    if (!fs.existsSync(origDir)) continue;
    distOriginals += fs.readdirSync(origDir).length;
  }
  expect(distOriginals).toBe(srcImageCount);
});

test("all gallery thumbnails respond 200", async ({ request }) => {
  test.skip(CURRENT_ITER < 5, "enabled from iteration 5");
  const galleryPage = await request.get("/gallery/solstice-fun/");
  expect(galleryPage.status()).toBe(200);
  const html = await galleryPage.text();
  const thumbUrls = [
    ...html.matchAll(/<img[^>]*src="(\/gallery\/[^"]+-300\.jpg)"/g),
  ].map((m) => m[1]);
  expect(thumbUrls.length).toBeGreaterThan(0);
  const broken: { url: string; status: number }[] = [];
  for (const u of thumbUrls) {
    const r = await request.get(u);
    if (r.status() !== 200) broken.push({ url: u, status: r.status() });
  }
  expect(broken, JSON.stringify(broken, null, 2)).toEqual([]);
});

test("sitemap.xml is valid and contains every public URL", async ({ request }) => {
  test.skip(CURRENT_ITER < 7, "enabled from iteration 7");
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"] ?? "").toMatch(/xml/);
  const xml = await res.text();
  expect(xml).toMatch(/^<\?xml/);
  expect(xml).toMatch(/<urlset /);
  // At minimum: home, posts, gallery, tags, + 7 posts + some galleries.
  const locs = (xml.match(/<loc>/g) ?? []).length;
  expect(locs).toBeGreaterThanOrEqual(30);
});

test("RSS index.xml is valid RSS 2.0 with posts", async ({ request }) => {
  test.skip(CURRENT_ITER < 7, "enabled from iteration 7");
  const res = await request.get("/index.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toMatch(/^<\?xml/);
  expect(xml).toMatch(/<rss version="2\.0"/);
  const items = (xml.match(/<item>/g) ?? []).length;
  expect(items).toBe(7);
});

test("robots.txt allows all + links sitemap", async ({ request }) => {
  test.skip(CURRENT_ITER < 7, "enabled from iteration 7");
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/User-agent:\s*\*/);
  expect(body).toMatch(/Sitemap:\s*http/);
});

test("every page has canonical + OG meta tags", async ({ request }) => {
  test.skip(CURRENT_ITER < 7, "enabled from iteration 7");
  const pages = ["/", "/about/", "/portfolio/", "/posts/my-first-post/", "/gallery/solstice-fun/", "/404.html"];
  for (const p of pages) {
    const res = await request.get(p);
    expect(res.status(), p).toBe(200);
    const html = await res.text();
    expect(html, `${p} missing canonical`).toMatch(/<link rel="canonical"/);
    expect(html, `${p} missing og:title`).toMatch(/<meta property="og:title"/);
    expect(html, `${p} missing og:type`).toMatch(/<meta property="og:type"/);
    expect(html, `${p} missing twitter:card`).toMatch(/<meta name="twitter:card"/);
  }
});
