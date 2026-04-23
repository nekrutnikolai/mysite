// marked configuration with goldmark-compatible heading IDs.
// Raw HTML passes through (Hugo has markup.goldmark.renderer.unsafe = true);
// we do NOT sanitize. Heading IDs are emitted on every heading; optionally
// collected into a TOC accumulator so the portfolio page (iter 4) can render
// its TOC partial from the same source.

import { Marked } from "marked";
import { slugify } from "./routes.mjs";

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, "").trim();
}

export function renderMarkdown(md, { tocAccumulator } = {}) {
  // Per-call dedupe state so different source files never collide.
  const seen = new Map();
  const marked = new Marked({ gfm: true, breaks: false });

  // marked v12 renderer.heading signature: (text, level, raw).
  //   text: already-rendered inline HTML of the heading
  //   level: numeric depth 1..6
  //   raw: plain-text source, which is what we slugify against
  marked.use({
    renderer: {
      heading(text, level, raw) {
        const base = slugify(stripTags(raw || text)) || "section";
        const n = seen.get(base) || 0;
        const id = n === 0 ? base : `${base}-${n}`;
        seen.set(base, n + 1);
        if (tocAccumulator) tocAccumulator.push({ depth: level, text: stripTags(text), id });
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      },
    },
  });

  return marked.parse(md ?? "");
}
