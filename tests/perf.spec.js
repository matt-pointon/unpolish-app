import { test, expect } from '@playwright/test';
import { setTheme, settle } from './helpers.js';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

async function measure(page, ms = 2000) {
  return page.evaluate(async (ms) => {
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
    const total = longTasks.reduce((s, t) => s + t.duration, 0);
    return { frames, elapsed, fps: frames / (elapsed / 1000), max, total, count: longTasks.length };
  }, ms);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function sample(page, { n = 3, ms = 2000 } = {}) {
  const samples = [];
  for (let i = 0; i < n; i++) samples.push(await measure(page, ms));
  return {
    samples,
    fps: median(samples.map((s) => s.fps)),
    max: median(samples.map((s) => s.max)),
    total: median(samples.map((s) => s.total)),
  };
}

test('Sketch stays responsive on a 3000-element page with per-frame churn', async ({ page }) => {
  await page.goto('/tests/fixtures/churn.html');
  await page.waitForFunction(() => window.Unpolish && document.querySelectorAll('.card').length >= 3000);
  expect(await page.locator('.card').count()).toBeGreaterThanOrEqual(3000);

  await measure(page, 400);
  const original = await sample(page);
  await setTheme(page, 'sketch');
  await settle(page);
  await page.waitForFunction(() => document.querySelectorAll('.card[data-up]').length > 1000);
  await settle(page);
  await measure(page, 400);

  const sketch = await sample(page);
  const inserted = page.locator('[data-testid="inserted"]').last();
  await expect(inserted).toHaveAttribute('data-up', /bg|box|fill/, { timeout: 4000 });
  expect(await page.locator('gmp-advanced-marker').first().getAttribute('data-up')).toBeNull();
  expect(await page.locator('gmp-map').getAttribute('data-up')).toBeNull();

  const report = { original, sketch, ratio: original.fps ? sketch.fps / original.fps : 0 };
  console.log('churn perf', JSON.stringify(report));
  // 0.1.1-style class churn was ~13fps with 150ms+ long tasks. Median of three
  // 2s windows vs Original in this same run; 80% fps and 100ms max still fail that.
  expect(sketch.max, `longest Sketch task ${sketch.max.toFixed(1)}ms (Original max ${original.max.toFixed(1)}ms)`).toBeLessThanOrEqual(100);
  expect(sketch.fps, `Sketch ${sketch.fps.toFixed(1)} fps vs Original ${original.fps.toFixed(1)}`).toBeGreaterThanOrEqual(original.fps * 0.8);
  expect(sketch.fps, `Sketch ${sketch.fps.toFixed(1)} fps looks like 0.1.1 class-churn (~13fps)`).toBeGreaterThan(20);
});
