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
npm run dev                                   # http://localhost:3100
```

`npm run build` produces `dist/`. `npm run test` runs the Playwright suite.

See [CLAUDE.md](./CLAUDE.md) for the full architecture writeup.

## Previous stack

Originally built with [Hugo](https://gohugo.io/) + [hello-friend-ng](https://themes.gohugo.io/hugo-theme-hello-friend-ng/) + [hugo-shortcode-gallery](https://github.com/mfg92/hugo-shortcode-gallery), deployed to [Netlify](https://www.netlify.com/). The Hugo tree is kept in place (`content/`, `public/`, `themes/`, `config.toml`, `netlify.toml`) so the pre-migration site is still servable via `npm run serve:old` for side-by-side comparison.
