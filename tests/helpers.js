export const THEMES = ['black-white', 'sketch', 'blueprint', 'pastel'];
export const EXAMPLES = {
  plain: '/examples/plain-html/',
  react: '/examples/react/dist/',
  vue: '/examples/vue/dist/',
  svelte: '/examples/svelte/dist/',
  demo: '/site/demo/',
};

export async function open(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.Unpolish && document.querySelector('unpolish-harness')?.shadowRoot?.querySelector('.panel'));
}
export const setTheme = (page, id) => page.evaluate((id) => window.Unpolish.setTheme(id), id);
export const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
export async function settle(page) { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
export const panel = (page) => page.locator('unpolish-harness .panel');
export const shadow = (page, sel) => page.locator('unpolish-harness').locator(sel);

/** Bounding boxes of every visible element in light DOM, keyed by index. */
export function rects(page, selector = 'body *') {
  return page.evaluate((selector) => [...document.querySelectorAll(selector)]
    .filter((e) => !e.closest('unpolish-harness, #unpolish-filters, svg *'))
    .map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; }), selector);
}

/** Computed styles that matter visually, for restore / leak comparisons. */
export function styles(page, selector = 'body, body *') {
  const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderTopWidth', 'boxShadow', 'outlineStyle', 'fontFamily', 'borderTopLeftRadius', 'filter', 'textDecorationLine', 'objectPosition'];
  return page.evaluate(({ selector, props }) => [...document.querySelectorAll(selector)]
    .filter((e) => !e.closest('unpolish-harness, #unpolish-filters'))
    .map((e) => { const cs = getComputedStyle(e); return e.tagName + ':' + props.map((p) => cs[p]).join('|'); }), { selector, props });
}
