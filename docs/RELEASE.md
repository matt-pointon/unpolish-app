# Releasing Unpolish

Nothing has been published or deployed. The package, the hosted files and the website are prepared and tested locally; the steps below remain.

## One source of truth

| What | Where |
| --- | --- |
| Package name, version, Node requirement | `packages/unpolish/package.json` (`name`, `version`, `engines.node`) |
| Where installs come from | `release.config.json` — `published` and `distUrl` |
| What the website uses | `site/release.js`, generated from the two above by `npm run release` |

The website builds every command, download link and the agent prompt from `site/release.js`. Never edit install text in `index.html` or `site/site.js` to change a version or location — change the config and run `npm run release`.

`release.config.json`:

| Setting | Install source on the website |
| --- | --- |
| `"published": false, "distUrl": null` (today) | `unpolish/<name>-<version>.tgz` on the same origin as the page. On `localhost` the install section says the command only works on this machine, and the prompt says the same |
| `"published": false, "distUrl": "https://…/unpolish/"` | That public HTTPS folder. Use it when the tarball is hosted somewhere other than the site (or to test the public source while viewing the site locally) |
| `"published": true` | `npx unpolish@latest init`, `npm install --save-exact unpolish@<version>`; the prompt names the npm package |

`npm run release` rejects a non-HTTPS `distUrl`.

## External testers, before npm (shortest path)

1. `npm run release && npm test`.
2. Deploy the repository root to a public HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront…). The `unpolish/` folder must be deployed with it; it holds the tarball, `unpolish.js`, the config, schema and guide.
   - If the tarball is hosted elsewhere instead, set `distUrl` to that folder, `npm run release`, upload the contents of `unpolish/` there, and deploy the site.
3. Verify the public files match the build: `npm run check:dist -- https://<your-site>/unpolish/` (or plain `npm run check:dist` when `distUrl` is set). It fetches every file, compares bytes with `unpolish/`, and exits 1 on any mismatch or missing file.
4. From a different machine, open the public site, copy the command and run `… init --dry-run` in a test project; copy the prompt and try it in a coding agent.

Testers need Node.js 18 or later for the command (`engines.node`). The script-tag route under *Manual installation* needs no Node.

## Publishing to npm

1. Check the name is still free: `npm view unpolish` should 404 (it did when this was prepared, but that can change). If it's taken, choose another `name` in `packages/unpolish/package.json` and run `npm run release`.
2. `cd packages/unpolish && npm login && npm publish --access public` (add `--provenance` from CI if available).
3. From a clean folder: `npx unpolish@latest --version` prints the version; `npx unpolish@latest init --dry-run` in a fixture.
4. Check the CDN copies resolve before mentioning them anywhere: `https://cdn.jsdelivr.net/npm/unpolish@<version>/dist/unpolish.js`, `https://unpkg.com/unpolish@<version>/dist/unpolish.js`.
5. Set `"published": true` in `release.config.json`, `npm run release`, `npm test`, `npm run check:dist` (also confirms the version is on npm), then deploy the site.

## Next versions

1. Bump `version` in `packages/unpolish/package.json`.
2. `npm run release` (replaces the old tarball), `npm test`, publish if applicable, deploy, `npm run check:dist`.
3. Projects update with `npx <source> init --upgrade`; their config is kept.
