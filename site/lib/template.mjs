// Mustache-lite renderer. Supports: {{var}}, {{{raw}}}, {{#list}}..{{/list}},
// {{^list}}..{{/list}}, {{>partial}}. Partials are inlined once at load.
// ~60 LOC; no external parser, regex + string ops only.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "./escape.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(__dirname, "..");
const TPL_DIR = path.join(SITE, "templates");
const PARTIAL_DIR = path.join(SITE, "partials");

const cache = new Map();

// Inline all {{> name }} references from partials/ recursively.
function inlinePartials(src, seen = new Set()) {
  return src.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (seen.has(name)) throw new Error(`partial cycle on ${name}`);
    const p = path.join(PARTIAL_DIR, `${name}.html`);
    const body = fs.readFileSync(p, "utf8");
    return inlinePartials(body, new Set([...seen, name]));
  });
}

function loadTemplate(name) {
  if (cache.has(name)) return cache.get(name);
  const raw = fs.readFileSync(path.join(TPL_DIR, `${name}.html`), "utf8");
  const inlined = inlinePartials(raw);
  cache.set(name, inlined);
  return inlined;
}

function lookup(ctx, key) {
  if (key === ".") return ctx;
  return ctx == null ? undefined : ctx[key];
}

// Render a single context frame: handles sections, inverses, raw/escaped vars.
function renderWith(tpl, ctx) {
  // Section blocks: {{#key}}...{{/key}} and {{^key}}...{{/key}}.
  // Non-greedy, allows nesting via recursion on the matched block.
  tpl = tpl.replace(
    /\{\{([#^])\s*([\w.-]+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g,
    (_, kind, key, inner) => {
      const val = lookup(ctx, key);
      const truthy = Array.isArray(val) ? val.length > 0 : !!val;
      if (kind === "^") return truthy ? "" : renderWith(inner, ctx);
      if (!truthy) return "";
      if (Array.isArray(val)) return val.map((item) => renderWith(inner, item)).join("");
      if (typeof val === "object") return renderWith(inner, val);
      return renderWith(inner, ctx);
    }
  );
  // Raw (triple-brace) substitution.
  tpl = tpl.replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_, key) => {
    const v = lookup(ctx, key);
    return v == null ? "" : String(v);
  });
  // Escaped substitution.
  tpl = tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    const v = lookup(ctx, key);
    return v == null ? "" : escapeHtml(v);
  });
  return tpl;
}

export function render(templateName, ctx = {}) {
  return renderWith(loadTemplate(templateName), ctx);
}
