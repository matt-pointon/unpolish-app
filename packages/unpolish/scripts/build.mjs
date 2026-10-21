// Builds the three runtime artifacts from src/core.js. No dependencies.
//   dist/unpolish.js   script-tag build (starts itself; reads data-config)
//   dist/unpolish.mjs  ES module: import { init } from 'unpolish'
//   dist/unpolish.cjs  CommonJS for older tooling
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const here = (p) => new URL('../' + p, import.meta.url);
const pkg = JSON.parse(readFileSync(here('package.json'), 'utf8'));
const core = readFileSync(here('src/core.js'), 'utf8').replace(/__VERSION__/g, pkg.version);
const banner = `/*! Unpolish v${pkg.version} — reversible lo-fi themes for working web prototypes. MIT License. */\n`;
const indent = (s) => s.split('\n').map((l) => (l ? '  ' + l : l)).join('\n');

const browser = `${banner}(function () {
  'use strict';
  // Script-tag build. Does nothing outside a browser; if Unpolish is already
  // on the page (a second tag, or a module import), the first copy wins.
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.Unpolish && window.Unpolish.version) return;

${indent(core)}
  var api = createUnpolish();
  window.Unpolish = api;
  api._autoStart(document.currentScript);
})();
`;

// Module builds: importing defines functions only. Nothing touches window,
// document or navigator until init() runs in a browser.
const shared = `${core}
function getRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (!window.Unpolish || !window.Unpolish.version) window.Unpolish = createUnpolish();
  return window.Unpolish;
}

/** Start Unpolish in the browser. Returns null on the server; repeated calls return the running instance. */
function init(options) {
  var runtime = getRuntime();
  return runtime ? runtime.init(options) : null;
}

/** The running instance, created on first use; null on the server. */
function getUnpolish() {
  return getRuntime();
}

var version = '${pkg.version}';
`;

mkdirSync(here('dist'), { recursive: true });
writeFileSync(here('dist/unpolish.js'), browser);
writeFileSync(here('dist/unpolish.mjs'), `${banner}${shared}
export { init, getUnpolish, version };
export default { init: init, getUnpolish: getUnpolish, version: version };
`);
writeFileSync(here('dist/unpolish.cjs'), `${banner}'use strict';
${shared}
module.exports = { init: init, getUnpolish: getUnpolish, version: version };
module.exports.default = module.exports;
`);
copyFileSync(here('src/unpolish.d.ts'), here('dist/unpolish.d.ts'));
console.log(`built unpolish v${pkg.version}: dist/unpolish.js, dist/unpolish.mjs, dist/unpolish.cjs, dist/unpolish.d.ts`);
