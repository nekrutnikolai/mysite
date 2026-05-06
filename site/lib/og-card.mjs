// Per-post OpenGraph card renderer: 1200x630 PNG with title + date + site
// name. Composes an inline SVG and rasterizes it through sharp's libvips
// pipeline — no browser, no external font fetch. Generic font fallbacks
// (Source Serif 4 → DejaVu Serif → Georgia → serif; IBM Plex Mono →
// DejaVu Sans Mono → Menlo → monospace) keep output legible across macOS
// dev and Linux CI without bundling typefaces.

import sharp from "sharp";

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Crude character-count word-wrap. Most post titles fit in one or two lines
// at our 32-char target line width; capped at three to prevent a runaway
// title from overflowing the card.
function wrapTitle(title, maxChars = 32) {
  const words = String(title).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + word.length + 1 <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

const TITLE_FONT = "Source Serif 4, DejaVu Serif, Georgia, serif";
const META_FONT  = "IBM Plex Mono, DejaVu Sans Mono, Menlo, monospace";
const SITE_FONT  = "Source Serif 4, DejaVu Serif, Georgia, serif";

function buildSvg(title, dateHuman, siteName) {
  const lines = wrapTitle(escapeXml(title));
  const lineHeight = 78;
  // Anchor each line's baseline; vertical-center the block in the upper 2/3.
  const startY = 280 - (lines.length - 1) * lineHeight;
  const titleTspans = lines
    .map((line, i) => `<tspan x="80" y="${startY + i * lineHeight}">${line}</tspan>`)
    .join("");

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#ffffff"/>
  <text font-family="${TITLE_FONT}" font-weight="700" font-size="64" fill="#37352f" letter-spacing="-1">${titleTspans}</text>
  <text x="80" y="555" font-family="${META_FONT}" font-size="20" fill="#6b6964">${escapeXml(dateHuman)}</text>
  <text x="1120" y="555" text-anchor="end" font-family="${SITE_FONT}" font-weight="600" font-size="22" fill="#37352f">${escapeXml(siteName)}</text>
</svg>`;
}

export async function generateOgCard({ title, dateHuman, siteName, outPath }) {
  const svg = buildSvg(title, dateHuman, siteName);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
}
