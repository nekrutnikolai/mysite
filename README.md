# [mysite](https://nnekrut.netlify.app/)

[![Netlify Status](https://api.netlify.com/api/v1/badges/bab2edd7-a307-4052-ba2e-1b46493f4335/deploy-status)](https://app.netlify.com/projects/nnekrut/deploys)

My personal website.

**Current stack (April 2026):** pure HTML/CSS emitted by a small Node build at `site/build.mjs`. Three themes — light, dark, and parchment — switchable via the toggle in the header. 121 Playwright tests across visual regression, accessibility, performance (Lighthouse), and link/content integrity.

## Dev

```
git clone …
cd mysite
git submodule init && git submodule update   # legacy Hugo theme; harmless to skip
npm install
npx playwright install chromium              # first time only
npm run download-originals                    # pull gallery masters from R2 (needs .env)
npm run dev                                   # http://localhost:3100
```

`npm run build` produces `dist/`. `npm run test` runs the Playwright suite.

See [CLAUDE.md](./CLAUDE.md) for the full architecture writeup.

## Gallery images

Source masters live in a Cloudflare R2 bucket (`nnekrut-gallery`), not in git. The bucket has two prefixes:

- `clean/gallery/<album>/<file>` — pristine masters; what `sharp` reads to regenerate thumbnails and medium previews.
- `gallery/<album>/<file>` — watermarked + EXIF-tagged versions; what the public lightbox loads as `data-full` for full-resolution zoom.

`npm run download-originals` syncs `clean/` into `content/gallery/<album>/images/`. `npm run upload-originals` does the reverse (clean from `content/`, watermarked from `dist/`) after a `BUILD_ORIGINALS=1` build. R2 credentials go in `.env` (gitignored); see `.env.example`.

The lightbox progressively loads the original on first zoom past 1×, with `img.decode()` to keep the swap paint-only and `requestAnimationFrame` coalescing so pan-while-zoomed runs at a steady 60 Hz instead of choking on raw mousemove rate.

## Previous stack

Originally built with [Hugo](https://gohugo.io/) + [hello-friend-ng](https://themes.gohugo.io/hugo-theme-hello-friend-ng/) + [hugo-shortcode-gallery](https://github.com/mfg92/hugo-shortcode-gallery), deployed to [Netlify](https://www.netlify.com/). The Hugo tree is kept in place (`content/`, `public/`, `themes/`, `config.toml`, `netlify.toml`) so the pre-migration site is still servable via `npm run serve:old` for side-by-side comparison.
