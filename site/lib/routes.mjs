// Hugo-compatible URL slugify + output-path helpers. Verified empirically
// against the existing Hugo build at public/posts/ — all 7 published posts
// produce matching slugs.

import path from "node:path";

// Hugo's `urlize`: lowercase, strip apostrophes + diacritics, collapse runs of
// non-alphanumeric ASCII to a single hyphen, trim leading/trailing hyphens.
export function slugify(str) {
  return String(str ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks (diacritics)
    .toLowerCase()
    .replace(/['’\u2018\u2019]/g, "") // strip apostrophes (straight + curly)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Blog post URL: /posts/<slug>/. Falls back to filename stem when title is
// missing or empty (matches Hugo's behavior).
export function postOutputPath(frontmatter, filename) {
  const title = frontmatter?.title;
  const stem = path.basename(filename, path.extname(filename));
  const raw = title && String(title).trim() ? title : stem;
  const slug = slugify(raw) || slugify(stem);
  return `/posts/${slug}/`;
}

// Top-level page URL: /<stem>/. Used by iter 4. Stubbed here for scanContent().
export function pageOutputPath(filename) {
  const stem = path.basename(filename, path.extname(filename));
  return `/${slugify(stem)}/`;
}
