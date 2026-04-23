import { expect, test } from "@playwright/test";
import { CURRENT_ITER } from "./fixtures/urls";
import { blockLiveReload } from "./helpers/dev-server";

test.describe("lightbox", () => {
  test.skip(CURRENT_ITER < 5, "enabled from iteration 5");

  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  test("opens on gallery-item click and closes on Esc", async ({ page }) => {
    await page.goto("/gallery/solstice-fun/");
    await page.waitForLoadState("networkidle");
    await page.locator(".gallery-item .gallery-trigger").first().click();
    const dialog = page.locator("dialog.lightbox");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("arrow keys navigate prev/next", async ({ page }) => {
    await page.goto("/gallery/solstice-fun/");
    await page.waitForLoadState("networkidle");
    await page.locator(".gallery-item .gallery-trigger").first().click();
    const dialog = page.locator("dialog.lightbox");
    await expect(dialog).toBeVisible();
    const initialIndex = await dialog.getAttribute("data-index");
    await page.keyboard.press("ArrowRight");
    // Wait for the dialog's data-index to actually change.
    await expect(async () => {
      const nextIndex = await dialog.getAttribute("data-index");
      expect(nextIndex).not.toBe(initialIndex);
    }).toPass({ timeout: 2000 });
  });
});
