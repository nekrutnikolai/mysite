// RSS 2.0 + sitemap generation. Hand-written XML with minimal helpers; no deps.
// Consumed at the end of build.mjs after all pages have been rendered.

import { escapeXml } from "./escape.mjs";

const CHANGEFREQ = {
  home: "weekly",
  post: "weekly",
  page: "monthly",
  list: "weekly",
  tag: "yearly",
  gallery: "monthly",
};

// Join a site URL (no trailing slash) with a path (with leading slash).
function absolute(siteUrl, urlPath) {
  const base = String(siteUrl).replace(/\/+$/, "");
  const rel = String(urlPath || "/");
  return base + (rel.startsWith("/") ? rel : `/${rel}`);
}

// RFC 822 date (e.g. "Mon, 10 Jan 2022 16:50:50 +0100") for RSS pubDate.
// Date.prototype.toUTCString() produces "GMT" which is the RFC 822 UTC form.
function rfc822(d) {
  return d instanceof Date && Number.isFinite(+d) ? d.toUTCString() : "";
}

// YYYY-MM-DD for sitemap lastmod.
function ymd(d) {
  return d instanceof Date && Number.isFinite(+d) ? d.toISOString().slice(0, 10) : "";
}

// Build a plain-text excerpt from a markdown post body. Strips Hugo
// shortcodes, HTML tags, and collapses whitespace; truncates to ~200 chars.
export function excerpt(body, limit = 200) {
  let s = String(body ?? "");
  s = s.replace(/\{\{[<%][\s\S]*?[>%]\}\}/g, " "); // shortcodes
  s = s.replace(/<[^>]+>/g, " "); // html tags
  s = s.replace(/[#*_`>\[\]()]/g, " "); // markdown punctuation
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > limit) s = s.slice(0, limit).trimEnd() + "\u2026";
  return s;
}

export function renderRSS({ siteTitle, siteUrl, description, posts }) {
  const items = (posts || []).slice(0, 10).map((p) => {
    const link = absolute(siteUrl, p.url);
    const desc = excerpt(p.body);
    return [
      "    <item>",
      `      <title>${escapeXml(p.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `      <pubDate>${escapeXml(rfc822(p.date))}</pubDate>`,
      `      <description>${escapeXml(desc)}</description>`,
      "    </item>",
    ].join("\n");
  });
  const self = absolute(siteUrl, "/index.xml");
  const home = absolute(siteUrl, "/");
  const lastBuild = rfc822(new Date());
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>${escapeXml(siteTitle)}</title>`,
    `    <link>${escapeXml(home)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <language>en</language>`,
    `    <lastBuildDate>${escapeXml(lastBuild)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />`,
    ...items,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n");
}

export function renderSitemap({ siteUrl, urls }) {
  const body = (urls || []).map((u) => {
    const loc = absolute(siteUrl, u.url);
    const lastmod = ymd(u.date);
    const freq = CHANGEFREQ[u.type] || "monthly";
    const parts = [`    <loc>${escapeXml(loc)}</loc>`];
    if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
    parts.push(`    <changefreq>${freq}</changefreq>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...body,
    `</urlset>`,
    ``,
  ].join("\n");
}
