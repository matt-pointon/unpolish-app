// Prepares the release artifacts locally. Publishes and deploys nothing.
//
//   npm run release
//   node scripts/release.mjs --print [--config path]
//
// Distribution settings live in release.config.json (the only place to change them):
//   "published": false   the package is not on npm; installs use the packed tarball
//   "published": true    after `npm publish`; visible command is `npx <name>@latest`
//                        and the copied prompt pins `npx <name>@<version>`
//   "siteUrl": null      production website not known yet; package homepage is the GitHub README
//   "siteUrl": "https://….vercel.app"   production URL; homepage, bundle and docs URLs derive from it
//   "distUrl": null      unpublished tarball is served next to the website (unpolish/ on the same origin)
//   "distUrl": "https://…/unpolish/"   a public HTTPS folder holding the tarball and self-host files
//
// 1. Builds packages/unpolish (dist/).
// 2. Copies the self-host files into unpolish/ and releases/<version>/.
// 3. Packs the npm tarball to unpolish/<name>-<version>.tgz.
// 4. Writes site/release.js — every command, download link and the agent prompt is derived from it.
import { readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync, renameSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildRelease, loadReleaseSettings, packageMetadata, renderReleaseJs } from './release-config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function parseArgs(argv) {
  const opts = { print: false, config: join(root, 'release.config.json') };
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    if (a === '--print') opts.print = true;
    else if (a === '--config' || a.startsWith('--config=')) {
      opts.config = a.includes('=') ? a.slice(a.indexOf('=') + 1) : rest.shift();
    } else {
      throw new Error(`unknown option: ${a}`);
    }
  }
  return opts;
}

function readPkg() {
  return JSON.parse(readFileSync(join(root, 'packages', 'unpolish', 'package.json'), 'utf8'));
}

export function releaseFromConfig(configPath = join(root, 'release.config.json'), pkg = readPkg()) {
  const settings = loadReleaseSettings(JSON.parse(readFileSync(configPath, 'utf8')));
  return { pkg, settings, release: buildRelease(pkg, settings) };
}

function applyPackageMetadata(pkgDir, pkg, release) {
  const meta = packageMetadata(release);
  let changed = false;
  const next = { ...pkg };
  if (JSON.stringify(next.repository) !== JSON.stringify(meta.repository)) { next.repository = meta.repository; changed = true; }
  if (next.homepage !== meta.homepage) { next.homepage = meta.homepage; changed = true; }
  if (JSON.stringify(next.bugs) !== JSON.stringify(meta.bugs)) { next.bugs = meta.bugs; changed = true; }
  if (changed) writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(next, null, 2) + '\n');
  return next;
}

function copySelfHost(pkgDir, pkg, out) {
  mkdirSync(out, { recursive: true });
  copyFileSync(join(pkgDir, 'dist', 'unpolish.js'), join(out, 'unpolish.js'));
  copyFileSync(join(pkgDir, 'schema', 'unpolish.config.schema.json'), join(out, 'unpolish.config.schema.json'));
  copyFileSync(join(pkgDir, 'README.md'), join(out, 'README.md'));
  const starter = JSON.parse(readFileSync(join(pkgDir, 'templates', 'unpolish.config.json'), 'utf8'));
  writeFileSync(join(out, 'unpolish.config.json'), JSON.stringify({ $schema: './unpolish/unpolish.config.schema.json', ...starter }, null, 2) + '\n');
}

function snapshotVersion(out, version) {
  const snap = join(root, 'releases', version);
  mkdirSync(snap, { recursive: true });
  for (const f of ['unpolish.js', 'unpolish.config.json', 'unpolish.config.schema.json', 'README.md']) {
    copyFileSync(join(out, f), join(snap, f));
  }
  return snap;
}

export function applyRelease({ print = false, config = join(root, 'release.config.json') } = {}) {
  const pkgDir = join(root, 'packages', 'unpolish');
  const out = join(root, 'unpolish');
  let { pkg, settings, release } = releaseFromConfig(config);

  if (print) {
    process.stdout.write(JSON.stringify(release, null, 2) + '\n');
    return release;
  }

  pkg = applyPackageMetadata(pkgDir, pkg, release);
  release = buildRelease(pkg, settings);

  execFileSync('node', ['scripts/build.mjs'], { cwd: pkgDir, stdio: 'inherit' });
  copySelfHost(pkgDir, pkg, out);
  snapshotVersion(out, pkg.version);

  for (const f of readdirSync(out)) if (/^unpolish-.*\.tgz$/.test(f)) rmSync(join(out, f));
  const tgz = execFileSync('npm', ['pack', '--silent', '--pack-destination', out], { cwd: pkgDir, encoding: 'utf8' }).trim().split('\n').pop();
  if (tgz !== release.tarball) renameSync(join(out, tgz), join(out, release.tarball));

  writeFileSync(join(root, 'site', 'release.js'), renderReleaseJs(release));
  const where = release.published
    ? 'installs from npm'
    : `installs from ${release.distUrl ? release.distUrl + release.tarball : `unpolish/${release.tarball} on the site's origin`}`;
  console.log(`\n${pkg.name} ${pkg.version} — ${where}\n  unpolish/unpolish.js\n  unpolish/${release.tarball}\n  releases/${pkg.version}/\n  site/release.js${release.distUrl && !release.published ? `\nUpload the contents of unpolish/ to ${release.distUrl}, then run: npm run check:dist` : ''}`);
  return release;
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return import.meta.url === pathToFileURL(resolve(process.argv[1])).href; } catch { return false; }
}
if (invokedDirectly()) {
  try {
    applyRelease(parseArgs(process.argv.slice(2)));
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}
