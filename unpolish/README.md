# Unpolish — integration guide

Unpolish is a reversible lo-fi visual layer for working web prototypes. It ships as **one dependency-free file** (`unpolish.js`) plus a **JSON config** (`unpolish.config.json`). It does not need React, Tailwind, a component library or a particular build tool, and it never edits your components, routes, state or stylesheets.

> Not published to npm. Copy (vendor) the files in this folder into the prototype's repository.

| File | Purpose |
| --- | --- |
| `unpolish.js` | The harness: themes, panel, shortcuts, review links (≈157 KB source, ≈42 KB gzipped) |
| `unpolish.config.json` | Shared, version-controlled project preset (start from this one) |
| `unpolish.config.schema.json` | JSON Schema for the config (editor autocomplete/validation) |

## Install

Copy this folder to wherever the app serves static files (`public/unpolish/`, `static/unpolish/`, …), then pick the smallest integration that fits.

**Script tag** — plain HTML, Vite, Vue, Svelte, Astro, CRA. Put it in the HTML entry or root layout `<head>`:

```html
<script src="/unpolish/unpolish.js" data-config="unpolish.config.json" defer></script>
```

`data-config` resolves **relative to the script file**. It auto-starts on load.

**Next.js** (App Router `app/layout.tsx`, or `pages/_app.tsx`):

```tsx
import Script from 'next/script';
// inside <body>
<Script src="/unpolish/unpolish.js" data-config="unpolish.config.json" strategy="afterInteractive" />
```

**Bundled import** — when a script tag doesn't fit:

```js
import './vendor/unpolish/unpolish.js';         // defines window.Unpolish; no auto-start
import config from './vendor/unpolish/unpolish.config.json';
window.Unpolish.init({ config });
```

**Inline config** — no extra request:

```html
<script type="application/json" id="unpolish-config">{ "version": 1, "defaultTheme": "original" }</script>
<script src="/unpolish/unpolish.js" defer></script>
```

Other options: set `window.UnpolishConfig = {…}` before the script, or add `data-manual` to the tag and call `Unpolish.init({ config })` yourself. Server-rendered apps should load it on the client only (after hydration).

To ship a build without it, set `"enabled": false` in the config or leave the tag out of that build.

## Use

- Press **`\`** (or the launcher in the corner) to open the panel.
- **1–4** pick Black & White, Sketch, Blueprint, Pastel Blocks while the panel is open. **0** restores Original. **Esc** closes.
- **Edit theme** reveals palette, typography, border weight and style, corners, shadows, details and image treatment.
- **Shortcuts** shows every binding and lets you reassign them. Shortcuts never fire while typing in inputs, textareas, selects or contenteditable regions.

## Configuration

Precedence for a page view: **review-link URL → local draft (this browser) → project config → built-in presets**.

```jsonc
{
  "$schema": "./unpolish.config.schema.json",
  "version": 1,
  "id": "checkout-v2",                 // namespaces local drafts per prototype
  "defaultTheme": "original",          // original | black-white | sketch | blueprint | pastel
  "ui": "visible",                     // "hidden" removes the launcher (\ still opens the panel)
  "launcher": "bottom-right",          // or bottom-left | top-right | top-left | false
  "webFonts": true,                    // load Balsamiq Sans / IBM Plex / Nunito from Google Fonts
  "exclude": [".brand-logo", "#map"],  // never restyle these regions
  "roles": { ".my-chip": "fill" },     // hints: surface | fill | media | icon | plain
  "shortcuts": { "toggle": "\\", "themes": { "sketch": "Alt+S" } },
  "themes": {
    "sketch": {
      "palette": { "accent": "#2563c9" },
      "typography": "hand",            // original | neutral | hand | technical | rounded
      "border": { "weight": 1.6, "style": "hand" },  // solid | dashed | hand | none
      "radius": 4,                     // number (px) or "keep"
      "shadows": "none",               // none | soft | flat
      "details": true,                 // theme-specific details (patterns, shading, grid, colour blocks)
      "images": "original"             // original | simplified | placeholder
    }
  },
  "overrides": {
    "*": ".chart canvas { filter: grayscale(1) !important; }",
    "blueprint": ".hero { background-color: var(--up-paper) !important; }"
  }
}
```

Only list what you change; everything else uses the built-in preset. The full schema is in `unpolish.config.schema.json`.

### Drafts vs. the project config

Panel adjustments preview instantly and are saved **in the browser only** (a local draft, shown as *Local draft* in the panel header). A deployed page cannot write to your repository. To save:

1. Click **Copy configuration**. You get the complete JSON plus short instructions.
2. Paste it to your coding agent (or replace `unpolish.config.json` yourself) and redeploy.
3. Once the file matches your draft, the panel shows *Project* again.

**Discard local changes** returns to the project config. **Reset preset** returns only the current theme.

### Exempting regions

Add `data-unpolish-ignore` to an element, or list a selector in `exclude`. Exempt regions keep their own styles, inherited font and colour. Canvas, WebGL, `<iframe>`, `<embed>` and `<object>` are always left as they are.

### Role hints and overrides

The classifier reads each element's rendered styles (background, borders, shadow, colour, size) and tags it with roles — surface, fill, edge, media, icon, text tone. If a custom component is misread, either annotate it (`data-unpolish-role="surface|fill|media|icon|plain"`) or add a selector in `roles`. For anything else, `overrides` takes CSS that is scoped to a theme (`html[data-unpolish="sketch"] { … }`, via CSS nesting). Use `!important`; these variables are available: `--up-paper`, `--up-surface`, `--up-ink`, `--up-muted`, `--up-line`, `--up-rule`, `--up-accent`, `--up-danger`, `--up-success`, `--up-warning`, `--up-radius`, `--up-stroke`, `--up-font`.

## Review links

**Copy review link** keeps the current path, your app's query parameters and hash, and adds:

| Parameter | Values |
| --- | --- |
| `unpolish` | `original`, `black-white`, `sketch`, `blueprint`, `pastel` (aliases: `bw`, `pastel-blocks`) |
| `unpolish-ui` | `visible` or `hidden` (hides panel and launcher; the shortcut still opens them) |

Example: `/plan?tab=venues&unpolish=blueprint&unpolish-ui=hidden#schedule`

Links apply the **saved project preset** for the theme; the recipient's own local drafts are ignored for that session. Links carry only the theme, so if your current theme has unsaved edits the panel asks you to save them first. The review session is kept in `sessionStorage`, so it survives client-side navigation and reloads in that tab. Invalid values fall back to the project defaults with a console warning. *Exit* in the panel ends the session.

## JavaScript API

```js
Unpolish.setTheme('sketch');          // 'original' restores
Unpolish.update({ images: 'placeholder', border: { style: 'dashed' } });
Unpolish.getSettings('pastel');
Unpolish.getConfig();                 // config object incl. local edits
Unpolish.getReviewLink({ hideUI: true });
Unpolish.open(); Unpolish.close(); Unpolish.toggle();
Unpolish.resetTheme(); Unpolish.discardLocalChanges();
Unpolish.on('change', (state) => {}); // also 'ready', 'open', 'close'
Unpolish.destroy();                   // remove treatment + panel
```

## How it stays safe

- **Reversible.** Everything lives in one `<style id="unpolish-theme">` (in an `@layer` so `!important` rules win predictably), `data-up` role attributes, and a hidden SVG with image filters. Original removes all of them.
- **Layout-safe.** Themes change colour, borders' colour, outlines, backgrounds, radii, shadows and fonts. They never change size, padding, margin, position or border width; strokes are drawn with outlines/backgrounds that don't take space. Only a typography swap can nudge text width — choose *Keep original* when that matters.
- **Behaviour untouched.** No element is replaced, wrapped or covered; event handlers, focus, form values, scroll and routes are preserved. Host transitions are paused for two frames during a switch so the prototype doesn't animate.
- **Dynamic content.** A `MutationObserver` classifies new nodes before paint, and re-reads elements whose class, style, ARIA/data state or `open` attribute change. Open shadow roots get the theme via adopted stylesheets.
- **Isolated UI.** The panel lives in a shadow root with its own reset; it excludes itself from theming.

## Limitations

- Canvas/WebGL, cross-origin iframes and closed shadow roots can't be restyled; they're left as they are.
- Large inline SVGs (charts, illustrations) are treated as imagery: *Original* keeps them, *Simplified* filters them, *Placeholder* hides them. Exclude charts you want untouched.
- Some elements are styled only through pseudo-elements or `:has()`; Unpolish re-reads on `change`/`click`, but a custom component may still need a role hint or override.
- Child elements with opaque backgrounds can hide hand-drawn or dashed strokes drawn on a parent's edge.
- Requires a modern browser: Chrome/Edge 111+, Safari 16.4+, Firefox 113+ (`color-mix`, `@layer`, `:where()`, CSS nesting for overrides).
- Web fonts load from Google Fonts unless `"webFonts": false`; system fallbacks are used offline.

## Remove

Delete the script tag (or import + `init` call) and this folder. Optionally delete `unpolish.config.json`. Nothing else in the app refers to Unpolish. Visitors may keep a small `unpolish:*` entry in `localStorage`; it does nothing without the script.
