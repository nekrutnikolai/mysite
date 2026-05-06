import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { blockLiveReload } from "./helpers/dev-server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// Pixelation regression suite for the lightbox zoom path.
//
// Background: the original implementation set imgEl.style.width/height to
// the fit-to-viewport size (~800–900px) and zoomed via CSS `transform: scale()`.
// That makes the browser rasterize the image into a layer at the small size
// then GPU-upscale the layer for paint — producing bilinear blur even after
// the 24 MP master is hot-swapped into imgEl.src. The fix is to drive zoom
// by mutating CSS width/height (so the browser rasterizes at the requested
// resolution from the full-res bitmap) and use transform only for translate.
//
// These tests assert both the implementation invariant and the visible result.

// Joshua-tree image #0: frame-wide cactus spines, no significant out-of-focus
// regions. Picked deliberately so any 300×300 crop has meaningful gradient
// information — important for the Laplacian variance sharpness signal, since a
// macro shot with shallow DOF can have low local variance even when rendered
// pixel-perfect.
const GALLERY = "/gallery/joshua-tree/";
const TARGET_INDEX = 0;

async function openAndWaitForLayout(page: Page) {
  await page.goto(GALLERY);
  await page.waitForLoadState("networkidle");

  await page.locator(".gallery-trigger").nth(TARGET_INDEX).click();

  const dialog = page.locator("dialog.lightbox");
  await expect(dialog).toBeVisible();

  // Wait for layoutImage() (preview load) to set non-zero CSS width.
  await page.waitForFunction(() => {
    const el = document.querySelector(".lightbox-img") as HTMLImageElement | null;
    if (!el) return false;
    const w = parseFloat(el.style.width || "0");
    return el.naturalWidth > 0 && w > 0;
  });
  return dialog;
}

async function rectW(page: Page) {
  return await page.evaluate(() => {
    const el = document.querySelector(".lightbox-img") as HTMLImageElement | null;
    return el ? el.getBoundingClientRect().width : 0;
  });
}

// Wait for the next two animation frames so a queued applyTransform has
// landed in the box model. Use after triggering zoom via keyboard/click.
async function waitTwoFrames(page: Page) {
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

async function waitForRectGreater(page: Page, threshold: number) {
  await page.waitForFunction(
    (t) => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement | null;
      return el ? el.getBoundingClientRect().width > t : false;
    },
    threshold,
    { timeout: 2000 },
  );
}

async function waitForRectNear(page: Page, target: number, tolerance = 2) {
  await page.waitForFunction(
    ({ t, tol }) => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement | null;
      return el ? Math.abs(el.getBoundingClientRect().width - t) < tol : false;
    },
    { t: target, tol: tolerance },
    { timeout: 2000 },
  );
}

async function zoomTo3x(page: Page) {
  // 1.5^3 ≈ 3.375x; zoomBy targets stage center so the same source point stays under the
  // crosshair the whole time.
  const w0 = await rectW(page);
  await page.keyboard.press("+");
  await waitForRectGreater(page, w0 * 1.4);
  await page.keyboard.press("+");
  await waitForRectGreater(page, w0 * 2.0);
  await page.keyboard.press("+");
  await waitForRectGreater(page, w0 * 3.0);

  // Wait for the original-resolution swap (data-full URL) to land in src.
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement | null;
      if (!el) return false;
      return /\/originals\//.test(el.src) || /r2\.(dev|cloudflarestorage)/.test(el.src);
    },
    null,
    { timeout: 5000 },
  );
  // One extra frame so the post-swap repaint has settled.
  await waitTwoFrames(page);
}

// Compute Laplacian variance of a PNG buffer's grayscale channel.
// Higher = more high-frequency detail = sharper image.
// Bilinearly upscaled blur produces low Laplacian variance because the blur
// kernel filters out the very frequencies the Laplacian responds to.
async function laplacianVariance(pngBuf: Buffer): Promise<number> {
  const { data, info } = await sharp(pngBuf)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v =
        -4 * data[i] + data[i - 1] + data[i + 1] + data[i - w] + data[i + w];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

test.describe("lightbox zoom: pixel sharpness", () => {
  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  test("zoomed pixels match a re-rasterization of the master (not a GPU upscale)", async ({
    page,
  }) => {
    // Direct ground-truth comparison: after zooming, take a screenshot of a
    // small stage region, then independently re-render that region by cropping
    // the master JPEG on disk and downsampling to the same dimensions. The
    // difference between the two is the rendering noise.
    //
    // With the fix (CSS width/height drives rasterization), the browser samples
    // directly from the master at the requested display size — close match.
    //
    // With the bug (transform: scale on a fit-to-viewport sized layer), the
    // browser rasterizes the master once at ~864 px wide and bilinearly stretches
    // that to ~2916 px. Sharp's lanczos downsample of the master at 200 px is a
    // very different signal — diff is large.
    await openAndWaitForLayout(page);
    await zoomTo3x(page);

    const state = await page.evaluate(() => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement;
      const stage = document.querySelector(".lightbox-stage") as HTMLElement;
      const r = stage.getBoundingClientRect();
      const m = (el.style.transform || "").match(/translate\(\s*(-?[\d.]+)px[,\s]+(-?[\d.]+)px\s*\)/);
      return {
        stageX: r.x,
        stageY: r.y,
        stageW: r.width,
        stageH: r.height,
        cssW: parseFloat(el.style.width || "0"),
        cssH: parseFloat(el.style.height || "0"),
        rectW: el.getBoundingClientRect().width,
        rectH: el.getBoundingClientRect().height,
        tx: m ? parseFloat(m[1]) : 0,
        ty: m ? parseFloat(m[2]) : 0,
        naturalW: el.naturalWidth,
        naturalH: el.naturalHeight,
        src: el.src,
      };
    });

    // The image's painted box covers (tx, ty)..(tx + rectW, ty + rectH) in
    // stage-local coords. Sample a 200×200 region centred in the stage —
    // safely away from the watermark in the bottom-right of the master.
    const cropSize = 200;
    const stageCropX = Math.round((state.stageW - cropSize) / 2);
    const stageCropY = Math.round((state.stageH - cropSize) / 2);

    const screenshotBuf = await page.screenshot({
      clip: {
        x: state.stageX + stageCropX,
        y: state.stageY + stageCropY,
        width: cropSize,
        height: cropSize,
      },
    });

    // Map stage coords → source-image coords using the displayed rect.
    const dispW = state.rectW;
    const dispH = state.rectH;
    const srcX = Math.max(0, Math.floor((stageCropX - state.tx) / dispW * state.naturalW));
    const srcY = Math.max(0, Math.floor((stageCropY - state.ty) / dispH * state.naturalH));
    const srcW = Math.min(
      state.naturalW - srcX,
      Math.ceil((cropSize / dispW) * state.naturalW),
    );
    const srcH = Math.min(
      state.naturalH - srcY,
      Math.ceil((cropSize / dispH) * state.naturalH),
    );

    // Resolve src URL (local /gallery/.../originals/...) to a dist file path.
    const srcUrl = new URL(state.src);
    const masterPath = path.join(REPO_ROOT, "dist", srcUrl.pathname);
    const groundTruthBuf = await sharp(masterPath)
      .extract({ left: srcX, top: srcY, width: srcW, height: srcH })
      .resize({ width: cropSize, height: cropSize, fit: "fill", kernel: "lanczos3" })
      .png()
      .toBuffer();

    const [shot, truth] = await Promise.all([
      sharp(screenshotBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(groundTruthBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    let totalDiff = 0;
    const len = Math.min(shot.data.length, truth.data.length);
    for (let i = 0; i < len; i++) {
      totalDiff += Math.abs(shot.data[i] - truth.data[i]);
    }
    const meanChannelDiff = totalDiff / len;
    console.log(
      `[sharpness] mean per-channel diff vs master downsample: ${meanChannelDiff.toFixed(2)} (lower = sharper). srcRect=${srcX},${srcY} ${srcW}×${srcH}. naturalW=${state.naturalW}.`,
    );
    // Empirically:
    //   Fixed (CSS width drives raster):  ~5–10 (basically JPEG quantisation + screenshot encode)
    //   Buggy (transform: scale GPU-up):  ~25+ (bilinear stretch artefacts)
    // Threshold 18 is well-separated from both regimes on Chromium headless.
    expect(meanChannelDiff).toBeLessThan(18);
  });

  test("imgEl rendered size matches its CSS size at 3x (no GPU-only scale)", async ({
    page,
  }) => {
    await openAndWaitForLayout(page);
    await zoomTo3x(page);

    // Implementation invariant: the rendered (post-everything) size should
    // equal the element's CSS size. CSS-transform-scale violates this — the
    // CSS width stays at natW while getBoundingClientRect() reports natW*scale.
    const result = await page.evaluate(() => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement;
      const rect = el.getBoundingClientRect();
      const cssW = parseFloat(el.style.width || "0");
      const cssH = parseFloat(el.style.height || "0");
      return { rectW: rect.width, rectH: rect.height, cssW, cssH, transform: el.style.transform };
    });
    // Allow 1px rounding wiggle.
    expect(Math.abs(result.rectW - result.cssW)).toBeLessThan(2);
    expect(Math.abs(result.rectH - result.cssH)).toBeLessThan(2);
    expect(result.transform).not.toMatch(/scale\(/);
  });

  test("zoom out via '0' returns to fit-to-viewport size", async ({ page }) => {
    await openAndWaitForLayout(page);
    const w1 = await rectW(page);
    await zoomTo3x(page);
    await page.keyboard.press("0");
    await waitForRectNear(page, w1, 2);

    const result = await page.evaluate(() => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement;
      return {
        cssW: parseFloat(el.style.width || "0"),
        rectW: el.getBoundingClientRect().width,
        zoomed: el.classList.contains("zoomed"),
      };
    });
    expect(result.zoomed).toBe(false);
    expect(Math.abs(result.rectW - result.cssW)).toBeLessThan(2);
    expect(Math.abs(result.rectW - w1)).toBeLessThan(2);
  });
});

test.describe("lightbox zoom: behavior regression", () => {
  test.beforeEach(async ({ page }) => {
    await blockLiveReload(page);
  });

  test("click on image cycles through zoom levels 1 → 2 → 3 → 1", async ({
    page,
  }) => {
    await openAndWaitForLayout(page);

    // Use stage-relative clicks rather than img-relative ones: when the image
    // is zoomed and translated past the viewport edge, img.click({position})
    // tries to land at a point that is off-screen and stalls. The stage stays
    // put and contains a guaranteed-clickable region (overflow:hidden clips
    // the img inside it).
    const stage = page.locator(".lightbox-stage");
    const sb = await stage.boundingBox();
    if (!sb) throw new Error("no stage box");
    const clickAt = { x: sb.x + 100, y: sb.y + 100 };

    const w1 = await rectW(page);

    await page.mouse.click(clickAt.x, clickAt.y);
    await waitForRectGreater(page, w1 * 1.5);
    const w2 = await rectW(page);
    expect(w2 / w1).toBeGreaterThan(1.8);
    expect(w2 / w1).toBeLessThan(2.2);

    await page.mouse.click(clickAt.x, clickAt.y);
    await waitForRectGreater(page, w2 + 5);
    const w3 = await rectW(page);
    expect(w3 / w1).toBeGreaterThan(2.8);
    expect(w3 / w1).toBeLessThan(3.2);

    await page.mouse.click(clickAt.x, clickAt.y);
    await waitForRectNear(page, w1, 2);
    const w4 = await rectW(page);
    expect(Math.abs(w4 - w1)).toBeLessThan(2);
  });

  test("pan via mouse drag while zoomed updates translate without changing zoom", async ({
    page,
  }) => {
    await openAndWaitForLayout(page);
    const w1 = await rectW(page);

    await page.keyboard.press("+");
    await waitForRectGreater(page, w1 * 1.4);
    await page.keyboard.press("+");
    await waitForRectGreater(page, w1 * 2.0);
    await waitTwoFrames(page);

    const before = await page.evaluate(() => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement;
      return { width: parseFloat(el.style.width), transform: el.style.transform };
    });

    // Drag 50px right.
    const stage = await page.locator(".lightbox-stage").boundingBox();
    if (!stage) throw new Error("no stage");
    const cx = stage.x + stage.width / 2;
    const cy = stage.y + stage.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy, { steps: 5 });
    await page.mouse.up();
    await waitTwoFrames(page);

    const after = await page.evaluate(() => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement;
      return { width: parseFloat(el.style.width), transform: el.style.transform };
    });
    // Width unchanged: pan only updates translate, not the zoom (CSS box stays
    // the same).
    expect(Math.abs(after.width - before.width)).toBeLessThan(2);
    // Transform changed: translation moved.
    expect(after.transform).not.toBe(before.transform);
  });

  test("minimap visible only when zoomed; rectangle present", async ({ page }) => {
    await openAndWaitForLayout(page);
    const minimap = page.locator(".lightbox-minimap");
    await expect(minimap).not.toHaveClass(/visible/);

    const w1 = await rectW(page);
    await page.keyboard.press("+");
    await waitForRectGreater(page, w1 * 1.4);
    await expect(minimap).toHaveClass(/visible/);

    const rect = await page.locator(".lightbox-minimap-rect").evaluate((el) => ({
      w: parseFloat((el as HTMLElement).style.width || "0"),
      h: parseFloat((el as HTMLElement).style.height || "0"),
    }));
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  });

  test("arrow-right navigation while zoomed resets zoom + loads next image", async ({
    page,
  }) => {
    await openAndWaitForLayout(page);
    const w1 = await rectW(page);
    await page.keyboard.press("+");
    await waitForRectGreater(page, w1 * 1.4);
    await page.keyboard.press("+");
    await waitForRectGreater(page, w1 * 2.0);

    const dialog = page.locator("dialog.lightbox");
    const initialIndex = await dialog.getAttribute("data-index");

    await page.keyboard.press("ArrowRight");

    await expect(async () => {
      const idx = await dialog.getAttribute("data-index");
      expect(idx).not.toBe(initialIndex);
    }).toPass({ timeout: 2000 });

    // After navigation, layout runs and zoom resets — wait for next image to be ready.
    await page.waitForFunction(() => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement | null;
      return !!el && el.naturalWidth > 0 && !el.classList.contains("zoomed");
    }, null, { timeout: 5000 });

    const result = await page.evaluate(() => {
      const el = document.querySelector(".lightbox-img") as HTMLImageElement;
      return { zoomed: el.classList.contains("zoomed") };
    });
    expect(result.zoomed).toBe(false);
  });
});
