import { expect, test } from "@playwright/test";
import { CURRENT_ITER, THEMES, VIEWPORTS } from "./fixtures/urls";
import { setTheme } from "./helpers/theme";
import { blockLiveReload } from "./helpers/dev-server";

const URL = "/__preview/";

test.describe("visual regression — /__preview/", () => {
  test.skip(CURRENT_ITER < 1, "enabled from iteration 1");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${URL} · ${viewport.name} · ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(URL);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`preview-${viewport.name}-${theme}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});

test.describe("visual regression — posts", () => {
  test.skip(CURRENT_ITER < 2, "enabled from iteration 2");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  const POST_URLS = [
    { url: "/posts/", slug: "posts-index" },
    { url: "/posts/my-first-post/", slug: "post-my-first-post" },
    { url: "/posts/the-book-of-bitcoin-an-analogy-to-explain-bitcoin/", slug: "post-book-of-bitcoin" },
  ];
  const DESKTOP = { width: 1440, height: 900 };

  for (const { url, slug } of POST_URLS) {
    for (const theme of THEMES) {
      test(`${url} · desktop · ${theme}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(url);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`${slug}-${theme}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});

test.describe("visual regression — tags", () => {
  test.skip(CURRENT_ITER < 3, "enabled from iteration 3");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  const TAG_URLS = [
    { url: "/tags/", slug: "tags-index" },
    { url: "/tags/bitcoin/", slug: "tag-bitcoin" },
  ];
  const DESKTOP = { width: 1440, height: 900 };

  for (const { url, slug } of TAG_URLS) {
    for (const theme of THEMES) {
      test(`${url} · desktop · ${theme}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(url);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`${slug}-${theme}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});

test.describe("visual regression — top-level pages", () => {
  test.skip(CURRENT_ITER < 4, "enabled from iteration 4");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  const PAGE_URLS = [
    { url: "/about/", slug: "about" },
    { url: "/portfolio/", slug: "portfolio" },
    { url: "/resume/", slug: "resume" },
  ];
  const DESKTOP = { width: 1440, height: 900 };

  for (const { url, slug } of PAGE_URLS) {
    for (const theme of THEMES) {
      test(`${url} · desktop · ${theme}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(url);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`page-${slug}-${theme}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});

test.describe("visual regression — home", () => {
  test.skip(CURRENT_ITER < 4, "enabled from iteration 4");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`/ · ${viewport.name} · ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/");
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`home-${viewport.name}-${theme}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});

test.describe("visual regression — galleries", () => {
  test.skip(CURRENT_ITER < 5, "enabled from iteration 5");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  const GALLERY_URLS = [
    { url: "/gallery/", slug: "gallery-index" },
    { url: "/gallery/solstice-fun/", slug: "gallery-solstice-fun" },
    { url: "/gallery/maine-trip/", slug: "gallery-maine-trip" },
  ];
  const DESKTOP = { width: 1440, height: 900 };

  for (const { url, slug } of GALLERY_URLS) {
    for (const theme of THEMES) {
      test(`${url} · desktop · ${theme}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(url);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        // Galleries have many images — bump the stabilization timeout.
        await expect(page).toHaveScreenshot(`${slug}-${theme}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.015,
          timeout: 20000,
        });
      });
    }
  }
});

test.describe("visual regression — 404", () => {
  test.skip(CURRENT_ITER < 7, "enabled from iteration 7");
  test.beforeEach(async ({ page }) => { await blockLiveReload(page); });
  const DESKTOP = { width: 1440, height: 900 };
  for (const theme of THEMES) {
    test(`/404.html · desktop · ${theme}`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto("/404.html");
      await setTheme(page, theme);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`not-found-${theme}.png`, {
        fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.01,
      });
    });
  }
});
