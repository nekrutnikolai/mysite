import { test, expect } from '@playwright/test';

test('gallery filter hides non-matching years', async ({ page }) => {
  await page.goto('/gallery/maine-trip/');
  const chips = page.locator('.gallery-filter-chip');
  expect(await chips.count()).toBeGreaterThan(1);
  // Pick the first non-"All" chip
  const firstYearChip = chips.nth(1);
  const year = await firstYearChip.getAttribute('data-year');
  await firstYearChip.click();
  // All visible tiles must have that year
  const visibleYears = await page.$$eval(
    '.gallery-tile:not([data-gallery-hidden])',
    (els, expected) => els.map(el => (el as HTMLElement).dataset.galleryYear).filter(Boolean),
    year
  );
  for (const y of visibleYears) expect(y).toBe(year);
});
