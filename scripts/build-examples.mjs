// Vendors the harness into each Vite example (as an agent would) and builds it.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const name of ['react', 'vue', 'svelte']) {
  const dir = join(root, 'examples', name);
  const pub = join(dir, 'public', 'unpolish');
  mkdirSync(pub, { recursive: true });
  cpSync(join(root, 'unpolish', 'unpolish.js'), join(pub, 'unpolish.js'));
  if (existsSync(join(dir, 'unpolish.config.json'))) cpSync(join(dir, 'unpolish.config.json'), join(pub, 'unpolish.config.json'));
  console.log(`\n▸ building examples/${name}`);
  execSync(`npx vite build --logLevel warn`, { cwd: dir, stdio: 'inherit' });
}
