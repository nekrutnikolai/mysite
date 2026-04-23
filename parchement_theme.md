# Parchment Theme — Agent Implementation Guide

 

A reference for AI agents applying the Mentat "parchment" warm-cream theme to other websites.

 

---

 

## 1. Design Philosophy

 

The parchment theme evokes aged paper with warm amber/orange accents. It sits between light and dark modes — a **warm light theme** with cream/beige surfaces, burnt-orange accent color, and earthy text tones. The overall feel is "parchment manuscript" rather than modern-tech.

 

Key principles:

- **Warm neutrals** for surfaces — cream, beige, tan (never cool grays or pure white)

- **Burnt orange** as the primary accent — `#c06820` (a rich, muted orange)

- **Earthy dark text** — near-black with warm undertones (`#1a1208`), not pure `#000`

- **Muted status colors** — greens, yellows, reds are desaturated to match the warm palette

- **Glass morphism adapted** — frosted panels use warm-tinted rgba overlays instead of white

 

---

 

## 2. Core Color Palette

 

### Surfaces (background layers, lightest → darkest)

 

| Token | Hex | Usage |

|-------|-----|-------|

| `--bg` | `#e8dfd2` | Page background — warm parchment base |

| `--surface` | `#f0ead8` | Card/panel content areas — lighter cream |

| `--surface-2` | `#ddd5c5` | Secondary surfaces, hover states |

| `--panel` | `#d5cbb8` | Sidebar, code blocks — medium tan |

| `--code-bg` | `#d5cbb8` | Code/pre blocks — matches panel |

| `--row-alt` | `#e2daca` | Alternating table rows |

| `--hover-bg` | `#ddd5c5` | Hover highlight (matches surface-2) |

 

### Glass Treatment (frosted panel overlays)

 

| Token | Value | Usage |

|-------|-------|-------|

| `--sidebar-glass` | `rgba(220,212,195,0.92)` | Sidebar background (warm semi-opaque) |

| `--header-glass` | `rgba(230,222,208,0.95)` | Header bar |

| `--glass-border` | `rgba(120,100,70,0.2)` | Panel borders — subtle warm brown |

| `--glass-border-hover` | `rgba(160,120,40,0.35)` | Border hover — golden highlight |

 

### Accent System (primary interactive color)

 

| Token | Hex/Value | Usage |

|-------|-----------|-------|

| `--accent` | `#c06820` | **Burnt orange** — buttons, links, active states |

| `--accent-dim` | `#e8d0a8` | Light accent background (selected items) |

| `--accent-light` | `rgba(192,104,32,0.12)` | Subtle accent tint (active nav items) |

| `--accent-lighter` | `rgba(192,104,32,0.06)` | Very subtle accent wash |

| `--accent-glow` | `rgba(192,104,32,0.15)` | Focus/hover glow effects |

| `--focus-ring` | `rgba(192,104,32,0.4)` | Input focus ring |

 

### Text

 

| Token | Hex | Usage |

|-------|-----|-------|

| `--text` | `#1a1208` | Primary text — warm near-black |

| `--text-muted` | `#5c4f3a` | Secondary text — warm brown-gray |

| `--muted` | `#5c4f3a` | Alias for text-muted |

 

### Borders

 

| Token | Hex | Usage |

|-------|-----|-------|

| `--border` | `#b8a890` | Standard borders — tan/khaki |

| `--drop-border` | `#a89878` | Drag-and-drop zone borders — darker tan |

 

### Status Colors (desaturated to match warm palette)

 

| Token | Hex | Usage |

|-------|-----|-------|

| `--success` / `--dot-green` | `#2d7a48` | Success states — forest green |

| `--warn` / `--dot-amber` | `#b07818` | Warning states — deep amber |

| `--danger` / `--dot-red` | `#b83a2a` | Error states — brick red |

 

### Shadows (warm-tinted, not cool black)

 

| Token | Value | Usage |

|-------|-------|-------|

| `--shadow` | `rgba(80,60,30,0.12)` | Default elevation |

| `--shadow-hover` | `rgba(80,60,30,0.22)` | Hover elevation |

| `--shadow-color` | `rgba(80,60,30,0.15)` | General shadow base |

| `--overlay-bg` | `rgba(40,30,15,0.5)` | Modal/overlay backdrop |

| `--tooltip-bg` | `rgba(30,24,14,0.94)` | Tooltip background — dark warm |

 

### Decorative (background orbs, ambient glow)

 

| Token | Value | Usage |

|-------|-------|-------|

| `--orb-1` | `rgba(192,104,32,0.08)` | Floating gradient orb 1 |

| `--orb-2` | `rgba(120,100,70,0.06)` | Floating gradient orb 2 |

| `--white-tint` | `rgba(100,80,50,0.08)` | Subtle warm tint overlay |

 

### AI / Card Accents (module-specific overrides)

 

| Token | Hex | Usage |

|-------|-----|-------|

| `--ai-purple` | `#7a5510` | AI badge — warm brown replaces purple |

| `--ai-dim` | `#e0c890` | AI background tint |

| `--card-ai` | `#ddd0b0` | AI card background |

| `--card-review` | `#d8d0b8` | Review card background |

| `--card-optimize` | `#d0d8c0` | Optimization card — slight green tint |

 

### Badge Colors

 

| Token | Hex | Usage |

|-------|-----|-------|

| `--badge-auto` | `#c5d8b8` | Auto-mapped badge — sage green |

| `--badge-manual` | `#ddc8a0` | Manual badge — warm gold |

| `--badge-unmapped` | `#ddb8b0` | Unmapped badge — warm rose |

 

---

 

## 3. Typography

 

| Property | Value |

|----------|-------|

| Font family | `"Space Grotesk", system-ui, -apple-system, sans-serif` |

| Base size | `14px` |

| Base weight | `300` (light) |

| Line height | `1.7` |

| Heading weight | `600–700` |

| Letter spacing (headings) | `-0.02em` |

| Monospace | `"SF Mono", "Fira Code", "Cascadia Code", monospace` |

 

The font choice is essential to the aesthetic. Space Grotesk is geometric with a technical feel that contrasts pleasantly with the warm colors. Load via Google Fonts:

 

```html

<link href=https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap rel="stylesheet" />

```

 

---

 

## 4. Layout Constants

 

| Token | Value |

|-------|-------|

| `--radius` | `16px` — large border-radius for panels/cards |

| `--radius-sm` | `12px` — inputs, small elements |

| `--sidebar-width` | `240px` |

| `--sidebar-collapsed-width` | `56px` |

| `--header-height` | `56px` |

| `--layout-gap` | `16px` — spacing between floating panels |

 

---

 

## 5. Key Visual Effects

 

### Frosted Glass Panels

```css

.panel {

  background: var(--sidebar-glass);         /* rgba(220,212,195,0.92) */

  backdrop-filter: blur(24px);

  -webkit-backdrop-filter: blur(24px);

  border: 1px solid var(--glass-border);    /* rgba(120,100,70,0.2) */

  border-radius: var(--radius);             /* 16px */

  box-shadow: var(--shadow);                /* rgba(80,60,30,0.12) */

}

```

 

### Hover Lift (cards)

```css

.panel:hover {

  transform: translateY(-3px);

  box-shadow: var(--shadow-hover);          /* rgba(80,60,30,0.22) */

  border-color: var(--glass-border-hover);  /* rgba(160,120,40,0.35) */

}

```

 

### Floating Background Orbs

Three large radial gradient circles float behind content with slow CSS animations. In parchment mode they use warm orange/brown tones:

```css

.orb-1 {

  width: 800px; height: 800px;

  background: radial-gradient(circle, rgba(192,104,32,0.08) 0%, transparent 70%);

  animation: orbFloat1 30s ease-in-out infinite;

}

```

 

### Button Accent Style

```css

.btn-accent {

  background: var(--accent);    /* #c06820 — burnt orange */

  color: #000;

  font-weight: 600;

  border-radius: 16px;

}

.btn-accent:hover {

  opacity: 0.85;

  transform: translateY(-2px);

  box-shadow: 0 4px 20px rgba(192,104,32,0.25);

}

```

 

### Active Navigation Indicator

```css

.nav-item.active {

  background: rgba(192,104,32,0.12);

  color: #c06820;

}

.nav-item.active::before {

  content: "";

  position: absolute; left: 0; top: 8px; bottom: 8px;

  width: 3px; border-radius: 3px;

  background: #c06820;

  box-shadow: 0 0 8px #c06820;

}

```

 

---

 

## 6. Theme Switching Implementation

 

### HTML Attribute

The theme is applied via `data-theme` on `<html>`:

```html

<html data-theme="parchment">

```

 

### CSS Architecture

1. **`:root` (or `[data-theme="dark"]`)** — dark mode defaults

2. **`[data-theme="light"]`** — light mode overrides

3. **`[data-theme="parchment"]`** — parchment overrides

 

All component CSS references `var(--token)` so switching themes just swaps the variable values.

 

### JavaScript Toggle (cycles dark → light → parchment → dark)

```javascript

const THEME_KEY = "my-app-theme";

 

function toggleTheme() {

  const html = document.documentElement;

  const current = html.getAttribute("data-theme");

  let next;

  if (!current || current === "dark") next = "light";

  else if (current === "light") next = "parchment";

  else next = "dark";

 

  if (next === "dark") html.removeAttribute("data-theme");

  else html.setAttribute("data-theme", next);

 

  localStorage.setItem(THEME_KEY, next);

}

 

// Restore on page load (call before DOMContentLoaded to avoid flash)

function initTheme() {

  const saved = localStorage.getItem(THEME_KEY);

  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");

  else if (saved === "parchment") document.documentElement.setAttribute("data-theme", "parchment");

}

initTheme();

```

 

---

 

## 7. Per-Module Override Pattern

 

When a module has special elements that need parchment adjustments beyond the global variables, add scoped overrides:

 

```css

/* Example: Documentation module hero gradient */

[data-theme="parchment"] {

  --docs-orange: #c06820;

  --docs-green: #2d7a48;

  --docs-hero-from: rgba(192,104,32,0.06);

  --docs-hero-to: transparent;

}

 

/* Example: 3D viewport background in Antenna Lab */

[data-theme="parchment"] .viewport {

  background: linear-gradient(135deg, #ede8dd 0%, #faf7f0 50%, #f0ebe2 100%);

}

 

/* Example: Grid lines */

[data-theme="parchment"] .viewport::before {

  background-image:

    linear-gradient(rgba(184,114,42,0.06) 1px, transparent 1px),

    linear-gradient(90deg, rgba(184,114,42,0.06) 1px, transparent 1px);

}

```

 

---

 

## 8. Quick-Start Checklist for New Websites

 

1. **Add the CSS custom properties** — copy the `[data-theme="parchment"]` block from Section 2

2. **Load Space Grotesk** from Google Fonts

3. **Set `border-radius: 16px`** on cards/panels and `12px` on inputs

4. **Use `backdrop-filter: blur(24px)`** on floating panels for the frosted glass effect

5. **Shadow colors must be warm** — `rgba(80,60,30,...)` not `rgba(0,0,0,...)`

6. **Status colors are desaturated** — forest green `#2d7a48`, brick red `#b83a2a`, deep amber `#b07818`

7. **Accent hover glow** — `box-shadow: 0 4px 16px rgba(192,104,32,0.25)`

8. **Add floating orbs** (optional) for depth — warm-tinted radial gradients with slow float animations

9. **Wire up theme toggle** — `data-theme` attribute + localStorage persistence

10. **Test tooltip contrast** — dark warm tooltip bg `rgba(30,24,14,0.94)` with light text

 

---

 

## 9. Color Relationships Summary

 

```

Page Background:  #e8dfd2 (warm parchment)

     ↓ +lighter

Card Surface:     #f0ead8 (cream)

     ↓ +darker

Panel/Sidebar:    #d5cbb8 (tan)

     ↓ +darker

Border:           #b8a890 (khaki)

 

Accent:           #c06820 (burnt orange)

     ↓ tinted

Light Accent:     rgba(192,104,32,0.12)

 

Text:             #1a1208 (warm near-black)

     ↓ +lighter

Muted Text:       #5c4f3a (warm brown-gray)

```

 

The entire palette derives from a warm brown/orange hue family. When adapting for a new site, the key ratio to maintain is: surfaces are **warm cream/beige** (HSL hue ~30-40, saturation 15-30%, lightness 78-94%), accent is **burnt orange** (HSL ~25, sat 72%, light 44%), and text is **warm dark** (HSL ~35, sat 40%, light 8-35%).
