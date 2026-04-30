/**
 * Visual regression tests for nav-scroll enhancements (Agent A, Tier 1):
 *   - Reading-progress hairline
 *   - Back-to-top pill
 *   - Sticky-header section indicator
 *
 * Two viewport states captured per theme:
 *   1. idle  — page loaded, no scroll (bar at scaleX(0), pill hidden)
 *   2. scrolled-half — scrolled to the midpoint of the article
 */

import { expect, test } from "@playwright/test";
import { THEMES } from "./fixtures/urls";
import { setTheme } from "./helpers/theme";
import { blockLiveReload } from "./helpers/dev-server";

// A long post with several h2/h3 headings so all three features are exercisable.
const POST = "/posts/how-to-build-a-website-a-guide-for-command-line-novices/";
const DESKTOP = { width: 1440, height: 900 };

test.describe("nav-scroll · visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
    await page.setViewportSize(DESKTOP);
  });

  for (const theme of THEMES) {
    test(`nav-scroll · ${theme} · idle`, async ({ page }) => {
      await page.goto(POST);
      await setTheme(page, theme);
      await page.waitForLoadState("networkidle");
      // Confirm DOM hooks are present (bar starts at scaleX(0); pill is hidden=true).
      await page.waitForSelector("#nav-reading-progress", { state: "attached" });
      await page.waitForSelector("#nav-back-to-top", { state: "attached" });
      await expect(page).toHaveScreenshot(`nav-scroll-${theme}-idle.png`, {
        fullPage: false,
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      });
    });

    test(`nav-scroll · ${theme} · scrolled-half`, async ({ page }) => {
      await page.goto(POST);
      await setTheme(page, theme);
      await page.waitForLoadState("networkidle");
      // Scroll to the midpoint of the page body.
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "instant" })
      );
      // Allow scroll-event handlers to run and the rAF to flush.
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot(`nav-scroll-${theme}-scrolled-half.png`, {
        fullPage: false,
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
