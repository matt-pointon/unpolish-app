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
  await page.waitForTimeout(400);

  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-unpolish-skip', 'map');
  expect(await map.getAttribute('data-up')).toBeNull();
  expect(await map.getAttribute('data-unpolish-busy')).toBeNull();
  const marker = page.locator('#map .marker').first();
  expect(await marker.getAttribute('data-up')).toBeNull();
  expect(await marker.evaluate((el) => getComputedStyle(el).visibility)).not.toBe('hidden');
  const mapFx = await map.evaluate((el) => ({
    filter: getComputedStyle(el).filter,
    blend: getComputedStyle(el, '::before').mixBlendMode,
    before: getComputedStyle(el, '::before').content
  }));
  expect(mapFx.filter).toMatch(/up-f-skip-edge/);
  expect(mapFx.filter).not.toMatch(/grayscale/);
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
  expect(await photo.evaluate((el) => getComputedStyle(el).filter)).toMatch(/up-f-skip-edge/);
  expect(await photo.locator('img').evaluate((el) => getComputedStyle(el).visibility)).not.toBe('hidden');

  const canvas = page.getByTestId('canvas');
  await expect(canvas).toHaveAttribute('data-unpolish-skip', 'canvas');
  expect(await canvas.getAttribute('data-up')).toBeNull();
  expect(await canvas.evaluate((el) => getComputedStyle(el).filter)).toMatch(/up-f-skip-edge/);

  const frame = page.getByTestId('frame');
  await expect(frame).toHaveAttribute('data-unpolish-skip', 'media');
  expect(await frame.getAttribute('data-up')).toBeNull();
  expect(await frame.evaluate((el) => getComputedStyle(el).filter)).toMatch(/up-f-skip-edge/);

  const keptImg = page.getByTestId('kept-image');
  expect(await keptImg.getAttribute('data-unpolish-skip')).toBeNull();
  await expect(keptImg).toHaveAttribute('data-up', /media/);

  await expect(page.getByTestId('ui-card')).toHaveAttribute('data-up', /bg|box|fill/);

  const sketch = await measure(page, 3000);
  console.log('heavy-map 0.1.3 idle-edge', JSON.stringify(sketch));
  expect(sketch.max, `longest Sketch idle task ${sketch.max}ms`).toBeLessThanOrEqual(50);
  expect(sketch.fps, `Sketch idle ${sketch.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(50);

  mkdirSync('/opt/cursor/artifacts', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 860 });
  await settle(page);
  async function shots(theme) {
    const dir = '/opt/cursor/artifacts';
    const shot = { animations: 'disabled' };
    await page.screenshot({ path: `${dir}/heavy-map-${theme}-desktop.png`, fullPage: true, ...shot });
    await map.screenshot({ path: `${dir}/heavy-map-${theme}-map.png`, ...shot });
    await photo.screenshot({ path: `${dir}/heavy-map-${theme}-image.png`, ...shot });
    await canvas.screenshot({ path: `${dir}/heavy-map-${theme}-canvas.png`, ...shot });
  }
  await shots('sketch');
  await setTheme(page, 'blueprint');
  await settle(page);
  const bpFx = await map.evaluate((el) => getComputedStyle(el).filter);
  expect(String(bpFx)).toMatch(/grayscale|sepia|hue-rotate/);
  await shots('blueprint');
  await setTheme(page, 'sketch');
  await settle(page);
  await page.waitForTimeout(400);

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

test('Sketch hybrid skip filter: gray while panning, edge when still', async ({ page }) => {
  await page.goto('/tests/fixtures/heavy-map.html');
  await page.waitForFunction(() => window.Unpolish && window.__heavy && window.__heavy.nodes >= 12000);
  await setTheme(page, 'sketch');
  await settle(page);
  await page.waitForTimeout(400);

  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-unpolish-skip', 'map');
  expect(await map.evaluate((el) => getComputedStyle(el).filter)).toMatch(/up-f-skip-edge/);
  expect(await map.getAttribute('data-unpolish-busy')).toBeNull();

  await page.evaluate(() => window.__heavy.startPan());
  await page.waitForFunction(() => {
    const el = document.getElementById('map');
    return el.hasAttribute('data-unpolish-busy') && /grayscale/.test(getComputedStyle(el).filter);
  }, { timeout: 2000 });
  const panFilter = await map.evaluate((el) => getComputedStyle(el).filter);
  expect(panFilter).toMatch(/grayscale/);
  expect(panFilter).not.toMatch(/up-f-skip-edge/);

  const pan = await measure(page, 3000);
  console.log('heavy-map 0.1.3 pan-gray', JSON.stringify(pan));
  expect(pan.max, `longest Sketch pan task ${pan.max}ms`).toBeLessThanOrEqual(50);
  expect(pan.fps, `Sketch pan ${pan.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(50);

  const switched = await page.evaluate(async () => {
    const el = document.getElementById('map');
    const longTasks = [];
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch (e) { /* noop */ }
    window.__heavy.stopPan();
    const t0 = performance.now();
    await new Promise((resolve) => {
      function tick() {
        const f = getComputedStyle(el).filter;
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
      filter: getComputedStyle(el).filter,
      busy: el.hasAttribute('data-unpolish-busy')
    };
  });
  console.log('heavy-map 0.1.3 switchback', JSON.stringify(switched));
  expect(switched.filter).toMatch(/up-f-skip-edge/);
  expect(switched.busy).toBeFalsy();
  expect(switched.ms, `switchback ${switched.ms}ms`).toBeGreaterThanOrEqual(180);
  expect(switched.ms, `switchback ${switched.ms}ms`).toBeLessThanOrEqual(900);

  const photo = page.getByTestId('photo');
  expect(await photo.evaluate((el) => getComputedStyle(el).filter)).toMatch(/up-f-skip-edge/);
  const imageIdle = await measure(page, 1500);
  console.log('heavy-map 0.1.3 static-image', JSON.stringify(imageIdle));
  expect(imageIdle.fps, `static image ${imageIdle.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(50);
});

test('Sketch hybrid on the Seattle Leaflet map', async ({ page }) => {
  await page.goto('/tests/fixtures/leaflet-seattle.html');
  await page.waitForFunction(() => window.Unpolish && window.__mapReady && window.__seattle, { timeout: 20_000 });
  await setTheme(page, 'sketch');
  await settle(page);
  await page.waitForTimeout(400);
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-unpolish-skip', 'map');
  expect(await map.evaluate((el) => {
    const vis = el.querySelector('.leaflet-tile-pane') || el;
    return getComputedStyle(vis).filter;
  })).toMatch(/up-f-skip-edge/);

  const idle = await measure(page, 2000);
  console.log('seattle 0.1.3 idle-edge', JSON.stringify(idle));
  expect(idle.fps).toBeGreaterThanOrEqual(50);

  await page.evaluate(() => window.__seattle.startPan());
  await page.waitForFunction(() => {
    const el = document.getElementById('map');
    const vis = el.querySelector('.leaflet-tile-pane') || el;
    return el.hasAttribute('data-unpolish-busy') && /grayscale/.test(getComputedStyle(vis).filter);
  }, { timeout: 3000 });
  const pan = await measure(page, 2000);
  console.log('seattle 0.1.3 pan-gray', JSON.stringify(pan));
  expect(pan.fps).toBeGreaterThanOrEqual(50);

  const switched = await page.evaluate(async () => {
    const el = document.getElementById('map');
    const longTasks = [];
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch (e) { /* noop */ }
    window.__seattle.stopPan();
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
      filter: getComputedStyle(vis).filter,
      busy: el.hasAttribute('data-unpolish-busy')
    };
  });
  console.log('seattle 0.1.3 switchback', JSON.stringify(switched));
  expect(switched.filter).toMatch(/up-f-skip-edge/);
  expect(switched.ms).toBeGreaterThanOrEqual(180);
  expect(switched.ms).toBeLessThanOrEqual(900);
});

test('Sketch fleet map: gray tiles while cars move, car imgs unfiltered, queue idle', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tests/fixtures/leaflet-fleet.html?n=500&kind=div&icon=img');
  await page.waitForFunction(() => window.Unpolish && window.__mapReady && window.__fleet && window.__fleet.carsOn, { timeout: 20_000 });
  await setTheme(page, 'sketch');
  await settle(page);
  await page.waitForTimeout(400);

  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-unpolish-skip', 'map');
  const look = await map.evaluate((el) => {
    const tiles = el.querySelector('.leaflet-tile-pane');
    const img = el.querySelector('.car-dot img');
    return {
      tileFilter: tiles ? getComputedStyle(tiles).filter : null,
      mapFilter: getComputedStyle(el).filter,
      busy: el.hasAttribute('data-unpolish-busy'),
      imgFilter: img ? getComputedStyle(img).filter : null,
      imgSkip: img ? img.getAttribute('data-unpolish-skip') : 'missing',
      imgUp: img ? img.getAttribute('data-up') : 'missing',
      carCount: el.querySelectorAll('.car-marker').length
    };
  });
  expect(look.carCount).toBeGreaterThanOrEqual(500);
  expect(look.mapFilter === 'none' || look.mapFilter === '').toBeTruthy();
  expect(look.imgFilter === 'none' || look.imgFilter === '').toBeTruthy();
  expect(look.imgSkip).toBeNull();
  expect(look.imgUp).toBeNull();
  expect(look.tileFilter).toMatch(/grayscale|up-f-skip-edge/);
  await expect(page.getByTestId('ui-card')).toHaveAttribute('data-up', /bg|box|fill/);

  const moving = await page.evaluate(async () => {
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
        queue.push(window.Unpolish._internal.queueSize().pending);
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    if (po) po.disconnect();
    const el = document.getElementById('map');
    const tiles = el.querySelector('.leaflet-tile-pane');
    const elapsed = performance.now() - t0;
    return {
      frames, elapsed, fps: frames / (elapsed / 1000),
      max: longTasks.reduce((m, d) => Math.max(m, d), 0),
      queueMax: queue.reduce((m, n) => Math.max(m, n), 0),
      queueLast: queue[queue.length - 1],
      busy: el.hasAttribute('data-unpolish-busy'),
      tileFilter: getComputedStyle(tiles).filter
    };
  });
  console.log('fleet 500 sketch cars', JSON.stringify(moving));
  expect(moving.busy).toBeTruthy();
  expect(moving.tileFilter).toMatch(/grayscale/);
  expect(moving.queueMax, `classify queue grew to ${moving.queueMax}`).toBeLessThanOrEqual(2);
  expect(moving.fps, `Sketch fleet ${moving.fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(15);

  await page.evaluate(() => window.__fleet.startPan());
  await page.waitForFunction(() => {
    const el = document.getElementById('map');
    const tiles = el.querySelector('.leaflet-tile-pane');
    return el.hasAttribute('data-unpolish-busy') && /grayscale/.test(getComputedStyle(tiles).filter);
  }, { timeout: 3000 });
  const pan = await measure(page, 2000);
  console.log('fleet 500 sketch pan', JSON.stringify(pan));
  expect(pan.fps).toBeGreaterThanOrEqual(15);
  await page.evaluate(() => window.__fleet.stopPan());
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
