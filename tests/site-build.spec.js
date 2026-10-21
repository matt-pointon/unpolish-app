import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheControl, compileVercel, spaDestination } from '../scripts/site-routing.mjs';
import { OG_HEIGHT, OG_WIDTH, siteOrigin, sitemapUrls } from '../scripts/site-seo.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PKG = JSON.parse(readFileSync(join(ROOT, 'packages/unpolish/package.json'), 'utf8'));

function listFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, acc);
    else acc.push(relative(PUBLIC, p).split(sep).join('/'));
  }
  return acc;
}

test('vercel.json rewrites SPA paths without extensions and 404s files', () => {
  const vercel = compileVercel(JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')));
  expect(spaDestination(vercel.rewrites, '/examples/react/clients/42')).toBe('/examples/react/index.html');
  expect(spaDestination(vercel.rewrites, '/examples/svelte/alerts')).toBe('/examples/svelte/index.html');
  expect(spaDestination(vercel.rewrites, '/examples/react/assets/index.js')).toBeNull();
  expect(spaDestination(vercel.rewrites, '/examples/vue/about')).toBeNull();
  expect(spaDestination(vercel.rewrites, '/missing')).toBeNull();
  expect(cacheControl(vercel.headers, '/unpolish/0.1.0/unpolish.js')).toMatch(/immutable/);
  expect(cacheControl(vercel.headers, '/unpolish/unpolish.js')).toMatch(/no-cache/);
  expect(cacheControl(vercel.headers, '/site/release.js')).toMatch(/no-cache/);
  expect(cacheControl(vercel.headers, '/')).toMatch(/no-cache/);
  expect(cacheControl(vercel.headers, '/og.png')).toMatch(/max-age=86400/);
  expect(cacheControl(vercel.headers, '/robots.txt')).toMatch(/no-cache/);
  expect(cacheControl(vercel.headers, '/sitemap.xml')).toMatch(/no-cache/);
  expect(spaDestination(vercel.rewrites, '/og.png')).toBeNull();
  expect(spaDestination(vercel.rewrites, '/robots.txt')).toBeNull();
  expect(spaDestination(vercel.rewrites, '/sitemap.xml')).toBeNull();
});

test('public/ contains only hosted files', () => {
  const files = listFiles(PUBLIC);
  expect(files.length).toBeGreaterThan(20);
  const forbidden = /^(tests|scripts|packages|node_modules|\.git|\.github)\b|\/(src|fixtures|node_modules)\//;
  for (const f of files) expect(f, f).not.toMatch(forbidden);
  for (const need of [
    'index.html', 'site/demo/index.html', 'site/release.js',
    'examples/plain-html/index.html', 'examples/assets/lake.svg',
    'examples/react/index.html', 'examples/vue/index.html', 'examples/svelte/index.html',
    'unpolish/unpolish.js', `unpolish/${PKG.version}/unpolish.js`,
    'docs/VALIDATION.md',
    'og.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml',
  ]) expect(files, need).toContain(need);
});

test('homepage anchors, demo, examples and validation page are reachable', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('#hero-title')).toBeVisible();
  await page.locator('.nav-links a[href="#install"]').click();
  await expect(page).toHaveURL(/#install$/);
  await expect(page.locator('#install-title')).toBeVisible();
  await page.locator('.nav-links a[href="#customize"]').click();
  await expect(page.locator('#customize-title')).toBeVisible();
  await page.locator('.nav-links a[href="#review-links"]').click();
  await expect(page.locator('#links-title')).toBeVisible();

  expect((await request.get('/docs/VALIDATION.md')).status()).toBe(200);
  expect((await request.get('/unpolish/README.md')).status()).toBe(200);
  expect((await request.get('/unpolish/unpolish.js')).status()).toBe(200);
  expect((await request.get(`/unpolish/${PKG.version}/unpolish.js`)).status()).toBe(200);
});

test('/site/demo/ loads directly with the harness', async ({ page }) => {
  await page.goto('/site/demo/');
  await page.waitForFunction(() => window.Unpolish && document.querySelector('unpolish-harness'));
  await expect(page.locator('unpolish-harness')).toHaveCount(1);
  await expect(page.locator('#share-btn')).toBeVisible();
});

test('plain HTML example pages keep relative assets working', async ({ page }) => {
  await page.goto('/examples/plain-html/');
  await page.waitForFunction(() => window.Unpolish);
  await expect(page.getByTestId('brand')).toBeVisible();
  const img = page.locator('.tile__img').first();
  await expect(img).toBeVisible();
  expect(await img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
  await page.getByTestId('nav-about').click();
  await expect(page).toHaveURL(/about\.html/);
  await expect(page.locator('h1')).toBeVisible();
});

test('React deep link survives refresh under history routing', async ({ page }) => {
  await page.goto('/examples/react/clients/42');
  await expect(page).toHaveURL(/\/examples\/react\/clients\/42\/?/);
  await expect(page.locator('h1')).toHaveText('Clients');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Clients');
  await expect(page.locator('unpolish-harness')).toHaveCount(1);
});

test('Svelte deep link survives refresh under history routing', async ({ page }) => {
  await page.goto('/examples/svelte/alerts');
  await expect(page).toHaveURL(/\/examples\/svelte\/alerts\/?/);
  await expect(page.locator('h1')).toHaveText('Alerts');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Alerts');
  await expect(page.locator('unpolish-harness')).toHaveCount(1);
});

test('Vue hash routes need no rewrite', async ({ page }) => {
  await page.goto('/examples/vue/#/about');
  await expect(page.locator('h1')).toHaveText('About');
  await page.getByTestId('nav-trails').click();
  await expect(page).toHaveURL(/#\/trails$/);
  await expect(page.locator('h1')).toContainText('Find your next trail');
});

test('missing assets 404 as files, not as HTML', async ({ request }) => {
  for (const u of [
    '/examples/react/definitely-missing.js',
    '/examples/svelte/no-such.json',
    '/unpolish/missing.tgz',
    '/site/not-a-file.js',
    '/no-such-page',
  ]) {
    const res = await request.get(u);
    expect(res.status(), u).toBe(404);
    const type = res.headers()['content-type'] || '';
    expect(type, u).not.toMatch(/text\/html/);
    expect(await res.text(), u).not.toMatch(/<!doctype html/i);
  }
});

test('versioned downloads are immutable; HTML and aliases are not cached', async ({ request }) => {
  const versioned = await request.get(`/unpolish/${PKG.version}/unpolish.js`);
  const alias = await request.get('/unpolish/unpolish.js');
  const html = await request.get('/');
  const release = await request.get('/site/release.js');
  expect(versioned.status()).toBe(200);
  expect(versioned.headers()['cache-control']).toMatch(/immutable/);
  expect(alias.headers()['cache-control']).toMatch(/no-cache/);
  expect(html.headers()['cache-control']).toMatch(/no-cache/);
  expect(release.headers()['cache-control']).toMatch(/no-cache/);
  expect(Buffer.from(await versioned.body()).equals(Buffer.from(await alias.body()))).toBe(true);
});

test('og.png, robots.txt and sitemap.xml are served with the right types', async ({ page, request }) => {
  const origin = siteOrigin();
  const og = await request.get('/og.png');
  expect(og.status()).toBe(200);
  expect(og.headers()['content-type']).toMatch(/image\/png/);
  const png = Buffer.from(await og.body());
  expect(png.length).toBeLessThan(300 * 1024);
  expect(png.readUInt32BE(16)).toBe(OG_WIDTH);
  expect(png.readUInt32BE(20)).toBe(OG_HEIGHT);

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toMatch(/text\/plain/);
  const robotsText = await robots.text();
  expect(robotsText).toContain('Disallow: /examples/');
  expect(robotsText).toContain(`Sitemap: ${origin}/sitemap.xml`);

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toMatch(/xml/);
  const xml = await sitemap.text();
  for (const loc of sitemapUrls(origin)) expect(xml).toContain(`<loc>${loc}</loc>`);
  expect(xml).not.toContain('/examples/');

  const icon = await request.get('/apple-touch-icon.png');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toMatch(/image\/png/);

  await page.goto('/site/demo/');
  expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(`${origin}/site/demo/`);
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toBe(`${origin}/og.png`);

  for (const u of ['/examples/plain-html/', '/examples/react/', '/examples/vue/', '/examples/svelte/']) {
    await page.goto(u);
    expect(await page.locator('meta[name="robots"]').getAttribute('content'), u).toMatch(/noindex/);
  }
});
