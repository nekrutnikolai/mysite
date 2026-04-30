#!/usr/bin/env node
// Pull every object from the gallery R2 bucket into
// content/gallery/<album>/images/. Used by Netlify CI (since originals are
// no longer in git) and by fresh local clones. Skips files that already
// match by sha256 metadata to keep re-runs cheap.
//
// Required env (load from .env or the shell):
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET             — defaults to "nnekrut-gallery"
//
// Usage: npm run download-originals

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || "nnekrut-gallery";

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error("error: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY must all be set");
  process.exit(1);
}

const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const CONCURRENCY = 8;

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

async function listAll() {
  const items = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: token,
    }));
    for (const o of res.Contents || []) items.push(o);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return items;
}

function localPathFor(key) {
  // key shape: "gallery/<album>/<file>.jpeg" → content/gallery/<album>/images/<file>.jpeg
  const parts = key.split("/");
  if (parts.length < 3 || parts[0] !== "gallery") return null;
  const album = parts[1];
  const file = parts.slice(2).join("/");
  return path.join(ROOT, "content", "gallery", album, "images", file);
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
  console.log(`listing ${BUCKET}…`);
  const remote = await listAll();
  console.log(`${remote.length} remote objects, syncing to content/gallery/`);

  let downloaded = 0;
  let skipped = 0;
  let skippedKeys = 0;

  await workQueue(remote, CONCURRENCY, async (obj) => {
    const dest = localPathFor(obj.Key);
    if (!dest) { skippedKeys++; return; }

    if (fs.existsSync(dest) && fs.statSync(dest).size === obj.Size) {
      // Cheap pre-check by size; fall through to sha verify only if size matches.
      const localHash = await sha256(dest);
      const head = await s3.send(new (await import("@aws-sdk/client-s3")).HeadObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
      const remoteHash = head?.Metadata?.sha256;
      if (remoteHash && remoteHash === localHash) {
        skipped++;
        return;
      }
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
    const tmp = dest + ".part";
    await pipeline(res.Body, fs.createWriteStream(tmp));
    fs.renameSync(tmp, dest);
    console.log(`downloaded ${obj.Key}`);
    downloaded++;
  });

  console.log(`\ndownloaded ${downloaded}, skipped (already in sync) ${skipped}, skipped (unrecognized key) ${skippedKeys}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
