import { test, expect } from '@playwright/test';

import { readFileSync } from 'node:fs';
import { buildRelease, loadReleaseSettings } from '../scripts/release-config.mjs';
import { OG_HEIGHT, OG_WIDTH, siteOrigin, sitePages } from '../scripts/site-seo.mjs';

const PKG = JSON.parse(readFileSync(new URL('../packages/unpolish/package.json', import.meta.url), 'utf8'));
const TGZ = `http://localhost:4174/unpolish/unpolish-${PKG.version}.tgz`;
const VER = PKG.version;
const CONFIG = JSON.parse(readFileSync(new URL('../release.config.json', import.meta.url), 'utf8'));
const clip = (page) => page.evaluate(() => navigator.clipboard.readText());

function releaseFrom(overrides = {}) {
  return buildRelease(PKG, loadReleaseSettings({ ...CONFIG, ...overrides }));
}

function localUrl(u) {
  const site = String(CONFIG.siteUrl || '').replace(/\/$/, '');
  if (site && u.startsWith(site)) return 'http://localhost:4174' + u.slice(site.length);
  return u;
}

/** Serve the page with a generated release.js, as `npm run release` would write it. */
async function withRelease(page, release) {
  await page.route('**/site/release.js', async (route) => {
    await route.fulfill({ body: `window.UNPOLISH_RELEASE = ${JSON.stringify(release)};\n`, contentType: 'text/javascript' });
  });
}

test('install with your agent copies a prompt that matches the local release', async ({ page, request }) => {
  await page.goto('/');
  expect(await page.evaluate(() => window.UNPOLISH_RELEASE)).toEqual(releaseFrom());
  await expect(page.locator('#version')).toHaveText(VER);
  const btn = page.locator('.hero [data-copy-prompt]');
  await btn.click();
  await expect(btn).toHaveText('Prompt copied');
  await expect(page.locator('#toast')).toHaveText('Paste it into your coding agent.');
  await expect(btn).toHaveText('Install with your agent', { timeout: 4000 });
  const text = await clip(page);
  expect(text.startsWith('Install Unpolish in this prototype.')).toBe(true);
  expect(text).toContain(`npx unpolish@${VER} init --dry-run`);
  expect(text).toContain(`npx unpolish@${VER} init`);
  expect(text).toContain(`npx unpolish@${VER} remove`);
  expect(text).not.toContain('npx unpolish@latest init --dry-run');
  expect(text).toContain(`Package: unpolish ${VER} on npm.`);
  expect(text).toContain('The installer needs Node.js 18 or later.');
  expect(text).toMatch(/restart the dev server/i);
  expect(text).toMatch(/rebuilt and redeployed/);
  expect(text).not.toMatch(/\.tgz|not on the npm registry|only works on that machine|localhost/);
  expect(text.split('\n').length).toBeLessThan(25);
  await expect(page.locator('#prompt-text')).toHaveText(text);
  for (const u of text.match(/https?:\/\/\S+?\.(tgz|md)(?=\s|$)/gm) || []) expect((await request.get(localUrl(u))).status(), u).toBe(200);
});

test('the command copies exactly what is shown, and the page has no release commentary', async ({ page, request }) => {
  await page.goto('/');
  for (const where of ['.hero', '#install']) {
    const btn = page.locator(`${where} [data-copy-cmd]`);
    await expect(btn).toHaveText('Copy');
    await btn.click();
    await expect(btn).toHaveText('Copied');
    expect(await clip(page)).toBe('npx unpolish@latest init');
    await expect(page.locator(`${where} [data-cmd]`)).toHaveText('npx unpolish@latest init');
    await expect(btn).toHaveText('Copy', { timeout: 4000 });
  }
  await expect(page.locator('#install')).toContainText('Run from your prototype’s project folder.');
  await expect(page.locator('[data-node-note]')).toHaveText('The command needs Node.js 18 or later. The script tag under Manual installation doesn’t.');
  await expect(page.locator('[data-local-note]')).toBeHidden();
  await expect(page.locator('.hero [data-local-note]')).toHaveCount(0);
  await expect(page.locator('.install-lede')).toContainText('No need to rewrite your prototype');
  await expect(page.locator('[data-cmd-remove]')).toHaveText('npx unpolish@latest remove');
  await expect(page.locator('[data-npm-install]')).toHaveText(`npm install --save-exact unpolish@${VER}`);
  const visible = await page.locator('body').innerText();
  for (const gone of ['Preview build', 'not on npm yet', 'installs v0.1.0 from this site', 'All options', 'pinned dependency', '4-line block', 'Nothing to rebuild', 'inspects the repo', 'Recommended', '$ npx'])
    expect(visible, gone).not.toContain(gone);
  const html = await page.content();
  expect(html).not.toMatch(/jsdelivr|unpkg|install\.sh/);
  const links = await page.locator('#install a[href]').evaluateAll((as) => as.map((a) => a.href).filter((h) => !h.includes('#')));
  expect(links.length).toBeGreaterThanOrEqual(5);
  for (const u of links) expect((await request.get(localUrl(u))).status(), u).toBe(200);
});

test('when the clipboard fails, nothing claims success and the text is selected instead', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
    document.execCommand = () => false;
  });
  await page.goto('/');
  const cmdBtn = page.locator('#install [data-copy-cmd]');
  await cmdBtn.click();
  await expect(page.locator('#toast')).toContainText('Couldn’t copy automatically');
  await expect(cmdBtn).toHaveText('Copy');
  expect(await page.evaluate(() => getSelection().toString())).toBe('npx unpolish@latest init');
  const promptBtn = page.locator('.hero [data-copy-prompt]');
  await promptBtn.click();
  await expect(promptBtn).toHaveText('Install with your agent');
  await expect(page.locator('#prompt-text')).toBeVisible();
  expect(await page.evaluate(() => getSelection().toString())).toContain('Install Unpolish in this prototype.');
});

for (const [w, h] of [[1280, 800], [375, 740]]) {
  test(`commands stay readable and clear of their Copy buttons at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    for (const row of await page.locator('.cmd-row').all()) {
      const box = await row.locator('.cmd-box').boundingBox();
      const btn = await row.locator('.cmd-copy').boundingBox();
      const apart = box.x + box.width <= btn.x || box.y + box.height <= btn.y;
      expect(apart, 'Copy button overlaps the command').toBe(true);
      // The whole command can be scrolled into view inside its own box.
      const end = await row.locator('.cmd-text').evaluate((el) => { el.scrollLeft = el.scrollWidth; return { seen: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1, faded: el.classList.contains('overflows') }; });
      expect(end.seen).toBe(true);
      await expect.poll(() => row.locator('.cmd-text').evaluate((el) => el.classList.contains('overflows'))).toBe(false);
    }
  });
}

test('disclosures open with keyboard and pointer', async ({ page }) => {
  await page.goto('/#install');
  const prompt = page.locator('summary', { hasText: 'Read the prompt' });
  await prompt.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#prompt-text')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('#prompt-text')).toBeHidden();
  const manual = page.locator('#manual summary');
  await manual.click();
  await expect(page.locator('[data-npm-install]')).toBeVisible();
  await manual.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-npm-install]')).toBeHidden();
});

test('a public HTTPS distribution location changes every command, link and the prompt', async ({ page }) => {
  const dist = 'https://downloads.example.org/unpolish/';
  await withRelease(page, releaseFrom({ published: false, siteUrl: null, distUrl: dist }));
  await page.goto('/');
  const tgz = `${dist}unpolish-${VER}.tgz`;
  await expect(page.locator('.hero [data-cmd]')).toHaveText(`npx ${tgz} init`);
  await expect(page.locator('[data-cmd-remove]')).toHaveText(`npx ${tgz} remove`);
  await expect(page.locator('[data-npm-install]')).toHaveText(`npm install --save-exact ${tgz}`);
  await expect(page.locator('[data-local-note]')).toBeHidden();
  expect(await page.locator('[data-dist]').evaluateAll((as) => as.map((a) => a.href))).toEqual([`${dist}unpolish.js`, `${dist}unpolish.config.json`, `${dist}unpolish.config.schema.json`, `${dist}README.md`]);
  await expect(page.locator('[data-tarball]')).toHaveAttribute('href', tgz);
  const text = await page.locator('#prompt-text').textContent();
  expect(text).toContain(`npx ${tgz} init --dry-run`);
  expect(text).toContain('not on the npm registry yet');
  expect(text).not.toContain('only works on that machine');
  expect(text).not.toContain('localhost');
});

test('unpublished localhost still uses the origin tarball', async ({ page }) => {
  await withRelease(page, releaseFrom({ published: false, distUrl: null, siteUrl: null }));
  await page.goto('/');
  await expect(page.locator('.hero [data-cmd]')).toHaveText(`npx ${TGZ} init`);
  await expect(page.locator('[data-local-note]')).toBeVisible();
  const text = await page.locator('#prompt-text').textContent();
  expect(text).toContain(`npx ${TGZ} init --dry-run`);
  expect(text).toContain('not on the npm registry yet');
  expect(text).toContain('only works on that machine');
  expect(text).not.toMatch(/npx unpolish(@| )/);
});

test('once published, the site switches to the npm package everywhere', async ({ page }) => {
  await withRelease(page, releaseFrom({ published: true, distUrl: null, siteUrl: null }));
  await page.goto('/');
  await expect(page.locator('.hero [data-cmd]')).toHaveText('npx unpolish@latest init');
  await expect(page.locator('[data-cmd-remove]')).toHaveText('npx unpolish@latest remove');
  await expect(page.locator('[data-npm-install]')).toHaveText(`npm install --save-exact unpolish@${VER}`);
  await expect(page.locator('[data-local-note]')).toBeHidden();
  const text = await page.locator('#prompt-text').textContent();
  expect(text).toContain(`npx unpolish@${VER} init --dry-run`);
  expect(text).toContain(`npx unpolish@${VER} init`);
  expect(text).not.toContain('npx unpolish@latest init --dry-run');
  expect(text).toContain(`Package: unpolish ${VER} on npm.`);
  expect(text).toContain('https://github.com/matt-pointon/unpolish-app');
  expect(text).not.toMatch(/\.tgz|not on the npm registry|only works on that machine|localhost|127\.0\.0\.1|Preview build|not on npm yet/i);
  const visible = await page.locator('body').innerText();
  expect(visible).toContain('npx unpolish@latest init');
  expect(visible).not.toMatch(/not on npm yet|Preview build/i);
  expect(visible).not.toContain('.tgz');
  expect(visible).not.toContain('localhost');
});

test('published mode with a production URL keeps the prompt off localhost', async ({ page }) => {
  const published = JSON.parse(readFileSync(new URL('./fixtures/release-published.json', import.meta.url), 'utf8'));
  await withRelease(page, releaseFrom(published));
  await page.goto('/');
  await expect(page.locator('.hero [data-cmd]')).toHaveText('npx unpolish@latest init');
  const text = await page.locator('#prompt-text').textContent();
  expect(text).toContain(`npx unpolish@${VER} init --dry-run`);
  expect(text).toContain('https://unpolishdesign.vercel.app/unpolish/README.md');
  expect(text).not.toMatch(/localhost|\.tgz|not on the npm registry|Preview build/i);
});

test('the demo is visible on the first screen and drives the real harness', async ({ page }) => {
  await page.goto('/');
  // The live preview starts above the fold on a laptop-sized screen.
  await page.setViewportSize({ width: 1280, height: 800 });
  const top = await page.locator('#demo-frame').boundingBox();
  expect(top.y).toBeLessThan(600);
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

test('homepage SEO uses the production siteUrl and a local OG image', async ({ page, request }) => {
  const origin = siteOrigin();
  expect(origin).toBe('https://unpolishdesign.vercel.app');
  const home = sitePages(origin)[0];
  await page.goto('/');
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  expect(await page.title()).toBe(home.title);
  const attr = (sel, a = 'content') => page.locator(sel).first().getAttribute(a);
  expect(await attr('meta[name="description"]')).toBe(home.description);
  expect(await attr('link[rel="canonical"]', 'href')).toBe(`${origin}/`);
  expect(await attr('meta[property="og:title"]')).toBe(home.title);
  expect(await attr('meta[property="og:description"]')).toBe(home.description);
  expect(await attr('meta[property="og:url"]')).toBe(`${origin}/`);
  expect(await attr('meta[property="og:image"]')).toBe(`${origin}/og.png`);
  expect(await attr('meta[property="og:image:width"]')).toBe(String(OG_WIDTH));
  expect(await attr('meta[property="og:image:height"]')).toBe(String(OG_HEIGHT));
  expect(await attr('meta[property="og:image:alt"]')).toBe('Less polish. Better conversations.');
  expect(await attr('meta[property="og:image:type"]')).toBe('image/png');
  expect(await attr('meta[property="og:type"]')).toBe('website');
  expect(await attr('meta[property="og:site_name"]')).toBe('Unpolish');
  expect(await attr('meta[name="twitter:card"]')).toBe('summary_large_image');
  expect(await attr('meta[name="twitter:title"]')).toBe(home.title);
  expect(await attr('meta[name="twitter:description"]')).toBe(home.description);
  expect(await attr('meta[name="twitter:image"]')).toBe(`${origin}/og.png`);
  expect(await attr('meta[name="theme-color"]')).toBe('#f7f6f2');
  expect(await attr('link[rel="icon"]', 'href')).toBe(`${origin}/site/favicon.svg`);
  expect(await attr('link[rel="apple-touch-icon"]', 'href')).toBe(`${origin}/apple-touch-icon.png`);
  const og = await request.get('/og.png');
  expect(og.status()).toBe(200);
  expect(og.headers()['content-type']).toMatch(/image\/png/);
  const body = Buffer.from(await og.body());
  expect(body.length).toBeLessThan(300 * 1024);
  expect(body.readUInt32BE(16)).toBe(OG_WIDTH);
  expect(body.readUInt32BE(20)).toBe(OG_HEIGHT);
});
