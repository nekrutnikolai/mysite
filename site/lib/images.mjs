// Iteration 5A: sharp + exifr pipeline with on-disk manifest cache.
// Processes each gallery album's *.jpeg files into a 300h thumb + 1500w
// medium + copied original, extracts EXIF for the template, and caches by
// srcMtime + srcSize so incremental rebuilds are near-instant.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import exifr from "exifr";
import {
  buildWatermarkSvg,
  watermarkConfigHash,
  watermarkExifMeta,
} from "./watermark.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CACHE_PATH = path.resolve(__dirname, "..", "cache", "images.json");

const CONCURRENCY = 8;
// When set, originalUrl returned from processImage points at R2 instead of
// dist/. Falls back to the local /gallery/<album>/originals/ path used during
// local dev. Strip a trailing slash so the URL join is clean.
const R2_PUBLIC_BASE = (process.env.R2_PUBLIC_BASE || "").replace(/\/$/, "");
const WM_HASH = watermarkConfigHash();
// When originals are served from R2, the build doesn't need to produce the
// q95 4:4:4 watermarked original on every run — that's the slowest step (~5×
// build time on cold rebuilds). Set BUILD_ORIGINALS=1 right before
// `npm run upload-originals` to bake fresh originals into dist/ for upload;
// every other run skips it.
const SKIP_ORIGINALS = !!R2_PUBLIC_BASE && process.env.BUILD_ORIGINALS !== "1";

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveManifest(manifest) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  const tmp = CACHE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmp, CACHE_PATH);
}

// Format EXIF values the way the template wants them.
function formatFNumber(v) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  return `f/${v.toFixed(1)}`;
}
function formatExposure(v) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  if (v < 1) return `1/${Math.round(1 / v)}`;
  return `${v}s`;
}
function formatFocal(v) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  return `${Math.round(v)}mm`;
}
function formatDate(v) {
  if (v instanceof Date && isFinite(+v)) return v.toISOString();
  if (typeof v === "string" && v) return v;
  return null;
}

async function readExif(srcPath) {
  let raw = null;
  try {
    raw = await exifr.parse(srcPath, {
      tiff: true, ifd0: true, exif: true,
      gps: false, xmp: false, iptc: false, icc: false,
    });
  } catch {}
  raw = raw || {};
  return {
    make: raw.Make || null,
    model: raw.Model || null,
    lens: raw.LensModel || raw.Lens || null,
    focalLength: formatFocal(raw.FocalLength),
    fNumber: formatFNumber(raw.FNumber),
    exposureTime: formatExposure(raw.ExposureTime),
    iso: typeof raw.ISO === "number" ? raw.ISO : (raw.ISO ? Number(raw.ISO) || null : null),
    dateTimeOriginal: formatDate(raw.DateTimeOriginal),
  };
}

function widthHintFor(aspect) {
  if (aspect > 1.3) return "wide";
  if (aspect < 0.8) return "tall";
  return "";
}

async function processImage(srcPath, distAlbumDir, albumUrl, cache) {
  const stem = path.basename(srcPath, path.extname(srcPath));
  const ext = path.extname(srcPath); // ".jpeg"
  const st = fs.statSync(srcPath);
  const srcMtime = st.mtimeMs;
  const srcSize = st.size;

  const thumbFile = path.join(distAlbumDir, "img", `${stem}-300.jpg`);
  const mediumFile = path.join(distAlbumDir, "img", `${stem}-1500.jpg`);
  const originalFile = path.join(distAlbumDir, "originals", `${stem}${ext}`);

  fs.mkdirSync(path.dirname(thumbFile), { recursive: true });
  if (!SKIP_ORIGINALS) {
    fs.mkdirSync(path.dirname(originalFile), { recursive: true });
  }

  const cached = cache[srcPath];
  const outputsExist =
    cached &&
    fs.existsSync(thumbFile) &&
    fs.existsSync(mediumFile) &&
    (SKIP_ORIGINALS || fs.existsSync(originalFile));

  let entry;
  if (
    cached &&
    cached.srcMtime === srcMtime &&
    cached.srcSize === srcSize &&
    cached.wmHash === WM_HASH &&
    outputsExist
  ) {
    entry = cached;
  } else {
    const input = sharp(srcPath, { failOn: "none" });
    const meta = await input.metadata();
    const srcW = meta.width || 0;
    const srcH = meta.height || 0;
    // EXIF orientation 5–8 swap dimensions after .rotate() bakes orientation.
    const rotated = (meta.orientation || 1) >= 5;
    const outW = rotated ? srcH : srcW;
    const outH = rotated ? srcW : srcH;

    const previewW = Math.min(1500, outW);
    const previewH = outW ? Math.round(previewW * (outH / outW)) : 0;
    const previewSvg = buildWatermarkSvg(previewW, previewH);
    const exifMeta = watermarkExifMeta();

    const tasks = [
      // Thumbnail: clean pixels, EXIF copyright only.
      sharp(srcPath, { failOn: "none" })
        .rotate()
        .resize({ height: 300 })
        .withMetadata(exifMeta)
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(thumbFile),
      // Preview: watermark + EXIF. withoutEnlargement keeps the raster
      // dimensions in lockstep with the SVG canvas for sub-1500w sources.
      sharp(srcPath, { failOn: "none" })
        .rotate()
        .resize({ width: 1500, withoutEnlargement: true })
        .composite([{ input: previewSvg, top: 0, left: 0 }])
        .withMetadata(exifMeta)
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(mediumFile),
    ];
    if (!SKIP_ORIGINALS) {
      // Original: was fs.copyFile — now sharp encode at q95 4:4:4 with
      // watermark + EXIF baked in. Loses byte-for-byte fidelity vs source
      // (pristine masters remain in content/), but is the only way to bake
      // the visible mark + copyright into the served original. Run only
      // when BUILD_ORIGINALS=1 (or no R2 configured) since this dominates
      // build time and the deployed site loads originals from R2.
      const originalSvg = buildWatermarkSvg(outW, outH);
      tasks.push(
        sharp(srcPath, { failOn: "none" })
          .rotate()
          .composite([{ input: originalSvg, top: 0, left: 0 }])
          .withMetadata(exifMeta)
          .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4" })
          .toFile(originalFile),
      );
    }
    const [thumbInfo] = await Promise.all(tasks);

    const exif = await readExif(srcPath);

    entry = {
      srcMtime,
      srcSize,
      wmHash: WM_HASH,
      outputs: {
        thumb: thumbFile,
        preview: mediumFile,
        original: SKIP_ORIGINALS ? null : originalFile,
      },
      dimensions: {
        srcW,
        srcH,
        thumbW: thumbInfo.width,
        thumbH: thumbInfo.height,
      },
      exif,
    };
    cache[srcPath] = entry;
  }

  const { srcW, srcH, thumbW, thumbH } = entry.dimensions;
  const aspect = srcH ? srcW / srcH : 1;

  return {
    stem,
    srcPath,
    originalUrl: R2_PUBLIC_BASE
      ? `${R2_PUBLIC_BASE}${albumUrl}/${stem}${ext}`
      : `${albumUrl}/originals/${stem}${ext}`,
    thumbUrl: `${albumUrl}/img/${stem}-300.jpg`,
    previewUrl: `${albumUrl}/img/${stem}-1500.jpg`,
    srcW,
    srcH,
    thumbW,
    thumbH,
    aspect,
    widthHint: widthHintFor(aspect),
    exif: entry.exif,
  };
}

// Bounded-parallel map with a tiny semaphore so sharp doesn't spawn 183
// worker processes at once.
async function parallelMap(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function processAlbum(albumName, srcImagesDir, distAlbumDir) {
  if (!fs.existsSync(srcImagesDir)) return [];
  const albumUrl = `/gallery/${albumName}`;

  const files = fs
    .readdirSync(srcImagesDir)
    .filter((n) => n.toLowerCase().endsWith(".jpeg"))
    .sort() // ASCII ascending, matches Hugo shortcode sortOrder="asc"
    .map((n) => path.join(srcImagesDir, n));

  const cache = loadManifest();
  const records = await parallelMap(files, CONCURRENCY, (srcPath) =>
    processImage(srcPath, distAlbumDir, albumUrl, cache)
  );
  saveManifest(cache);

  return records;
}
