#!/usr/bin/env node
// Dev server: Node stdlib http + chokidar watcher + SSE live-reload.
// On any watched file change, rebuilds and broadcasts `event: reload` to clients.
// HTML responses are rewritten to inject the live-reload client.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import { build } from "./build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 3100);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

const LIVERELOAD_CLIENT = `(() => {
  const es = new EventSource("/__events");
  es.addEventListener("reload", () => location.reload());
  es.onerror = () => { /* reconnect handled by the browser */ };
})();`;

const LIVERELOAD_SNIPPET = `<script src="/__livereload.js"></script>`;

const sseClients = new Set();

function broadcastReload() {
  for (const res of sseClients) {
    try {
      res.write(`event: reload\ndata: ${Date.now()}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const safe = path
    .normalize(decoded)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^\/+/, "");
  const candidates = [
    path.join(DIST, safe),
    path.join(DIST, safe, "index.html"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function handle(req, res) {
  if (req.url === "/__events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(":ok\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }
  if (req.url === "/__livereload.js") {
    res.writeHead(200, { "content-type": MIME[".js"] });
    res.end(LIVERELOAD_CLIENT);
    return;
  }

  const file = resolveFile(req.url);
  if (!file) {
    res.writeHead(404, { "content-type": MIME[".html"] });
    res.end("<h1>404</h1>");
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";

  if (ext === ".html") {
    let html = fs.readFileSync(file, "utf8");
    html = html.includes("</body>")
      ? html.replace("</body>", `${LIVERELOAD_SNIPPET}\n</body>`)
      : html + LIVERELOAD_SNIPPET;
    res.writeHead(200, { "content-type": type });
    res.end(html);
    return;
  }

  res.writeHead(200, { "content-type": type });
  fs.createReadStream(file).pipe(res);
}

async function rebuild(label) {
  const t0 = Date.now();
  try {
    await build();
    console.log(`[dev] rebuild (${label}) ${Date.now() - t0}ms`);
    broadcastReload();
  } catch (err) {
    console.error(`[dev] build failed:`, err.message);
  }
}

await rebuild("initial");

const watcher = chokidar.watch(
  [
    path.join(ROOT, "content"),
    path.join(ROOT, "static"),
    path.join(ROOT, "site/templates"),
    path.join(ROOT, "site/partials"),
    path.join(ROOT, "site/assets"),
    path.join(ROOT, "site/lib"),
    path.join(ROOT, "site/build.mjs"),
  ],
  { ignoreInitial: true, ignored: /(^|[/\\])(\.DS_Store|\.hugo_build\.lock)$/ }
);
watcher.on("all", (event, file) => rebuild(`${event} ${path.relative(ROOT, file)}`));

const server = http.createServer(handle);
server.listen(PORT, () => {
  console.log(`[dev] http://localhost:${PORT} (watching for changes)`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n[dev] ${sig} — shutting down`);
    watcher.close();
    server.close();
    process.exit(0);
  });
}
