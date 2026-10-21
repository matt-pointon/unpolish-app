# Releasing Unpolish

The package, the hosted files and the website are prepared and tested locally. Publication to npm and the first Vercel project still need credentials (this repo does not store them).

## One source of truth

| What | Where |
| --- | --- |
| Package name, version, executable, Node requirement | `packages/unpolish/package.json` (`name`, `version`, `bin`, `engines.node`) |
| Whether installs come from npm, and the production site URL | `release.config.json` — `published`, `siteUrl`, `distUrl` |
| What the website uses | `site/release.js`, generated from the two above by `npm run release` |

The website builds every command, download link and the agent prompt from `site/release.js`. Never edit install text in `index.html` or `site/site.js` to change a version or location — change the config and run `npm run release`.

`release.config.json`:

| Setting | Install source on the website |
| --- | --- |
| `"published": false` (today) | `unpolish/<name>-<version>.tgz` on the same origin as the page. On `localhost` the install section says the command only works on this machine, and the prompt says the same |
| `"published": false, "distUrl": "https://…/unpolish/"` | That public HTTPS folder. Use it when the tarball is hosted somewhere other than the site |
| `"published": true` | Visible command `npx unpolish@latest init`. The copied prompt pins `npx unpolish@<version> init --dry-run`, then `init`. No localhost URLs, tarball commands, or “not on npm yet” copy |
| `"siteUrl": "https://unpolish.vercel.app"` | Production website. Package `homepage`, bundle and docs URLs in `site/release.js` derive from it. Until it is set, `homepage` is the GitHub README |

Switching to published mode is one line in `release.config.json` (`"published": true`) plus `npm run release`. Tests cover that object (see `tests/release.spec.js` and `tests/fixtures/release-published.json`) without changing the committed unpublished config.

`npm run release` rejects a non-HTTPS `distUrl` or `siteUrl`.

## Build and test

```sh
npm install
npx playwright install chromium   # once, if Chromium is not already on the machine
npm run release                   # package dist, unpolish/, releases/<version>/, tarball, site/release.js
npm run build:examples            # Vite examples into examples/*/dist (local test server)
npm run build:site                # static site into public/ (Vercel publish dir, gitignored)
npm test                          # release + both builds + Playwright, including public/ routing
npm run check:dist -- https://<site>/unpolish/   # after a deploy, byte-compare hosted files
```

`npm run build:site` writes only public files: the marketing site, `site/demo/`, the plain HTML example and shared assets, the built React / Vue / Svelte examples, `unpolish/` downloads (current and `unpolish/<version>/`), and `docs/VALIDATION.md`. It does not copy tests, scripts, package source, fixtures or `node_modules`.

React and Svelte are built with an absolute Vite `base` (`/examples/react/`, `/examples/svelte/`) so history-routing deep links work on the hosted site. Vue uses hash routing and does not need a rewrite.

## Bumping the version

1. Set `version` in `packages/unpolish/package.json`.
2. `npm run release` — rebuilds the tarball, refreshes `unpolish/` and writes `releases/<new-version>/` (keep the old `releases/<version>/` folders so those URLs survive rebuilds).
3. `npm test`.
4. Publish and deploy (below).
5. `npm run check:dist -- https://<site>/unpolish/`.

Projects update with `npx unpolish@latest init --upgrade`; their config is kept.

## Publishing to npm

The package name is `unpolish` (unscoped, public, MIT). `npm view unpolish` was a registry 404 on 2026-10-21.

### First publish (needs a logged-in npm user)

A brand-new package cannot use Trusted Publishing until it exists on npmjs.com. From a machine logged in with publish rights, using the **tested** tarball (`npm run release` writes it; `npm test` packs it again):

```sh
npm publish unpolish/unpolish-0.1.0.tgz --access public --tag latest
```

Then, from a clean folder: `npx unpolish@latest --version` prints `0.1.0`; `npx unpolish@latest init --dry-run` in a fixture.

CDN copies (check they resolve before mentioning them): `https://cdn.jsdelivr.net/npm/unpolish@0.1.0/dist/unpolish.js`, `https://unpkg.com/unpolish@0.1.0/dist/unpolish.js`.

### Trusted Publishing (later versions)

`.github/workflows/release.yml` publishes that same packed tarball with OIDC. After the first publish, on npmjs.com → **unpolish** → **Settings** → **Trusted Publisher**:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `matt-pointon` |
| Repository | `unpolish-app` |
| Workflow filename | `release.yml` (filename only, including `.yml`) |
| Environment name | leave empty unless you add a GitHub Environment |
| Allowed actions | allow `npm publish` (required for this workflow). Optionally allow `npm dist-tag` if CI should move `latest` |

The first successful publish through that connection must happen within two days or the configuration expires. The workflow needs `id-token: write` (already set) and npm CLI ≥ 11.5.1 (the job uses Node 24). Provenance is generated automatically for trusted publishes from this public repository; the workflow also passes `--provenance`.

Do not store an `NPM_TOKEN` for publishing once Trusted Publishing is in place.

### After npm is live

1. Set `"published": true` in `release.config.json`.
2. Once the Vercel URL is known, set `"siteUrl": "https://<project>.vercel.app"`.
3. `npm run release && npm test`, then deploy. Package `homepage` becomes the site URL.

## Deploying the website (Vercel Git integration)

Create a Vercel project named `unpolish` linked to this GitHub repository. Do not attach a custom domain.

| Setting | Value |
| --- | --- |
| Framework Preset | Other (`framework: null` in `vercel.json`) |
| Build Command | `npm run build:site` |
| Output Directory | `public` |
| Install Command | `npm install` (default) |
| Production Branch | `main` |
| Root Directory | repository root |

`vercel.json` is committed with those values, per-app SPA rewrites for React and Svelte (paths with a file extension are not rewritten), `trailingSlash: true`, immutable cache for `unpolish/<version>/…`, and `no-cache` for HTML, `site/release.js` and unversioned `unpolish/` aliases.

Production deployments are builds of `main`. Preview deployments are other branches.

## Rolling back the website

In the Vercel dashboard, open the project → **Deployments** → pick a previous production deployment → **Instant Rollback** (or **Promote**). That restores the files Vercel is serving. It does **not** change:

- the npm registry (published versions stay published)
- any project that already ran `npx unpolish@… init` (those `package.json` pins and vendored files stay as they are)

To steer **new** installs to a known-good version after a bad npm publish:

```sh
npm deprecate unpolish@<bad> "<reason>"
npm dist-tag add unpolish@<good> latest
```

Tell people who already installed the bad version to reinstall the good one: `npx unpolish@<good> init --upgrade` (or `npm install --save-exact unpolish@<good>`).

Old bundle URLs under `unpolish/<version>/` stay valid across website rebuilds because `releases/<version>/` is committed and `build:site` copies it.

## Browser-script (script tag) install

No npm client is required at runtime. Download `unpolish.js` and `unpolish.config.json` from the website (`unpolish/` or `unpolish/<version>/`) into the prototype:

```html
<script src="unpolish/unpolish.js"
  data-config="unpolish.config.json" defer></script>
```

Pin a version: the bundle’s first line names it (`/*! Unpolish v0.1.0 …`). After publication, jsDelivr and unpkg serve every npm version at `https://cdn.jsdelivr.net/npm/unpolish@<version>/dist/unpolish.js` — use an exact version, never `latest`, for a prototype others review.

Full installer, configuration, update and removal notes: [`packages/unpolish/README.md`](../packages/unpolish/README.md).
