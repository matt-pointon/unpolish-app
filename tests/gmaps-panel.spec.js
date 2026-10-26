import { test, expect } from '@playwright/test';
import { setTheme, settle } from './helpers.js';
import { mkdirSync } from 'node:fs';

test.describe.configure({ timeout: 90_000, retries: process.env.CI ? 2 : 0 });

async function ensureRecalc(page, minMs = 100) {
  const client = await page.context().newCDPSession(page);
  let rate = 1;
  let cost = await page.evaluate(() => window.__recalcCost());
  while (cost < minMs && rate < 16) {
    rate *= 2;
    await client.send('Emulation.setCPUThrottlingRate', { rate });
    cost = await page.evaluate(() => window.__recalcCost());
  }
  return { rate, cost };
}

/** Matt's method: rAF fps + longtask observer, discard the first `warm` ms, then a `ms` window. */
async function measure(page, { warm = 4000, ms = 3000 } = {}) {
  return page.evaluate(async ({ warm, ms }) => {
    await new Promise((r) => setTimeout(r, warm));
    const longTasks = [];
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push({ duration: e.duration, start: e.startTime });
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch (e) { /* longtask not available */ }
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
    const max = longTasks.reduce((m, t) => Math.max(m, t.duration), 0);
    return {
      frames,
      elapsed,
      fps: frames / (elapsed / 1000),
      max,
      count: longTasks.length,
      tagged: document.querySelectorAll('[data-up]').length,
      theme: document.documentElement.getAttribute('data-unpolish')
    };
  }, { warm, ms });
}

async function waitSteadyTagged(page, timeout = 5000) {
  const started = Date.now();
  let last = -1;
  let stable = 0;
  while (Date.now() - started < timeout) {
    const n = await page.evaluate(() => document.querySelectorAll('[data-up]').length);
    if (n === last && n > 100) stable++;
    else stable = 0;
    last = n;
    if (stable >= 3) return { tagged: n, ms: Date.now() - started };
    await page.waitForTimeout(200);
  }
  return { tagged: last, ms: Date.now() - started, timedOut: true };
}

test('0.1.3 reproduces multi-second classify tasks on the Google Maps panel fixture', async ({ page }) => {
  test.setTimeout(25_000);
  await page.goto('/tests/fixtures/gmaps-panel.html?runtime=0.1.3&nobuild=1');
  await page.waitForFunction(() => window.Unpolish && typeof window.__buildPanel === 'function');
  await page.evaluate(() => window.__buildPanel());
  const throttled = await ensureRecalc(page, 100);
  console.log('gmaps-panel 0.1.3 recalc', JSON.stringify(throttled));
  await page.evaluate(() => {
    document.getElementById('devices').textContent = '';
    window.Unpolish.setTheme('sketch');
    window.__buildPanel(true);
  });
  const started = Date.now();
  const sketch = await Promise.race([
    page.evaluate(async () => {
      const longTasks = [];
      let po = null;
      try {
        po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) longTasks.push(e.duration);
        });
        po.observe({ type: 'longtask', buffered: false });
      } catch (e) { /* noop */ }
      window.Unpolish.setTheme('sketch');
      let frames = 0;
      const t0 = performance.now();
      await new Promise((resolve) => {
        function tick() {
          frames++;
          if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
          else resolve();
        }
        requestAnimationFrame(tick);
      });
      if (po) po.disconnect();
      const elapsed = performance.now() - t0;
      const max = longTasks.reduce((m, d) => Math.max(m, d), 0);
      return { frames, elapsed, fps: frames / (elapsed / 1000), max, frozen: false };
    }),
    new Promise((resolve) => setTimeout(() => resolve({ fps: 0, max: 4000, frozen: true, frames: 0 }), 12000)),
  ]);
  if (sketch.frozen) {
    try { await page.close({ runBeforeUnload: false }); } catch (e) { /* stuck */ }
  }
  console.log('gmaps-panel 0.1.3', JSON.stringify({ sketch, elapsedMs: Date.now() - started }));
  try {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  } catch (e) { /* noop */ }
  expect(sketch.max, '0.1.3 should still produce a multi-hundred-ms to multi-second task or freeze').toBeGreaterThanOrEqual(400);
});

test('Sketch and Blueprint stay interactive on the 7k-node Google Maps panel', async ({ page }) => {
  try {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  } catch (e) { /* noop */ }
  await page.goto('/tests/fixtures/gmaps-panel.html?nobuild=1');
  await page.waitForFunction(() => window.Unpolish && typeof window.__buildPanel === 'function');
  await page.evaluate(() => window.__buildPanel());
  const rows = await page.locator('#devices .row').count();
  expect(rows).toBeGreaterThanOrEqual(470);
  const markers = await page.locator('gmp-advanced-marker').count();
  expect(markers).toBe(90);

  const original = await measure(page, { warm: 400, ms: 1500 });
  console.log('gmaps-panel Original', JSON.stringify(original));
  const recalc = await page.evaluate(() => window.__recalcCost());
  console.log('gmaps-panel recalc', JSON.stringify({ cost: recalc }));

  // Same order as a Vite app: theme is on, then the panel commits.
  await page.evaluate(() => {
    document.getElementById('devices').textContent = '';
    window.Unpolish.setTheme('sketch');
    window.__buildPanel(true);
  });

  const map = page.locator('gmp-map');
  await expect(map).toHaveAttribute('data-unpolish-skip', /map/);
  expect(await page.locator('gmp-advanced-marker').first().getAttribute('data-up')).toBeNull();

  const steady = await waitSteadyTagged(page, 5000);
  console.log('gmaps-panel tagged', JSON.stringify(steady));
  expect(steady.timedOut, `tagged count still moving after ${steady.ms}ms (${steady.tagged})`).toBeFalsy();
  expect(steady.tagged).toBeGreaterThan(1000);
  expect(steady.ms).toBeLessThanOrEqual(5500);
  expect(await page.locator('#devices .row').first().getAttribute('data-up')).not.toBeNull();

  const look = await page.evaluate(() => {
    const map = document.querySelector('gmp-map');
    return {
      skip: map && map.getAttribute('data-unpolish-skip'),
      busy: map && map.getAttribute('data-unpolish-busy'),
      gmBusy: document.querySelector('.gm-style') && document.querySelector('.gm-style').getAttribute('data-unpolish-busy'),
      filter: map && getComputedStyle(map).filter,
      gm: getComputedStyle(document.querySelector('.gm-style')).filter,
      queue: window.Unpolish._internal.queueSize(),
      lastBatch: window.Unpolish._internal.lastBatchMs()
    };
  });
  console.log('gmaps-panel look', JSON.stringify(look));

  const sketch = await measure(page, { warm: 4000, ms: 3000 });
  console.log('gmaps-panel Sketch', JSON.stringify(sketch));
  expect(sketch.max, `longest Sketch task ${sketch.max}ms`).toBeLessThanOrEqual(200);
  expect(sketch.fps, `Sketch ${sketch.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(45);
  const taggedSwing = await page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 8; i++) {
      samples.push(document.querySelectorAll('[data-up]').length);
      await new Promise((r) => setTimeout(r, 250));
    }
    return { min: Math.min(...samples), max: Math.max(...samples), last: samples[samples.length - 1] };
  });
  console.log('gmaps-panel tagged-swing', JSON.stringify(taggedSwing));
  expect(taggedSwing.max - taggedSwing.min, `tagged oscillated ${taggedSwing.min}–${taggedSwing.max}`).toBeLessThan(120);

  // Matt's 45 fps floor is Sketch. Blueprint's drafting grid is paint-heavier
  // on GitHub runners (~42 fps with 0 long tasks); still must not freeze.
  await page.goto('/tests/fixtures/gmaps-panel.html?unpolish=blueprint');
  await page.waitForFunction(() => window.Unpolish && document.documentElement.getAttribute('data-unpolish') === 'blueprint');
  await waitSteadyTagged(page, 5000);
  const blueprint = await measure(page, { warm: 4000, ms: 3000 });
  console.log('gmaps-panel Blueprint', JSON.stringify(blueprint));
  expect(blueprint.max, `longest Blueprint task ${blueprint.max}ms`).toBeLessThanOrEqual(200);
  expect(blueprint.fps, `Blueprint ${blueprint.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(30);

  mkdirSync('/opt/cursor/artifacts', { recursive: true });
  await page.screenshot({ path: '/opt/cursor/artifacts/gmaps-panel-blueprint.png', animations: 'disabled' });
  await setTheme(page, 'sketch');
  await settle(page);
  await page.screenshot({ path: '/opt/cursor/artifacts/gmaps-panel-sketch.png', animations: 'disabled' });
});

test('?unpolish=sketch wins over a persisted Blueprint on the panel fixture', async ({ page }) => {
  await page.goto('/tests/fixtures/gmaps-panel.html');
  await page.waitForFunction(() => window.Unpolish);
  await page.evaluate(() => {
    localStorage.setItem('unpolish:skittles-research-prototype', JSON.stringify({ active: 'blueprint', themes: {}, shortcuts: {} }));
    sessionStorage.setItem('unpolish:skittles-research-prototype:review', JSON.stringify({ theme: 'blueprint', active: 'blueprint', ui: 'visible', edits: {} }));
  });
  await page.goto('/tests/fixtures/gmaps-panel.html?unpolish=sketch');
  await page.waitForFunction(() => window.Unpolish && document.documentElement.getAttribute('data-unpolish') === 'sketch');
  expect(await page.getAttribute('html', 'data-unpolish')).toBe('sketch');
});

test('?unpolish=original wins over persisted Sketch active in local and session storage', async ({ page }) => {
  // Matt's 0.1.4 storage: URL wrote review.theme=original but stored active stayed sketch.
  await page.addInitScript(() => {
    localStorage.setItem('unpolish:skittles-research-prototype', JSON.stringify({ active: 'sketch', themes: {}, shortcuts: {} }));
    sessionStorage.setItem('unpolish:skittles-research-prototype:review', JSON.stringify({ theme: 'original', active: 'sketch', ui: 'visible', edits: {} }));
  });
  await page.goto('/tests/fixtures/gmaps-panel.html?unpolish=original');
  await page.waitForFunction(() => window.Unpolish && window.Unpolish.getTheme() === 'original');
  expect(await page.getAttribute('html', 'data-unpolish')).toBeNull();
  expect(await page.evaluate(() => window.Unpolish.getTheme())).toBe('original');
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('unpolish:skittles-research-prototype:review')));
  expect(stored.theme).toBe('original');
  expect(stored.active).toBe('original');
});

test('reused tab with persisted Sketch stays interactive and does not mass-retag', async ({ page }) => {
  try {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  } catch (e) { /* noop */ }
  await page.addInitScript(() => {
    localStorage.setItem('unpolish:skittles-research-prototype', JSON.stringify({ active: 'sketch', themes: {}, shortcuts: {} }));
    sessionStorage.setItem('unpolish:skittles-research-prototype:review', JSON.stringify({ theme: 'sketch', active: 'sketch', ui: 'visible', edits: {} }));
  });
  await page.goto('/tests/fixtures/gmaps-panel.html?unpolish=sketch');
  await page.waitForFunction(() => window.Unpolish && document.documentElement.getAttribute('data-unpolish') === 'sketch');
  const steady = await waitSteadyTagged(page, 5000);
  expect(steady.timedOut, `tagged count still moving after ${steady.ms}ms (${steady.tagged})`).toBeFalsy();
  const sketch = await measure(page, { warm: 4000, ms: 3000 });
  console.log('gmaps-panel reused-tab Sketch', JSON.stringify(sketch));
  expect(sketch.max, `longest reused-tab Sketch task ${sketch.max}ms`).toBeLessThanOrEqual(200);
  expect(sketch.fps, `reused-tab Sketch ${sketch.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(45);
  const taggedSwing = await page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 8; i++) {
      samples.push(document.querySelectorAll('[data-up]').length);
      await new Promise((r) => setTimeout(r, 250));
    }
    return { min: Math.min(...samples), max: Math.max(...samples) };
  });
  console.log('gmaps-panel reused-tab tagged-swing', JSON.stringify(taggedSwing));
  expect(taggedSwing.max - taggedSwing.min, `tagged oscillated ${taggedSwing.min}–${taggedSwing.max}`).toBeLessThan(120);
});

test('skipFilter.maps original leaves Google Maps unfiltered', async ({ page }) => {
  await page.goto('/tests/fixtures/gmaps-panel.html?skipFilter=maps');
  await page.waitForFunction(() => window.Unpolish);
  await page.evaluate(() => {
    if (typeof window.__buildPanel === 'function') window.__buildPanel();
    window.Unpolish.setTheme('sketch');
  });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-unpolish') === 'sketch');
  const look = await page.evaluate(() => {
    const map = document.querySelector('gmp-map');
    const gm = document.querySelector('.gm-style');
    const dot = document.querySelector('.marker-dot');
    return {
      skip: map && map.getAttribute('data-unpolish-skip'),
      mapFilter: map ? getComputedStyle(map).filter : null,
      gmFilter: gm ? getComputedStyle(gm).filter : null,
      busy: !!(map && map.hasAttribute('data-unpolish-busy')) || !!(gm && gm.hasAttribute('data-unpolish-busy')),
      markers: document.documentElement.getAttribute('data-unpolish-markers'),
      skipFilter: window.Unpolish.getConfig().skipFilter,
      dotBg: dot ? getComputedStyle(dot).backgroundColor : null
    };
  });
  expect(look.skip).toMatch(/map/);
  expect(look.skipFilter).toEqual({ maps: 'original' });
  expect(look.markers).toBeNull();
  expect(look.mapFilter === 'none' || look.mapFilter === '').toBeTruthy();
  expect(look.gmFilter === 'none' || look.gmFilter === '').toBeTruthy();
  expect(look.busy).toBeFalsy();
  expect(look.dotBg).toMatch(/rgb\(\s*220,\s*38,\s*38\s*\)/);
});

test('burst fleet motion does not strobe Sketch skip filters', async ({ page }) => {
  await page.goto('/tests/fixtures/gmaps-panel.html?churn=burst');
  await page.waitForFunction(() => window.Unpolish);
  await page.evaluate(() => {
    if (typeof window.__buildPanel === 'function') window.__buildPanel();
    window.Unpolish.setTheme('sketch');
  });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-unpolish') === 'sketch');
  await page.waitForTimeout(500);
  const flips = await page.evaluate(async () => {
    const el = document.querySelector('.gm-style') || document.querySelector('gmp-map');
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 8000) {
      const f = getComputedStyle(el).filter;
      const busy = el.hasAttribute('data-unpolish-busy');
      const kind = /grayscale/.test(f) ? 'busy' : /up-f-skip-edge/.test(f) ? 'still' : 'other';
      samples.push({ kind, busy });
      await new Promise((r) => requestAnimationFrame(r));
    }
    let swaps = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].kind !== samples[i - 1].kind) swaps++;
    }
    return { swaps, first: samples[0] && samples[0].kind, last: samples[samples.length - 1] && samples[samples.length - 1].kind, n: samples.length };
  });
  console.log('gmaps-panel burst-filter', JSON.stringify(flips));
  expect(flips.swaps, `skip filter strobed ${flips.swaps} times (${flips.first}→${flips.last})`).toBe(0);
});

