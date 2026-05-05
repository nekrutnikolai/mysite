// Tiny static-file http server used by build.mjs to give a headless browser
// a real http origin pointing at the just-built dist/. Listens on a random
// port (so concurrent builds don't collide), refuses path-traversal escapes,
// and falls back to index.html for directory URLs.

import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon"
};

export async function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const filePath = path.join(rootDir, urlPath);
    // Prevent path-traversal escape
    if (!filePath.startsWith(path.resolve(rootDir))) {
      res.writeHead(403); res.end("forbidden"); return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); res.end("not found"); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}
