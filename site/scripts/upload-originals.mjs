#!/usr/bin/env node
// Sync local gallery originals to a Cloudflare R2 bucket. Walks
// content/gallery/<album>/images/*.jpeg, hashes each file, compares against
// the existing bucket object's sha256 metadata, and uploads anything missing
// or changed. Idempotent.
//
// Required env (load from .env or the shell):
//   R2_ACCOUNT_ID         — Cloudflare account id (32-char hex)
//   R2_ACCESS_KEY_ID      — R2 API token access key
//   R2_SECRET_ACCESS_KEY  — R2 API token secret
//   R2_BUCKET             — bucket name (defaults to "nnekrut-gallery")
//
// Flags:
//   --dry-run             — list what would change; don't upload
//   --force               — re-upload everything regardless of hash match
//
// Usage: npm run upload-originals [-- --dry-run]

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

// Source-of-truth for upload is the build output's originals/ tree, since
// originals there are post-watermark + post-EXIF-baked. The build must have
// run before upload (npm run build).
function listLocalImages() {
  const out = [];
  const galleriesDir = path.join(ROOT, "dist", "gallery");
  if (!fs.existsSync(galleriesDir)) return out;
  for (const album of fs.readdirSync(galleriesDir)) {
    const albumDir = path.join(galleriesDir, album);
    if (!fs.statSync(albumDir, { throwIfNoEntry: false })?.isDirectory()) continue;
    const originalsDir = path.join(albumDir, "originals");
    if (!fs.statSync(originalsDir, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const file of fs.readdirSync(originalsDir)) {
      if (!file.toLowerCase().endsWith(".jpeg") && !file.toLowerCase().endsWith(".jpg")) continue;
      out.push({
        srcPath: path.join(originalsDir, file),
        key: `gallery/${album}/${file}`,
        size: fs.statSync(path.join(originalsDir, file)).size,
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

async function main() {
  const items = listLocalImages();
  console.log(`found ${items.length} local images, target bucket = ${BUCKET}, endpoint = ${ENDPOINT}`);
  if (DRY_RUN) console.log("(dry run — no uploads will happen)");

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
      console.log(`would upload ${item.key} (${(item.size / 1024).toFixed(0)} KB)`);
      uploaded++;
      bytes += item.size;
      return;
    }
    await upload(item, localHash);
    console.log(`uploaded ${item.key} (${(item.size / 1024).toFixed(0)} KB)`);
    uploaded++;
    bytes += item.size;
  });

  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(`\n${DRY_RUN ? "would " : ""}upload ${uploaded}, skip ${skipped}, total ${mb} MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
