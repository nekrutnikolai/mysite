// Generic recursive directory walker. Skips noise files that shouldn't ship
// to dist (macOS metadata + Hugo's lockfile). Synchronous fs reads keep it
// trivially correct; the caller can do async work inside `onFile`.

import fs from "node:fs";
import path from "node:path";

const SKIP = new Set([".DS_Store", ".hugo_build.lock"]);

// walkSync(rootDir, onFile, onDir?)
//   onFile(absSrc, relPath, dirent): called for each regular file. May return
//     a Promise (the walker is synchronous but callers can await callbacks
//     externally — see buildImgSizeMap which awaits inside its onFile).
//   onDir(absSrc, relPath, dirent): optional, called for each directory
//     before its children are visited. Useful for mirroring the source tree
//     into a destination.
export function walkSync(rootDir, onFile, onDir = null) {
  if (!fs.existsSync(rootDir)) return;
  const visit = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const childRel = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (onDir) onDir(abs, childRel, entry);
        visit(abs, childRel);
      } else if (entry.isFile()) {
        onFile(abs, childRel, entry);
      }
    }
  };
  visit(rootDir, "");
}
