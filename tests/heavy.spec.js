import { test, expect } from '@playwright/test';
import { setTheme, settle } from './helpers.js';
import { mkdirSync } from 'node:fs';

test.describe.configure({ timeout: 90_000 });

async function measure(page, ms = 3000) {
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
    return { frames, elapsed, fps: frames / (elapsed / 1000), max, count: longTasks.length };
  }, ms);
}

test('Sketch skips the heavy map and stays interactive', async ({ page }) => {
  await page.goto('/tests/fixtures/heavy-map.html');
  await page.waitForFunction(() => window.Unpolish && window.__heavy && window.__heavy.nodes >= 12000);
  expect((await page.evaluate(() => window.__heavy)).nodes).toBeGreaterThanOrEqual(12000);
  expect(await page.locator('#map .marker').count()).toBeGreaterThanOrEqual(11000);

  await setTheme(page, 'sketch');
  await settle(page);
  await page.waitForTimeout(1100);

  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-unpolish-skip', 'map');
  expect(await map.getAttribute('data-up')).toBeNull();
  const marker = page.locator('#map .marker').first();
  expect(await marker.getAttribute('data-up')).toBeNull();
  expect(await marker.evaluate((el) => getComputedStyle(el).visibility)).not.toBe('hidden');
  const mapFx = await map.evaluate((el) => ({
    filter: getComputedStyle(el).filter,
    blend: getComputedStyle(el, '::before').mixBlendMode,
    before: getComputedStyle(el, '::before').content
  }));
  expect(mapFx.filter).toMatch(/grayscale/);
  expect(mapFx.before === 'none' || mapFx.before === '' || mapFx.blend === 'normal').toBeTruthy();
  const mapLabel = await map.evaluate((el) => getComputedStyle(el, '::after').content);
  expect(mapLabel).toMatch(/Map/i);
  const mapAfter = await map.evaluate((el) => {
    const cs = getComputedStyle(el, '::after');
    return { top: cs.top, inset: cs.inset };
  });
  expect(mapAfter.inset === 'auto' || mapAfter.top === '6px' || parseFloat(mapAfter.top) <= 12).toBeTruthy();

  const photo = page.getByTestId('photo');
  await expect(photo).toHaveAttribute('data-unpolish-skip', 'image');
  expect(await photo.locator('img').getAttribute('data-up')).toBeNull();
  expect(await photo.evaluate((el) => getComputedStyle(el).filter)).toMatch(/grayscale|url\(/);
  expect(await photo.locator('img').evaluate((el) => getComputedStyle(el).visibility)).not.toBe('hidden');

  const canvas = page.getByTestId('canvas');
  await expect(canvas).toHaveAttribute('data-unpolish-skip', 'canvas');
  expect(await canvas.getAttribute('data-up')).toBeNull();
  expect(await canvas.evaluate((el) => getComputedStyle(el).filter)).toMatch(/grayscale|url\(/);

  const frame = page.getByTestId('frame');
  await expect(frame).toHaveAttribute('data-unpolish-skip', 'media');
  expect(await frame.getAttribute('data-up')).toBeNull();
  expect(await frame.evaluate((el) => getComputedStyle(el).filter)).toMatch(/grayscale|sepia|hue-rotate/);

  const keptImg = page.getByTestId('kept-image');
  expect(await keptImg.getAttribute('data-unpolish-skip')).toBeNull();
  await expect(keptImg).toHaveAttribute('data-up', /media/);

  await expect(page.getByTestId('ui-card')).toHaveAttribute('data-up', /bg|box|fill/);

  mkdirSync('/opt/cursor/artifacts', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 860 });
  await settle(page);
  async function shots(theme) {
    const dir = '/opt/cursor/artifacts';
    await page.screenshot({ path: `${dir}/heavy-map-${theme}-desktop.png`, fullPage: true });
    await map.screenshot({ path: `${dir}/heavy-map-${theme}-map.png` });
    await photo.screenshot({ path: `${dir}/heavy-map-${theme}-image.png` });
    await canvas.screenshot({ path: `${dir}/heavy-map-${theme}-canvas.png` });
  }
  await shots('sketch');
  await setTheme(page, 'blueprint');
  await settle(page);
  const bpFx = await map.evaluate((el) => getComputedStyle(el).filter);
  expect(String(bpFx)).toMatch(/grayscale|sepia|hue-rotate/);
  await shots('blueprint');
  await setTheme(page, 'sketch');
  await settle(page);

  const sketch = await measure(page, 3000);
  console.log('heavy-map 0.1.3', JSON.stringify(sketch));
  expect(sketch.max, `longest Sketch task ${sketch.max}ms`).toBeLessThanOrEqual(50);
  expect(sketch.fps, `Sketch ${sketch.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(50);

  const taggedBefore = await page.evaluate(() => document.querySelectorAll('[data-up]').length);
  const skipBefore = await page.evaluate(() => document.querySelectorAll('[data-unpolish-skip]').length);
  let attrWrites = 0;
  await page.exposeFunction('__noteUp', () => { attrWrites += 1; });
  await page.evaluate(() => {
    new MutationObserver((recs) => {
      for (const rec of recs) if (rec.attributeName === 'data-up') window.__noteUp();
    }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-up'] });
  });
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(800);
  const after = await measure(page, 1500);
  const taggedAfter = await page.evaluate(() => document.querySelectorAll('[data-up]').length);
  const skipAfter = await page.evaluate(() => document.querySelectorAll('[data-unpolish-skip]').length);
  console.log('heavy-map resize', JSON.stringify({ after, taggedBefore, taggedAfter, skipBefore, skipAfter, attrWrites }));
  expect(await page.locator('#map .marker').first().getAttribute('data-up')).toBeNull();
  expect(skipAfter).toBe(skipBefore);
  expect(Math.abs(taggedAfter - taggedBefore)).toBeLessThan(80);
  expect(attrWrites, 'resize reclassify storm').toBeLessThan(200);
  expect(after.max, `resize long task ${after.max}ms`).toBeLessThanOrEqual(50);
  expect(after.fps).toBeGreaterThanOrEqual(50);
});

test('0.1.2 baseline on the same fixture (logged)', async ({ page }) => {
  test.setTimeout(20_000);
  await page.route('**/unpolish/unpolish.js', (route) => {
    route.continue({ url: 'http://localhost:4174/releases/0.1.2/unpolish.js' });
  });
  await page.goto('/tests/fixtures/heavy-map.html');
  await page.waitForFunction(() => window.Unpolish && window.__heavy && window.__heavy.nodes >= 12000);
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
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
          else resolve();
        }
        requestAnimationFrame(tick);
      });
      if (po) po.disconnect();
      const elapsed = performance.now() - t0;
      const max = longTasks.reduce((m, d) => Math.max(m, d), 0);
      return { frames, elapsed, fps: frames / (elapsed / 1000), max, frozen: false };
    }),
    new Promise((resolve) => setTimeout(() => resolve({ fps: 0, max: 5000, frozen: true, frames: 0 }), 8000)),
  ]);
  if (sketch.frozen) {
    try { await page.close({ runBeforeUnload: false }); } catch (e) { /* page may already be stuck */ }
  }
  console.log('heavy-map 0.1.2', JSON.stringify({ sketch, elapsedMs: Date.now() - started }));
});
