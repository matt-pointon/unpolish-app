import { test, expect } from '@playwright/test';

test('copy install command: a real one-liner, plus the agent prompt as an alternative', async ({ page, request }) => {
  await page.goto('/');
  await page.locator('.hero [data-copy-cmd]').click();
  await expect(page.locator('.hero [data-copy-cmd]')).toContainText('Copied');
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).toContainText('Install command copied');
  const cmd = await page.evaluate(() => navigator.clipboard.readText());
  expect(cmd).toBe('curl -fsSL http://localhost:4174/unpolish/install.sh | sh -s -- http://localhost:4174/unpolish/');
  await expect(page.locator('.hero [data-cmd]')).toHaveText(cmd);
  for (const f of ['install.sh', 'unpolish.js', 'unpolish.config.json', 'unpolish.config.schema.json', 'README.md']) {
    expect((await request.get('/unpolish/' + f)).status(), f).toBe(200);
  }
  // The coding-agent prompt is still there, and points at the installer
  await page.locator('summary', { hasText: 'Prefer a coding agent?' }).click();
  await page.locator('[data-copy-prompt]').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Install Unpolish in this prototype.');
  expect(text).toContain(cmd);
  expect(text).toMatch(/Inspect the repository first/);
  const urls = text.match(/https?:\/\/\S+?\.(json|js|md|sh)(?=\s|$)/gm);
  for (const u of urls) expect((await request.get(u)).status(), u).toBe(200);
});

test('the demo is visible on the first screen and drives the real harness', async ({ page }) => {
  await page.goto('/');
  // The live preview starts above the fold on a laptop-sized screen.
  await page.setViewportSize({ width: 1280, height: 800 });
  const top = await page.locator('#demo-frame').boundingBox();
  expect(top.y).toBeLessThan(560);
  const frame = page.frameLocator('#demo-frame');
  await page.waitForFunction(() => document.getElementById('demo-frame').contentWindow?.Unpolish?.state);
  await page.locator('#demo-themes [data-theme="blueprint"]').click();
  await expect(page.locator('#demo-themes [data-theme="blueprint"]')).toHaveAttribute('aria-checked', 'true');
  await expect(frame.locator('html')).toHaveAttribute('data-unpolish', 'blueprint');
  // The outer site is untouched
  expect(await page.getAttribute('html', 'data-unpolish')).toBeNull();
  // Changes made inside the frame's own panel sync back out
  await page.evaluate(() => document.getElementById('demo-frame').contentWindow.Unpolish.setTheme('pastel'));
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
  await expect(page.locator('.hero [data-copy-cmd]')).toBeVisible();
  // Narrow screens get a dropdown instead of the clipped segmented control, plus a full-screen demo link.
  await expect(page.locator('#demo-themes')).toBeHidden();
  await page.waitForFunction(() => document.getElementById('demo-frame').contentWindow?.Unpolish?.state);
  await page.locator('#demo-select').selectOption('blueprint');
  await expect(page.frameLocator('#demo-frame').locator('html')).toHaveAttribute('data-unpolish', 'blueprint');
  await expect(page.locator('#demo-full')).toHaveAttribute('href', 'site/demo/');
});

test('the configurator drives its own live preview with the panel\'s settings', async ({ page }) => {
  await page.goto('/#customize');
  const frame = page.frameLocator('#cfg-frame');
  await page.waitForFunction(() => document.getElementById('cfg-frame').contentWindow?.Unpolish?.state?.().settings);
  await expect(frame.locator('html')).toHaveAttribute('data-unpolish', 'sketch');
  // No launcher inside the preview; the page's controls do the talking.
  await expect(frame.locator('unpolish-harness').locator('.launcher')).toBeHidden();
  await page.locator('[data-cfg="theme"] [data-v="blueprint"]').click();
  await expect(frame.locator('html')).toHaveAttribute('data-unpolish', 'blueprint');
  await page.locator('#cfg-details').fill('0');
  await expect(page.locator('#cfg-details-val')).toHaveText('Off');
  await page.locator('[data-cfg="images"] [data-v="mono"]').click();
  await page.locator('[data-cfg="lines"] [data-v="dashed"]').click();
  await page.locator('[data-cfg="radius"] [data-v="0"]').click();
  await page.locator('[data-cfg="typography"] [data-v="original"]').click();
  const settings = () => page.evaluate(() => document.getElementById('cfg-frame').contentWindow.Unpolish.getSettings());
  await expect.poll(settings).toMatchObject({ details: 0, images: 'mono', border: { style: 'dashed' }, radius: 0, typography: 'original' });
  // The hero demo is a separate instance and is unaffected.
  expect(await page.evaluate(() => document.getElementById('demo-frame').contentWindow.Unpolish.getTheme())).toBe('original');
  await page.locator('#cfg-reset').click();
  await expect.poll(settings).toMatchObject({ details: 45, images: 'theme' });
  await expect(page.locator('[data-cfg="images"] [data-v="theme"]')).toHaveAttribute('aria-checked', 'true');
});
