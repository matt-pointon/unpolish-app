# Unpolish

**Less polish. Better conversations.**

Unpolish puts a reversible lo-fi theme over a working web prototype — Black & White, Sketch, Blueprint or Pastel Blocks — so stakeholder reviews focus on structure, content and flow while every click, route and form keeps working.

## What's here

| Path | What it is |
| --- | --- |
| [`unpolish/`](unpolish/) | **The harness** — `unpolish.js` (one dependency-free file), `unpolish.config.json`, its JSON schema, and the [integration & removal guide](unpolish/README.md) |
| [`index.html`](index.html) + [`site/`](site/) | Product website with a live demo and the copyable agent installation prompt |
| [`site/demo/`](site/demo/) | The polished prototype used in the website demo |
| [`examples/`](examples/) | Validation apps: plain HTML, React + Tailwind, Vue, Svelte |
| [`tests/`](tests/) | Playwright suite; results and limits in [`docs/VALIDATION.md`](docs/VALIDATION.md) |
| [`docs/ANIMATION.md`](docs/ANIMATION.md) | Motion decisions and review |

## Try it

```sh
npm install
npm run serve            # http://localhost:4173 — website + demo
```

Open the site, use the demo controls, or press `\` inside the demo prototype for the real panel. The website is fully static, so any static host works (GitHub Pages from the repository root, Netlify, S3…). The installation prompt links to the `unpolish/` files on whatever origin serves the site, so publish the site before sharing the prompt with others.

## Install into a prototype

Copy the prompt from the website into your coding agent, or do it by hand:

```html
<!-- after copying unpolish/ into your static assets -->
<script src="/unpolish/unpolish.js" data-config="unpolish.config.json" defer></script>
```

Then press `\`. See [`unpolish/README.md`](unpolish/README.md) for framework-specific setup, configuration, review links, the JS API and removal.

## Test

```sh
npm test                 # builds the Vite examples, then runs Playwright
```

Chromium is used from `/opt/pw-browsers` when present; otherwise run `npx playwright install chromium` first.
