import { test } from "@playwright/test";
import { CURRENT_ITER, THEMES } from "./fixtures/urls";
import { setTheme } from "./helpers/theme";
import { ALLOWLIST, assertNoViolations, runAxe } from "./helpers/axe";
import { blockLiveReload } from "./helpers/dev-server";

const URL = "/__preview/";
const DESKTOP = { width: 1440, height: 900 };

test.describe("a11y — /__preview/", () => {
  test.skip(CURRENT_ITER < 1, "enabled from iteration 1");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  for (const theme of THEMES) {
    test(`${URL} · desktop · ${theme}`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(URL);
      await setTheme(page, theme);
      await page.waitForLoadState("networkidle");
      const violations = await runAxe(page);
      assertNoViolations(violations, ALLOWLIST, theme);
    });
  }
});

test.describe("a11y — posts", () => {
  test.skip(CURRENT_ITER < 2, "enabled from iteration 2");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  const POST_URLS = ["/posts/", "/posts/my-first-post/", "/posts/the-book-of-bitcoin-an-analogy-to-explain-bitcoin/"];

  for (const url of POST_URLS) {
    for (const theme of THEMES) {
      test(`${url} · ${theme}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(url);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        const violations = await runAxe(page);
        assertNoViolations(violations, ALLOWLIST, theme);
      });
    }
  }
});

test.describe("a11y — tags", () => {
  test.skip(CURRENT_ITER < 3, "enabled from iteration 3");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  const TAG_URLS = ["/tags/", "/tags/bitcoin/"];

  for (const url of TAG_URLS) {
    for (const theme of THEMES) {
      test(`${url} · ${theme}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(url);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        const violations = await runAxe(page);
        assertNoViolations(violations, ALLOWLIST, theme);
      });
    }
  }
});

test.describe("a11y — top-level pages", () => {
  test.skip(CURRENT_ITER < 4, "enabled from iteration 4");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  const PAGE_URLS = ["/about/", "/portfolio/", "/resume/"];

  for (const url of PAGE_URLS) {
    for (const theme of THEMES) {
      test(`${url} · ${theme}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(url);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        const violations = await runAxe(page);
        assertNoViolations(violations, ALLOWLIST, theme);
      });
    }
  }
});

test.describe("a11y — home", () => {
  test.skip(CURRENT_ITER < 4, "enabled from iteration 4");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  for (const theme of THEMES) {
    test(`/ · ${theme}`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto("/");
      await setTheme(page, theme);
      await page.waitForLoadState("networkidle");
      const violations = await runAxe(page);
      assertNoViolations(violations, ALLOWLIST, theme);
    });
  }
});

test.describe("a11y — galleries", () => {
  test.skip(CURRENT_ITER < 5, "enabled from iteration 5");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  const GALLERY_URLS = ["/gallery/", "/gallery/solstice-fun/", "/gallery/maine-trip/"];

  for (const url of GALLERY_URLS) {
    for (const theme of THEMES) {
      test(`${url} · ${theme}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(url);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        const violations = await runAxe(page);
        assertNoViolations(violations, ALLOWLIST, theme);
      });
    }
  }
});

test.describe("a11y — 404", () => {
  test.skip(CURRENT_ITER < 7, "enabled from iteration 7");
  test.beforeEach(async ({ page }) => { await blockLiveReload(page); });
  for (const theme of THEMES) {
    test(`/404.html · ${theme}`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto("/404.html");
      await setTheme(page, theme);
      await page.waitForLoadState("networkidle");
      const violations = await runAxe(page);
      assertNoViolations(violations, ALLOWLIST, theme);
    });
  }
});
