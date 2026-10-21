import { test, expect } from '@playwright/test';
import { EXAMPLES, THEMES, open, setTheme, settle, rects, styles } from './helpers.js';

for (const [name, url] of Object.entries(EXAMPLES)) {
  test.describe(`${name} example`, () => {
    test('each preset is applied, visibly distinct, and Original restores cleanly', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await open(page, url);
      await settle(page);
      const before = await styles(page);
      const shots = {};
      shots.original = await page.screenshot();
      for (const id of THEMES) {
        await setTheme(page, id);
        await page.evaluate(() => document.fonts.ready);
        await settle(page);
        expect(await page.getAttribute('html', 'data-unpolish')).toBe(id);
        const tagged = await page.locator('[data-up]').count();
        expect(tagged, 'elements classified').toBeGreaterThan(5);
        shots[id] = await page.screenshot();
      }
      const ids = Object.keys(shots);
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        expect(Buffer.compare(shots[ids[i]], shots[ids[j]]), `${ids[i]} vs ${ids[j]} differ`).not.toBe(0);
      }
      await setTheme(page, 'original');
      await settle(page);
      expect(await page.getAttribute('html', 'data-unpolish')).toBeNull();
      expect(await page.locator('[data-up]').count()).toBe(0);
      expect(await page.locator('#unpolish-theme, #unpolish-filters').count()).toBe(0);
      expect(await styles(page)).toEqual(before);
      expect(errors).toEqual([]);
    });

    test('layout is identical across themes and detailed settings when typography is kept', async ({ page }) => {
      await open(page, url);
      await settle(page);
      const base = await rects(page);
      for (const id of THEMES) {
        await setTheme(page, id);
        await page.evaluate(() => window.Unpolish.update({ typography: 'original' }));
        await settle(page);
        expect(await rects(page), `${id} with original type`).toEqual(base);
        for (const partial of [{ images: 'placeholder' }, { images: 'theme' }, { images: 'mono' }, { border: { weight: 4, style: 'hand' } }, { radius: 0 }, { shadows: 'flat' }, { details: 0 }, { details: 100 }]) {
          await page.evaluate((p) => window.Unpolish.update(p), partial);
          await settle(page);
          expect(await rects(page), `${id} ${JSON.stringify(partial)}`).toEqual(base);
        }
        await page.evaluate(() => window.Unpolish.resetTheme());
      }
    });
  });
}

test('theme fonts keep layout shifts small on the demo prototype', async ({ page }) => {
  await open(page, EXAMPLES.demo);
  await settle(page);
  const base = await rects(page, '.main > *, .sidebar, .venue, .stat, .btn');
  for (const id of THEMES) {
    await setTheme(page, id);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const now = await rects(page, '.main > *, .sidebar, .venue, .stat, .btn');
    const maxShift = Math.max(...now.map((r, i) => Math.max(Math.abs(r[1] - base[i][1]), Math.abs(r[2] - base[i][2]))));
    test.info().annotations.push({ type: 'layout', description: `${id}: max block shift ${maxShift}px` });
    // Handwritten faces (sketch) shift more on GitHub's Chromium/font stack than locally.
    expect(maxShift, `${id} block shift`).toBeLessThan(80);
  }
});

test('exempt regions, canvas and project overrides are respected', async ({ page }) => {
  await open(page, EXAMPLES.plain);
  const brand = page.getByTestId('brand');
  const before = await brand.evaluate((e) => getComputedStyle(e).backgroundColor + getComputedStyle(e).fontFamily);
  await setTheme(page, 'sketch');
  await settle(page);
  expect(await brand.getAttribute('data-up')).toBeNull();
  expect(await brand.evaluate((e) => getComputedStyle(e).backgroundColor + getComputedStyle(e).fontFamily)).toBe(before);
  // Canvas pixels are left alone.
  expect(await page.getByTestId('canvas').getAttribute('data-up')).toBe('media-opaque');
  expect(await page.getByTestId('canvas').evaluate((e) => getComputedStyle(e).filter)).toBe('none');
  // Project config: sketch with 2px strokes + black-and-white images.
  const s = await page.evaluate(() => window.Unpolish.getSettings('sketch'));
  expect(s.border.weight).toBe(2);
  expect(s.images).toBe('mono');
  expect(await page.locator('img[data-up~="media"]').first().evaluate((e) => getComputedStyle(e).filter)).toContain('grayscale(1)');
  // Match theme is the default: Sketch draws images with its pencil filter
  await page.evaluate(() => window.Unpolish.update({ images: 'theme' }));
  await settle(page);
  expect(await page.locator('img[data-up~="media"]').first().evaluate((e) => getComputedStyle(e).filter)).toContain('url');
  // Older configs: "simplified" means Match theme, details true/false map to the default/0
  expect(await page.evaluate(() => window.Unpolish._internal.normalizeSettings('sketch', { images: 'simplified', details: false }))).toMatchObject({ images: 'theme', details: 0 });

  // Vue: exclude + role hint + per-theme CSS override from its config
  await open(page, EXAMPLES.vue);
  await setTheme(page, 'sketch');
  await settle(page);
  expect(await page.getByTestId('map').getAttribute('data-up')).toBeNull();
  expect(await page.locator('.chip').first().getAttribute('data-up')).toContain('fill-2');
  expect(await page.locator('.hero h1').evaluate((e) => getComputedStyle(e).letterSpacing)).toBe('normal');
  expect((await page.evaluate(() => window.Unpolish.getSettings('pastel'))).radius).toBe(8);
});

test('open shadow roots are themed', async ({ page }) => {
  await open(page, EXAMPLES.plain);
  await setTheme(page, 'black-white');
  await settle(page);
  const inner = page.getByTestId('pill').locator('span');
  await expect(inner).toHaveAttribute('data-up', /bg/);
  const color = await inner.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(color).not.toBe('rgb(219, 234, 254)');
  await setTheme(page, 'original');
  await settle(page);
  expect(await inner.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(219, 234, 254)');
});

test('image placeholders keep dimensions and accessible meaning', async ({ page }) => {
  await open(page, EXAMPLES.demo);
  const img = page.locator('.venue img').first();
  const box = await img.boundingBox();
  await setTheme(page, 'black-white');
  await page.evaluate(() => window.Unpolish.update({ images: 'placeholder' }));
  await settle(page);
  expect(await img.boundingBox()).toEqual(box);
  expect(await img.getAttribute('alt')).toBe('Lakeside terrace at sunset');
  const cs = await img.evaluate((e) => ({ op: getComputedStyle(e).objectPosition, bg: getComputedStyle(e).backgroundImage }));
  expect(cs.op).toContain('-99999px');
  expect(cs.bg).toContain('data:image/svg+xml');
  await expect(page.getByRole('img', { name: 'Lakeside terrace at sunset' })).toBeVisible();
});
