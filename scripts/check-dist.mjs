// Checks that a public distribution location serves exactly the files in unpolish/.
//
//   npm run check:dist                     uses distUrl from release.config.json
//   npm run check:dist -- https://…/unpolish/   check another location (e.g. the deployed site)
//
// Exit 0 when every file is reachable over HTTPS and byte-identical; 1 otherwise.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'packages/unpolish/package.json'), 'utf8'));
const settings = JSON.parse(readFileSync(join(root, 'release.config.json'), 'utf8'));
const target = process.argv[2] || settings.distUrl;
if (!target) {
  console.error('No location to check. Set "distUrl" in release.config.json or pass a URL: npm run check:dist -- https://example.com/unpolish/');
  process.exit(1);
}
const base = new URL(target.endsWith('/') ? target : target + '/');
if (base.protocol !== 'https:') console.warn(`warning: ${base.href} is not HTTPS; testers' machines may refuse or be unable to reach it.`);

const files = [`${pkg.name}-${pkg.version}.tgz`, 'unpolish.js', 'unpolish.config.json', 'unpolish.config.schema.json', 'README.md'];
let failed = 0;
for (const f of files) {
  const url = new URL(f, base).href;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = Buffer.from(await res.arrayBuffer());
    const local = readFileSync(join(root, 'unpolish', f));
    if (!remote.equals(local)) throw new Error('differs from the local build (run npm run release, then upload unpolish/ again)');
    console.log(`  ok    ${url}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${url} — ${e.message}`);
  }
}
if (settings.published) {
  const res = await fetch(`https://registry.npmjs.org/${pkg.name}/${pkg.version}`).catch(() => null);
  if (res && res.ok) console.log(`  ok    ${pkg.name}@${pkg.version} on npm`);
  else { failed++; console.log(`  FAIL  ${pkg.name}@${pkg.version} is not on npm, but release.config.json says "published": true`); }
}
const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(base.hostname);
console.log(failed ? `\n${failed} problem(s). Testers can't install from ${base.href} yet.`
  : local ? `\nFiles match, but ${base.host} is only reachable from this machine.`
  : `\nReady: testers can install from ${base.href}`);
process.exit(failed ? 1 : 0);
