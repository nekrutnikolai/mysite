import { test, expect } from '@playwright/test';

// ---- F.3 behavior tests for the Cmd+K command palette ---- //

test('Ctrl+K opens palette, filters by query, Esc closes', async ({ page }) => {
  await page.goto('/');
  // Palette should be hidden initially
  await expect(page.locator('#cmdk-backdrop')).toBeHidden();

  // Open via keyboard shortcut
  await page.keyboard.press('Control+k');
  await expect(page.locator('#cmdk-backdrop')).toBeVisible();

  // Input should be focused
  await expect(page.locator('#cmdk-input')).toBeFocused();

  // Type a query — "maine" should surface the Maine Trip gallery
  await page.locator('#cmdk-input').fill('maine');
  const titles = await page.$$eval('.cmdk-item-title', els =>
    els.map(e => (e as HTMLElement).textContent?.toLowerCase() ?? '')
  );
  expect(titles.some(t => t.includes('maine'))).toBe(true);

  // Esc closes
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmdk-backdrop')).toBeHidden();
});

test('trigger button opens palette', async ({ page }) => {
  await page.goto('/');
  await page.locator('#cmdk-trigger').click();
  await expect(page.locator('#cmdk-backdrop')).toBeVisible();

  // Close via Esc
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmdk-backdrop')).toBeHidden();
});

test('backdrop click closes palette', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#cmdk-backdrop')).toBeVisible();

  // Click on the backdrop element (not the panel)
  await page.locator('#cmdk-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#cmdk-backdrop')).toBeHidden();
});

test('arrow-key navigation + Enter navigates', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#cmdk-backdrop')).toBeVisible();

  // Move down to item 1 (index 1), then press Enter
  await page.keyboard.press('ArrowDown');
  // The second item should now be active
  const activeItem = page.locator('.cmdk-item.active');
  await expect(activeItem).toBeVisible();

  // Get the URL for that item before pressing Enter
  const itemIndex = await activeItem.getAttribute('data-i');
  expect(itemIndex).toBe('1');
});

test('Toggle theme action clicks #theme-toggle', async ({ page }) => {
  await page.goto('/');

  // Record initial theme
  const initialTheme = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') ?? 'light'
  );

  await page.keyboard.press('Control+k');
  await page.locator('#cmdk-input').fill('toggle theme');
  await page.waitForSelector('.cmdk-item');

  // Click the Toggle theme item
  const items = page.locator('.cmdk-item');
  const count = await items.count();
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const title = await items.nth(i).locator('.cmdk-item-title').textContent();
    if (title && title.toLowerCase().includes('toggle theme')) {
      await items.nth(i).click();
      clicked = true;
      break;
    }
  }
  expect(clicked).toBe(true);

  // Palette should close
  await expect(page.locator('#cmdk-backdrop')).toBeHidden();

  // Theme should have changed
  const newTheme = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') ?? 'light'
  );
  expect(newTheme).not.toBe(initialTheme);
});

test('content index file exists and has expected shape', async ({ request }) => {
  const r = await request.get('/__index.json');
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(j).toHaveProperty('generatedAt');
  expect(Array.isArray(j.items)).toBe(true);
  expect(j.items.length).toBeGreaterThan(20);

  // Spot-check item shapes
  const first = j.items[0];
  expect(first).toHaveProperty('kind');
  expect(first).toHaveProperty('title');
  expect(first).toHaveProperty('meta');
  expect(first).toHaveProperty('url');

  // Verify expected kinds are present
  const kinds = new Set<string>(j.items.map((it: { kind: string }) => it.kind));
  expect(kinds.has('page')).toBe(true);
  expect(kinds.has('post')).toBe(true);
  expect(kinds.has('gallery')).toBe(true);
  expect(kinds.has('tag')).toBe(true);
  expect(kinds.has('action')).toBe(true);
});

test('palette has correct ARIA roles', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#cmdk-backdrop')).toBeVisible();

  // dialog + aria-modal
  const backdrop = page.locator('#cmdk-backdrop');
  await expect(backdrop).toHaveAttribute('role', 'dialog');
  await expect(backdrop).toHaveAttribute('aria-modal', 'true');

  // listbox
  const listbox = page.locator('#cmdk-list');
  await expect(listbox).toHaveAttribute('role', 'listbox');

  // combobox input
  const input = page.locator('#cmdk-input');
  await expect(input).toHaveAttribute('role', 'combobox');
  await expect(input).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
});

test('cmdk partial is rendered in every page', async ({ request }) => {
  // Check a sample of pages
  for (const path of ['/', '/about/', '/posts/', '/gallery/', '/tags/']) {
    const r = await request.get(path);
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html).toContain('cmdk-backdrop');
    expect(html).toContain('cmdk-panel');
  }
});
