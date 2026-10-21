// Assembles the public static site into ./public (gitignored).
//
//   npm run build:site
//
// Output is only files the website links to: marketing pages, demo, examples,
// downloads, versioned bundles, and the validation notes. Repo source, tests,
// scripts, fixtures and node_modules stay out.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyRelease } from './release.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'public');

const FORBIDDEN_TOP = new Set([
  '.git', '.github', '.cursor', 'node_modules', 'packages', 'scripts', 'tests',
  'playwright.config.js', 'package.json', 'package-lock.json', 'vercel.json',
  'release.config.json', '.gitignore', '.npmrc',
]);
const FORBIDDEN_SEGMENTS = new Set(['node_modules', '.git', 'src', 'fixtures']);

function listFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

function copyFile(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

function copyDir(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

applyRelease();

copyFile(join(root, 'index.html'), join(out, 'index.html'));
copyDir(join(root, 'site'), join(out, 'site'));
copyDir(join(root, 'examples', 'plain-html'), join(out, 'examples', 'plain-html'));
copyDir(join(root, 'examples', 'assets'), join(out, 'examples', 'assets'));
copyDir(join(root, 'unpolish'), join(out, 'unpolish'));
copyFile(join(root, 'docs', 'VALIDATION.md'), join(out, 'docs', 'VALIDATION.md'));

const releases = join(root, 'releases');
if (existsSync(releases)) {
  for (const ver of readdirSync(releases)) {
    const src = join(releases, ver);
    if (!statSync(src).isDirectory()) continue;
    copyDir(src, join(out, 'unpolish', ver));
  }
}

const pkg = JSON.parse(readFileSync(join(root, 'packages', 'unpolish', 'package.json'), 'utf8'));
execFileSync('node', ['scripts/build.mjs'], { cwd: join(root, 'packages', 'unpolish'), stdio: 'inherit' });

for (const name of ['react', 'vue', 'svelte']) {
  const dest = join(out, 'examples', name);
  console.log(`\n▸ building examples/${name} → public/examples/${name}/`);
  execFileSync('npx', [
    'vite', 'build', '--logLevel', 'warn',
    '--base', `/examples/${name}/`,
    '--outDir', dest,
  ], { cwd: join(root, 'examples', name), stdio: 'inherit' });
}

const files = listFiles(out).map((f) => relative(out, f).split(sep).join('/'));
for (const rel of files) {
  const top = rel.split('/')[0];
  if (FORBIDDEN_TOP.has(top)) throw new Error(`public/ must not contain ${top} (${rel})`);
  for (const seg of rel.split('/')) {
    if (FORBIDDEN_SEGMENTS.has(seg)) throw new Error(`public/ must not contain ${seg} (${rel})`);
  }
}

const required = [
  'index.html',
  'site/site.js',
  'site/release.js',
  'site/demo/index.html',
  'examples/plain-html/index.html',
  'examples/assets/lake.svg',
  'examples/react/index.html',
  'examples/vue/index.html',
  'examples/svelte/index.html',
  'unpolish/unpolish.js',
  `unpolish/${pkg.name}-${pkg.version}.tgz`,
  `unpolish/${pkg.version}/unpolish.js`,
  'docs/VALIDATION.md',
];
for (const f of required) {
  if (!existsSync(join(out, f))) throw new Error(`public/ is missing ${f}`);
}

console.log(`\nSite built → public/ (${files.length} files)`);
