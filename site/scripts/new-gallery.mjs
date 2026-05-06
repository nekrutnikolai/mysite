#!/usr/bin/env node
// Scaffold a new gallery from a folder of exported JPEGs.
//
//   npm run new-gallery -- ~/Pictures/maine-trip
//   npm run new-gallery -- ~/Pictures/maine-trip --name maine-trip --title "Maine Trip"
//
// What it does:
//   1. Reads JPEGs from the source folder (refuses HEIC — convert via Photos
//      export options first).
//   2. Derives slug from --name or the folder basename; refuses to overwrite
//      content/gallery/<slug>/ unless --replace is passed.
//   3. Pulls EXIF (DateTimeOriginal, GPSLatitude, GPSLongitude) per file.
//   4. Copies originals into content/gallery/<slug>/images/ (preserving
//      original filenames).
//   5. Writes content/gallery/<slug>/index.md with frontmatter populated
//      from EXIF: title, date (newest), dateRange (if span > 1 day),
//      location (lat,lng of first image with GPS), draft: true.
//   6. Prints a summary so you can sanity-check before reviewing the
//      generated index.md and running `npm run upload-originals`.
//
// CLI flags:
//   --name <slug>      Override slug derived from folder basename
//   --title <text>     Override title (default: titlecased folder basename)
//   --date <iso>       Override frontmatter date (default: newest EXIF
//                      DateTimeOriginal, falls back to folder mtime)
//   --replace          Wipe and rebuild if content/gallery/<slug>/ exists
//
// After this runs:
//   - Edit content/gallery/<slug>/index.md (description, friendlier
//     location string, flip draft: false when ready)
//   - `npm run dev` to preview at /gallery/<slug>/
//   - `npm run upload-originals` to push to R2

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import exifr from "exifr";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CONTENT_GALLERY = path.join(ROOT, "content", "gallery");

// ─────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--replace") args.replace = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("--")) {
      args[a.slice(2)] = argv[++i];
    } else {
      args._.push(a);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run new-gallery -- <folder> [options]

Scaffold a new gallery from a folder of exported JPEGs.

Options:
  --name <slug>     Slug to use (default: derived from folder basename)
  --title <text>    Display title (default: titlecased folder basename)
  --date <iso>      Frontmatter date (default: newest EXIF DateTimeOriginal)
  --replace         Wipe content/gallery/<slug>/ if it exists
  -h, --help        Show this help

Examples:
  npm run new-gallery -- ~/Pictures/maine-trip
  npm run new-gallery -- ~/Pictures/SCRATCH --name fall-foliage --title "Fall Foliage 2024"`);
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

// Match the same slugify semantics the rest of the build uses (Hugo-compat):
// lowercase, spaces → hyphen, strip non-[a-z0-9-]. Imported from routes.mjs
// for parity with how the URL gets generated downstream.
import { slugify } from "../lib/routes.mjs";

function titleCase(s) {
  return s
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Format Date → YYYY-MM-DD; trims to a date for frontmatter.
function fmtIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

function fmtHumanDate(d) {
  // "Aug 14"
  return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function fmtDateRange(start, end) {
  // Same year, e.g. "Aug 10–18, 2024"; cross-year falls back to full both sides.
  const startMonth = start.getUTCMonth();
  const endMonth = end.getUTCMonth();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear !== endYear) {
    return `${fmtHumanDate(start)}, ${startYear} – ${fmtHumanDate(end)}, ${endYear}`;
  }
  if (startMonth === endMonth) {
    return `${start.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${start.getUTCDate()}–${end.getUTCDate()}, ${startYear}`;
  }
  return `${fmtHumanDate(start)} – ${fmtHumanDate(end)}, ${startYear}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const sourceDir = path.resolve(args._[0]);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    console.error(`✗ source folder not found: ${sourceDir}`);
    process.exit(1);
  }

  // Discover image files
  const allFiles = fs.readdirSync(sourceDir).filter((f) => !f.startsWith("."));
  const heic = allFiles.filter((f) => /\.(heic|heif)$/i.test(f));
  const jpegs = allFiles.filter((f) => /\.(jpe?g)$/i.test(f));

  if (heic.length > 0) {
    console.error(
      `✗ found ${heic.length} HEIC file(s) — re-export from Photos as JPEG.\n` +
        `  Photos.app → File → Export → Export Photos → Photo Kind: JPEG.`
    );
    process.exit(1);
  }
  if (jpegs.length === 0) {
    console.error(`✗ no JPEG files in ${sourceDir}`);
    process.exit(1);
  }

  const folderBase = path.basename(sourceDir);
  const slug = args.name ? slugify(args.name) : slugify(folderBase);
  const title = args.title || titleCase(args.name || folderBase);
  const albumDir = path.join(CONTENT_GALLERY, slug);
  const imagesDir = path.join(albumDir, "images");

  // Refuse to overwrite unless --replace
  if (fs.existsSync(albumDir)) {
    if (!args.replace) {
      console.error(
        `✗ album already exists at ${path.relative(ROOT, albumDir)}\n` +
          `  Remove it first, or pass --replace to wipe and rebuild.`
      );
      process.exit(1);
    }
    console.log(`! --replace set; removing existing ${path.relative(ROOT, albumDir)}`);
    fs.rmSync(albumDir, { recursive: true, force: true });
  }

  // Pull EXIF for date + GPS aggregation (don't crash on bad files; just skip)
  const exifResults = [];
  for (const name of jpegs) {
    const filePath = path.join(sourceDir, name);
    try {
      // Don't `pick` here — exifr filters tags BEFORE running its GPS-to-
      // latitude/longitude conversion, so a `pick` of `latitude`/`longitude`
      // strips the raw GPSLatitude/GPSLongitude tags it needs to compute them.
      // Parse everything and read just what we need from the result.
      const e = await exifr.parse(filePath, { gps: true });
      exifResults.push({
        name,
        filePath,
        date: e?.DateTimeOriginal ? new Date(e.DateTimeOriginal) : null,
        lat: typeof e?.latitude === "number" ? e.latitude : null,
        lng: typeof e?.longitude === "number" ? e.longitude : null,
      });
    } catch {
      exifResults.push({ name, filePath, date: null, lat: null, lng: null });
    }
  }

  const dates = exifResults.map((r) => r.date).filter(Boolean).sort((a, b) => a - b);
  const oldest = dates[0] || null;
  const newest = dates[dates.length - 1] || null;

  // Frontmatter date — explicit override, else newest EXIF date, else folder mtime
  const frontmatterDate = args.date
    ? args.date
    : newest
    ? fmtIsoDate(newest)
    : fmtIsoDate(fs.statSync(sourceDir).mtime);

  // Date range when photos span > 1 day
  let dateRange = null;
  if (oldest && newest && newest - oldest > 24 * 60 * 60 * 1000) {
    dateRange = fmtDateRange(oldest, newest);
  }

  // Location data — collect images with GPS. Average coords go in
  // frontmatter as a structured `coords: { lat, lng }` object (parses
  // natively as gray-matter, friendly for templates + future map viz).
  // Per-image coords go in a sidecar `coords.json` so future per-photo
  // visualizations can plot every shot without re-reading EXIF from R2.
  // The human-readable `location` string stays empty for the user to fill.
  const withGps = exifResults.filter((r) => r.lat !== null && r.lng !== null);
  let coords = null;
  let coordsSidecar = null;
  if (withGps.length > 0) {
    const avgLat = withGps.reduce((sum, r) => sum + r.lat, 0) / withGps.length;
    const avgLng = withGps.reduce((sum, r) => sum + r.lng, 0) / withGps.length;
    coords = { lat: Number(avgLat.toFixed(6)), lng: Number(avgLng.toFixed(6)) };
    coordsSidecar = {
      average: coords,
      points: exifResults
        .filter((r) => r.lat !== null && r.lng !== null)
        .map((r) => ({
          name: r.name,
          lat: Number(r.lat.toFixed(6)),
          lng: Number(r.lng.toFixed(6)),
          ...(r.date ? { date: r.date.toISOString() } : {}),
        })),
    };
  }

  // Write the gallery: copy images first, then index.md, then sidecar
  fs.mkdirSync(imagesDir, { recursive: true });
  for (const { name, filePath } of exifResults) {
    fs.copyFileSync(filePath, path.join(imagesDir, name));
  }

  const fm = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `date: ${frontmatterDate}`,
    "draft: true",
    'location: ""',
    coords ? `coords:\n  lat: ${coords.lat}\n  lng: ${coords.lng}` : null,
    dateRange ? `dateRange: ${JSON.stringify(dateRange)}` : null,
    'description: ""',
    "---",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  fs.writeFileSync(path.join(albumDir, "index.md"), fm);
  if (coordsSidecar) {
    fs.writeFileSync(
      path.join(albumDir, "coords.json"),
      JSON.stringify(coordsSidecar, null, 2) + "\n"
    );
  }

  // Print summary
  const rel = path.relative(ROOT, albumDir);
  console.log(`\n✓ scaffolded gallery at ${rel}`);
  console.log(`  ${jpegs.length} image${jpegs.length === 1 ? "" : "s"} copied`);
  if (oldest && newest) {
    console.log(`  date span: ${fmtIsoDate(oldest)} → ${fmtIsoDate(newest)}${dateRange ? `  (range: ${dateRange})` : ""}`);
  }
  if (withGps.length > 0) {
    console.log(`  GPS: ${withGps.length}/${jpegs.length} have coords; avg ${coords.lat}, ${coords.lng}`);
    console.log(`  → coords saved to frontmatter + content/gallery/${slug}/coords.json (per-image)`);
    // Show unique-ish coord clusters at 2-decimal precision so the user
    // can spot if photos came from very different places.
    const seen = new Set();
    for (const r of withGps) {
      const k = `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
      if (!seen.has(k)) seen.add(k);
    }
    if (seen.size > 1) {
      console.log(`  ${seen.size} distinct coord clusters detected (rounded to 2 decimals).`);
    }
  } else {
    console.log(`  no GPS data found; location frontmatter left blank`);
  }

  console.log("\n  next steps:");
  console.log(`    1. edit ${rel}/index.md (description, friendlier location, flip draft: false)`);
  console.log(`    2. npm run dev   # preview at /gallery/${slug}/`);
  console.log(`    3. npm run upload-originals   # push to R2 once happy`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
