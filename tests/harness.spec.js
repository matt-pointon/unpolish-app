import { test, expect } from '@playwright/test';
import { EXAMPLES, open, setTheme, settle, shadow } from './helpers.js';

const theme = (page) => page.getAttribute('html', 'data-unpolish');
const isOpen = (page) => shadow(page, '.panel').isVisible();

test.describe('keyboard', () => {
  test('\\ toggles, digits pick themes while open, Esc dismisses and returns focus', async ({ page }) => {
    await open(page, EXAMPLES.demo);
    await page.locator('#share-btn').focus();
    await page.keyboard.press('\\');
    expect(await isOpen(page)).toBe(true);
    // Focus moves into the panel, onto the selected theme
    await expect(shadow(page, '.tile[aria-checked="true"]')).toBeFocused();
    for (const [k, id] of [['1', 'black-white'], ['2', 'sketch'], ['3', 'blueprint'], ['4', 'pastel']]) {
      await page.keyboard.press(k);
      expect(await theme(page)).toBe(id);
    }
    await page.keyboard.press('0');
    expect(await theme(page)).toBeNull();
    // Arrow keys move through the radio group
    await page.keyboard.press('ArrowRight');
    expect(await theme(page)).toBe('black-white');
    await page.keyboard.press('Escape');
    expect(await isOpen(page)).toBe(false);
    await expect(page.locator('#share-btn')).toBeFocused();
    // Digits do nothing while closed
    await page.keyboard.press('3');
    expect(await theme(page)).toBe('black-white');
  });

  test('shortcuts never fire while typing in inputs, textareas or contenteditable', async ({ page }) => {
    await open(page, EXAMPLES.demo);
    const search = page.locator('.search input');
    await search.click();
    await page.keyboard.type('a\\b1');
    await expect(search).toHaveValue('a\\b1');
    expect(await isOpen(page)).toBe(false);
    await page.locator('textarea[name="notes"]').click();
    await page.keyboard.press('\\');
    expect(await isOpen(page)).toBe(false);
    await page.evaluate(() => { const d = document.createElement('div'); d.contentEditable = 'true'; d.id = 'ce'; d.textContent = 'x'; document.body.prepend(d); });
    await page.locator('#ce').click();
    await page.keyboard.press('\\');
    expect(await isOpen(page)).toBe(false);
    // While open, typing digits in the app's field types, it doesn't switch themes
    await page.locator('#share-btn').focus();
    await page.keyboard.press('\\');
    await search.click();
    await page.keyboard.type('2');
    expect(await theme(page)).toBeNull();
    await expect(search).toHaveValue('a\\b12');
  });

  test('direct theme shortcuts from config recall tuned settings; custom bindings validate', async ({ page }) => {
    await open(page, EXAMPLES.plain);
    // Config binds Alt+B to Blueprint
    await page.keyboard.press('Alt+KeyB');
    expect(await theme(page)).toBe('blueprint');
    await page.evaluate(() => window.Unpolish.update({ images: 'placeholder' }));
    await page.keyboard.press('\\');
    await page.keyboard.press('0');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt+KeyB');
    expect(await theme(page)).toBe('blueprint');
    expect((await page.evaluate(() => window.Unpolish.getSettings())).images).toBe('placeholder');
    // Not while typing
    await setTheme(page, 'original');
    await page.getByTestId('name').click();
    await page.keyboard.press('Alt+KeyB');
    expect(await theme(page)).toBeNull();
    await page.getByTestId('name').blur();

    // Assign Sketch via the Shortcuts view
    await page.keyboard.press('\\');
    await shadow(page, '[data-act="keys"]').click();
    const bind = shadow(page, '[data-bind="sketch"]');
    await bind.click();
    await page.keyboard.press('Control+KeyS');
    await expect(shadow(page, '[data-msg="sketch"]')).toContainText('browser');
    await page.keyboard.press('Alt+KeyB');
    await expect(shadow(page, '[data-msg="sketch"]')).toContainText('already used for Blueprint');
    await page.keyboard.press('Digit2');
    await expect(shadow(page, '[data-msg="sketch"]')).toContainText('0–4');
    await page.keyboard.press('Alt+KeyK');
    await expect(shadow(page, '[data-bind="sketch"]')).not.toHaveText('Add');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    expect(await isOpen(page)).toBe(false);
    await page.keyboard.press('Alt+KeyK');
    expect(await theme(page)).toBe('sketch');
    // Shown in the exported config
    const cfg = await page.evaluate(() => window.Unpolish.getConfig());
    expect(cfg.shortcuts.themes.sketch).toBe('Alt+K');
    expect(cfg.shortcuts.themes.blueprint).toBe('Alt+B');
  });

  test('the toggle shortcut can be reassigned', async ({ page }) => {
    await open(page, EXAMPLES.demo);
    await page.keyboard.press('\\');
    await shadow(page, '[data-act="keys"]').click();
    await shadow(page, '[data-bind="toggle"]').click();
    await page.keyboard.press('Shift+Alt+KeyU');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    expect(await isOpen(page)).toBe(false);
    await page.keyboard.press('\\');
    expect(await isOpen(page)).toBe(false);
    await page.keyboard.press('Shift+Alt+KeyU');
    expect(await isOpen(page)).toBe(true);
  });
});

test.describe('panel', () => {
  test('pointer flow: launcher, theme tile, edit, reset, discard', async ({ page }) => {
    await open(page, EXAMPLES.demo);
    await shadow(page, '.launcher').click();
    expect(await isOpen(page)).toBe(true);
    await shadow(page, '.tile[data-theme="sketch"]').click();
    expect(await theme(page)).toBe('sketch');
    await expect(shadow(page, '.source')).toHaveText('Project');
    // The initial view is just themes and two actions — no roughness slider.
    expect(await shadow(page, '[data-view="main"] input[type="range"]').count()).toBe(0);
    // Edit is hidden until asked for
    await expect(shadow(page, '[data-editor]')).toBeHidden();
    await shadow(page, '[data-act="edit"]').click();
    await expect(shadow(page, '[data-editor]')).toBeVisible();
    // Groups start collapsed; status colors sit behind their own disclosure.
    await expect(shadow(page, '[data-k="typography"]')).toBeHidden();
    for (const sec of ['color', 'type', 'images']) await shadow(page, `[data-sec="${sec}"] > summary`).click();
    await expect(shadow(page, '[data-k="palette.danger"]')).toBeHidden();
    await shadow(page, '[data-sec="status"] > summary').click();
    await expect(shadow(page, '[data-k="palette.danger"]')).toBeAttached();
    await shadow(page, '[data-k="images"][data-v="placeholder"]').click();
    await shadow(page, '[data-k="border.style"][data-v="dashed"]').click();
    await shadow(page, '.toggle').click();
    await shadow(page, '[data-k="palette.ink"]').evaluate((i) => { i.value = '#7a1f1f'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await shadow(page, '[data-k="typography"]').selectOption('neutral');
    await settle(page);
    const s = await page.evaluate(() => window.Unpolish.getSettings());
    expect(s).toMatchObject({ images: 'placeholder', border: { style: 'dashed' }, details: false, typography: 'neutral', palette: { ink: '#7a1f1f' } });
    await expect(shadow(page, '.source')).toHaveText('Local draft');
    expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(122, 31, 31)');
    // Per-theme memory: Blueprint stays at its defaults, Sketch keeps the edits
    await shadow(page, '.tile[data-theme="blueprint"]').click();
    expect((await page.evaluate(() => window.Unpolish.getSettings())).images).toBe('original');
    await shadow(page, '.tile[data-theme="sketch"]').click();
    expect((await page.evaluate(() => window.Unpolish.getSettings())).images).toBe('placeholder');
    // Reset preset
    await shadow(page, '[data-act="reset-theme"]').click();
    expect((await page.evaluate(() => window.Unpolish.getSettings())).images).toBe('original');
    await expect(shadow(page, '.source')).toHaveText('Project');
    // Discard local changes
    await shadow(page, '[data-k="radius"][data-v="0"]').click();
    await expect(shadow(page, '.source')).toHaveText('Local draft');
    await shadow(page, '[data-draft] [data-act="discard"]').click();
    await expect(shadow(page, '.source')).toHaveText('Project');
    expect(await theme(page)).toBeNull();
  });

  test('drafts persist locally and are clearly separate from the project config', async ({ page }) => {
    await open(page, EXAMPLES.react);
    // Project config sets Blueprint shadows to flat
    await setTheme(page, 'blueprint');
    expect((await page.evaluate(() => window.Unpolish.getSettings())).shadows).toBe('flat');
    await page.evaluate(() => window.Unpolish.update({ radius: 0 }));
    await settle(page);
    await page.reload();
    await page.waitForFunction(() => window.Unpolish?.state?.().theme === 'blueprint');
    const st = await page.evaluate(() => window.Unpolish.state());
    expect(st.settings.radius).toBe(0);
    expect(st.source).toBe('draft');
    // Copy configuration produces JSON + agent instructions with the tuned value
    await page.keyboard.press('\\');
    await shadow(page, '[data-draft] [data-act="copy-config"]').click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('Update the Unpolish configuration in this repository.');
    const json = JSON.parse(clip.match(/```json\n([\s\S]+?)```/)[1]);
    expect(json.themes.blueprint).toMatchObject({ radius: 0, shadows: 'flat' });
    expect(json.themes.blueprint.roughness).toBeUndefined();
    expect(json.exclude).toEqual(['[data-brand-logo]']);
    expect(json.shortcuts.themes.sketch).toBe('Alt+S');
    // "Saving" it (feeding the config back) makes the draft match the project
    await page.evaluate(() => window.Unpolish.discardLocalChanges());
    expect((await page.evaluate(() => window.Unpolish.state())).source).toBe('project');
  });

  test('host styles do not leak into the panel, and the panel does not leak into the host', async ({ page }) => {
    await page.route('**/unpolish/unpolish.js', (r) => r.abort());
    await page.goto(EXAMPLES.plain);
    const without = await page.evaluate(() => [...document.querySelectorAll('body *')].map((e) => getComputedStyle(e).cssText || [getComputedStyle(e).color, getComputedStyle(e).font, getComputedStyle(e).margin].join()));
    await page.unroute('**/unpolish/unpolish.js');
    await open(page, EXAMPLES.plain);
    const withIt = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => !e.closest('unpolish-harness, #unpolish-filters')).map((e) => getComputedStyle(e).cssText || [getComputedStyle(e).color, getComputedStyle(e).font, getComputedStyle(e).margin].join()));
    expect(withIt).toEqual(without);
    // Aggressive host CSS cannot restyle the panel
    await page.keyboard.press('\\');
    const read = () => shadow(page, '.panel').evaluate((e) => { const cs = getComputedStyle(e); const t = e.querySelector('.brand'); return [cs.backgroundColor, cs.borderRadius, getComputedStyle(t).fontSize, getComputedStyle(t).color]; });
    const before = await read();
    await page.addStyleTag({ content: '* { color: red !important; font-size: 40px !important; background: lime !important; border-radius: 0 !important; } unpolish-harness { font-family: serif !important; }' });
    await setTheme(page, 'sketch');
    expect(await read()).toEqual(before);
    expect(await page.locator('unpolish-harness').getAttribute('data-up')).toBeNull();
  });

  test('reduced motion: no scale animation; keyboard opens are instant', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, EXAMPLES.demo);
    await shadow(page, '.launcher').click();
    const t = await shadow(page, '.panel').evaluate((e) => getComputedStyle(e).transform);
    expect(t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.keyboard.press('\\');
    expect(await shadow(page, '.panel').evaluate((e) => e.classList.contains('anim'))).toBe(false);
  });

  test('every control has an accessible name', async ({ page }) => {
    await open(page, EXAMPLES.demo);
    await page.keyboard.press('\\');
    await setTheme(page, 'sketch');
    await shadow(page, '[data-act="edit"]').click();
    const unnamed = await shadow(page, '.panel').evaluate((root) => [...root.querySelectorAll('button, input, select')].filter((el) => {
      if (el.offsetParent === null) return false;
      const lab = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length) || el.textContent.trim();
      return !lab;
    }).map((e) => e.outerHTML.slice(0, 80)));
    expect(unnamed).toEqual([]);
  });

  test('on phones the controls stay reachable even when the host page overflows', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await open(page, EXAMPLES.demo);
    // Simulate a sloppy host layout that is wider than the screen
    await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'width:470px;height:4px'; document.body.prepend(d); });
    await page.waitForTimeout(200);
    await shadow(page, '.launcher').tap();
    expect(await isOpen(page)).toBe(true);
    const box = await shadow(page, '.panel').boundingBox();
    const vv = await page.evaluate(() => ({ w: visualViewport.width, h: visualViewport.height, x: visualViewport.offsetLeft }));
    expect(box.x).toBeGreaterThanOrEqual(vv.x);
    expect(box.x + box.width).toBeLessThanOrEqual(vv.x + vv.w + 1);
    await shadow(page, '.tile[data-theme="sketch"]').tap();
    expect(await theme(page)).toBe('sketch');
    await ctx.close();
  });

  test('small screens get a bottom sheet that fits the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await open(page, EXAMPLES.demo);
    await shadow(page, '.launcher').click();
    const box = await shadow(page, '.panel').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
  });
});

test.describe('review links', () => {
  test('URL selects theme, hides UI, survives client-side navigation and reloads', async ({ page }) => {
    await open(page, EXAMPLES.react + 'clients?ref=mail&unpolish=blueprint&unpolish-ui=hidden#team');
    expect(await theme(page)).toBe('blueprint');
    expect((await page.evaluate(() => window.Unpolish.getSettings())).shadows).toBe('flat');
    await expect(shadow(page, '.launcher')).toBeHidden();
    // Hidden is a preference, not a lock
    await page.keyboard.press('\\');
    expect(await isOpen(page)).toBe(true);
    await expect(shadow(page, '.source')).toHaveText('Review link');
    await expect(shadow(page, '.launcher')).toBeHidden();
    await page.keyboard.press('Escape');
    // Client-side navigation drops our params from the URL; the treatment stays.
    await page.getByTestId('nav-settings').click();
    expect(await theme(page)).toBe('blueprint');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-unpolish') === 'blueprint');
    await expect(shadow(page, '.launcher')).toBeHidden();
  });

  test('links use the saved project preset, never the recipient\'s local edits', async ({ page }) => {
    await open(page, EXAMPLES.plain);
    await setTheme(page, 'sketch');
    await page.evaluate(() => window.Unpolish.update({ images: 'placeholder', typography: 'neutral' }));
    await settle(page);
    await page.goto(EXAMPLES.plain + '?unpolish=sketch');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-unpolish') === 'sketch');
    const s = await page.evaluate(() => window.Unpolish.getSettings());
    expect(s.images).toBe('simplified'); // project config value
    expect(s.typography).toBe('hand');
    expect(s.border.weight).toBe(2);
    // Session continues across full page loads (multi-page site)
    await page.getByTestId('nav-about').click();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-unpolish') === 'sketch');
    expect((await page.evaluate(() => window.Unpolish.state())).source).toBe('review');
    // Exit returns to the local draft
    await page.keyboard.press('\\');
    await shadow(page, '[data-act="exit-review"]').click();
    expect((await page.evaluate(() => window.Unpolish.getSettings())).images).toBe('placeholder');
  });

  test('invalid and retired values fall back gracefully', async ({ page }) => {
    const warnings = [];
    page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
    await open(page, EXAMPLES.demo + '?unpolish=neon&unpolish-ui=sideways');
    expect(await theme(page)).toBeNull(); // project default is Original
    await expect(shadow(page, '.launcher')).toBeVisible();
    // Older links may still carry unpolish-roughness; it is ignored.
    await open(page, EXAMPLES.demo + '?unpolish=pastel-blocks&unpolish-roughness=250');
    expect(await theme(page)).toBe('pastel');
    expect((await page.evaluate(() => window.Unpolish.getSettings())).roughness).toBeUndefined();
    expect(new URL(await page.evaluate(() => window.Unpolish.getReviewLink())).searchParams.has('unpolish-roughness')).toBe(false);
    expect(warnings.some((w) => w.includes('Unknown theme'))).toBe(true);
  });

  test('Review link: options are chosen before copying; link keeps route, app query and hash', async ({ page }) => {
    await open(page, EXAMPLES.vue + '?view=compact#/about');
    await setTheme(page, 'pastel');
    await page.keyboard.press('\\');
    const clip = () => page.evaluate(() => navigator.clipboard.readText());
    await page.evaluate(() => navigator.clipboard.writeText('unchanged'));
    // Opening the view copies nothing yet
    await shadow(page, '[data-act="share"]').click();
    await expect(shadow(page, '[data-share]')).toBeVisible();
    await expect(shadow(page, '[data-share-theme]')).toHaveText('Pastel Blocks');
    expect(await clip()).toBe('unchanged');
    await shadow(page, '[data-hide-ui]').check();
    expect(await clip()).toBe('unchanged');
    await shadow(page, '[data-act="copy-link"]').click();
    await expect(shadow(page, '[data-act="copy-link"]')).toHaveText('Link copied');
    const u = new URL(await clip());
    expect(u.pathname).toBe('/examples/vue/dist/');
    expect(u.searchParams.get('view')).toBe('compact');
    expect(u.hash).toBe('#/about');
    expect(u.searchParams.get('unpolish')).toBe('pastel');
    expect(u.searchParams.get('unpolish-ui')).toBe('hidden');
    // Changing an option invalidates the "copied" state instead of leaving it stale
    await shadow(page, '[data-hide-ui]').uncheck();
    await expect(shadow(page, '[data-act="copy-link"]')).toHaveText('Copy link');
  });

  test('Review link warns about unsaved edits and never goes stale', async ({ page }) => {
    await open(page, EXAMPLES.demo);
    await page.keyboard.press('\\');
    await shadow(page, '.tile[data-theme="sketch"]').click();
    await page.evaluate(() => window.Unpolish.update({ images: 'placeholder' }));
    await settle(page);
    await shadow(page, '[data-act="share"]').click();
    await expect(shadow(page, '[data-share-warn]')).toBeVisible();
    await expect(shadow(page, '[data-share-warn]')).toContainText('Sketch has unsaved edits');
    await expect(shadow(page, '[data-share] [data-act="copy-config"]')).toBeVisible();
    await shadow(page, '[data-act="copy-link"]').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('unpolish=sketch');
    // The reported bug: discard, switch theme — the warning must not linger.
    await page.evaluate(() => window.Unpolish.discardLocalChanges());
    await shadow(page, '.tile[data-theme="blueprint"]').click();
    await expect(shadow(page, '.source')).toHaveText('Project');
    await expect(shadow(page, '[data-share-warn]')).toBeHidden();
    await expect(shadow(page, '[data-share-theme]')).toHaveText('Blueprint');
    await expect(shadow(page, '[data-act="copy-link"]')).toHaveText('Copy link');
    // Closing the panel resets the share view
    await page.keyboard.press('Escape');
    await page.keyboard.press('\\');
    await expect(shadow(page, '[data-share]')).toBeHidden();
  });
});
