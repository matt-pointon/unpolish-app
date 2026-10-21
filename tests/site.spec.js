import { test, expect } from '@playwright/test';

test('copy installation prompt: real file links, visible feedback', async ({ page, request }) => {
  await page.goto('/');
  await page.locator('.hero [data-copy-prompt]').click();
  await expect(page.locator('.hero [data-copy-prompt]')).toContainText('Copied');
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).toContainText('Installation prompt copied');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Install Unpolish in this prototype.');
  expect(text).toMatch(/Inspect the repository first/);
  expect(text).toMatch(/Verify:/);
  const urls = text.match(/https?:\/\/\S+?\.(json|js|md)(?=\s|$)/gm);
  expect(urls.length).toBeGreaterThanOrEqual(4);
  for (const u of urls) expect((await request.get(u)).status(), u).toBe(200);
  // Downloads on the page are real too
  for (const href of ['unpolish/unpolish.js', 'unpolish/unpolish.config.json']) expect((await request.get('/' + href)).ok()).toBe(true);
});

test('demo controls drive the real harness inside the prototype frame', async ({ page }) => {
  await page.goto('/');
  const frame = page.frameLocator('#demo-frame');
  await expect(page.locator('#rough')).toBeDisabled();
  await page.waitForFunction(() => document.getElementById('demo-frame').contentWindow?.Unpolish?.state);
  await page.locator('#demo-themes [data-theme="blueprint"]').click();
  await expect(page.locator('#demo-badge')).toHaveText('Blueprint');
  await expect(frame.locator('html')).toHaveAttribute('data-unpolish', 'blueprint');
  await expect(page.locator('#rough')).toBeEnabled();
  await page.locator('#rough').fill('80');
  await expect.poll(() => page.evaluate(() => document.getElementById('demo-frame').contentWindow.Unpolish.getSettings().roughness)).toBe(80);
  // The outer site is untouched
  expect(await page.getAttribute('html', 'data-unpolish')).toBeNull();
  // Changes made inside the frame's own panel sync back out
  await page.evaluate(() => document.getElementById('demo-frame').contentWindow.Unpolish.setTheme('pastel'));
  await expect(page.locator('#demo-badge')).toHaveText('Pastel Blocks');
  await expect(page.locator('#demo-themes [data-theme="pastel"]')).toHaveAttribute('aria-checked', 'true');
  // The prototype still works inside the frame
  await frame.locator('#book-btn').click();
  await expect(frame.locator('#book-dialog')).toBeVisible();
});

test('site works on small screens without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('.hero [data-copy-prompt]')).toBeVisible();
});
