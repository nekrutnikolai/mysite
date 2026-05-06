// Tiny .env loader — Node 20 doesn't auto-load .env files. Reads
// `<repo-root>/.env` if it exists and sets process.env for any keys that
// aren't already defined (so Netlify's pre-set env vars always win over
// a stray local .env). No-op when .env is absent.
//
// Import for side effects from any script that reads R2_* / SITE_URL
// before instantiating clients:
//
//     import "./load-env.mjs";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", "..", ".env");

if (fs.existsSync(ENV_PATH)) {
  const text = fs.readFileSync(ENV_PATH, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip optional surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}
