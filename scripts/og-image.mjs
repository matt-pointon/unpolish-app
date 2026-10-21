// Renders the Open Graph image (1200×630) and apple-touch-icon (180×180)
// from an HTML template that uses the site's type, colours and wordmark.
//
//   node scripts/og-image.mjs
//
// Output is committed as og.png and apple-touch-icon.png. `npm run build:site`
// copies those files; it does not require Playwright on Vercel.
import { existsSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { OG_HEIGHT, OG_WIDTH } from './site-seo.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

const MARK = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.75" y="2.75" width="18.5" height="18.5" rx="6" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 13.6c1.3-2.3 2.4-2.6 3.4-.9.9 1.6 1.9 1.7 3.1-.2 1.1-1.7 2.2-2 4.5-.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

const OG_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Instrument+Serif:ital@0;1&display=swap">
  <style>
    :root {
      --bg: #f7f6f2;
      --ink: #141414;
      --serif: "Instrument Serif", ui-serif, Georgia, serif;
      --sans: "Inter", ui-sans-serif, system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; background: var(--bg); color: var(--ink); }
    .card {
      position: relative; width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; padding: 72px 80px 80px;
      display: flex; flex-direction: column; justify-content: space-between;
      background-image: radial-gradient(circle at 1px 1px, rgba(20,20,20,.08) 1px, transparent 0);
      background-size: 22px 22px;
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
    <path d="M6.5 13.6c1.3-2.3 2.4-2.6 3.4-.9.9 1.6 1.9 1.7 3.1-.2 1.1-1.7 2.2-2 4.5-.4" stroke="#e6f36a" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
</body>
</html>`;

function browserPath() {
  return ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
}

async function shot(html, { width, height, path }) {
  const browser = await chromium.launch({ executablePath: browserPath() });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await page.screenshot({ path, type: 'png', omitBackground: false });
  } finally {
    await browser.close();
  }
}

export async function renderOgImages() {
  const og = join(root, 'og.png');
  const icon = join(root, 'apple-touch-icon.png');
  await shot(OG_HTML, { width: OG_WIDTH, height: OG_HEIGHT, path: og });
  await shot(ICON_HTML, { width: 180, height: 180, path: icon });
  return { og, icon };
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return import.meta.url === pathToFileURL(resolve(process.argv[1])).href; } catch { return false; }
}

if (invokedDirectly()) {
  renderOgImages().then(({ og, icon }) => {
    console.log(`wrote ${og} (${statSync(og).size} bytes)`);
    console.log(`wrote ${icon} (${statSync(icon).size} bytes)`);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
