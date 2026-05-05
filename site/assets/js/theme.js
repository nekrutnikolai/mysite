// Theme switch — single circular button cycles light → dark → parchment.
// The active icon fades + scale-rotates in while the others fade out.
// Storage key is shared with the FOUC-safe inline restorer in partials/head.html.

(() => {
  const KEY = "nn-site-theme";
  const ORDER = ["light", "dark", "parchment"];
  const LABEL = {
    light: "Theme: light (click for dark)",
    dark: "Theme: dark (click for parchment)",
    parchment: "Theme: parchment (click for light)",
  };

  const root = document.documentElement;
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const get = () => root.getAttribute("data-theme") || "light";

  const apply = (t) => {
    if (t === "light") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    try {
      window.localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked — theme still applies in-page */
    }
    btn.dataset.theme = t;
    btn.setAttribute("aria-label", LABEL[t] || "Toggle theme");
  };

  apply(get());

  btn.addEventListener("click", () => {
    const i = ORDER.indexOf(get());
    apply(ORDER[(i + 1) % ORDER.length]);
  });
})();

// Mobile nav hamburger. Toggles the .site-nav drop-down panel via
// aria-expanded + data-open. Closes on: link click, Esc, outside click.
// Desktop (>640px) hides the toggle via CSS so this runs harmlessly.
(() => {
  const btn = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!btn || !nav) return;

  const close = () => {
    btn.setAttribute("aria-expanded", "false");
    nav.removeAttribute("data-open");
  };
  const open = () => {
    btn.setAttribute("aria-expanded", "true");
    nav.dataset.open = "true";
  };
  const toggle = () =>
    btn.getAttribute("aria-expanded") === "true" ? close() : open();

  btn.addEventListener("click", toggle);
  nav.addEventListener("click", (e) => {
    if (e.target instanceof HTMLAnchorElement) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  document.addEventListener("click", (e) => {
    if (btn.getAttribute("aria-expanded") !== "true") return;
    const t = e.target;
    if (t instanceof Node && !btn.contains(t) && !nav.contains(t)) close();
  });
})();
