import { test, expect } from '@playwright/test';
import { setTheme } from '../helpers/theme';
import { blockLiveReload } from '../helpers/dev-server';

const POST_WITH_TOC = '/posts/how-to-build-a-website-a-guide-for-command-line-novices/';

// Desktop (≥1080px): TOC should be sticky on the right margin.
// Mobile (375px):    TOC should render inline (existing component style).

test.beforeEach(async ({ page }) => {
  await blockLiveReload(page);
});

test('nav-toc · light · sticky desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(POST_WITH_TOC);
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  // Verify TOC is in the DOM and positioned (sticky).
  const toc = page.locator('.toc');
  await expect(toc).toBeVisible();
  await expect(page).toHaveScreenshot('nav-toc-light-sticky.png', {
    fullPage: false,
    animations: 'disabled',
  });
});

test('nav-toc · dark · sticky desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(POST_WITH_TOC);
  await setTheme(page, 'dark');
  await page.waitForLoadState('networkidle');
  const toc = page.locator('.toc');
  await expect(toc).toBeVisible();
  await expect(page).toHaveScreenshot('nav-toc-dark-sticky.png', {
    fullPage: false,
    animations: 'disabled',
  });
});

test('nav-toc · parchment · sticky desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(POST_WITH_TOC);
  await setTheme(page, 'parchment');
  await page.waitForLoadState('networkidle');
  const toc = page.locator('.toc');
  await expect(toc).toBeVisible();
  await expect(page).toHaveScreenshot('nav-toc-parchment-sticky.png', {
    fullPage: false,
    animations: 'disabled',
  });
});

test('nav-toc · light · inline mobile (fallback)', async ({ page }) => {
  // Below 1080px the CSS grid layout does not activate — TOC stays inline.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(POST_WITH_TOC);
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const toc = page.locator('.toc');
  await expect(toc).toBeVisible();
  // Confirm TOC is not sticky (position resolves to 'static' on mobile).
  const position = await toc.evaluate((el) =>
    window.getComputedStyle(el).position
  );
  expect(position).toBe('static');
  await expect(page).toHaveScreenshot('nav-toc-light-mobile.png', {
    fullPage: false,
    animations: 'disabled',
  });
});

test('nav-toc · exactly one .toc in DOM', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(POST_WITH_TOC);
  await page.waitForLoadState('networkidle');
  const count = await page.locator('.toc').count();
  expect(count).toBe(1);
});
