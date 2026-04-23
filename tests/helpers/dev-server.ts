import type { Page } from "@playwright/test";

// The dev server injects an SSE live-reload client that holds a persistent
// connection to /__events — that would pin waitForLoadState("networkidle")
// open forever. Block both endpoints so the network actually goes idle.
//
// Also block third-party iframe content (YouTube, Jovian) so visual screenshots
// are stable. Their iframes still render as empty boxes in the DOM — good
// enough for layout regression, and avoids remote UI changes flaking tests.
export async function blockLiveReload(page: Page) {
  await page.route("**/__livereload.js", (r) => r.fulfill({ status: 204, body: "" }));
  await page.route("**/__events", (r) => r.abort());
  await page.route("**://*.youtube.com/**", (r) => r.abort());
  await page.route("**://*.youtube-nocookie.com/**", (r) => r.abort());
  await page.route("**://*.ytimg.com/**", (r) => r.abort());
  await page.route("**://*.jovian.ml/**", (r) => r.abort());
  await page.route("**://*.jovian.ai/**", (r) => r.abort());
}
