// Builds the Vite examples. Each imports the runtime from the `unpolish`
// package (linked from packages/unpolish), exactly as the installer sets it up.
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
execSync('node scripts/build.mjs', { cwd: join(root, 'packages', 'unpolish'), stdio: 'inherit' });
for (const name of ['react', 'vue', 'svelte']) {
  console.log(`\n▸ building examples/${name}`);
  execSync('npx vite build --logLevel warn', { cwd: join(root, 'examples', name), stdio: 'inherit' });
}
