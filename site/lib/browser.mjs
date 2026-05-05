// Headless chromium launcher shared across build-time tools (Resume PDF
// generation, per-post OG card rendering). One browser is launched lazily on
// first use and reused for the duration of the build; closeBrowser() must be
// called before the build process exits or it will hang.

import { chromium } from "playwright";

let _browser;

export async function getBrowser() {
  if (!_browser) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// Run `fn` with a fresh page in a fresh context (so cookies/storage don't
// leak between callers). The page is disposed automatically afterwards.
export async function withPage(fn) {
  const browser = await getBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    await ctx.close();
  }
}
