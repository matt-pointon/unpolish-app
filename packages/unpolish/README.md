# Unpolish

**Less polish. Better conversations.** Reversible lo-fi themes — Black & White, Sketch, Blueprint, Pastel Blocks — for working web prototypes. Every click, route and form keeps working; *Original* puts everything back.

One framework-independent browser runtime, three ways in:

| | When | How |
| --- | --- | --- |
| **Installer** | Any project with a `package.json` (Vite, Next.js…), or a folder of HTML pages | `npx unpolish@latest init` |
| **Script tag** | No build step, or you'd rather not add a dependency | `<script src="unpolish/unpolish.js" data-config="unpolish.config.json" defer></script>` |
| **Download** | Self-hosting, offline, locked-down repos | `unpolish.js` + `unpolish.config.json` from the website or `node_modules/unpolish/dist/` |

## Install

From the prototype's folder:

```sh
npx unpolish@latest init --dry-run   # show the plan, change nothing
npx unpolish@latest init
```

Then start the app and press **`\`**.

### What `init` does

It inspects the project (package manager from the lockfile, framework, entry points, static folder, base path, an existing install) and makes the smallest change that fits:

| Project | Changes |
| --- | --- |
| **Vite** (React, Vue, Svelte, vanilla…) | adds `unpolish` as an exact-version dependency with your package manager · creates `public/unpolish.config.json` · adds a 4-line marked block at the top of the client entry (`src/main.*`, read from `index.html`) |
| **Next.js App Router** | adds the dependency · creates `public/unpolish.config.json` · creates `app/unpolish-client.tsx` (a client component that starts Unpolish after hydration) · adds one import and `<Unpolish />` inside `<body>` in `app/layout` |
| **Plain HTML** (no `package.json`) | copies `unpolish/unpolish.js` and its schema · creates `unpolish.config.json` · adds one script tag before `</head>` on each top-level page. No `package.json`, no build step |
| **Anything else** — Next.js Pages Router, SvelteKit, Nuxt, Astro, Remix, Angular, CRA, a monorepo root, an unfamiliar layout | changes nothing and prints the exact integration to add (exit code 2). Agents can read it with `--json` |

The Vite entry block looks like this — `BASE_URL` keeps it working under a base path:

```js
// unpolish:start — lo-fi review themes. Remove with `npx unpolish remove` or delete this block.
import { init as initUnpolish } from 'unpolish';
initUnpolish({ configUrl: `${import.meta.env.BASE_URL}unpolish.config.json` });
// unpolish:end
```

`init` is safe to re-run: it skips what's in place, reuses your existing `unpolish.config.json` without touching it, never stacks a second integration on top of a script tag or import you added by hand, and doesn't reformat files or change other dependencies. It never prompts.

| Option | |
| --- | --- |
| `--dry-run` | Print the plan (with the lines it would add); change nothing |
| `--json` | Machine-readable report on stdout |
| `--scope all` | Default. Every build: local dev, preview deploys, production |
| `--scope dev` | Local development only (`import.meta.env.DEV` / `NODE_ENV`) |
| `--scope env:NAME` | Only builds where `NAME` is `"true"`, e.g. `env:VITE_UNPOLISH` |
| `--mode script` | Use the script-tag install even when there's a `package.json` |
| `--from <spec>` | Install the runtime from a tarball, URL or path instead of the registry |
| `--upgrade` | Re-pin an existing install (or vendored file) to this version |
| `--cwd <dir>` | Run as if from `<dir>` (in a monorepo, point it at one app) |

Exit codes: `0` done or nothing to do · `1` failed, nothing changed (e.g. the lockfile says pnpm but `pnpm` isn't installed) · `2` manual step needed, plan printed, nothing changed · `3` partially applied, the report lists what was and wasn't · `64` bad usage.

**Deployed previews.** The default scope includes production builds on purpose: review links only work where Unpolish is loaded. Choose `--scope dev` or `env:NAME` to leave it out of some builds, or set `"enabled": false` in a build's config. Hiding the controls (`"ui": "hidden"`) is not access control — anyone can still press `\`.

## Script tag and self-hosting

```html
<script src="unpolish/unpolish.js" data-config="unpolish.config.json" defer></script>
```

One file, no dependencies, starts itself. `data-config` resolves relative to the page (falling back to the script's folder). Keep `unpolish.config.json` next to your pages and commit it. Without `data-config` the built-in presets are used. Alternatives: inline `<script type="application/json" id="unpolish-config">{…}</script>` before the tag, `window.UnpolishConfig = {…}`, or `data-manual` and call `Unpolish.init({ config })` yourself.

Pin a version: the bundle's first line names it (`/*! Unpolish v0.1.3 …`). After publication, jsDelivr and unpkg serve every npm version at `https://cdn.jsdelivr.net/npm/unpolish@<version>/dist/unpolish.js` — use an exact version, never `latest`, for a prototype others review.

## In code

```js
import { init } from 'unpolish';
init({ configUrl: '/unpolish.config.json' });   // or init({ config: {...} })
```

Importing is side-effect free and safe during server rendering: `init()` returns `null` on the server and starts Unpolish once in the browser. Repeated calls (hot reload, React strict mode, a second import, a script tag on the same page) return the running instance instead of starting another. `getUnpolish()` returns it; `window.Unpolish` is the same object. Types are included.

```js
const u = init();
u.setTheme('sketch');                  // 'original' restores
u.update({ images: 'placeholder', border: { style: 'dashed' } });
u.getReviewLink({ hideUI: true });
u.on('change', (state) => {});        // also 'ready', 'open', 'close'
u.destroy();                           // remove the treatment and panel
```

## Use

- **`\`** or the launcher opens the panel. **1–4** pick a theme while it's open, **0** restores Original, **Esc** closes.
- **Edit theme** — the **Details** dial (how strongly the theme's character shows), colour, type & lines, images (*Match theme*, *B&W*, *Original*, *Placeholder*), shortcuts. **Reset preset** and **Copy configuration** at the bottom.
- **Review link** copies the current URL with `?unpolish=<theme>` and, optionally, `&unpolish-ui=hidden`. Values: `original`, `black-white`, `sketch`, `blueprint`, `pastel`. Links use the saved project preset, survive navigation in that tab, and leave your app's own parameters and hash alone.

## Configuration

`unpolish.config.json` is the shared, version-controlled preset. The starter file:

```json
{
  "$schema": "../node_modules/unpolish/schema/unpolish.config.schema.json",
  "version": 1,
  "id": "my-prototype",
  "defaultTheme": "original",
  "ui": "visible",
  "exclude": [],
  "shortcuts": { "toggle": "\\", "themes": {} },
  "themes": {}
}
```

Precedence: **review link → local draft (this browser) → project config → built-in presets.** Panel edits are saved in the browser only; **Copy configuration** gives you the full JSON to paste into this file (or hand to your agent). Only list what you change:

```jsonc
{
  "exclude": [".brand-logo"],           // extra regions that keep their original look
  "include": ["#tiny-map"],             // opt a skipped map/image back in (or set data-unpolish="keep")
  "roles": { ".my-chip": "fill" },     // classifier hints: surface | fill | media | icon | plain
  "launcher": "bottom-left",           // or top-right | top-left | false
  "webFonts": false,                   // system fonts instead of Google Fonts
  "shortcuts": { "toggle": "Alt+U", "themes": { "sketch": "Alt+S" } },
  "themes": {
    "sketch": { "details": 70, "typography": "hand", "border": { "weight": 2, "style": "hand" },
                "radius": 4, "shadows": "none", "images": "mono", "palette": { "accent": "#2563c9" } }
  },
  "overrides": { "blueprint": ".hero { background-color: var(--up-paper) !important; }" }
}
```

`exclude` is additive and keeps the original look (no placeholder). Unpolish already ignores `[data-unpolish-ignore]` and its own UI.

Maps, images and other heavy widgets are skipped automatically — they are not classified and Sketch draws one hatched placeholder on the container (`Map`, `Image`, `Canvas`, `Media`) instead of walking the subtree:

- **Media:** `img`, `picture`, `video`, `canvas`, `iframe`, `svg` internals, `object`, `embed`
- **Map widgets:** Leaflet (`.leaflet-container`), Mapbox/MapLibre (`.mapboxgl-map`, `.maplibregl-map`), Google Maps (`.gm-style`, `gmp-map`, `gmp-*`), OpenLayers (`.ol-viewport`), deck.gl, and `[role="application"]`
- **Heavy subtrees:** a node with a very high count of absolutely positioned children, or a lot of mutation churn, is marked skipped at runtime

To classify a skipped region anyway, set `data-unpolish="keep"` on it or list a selector in `include`. Do not do that on a map with thousands of markers. Put `data-unpolish-ignore` or an `exclude` selector on a region that must keep its real pixels with no placeholder.

The schema (`schema/unpolish.config.schema.json`) documents every field and gives editors autocomplete.

## Update

```sh
npx unpolish@latest init --upgrade
```

Re-pins the dependency (or replaces the vendored `unpolish/unpolish.js`) at the new exact version. Your config is kept as is.

## Remove

```sh
npx unpolish remove --dry-run
npx unpolish remove            # add --purge to delete unpolish.config.json too
```

Removes only what it can identify: the marked `unpolish:start…end` block, the generated Next.js client component and its import/`<Unpolish />`, Unpolish script tags, the vendored bundle and schema, and the dependency (with your package manager). Your configuration stays unless you pass `--purge`. Lines you added by hand without markers are reported, not guessed at. Visitors may keep a small `unpolish:*` entry in `localStorage`; it does nothing without the script.

## How it stays safe

Themes live in one `<style id="unpolish-theme">` (an `@layer`), `data-up` attributes and a hidden SVG filter set — Original removes all of it. They change colours, outlines, backgrounds, radii, shadows and fonts, never size, padding, position or border width. No element is replaced, wrapped or covered, so handlers, focus, form values, scroll and routes are untouched. New content is classified as it appears; open shadow roots get the theme too. The panel lives in its own shadow root.

## Limitations

- Canvas/WebGL, cross-origin iframes and closed shadow roots are left as they are.
- A custom component styled only through pseudo-elements or `:has()` may need a role hint or override.
- A typography swap can nudge text width; pick *Keep original* type when that matters.
- Modern browsers only: Chrome/Edge 111+, Safari 16.4+, Firefox 113+.
- `init` sets up Vite, Next.js App Router and plain HTML automatically; other frameworks get exact manual steps.

MIT License.
