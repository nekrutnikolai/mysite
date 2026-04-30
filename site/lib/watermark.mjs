// Copyright watermark + EXIF metadata for gallery images.
// Renders a low-opacity serif text mark anchored bottom-right via a
// full-canvas SVG that sharp/librsvg rasterizes during composite.

import crypto from "node:crypto";
import { escapeSvgText as escapeXml } from "./escape.mjs";

export const WATERMARK_CONFIG = {
  text: "© 2026 Nikolai Nekrutenko",
  fontFamily: "'Source Serif 4', 'Source Serif Pro', 'DejaVu Serif', serif",
  fontSizePctOfWidth: 0.016,
  fontSizeMinPx: 11,
  paddingPctOfWidth: 0.01,
  paddingMinPx: 6,
  opacity: 0.35,
  fill: "#ffffff",
  shadow: "rgba(0,0,0,0.45)",
  // Baked into ALL variants via withMetadata()
  copyright: "© 2026 Nikolai Nekrutenko. Licensed CC BY-NC 4.0.",
  artist: "Nikolai Nekrutenko",
};

export function watermarkConfigHash() {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(WATERMARK_CONFIG))
    .digest("hex")
    .slice(0, 16);
}

export function buildWatermarkSvg(width, height) {
  const c = WATERMARK_CONFIG;
  const fontSize = Math.max(
    c.fontSizeMinPx,
    Math.round(width * c.fontSizePctOfWidth),
  );
  const pad = Math.max(c.paddingMinPx, Math.round(width * c.paddingPctOfWidth));
  const x = width - pad;
  const y = height - pad;
  const t = escapeXml(c.text);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<g font-family="${c.fontFamily}" font-size="${fontSize}" ` +
      `text-anchor="end" dominant-baseline="alphabetic">` +
      `<text x="${x + 1}" y="${y + 1}" fill="${c.shadow}" fill-opacity="${c.opacity}">${t}</text>` +
      `<text x="${x}" y="${y}" fill="${c.fill}" fill-opacity="${c.opacity}">${t}</text>` +
      `</g></svg>`,
  );
}

export function watermarkExifMeta() {
  return {
    exif: {
      IFD0: {
        Copyright: WATERMARK_CONFIG.copyright,
        Artist: WATERMARK_CONFIG.artist,
      },
    },
  };
}
