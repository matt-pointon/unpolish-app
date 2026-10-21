import { test, expect } from '@playwright/test';

const TGZ = 'http://localhost:4174/unpolish/unpolish-0.1.0.tgz';

test('install with your agent: a short prompt that matches the release the site serves', async ({ page, request }) => {
  await page.goto('/');
  const release = await page.evaluate(() => window.UNPOLISH_RELEASE);
  expect(release).toEqual({ name: 'unpolish', version: '0.1.0', published: false, tarball: 'unpolish-0.1.0.tgz' });
  await page.locator('.hero [data-copy-prompt]').click();
  await expect(page.locator('.hero [data-copy-prompt]')).toContainText('Copied');
  await expect(page.locator('#toast')).toContainText('paste it into your coding agent');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Install Unpolish in this prototype.');
  expect(text).toContain(`npx ${TGZ} init --dry-run`);
  expect(text).toContain(`npx ${TGZ} remove`);
  expect(text).toMatch(/not on npm yet/);
  expect(text).not.toMatch(/npx unpolish(@| )/);          // never the unpublished registry package
  expect(text.split('\n').length).toBeLessThan(25);
  await expect(page.locator('#prompt-text')).toHaveText(text);
  for (const u of text.match(/https?:\/\/\S+?\.(tgz|md)(?=\s|$)/gm)) expect((await request.get(u)).status(), u).toBe(200);
});

test('copy install command: labelled as a preview build, and every download exists', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('.hero [data-release-label]')).toHaveText('Preview build · not on npm yet');
  await page.locator('.hero [data-copy-cmd]').click();
  await expect(page.locator('.hero [data-copy-cmd]')).toContainText('Copied');
  await expect(page.locator('#toast')).toContainText('run it in your project folder to install');
  const cmd = await page.evaluate(() => navigator.clipboard.readText());
  expect(cmd).toBe(`npx ${TGZ} init`);
  await expect(page.locator('.hero [data-cmd]')).toHaveText(cmd);
  await expect(page.locator('[data-cmd-remove]')).toHaveText(`npx ${TGZ} remove`);
  await expect(page.locator('[data-npm-install]')).toHaveText(`npm install --save-exact ${TGZ}`);
  const html = await page.content();
  expect(html).not.toMatch(/jsdelivr|unpkg|install\.sh/);
  const links = await page.locator('#install a[href]').evaluateAll((as) => as.map((a) => a.href).filter((h) => !h.includes('#')));
  expect(links.length).toBeGreaterThanOrEqual(5);
  for (const u of links) expect((await request.get(u)).status(), u).toBe(200);
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
  await expect(page.locator('.hero [data-copy-prompt]')).toBeVisible();
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
