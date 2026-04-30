// Centralized HTML/XML entity escapes. The four call sites in this codebase
// have historically diverged on which characters they escape; we preserve
// each one's exact prior semantics rather than silently unifying them, so the
// resulting `dist/` is byte-identical to pre-refactor builds.

// Mustache-lite renderer's escape — matches what Hugo and most templating
// engines emit for HTML attribute/text contexts. Uses numeric-entity form
// `&#39;` for apostrophe (not `&apos;`, which isn't a valid HTML 4 entity).
const HTML_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => HTML_MAP[c]);
}

// RSS/sitemap XML escape — full 5-entity set with `&apos;` (the XML name for
// apostrophe; valid in XML even though invalid in HTML 4).
export function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Hugo-shortcode attribute escape — only 4 entities (omits `'`); the
// shortcode parser already strips quotes from arg values, so apostrophes are
// rare in attributes anyway.
const SHORTCODE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export function escapeShortcodeAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) => SHORTCODE_MAP[c]);
}

// SVG-text escape for the watermark — only the 3 entities mandatory inside
// SVG `<text>` content. Quotes are emitted by the SVG generator itself
// around attribute values, so they never appear in the escaped substring.
export function escapeSvgText(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
