import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRelease, loadReleaseSettings, parseReleaseJs } from '../scripts/release-config.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PKG = JSON.parse(readFileSync(join(ROOT, 'packages/unpolish/package.json'), 'utf8'));
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'release.config.json'), 'utf8'));

test('committed site/release.js matches the unpublished config', () => {
  const settings = loadReleaseSettings(CONFIG);
  expect(settings.published).toBe(false);
  const expected = buildRelease(PKG, settings);
  const committed = parseReleaseJs(readFileSync(join(ROOT, 'site/release.js'), 'utf8'));
  expect(committed).toEqual(expected);
  expect(expected.executable).toBe('unpolish');
  expect(expected.tarballUrl).toBeNull();
  expect(expected.siteUrl).toBe('https://unpolish.vercel.app/');
  expect(expected.homepage).toBe('https://unpolish.vercel.app');
  expect(expected.published).toBe(false);
});

test('published-mode config is derived without localhost or tarball install URLs', () => {
  const printed = execFileSync('node', [
    'scripts/release.mjs', '--print', '--config', 'tests/fixtures/release-published.json',
  ], { cwd: ROOT, encoding: 'utf8' });
  const release = JSON.parse(printed);
  expect(release).toEqual(buildRelease(PKG, loadReleaseSettings(JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/release-published.json'), 'utf8')))));
  expect(release.published).toBe(true);
  expect(release.siteUrl).toBe('https://unpolish.vercel.app/');
  expect(release.homepage).toBe('https://unpolish.vercel.app');
  expect(release.executable).toBe('unpolish');
  expect(release.tarballUrl).toBeNull();
  expect(release.docsUrl).toBe('https://unpolish.vercel.app/unpolish/README.md');
  expect(release.bundleUrl).toBe('https://unpolish.vercel.app/unpolish/unpolish.js');
  expect(JSON.stringify(release)).not.toMatch(/localhost|127\.0\.0\.1/);
  // --print must not rewrite the committed unpublished site/release.js
  expect(parseReleaseJs(readFileSync(join(ROOT, 'site/release.js'), 'utf8')).published).toBe(false);
});

test('published with no production URL still documents npm, never the page origin', () => {
  const release = buildRelease(PKG, loadReleaseSettings({ published: true, siteUrl: null, distUrl: null }));
  expect(release.docsUrl).toMatch(/^https:\/\/github\.com\//);
  expect(release.tarballUrl).toBeNull();
  expect(release.bundleUrl).toBeNull();
  expect(JSON.stringify(release)).not.toMatch(/localhost/);
});

test('non-HTTPS distribution URLs are rejected', () => {
  expect(() => loadReleaseSettings({ distUrl: 'http://example.com/unpolish/' })).toThrow(/https:\/\//);
  expect(() => loadReleaseSettings({ siteUrl: 'http://unpolish.vercel.app' })).toThrow(/https:\/\//);
  const dir = join(ROOT, '.tmp');
  mkdirSync(dir, { recursive: true });
  const bad = join(dir, 'bad-release.json');
  writeFileSync(bad, JSON.stringify({ published: false, distUrl: 'http://127.0.0.1/unpolish/' }));
  expect(() => execFileSync('node', ['scripts/release.mjs', '--print', '--config', bad], { cwd: ROOT, encoding: 'utf8' })).toThrow(/https:\/\//);
});
