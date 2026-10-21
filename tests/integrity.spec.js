import { test, expect } from '@playwright/test';
import { EXAMPLES, open, setTheme, settle } from './helpers.js';

test('React (Tailwind, history routing, portals): app works and dynamic content is themed', async ({ page }) => {
  await open(page, EXAMPLES.react + '?tab=all#top');
  await setTheme(page, 'sketch');
  await settle(page);
  // Client-side navigation keeps the theme and the app's query/hash.
  await page.getByTestId('nav-settings').click();
  await expect(page).toHaveURL(/\/settings\?tab=all#top$/);
  expect(await page.getAttribute('html', 'data-unpolish')).toBe('sketch');
  // Invalid → valid form states, submit with loading state, toast appears themed.
  const email = page.getByTestId('email');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('save')).toBeDisabled();
  await email.fill('ana@ledger.co');
  await expect(email).toHaveAttribute('aria-invalid', 'false');
  await page.getByTestId('save').click();
  await expect(page.getByTestId('save')).toHaveText('Saving…');
  await expect(page.getByTestId('toast')).toHaveText('Settings saved');
  await expect(page.getByTestId('toast')).toHaveAttribute('data-up', /bg/);
  // Menu + portal dialog + dynamic rows
  await page.getByTestId('nav-home').click();
  await page.getByTestId('menu-btn').click();
  await expect(page.getByTestId('menu')).toBeVisible();
  await expect(page.getByTestId('menu')).toHaveAttribute('data-up', /box/);
  await page.keyboard.press('Escape');
  await page.getByRole('menuitem', { name: 'Billing' }).click();
  await page.getByTestId('new-invoice').click();
  await expect(page.getByTestId('dialog')).toHaveAttribute('data-up', /box/);
  await page.getByTestId('client').fill('Acme');
  await page.getByTestId('create').click();
  const row = page.getByTestId('invoice-table').locator('tbody tr').last();
  await expect(row).toContainText('Acme');
  await expect(row.locator('span').first()).toHaveAttribute('data-up', /tone-accent/);
  // Browser back stays themed
  await page.goBack();
  expect(await page.getAttribute('html', 'data-unpolish')).toBe('sketch');
});

test('Vue (scoped styles, hash routing, Teleport): tabs, dialog validation, dynamic list', async ({ page }) => {
  await open(page, EXAMPLES.vue);
  await setTheme(page, 'pastel');
  await settle(page);
  await page.getByTestId('tab-hard').click();
  await expect(page.getByTestId('tab-hard')).toHaveAttribute('data-up', /fill-2/);
  await expect(page.getByTestId('trail-list').locator('li')).toHaveCount(2);
  await page.getByTestId('add-trail').click();
  const added = page.getByTestId('trail-list').locator('li').last();
  await expect(added).toContainText('New trail 1');
  await expect(added).toHaveAttribute('data-up', /box/);
  await page.getByTestId('open-dialog').click();
  await page.getByTestId('book').click();
  await expect(page.getByTestId('name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.err')).toHaveAttribute('data-up', /text-danger/);
  await page.getByTestId('name').fill('Robin');
  await page.getByTestId('book').click();
  await expect(page.getByTestId('dialog')).toHaveCount(0);
  await page.getByTestId('nav-about').click();
  await expect(page).toHaveURL(/#\/about$/);
  await expect(page.locator('h1')).toHaveText('About');
  expect(await page.getAttribute('html', 'data-unpolish')).toBe('pastel');
});

test('Svelte (component styles, dark mode, history routing): menu, loading, filter', async ({ page }) => {
  await open(page, EXAMPLES.svelte);
  await setTheme(page, 'blueprint');
  await settle(page);
  await page.getByTestId('menu-btn').click();
  await expect(page.getByTestId('menu')).toHaveAttribute('data-up', /box/);
  await page.getByRole('menuitem', { name: 'Staging' }).click();
  await expect(page.getByTestId('menu')).toHaveCount(0);
  await page.getByTestId('refresh').click();
  await expect(page.getByTestId('refresh')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('grid').locator('article')).toHaveCount(4);
  await expect(page.getByTestId('grid').locator('article').last()).toHaveAttribute('data-up', /box/);
  await page.getByTestId('filter').fill('error');
  await expect(page.getByTestId('grid').locator('article')).toHaveCount(1);
  await page.getByTestId('nav-alerts').click();
  await expect(page).toHaveURL(/alerts$/);
  expect(await page.getAttribute('html', 'data-unpolish')).toBe('blueprint');
});

test('Plain HTML: details menu, native dialog, tabs and multi-page navigation', async ({ page }) => {
  await open(page, EXAMPLES.plain);
  await setTheme(page, 'black-white');
  await settle(page);
  await page.getByTestId('dropdown').click();
  await expect(page.getByTestId('dropdown-menu')).toBeVisible();
  await expect(page.getByTestId('dropdown-menu')).toHaveAttribute('data-up', /box/);
  await page.getByTestId('open-dialog').click();
  await expect(page.getByTestId('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByTestId('dialog')).toBeHidden();
  await page.getByTestId('tab-month').click();
  await expect(page.getByTestId('tab-month')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('add').click();
  await expect(page.getByTestId('added').locator('.badge')).toHaveAttribute('data-up', /tone-success/);
  // The local theme choice persists across full page loads.
  await page.getByTestId('nav-about').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-unpolish') === 'black-white');
});

test('switching themes preserves input values, focus, scroll position and event handlers', async ({ page }) => {
  await open(page, EXAMPLES.demo);
  const notes = page.locator('textarea[name="notes"]');
  await notes.fill('Step-free access please');
  await page.locator('input[name="guests"]').fill('28');
  await page.locator('input[name="flex"]').uncheck();
  await page.evaluate(() => window.scrollTo(0, 600));
  await notes.focus();
  const scroll = await page.evaluate(() => window.scrollY);
  for (const id of ['sketch', 'blueprint', 'original', 'pastel', 'black-white']) {
    await setTheme(page, id);
    await settle(page);
    await expect(notes).toHaveValue('Step-free access please');
    await expect(page.locator('input[name="guests"]')).toHaveValue('28');
    await expect(page.locator('input[name="flex"]')).not.toBeChecked();
    expect(await page.evaluate(() => document.activeElement?.name)).toBe('notes');
  }
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scroll)).toBeLessThan(60);
  // Handlers still fire: tabs and dialog
  await page.getByRole('tab', { name: 'Budget' }).click();
  await expect(page.locator('#panel-budget')).toBeVisible();
  await page.locator('#book-btn').click();
  await expect(page.locator('#book-dialog')).toBeVisible();
});

test('visual states keep distinctions: selected, disabled, invalid, loading, status', async ({ page }) => {
  await open(page, EXAMPLES.demo);
  await setTheme(page, 'black-white');
  await settle(page);
  const tok = (sel) => page.locator(sel).first().getAttribute('data-up');
  expect(await tok('.status-success')).toContain('tone-success');
  expect(await tok('.status-warning')).toContain('tone-warning');
  expect(await tok('.status-danger')).toContain('tone-danger');
  // B&W keeps status meaning through patterns, not colour
  const pat = (sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundImage);
  expect(await pat('.status-danger')).toContain('repeating-linear-gradient');
  expect(await pat('.status-warning')).toContain('radial-gradient');
  expect(await pat('.status-success')).not.toEqual(await pat('.status-danger'));
  // Selected tab vs others; disabled button looks disabled; invalid field marked
  const tabBorder = (n) => page.getByRole('tab', { name: n }).evaluate((e) => getComputedStyle(e).borderBottomColor);
  expect(await tabBorder('Overview')).not.toEqual(await tabBorder('Schedule'));
  const disabled = page.getByRole('button', { name: 'Save draft' });
  expect(await disabled.evaluate((e) => getComputedStyle(e).color)).not.toEqual(await page.getByRole('button', { name: 'Send request' }).evaluate((e) => getComputedStyle(e).color));
  const email = page.locator('input[name="email"]');
  expect(await email.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('1px');
  // Hover feedback exists for controls
  const share = page.locator('#share-btn');
  const bg0 = await share.evaluate((e) => getComputedStyle(e).backgroundColor);
  await share.hover();
  await settle(page);
  expect(await share.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toEqual(bg0);
  // Loading state renders and clears
  await email.fill('maya@fieldtrip.co');
  await page.locator('#hold-submit').click();
  await expect(page.locator('#hold-submit')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#hold-submit')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#feed li').first().locator('img')).toHaveAttribute('data-unpolish-skip', 'image');
});
