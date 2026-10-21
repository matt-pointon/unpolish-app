// Renders the Open Graph image (1200×630) and apple-touch-icon (180×180)
// from an HTML template that uses the site's type, colours and wordmark.
//
//   node scripts/og-image.mjs
//
// Committed output is og.png (full brand-green background) and
// apple-touch-icon.png. `npm run build:site` copies those files; it does not
// require Playwright on Vercel.
//
// A bordered alternate (off-white fill, ~24px green frame) is written to
// .tmp/og-green-border.png and is not committed.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { OG_HEIGHT, OG_WIDTH } from './site-seo.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

// site/site.css :root tokens
const ACCENT = '#e6f36a';
const INK = '#141414';
const PAPER = '#f7f6f2';
const BORDER_PX = 24;

const MARK = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.75" y="2.75" width="18.5" height="18.5" rx="6" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 13.6c1.3-2.3 2.4-2.6 3.4-.9.9 1.6 1.9 1.7 3.1-.2 1.1-1.7 2.2-2 4.5-.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

function ogHtml({ bg, border = 0, gridAlpha = 0.06 }) {
  const grid = gridAlpha > 0
    ? `background-image: radial-gradient(circle at 1px 1px, rgba(20,20,20,${gridAlpha}) 1px, transparent 0); background-size: 22px 22px;`
    : '';
  const frame = border > 0 ? `border: ${border}px solid ${ACCENT};` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Instrument+Serif:ital@0;1&display=swap">
  <style>
    :root {
      --bg: ${bg};
      --ink: ${INK};
      --serif: "Instrument Serif", ui-serif, Georgia, serif;
      --sans: "Inter", ui-sans-serif, system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; background: var(--bg); color: var(--ink); }
    .card {
      position: relative; width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; padding: 72px 80px 80px;
      display: flex; flex-direction: column; justify-content: space-between;
      background-color: var(--bg);
      ${grid}
      ${frame}
    }
    .brand { display: inline-flex; align-items: center; gap: 12px; font: 650 28px/1 var(--sans); letter-spacing: -0.02em; }
    .brand svg { width: 36px; height: 36px; }
    h1 { margin: 0; font: 650 88px/0.98 var(--sans); letter-spacing: -0.045em; max-width: 14ch; }
    h1 em { font-family: var(--serif); font-weight: 400; font-style: italic; letter-spacing: -0.02em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">${MARK}Unpolish</div>
    <h1>Less polish.<br><em>Better conversations.</em></h1>
  </div>
</body>
</html>`;
}

const ICON_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; width: 180px; height: 180px; background: #141414; }
    svg { width: 180px; height: 180px; display: block; }
  </style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <rect x="1" y="1" width="22" height="22" rx="7" fill="#141414"/>
    <path d="M6.5 13.6c1.3-2.3 2.4-2.6 3.4-.9.9 1.6 1.9 1.7 3.1-.2 1.1-1.7 2.2-2 4.5-.4" stroke="${ACCENT}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
</body>
</html>`;

function browserPath() {
  return ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
}

async function withBrowser(fn) {
  const browser = await chromium.launch({ executablePath: browserPath() });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function shot(browser, html, { width, height, path }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path, type: 'png', omitBackground: false });
  await page.close();
}

export async function renderOgImages() {
  const og = join(root, 'og.png');
  const icon = join(root, 'apple-touch-icon.png');
  const tmp = join(root, '.tmp');
  mkdirSync(tmp, { recursive: true });
  const border = join(tmp, 'og-green-border.png');
  await withBrowser(async (browser) => {
    await shot(browser, ogHtml({ bg: ACCENT, gridAlpha: 0.055 }), { width: OG_WIDTH, height: OG_HEIGHT, path: og });
    await shot(browser, ogHtml({ bg: PAPER, border: BORDER_PX, gridAlpha: 0.08 }), { width: OG_WIDTH, height: OG_HEIGHT, path: border });
    await shot(browser, ICON_HTML, { width: 180, height: 180, path: icon });
  });
  return { og, icon, border };
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return import.meta.url === pathToFileURL(resolve(process.argv[1])).href; } catch { return false; }
}

if (invokedDirectly()) {
  renderOgImages().then(({ og, icon, border }) => {
    console.log(`wrote ${og} (${statSync(og).size} bytes)`);
    console.log(`wrote ${icon} (${statSync(icon).size} bytes)`);
    console.log(`wrote ${border} (${statSync(border).size} bytes)`);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
