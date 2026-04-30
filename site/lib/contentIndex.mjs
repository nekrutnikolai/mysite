// Emit /__index.json — flat list consumed by the Cmd+K palette (Agent F).
// One JSON file with every navigable destination on the site. Generated at
// build time so the palette only needs a single fetch on first open.

export function buildContentIndex({ pages, posts, galleries, tags }) {
  const items = [];

  // Top-level pages.
  items.push({ kind: "page", title: "Home", meta: "/", url: "/" });
  for (const p of pages) {
    const fm = p.frontmatter || {};
    const title = fm.title || p.slug;
    items.push({
      kind: "page",
      title,
      meta: p.outputPath,
      url: p.outputPath,
    });
  }

  // Posts.
  for (const p of posts) {
    const fm = p.frontmatter || {};
    const ts = Array.isArray(fm.tags) ? fm.tags.slice(0, 3).join(", ") : "";
    items.push({
      kind: "post",
      title: fm.title || p.slug,
      meta: ts ? `Post · ${ts}` : "Post",
      url: p.outputPath,
    });
  }

  // Galleries.
  for (const g of galleries) {
    const count = (g.imageRecords || []).length;
    items.push({
      kind: "gallery",
      title: (g.frontmatter && g.frontmatter.title) || g.slug,
      meta: `Gallery · ${count} photo${count === 1 ? "" : "s"}`,
      url: g.outputPath,
    });
  }

  // Tags.
  for (const t of tags) {
    items.push({
      kind: "tag",
      title: t.name,
      meta: `Tag · ${t.count} post${t.count === 1 ? "" : "s"}`,
      url: t.url,
    });
  }

  // Quick actions.
  items.push({
    kind: "action",
    title: "Toggle theme",
    meta: "light → dark → parchment",
    url: "#theme",
  });
  items.push({
    kind: "action",
    title: "Download Resume.pdf",
    meta: "PDF",
    url: "/Resume.pdf",
  });
  items.push({
    kind: "action",
    title: "Email Nikolai",
    meta: "nan34@cornell.edu",
    url: "mailto:nan34@cornell.edu",
  });

  return JSON.stringify({ generatedAt: new Date().toISOString(), items });
}
