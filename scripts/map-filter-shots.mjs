// Seattle idle-edge / mid-pan-gray shots + hybrid fps vs pure gray / pure edge.
// Usage: node scripts/map-filter-shots.mjs
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const OUT = '/opt/cursor/artifacts';
const STORE = '/cursor/stores/self/artifacts';
const BASE = 'http://localhost:4174';
const chrome = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

mkdirSync(OUT, { recursive: true });
mkdirSync(STORE, { recursive: true });

async function waitMap(page) {
  await page.waitForFunction(() => window.Unpolish && window.__mapReady && window.__seattle, { timeout: 20_000 });
  await page.waitForSelector('.leaflet-marker-icon');
  await page.waitForSelector('.leaflet-popup');
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('.leaflet-tile-pane img.leaflet-tile')];
    return imgs.length >= 6 && imgs.every((img) => img.complete && img.naturalWidth > 0);
  }, { timeout: 15_000 });
  await page.waitForTimeout(200);
}

async function shotMap(page, name, animations = 'disabled') {
  const map = page.getByTestId('map');
  const file = join(OUT, name);
  await map.screenshot({ path: file, animations });
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

async function mapFilter(page) {
  return page.evaluate(() => {
    const el = document.getElementById('map');
    const vis = el.querySelector('.leaflet-tile-pane') || el;
    return { filter: getComputedStyle(vis).filter, busy: el.hasAttribute('data-unpolish-busy'), vis: vis === el ? 'root' : 'tiles' };
  });
}

async function waitBusy(page, wantBusy) {
  await page.waitForFunction((wantBusy) => {
    const el = document.getElementById('map');
    const vis = el.querySelector('.leaflet-tile-pane') || el;
    const f = getComputedStyle(vis).filter;
    const busy = el.hasAttribute('data-unpolish-busy');
    if (wantBusy) return busy && /grayscale/.test(f);
    return !busy && /up-f-skip-edge/.test(f);
  }, wantBusy, { timeout: 4000 });
}

async function switchback(page, stop) {
  return page.evaluate(async (stop) => {
    const el = document.getElementById('map');
    const longTasks = [];
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch (e) { /* noop */ }
    if (stop === 'heavy') window.__heavy.stopPan();
    else window.__seattle.stopPan();
    const vis = el.querySelector('.leaflet-tile-pane') || el;
    const t0 = performance.now();
    await new Promise((resolve) => {
      function tick() {
        const f = getComputedStyle(vis).filter;
        if (/up-f-skip-edge/.test(f) && !el.hasAttribute('data-unpolish-busy')) {
          resolve();
          return;
        }
        if (performance.now() - t0 > 2000) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    if (po) po.disconnect();
    return {
      ms: performance.now() - t0,
      max: longTasks.reduce((m, d) => Math.max(m, d), 0),
      count: longTasks.length,
      filter: getComputedStyle(vis).filter,
      busy: el.hasAttribute('data-unpolish-busy')
    };
  }, stop);
}

function forceFilter(page, value) {
  return page.evaluate((value) => {
    document.querySelectorAll('.leaflet-container, [data-unpolish-skip="map"], [data-unpolish-skip="image"], [data-unpolish-skip="canvas"]').forEach((el) => {
      if (value) el.style.setProperty('filter', value, 'important');
      else el.style.removeProperty('filter');
    });
  }, value);
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
await waitBusy(page, false);
const seattleIdleLook = await mapFilter(page);
await shotMap(page, 'seattle-map-sketch.png');
await shotMap(page, 'seattle-map-idle-edge.png');
await shotMap(page, 'seattle-map-sketch-edge.png');

const seattleIdle = await measure(page, 3000);

await page.evaluate(() => window.__seattle.startPan());
await waitBusy(page, true);
const seattlePanLook = await mapFilter(page);
await shotMap(page, 'seattle-map-pan-gray.png', 'allow');
const seattlePan = await measure(page, 3000);
const seattleSwitch = await switchback(page, 'seattle');

await page.evaluate(() => window.Unpolish.setTheme('blueprint'));
await page.waitForTimeout(400);
await waitMap(page);
await shotMap(page, 'seattle-map-blueprint.png');

// Heavy fixture: hybrid idle / pan / switchback vs locked gray and locked edge.
await page.goto(BASE + '/tests/fixtures/heavy-map.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.Unpolish && window.__heavy && window.__heavy.nodes >= 12000);
await page.evaluate(() => window.Unpolish.setTheme('sketch'));
await page.waitForTimeout(400);
await waitBusy(page, false);
const heavyIdleLook = await mapFilter(page);
const heavyIdle = await measure(page, 3000);
await page.locator('[data-testid="photo"]').screenshot({ path: join(OUT, 'heavy-map-static-image.png'), animations: 'disabled' });
const heavyImage = await measure(page, 2000);

await page.evaluate(() => window.__heavy.startPan());
await waitBusy(page, true);
const heavyPanLook = await mapFilter(page);
const heavyPan = await measure(page, 3000);
const heavySwitch = await switchback(page, 'heavy');

await page.evaluate(() => window.__heavy.startPan());
await page.waitForTimeout(80);
await forceFilter(page, 'grayscale(1) contrast(1.35) brightness(1.05)');
const grayPan = await measure(page, 3000);
await forceFilter(page, 'url(#up-f-skip-edge)');
const edgePan = await measure(page, 3000);
await page.evaluate(() => window.__heavy.stopPan());
await forceFilter(page, null);

await browser.close();

const report = {
  sketchIdle: 'url(#up-f-skip-edge) — pencil lines while still',
  sketchBusy: 'grayscale(1) contrast(1.35) brightness(1.05) — CSS functions while moving',
  blueprint: 'grayscale + sepia + hue-rotate toward blueprint ink (no hybrid swap)',
  idleMs: 260,
  seattle: {
    idleLook: seattleIdleLook,
    panLook: seattlePanLook,
    idle: seattleIdle,
    pan: seattlePan,
    switchback: seattleSwitch
  },
  heavy: {
    idleLook: heavyIdleLook,
    panLook: heavyPanLook,
    idle: heavyIdle,
    pan: heavyPan,
    switchback: heavySwitch,
    staticImage: heavyImage,
    lockedGrayPan: grayPan,
    lockedEdgePan: edgePan
  }
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
  'seattle-map-idle-edge.png',
  'seattle-map-pan-gray.png',
  'seattle-map-composite-3.png',
  'seattle-map-composite-4.png',
  'seattle-map-filter-report.json',
  'heavy-map-static-image.png',
]) {
  try { copyFileSync(join(OUT, f), join(STORE, f)); } catch (e) { console.warn('copy skip', f, e.message); }
}
console.log('wrote', OUT, 'and', STORE);
