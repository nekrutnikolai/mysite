/**
 * Task E.3 — Playwright behavior tests for mobile swipe navigation.
 *
 * Strategy: touch events dispatched via page.evaluate() DO reach window event
 * listeners in Chromium's main world — verified by debug tracing. The handler
 * fires synchronously and calls document.startViewTransition(() => location.assign()),
 * which triggers a real navigation. We set up page.waitForNavigation() BEFORE
 * dispatching the swipe so we don't miss the navigation event.
 */
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { blockLiveReload } from '../helpers/dev-server';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Create a mobile browser context (touch + 390×844 viewport). */
async function mobileCtx(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
}

/**
 * Dispatch touch events that simulate a horizontal swipe in the page's main world.
 * startX → endX with fixed Y=400.
 *
 * Uses changedTouches for touchend (spec-compliant: touches array is empty on touchend).
 * cancelable: true is required so the handler can call preventDefault().
 */
async function dispatchSwipe(page: Page, startX: number, endX: number): Promise<void> {
  await page.evaluate(
    ([sx, ex]) => {
      function mkTouch(x: number): Touch {
        return new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 });
      }
      function fire(type: string, x: number) {
        const t = mkTouch(x);
        window.dispatchEvent(new TouchEvent(type, {
          touches: type === 'touchend' ? [] : [t],
          changedTouches: [t],
          cancelable: true,
          bubbles: true,
        }));
      }
      const mid = sx + (ex - sx) * 0.5;
      fire('touchstart', sx);
      fire('touchmove', mid);  // intermediate point to trigger axis lock
      fire('touchmove', ex);
      fire('touchend', ex);
    },
    [startX, endX] as [number, number],
  );
}

/**
 * Wait for a navigation that was triggered by the swipe. Must be set up BEFORE
 * the swipe fires because startViewTransition navigation can be very fast.
 */
async function swipeAndWait(page: Page, startX: number, endX: number): Promise<void> {
  await Promise.all([
    page.waitForNavigation({ timeout: 5000 }),
    dispatchSwipe(page, startX, endX),
  ]);
}

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe('mobile swipe navigation', () => {
  test('swipe-left on /about/ navigates to /gallery/', async ({ browser }) => {
    const ctx = await mobileCtx(browser);
    const page = await ctx.newPage();
    await blockLiveReload(page);

    await page.goto('/about/');
    await page.waitForLoadState('domcontentloaded');

    // swipe left: startX=320 → endX=50 (270px = ~70% viewport, well past 22% threshold)
    await swipeAndWait(page, 320, 50);

    expect(new URL(page.url()).pathname).toBe('/gallery/');
    await ctx.close();
  });

  test('swipe-right on /gallery/ navigates back to /about/', async ({ browser }) => {
    const ctx = await mobileCtx(browser);
    const page = await ctx.newPage();
    await blockLiveReload(page);

    await page.goto('/gallery/');
    await page.waitForLoadState('domcontentloaded');

    // swipe right: startX=70 → endX=340 (270px = ~70% viewport)
    await swipeAndWait(page, 70, 340);

    expect(new URL(page.url()).pathname).toBe('/about/');
    await ctx.close();
  });

  test('swipe-left on /portfolio/ wraps to /about/', async ({ browser }) => {
    const ctx = await mobileCtx(browser);
    const page = await ctx.newPage();
    await blockLiveReload(page);

    await page.goto('/portfolio/');
    await page.waitForLoadState('domcontentloaded');

    // swipe left on the last section → wraps back to the first
    await swipeAndWait(page, 320, 50);

    expect(new URL(page.url()).pathname).toBe('/about/');
    await ctx.close();
  });

  test('swipe-right on /about/ wraps to /portfolio/', async ({ browser }) => {
    const ctx = await mobileCtx(browser);
    const page = await ctx.newPage();
    await blockLiveReload(page);

    await page.goto('/about/');
    await page.waitForLoadState('domcontentloaded');

    // swipe right on the first section → wraps around to the last
    await swipeAndWait(page, 70, 340);

    expect(new URL(page.url()).pathname).toBe('/portfolio/');
    await ctx.close();
  });

  test('swipe does not activate on individual post pages', async ({ browser }) => {
    const ctx = await mobileCtx(browser);
    const page = await ctx.newPage();
    await blockLiveReload(page);

    await page.goto('/posts/my-first-post/');
    await page.waitForLoadState('domcontentloaded');

    // Swipe left should NOT trigger navigation
    await dispatchSwipe(page, 320, 50);

    // Brief wait then confirm URL unchanged
    await page.waitForTimeout(400);
    expect(new URL(page.url()).pathname).toBe('/posts/my-first-post/');

    await ctx.close();
  });

  test('swipe does not activate on home page', async ({ browser }) => {
    const ctx = await mobileCtx(browser);
    const page = await ctx.newPage();
    await blockLiveReload(page);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await dispatchSwipe(page, 320, 50);
    await page.waitForTimeout(400);
    expect(new URL(page.url()).pathname).toBe('/');

    await ctx.close();
  });

  test('short swipe (below threshold) does not navigate', async ({ browser }) => {
    const ctx = await mobileCtx(browser);
    const page = await ctx.newPage();
    await blockLiveReload(page);

    await page.goto('/about/');
    await page.waitForLoadState('domcontentloaded');

    // Only 40px — well below the 22% threshold (~86px on a 390px viewport)
    await dispatchSwipe(page, 200, 160);

    await page.waitForTimeout(400);
    expect(new URL(page.url()).pathname).toBe('/about/');

    await ctx.close();
  });

  test('vertical swipe does not navigate', async ({ browser }) => {
    const ctx = await mobileCtx(browser);
    const page = await ctx.newPage();
    await blockLiveReload(page);

    await page.goto('/about/');
    await page.waitForLoadState('domcontentloaded');

    // Y changes by 200px while X barely moves — vertical gesture
    await page.evaluate(() => {
      function mkTouch(x: number, y: number): Touch {
        return new Touch({ identifier: 1, target: document.body, clientX: x, clientY: y });
      }
      function fire(type: string, x: number, y: number) {
        const t = mkTouch(x, y);
        window.dispatchEvent(new TouchEvent(type, {
          touches: type === 'touchend' ? [] : [t],
          changedTouches: [t],
          cancelable: true,
          bubbles: true,
        }));
      }
      fire('touchstart', 195, 200);
      fire('touchmove',  197, 350);   // +2px X, +150px Y — vertical wins axis lock
      fire('touchmove',  198, 500);
      fire('touchend',   198, 600);
    });

    await page.waitForTimeout(400);
    expect(new URL(page.url()).pathname).toBe('/about/');

    await ctx.close();
  });
});
