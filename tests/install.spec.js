// Installs the packed release artifact (unpolish/unpolish-<version>.tgz) into
// temporary copies of real projects and checks the result in a browser.
// Fixtures live in .tmp/install/ and are served by the test server.
import { test, expect } from '@playwright/test';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, setTheme, settle, shadow, styles } from './helpers.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PKG = JSON.parse(readFileSync(join(ROOT, 'packages/unpolish/package.json'), 'utf8'));
const TGZ = join(ROOT, 'unpolish', `${PKG.name}-${PKG.version}.tgz`);
const WORK = join(ROOT, '.tmp', 'install');
const START = '// unpolish:start';

test.describe.configure({ timeout: 300_000 });

/* ---------- helpers ---------- */

const read = (f) => readFileSync(f, 'utf8');
const json = (f) => JSON.parse(read(f));
const served = (dir) => '/' + relative(ROOT, dir).split(sep).join('/') + '/';
const version = (p) => json(join(ROOT, 'node_modules', p, 'package.json')).version;

function fresh(name) {
  const d = join(WORK, name);
  rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  return d;
}

let cliPath;
/** The CLI from inside the packed tarball, not the source tree. */
function cli() {
  if (!cliPath) {
    const d = fresh(`pkg-${process.pid}`);
    execFileSync('tar', ['-xzf', TGZ, '-C', d]);
    cliPath = join(d, 'package', 'bin', 'unpolish.mjs');
  }
  return cliPath;
}

function run(cwd, args, env = {}) {
  const r = spawnSync('node', [cli(), ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr, report: args.includes('--json') ? JSON.parse(r.stdout) : null };
}

/** path → content hash of every project file (ignores installs and builds). */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.next'].includes(e.name)) continue;
      const p = join(d, e.name);
      if (lstatSync(p).isSymbolicLink()) out[relative(dir, p)] = 'link';
      else if (e.isDirectory()) walk(p);
      else out[relative(dir, p)] = createHash('sha1').update(readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

function sh(cwd, cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

const npmInstall = (dir) => sh(dir, 'npm', ['install', '--prefer-offline', '--no-audit', '--no-fund']);

/** Renders in Original, themes, returns to Original: must look exactly as before. */
async function checkInBrowser(page, url, act) {
  await open(page, url);
  await expect(page.locator('unpolish-harness')).toHaveCount(1);
  expect(await page.getAttribute('html', 'data-unpolish')).toBeNull();
  await page.mouse.move(0, 0);   // no hover state in the comparison
  const before = await styles(page);
  await setTheme(page, 'sketch');
  await settle(page);
  expect(await page.getAttribute('html', 'data-unpolish')).toBe('sketch');
  await expect(page.locator('#unpolish-theme')).toHaveCount(1);
  await act(page);
  await page.reload();
  await open(page, url);
  await setTheme(page, 'original');
  await settle(page);
  expect(await page.getAttribute('html', 'data-unpolish')).toBeNull();
  await expect(page.locator('#unpolish-theme')).toHaveCount(0);
  await page.mouse.move(0, 0);
  expect(await styles(page)).toEqual(before);
  // A review link on the built preview: theme applied, controls hidden, \ still opens them.
  await open(page, url + '?unpolish=blueprint&unpolish-ui=hidden');
  expect(await page.getAttribute('html', 'data-unpolish')).toBe('blueprint');
  await expect(shadow(page, '.launcher')).toBeHidden();
  await expect(page.locator('unpolish-harness')).toHaveCount(1);
}

/* ---------- the artifact itself ---------- */

test('the tarball contains the runtime, bundle, types, schema, starter config and installer', () => {
  const files = execFileSync('tar', ['-tzf', TGZ], { encoding: 'utf8' }).trim().split('\n').sort();
  expect(files).toEqual([
    'package/LICENSE', 'package/README.md', 'package/bin/unpolish.mjs',
    'package/dist/unpolish.cjs', 'package/dist/unpolish.d.ts', 'package/dist/unpolish.js', 'package/dist/unpolish.mjs',
    'package/package.json', 'package/schema/unpolish.config.schema.json', 'package/templates/unpolish.config.json'
  ]);
  const pkg = JSON.parse(execFileSync('tar', ['-xzOf', TGZ, 'package/package.json'], { encoding: 'utf8' }));
  expect(pkg.bin).toEqual({ unpolish: 'bin/unpolish.mjs' });
  expect(pkg.exports['.']).toMatchObject({ types: './dist/unpolish.d.ts', import: './dist/unpolish.mjs', require: './dist/unpolish.cjs' });
  expect(pkg.exports['./browser']).toBe('./dist/unpolish.js');
  expect(pkg.dependencies).toBeUndefined();
  const starter = JSON.parse(execFileSync('tar', ['-xzOf', TGZ, 'package/templates/unpolish.config.json'], { encoding: 'utf8' }));
  expect(starter.defaultTheme).toBe('original');
});

test('committed release files match a fresh build of the package', () => {
  sh(join(ROOT, 'packages/unpolish'), 'node', ['scripts/build.mjs']);
  const dist = (f) => read(join(ROOT, 'packages/unpolish/dist', f));
  expect(read(join(ROOT, 'unpolish/unpolish.js')), 'unpolish/unpolish.js is stale: run npm run release').toBe(dist('unpolish.js'));
  const d = fresh('repack');
  sh(join(ROOT, 'packages/unpolish'), 'npm', ['pack', '--silent', '--pack-destination', d]);
  const a = fresh('repack/a'), b = fresh('repack/b');
  execFileSync('tar', ['-xzf', join(d, `${PKG.name}-${PKG.version}.tgz`), '-C', a]);
  execFileSync('tar', ['-xzf', TGZ, '-C', b]);
  expect(snapshot(b), 'the committed tarball is stale: run npm run release').toEqual(snapshot(a));
  // The website reads its commands from site/release.js.
  const rel = read(join(ROOT, 'site/release.js'));
  const data = JSON.parse(rel.slice(rel.indexOf('{'), rel.lastIndexOf('}') + 1));
  const settings = json(join(ROOT, 'release.config.json'));
  expect(data).toEqual({ name: PKG.name, version: PKG.version, node: PKG.engines.node, published: settings.published, tarball: `${PKG.name}-${PKG.version}.tgz`, distUrl: settings.distUrl });
});

test('imports are safe on the server: nothing runs until init() in a browser', () => {
  cli();
  const dir = join(WORK, `pkg-${process.pid}`, 'package');
  const esm = sh(dir, 'node', ['--input-type=module', '-e',
    "const m = await import('./dist/unpolish.mjs'); console.log(JSON.stringify([m.init(), m.init({ configUrl: '/x.json' }), m.getUnpolish(), m.version, typeof m.default.init, typeof globalThis.window]))"]);
  expect(JSON.parse(esm)).toEqual([null, null, null, PKG.version, 'function', 'undefined']);
  const cjs = sh(dir, 'node', ['-e', "const m = require('./dist/unpolish.cjs'); console.log(JSON.stringify([m.init(), m.version]))"]);
  expect(JSON.parse(cjs)).toEqual([null, PKG.version]);
  // The script-tag bundle is a no-op without a DOM.
  sh(dir, 'node', ['-e', "require('vm').runInNewContext(require('fs').readFileSync('./dist/unpolish.js','utf8'), {}); console.log('ok')"]);
  const dts = read(join(dir, 'dist/unpolish.d.ts'));
  expect(dts).toContain('export function init(options?: InitOptions): UnpolishApi | null;');
});

test('init runs once: repeated init, a second import and a script tag share one instance', async ({ page }) => {
  await page.goto('/site/demo/index.html');
  await page.waitForFunction(() => window.Unpolish?.state);
  const result = await page.evaluate(async () => {
    const m = await import('/packages/unpolish/dist/unpolish.mjs');
    const a = m.init(); const b = m.init({ config: { defaultTheme: 'sketch' } });
    return { same: a === b && a === window.Unpolish && m.getUnpolish() === a, hosts: document.querySelectorAll('unpolish-harness').length, styles: document.querySelectorAll('#unpolish-theme, #unpolish-filters').length <= 2 };
  });
  expect(result).toEqual({ same: true, hosts: 1, styles: true });
});

/* ---------- plain HTML: script install, no package.json ---------- */

test('plain HTML: script install without npm, idempotent, themes, review link, clean removal', async ({ page }) => {
  const dir = fresh('plain');
  cpSync(join(ROOT, 'examples/plain-html'), dir, { recursive: true });
  cpSync(join(ROOT, 'examples/assets'), join(WORK, 'assets'), { recursive: true });
  const config = read(join(dir, 'unpolish.config.json'));

  // Start from the site as it was before Unpolish: remove what the example has.
  let r = run(dir, ['remove', '--json']);
  expect(r.code).toBe(0);
  expect(read(join(dir, 'index.html'))).not.toContain('unpolish');
  const pristine = snapshot(dir);

  r = run(dir, ['init', '--dry-run', '--json']);
  expect(r.code).toBe(0);
  expect(r.report.status).toBe('planned');
  expect(r.report.commands).toEqual([]);
  expect(snapshot(dir)).toEqual(pristine);

  r = run(dir, ['init', '--json']);
  expect(r.code, r.out).toBe(0);
  expect(r.report.status).toBe('installed');
  expect(existsSync(join(dir, 'package.json'))).toBe(false);
  expect(read(join(dir, 'unpolish/unpolish.js')).startsWith(`/*! Unpolish v${PKG.version}`)).toBe(true);
  expect(read(join(dir, 'unpolish.config.json'))).toBe(config);
  for (const page of ['index.html', 'about.html']) {
    const html = read(join(dir, page));
    expect(html.match(/unpolish\/unpolish\.js/g)).toHaveLength(1);
    expect(html).toContain('  <script src="unpolish/unpolish.js" data-config="unpolish.config.json" defer></script>\n</head>');
  }
  const installed = snapshot(dir);
  r = run(dir, ['init', '--json']);
  expect(r.report.status).toBe('already-installed');
  expect(snapshot(dir)).toEqual(installed);

  await checkInBrowser(page, served(dir), async (page) => {
    await page.getByTestId('open-dialog').click();
    await expect(page.getByTestId('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByTestId('dialog')).toBeHidden();
    await page.getByTestId('nav-about').click();
    await expect(page).toHaveURL(/about\.html/);
    expect(await page.getAttribute('html', 'data-unpolish')).toBe('sketch');
    await page.goBack();
  });

  r = run(dir, ['remove', '--json']);
  expect(r.code).toBe(0);
  expect(snapshot(dir)).toEqual(pristine);   // config kept, everything else as before
  r = run(dir, ['remove', '--purge', '--json']);
  expect(existsSync(join(dir, 'unpolish.config.json'))).toBe(false);
});

test('a failed write mid-install is reported as partial, and re-running finishes the job', () => {
  const dir = fresh('partial');
  writeFileSync(join(dir, 'index.html'), '<!doctype html>\n<html>\n<head>\n  <title>x</title>\n</head>\n<body></body>\n</html>\n');
  symlinkSync('./missing/unpolish.config.json', join(dir, 'unpolish.config.json'));
  let r = run(dir, ['init', '--json']);
  expect(r.code).toBe(3);
  expect(r.report.status).toBe('partial');
  expect(r.report.errors[0]).toContain('unpolish.config.json');
  expect(r.report.notes.join(' ')).toContain('Applied before the failure: unpolish/unpolish.js, unpolish/unpolish.config.schema.json');
  expect(read(join(dir, 'index.html'))).not.toContain('unpolish');
  rmSync(join(dir, 'unpolish.config.json'));
  r = run(dir, ['init', '--json']);
  expect(r.code).toBe(0);
  expect(r.report.changes.filter((c) => c.type !== 'keep').map((c) => c.path)).toEqual(['unpolish.config.json', 'index.html']);
});

/* ---------- Vite apps: package install with the project's package manager ---------- */

const VITE_APPS = {
  react: {
    entry: 'src/main.jsx', deps: ['react', 'react-dom'], dev: ['vite', '@vitejs/plugin-react', '@tailwindcss/vite', 'tailwindcss'],
    act: async (page) => { await page.getByTestId('menu-btn').click(); await expect(page.getByTestId('menu')).toBeVisible(); await expect(page.getByTestId('menu')).toHaveAttribute('data-up', /box/); }
  },
  vue: {
    entry: 'src/main.js', deps: ['vue'], dev: ['vite', '@vitejs/plugin-vue'],
    act: async (page) => { await page.getByTestId('open-dialog').click(); await expect(page.getByTestId('dialog')).toBeVisible(); await page.getByTestId('book').click(); await expect(page.getByTestId('name')).toHaveAttribute('aria-invalid', 'true'); }
  },
  svelte: {
    entry: 'src/main.js', deps: [], dev: ['svelte', 'vite', '@sveltejs/vite-plugin-svelte'],
    act: async (page) => { await page.getByTestId('menu-btn').click(); await expect(page.getByTestId('menu')).toHaveAttribute('data-up', /box/); await page.getByTestId('filter').fill('error'); await expect(page.getByTestId('grid').locator('article')).toHaveCount(1); }
  }
};

for (const [name, app] of Object.entries(VITE_APPS)) {
  test(`Vite + ${name}: npm install, one marked block, config kept, build, review link, clean removal`, async ({ page, baseURL }) => {
    const dir = fresh(name);
    cpSync(join(ROOT, 'examples', name), dir, { recursive: true, filter: (s) => !s.includes(`${sep}dist`) });
    cpSync(join(ROOT, 'examples/assets'), join(WORK, 'assets'), { recursive: true });
    const pins = (list) => Object.fromEntries(list.map((p) => [p, version(p)]));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `${name}-prototype`, private: true, type: 'module', scripts: { dev: 'vite', build: 'vite build' }, dependencies: pins(app.deps), devDependencies: pins(app.dev) }, null, 2) + '\n');
    npmInstall(dir);
    const config = read(join(dir, 'public/unpolish.config.json'));

    let r = run(dir, ['remove', '--json']);
    expect(r.code).toBe(0);
    const entry = read(join(dir, app.entry));
    expect(entry).not.toContain('unpolish');
    const pristine = snapshot(dir);

    // Dry run: registry install pinned to this exact version; nothing touched.
    r = run(dir, ['init', '--dry-run', '--json']);
    expect(r.code).toBe(0);
    expect(r.report.commands).toEqual([`npm install --save-exact ${PKG.name}@${PKG.version}`]);
    expect(snapshot(dir)).toEqual(pristine);

    if (name === 'react') {
      // The documented pre-release route: npx <tarball URL> init, which installs that same tarball.
      const out = sh(dir, 'npx', ['--yes', `${baseURL}/unpolish/${PKG.name}-${PKG.version}.tgz`, 'init', '--json'], { npm_config_cache: fresh('npx-cache') });
      r = { code: 0, report: JSON.parse(out) };
    } else {
      r = run(dir, ['init', '--from', TGZ, '--json']);
    }
    expect(r.code, JSON.stringify(r.report)).toBe(0);
    expect(r.report.status).toBe('installed');
    const pkg = json(join(dir, 'package.json'));
    expect(pkg.dependencies.unpolish).toMatch(/unpolish-\d+\.\d+\.\d+\.tgz$/);
    expect(json(join(dir, 'node_modules/unpolish/package.json')).version).toBe(PKG.version);
    expect(existsSync(join(dir, 'pnpm-lock.yaml')) || existsSync(join(dir, 'yarn.lock'))).toBe(false);
    const src = read(join(dir, app.entry));
    expect(src.split(START)).toHaveLength(2);
    expect(src.endsWith(entry)).toBe(true);
    expect(read(join(dir, 'public/unpolish.config.json'))).toBe(config);

    const installed = snapshot(dir);
    r = run(dir, ['init', '--from', TGZ, '--json']);
    expect(r.report.status).toBe('already-installed');
    expect(snapshot(dir)).toEqual(installed);

    sh(dir, 'npx', ['vite', 'build', '--logLevel', 'warn']);
    expect(existsSync(join(dir, 'dist/unpolish.config.json'))).toBe(true);
    await checkInBrowser(page, served(dir) + 'dist/', app.act);

    r = run(dir, ['remove', '--json']);
    expect(r.code, r.out).toBe(0);
    expect(read(join(dir, app.entry))).toBe(entry);
    expect(json(join(dir, 'package.json')).dependencies?.unpolish).toBeUndefined();
    expect(existsSync(join(dir, 'node_modules/unpolish'))).toBe(false);
    expect(read(join(dir, 'public/unpolish.config.json'))).toBe(config);
  });
}

/* ---------- Next.js App Router ---------- */

test('Next.js App Router with basePath: client component after hydration, build, start, removal', async ({ page }) => {
  test.skip(!!process.env.UNPOLISH_SKIP_NEXT, 'UNPOLISH_SKIP_NEXT is set');
  const dir = fresh('next');
  cpSync(join(ROOT, 'tests/fixtures/next-app'), dir, { recursive: true });
  npmInstall(dir);
  const layout = read(join(dir, 'app/layout.jsx'));
  const pristine = snapshot(dir);

  let r = run(dir, ['init', '--dry-run', '--json']);
  expect(r.code).toBe(0);
  expect(snapshot(dir)).toEqual(pristine);
  const comp = r.report.changes.find((c) => c.path === 'app/unpolish-client.jsx');
  expect(comp.preview).toContain("init({ configUrl: '/atlas/unpolish.config.json' })");

  r = run(dir, ['init', '--from', TGZ, '--json']);
  expect(r.code, r.out).toBe(0);
  const wired = read(join(dir, 'app/layout.jsx'));
  expect(wired).toContain("import Unpolish from './unpolish-client';");
  expect(wired).toContain('<body>\n        <Unpolish />\n        {children}');
  expect(json(join(dir, 'public/unpolish.config.json')).defaultTheme).toBe('original');
  const installed = snapshot(dir);
  expect(run(dir, ['init', '--from', TGZ, '--json']).report.status).toBe('already-installed');
  expect(snapshot(dir)).toEqual(installed);

  sh(dir, 'npx', ['next', 'build'], { NEXT_TELEMETRY_DISABLED: '1' });
  const port = 4190 + test.info().workerIndex;
  const log = [];
  const server = spawn('npx', ['next', 'start', '-p', String(port)], { cwd: dir, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, detached: true });
  server.stdout.on('data', (d) => log.push(String(d)));
  server.stderr.on('data', (d) => log.push(String(d)));
  try {
    const url = `http://localhost:${port}/atlas`;
    await expect.poll(async () => { try { return (await fetch(url)).status; } catch { return 0; } }, { timeout: 60_000, message: () => log.join('') }).toBe(200);
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
    page.on('pageerror', (e) => problems.push(e.message));
    await checkInBrowser(page, url, async (page) => {
      await page.getByTestId('count').click();
      await expect(page.getByTestId('count')).toHaveText('Clicked 1');
    });
    expect(problems.filter((t) => /hydrat|Unpolish/i.test(t))).toEqual([]);
  } finally {
    try { process.kill(-server.pid); } catch { /* already gone */ }
  }

  r = run(dir, ['remove', '--json']);
  expect(r.code, r.out).toBe(0);
  expect(read(join(dir, 'app/layout.jsx'))).toBe(layout);
  expect(existsSync(join(dir, 'app/unpolish-client.jsx'))).toBe(false);
  expect(json(join(dir, 'package.json')).dependencies.unpolish).toBeUndefined();
  expect(existsSync(join(dir, 'public/unpolish.config.json'))).toBe(true);
});

/* ---------- package managers ---------- */

function viteVanilla(name, extra = {}) {
  const dir = fresh(name);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, private: true, type: 'module', ...extra }, null, 2) + '\n');
  writeFileSync(join(dir, 'vite.config.js'), "export default { base: './' };\n");
  writeFileSync(join(dir, 'index.html'), '<!doctype html>\n<html>\n<head>\n  <title>x</title>\n</head>\n<body>\n  <script type="module" src="/src/main.js"></script>\n</body>\n</html>\n');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/main.js'), "document.body.append('hello');\n");
  return dir;
}

for (const [pm, lock, cmd] of [['pnpm', 'pnpm-lock.yaml', 'pnpm add --save-exact'], ['yarn', 'yarn.lock', 'yarn add --exact'], ['bun', 'bun.lock', 'bun add --exact']]) {
  test(`${pm} project: installs with ${pm} and keeps its lockfile`, () => {
    const dir = viteVanilla(`pm-${pm}`);
    sh(dir, pm, ['install']);
    if (!existsSync(join(dir, lock))) writeFileSync(join(dir, lock), '');
    let r = run(dir, ['init', '--dry-run', '--json']);
    expect(r.report.detected.packageManager).toBe(`${pm} (${lock})`);
    expect(r.report.commands[0]).toBe(`${cmd} ${PKG.name}@${PKG.version}`);
    r = run(dir, ['init', '--from', TGZ, '--json']);
    expect(r.code, r.out + r.err).toBe(0);
    expect(json(join(dir, 'package.json')).dependencies.unpolish).toBeTruthy();
    expect(read(join(dir, lock))).toContain('unpolish');
    expect(existsSync(join(dir, 'package-lock.json'))).toBe(false);
    r = run(dir, ['remove', '--json']);
    expect(r.code).toBe(0);
    expect(json(join(dir, 'package.json')).dependencies?.unpolish).toBeUndefined();
  });
}

test('missing package manager: fails before changing anything', () => {
  const dir = viteVanilla('pm-missing', { packageManager: 'pnpm@10.0.0' });
  const bin = fresh('only-node-bin');
  symlinkSync(process.execPath, join(bin, 'node'));
  const before = snapshot(dir);
  const r = run(dir, ['init', '--from', TGZ, '--json'], { PATH: bin });
  expect(r.code).toBe(1);
  expect(r.report.status).toBe('failed');
  expect(r.report.errors[0]).toMatch(/uses pnpm .*`pnpm` isn't available/);
  expect(snapshot(dir)).toEqual(before);
});

/* ---------- layouts it should not guess about ---------- */

test('monorepo roots, unknown layouts and unsupported frameworks get a plan, not edits', () => {
  const mono = fresh('monorepo');
  writeFileSync(join(mono, 'package.json'), JSON.stringify({ name: 'mono', private: true, workspaces: ['apps/*'] }));
  mkdirSync(join(mono, 'apps/web/src'), { recursive: true });
  writeFileSync(join(mono, 'apps/web/package.json'), JSON.stringify({ name: 'web', devDependencies: { vite: '7.0.0' } }));
  writeFileSync(join(mono, 'apps/web/index.html'), '<script type="module" src="/src/main.ts"></script>');
  writeFileSync(join(mono, 'apps/web/src/main.ts'), 'export {};\n');
  let before = snapshot(mono);
  let r = run(mono, ['init', '--json']);
  expect(r.code).toBe(2);
  expect(r.report.status).toBe('manual');
  expect(r.report.manual[0]).toContain('apps/web');
  expect(snapshot(mono)).toEqual(before);
  r = run(mono, ['init', '--dry-run', '--json', '--cwd', 'apps/web']);
  expect(r.code).toBe(0);
  expect(r.report.detected.app).toBe('Vite + vanilla (src/main.ts)');

  const unknown = fresh('unknown');
  writeFileSync(join(unknown, 'README.md'), '# notes\n');
  r = run(unknown, ['init', '--json']);
  expect(r.code).toBe(2);
  expect(snapshot(unknown)).toEqual({ 'README.md': expect.any(String) });

  const kit = fresh('sveltekit');
  writeFileSync(join(kit, 'package.json'), JSON.stringify({ name: 'kit', devDependencies: { '@sveltejs/kit': '2.0.0', vite: '7.0.0' } }));
  before = snapshot(kit);
  r = run(kit, ['init', '--json']);
  expect(r.code).toBe(2);
  expect(r.report.manual.join('\n')).toContain('src/hooks.client.js');
  expect(snapshot(kit)).toEqual(before);

  const pages = fresh('next-pages');
  writeFileSync(join(pages, 'package.json'), JSON.stringify({ name: 'p', dependencies: { next: '15.0.0' } }));
  mkdirSync(join(pages, 'pages'));
  writeFileSync(join(pages, 'pages/_app.jsx'), 'export default function App({ Component, pageProps }) { return <Component {...pageProps} />; }\n');
  r = run(pages, ['init', '--json']);
  expect(r.code).toBe(2);
  expect(r.report.manual.join('\n')).toContain("'use client'");

  expect(run(unknown, ['frobnicate']).code).toBe(64);
  expect(run(unknown, ['init', '--scope', 'staging']).code).toBe(64);
});

test('existing hand-made installs are left alone; scopes guard the init call', () => {
  const tagged = viteVanilla('existing-tag');
  const html = read(join(tagged, 'index.html')).replace('</head>', '  <script src="/unpolish/unpolish.js" defer></script>\n</head>');
  writeFileSync(join(tagged, 'index.html'), html);
  let before = snapshot(tagged);
  let r = run(tagged, ['init', '--json']);
  expect(r.code).toBe(0);
  expect(r.report.status).toBe('already-installed');
  expect(snapshot(tagged)).toEqual(before);

  const imported = viteVanilla('existing-import');
  writeFileSync(join(imported, 'src/main.js'), "import { init } from 'unpolish';\ninit();\n");
  before = snapshot(imported);
  r = run(imported, ['init', '--json']);
  expect(r.report.status).toBe('already-installed');
  expect(snapshot(imported)).toEqual(before);

  const scoped = viteVanilla('scoped');
  r = run(scoped, ['init', '--dry-run', '--json', '--scope', 'dev']);
  expect(r.report.changes.find((c) => c.path === 'src/main.js').preview).toContain('if (import.meta.env.DEV) initUnpolish(');
  r = run(scoped, ['init', '--dry-run', '--json', '--scope', 'env:VITE_UNPOLISH']);
  expect(r.report.changes.find((c) => c.path === 'src/main.js').preview).toContain("if (import.meta.env.VITE_UNPOLISH === 'true') initUnpolish(");
  expect(r.report.scope).toContain('VITE_UNPOLISH');
  r = run(scoped, ['init', '--dry-run', '--json']);
  expect(r.report.scope).toMatch(/^All environments/);
});
