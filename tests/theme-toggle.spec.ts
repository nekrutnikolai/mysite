import { test, expect } from "@playwright/test";
import { blockLiveReload } from "./helpers/dev-server";
import { CURRENT_ITER } from "./fixtures/urls";

test.describe("theme toggle", () => {
  test.skip(CURRENT_ITER < 6, "enabled from iteration 6");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  test("cycles light → dark → parchment → light on click", async ({ page }) => {
    // Start with a clean slate — ignore any persisted preference.
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("nn-site-theme");
      } catch {
        /* ignored */
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const html = page.locator("html");
    const btn = page.locator("#theme-toggle");

    // Default state: no data-theme attribute (= light).
    await expect(html).not.toHaveAttribute("data-theme", /.+/);

    await btn.click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await btn.click();
    await expect(html).toHaveAttribute("data-theme", "parchment");

    await btn.click();
    await expect(html).not.toHaveAttribute("data-theme", /.+/);
  });

  test("theme persists through reload", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("nn-site-theme", "parchment");
      } catch {
        /* ignored */
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // FOUC-safe inline script in <head> should apply parchment before first paint.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");
  });

  test("aria-label updates per theme", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("nn-site-theme");
      } catch {
        /* ignored */
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const btn = page.locator("#theme-toggle");
    await expect(btn).toHaveAttribute("aria-label", /light/i);

    await btn.click();
    await expect(btn).toHaveAttribute("aria-label", /dark/i);

    await btn.click();
    await expect(btn).toHaveAttribute("aria-label", /parchment/i);
  });
});
