// Iteration 5A: sharp + exifr pipeline with on-disk manifest cache.
// Processes each gallery album's *.jpeg files into a 300h thumb + 1500w
// medium + copied original, extracts EXIF for the template, and caches by
// srcMtime + srcSize so incremental rebuilds are near-instant.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import exifr from "exifr";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CACHE_PATH = path.resolve(__dirname, "..", "cache", "images.json");

const CONCURRENCY = 8;

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

export function clearImageCache() {
  try {
    fs.unlinkSync(CACHE_PATH);
  } catch {}
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
  fs.mkdirSync(path.dirname(originalFile), { recursive: true });

  const cached = cache[srcPath];
  const outputsExist =
    cached &&
    fs.existsSync(thumbFile) &&
    fs.existsSync(mediumFile) &&
    fs.existsSync(originalFile);

  let entry;
  if (cached && cached.srcMtime === srcMtime && cached.srcSize === srcSize && outputsExist) {
    entry = cached;
  } else {
    const input = sharp(srcPath, { failOn: "none" });
    const meta = await input.metadata();
    const srcW = meta.width || 0;
    const srcH = meta.height || 0;

    const [thumbInfo] = await Promise.all([
      sharp(srcPath, { failOn: "none" }).rotate().resize({ height: 300 }).jpeg({ quality: 85, mozjpeg: true }).toFile(thumbFile),
      sharp(srcPath, { failOn: "none" }).rotate().resize({ width: 1500 }).jpeg({ quality: 85, mozjpeg: true }).toFile(mediumFile),
    ]);

    fs.copyFileSync(srcPath, originalFile);

    const exif = await readExif(srcPath);

    entry = {
      srcMtime,
      srcSize,
      outputs: {
        thumb: thumbFile,
        preview: mediumFile,
        original: originalFile,
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
    originalUrl: `${albumUrl}/originals/${stem}${ext}`,
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
