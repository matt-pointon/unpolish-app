# Releasing Unpolish

Nothing has been published. The package and site are prepared and tested locally; these steps remain.

## State today

- `packages/unpolish` — the npm package (`unpolish@0.1.0`): runtime, script bundle, types, schema, starter config, installer CLI.
- `unpolish/` — what the website serves: `unpolish.js`, `unpolish.config.json`, the schema, the guide, and the packed `unpolish-0.1.0.tgz`.
- `site/release.js` — `published: false`, so the website offers the hosted tarball (`npx <site>/unpolish/unpolish-0.1.0.tgz init`) and labels it a preview build. No page mentions a CDN URL or tells anyone to run `npx unpolish` from the registry.
- The name `unpolish` returned 404 from the npm registry when this was prepared (unclaimed then). That can change at any time.

## 1. Prepare

```sh
npm run release        # builds the package, refreshes unpolish/ and site/release.js
npm test               # includes the packed-artifact and installer fixtures
```

`npm test` fails if the committed tarball or `unpolish/unpolish.js` differ from a fresh build.

## 2. Publish the package

1. Check the name is still free: `npm view unpolish` should 404. If it's taken, pick a new name in `packages/unpolish/package.json`, re-run `npm run release` and search the site and docs for `unpolish@` and `npx unpolish`.
2. `cd packages/unpolish && npm login && npm publish --access public` (add `--provenance` from CI if available).
3. Verify from a clean folder: `npx unpolish@latest --version` prints `0.1.0`; `npx unpolish@latest init --dry-run` in a fixture.
4. Check the CDN copies resolve before mentioning them anywhere: `https://cdn.jsdelivr.net/npm/unpolish@0.1.0/dist/unpolish.js` and `https://unpkg.com/unpolish@0.1.0/dist/unpolish.js`.

## 3. Switch the website to the registry

```sh
node scripts/release.mjs --published
```

This sets `published: true`: the hero command becomes `npx unpolish@latest init`, the agent prompt names the npm package, and manual npm install pins `unpolish@0.1.0`. Update the expectations in `tests/site.spec.js` and `tests/install.spec.js` (`published: false`) to match, then run `npm test`.

## 4. Deploy the site

The site is static — serve the repository root (GitHub Pages, Netlify, S3…). `unpolish/` must be served with it: the self-host downloads and the guide live there, and the preview tarball stays useful for pinned installs.

## Next versions

1. Bump `version` in `packages/unpolish/package.json`.
2. `npm run release` (replaces the old tarball), `npm test`, publish, `node scripts/release.mjs --published`, deploy.
3. Projects update with `npx unpolish@latest init --upgrade`; their config is kept.
