// Fleet-map fps: Original / Sketch / Blueprint / 0.1.2, cars moving, optional pan.
// Usage: node scripts/fleet-map-shots.mjs
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '/opt/cursor/artifacts';
const STORE = '/cursor/stores/self/artifacts';
const BASE = 'http://localhost:4174';
const chrome = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
mkdirSync(OUT, { recursive: true });
mkdirSync(STORE, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });

async function waitReady(page) {
  await page.waitForFunction(() => window.Unpolish && window.__mapReady && window.__fleet && window.__fleet.carsOn, { timeout: 25_000 });
  await page.waitForTimeout(300);
}

async function measure(page, ms) {
  return page.evaluate(async (ms) => {
    const longTasks = [];
    const queue = [];
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch (e) { /* noop */ }
    let frames = 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      function tick() {
        frames++;
        if (window.Unpolish && window.Unpolish._internal.queueSize) {
          queue.push(window.Unpolish._internal.queueSize().pending);
        }
        if (performance.now() - t0 < ms) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    if (po) po.disconnect();
    const elapsed = performance.now() - t0;
    const el = document.getElementById('map');
    const tiles = el && el.querySelector('.leaflet-tile-pane');
    const img = el && el.querySelector('.car-dot img');
    const vis = tiles || el;
    return {
      frames, elapsed,
      fps: frames / (elapsed / 1000),
      max: longTasks.reduce((m, d) => Math.max(m, d), 0),
      count: longTasks.length,
      queueMax: queue.length ? queue.reduce((m, n) => Math.max(m, n), 0) : null,
      queueLast: queue.length ? queue[queue.length - 1] : null,
      busy: el ? el.hasAttribute('data-unpolish-busy') : null,
      tileFilter: vis ? getComputedStyle(vis).filter : null,
      mapFilter: el ? getComputedStyle(el).filter : null,
      imgFilter: img ? getComputedStyle(img).filter : null,
      imgSkip: img ? img.getAttribute('data-unpolish-skip') : null,
      imgUp: img ? img.getAttribute('data-up') : null
    };
  }, ms);
}

async function shot(page, name) {
  const file = join(OUT, name);
  await page.getByTestId('map').screenshot({ path: file, animations: 'allow' });
  return file;
}

async function runScene(page, { n, kind, icon, theme, pan, ms, version }) {
  if (theme && theme !== 'original') await page.evaluate((id) => window.Unpolish.setTheme(id), theme);
  if (theme === 'original') await page.evaluate(() => window.Unpolish.setTheme('original'));
  await page.waitForTimeout(400);
  if (pan) await page.evaluate(() => window.__fleet.startPan());
  else await page.evaluate(() => window.__fleet.stopPan());
  await page.waitForTimeout(pan ? 80 : 300);
  const stats = await measure(page, ms);
  if (pan) await page.evaluate(() => window.__fleet.stopPan());
  return { n, kind, icon, theme: theme || 'original', pan: !!pan, version: version || '0.1.3', ...stats };
}

const rows = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

// 10s matrix on 0.1.3
for (const n of [50, 500, 2000]) {
  for (const kind of n === 500 ? ['div', 'circle'] : ['div']) {
    const icon = kind === 'div' ? 'img' : 'img';
    await page.goto(`${BASE}/tests/fixtures/leaflet-fleet.html?n=${n}&kind=${kind}&icon=${icon}`, { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    for (const theme of ['original', 'sketch', 'blueprint']) {
      for (const pan of [false, true]) {
        const row = await runScene(page, { n, kind, icon, theme, pan, ms: 10_000, version: '0.1.3' });
        rows.push(row);
        console.log(JSON.stringify(row));
      }
    }
  }
}

// background-image variant at 500, Sketch cars-only
await page.goto(`${BASE}/tests/fixtures/leaflet-fleet.html?n=500&kind=div&icon=bg`, { waitUntil: 'domcontentloaded' });
await waitReady(page);
const bg = await runScene(page, { n: 500, kind: 'div', icon: 'bg', theme: 'sketch', pan: false, ms: 10_000, version: '0.1.3' });
rows.push(bg);
console.log('bg-icon', JSON.stringify(bg));

// Screenshots at 500 img icons, cars moving
await page.goto(`${BASE}/tests/fixtures/leaflet-fleet.html?n=500&kind=div&icon=img`, { waitUntil: 'domcontentloaded' });
await waitReady(page);
await page.evaluate(() => window.Unpolish.setTheme('sketch'));
await page.waitForTimeout(500);
await shot(page, 'fleet-500-sketch-cars.png');
await page.evaluate(() => window.Unpolish.setTheme('blueprint'));
await page.waitForTimeout(500);
await shot(page, 'fleet-500-blueprint-cars.png');
await page.evaluate(() => window.Unpolish.setTheme('original'));
await page.waitForTimeout(300);
await shot(page, 'fleet-500-original-cars.png');

// Close-ups: stop motion so Playwright does not wait for a moving 22px marker.
async function carCloseup(page, name, size = 200) {
  await page.evaluate(() => window.__fleet.stopCars());
  await page.waitForTimeout(120);
  const clip = await page.evaluate((size) => {
    const map = document.getElementById('map').getBoundingClientRect();
    const cx = map.left + map.width * 0.52;
    const cy = map.top + map.height * 0.42;
    let best = null, bestD = Infinity;
    for (const el of document.querySelectorAll('.car-marker, .car-dot')) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.right < map.left || r.left > map.right) continue;
      const d = (r.left + r.width / 2 - cx) ** 2 + (r.top + r.height / 2 - cy) ** 2;
      if (d < bestD) { bestD = d; best = r; }
    }
    if (!best) throw new Error('no car marker in view');
    return {
      x: Math.max(0, Math.round(best.left + best.width / 2 - size / 2)),
      y: Math.max(0, Math.round(best.top + best.height / 2 - size / 2)),
      width: size,
      height: size
    };
  }, size);
  await page.screenshot({ path: join(OUT, name), clip, animations: 'disabled' });
}

await page.evaluate(() => window.Unpolish.setTheme('sketch'));
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'fleet-500-sketch-ui.png'), animations: 'allow' });
await carCloseup(page, 'fleet-car-icon-sketch.png', 220);
await page.evaluate(() => window.Unpolish.setTheme('blueprint'));
await page.waitForTimeout(300);
await carCloseup(page, 'fleet-car-icon-blueprint.png', 220);
await page.evaluate(() => window.Unpolish.setTheme('original'));
await page.waitForTimeout(200);
await carCloseup(page, 'fleet-car-icon-original.png', 220);
await page.evaluate(() => window.__fleet.startCars());

// 0.1.2 comparison: 50 and 500, cars moving, no pan; race a hang
async function run012(n, pan) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await p.route('**/unpolish/unpolish.js', (route) => {
    route.continue({ url: BASE + '/releases/0.1.2/unpolish.js' });
  });
  const started = Date.now();
  try {
    await p.goto(`${BASE}/tests/fixtures/leaflet-fleet.html?n=${n}&kind=div&icon=img`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await p.waitForFunction(() => window.Unpolish && window.__mapReady && window.__fleet, { timeout: 15_000 });
    const result = await Promise.race([
      (async () => {
        await p.evaluate(() => { window.__fleet.startCars(); window.Unpolish.setTheme('sketch'); });
        if (pan) await p.evaluate(() => window.__fleet.startPan());
        await p.waitForTimeout(200);
        const stats = await measure(p, 3000);
        return { n, kind: 'div', icon: 'img', theme: 'sketch', pan: !!pan, version: '0.1.2', frozen: false, elapsedMs: Date.now() - started, ...stats };
      })(),
      new Promise((resolve) => setTimeout(() => resolve({
        n, kind: 'div', icon: 'img', theme: 'sketch', pan: !!pan, version: '0.1.2',
        frozen: true, fps: 0, max: 5000, elapsedMs: Date.now() - started
      }), 8000))
    ]);
    try { await p.close({ runBeforeUnload: false }); } catch (e) { /* stuck */ }
    return result;
  } catch (e) {
    try { await p.close({ runBeforeUnload: false }); } catch (err) { /* noop */ }
    return { n, kind: 'div', icon: 'img', theme: 'sketch', pan: !!pan, version: '0.1.2', frozen: true, error: String(e.message || e), fps: 0, max: 5000, elapsedMs: Date.now() - started };
  }
}

for (const n of [50, 500]) {
  for (const pan of [false, true]) {
    const row = await run012(n, pan);
    rows.push(row);
    console.log('0.1.2', JSON.stringify(row));
  }
}

await browser.close();

const report = { idleMs: 260, tilePaneFilter: true, rows };
writeFileSync(join(OUT, 'fleet-map-report.json'), JSON.stringify(report, null, 2));
const files = [
  'fleet-500-sketch-cars.png',
  'fleet-500-blueprint-cars.png',
  'fleet-500-original-cars.png',
  'fleet-500-sketch-ui.png',
  'fleet-car-icon-sketch.png',
  'fleet-car-icon-blueprint.png',
  'fleet-car-icon-original.png',
  'fleet-map-report.json'
];
for (const f of files) {
  try { copyFileSync(join(OUT, f), join(STORE, f)); } catch (e) { console.warn('copy skip', f, e.message); }
}
console.log('wrote', OUT, 'and', STORE);
console.log(JSON.stringify(report.rows.map((r) => ({
  n: r.n, kind: r.kind, icon: r.icon, theme: r.theme, pan: r.pan, version: r.version,
  fps: r.fps && Number(r.fps.toFixed(1)), max: r.max, queueMax: r.queueMax, busy: r.busy, frozen: r.frozen
})), null, 2));
