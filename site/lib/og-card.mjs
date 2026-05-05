// Per-post OpenGraph card renderer: 1200x630 PNG with title + date + site
// name. Built-in HTML template loaded into a headless browser, screenshot
// straight to disk. Fonts come from Google Fonts via @import; networkidle
// waits for them to land before snapping.

import { withPage } from "./browser.mjs";

const TEMPLATE = (title, dateHuman, siteName) => `<!doctype html>
<html><head><style>
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&family=IBM+Plex+Mono:wght@400&display=swap');
body { margin: 0; width: 1200px; height: 630px; background: #ffffff;
       display: flex; flex-direction: column; justify-content: space-between;
       padding: 80px; box-sizing: border-box; font-family: -apple-system, sans-serif; }
.title { font-family: 'Source Serif 4', Georgia, serif; font-weight: 700;
         font-size: 64px; line-height: 1.15; color: #37352f; letter-spacing: -0.02em; max-width: 1040px; }
.footer { display: flex; justify-content: space-between; align-items: baseline;
          font-family: 'IBM Plex Mono', monospace; font-size: 18px; color: #6b6964; }
.site { font-family: 'Source Serif 4', Georgia, serif; font-weight: 600; font-size: 22px; color: #37352f; }
</style></head><body>
<div class="title">${escapeHtml(title)}</div>
<div class="footer"><span class="date">${escapeHtml(dateHuman)}</span><span class="site">${escapeHtml(siteName)}</span></div>
</body></html>`;

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function generateOgCard({ title, dateHuman, siteName, outPath }) {
  await withPage(async (page) => {
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(TEMPLATE(title, dateHuman, siteName), { waitUntil: "networkidle" });
    await page.screenshot({
      path: outPath,
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 630 }
    });
  });
}
