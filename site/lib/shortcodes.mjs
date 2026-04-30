import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeShortcodeAttr as esc } from "./escape.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const MKDOWNTABLE_HTML = fs.readFileSync(path.join(ROOT, "layouts/shortcodes/mkdowntable.html"), "utf8").trim();
const COUNTYGRAPHERV1_HTML = fs.readFileSync(path.join(ROOT, "layouts/shortcodes/countygrapherv1.html"), "utf8").trim();

const SHORTCODE_RE = /\{\{<\s*(\w+)([^>]*?)\s*>\}\}/g;
const ARG_RE = /(\w+)=("([^"]*)"|'([^']*)'|(\S+))|"([^"]*)"|'([^']*)'/g;

function parseArgs(str) {
  const out = { _positional: [] };
  if (!str || !str.trim()) return out;
  let m;
  ARG_RE.lastIndex = 0;
  while ((m = ARG_RE.exec(str))) {
    if (m[1]) out[m[1]] = m[3] ?? m[4] ?? m[5];
    else out._positional.push(m[6] ?? m[7]);
  }
  return out;
}

function figure(a, ctx) {
  const rawSrc = a.src || "";
  const src = esc(rawSrc);
  const alt = esc(a.alt || "");
  const pos = esc(a.position || "center");
  const style = a.style ? ` style="${esc(a.style)}"` : "";
  // Emit explicit width/height to eliminate CLS. We only resolve local
  // (root-relative) paths — remote images skip the attrs and degrade to CSS.
  const dims =
    ctx && ctx.imgSizes && rawSrc.startsWith("/")
      ? ctx.imgSizes.get(rawSrc)
      : null;
  const dimAttr = dims ? ` width="${dims.w}" height="${dims.h}"` : "";
  const img = `<img src="${src}" alt="${alt}"${dimAttr} loading="lazy"${style}>`;
  const caption = a.title
    ? `\n  <figcaption class="figure-caption figure-caption--${esc(a.titlePosition || "center")}">${esc(a.title)}</figcaption>`
    : "";
  return `<figure class="figure figure--${pos}">\n  ${img}${caption}\n</figure>`;
}

function youtube(a) {
  const id = esc(a.id || a._positional[0] || "");
  const autoplay = a.autoplay === "true" ? "?autoplay=1&mute=1" : "";
  return `<div class="embed embed--youtube"><iframe src="https://www.youtube.com/embed/${id}${autoplay}" title="YouTube video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
}

function galleryPlaceholder(a) {
  return `<div class="gallery-placeholder" data-match="${esc(a.match || "")}">\n  <p><em>Gallery renders from iteration 5 onward.</em></p>\n</div>`;
}

export function expand(md, ctx = {}) {
  return md.replace(SHORTCODE_RE, (_full, name, argStr) => {
    const args = parseArgs(argStr);
    switch (name) {
      case "figure":          return figure(args, ctx);
      case "youtube":         return youtube(args);
      case "gallery":         return galleryPlaceholder(args);
      case "mkdowntable":     return `<div class="embed embed--jovian">${MKDOWNTABLE_HTML}</div>`;
      case "countygrapherv1": return `<div class="embed embed--jovian">${COUNTYGRAPHERV1_HTML}</div>`;
      default:
        console.warn(`[shortcodes] unknown: ${name}`);
        return `<!-- unknown shortcode: ${name} -->`;
    }
  });
}
