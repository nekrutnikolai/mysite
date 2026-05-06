#!/usr/bin/env node
// Pull clean master images from R2 (the `clean/gallery/` prefix) into
// `content/gallery/<album>/images/`. Used by Netlify CI on every build (since
// originals are no longer in git) and by fresh local clones. Skips files
// whose local sha matches the bucket's metadata.
//
// Required env (load from .env or the shell):
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET             — defaults to "nnekrut-gallery"
//
// Usage: npm run download-originals

import "./load-env.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || "nnekrut-gallery";
const PREFIX = "clean/gallery/";

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
      Prefix: PREFIX,
      ContinuationToken: token,
    }));
    for (const o of res.Contents || []) items.push(o);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return items;
}

function localPathFor(key) {
  // key shape: "clean/gallery/<album>/<file>.jpeg"
  // → content/gallery/<album>/images/<file>.jpeg
  if (!key.startsWith(PREFIX)) return null;
  const rest = key.slice(PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  const album = rest.slice(0, slash);
  const file = rest.slice(slash + 1);
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
  console.log(`listing ${BUCKET}/${PREFIX}…`);
  const remote = await listAll();
  console.log(`${remote.length} remote objects, syncing to content/gallery/`);

  let downloaded = 0;
  let skipped = 0;
  let skippedKeys = 0;

  await workQueue(remote, CONCURRENCY, async (obj) => {
    const dest = localPathFor(obj.Key);
    if (!dest) { skippedKeys++; return; }

    if (fs.existsSync(dest) && fs.statSync(dest).size === obj.Size) {
      const localHash = await sha256(dest);
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
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
