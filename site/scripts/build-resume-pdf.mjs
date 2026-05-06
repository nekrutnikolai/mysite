#!/usr/bin/env node
// Local-only Resume.pdf generator. Spins up a tiny http server over dist/,
// renders /resume/ in headless chromium, and writes the PDF straight to
// content/Resume.pdf. The result is checked into git, then copied verbatim
// from content/ → dist/ at build-time by site/build.mjs (PDF_FILES).
//
// Run after editing content/resume.md (or any of the resume CSS):
//
//     npm run build:pdf
//
// This is local-only so the Netlify build doesn't need to install or launch
// chromium.

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DIST = path.join(ROOT, "dist");
const OUTPUT = path.join(ROOT, "content", "Resume.pdf");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".pdf":  "application/pdf",
  ".xml":  "application/xml",
  ".txt":  "text/plain; charset=utf-8",
  ".ico":  "image/x-icon",
};

async function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const filePath = path.join(rootDir, urlPath);
    if (!filePath.startsWith(path.resolve(rootDir))) {
      res.writeHead(403); res.end("forbidden"); return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); res.end("not found"); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "resume", "index.html"))) {
    console.error("dist/resume/index.html not found — run `npm run build` first.");
    process.exit(1);
  }
  const server = await startStaticServer(DIST);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${server.url}/resume/`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: OUTPUT,
      format: "Letter",
      printBackground: false,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
  const sizeKb = Math.round(fs.statSync(OUTPUT).size / 1024);
  console.log(`✓ wrote ${path.relative(ROOT, OUTPUT)} (${sizeKb} KB)`);
  console.log("  remember to git add + commit content/Resume.pdf");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
