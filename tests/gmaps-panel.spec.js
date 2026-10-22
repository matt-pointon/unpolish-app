import { test, expect } from '@playwright/test';
import { setTheme, settle } from './helpers.js';
import { mkdirSync } from 'node:fs';

test.describe.configure({ timeout: 90_000 });

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

  await setTheme(page, 'blueprint');
  await settle(page);
  await waitSteadyTagged(page, 5000);
  const blueprint = await measure(page, { warm: 4000, ms: 3000 });
  console.log('gmaps-panel Blueprint', JSON.stringify(blueprint));
  expect(blueprint.max, `longest Blueprint task ${blueprint.max}ms`).toBeLessThanOrEqual(200);
  expect(blueprint.fps, `Blueprint ${blueprint.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(45);

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
