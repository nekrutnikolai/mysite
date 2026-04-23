// URL catalog + per-iteration gating. Extended as iterations land.

export const THEMES = ["light", "dark", "parchment"] as const;
export type Theme = (typeof THEMES)[number];

export const VIEWPORTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

// Minimum ITERATION env value at which each URL is expected to exist.
export const URLS: { url: string; iter: number }[] = [
  { url: "/", iter: 0 },
  { url: "/__preview/", iter: 1 },
  { url: "/about/", iter: 4 },
  { url: "/portfolio/", iter: 4 },
  { url: "/resume/", iter: 4 },
  { url: "/posts/", iter: 2 },
  { url: "/posts/my-first-post/", iter: 2 },
  { url: "/posts/the-book-of-bitcoin-an-analogy-to-explain-bitcoin/", iter: 2 },
  { url: "/tags/", iter: 3 },
  { url: "/tags/bitcoin/", iter: 3 },
  { url: "/gallery/", iter: 5 },
  { url: "/gallery/maine-trip/", iter: 5 },
  { url: "/gallery/solstice-fun/", iter: 5 },
  { url: "/404.html", iter: 7 },
  { url: "/sitemap.xml", iter: 7 },
  { url: "/index.xml", iter: 7 },
];

export const CURRENT_ITER = Number(process.env.ITERATION ?? 0);
export const activeUrls = () => URLS.filter((u) => u.iter <= CURRENT_ITER);
