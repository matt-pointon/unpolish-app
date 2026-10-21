# What was validated

Automated with Playwright (`npm test`) in Chromium 141 (Playwright 1.56), against five apps served locally. **37 tests, all passing** at the time of writing. Firefox and Safari were **not** run.

| App | Stack & styling | How Unpolish is loaded |
| --- | --- | --- |
| `site/demo` (Fieldtrip) | Plain HTML/JS, custom properties, gradients, SVG sprite icons, `<dialog>`, `@starting-style` | Script tag + `data-config` |
| `examples/plain-html` (Harbor) | Multi-page static site, BEM CSS, inline styles, `<details>` menu, CSS `::after` tooltip/indicators, canvas chart, web component with **open shadow root** | Script tag + `data-config` |
| `examples/react` (Ledger) | React 19, **Tailwind v4** (oklch colours, rings, `bg-clip-text`), history routing, portals, toast | Bundled `import` + `Unpolish.init({ config })` |
| `examples/vue` (Trailhead) | Vue 3 SFC **scoped styles**, serif type, hash routing, `<Teleport>` dialog | Vendored in `public/`, script tag |
| `examples/svelte` (Pulse) | Svelte 5 component styles, **dark mode**, CSS variables, history routing | Script tag + **inline JSON** config |

## Checklist

| Requirement | Evidence (test) |
| --- | --- |
| Each preset applies a coherent, visibly distinct treatment | `themes.spec` — every theme on every app classifies elements and produces a different render from every other theme and Original; screenshots reviewed by eye during development |
| Original restores cleanly | `themes.spec` — after visiting all themes: no `data-up`/`data-unpolish` attributes, no Unpolish nodes, and the computed styles of every element equal the pre-Unpolish values |
| Detailed controls never move elements | `themes.spec` — element boxes identical across all themes (typography kept), placeholder, black-and-white and theme-matched images, 4px hand strokes, radius 0, flat shadows, Details 0 and 100 |
| Typography swaps keep shifts small | `themes.spec` — on the demo page the largest block shift with theme fonts was 0px (B&W), 22px (Sketch), 18px (Blueprint), 18px (Pastel), from text rewrapping. Choose *Keep original* type for pixel-tight layouts |
| Controls work and reset correctly | `harness.spec` "pointer flow" — editor groups start collapsed, status colors sit behind a disclosure; palette, typography, lines, images, details edited via the panel; per-theme memory; Reset preset; Discard local changes |
| Dynamic content gets the active treatment | `integrity.spec` — React portal dialog/toast/new rows, Vue added list items and Teleport dialog, Svelte loaded cards and menus, plain-HTML appended rows, demo activity feed |
| Forms, navigation, menus, dialogs keep working | `integrity.spec` — validation states, disabled/loading buttons, history/hash routing, back button, multi-page navigation, menus, native and custom dialogs, tabs |
| State is preserved | `integrity.spec` — typed values, checkbox state, focus and scroll position survive five theme switches; handlers still fire |
| Visual states stay distinguishable | `integrity.spec` — status badges keep tone roles and get distinct B&W patterns; selected vs unselected tabs differ; disabled controls muted; hover feedback present; invalid fields marked |
| Exemptions, canvas, overrides, role hints | `themes.spec` — excluded regions untouched (incl. inherited font), canvas left alone, per-theme CSS override and role hint applied from config |
| Open shadow roots | `themes.spec` — the web component's shadow content is themed and restored |
| Image placeholders keep size and meaning | `themes.spec` — same box, `alt` intact, still exposed as `role=img` |
| Shortcuts respect typing contexts and custom assignments | `harness.spec` — `\`, 1–4, 0, Esc, arrows; nothing fires in inputs, textareas or contenteditable; config shortcut Alt+B; recording rejects Ctrl/⌘ combos, duplicates and 0–4; reassigned toggle |
| Configuration can be saved and loaded | `harness.spec` — local drafts persist across reload and show *Local draft*; Copy configuration yields agent instructions + valid JSON with the tuned values; project config values load from file, inline JSON and bundled import |
| Review URLs reproduce saved settings | `harness.spec` — theme and hidden UI from URL; hidden UI still recalled with `\`; persists across client-side navigation, reload and full page loads; ignores the recipient's local edits; invalid values and the retired `unpolish-roughness` parameter fall back quietly; share options are chosen before copying; copied links keep path, app query and hash; the unsaved-edit warning and "Link copied" state are recomputed on every change, including the reported discard-then-switch case |
| Harness styles don't leak, host styles don't leak in | `harness.spec` — computed styles of every host element identical with and without Unpolish loaded (Original); aggressive host `!important` CSS doesn't change the panel |
| Reduced motion and keyboard access | `harness.spec` — no scale animation under `prefers-reduced-motion`; keyboard opens are instant; focus moves into the panel and returns on Esc; every visible control has an accessible name; bottom sheet fits a 375px viewport; on an emulated phone (touch, DPR 3) the launcher and panel stay inside the visual viewport even when the host page overflows horizontally |
| One-line installer | `install.spec` — runs the real `curl … | sh` command against throwaway Vite-style, plain multi-page, SvelteKit and Next.js projects: files land in `public/`, the root or `static/`; tags are inserted (or, for Next.js, the exact `<Script>` line is printed and app code is untouched); re-runs keep the project's config and never duplicate tags; `--uninstall` restores the HTML byte-for-byte; an installed fixture loads and themes in the browser. Run with POSIX `sh` (dash) on Linux only — macOS `sh`, WSL and Git Bash were not exercised |
| Website | `site.spec` — Copy install command shows feedback and copies a working one-liner; every file it and the agent prompt reference returns 200; the configurator drives its own live preview; the demo is visible on the first screen and drives the real harness in the frame (and syncs back); no horizontal scroll at 375px, where the theme picker becomes a dropdown and a full-screen demo link is offered |

## Known gaps and limitations

- Only Chromium was automated. The CSS used (`@layer`, `color-mix`, `:where`, nesting for overrides, `outline` following `border-radius`) targets Chrome/Edge 111+, Safari 16.4+, Firefox 113+, but those browsers weren't exercised here.
- Canvas/WebGL, cross-origin iframes and closed shadow roots keep their original look.
- Hand-drawn and dashed strokes are painted as backgrounds, so a child with an opaque background flush to its parent's edge can hide part of the stroke (solid strokes use outlines and are not affected).
- In Black & White, small status dots become identical black dots; status is still conveyed by badges, patterns and labels, but colour-only indicators lose their meaning.
- Elements styled only via `:has()`/sibling selectors are re-read on `change` and `click`; other triggers (e.g. timers changing a parent's class elsewhere) are caught by the attribute observer, but purely selector-driven changes without any DOM mutation may stay stale until the next interaction.
- Screen-reader output was checked structurally (names, roles, live regions), not with a real screen reader.
