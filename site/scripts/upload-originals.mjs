#!/usr/bin/env node
// Sync local gallery originals to a Cloudflare R2 bucket using two prefixes:
//
//   clean/gallery/<album>/<file>   — pristine masters from content/
//   gallery/<album>/<file>         — watermarked + EXIF-baked from dist/
//
// The bucket's public URL serves the watermarked tree as the lightbox's
// data-full target; the clean tree is private-ish (still publicly readable
// since the bucket is) and acts as the source-of-truth for thumb/medium
// regeneration on Netlify and for fresh local clones.
//
// SHA-256 metadata is set on each object; re-runs skip files whose remote
// hash matches the local one. --force re-uploads everything. --dry-run
// reports what would change without uploading.
//
// Required env (load from .env or the shell):
//   R2_ACCOUNT_ID         — Cloudflare account id (32-char hex)
//   R2_ACCESS_KEY_ID      — R2 API token access key
//   R2_SECRET_ACCESS_KEY  — R2 API token secret
//   R2_BUCKET             — bucket name (defaults to "nnekrut-gallery")
//
// Usage: npm run upload-originals [-- --dry-run] [-- --force]
//        (npm script runs `BUILD_ORIGINALS=1 npm run build` first.)

import "./load-env.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || "nnekrut-gallery";

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error("error: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY must all be set");
  process.exit(1);
}

const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const CONCURRENCY = 6;

const s3 = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(filePath).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
}

// Walk a directory shape `<root>/<album>/<leafSubdir>/*.jpeg` and produce
// upload items keyed under `<keyPrefix>/<album>/<file>`.
function listImages(rootDir, leafSubdir, keyPrefix) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  for (const album of fs.readdirSync(rootDir)) {
    const albumDir = path.join(rootDir, album);
    if (!fs.statSync(albumDir, { throwIfNoEntry: false })?.isDirectory()) continue;
    const leafDir = path.join(albumDir, leafSubdir);
    if (!fs.statSync(leafDir, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const file of fs.readdirSync(leafDir)) {
      const lower = file.toLowerCase();
      if (!lower.endsWith(".jpeg") && !lower.endsWith(".jpg")) continue;
      out.push({
        srcPath: path.join(leafDir, file),
        key: `${keyPrefix}/${album}/${file}`,
        size: fs.statSync(path.join(leafDir, file)).size,
      });
    }
  }
  return out;
}

async function remoteSha(key) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return head?.Metadata?.sha256 || null;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound") return null;
    throw e;
  }
}

async function upload(item, hash) {
  const body = fs.createReadStream(item.srcPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: item.key,
    Body: body,
    ContentType: "image/jpeg",
    CacheControl: "public, max-age=31536000, immutable",
    Metadata: { sha256: hash },
  }));
}

async function workQueue(items, limit, fn) {
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function syncTree(label, items) {
  if (items.length === 0) {
    console.log(`${label}: no local files found, skipping`);
    return { uploaded: 0, skipped: 0, bytes: 0 };
  }
  console.log(`\n${label}: ${items.length} files`);

  let uploaded = 0;
  let skipped = 0;
  let bytes = 0;

  await workQueue(items, CONCURRENCY, async (item) => {
    const localHash = await sha256(item.srcPath);
    const remoteHash = FORCE ? null : await remoteSha(item.key);
    if (remoteHash === localHash) {
      skipped++;
      return;
    }
    if (DRY_RUN) {
      console.log(`  would upload ${item.key} (${(item.size / 1024).toFixed(0)} KB)`);
      uploaded++;
      bytes += item.size;
      return;
    }
    await upload(item, localHash);
    console.log(`  uploaded ${item.key} (${(item.size / 1024).toFixed(0)} KB)`);
    uploaded++;
    bytes += item.size;
  });

  return { uploaded, skipped, bytes };
}

async function main() {
  console.log(`bucket = ${BUCKET}, endpoint = ${ENDPOINT}`);
  if (DRY_RUN) console.log("(dry run — no uploads will happen)");

  // Clean masters from content/ → clean/ prefix. These are the bytes the
  // build needs to (re)generate thumbs/mediums/originals from.
  const cleanItems = listImages(
    path.join(ROOT, "content", "gallery"),
    "images",
    "clean/gallery",
  );
  // Watermarked from dist/ → gallery/ prefix. These are the bytes the
  // public lightbox links to via data-full.
  const watermarkedItems = listImages(
    path.join(ROOT, "dist", "gallery"),
    "originals",
    "gallery",
  );

  const cleanResult = await syncTree("clean masters → clean/gallery/", cleanItems);
  const wmResult = await syncTree("watermarked → gallery/", watermarkedItems);

  const totalUp = cleanResult.uploaded + wmResult.uploaded;
  const totalSkip = cleanResult.skipped + wmResult.skipped;
  const totalMb = ((cleanResult.bytes + wmResult.bytes) / 1024 / 1024).toFixed(1);
  console.log(`\n${DRY_RUN ? "would " : ""}upload ${totalUp}, skip ${totalSkip}, total ${totalMb} MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
