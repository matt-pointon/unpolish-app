// Realistic Leaflet map shots + skip-filter fps on the heavy fixture.
// Usage: node scripts/map-filter-shots.mjs
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const OUT = '/opt/cursor/artifacts';
const STORE = '/cursor/stores/self/artifacts';
const BASE = 'http://localhost:4174';
const chrome = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
async function applyEdge(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.leaflet-container, [data-unpolish-skip="map"]').forEach((el) => {
      el.style.setProperty('filter', 'url(#up-f-skip-edge)', 'important');
    });
  });
}

mkdirSync(OUT, { recursive: true });
mkdirSync(STORE, { recursive: true });

async function waitMap(page) {
  await page.waitForFunction(() => window.Unpolish && window.__mapReady, { timeout: 20_000 });
  await page.waitForSelector('.leaflet-marker-icon');
  await page.waitForSelector('.leaflet-popup');
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('.leaflet-tile-pane img.leaflet-tile')];
    return imgs.length >= 6 && imgs.every((img) => img.complete && img.naturalWidth > 0);
  }, { timeout: 15_000 });
  await page.waitForTimeout(200);
}

async function shotMap(page, name) {
  const map = page.getByTestId('map');
  const file = join(OUT, name);
  await map.screenshot({ path: file, animations: 'disabled' });
  return file;
}

async function measure(page, ms = 3000) {
  return page.evaluate(async (ms) => {
    const longTasks = [];
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch (e) { /* no longtask */ }
    let frames = 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      function tick() {
        frames++;
        if (performance.now() - t0 < ms) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    if (po) po.disconnect();
    const elapsed = performance.now() - t0;
    const max = longTasks.reduce((m, d) => Math.max(m, d), 0);
    return { frames, elapsed, fps: frames / (elapsed / 1000), max, count: longTasks.length };
  }, ms);
}

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

await page.goto(BASE + '/tests/fixtures/leaflet-seattle.html', { waitUntil: 'domcontentloaded' });
await waitMap(page);

await shotMap(page, 'seattle-map-original.png');

await page.evaluate(() => window.Unpolish.setTheme('sketch'));
await page.waitForTimeout(400);
await waitMap(page);
await shotMap(page, 'seattle-map-sketch.png');

await page.evaluate(() => window.Unpolish.setTheme('blueprint'));
await page.waitForTimeout(400);
await waitMap(page);
await shotMap(page, 'seattle-map-blueprint.png');

await page.evaluate(() => window.Unpolish.setTheme('sketch'));
await page.waitForTimeout(300);
await applyEdge(page);
await page.waitForTimeout(300);
const edgeFilter = await page.evaluate(() => getComputedStyle(document.getElementById('map')).filter);
if (!/up-f-skip-edge/.test(edgeFilter)) throw new Error('edge filter did not apply: ' + edgeFilter);
await waitMap(page);
await shotMap(page, 'seattle-map-sketch-edge.png');

// Heavy fixture fps: default Sketch CSS filter vs SVG edge filter.
await page.goto(BASE + '/tests/fixtures/heavy-map.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.Unpolish && window.__heavy && window.__heavy.nodes >= 12000);
await page.evaluate(() => window.Unpolish.setTheme('sketch'));
await page.waitForTimeout(1100);
const cssFps = await measure(page, 3000);
await applyEdge(page);
await page.waitForTimeout(400);
const edgeOn = await page.evaluate(() => getComputedStyle(document.getElementById('map')).filter);
if (!/up-f-skip-edge/.test(edgeOn)) throw new Error('heavy edge filter did not apply: ' + edgeOn);
const edgeFps = await measure(page, 3000);

await browser.close();

const report = {
  sketchDefault: 'grayscale(1) contrast(1.35) brightness(1.05) — CSS filter functions only',
  sketchEdge: 'url(#up-f-skip-edge) — feColorMatrix grayscale + feConvolveMatrix edge + threshold + paper tint',
  blueprint: 'grayscale + sepia + hue-rotate toward blueprint ink',
  heavy: { css: cssFps, edge: edgeFps },
};
writeFileSync(join(OUT, 'seattle-map-filter-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const stitch = spawnSync('python3', [join(process.cwd(), 'scripts/map-filter-composite.py')], { stdio: 'inherit' });
if (stitch.status !== 0) process.exit(stitch.status || 1);

for (const f of [
  'seattle-map-original.png',
  'seattle-map-sketch.png',
  'seattle-map-blueprint.png',
  'seattle-map-sketch-edge.png',
  'seattle-map-composite-3.png',
  'seattle-map-composite-4.png',
  'seattle-map-filter-report.json',
]) {
  copyFileSync(join(OUT, f), join(STORE, f));
}
console.log('wrote', OUT, 'and', STORE);
