// Marker-icon filter variants vs current unfiltered PR #10.
// Usage: node scripts/fleet-marker-filter-shots.mjs
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

function median(nums) {
  const a = nums.slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

async function waitReady(page) {
  await page.waitForFunction(() => window.Unpolish && window.__mapReady && window.__fleet && window.__fleet.carsOn, { timeout: 25_000 });
  await page.waitForTimeout(250);
}

async function measure(page, ms) {
  return page.evaluate(async (ms) => {
    const longTasks = [];
    const queue = [];
    const dts = [];
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch (e) { /* noop */ }
    let frames = 0;
    let last = performance.now();
    const t0 = last;
    await new Promise((resolve) => {
      function tick() {
        const now = performance.now();
        dts.push(now - last);
        last = now;
        frames++;
        if (window.Unpolish && window.Unpolish._internal.queueSize) {
          queue.push(window.Unpolish._internal.queueSize().pending);
        }
        if (now - t0 < ms) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    if (po) po.disconnect();
    const elapsed = performance.now() - t0;
    const sorted = dts.slice(1).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medDt = !sorted.length ? null : (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
    const el = document.getElementById('map');
    const tiles = el && el.querySelector('.leaflet-tile-pane');
    const pane = el && el.querySelector('.leaflet-marker-pane');
    const img = el && el.querySelector('.car-dot img');
    return {
      frames, elapsed,
      fps: frames / (elapsed / 1000),
      medianFps: medDt ? 1000 / medDt : null,
      max: longTasks.reduce((m, d) => Math.max(m, d), 0),
      count: longTasks.length,
      queueMax: queue.length ? queue.reduce((m, n) => Math.max(m, n), 0) : null,
      queueLast: queue.length ? queue[queue.length - 1] : null,
      busy: el ? el.hasAttribute('data-unpolish-busy') : null,
      markers: document.documentElement.getAttribute('data-unpolish-markers'),
      tileFilter: tiles ? getComputedStyle(tiles).filter : null,
      paneFilter: pane ? getComputedStyle(pane).filter : null,
      imgFilter: img ? getComputedStyle(img).filter : null,
      imgSkip: img ? img.getAttribute('data-unpolish-skip') : null,
      imgUp: img ? img.getAttribute('data-up') : null
    };
  }, ms);
}

async function runTrial(page, { theme, markers, pan, ms }) {
  if (theme === 'original') await page.evaluate(() => window.Unpolish.setTheme('original'));
  else await page.evaluate((id) => window.Unpolish.setTheme(id), theme);
  await page.evaluate((mode) => window.Unpolish._internal.setMapMarkers(mode), markers);
  await page.waitForTimeout(280);
  if (pan) await page.evaluate(() => window.__fleet.startPan());
  else await page.evaluate(() => window.__fleet.stopPan());
  await page.waitForTimeout(pan ? 80 : 200);
  const stats = await measure(page, ms);
  if (pan) await page.evaluate(() => window.__fleet.stopPan());
  return stats;
}

const variants = [
  { name: 'original', theme: 'original', markers: 'original' },
  { name: 'sketch-unfiltered', theme: 'sketch', markers: 'original' },
  { name: 'sketch-pane', theme: 'sketch', markers: 'pane' },
  { name: 'sketch-img', theme: 'sketch', markers: 'img' },
  { name: 'blueprint-unfiltered', theme: 'blueprint', markers: 'original' },
  { name: 'blueprint-pane', theme: 'blueprint', markers: 'pane' },
  { name: 'blueprint-img', theme: 'blueprint', markers: 'img' }
];

const rows = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

for (const n of [50, 500, 2000]) {
  await page.goto(`${BASE}/tests/fixtures/leaflet-fleet.html?n=${n}&kind=div&icon=img`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const trials = n === 500 ? 3 : 1;
  const ms = n === 500 ? 4000 : 5000;
  for (const v of variants) {
    for (const pan of [false, true]) {
      const trialRows = [];
      for (let t = 0; t < trials; t++) {
        const stats = await runTrial(page, { theme: v.theme, markers: v.markers, pan, ms });
        trialRows.push(stats);
        console.log(JSON.stringify({ n, variant: v.name, pan, trial: t, fps: Number(stats.fps.toFixed(2)), medianFps: stats.medianFps && Number(stats.medianFps.toFixed(2)), max: stats.max, queueMax: stats.queueMax, pane: stats.paneFilter && stats.paneFilter.slice(0, 24), img: stats.imgFilter && stats.imgFilter.slice(0, 24) }));
      }
      const fpsList = trialRows.map((r) => r.fps);
      rows.push({
        n, variant: v.name, theme: v.theme, markers: v.markers, pan,
        trials,
        medianFps: median(fpsList),
        meanFps: fpsList.reduce((s, x) => s + x, 0) / fpsList.length,
        medianInstantFps: median(trialRows.map((r) => r.medianFps).filter(Boolean)),
        max: Math.max(...trialRows.map((r) => r.max)),
        queueMax: Math.max(...trialRows.map((r) => r.queueMax ?? 0)),
        paneFilter: trialRows[0].paneFilter,
        imgFilter: trialRows[0].imgFilter,
        imgSkip: trialRows[0].imgSkip,
        imgUp: trialRows[0].imgUp,
        busy: trialRows[0].busy
      });
    }
  }
}

async function carCloseup(page, name, size = 220) {
  await page.evaluate(() => window.__fleet.stopCars());
  await page.waitForTimeout(120);
  const clip = await page.evaluate((size) => {
    const map = document.getElementById('map').getBoundingClientRect();
    const cx = map.left + map.width * 0.52;
    const cy = map.top + map.height * 0.42;
    let best = null, bestD = Infinity;
    for (const el of document.querySelectorAll('.car-marker')) {
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
  await page.evaluate(() => window.__fleet.startCars());
}

await page.goto(`${BASE}/tests/fixtures/leaflet-fleet.html?n=500&kind=div&icon=img`, { waitUntil: 'domcontentloaded' });
await waitReady(page);

for (const [theme, markers, stem] of [
  ['sketch', 'original', 'sketch-unfiltered'],
  ['sketch', 'pane', 'sketch-pane'],
  ['sketch', 'img', 'sketch-img'],
  ['blueprint', 'original', 'blueprint-unfiltered'],
  ['blueprint', 'pane', 'blueprint-pane'],
  ['blueprint', 'img', 'blueprint-img']
]) {
  await page.evaluate(({ theme, markers }) => {
    window.Unpolish.setTheme(theme);
    window.Unpolish._internal.setMapMarkers(markers);
  }, { theme, markers });
  await page.waitForTimeout(350);
  await page.getByTestId('map').screenshot({ path: join(OUT, `fleet-markers-500-${stem}.png`), animations: 'allow' });
  await carCloseup(page, `fleet-markers-icon-${stem}.png`);
}

await browser.close();

const at500 = rows.filter((r) => r.n === 500 && !r.pan);
const sketchUnfiltered = at500.find((r) => r.variant === 'sketch-unfiltered');
const sketchPane = at500.find((r) => r.variant === 'sketch-pane');
const sketchImg = at500.find((r) => r.variant === 'sketch-img');
const cost = (row) => sketchUnfiltered && row ? sketchUnfiltered.medianFps - row.medianFps : null;
const paneCost = cost(sketchPane);
const imgCost = cost(sketchImg);
const better = (paneCost ?? 99) <= (imgCost ?? 99) ? 'pane' : 'img';
const betterCost = better === 'pane' ? paneCost : imgCost;
const becomeDefault = betterCost != null && betterCost <= 3.2;
const report = {
  idleMs: 260,
  decision: {
    sketchUnfilteredFps: sketchUnfiltered && sketchUnfiltered.medianFps,
    paneFps: sketchPane && sketchPane.medianFps,
    imgFps: sketchImg && sketchImg.medianFps,
    paneCost, imgCost, better, betterCost, becomeDefault,
    defaultWouldBe: becomeDefault ? better : 'original'
  },
  rows
};
writeFileSync(join(OUT, 'fleet-marker-filter-report.json'), JSON.stringify(report, null, 2));
const files = [
  'fleet-marker-filter-report.json',
  'fleet-markers-500-sketch-unfiltered.png',
  'fleet-markers-500-sketch-pane.png',
  'fleet-markers-500-sketch-img.png',
  'fleet-markers-500-blueprint-unfiltered.png',
  'fleet-markers-500-blueprint-pane.png',
  'fleet-markers-500-blueprint-img.png',
  'fleet-markers-icon-sketch-unfiltered.png',
  'fleet-markers-icon-sketch-pane.png',
  'fleet-markers-icon-sketch-img.png',
  'fleet-markers-icon-blueprint-unfiltered.png',
  'fleet-markers-icon-blueprint-pane.png',
  'fleet-markers-icon-blueprint-img.png'
];
for (const f of files) {
  try { copyFileSync(join(OUT, f), join(STORE, f)); } catch (e) { console.warn('copy skip', f, e.message); }
}
console.log('decision', JSON.stringify(report.decision, null, 2));
console.log(JSON.stringify(rows.map((r) => ({
  n: r.n, variant: r.variant, pan: r.pan,
  medianFps: r.medianFps && Number(r.medianFps.toFixed(1)),
  max: r.max, queueMax: r.queueMax
})), null, 2));
