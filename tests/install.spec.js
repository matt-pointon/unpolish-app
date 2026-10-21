// Runs the real one-line installer against throwaway projects of different shapes.
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:4174/unpolish/';
const run = (cwd, args = BASE) => execSync(`curl -fsSL ${BASE}install.sh | sh -s -- ${args}`, { cwd, encoding: 'utf8' });
const html = '<!doctype html>\n<html>\n  <head>\n    <title>T</title>\n  </head>\n  <body></body>\n</html>\n';
function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'unpolish-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    if (body !== null) writeFileSync(join(dir, path), body);
  }
  return dir;
}

test.describe.configure({ mode: 'serial' });

test('Vite-style project: files land in public/, tag goes into index.html, re-runs are safe', async () => {
  const dir = project({ 'index.html': html, 'public/.keep': '' });
  const out = run(dir);
  expect(out).toContain('added the script tag to index.html');
  for (const f of ['unpolish.js', 'unpolish.config.json', 'unpolish.config.schema.json', 'README.md']) expect(existsSync(join(dir, 'public/unpolish', f)), f).toBe(true);
  const page = readFileSync(join(dir, 'index.html'), 'utf8');
  expect(page).toContain('    <script src="/unpolish/unpolish.js" data-config="unpolish.config.json" defer></script>\n  </head>');
  // Re-run: updates the script, keeps the project's config, never duplicates the tag
  writeFileSync(join(dir, 'public/unpolish/unpolish.config.json'), '{"version":1,"id":"mine"}');
  expect(run(dir)).toContain('kept your existing unpolish.config.json');
  expect(readFileSync(join(dir, 'public/unpolish/unpolish.config.json'), 'utf8')).toBe('{"version":1,"id":"mine"}');
  expect(readFileSync(join(dir, 'index.html'), 'utf8').match(/unpolish\.js/g)).toHaveLength(1);
  // Uninstall restores the HTML exactly
  run(dir, '--uninstall');
  expect(readFileSync(join(dir, 'index.html'), 'utf8')).toBe(html);
  expect(existsSync(join(dir, 'public/unpolish'))).toBe(false);
  rmSync(dir, { recursive: true, force: true });
});

test('plain multi-page site: files at the root, every page gets a relative tag', async () => {
  const dir = project({ 'index.html': html, 'about.html': html });
  run(dir);
  for (const page of ['index.html', 'about.html']) expect(readFileSync(join(dir, page), 'utf8')).toContain('<script src="unpolish/unpolish.js"');
  expect(existsSync(join(dir, 'unpolish/unpolish.js'))).toBe(true);
  run(dir, '--uninstall');
  expect(readFileSync(join(dir, 'about.html'), 'utf8')).toBe(html);
  rmSync(dir, { recursive: true, force: true });
});

test('SvelteKit: files in static/, tag in src/app.html', async () => {
  const dir = project({ 'src/app.html': html.replace('<title>T</title>', '%sveltekit.head%'), 'static/.keep': '' });
  expect(run(dir)).toContain('added the script tag to src/app.html');
  expect(existsSync(join(dir, 'static/unpolish/unpolish.js'))).toBe(true);
  rmSync(dir, { recursive: true, force: true });
});

test('Next.js: copies files and prints the exact Script line instead of editing app code', async () => {
  const layout = 'export default function L({ children }) { return <html><body>{children}</body></html>; }\n';
  const dir = project({ 'app/layout.tsx': layout, 'public/.keep': '' });
  const out = run(dir);
  expect(out).toContain('Next.js');
  expect(out).toContain('<Script src="/unpolish/unpolish.js" data-config="unpolish.config.json" strategy="afterInteractive" />');
  expect(readFileSync(join(dir, 'app/layout.tsx'), 'utf8')).toBe(layout);
  expect(existsSync(join(dir, 'public/unpolish/unpolish.js'))).toBe(true);
  rmSync(dir, { recursive: true, force: true });
});

test('the installed harness actually loads from the vendored files', async ({ page }) => {
  // Install into a project inside the served tree, then open it.
  const dir = join(process.cwd(), 'test-results', 'install-fixture');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html.replace('<body></body>', '<body><main class="card" style="padding:20px;border:1px solid #ccc;border-radius:12px">Hello</main></body>'));
  run(dir);
  await page.goto('/test-results/install-fixture/');
  await page.waitForFunction(() => window.Unpolish && document.querySelector('unpolish-harness'));
  await page.keyboard.press('\\');
  await page.keyboard.press('2');
  await expect(page.locator('html')).toHaveAttribute('data-unpolish', 'sketch');
  rmSync(dir, { recursive: true, force: true });
});
