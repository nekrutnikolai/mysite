// Walk content/, parse frontmatter, classify, and emit a deterministic
// content manifest. Iteration 2 consumes `post` entries; future iterations
// consume `page`, `gallery`, `gallery-standalone`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { postOutputPath, pageOutputPath, slugify } from "./routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(ROOT, "content");

function coerce(frontmatter) {
  const fm = { ...frontmatter };
  if (fm.tags == null) fm.tags = [];
  if (fm.images == null) fm.images = [];
  return fm;
}

function parseFile(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  return { frontmatter: coerce(data), body: content };
}

// Returns Date or null. gray-matter emits Date objects for YAML dates; some
// strings slip through when YAML parses them ambiguously.
function toDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return Number.isFinite(+d) ? d : null;
  }
  return null;
}

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export async function scanContent() {
  const entries = [];

  // content/posts/*.md → kind: post
  const postsDir = path.join(CONTENT, "posts");
  for (const name of listMarkdown(postsDir)) {
    const srcPath = path.join(postsDir, name);
    const { frontmatter, body } = parseFile(srcPath);
    if (frontmatter.draft === true) continue;
    frontmatter.date = toDate(frontmatter.date);
    const outputPath = postOutputPath(frontmatter, name);
    const slug = outputPath.replace(/^\/posts\/|\/$/g, "");
    entries.push({ kind: "post", srcPath, frontmatter, body, outputPath, slug });
  }

  // content/*.md (top level) → kind: page
  for (const name of listMarkdown(CONTENT)) {
    const srcPath = path.join(CONTENT, name);
    const { frontmatter, body } = parseFile(srcPath);
    if (frontmatter.draft === true) continue;
    frontmatter.date = toDate(frontmatter.date);
    const outputPath = pageOutputPath(name);
    const slug = slugify(path.basename(name, path.extname(name)));
    entries.push({ kind: "page", srcPath, frontmatter, body, outputPath, slug });
  }

  // content/gallery/<album>/index.md → kind: gallery
  // content/gallery/*.md → kind: gallery-standalone
  const galleryDir = path.join(CONTENT, "gallery");
  for (const album of listDirs(galleryDir)) {
    const indexMd = path.join(galleryDir, album, "index.md");
    if (!fs.existsSync(indexMd)) continue;
    const { frontmatter, body } = parseFile(indexMd);
    if (frontmatter.draft === true) continue;
    frontmatter.date = toDate(frontmatter.date);
    entries.push({
      kind: "gallery",
      srcPath: indexMd,
      frontmatter,
      body,
      outputPath: `/gallery/${album}/`,
      slug: album,
    });
  }
  for (const name of listMarkdown(galleryDir)) {
    const srcPath = path.join(galleryDir, name);
    const { frontmatter, body } = parseFile(srcPath);
    if (frontmatter.draft === true) continue;
    frontmatter.date = toDate(frontmatter.date);
    const stem = path.basename(name, path.extname(name));
    entries.push({
      kind: "gallery-standalone",
      srcPath,
      frontmatter,
      body,
      outputPath: `/gallery/${slugify(stem)}/`,
      slug: slugify(stem),
    });
  }

  // Posts sorted descending by date (newest first). Others keep the
  // alphabetical order produced by listMarkdown/listDirs for reproducibility.
  entries.sort((a, b) => {
    if (a.kind === "post" && b.kind === "post") {
      const ta = a.frontmatter.date ? +a.frontmatter.date : 0;
      const tb = b.frontmatter.date ? +b.frontmatter.date : 0;
      return tb - ta;
    }
    return 0;
  });

  return entries;
}
