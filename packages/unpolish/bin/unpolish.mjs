#!/usr/bin/env node
// Unpolish installer. Adds Unpolish to an existing prototype using the
// project's own conventions, and removes exactly what it added.
//
//   npx unpolish init [--dry-run] [--json] [--scope all|dev|env:NAME] [--mode auto|package|script]
//   npx unpolish remove [--dry-run] [--json] [--purge]
//
// Never prompts. Exit codes: 0 done (or nothing to do), 1 failed before changing
// anything, 2 needs a manual step (plan printed, nothing changed), 3 partial
// failure (some changes applied; listed), 64 bad usage.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
const NAME = PKG.name;
const VERSION = PKG.version;
const EXIT = { OK: 0, FAILED: 1, MANUAL: 2, PARTIAL: 3, USAGE: 64 };

const START = '// unpolish:start';
const END = '// unpolish:end';
const FILE_MARK = '// unpolish:file';
const NEXT_COMPONENT = 'unpolish-client';
const SCRIPT_TAG_RE = /^\s*<script\b[^>]*\bsrc=["'][^"']*unpolish(?:\.min)?\.js["'][^>]*>\s*<\/script>\s*$/i;
const BUNDLE_HEADER = '/*! Unpolish v';

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = { command: null, dryRun: false, json: false, scope: 'all', mode: 'auto', from: null, upgrade: false, purge: false, cwd: process.cwd() };
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    const val = () => {
      if (a.includes('=')) return a.slice(a.indexOf('=') + 1);
      if (!rest.length) usage(`${a} needs a value`);
      return rest.shift();
    };
    if (a === '--dry-run' || a === '-n') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--yes' || a === '-y') { /* always non-interactive */ }
    else if (a === '--upgrade') opts.upgrade = true;
    else if (a === '--purge') opts.purge = true;
    else if (a.startsWith('--scope')) opts.scope = val();
    else if (a.startsWith('--mode')) opts.mode = val();
    else if (a.startsWith('--from')) opts.from = val();
    else if (a.startsWith('--cwd')) opts.cwd = path.resolve(val());
    else if (a === '--help' || a === '-h') opts.command = 'help';
    else if (a === '--version' || a === '-v') opts.command = 'version';
    else if (!a.startsWith('-') && !opts.command) opts.command = a;
    else usage(`unknown option: ${a}`);
  }
  if (!opts.command) opts.command = 'help';
  if (!['all', 'dev'].includes(opts.scope) && !/^env:[A-Z0-9_]+$/.test(opts.scope)) usage(`--scope must be all, dev or env:NAME (got ${opts.scope})`);
  if (!['auto', 'package', 'script'].includes(opts.mode)) usage(`--mode must be auto, package or script (got ${opts.mode})`);
  return opts;
}

function usage(msg) {
  if (msg) process.stderr.write(`unpolish: ${msg}\n\n`);
  process.stderr.write(HELP);
  process.exit(EXIT.USAGE);
}

const HELP = `Unpolish ${VERSION} — reversible lo-fi themes for working web prototypes.

Usage
  npx ${NAME} init      Add Unpolish to the app in this folder
  npx ${NAME} remove    Remove what init added (keeps unpolish.config.json)

Options
  --dry-run          Show the plan; change nothing
  --json             Machine-readable report on stdout
  --scope <s>        all (default): every build, incl. deployed previews
                     dev: local development only
                     env:NAME: only when the env var NAME is "true"
  --mode <m>         auto (default) | package (npm import) | script (script tag + vendored file)
  --from <spec>      Install the runtime from this package spec (tarball URL or path)
  --upgrade          Re-pin to this version if an older one is installed
  --purge            remove: also delete unpolish.config.json
  --cwd <dir>        Run as if from <dir>

Exit codes: 0 done · 1 failed, nothing changed · 2 manual step needed (plan printed)
            3 partially applied (see report) · 64 bad usage
`;

/* ------------------------------------------------------------------ *
 * Small fs helpers
 * ------------------------------------------------------------------ */

const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8');
const readJSON = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const rel = (root, p) => path.relative(root, p).split(path.sep).join('/') || '.';
const firstExisting = (root, names) => names.map((n) => path.join(root, n)).find(exists) || null;

/* ------------------------------------------------------------------ *
 * Inspect the project
 * ------------------------------------------------------------------ */

const UNSUPPORTED = {
  '@sveltejs/kit': 'SvelteKit', nuxt: 'Nuxt', astro: 'Astro', '@remix-run/react': 'Remix', '@remix-run/dev': 'Remix',
  '@angular/core': 'Angular', 'react-scripts': 'Create React App', gatsby: 'Gatsby', '@11ty/eleventy': 'Eleventy',
  'parcel': 'Parcel', webpack: 'webpack', '@docusaurus/core': 'Docusaurus', '@solidjs/start': 'SolidStart', 'expo': 'Expo'
};

function detectPackageManager(start, pkg) {
  let dir = start;
  for (;;) {
    for (const [file, name] of [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['bun.lock', 'bun'], ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm']]) {
      if (exists(path.join(dir, file))) return { name, source: rel(start, path.join(dir, file)) };
    }
    const p = readJSON(path.join(dir, 'package.json'));
    if (p && typeof p.packageManager === 'string') return { name: p.packageManager.split('@')[0], source: `packageManager in ${rel(start, path.join(dir, 'package.json'))}` };
    if (exists(path.join(dir, '.git'))) break;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return { name: 'npm', source: pkg ? 'default (no lockfile)' : 'n/a' };
}

function viteEntry(root) {
  const html = path.join(root, 'index.html');
  if (!exists(html)) return null;
  const m = read(html).match(/<script\b[^>]*type=["']module["'][^>]*\bsrc=["']([^"']+)["']/i) || read(html).match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*type=["']module["']/i);
  if (!m || /^https?:/.test(m[1])) return null;
  const file = m[1].startsWith('/') ? path.join(root, m[1]) : path.resolve(root, m[1]);
  return exists(file) && /\.(m?[jt]sx?)$/.test(file) ? file : null;
}

function viteConfig(root) {
  const f = firstExisting(root, ['vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'vite.config.mts', 'vite.config.cjs']);
  const src = f ? read(f) : '';
  const pub = src.match(/publicDir\s*:\s*['"]([^'"]+)['"]/);
  return {
    file: f,
    publicDir: /publicDir\s*:\s*false/.test(src) ? null : path.join(root, pub ? pub[1] : 'public'),
    customRoot: /\broot\s*:/.test(src)
  };
}

function nextInfo(root) {
  const appLayout = firstExisting(root, ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js', 'src/app/layout.tsx', 'src/app/layout.jsx', 'src/app/layout.js']);
  const pagesApp = firstExisting(root, ['pages/_app.tsx', 'pages/_app.jsx', 'pages/_app.js', 'src/pages/_app.tsx', 'src/pages/_app.jsx', 'src/pages/_app.js']);
  const cfgFile = firstExisting(root, ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.cjs']);
  const cfg = cfgFile ? read(cfgFile) : '';
  const literal = cfg.match(/basePath\s*:\s*['"]([^'"]*)['"]/);
  return {
    layout: appLayout, pagesApp, config: cfgFile,
    basePath: literal ? literal[1] : '',
    dynamicBasePath: !literal && /basePath\s*:/.test(cfg),
    ts: exists(path.join(root, 'tsconfig.json'))
  };
}

function htmlPages(root) {
  return fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort().map((f) => path.join(root, f));
}

function nestedHtmlCount(root) {
  let n = 0;
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || ['node_modules', 'unpolish', 'dist', 'build'].includes(d.name)) continue;
    try { n += fs.readdirSync(path.join(root, d.name)).filter((f) => f.endsWith('.html')).length; } catch { /* ignore */ }
  }
  return n;
}

function findApps(root) {
  const out = [];
  for (const base of ['apps', 'packages', 'sites', 'examples']) {
    const dir = path.join(root, base);
    if (!exists(dir)) continue;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = readJSON(path.join(dir, d.name, 'package.json'));
      const deps = p ? { ...p.dependencies, ...p.devDependencies } : {};
      if (deps.next || deps.vite) out.push(`${base}/${d.name}`);
    }
  }
  return out;
}

function inspect(root) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = exists(pkgPath) ? readJSON(pkgPath) : null;
  if (exists(pkgPath) && !pkg) return { root, error: 'package.json is not valid JSON' };
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const info = { root, pkg, pkgPath: pkg ? pkgPath : null, deps, pm: detectPackageManager(root, pkg) };
  info.installed = deps[NAME] || null;

  if (deps.next) {
    info.framework = { id: 'next', label: 'Next.js', ...nextInfo(root) };
    info.staticDir = path.join(root, 'public');
  } else if (Object.keys(UNSUPPORTED).some((d) => deps[d])) {
    const d = Object.keys(UNSUPPORTED).find((k) => deps[k]);
    info.framework = { id: 'unsupported', label: UNSUPPORTED[d] };
  } else if (deps.vite || firstExisting(root, ['vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'vite.config.mts'])) {
    const flavor = deps.react ? 'React' : deps.vue ? 'Vue' : deps.svelte ? 'Svelte' : deps.preact ? 'Preact' : deps['solid-js'] ? 'Solid' : 'vanilla';
    const vc = viteConfig(root);
    info.framework = { id: 'vite', label: `Vite + ${flavor}`, entry: viteEntry(root), ...vc };
    info.staticDir = vc.publicDir;
  } else if (pkg && (pkg.workspaces || exists(path.join(root, 'pnpm-workspace.yaml')) || exists(path.join(root, 'lerna.json')))) {
    info.framework = { id: 'monorepo', label: 'Monorepo root', apps: findApps(root) };
  } else if (htmlPages(root).length) {
    info.framework = { id: 'plain', label: pkg ? 'Static HTML site (package.json without a bundler)' : 'Static HTML site' };
    info.staticDir = root;
  } else {
    info.framework = { id: 'unknown', label: 'Unrecognised layout' };
  }
  info.existing = existingIntegration(info);
  return info;
}

function existingIntegration(info) {
  const { root, framework } = info;
  const found = { scriptTags: [], vendored: [], configs: [], module: null, next: null };
  const pages = new Set([...htmlPages(root), ...['public/index.html', 'src/index.html', 'src/app.html'].map((p) => path.join(root, p)).filter(exists)]);
  for (const f of pages) {
    if (read(f).split('\n').some((l) => SCRIPT_TAG_RE.test(l))) found.scriptTags.push(f);
  }
  for (const dir of [root, path.join(root, 'public'), path.join(root, 'static')]) {
    const v = path.join(dir, 'unpolish', 'unpolish.js');
    if (exists(v) && read(v).startsWith(BUNDLE_HEADER)) found.vendored.push({ file: v, version: (read(v).match(/^\/\*! Unpolish v([\w.\-+]+)/) || [])[1] });
    for (const c of [path.join(dir, 'unpolish.config.json'), path.join(dir, 'unpolish', 'unpolish.config.json')]) if (exists(c)) found.configs.push(c);
  }
  if (framework.id === 'vite' && framework.entry) {
    const src = read(framework.entry);
    if (src.includes(START)) found.module = { file: framework.entry, marked: true };
    else if (new RegExp(`from\\s+['"]${NAME}['"]`).test(src)) found.module = { file: framework.entry, marked: false };
  }
  if (framework.id === 'next' && framework.layout) {
    const comp = componentPath(framework);
    const layout = read(framework.layout);
    found.next = { component: exists(comp) && read(comp).includes(FILE_MARK) ? comp : null, layoutWired: layout.includes(`./${NEXT_COMPONENT}`) && layout.includes('<Unpolish />') };
  }
  return found;
}

function componentPath(fw) {
  return path.join(path.dirname(fw.layout), `${NEXT_COMPONENT}.${fw.ts ? 'tsx' : 'jsx'}`);
}

/* ------------------------------------------------------------------ *
 * Where the runtime comes from
 * ------------------------------------------------------------------ */

// When run through `npx <tarball-or-url> init`, install that same artifact into
// the project; otherwise pin this exact registry version.
function runtimeSpec(opts) {
  if (opts.from) return /^(https?:|file:|git)/.test(opts.from) ? opts.from : path.resolve(opts.from);
  let dir = PKG_DIR;
  for (let i = 0; i < 6; i++) {
    const parent = path.dirname(dir);
    if (path.basename(parent) === 'node_modules') {
      const host = readJSON(path.join(path.dirname(parent), 'package.json'));
      const spec = host && ((host.dependencies && host.dependencies[NAME]) || (host.devDependencies && host.devDependencies[NAME]));
      if (spec && /^(https?:|file:|\.|\/)|\.tgz$/.test(spec) && path.dirname(parent).includes(`${path.sep}_npx${path.sep}`)) {
        if (/^https?:/.test(spec)) return spec;
        // Local tarball: npm records it relative to the npx cache folder.
        return path.resolve(path.dirname(parent), spec.replace(/^file:/, ''));
      }
      break;
    }
    dir = parent;
  }
  return `${NAME}@${VERSION}`;
}

function invocation(spec) {
  if (spec === `${NAME}@${VERSION}`) return `npx ${NAME}`;
  return /^https?:/.test(spec) ? `npx ${spec}` : `npx file:${spec}`;
}

function addCommand(pm, spec) {
  return {
    npm: ['npm', ['install', '--save-exact', spec]],
    pnpm: ['pnpm', ['add', '--save-exact', spec]],
    yarn: ['yarn', ['add', '--exact', spec]],
    bun: ['bun', ['add', '--exact', spec]]
  }[pm] || ['npm', ['install', '--save-exact', spec]];
}

function removeCommand(pm) {
  return { npm: ['npm', ['uninstall', NAME]], pnpm: ['pnpm', ['remove', NAME]], yarn: ['yarn', ['remove', NAME]], bun: ['bun', ['remove', NAME]] }[pm] || ['npm', ['uninstall', NAME]];
}

function devCommand(info) {
  const scripts = (info.pkg && info.pkg.scripts) || {};
  const run = info.pm.name === 'npm' ? 'npm run' : info.pm.name;
  if (scripts.dev) return `${run} dev`;
  if (scripts.start) return `${run} start`;
  return null;
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

function guard(scope, framework) {
  if (scope === 'all') return null;
  if (scope === 'dev') return framework === 'vite' ? 'import.meta.env.DEV' : "process.env.NODE_ENV === 'development'";
  const name = scope.slice(4);
  return framework === 'vite' ? `import.meta.env.${name} === 'true'` : `process.env.${name} === 'true'`;
}

function viteBlock(configRel, scope) {
  const call = `initUnpolish({ configUrl: \`\${import.meta.env.BASE_URL}${configRel}\` });`;
  const g = guard(scope, 'vite');
  return [
    `${START} — lo-fi review themes. Remove with \`npx ${NAME} remove\` or delete this block.`,
    `import { init as initUnpolish } from '${NAME}';`,
    g ? `if (${g}) ${call}` : call,
    END,
    ''
  ].join('\n');
}

function nextComponent(configUrl, scope) {
  const g = guard(scope, 'next');
  return [
    "'use client';",
    `${FILE_MARK} — added by \`npx ${NAME} init\`. Remove with \`npx ${NAME} remove\`.`,
    "import { useEffect } from 'react';",
    '',
    'export default function Unpolish() {',
    '  useEffect(() => {',
    ...(g ? [`    if (!(${g})) return;`] : []),
    '    // Runs in the browser after hydration, so server rendering is untouched.',
    `    import('${NAME}').then(({ init }) => init({ configUrl: '${configUrl}' }));`,
    '  }, []);',
    '  return null;',
    '}',
    ''
  ].join('\n');
}

function scriptTag(src, config) {
  return `<script src="${src}" data-config="${config}" defer></script>`;
}

function starterConfig(info, schemaRef) {
  const tpl = readJSON(path.join(PKG_DIR, 'templates', 'unpolish.config.json'));
  const id = ((info.pkg && info.pkg.name) || path.basename(info.root)).replace(/^@[^/]+\//, '').replace(/[^\w-]+/g, '-').toLowerCase() || 'my-prototype';
  return JSON.stringify({ $schema: schemaRef, ...tpl, id }, null, 2) + '\n';
}

/* ------------------------------------------------------------------ *
 * Text edits
 * ------------------------------------------------------------------ */

function insertBeforeHead(src, line) {
  const lines = src.split('\n');
  const i = lines.findIndex((l) => /<\/head>/i.test(l));
  if (i < 0) return null;
  const indent = (lines[i].match(/^\s*/) || [''])[0];
  const inline = !/^\s*<\/head>/i.test(lines[i]);
  lines.splice(i, 0, (inline ? indent : indent + '  ') + line);
  return lines.join('\n');
}

function lastImportEnd(lines) {
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) {
      let j = i;
      while (j < lines.length && !/(['"];?\s*$)|(\sfrom\s+['"][^'"]+['"])/.test(lines[j])) j++;
      last = j;
      i = j;
    }
  }
  return last;
}

function wireLayout(src, importPath) {
  const bodies = src.match(/<body\b[^>]*>/g) || [];
  if (bodies.length !== 1) return null;
  const lines = src.split('\n');
  const at = lastImportEnd(lines);
  lines.splice(at + 1, 0, `import Unpolish from '${importPath}';`);
  let out = lines.join('\n');
  const m = out.match(/^([ \t]*).*<body\b[^>]*>/m);
  const indent = (m ? m[1] : '') + '  ';
  out = out.replace(/<body\b[^>]*>/, (tag) => `${tag}\n${indent}<Unpolish />`);
  return out;
}

function unwireLayout(src, importPath) {
  let out = src.replace(`import Unpolish from '${importPath}';\n`, '');
  out = out.replace(/\n[ \t]*<Unpolish \/>/, '');
  return out;
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

class Report {
  constructor(opts) {
    this.opts = opts;
    this.data = { tool: NAME, version: VERSION, command: opts.command, dryRun: opts.dryRun, status: null, detected: {}, changes: [], commands: [], manual: [], verify: [], remove: null, scope: null, notes: [], errors: [] };
  }
  change(type, file, detail, preview) { this.data.changes.push({ type, path: file, detail, preview }); }
  note(t) { this.data.notes.push(t); }
  error(t) { this.data.errors.push(t); }
  print() {
    const d = this.data;
    if (this.opts.json) { process.stdout.write(JSON.stringify(d, null, 2) + '\n'); return; }
    const out = [];
    const title = { installed: 'Installed', 'already-installed': 'Already installed', planned: 'Dry run — nothing was changed', manual: 'Manual step needed — nothing was changed', failed: 'Failed — nothing was changed', partial: 'Partially applied', removed: 'Removed', 'not-installed': 'Nothing to remove' }[d.status] || d.status;
    out.push(`Unpolish ${VERSION} · ${d.command}${d.dryRun ? ' --dry-run' : ''}`, `${title}`, '');
    const det = Object.entries(d.detected).filter(([, v]) => v);
    if (det.length) { out.push('Detected'); for (const [k, v] of det) out.push(`  ${({ packageManager: 'package mgr', scriptTag: 'script tag' }[k] || k).padEnd(14)} ${v}`); out.push(''); }
    if (d.changes.length) {
      out.push(d.dryRun ? 'Would change' : 'Changes');
      for (const c of d.changes) {
        out.push(`  ${({ create: '+ create', edit: '~ edit', delete: '- delete', dependency: '+ dependency', 'remove-dependency': '- dependency', keep: '= keep' })[c.type] || c.type}  ${c.path}${c.detail ? ' — ' + c.detail : ''}`);
        if (c.preview && d.dryRun) out.push(...c.preview.split('\n').filter(Boolean).map((l) => `      ${c.type === 'delete' ? '-' : '+'} ${l}`));
      }
      out.push('');
    }
    if (d.commands.length) { out.push(d.dryRun ? 'Would run' : 'Ran'); for (const c of d.commands) out.push(`  $ ${c}`); out.push(''); }
    if (d.scope) { out.push('Scope', `  ${d.scope}`, ''); }
    if (d.manual.length) { out.push('Do this yourself'); d.manual.forEach((s, i) => out.push(`  ${i + 1}. ${s}`)); out.push(''); }
    if (d.errors.length) { out.push('Problems'); for (const e of d.errors) out.push(`  ! ${e}`); out.push(''); }
    if (d.notes.length) { out.push('Notes'); for (const n of d.notes) out.push(`  · ${n}`); out.push(''); }
    if (d.verify.length) { out.push('Verify'); d.verify.forEach((s, i) => out.push(`  ${i + 1}. ${s}`)); out.push(''); }
    if (d.remove) out.push('Remove', `  ${d.remove}`, '');
    process.stdout.write(out.join('\n'));
  }
}

function scopeText(scope, fw) {
  if (scope === 'all') return 'All environments — local dev, preview deploys and production builds — so review links you send to stakeholders work. Hidden controls are not access control.';
  if (scope === 'dev') return `Local development only (${guard(scope, fw)}). Deployed previews will not include Unpolish.`;
  return `Only when ${scope.slice(4)}="true" at build time (${guard(scope, fw)}). Set it in the environments that should show Unpolish.`;
}

/* ------------------------------------------------------------------ *
 * Running steps
 * ------------------------------------------------------------------ */

function hasBinary(bin) {
  const r = spawnSync(bin, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  return r.status === 0;
}

function runCommand(report, cwd, [bin, args]) {
  const shown = [bin, ...args].join(' ');
  report.data.commands.push(shown);
  if (report.opts.dryRun) return true;
  const r = spawnSync(bin, args, { cwd, stdio: report.opts.json ? ['ignore', 'ignore', 'pipe'] : 'inherit', shell: process.platform === 'win32', encoding: 'utf8' });
  if (r.status !== 0) {
    report.error(`\`${shown}\` failed${r.stderr ? ': ' + r.stderr.trim().split('\n').slice(-3).join(' ') : ''}`);
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * init
 * ------------------------------------------------------------------ */

function manualPlan(report, info, spec, reason) {
  const fw = info.framework;
  const add = addCommand(info.pm.name, spec);
  report.data.status = 'manual';
  report.note(reason);
  const steps = report.data.manual;
  const configStep = 'Create unpolish.config.json where the app serves static files (usually public/ or static/) — copy node_modules/unpolish/templates/unpolish.config.json. Keep "defaultTheme": "original".';
  if (fw.id === 'monorepo') {
    steps.push(`Run this command again inside the app you want to review${fw.apps.length ? ` (found: ${fw.apps.join(', ')})` : ''}, e.g. \`cd ${fw.apps[0] || 'apps/web'} && ${invocation(spec)} init\`.`);
    return;
  }
  if (fw.id === 'next' && !fw.layout) {
    steps.push(`Install the runtime: \`${[add[0], ...add[1]].join(' ')}\``);
    steps.push(configStep.replace('(usually public/ or static/)', '(public/)'));
    steps.push(`Create components/unpolish-client.${fw.ts ? 'tsx' : 'jsx'} with the client component below, and render <Unpolish /> once in pages/_app (next to <Component {...pageProps} />):\n${nextComponent(`${fw.basePath}/unpolish.config.json`, report.opts.scope)}`);
    return;
  }
  steps.push(`Install the runtime with the project's package manager: \`${[add[0], ...add[1]].join(' ')}\` (or vendor node_modules/unpolish/dist/unpolish.js as a static file).`);
  steps.push(configStep);
  const hints = {
    SvelteKit: "Initialise once in the browser: in src/hooks.client.js add `import { init } from 'unpolish'; import { base } from '$app/paths'; init({ configUrl: `${base}/unpolish.config.json` });`",
    Nuxt: "Create plugins/unpolish.client.ts: `import { init } from 'unpolish'; export default defineNuxtPlugin(() => { init({ configUrl: useRuntimeConfig().app.baseURL + 'unpolish.config.json' }); });`",
    Astro: "In the shared layout add `<script>import { init } from 'unpolish'; init({ configUrl: import.meta.env.BASE_URL + 'unpolish.config.json' });</script>` (Astro bundles it for the browser).",
    Remix: 'Call init from a useEffect in app/root.tsx (client only), with configUrl pointing at /unpolish.config.json.',
    Angular: "Call init({ configUrl: 'unpolish.config.json' }) once in main.ts after bootstrapApplication(), and add the config to the assets in angular.json.",
    'Create React App': "At the top of src/index.js add `import { init } from 'unpolish'; init({ configUrl: process.env.PUBLIC_URL + '/unpolish.config.json' });`"
  };
  steps.push(hints[fw.label] || "Call `init({ configUrl: '<base path>/unpolish.config.json' })` from 'unpolish' once, in browser-only code that runs on every page (the client entry or root layout). Or add `<script src=\".../unpolish.js\" data-config=\".../unpolish.config.json\" defer></script>` to the shared HTML head.");
  steps.push('Verify: start the app, press \\, switch themes, then pick Original.');
}

function init(opts, report) {
  const info = inspect(opts.cwd);
  if (info.error) { report.data.status = 'failed'; report.error(info.error); return EXIT.FAILED; }
  const fw = info.framework;
  const spec = runtimeSpec(opts);
  let mode = opts.mode;
  if (mode === 'auto') mode = fw.id === 'plain' ? 'script' : 'package';
  // With the dependency installed, its own bin handles removal.
  report.data.remove = `${mode === 'script' ? invocation(spec) : `npx ${NAME}`} remove   (keeps unpolish.config.json; add --purge to delete it)`;
  const d = report.data.detected;
  d.app = fw.label + (fw.entry ? ` (${rel(info.root, fw.entry)})` : fw.layout ? ` (${rel(info.root, fw.layout)})` : '');
  d.packageManager = info.pkg ? `${info.pm.name} (${info.pm.source})` : 'none — no package.json, nothing will be added';
  d.runtime = mode === 'script' ? `browser bundle v${VERSION}, copied from this installer` : spec;
  if (info.installed) d.existing = `${NAME} ${info.installed} in package.json`;
  if (info.existing.scriptTags.length) d.scriptTag = info.existing.scriptTags.map((f) => rel(info.root, f)).join(', ');


  // Already wired up in a way we didn't add: don't stack a second integration.
  const scriptElsewhere = info.existing.scriptTags.length && mode === 'package';
  const customImport = info.existing.module && !info.existing.module.marked;
  if (scriptElsewhere || customImport) {
    report.data.status = 'already-installed';
    report.note(scriptElsewhere
      ? `Unpolish is already loaded by a script tag in ${info.existing.scriptTags.map((f) => rel(info.root, f)).join(', ')}. Leaving it as is (adding a module import would load it twice). Run \`${invocation(spec)} remove\` first to switch.`
      : `${rel(info.root, info.existing.module.file)} already imports ${NAME} without installer markers. Leaving it as is.`);
    return EXIT.OK;
  }

  if (mode === 'script') return initScript(opts, report, info, spec);
  if (fw.id === 'vite') {
    if (!fw.entry) return manualPlan(report, info, spec, 'Could not find the client entry: index.html has no <script type="module" src="..."> pointing at a local file.'), EXIT.MANUAL;
    if (fw.customRoot) return manualPlan(report, info, spec, 'vite.config sets a custom `root`; not guessing where the entry and public folder are.'), EXIT.MANUAL;
    if (!fw.publicDir) return manualPlan(report, info, spec, 'vite.config disables publicDir, so there is no static folder for unpolish.config.json.'), EXIT.MANUAL;
    return initPackage(opts, report, info, spec, 'vite');
  }
  if (fw.id === 'next') {
    if (!fw.layout) return manualPlan(report, info, spec, fw.pagesApp ? 'Pages Router project (no app/layout). Automatic setup covers the App Router; the exact steps are below.' : 'No app/layout or pages/_app found.'), EXIT.MANUAL;
    if ((read(fw.layout).match(/<body\b/g) || []).length !== 1) return manualPlan(report, info, spec, `${rel(info.root, fw.layout)} does not contain exactly one <body> element.`), EXIT.MANUAL;
    if (fw.dynamicBasePath) report.note('next.config sets basePath from an expression; the generated configUrl assumes no base path. Adjust it in the client component if needed.');
    return initPackage(opts, report, info, spec, 'next');
  }
  if (fw.id === 'monorepo') return manualPlan(report, info, spec, 'This is a monorepo root. Unpolish installs into a single app, so the dependency lands in the right workspace.'), EXIT.MANUAL;
  if (fw.id === 'unsupported') return manualPlan(report, info, spec, `${fw.label} isn't set up automatically yet. Here is the exact integration to add.`), EXIT.MANUAL;
  return manualPlan(report, info, spec, 'Could not recognise this project (no Vite or Next.js app, and no .html pages at the top level).'), EXIT.MANUAL;
}

function initPackage(opts, report, info, spec, kind) {
  const fw = info.framework;
  const root = info.root;
  report.data.scope = scopeText(opts.scope, kind);
  if (!info.pkg) { report.data.status = 'failed'; report.error('Package mode needs a package.json. Use --mode script for a site without one.'); return EXIT.FAILED; }

  // Plan
  const plan = [];
  const add = addCommand(info.pm.name, spec);
  const needDep = !info.installed || opts.upgrade;
  if (!needDep) report.change('keep', 'package.json', `${NAME} ${info.installed} already pinned (use --upgrade to pin ${VERSION})`);
  const configFile = path.join(info.staticDir, 'unpolish.config.json');
  const legacyConfig = info.existing.configs.find((c) => c !== configFile && c.startsWith(info.staticDir + path.sep));
  const useConfig = exists(configFile) ? configFile : legacyConfig || configFile;
  const configRel = rel(info.staticDir, useConfig);
  if (exists(useConfig)) report.change('keep', rel(root, useConfig), 'existing configuration reused, not modified');
  else {
    const schemaRef = rel(info.staticDir, path.join(root, 'node_modules', NAME, 'schema', 'unpolish.config.schema.json'));
    plan.push({ type: 'create', file: useConfig, content: starterConfig(info, schemaRef), detail: 'starter config (Original by default) — commit it' });
  }
  if (kind === 'vite') {
    const src = read(fw.entry);
    if (src.includes(START)) report.change('keep', rel(root, fw.entry), 'already initialises Unpolish');
    else {
      const block = viteBlock(configRel, opts.scope);
      plan.push({ type: 'edit', file: fw.entry, content: block + src, detail: `${block.split('\n').length - 1} lines at the top`, preview: block });
    }
  } else {
    const comp = componentPath(fw);
    const importPath = `./${NEXT_COMPONENT}`;
    if (!exists(comp)) {
      const content = nextComponent(`${fw.basePath}/${configRel}`, opts.scope);
      plan.push({ type: 'create', file: comp, content, preview: content, detail: 'client component that starts Unpolish after hydration' });
    }
    else if (!read(comp).includes(FILE_MARK)) { report.data.status = 'failed'; report.error(`${rel(root, comp)} exists and wasn't created by Unpolish; not overwriting it.`); return EXIT.FAILED; }
    else report.change('keep', rel(root, comp), 'already present');
    const layout = read(fw.layout);
    if (layout.includes(importPath) && layout.includes('<Unpolish />')) report.change('keep', rel(root, fw.layout), 'already renders <Unpolish />');
    else {
      const next = wireLayout(layout, importPath);
      plan.push({ type: 'edit', file: fw.layout, content: next, detail: `import + <Unpolish /> inside <body>`, preview: `import Unpolish from '${importPath}';\n<Unpolish />` });
    }
  }

  if (!needDep && !plan.length) {
    report.data.status = 'already-installed';
    verifyNotes(report, info, kind);
    return EXIT.OK;
  }

  // Validate before touching anything.
  if (needDep && !opts.dryRun && !hasBinary(add[0])) {
    report.data.status = 'failed';
    report.error(`This project uses ${info.pm.name} (${info.pm.source}) but \`${add[0]}\` isn't available. Install it (or enable Corepack) and run again.`);
    return EXIT.FAILED;
  }
  for (const p of plan) {
    const dir = path.dirname(p.file);
    try { fs.accessSync(exists(p.file) ? p.file : exists(dir) ? dir : path.dirname(dir), fs.constants.W_OK); } catch { report.data.status = 'failed'; report.error(`Can't write ${rel(root, p.file)}.`); return EXIT.FAILED; }
  }

  // Dependency first: if it fails, nothing else has changed.
  if (needDep) {
    report.change('dependency', 'package.json', `${spec} (exact version) via ${info.pm.name}`);
    if (!runCommand(report, root, add)) {
      report.data.status = 'failed';
      if (spec === `${NAME}@${VERSION}`) report.note(`If ${NAME}@${VERSION} isn't published yet, run the installer from the preview build instead (npx <tarball> init).`);
      report.data.changes = report.data.changes.filter((c) => c.type !== 'dependency');
      return EXIT.FAILED;
    }
  }
  return applyPlan(report, plan, root, () => verifyNotes(report, info, kind));
}

function initScript(opts, report, info, spec) {
  const root = info.root;
  if (opts.scope !== 'all') { report.data.status = 'failed'; report.error('A script-tag install has no build environments to scope to. Use --scope all, or add the tag only to the pages/deploys that should show Unpolish.'); return EXIT.FAILED; }
  report.data.scope = 'Everywhere these pages are served, including deployed previews. Hidden controls are not access control.';
  const staticDir = info.framework.id === 'plain' ? root : info.staticDir || root;
  const pages = info.framework.id === 'plain' ? htmlPages(root) : [path.join(root, 'index.html')].filter(exists);
  if (!pages.length) return manualPlan(report, info, spec, 'No HTML pages found to add the script tag to.'), EXIT.MANUAL;
  const plan = [];
  const bundle = read(path.join(PKG_DIR, 'dist', 'unpolish.js'));
  const vendored = path.join(staticDir, 'unpolish', 'unpolish.js');
  if (exists(vendored)) {
    const cur = read(vendored);
    const v = (cur.match(/^\/\*! Unpolish v([\w.\-+]+)/) || [])[1];
    if (!cur.startsWith(BUNDLE_HEADER)) { report.data.status = 'failed'; report.error(`${rel(root, vendored)} exists but isn't an Unpolish bundle; not overwriting it.`); return EXIT.FAILED; }
    if (v === VERSION) report.change('keep', rel(root, vendored), `v${v} already in place`);
    else if (opts.upgrade) plan.push({ type: 'edit', file: vendored, content: bundle, detail: `update v${v} → v${VERSION}` });
    else report.change('keep', rel(root, vendored), `v${v} kept (use --upgrade to replace it with v${VERSION})`);
  } else plan.push({ type: 'create', file: vendored, content: bundle, detail: `browser bundle v${VERSION} (pinned; no Node needed at runtime)` });
  const schema = path.join(staticDir, 'unpolish', 'unpolish.config.schema.json');
  if (!exists(schema)) plan.push({ type: 'create', file: schema, content: read(path.join(PKG_DIR, 'schema', 'unpolish.config.schema.json')), detail: 'config schema for editor hints' });
  const configFile = path.join(staticDir, 'unpolish.config.json');
  if (exists(configFile)) report.change('keep', rel(root, configFile), 'existing configuration reused, not modified');
  else plan.push({ type: 'create', file: configFile, content: starterConfig(info, './unpolish/unpolish.config.schema.json'), detail: 'starter config (Original by default) — commit it' });
  const plain = info.framework.id === 'plain';
  const tag = plain ? scriptTag('unpolish/unpolish.js', 'unpolish.config.json') : scriptTag('/unpolish/unpolish.js', '/unpolish.config.json');
  for (const page of pages) {
    const src = read(page);
    if (src.split('\n').some((l) => SCRIPT_TAG_RE.test(l))) { report.change('keep', rel(root, page), 'already loads Unpolish'); continue; }
    const next = insertBeforeHead(src, tag);
    if (next == null) { report.note(`${rel(root, page)} has no </head>; add the tag yourself: ${tag}`); continue; }
    plan.push({ type: 'edit', file: page, content: next, detail: 'script tag before </head>', preview: tag });
  }
  if (plain) {
    const nested = nestedHtmlCount(root);
    if (nested) report.note(`${nested} page(s) in subfolders were left alone. Add this to their <head> (adjust ../ to the depth): ${scriptTag('../unpolish/unpolish.js', '../unpolish.config.json')}`);
  }
  if (!plan.length) { report.data.status = 'already-installed'; verifyNotes(report, info, 'script'); return EXIT.OK; }
  return applyPlan(report, plan, root, () => verifyNotes(report, info, 'script'));
}

function applyPlan(report, plan, root, after) {
  const done = [];
  for (const p of plan) {
    report.change(p.type, rel(root, p.file), p.detail, p.preview || (p.type === 'create' && p.file.endsWith('unpolish.config.json') ? p.content : undefined));
    if (report.opts.dryRun) continue;
    try {
      fs.mkdirSync(path.dirname(p.file), { recursive: true });
      fs.writeFileSync(p.file, p.content);
      done.push(p);
    } catch (e) {
      const applied = [...(report.data.changes.some((c) => c.type === 'dependency') ? ['the dependency'] : []), ...done.map((x) => rel(root, x.file))];
      report.data.changes = report.data.changes.filter((c) => c.path !== rel(root, p.file) || c.type === 'keep');
      report.error(`Could not write ${rel(root, p.file)}: ${e.message}`);
      if (!applied.length) { report.data.status = 'failed'; return EXIT.FAILED; }
      report.data.status = 'partial';
      report.note(`Applied before the failure: ${applied.join(', ')}. Not applied: ${plan.slice(plan.indexOf(p)).map((x) => rel(root, x.file)).join(', ')}. Fix the problem and run init again — it skips what is already done.`);
      return EXIT.PARTIAL;
    }
  }
  report.data.status = report.opts.dryRun ? 'planned' : 'installed';
  after();
  return EXIT.OK;
}

function verifyNotes(report, info, kind) {
  const dev = devCommand(info);
  const v = report.data.verify;
  v.push(dev ? `Run \`${dev}\` and open the app.` : 'Open the prototype in a browser (serve the folder, e.g. `npx serve .`).');
  v.push('Press \\ (or click the launcher, bottom right) and switch themes. Check navigation, forms and dialogs still work.');
  v.push('Open the page with ?unpolish=sketch&unpolish-ui=hidden — Sketch loads with the controls hidden; \\ still opens them.');
  v.push('Choose Original: the prototype looks exactly as before.');
  if (kind !== 'script') v.push('Build it the way you deploy (e.g. the build script) to confirm preview deploys include Unpolish.');
}

/* ------------------------------------------------------------------ *
 * remove
 * ------------------------------------------------------------------ */

function remove(opts, report) {
  const info = inspect(opts.cwd);
  if (info.error) { report.data.status = 'failed'; report.error(info.error); return EXIT.FAILED; }
  const root = info.root;
  const fw = info.framework;
  report.data.detected.app = fw.label;
  const plan = [];
  if (fw.id === 'vite' && fw.entry) {
    const src = read(fw.entry);
    const a = src.indexOf(START), b = src.indexOf(END);
    if (a >= 0 && b > a) {
      let endAt = b + END.length;
      if (src[endAt] === '\n') endAt++;
      if (src[endAt] === '\n' && (a === 0 || src[a - 1] === '\n')) { /* keep following blank line that belonged to the app */ }
      plan.push({ type: 'edit', file: fw.entry, content: src.slice(0, a) + src.slice(endAt), detail: 'removed the unpolish:start…end block', preview: src.slice(a, endAt) });
    } else if (info.existing.module) report.note(`${rel(root, fw.entry)} imports ${NAME} without installer markers — remove that import yourself.`);
  }
  if (fw.id === 'next' && fw.layout) {
    const comp = componentPath(fw);
    const layout = read(fw.layout);
    const next = unwireLayout(layout, `./${NEXT_COMPONENT}`);
    if (next !== layout) plan.push({ type: 'edit', file: fw.layout, content: next, detail: 'removed the import and <Unpolish />' });
    if (exists(comp) && read(comp).includes(FILE_MARK)) plan.push({ type: 'delete', file: comp, detail: 'client component added by init' });
  }
  for (const page of info.existing.scriptTags) {
    const src = read(page);
    const next = src.split('\n').filter((l) => !SCRIPT_TAG_RE.test(l)).join('\n');
    if (next !== src) plan.push({ type: 'edit', file: page, content: next, detail: 'removed the Unpolish script tag' });
  }
  for (const v of info.existing.vendored) {
    plan.push({ type: 'delete', file: v.file, detail: `vendored bundle v${v.version}` });
    const schema = path.join(path.dirname(v.file), 'unpolish.config.schema.json');
    if (exists(schema)) plan.push({ type: 'delete', file: schema, detail: 'vendored schema' });
  }
  const configs = info.existing.configs;
  if (opts.purge) for (const c of configs) plan.push({ type: 'delete', file: c, detail: 'configuration (--purge)' });
  else for (const c of configs) report.change('keep', rel(root, c), 'your configuration — delete it yourself, or re-run with --purge');

  if (!info.installed && !plan.length) {
    report.data.status = 'not-installed';
    return EXIT.OK;
  }
  if (info.installed) {
    const cmd = removeCommand(info.pm.name);
    if (!opts.dryRun && !hasBinary(cmd[0])) { report.data.status = 'failed'; report.error(`\`${cmd[0]}\` isn't available to remove the dependency.`); return EXIT.FAILED; }
  }
  // Files first (fully reversible by re-running init), then the dependency.
  for (const p of plan) {
    report.change(p.type, rel(root, p.file), p.detail, p.preview);
    if (opts.dryRun) continue;
    try {
      if (p.type === 'delete') fs.rmSync(p.file);
      else fs.writeFileSync(p.file, p.content);
    } catch (e) { report.data.status = 'partial'; report.error(`Could not update ${rel(root, p.file)}: ${e.message}`); return EXIT.PARTIAL; }
  }
  if (!opts.dryRun) {
    for (const v of info.existing.vendored) { try { fs.rmdirSync(path.dirname(v.file)); } catch { /* not empty: leave it */ } }
  }
  if (info.installed) {
    report.change('remove-dependency', 'package.json', `${NAME} ${info.installed}`);
    if (!runCommand(report, root, removeCommand(info.pm.name))) { report.data.status = 'partial'; report.note('Files were cleaned up; remove the dependency with your package manager.'); return EXIT.PARTIAL; }
  }
  report.data.status = opts.dryRun ? 'planned' : 'removed';
  return EXIT.OK;
}

/* ------------------------------------------------------------------ */

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.command === 'help') { process.stdout.write(HELP); return EXIT.OK; }
  if (opts.command === 'version') { process.stdout.write(VERSION + '\n'); return EXIT.OK; }
  if (!['init', 'remove'].includes(opts.command)) usage(`unknown command: ${opts.command}`);
  if (!exists(opts.cwd)) usage(`no such folder: ${opts.cwd}`);
  const report = new Report(opts);
  let code;
  try {
    code = opts.command === 'init' ? init(opts, report) : remove(opts, report);
  } catch (e) {
    report.data.status = report.data.status || 'failed';
    report.error(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : String(e));
    code = EXIT.FAILED;
  }
  report.print();
  return code;
}

process.exitCode = main();
