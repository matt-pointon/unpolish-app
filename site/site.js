(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- Release + install commands ---------------- */
  // site/release.js (written by scripts/release.mjs) says which version this site
  // serves and whether it is on npm yet. Before publication every command points
  // at the tarball this site hosts, so nothing refers to a package that isn't there.
  var R = window.UNPOLISH_RELEASE || { name: 'unpolish', version: '', published: false, tarball: '' };
  var base = new URL('unpolish/', location.href);
  base.search = ''; base.hash = '';
  var tarball = new URL(R.tarball, base).href;
  var docs = new URL('README.md', base).href;
  var isLocal = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
  var spec = R.published ? R.name + '@latest' : tarball;

  function command(sub) { return 'npx ' + spec + ' ' + (sub || 'init'); }
  var npmInstall = 'npm install --save-exact ' + (R.published ? R.name + '@' + R.version : tarball);

  function prompt() {
    var source = R.published
      ? ['Package: ' + R.name + ' on npm (current version ' + R.version + '). Docs: ' + docs]
      : ['It is not on npm yet. Use this preview build of version ' + R.version + ', and do not install "' + R.name + '" from the npm registry:',
         '  ' + tarball,
         'Docs: ' + docs];
    return [
      'Install Unpolish in this prototype.',
      '',
      'Unpolish adds reversible lo-fi review themes (Black & White, Sketch, Blueprint, Pastel Blocks) to a working web prototype. It must not change the app\'s logic, routes, state, markup or existing styles.'
    ].concat(source, [
      '',
      '1. Inspect the repo: package manager, framework, client entry or root layout, static folder, base path, and any existing Unpolish setup. In a monorepo, pick the app to review.',
      '2. Preview the installer\'s plan; it changes nothing:',
      '   ' + command('init --dry-run'),
      '   (in a monorepo add --cwd <app folder>)',
      '3. If the plan fits, run ' + command('init') + '. It uses the project\'s package manager and pins the exact version. Exit code 2 means it changed nothing and printed manual steps (also as --json): apply them with the smallest change that follows the project\'s conventions. Don\'t touch unrelated files, formatting or dependencies.',
      '4. Review the diff. Keep "defaultTheme": "original" in unpolish.config.json. Add "exclude" selectors only for regions that must keep their look, such as logos, maps, charts or video.',
      '5. Verify: start the app, press \\ and switch themes; check that navigation, forms and dialogs still work; open the page with ?unpolish=sketch&unpolish-ui=hidden; choose Original and confirm it looks exactly as before. Run the project\'s tests, linter and type check. Unpolish is included in every build by default so review links work on deployed previews; only restrict it (--scope dev) if I ask.',
      '6. Report the files changed, the scope, anything that may need a role hint or override, known limits (canvas/WebGL, cross-origin iframes and closed shadow roots are left as they are), and how to remove it: ' + command('remove') + ' (keeps unpolish.config.json; --purge deletes it).',
      ''
    ]).join('\n');
  }

  $('#prompt-text').textContent = prompt();
  $$('[data-cmd]').forEach(function (el) { el.textContent = command(); });
  $$('[data-cmd-remove]').forEach(function (el) { el.textContent = command('remove'); });
  $$('[data-npm-install]').forEach(function (el) { el.textContent = npmInstall; });
  $$('[data-tarball]').forEach(function (el) { el.href = tarball; el.textContent = R.tarball ? R.tarball : 'package tarball'; });
  $$('[data-release-label]').forEach(function (el) { el.textContent = R.published ? 'v' + R.version + ' on npm' : 'Preview build · not on npm yet'; });
  $$('[data-release-note]').forEach(function (el) {
    el.textContent = R.published
      ? 'The prompt has your agent run the installer, review the changes and check the app.'
      : 'The command installs v' + R.version + ' from this site. The prompt has your agent run it, review the changes and check the app.';
  });
  if (R.version) $('#version').textContent = R.version;
  $('#origin-note').textContent = isLocal
    ? 'You’re viewing this site locally, so the commands download from ' + base.href + ' — fine for projects on this machine. Deploy the site to share them.'
    : '';

  /* ---------------- Clipboard + feedback ---------------- */
  var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function copy(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    return Promise.resolve(fallback());
  }
  var toastEl = $('#toast'), toastTimer;
  function toast(html) {
    toastEl.innerHTML = html;
    clearTimeout(toastTimer);
    toastEl.classList.add('show');
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }
  function copied(btn) {
    var swap = btn.querySelector('.swap');
    if (!btn._orig) btn._orig = swap.innerHTML;
    swap.innerHTML = CHECK + '<span>Copied</span>';
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { swap.innerHTML = btn._orig; btn._orig = null; }, 1800);
  }
  function selectText(el) {
    var range = document.createRange(); range.selectNodeContents(el);
    var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  }
  // "Copied" only means the clipboard has it; the toast says what happens next.
  $$('[data-copy-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copy(command()).then(function (ok) {
        if (ok) { copied(btn); toast(CHECK + '<span>Command copied — run it in your project folder to install.</span>'); return; }
        selectText(btn.parentNode.querySelector('[data-cmd]') || $('[data-cmd]'));
        toast('<span>Clipboard unavailable — the command is selected, press Ctrl/⌘ + C.</span>');
      });
    });
  });
  $$('[data-copy-prompt]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copy(prompt()).then(function (ok) {
        if (ok) { copied(btn); toast(CHECK + '<span>Prompt copied — paste it into your coding agent. It installs Unpolish when it runs.</span>'); return; }
        var pre = $('#prompt-text');
        var details = pre.closest('details');
        if (details) details.open = true;
        pre.scrollIntoView({ block: 'center' });
        selectText(pre);
        toast('<span>Clipboard unavailable — the prompt is selected, press Ctrl/⌘ + C.</span>');
      });
    });
  });

  /* ---------------- Nav border on scroll ---------------- */
  var nav = $('.nav');
  var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- Live harness in a frame ---------------- */
  function whenApi(frame, cb) {
    var tries = 0;
    function poll() {
      var w = frame.contentWindow;
      if (w && w.Unpolish && w.document.querySelector('unpolish-harness')) { cb(w.Unpolish); return; }
      if (++tries < 150) setTimeout(poll, 100);
    }
    frame.addEventListener('load', function () { tries = 0; poll(); });
    poll();
  }
  function radios(group, onPick) {
    group.addEventListener('click', function (e) {
      var b = e.target.closest('button[role="radio"]');
      if (b) onPick(b);
    });
    group.addEventListener('keydown', function (e) {
      var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      var bs = $$('button[role="radio"]', group), i = bs.indexOf(document.activeElement);
      var n = bs[(i + d + bs.length) % bs.length];
      onPick(n); n.focus();
    });
  }
  function check(group, value) {
    $$('button[role="radio"]', group).forEach(function (b) {
      var on = (b.getAttribute('data-theme') || b.getAttribute('data-v')) === String(value);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  /* Hero demo */
  var seg = $('#demo-themes'), select = $('#demo-select'), demo = null;
  function syncDemo(state) { check(seg, state.theme); select.value = state.theme; }
  whenApi($('#demo-frame'), function (api) {
    if (demo === api) return;
    demo = api;
    api.on('change', syncDemo);
    syncDemo(api.state());
  });
  radios(seg, function (b) { if (demo) demo.setTheme(b.getAttribute('data-theme')); });
  select.addEventListener('change', function () { if (demo) demo.setTheme(select.value); });

  /* Configurator: a slice of the panel driving its own preview */
  var hints = { 'black-white': 'Status patterns and contrast', sketch: 'Stroke wobble and shading', blueprint: 'Drafting grid and corner marks', pastel: 'Color fields' };
  var cfg = null, details = $('#cfg-details'), detailsVal = $('#cfg-details-val');
  var groups = {};
  $$('[data-cfg]').forEach(function (g) { groups[g.getAttribute('data-cfg')] = g; });
  function syncCfg() {
    if (!cfg) return;
    var st = cfg.state();
    if (st.theme === 'original') { cfg.setTheme('sketch'); return; }
    var s = st.settings;
    check(groups.theme, st.theme);
    check(groups.images, s.images);
    check(groups.lines, s.border.style);
    check(groups.radius, s.radius);
    check(groups.typography, s.typography);
    if (document.activeElement !== details) details.value = s.details;
    details.style.setProperty('--p', s.details + '%');
    detailsVal.textContent = s.details === 0 ? 'Off' : s.details;
    $('#cfg-details-hint').textContent = hints[st.theme];
  }
  whenApi($('#cfg-frame'), function (api) {
    if (cfg === api) return;
    cfg = api;
    api.on('change', syncCfg);
    syncCfg();
  });
  radios(groups.theme, function (b) { if (cfg) cfg.setTheme(b.getAttribute('data-v')); });
  radios(groups.images, function (b) { if (cfg) cfg.update({ images: b.getAttribute('data-v') }); });
  radios(groups.lines, function (b) { if (cfg) cfg.update({ border: { style: b.getAttribute('data-v') } }); });
  radios(groups.radius, function (b) { var v = b.getAttribute('data-v'); if (cfg) cfg.update({ radius: v === 'keep' ? 'keep' : +v }); });
  radios(groups.typography, function (b) { if (cfg) cfg.update({ typography: b.getAttribute('data-v') }); });
  details.addEventListener('input', function () {
    details.style.setProperty('--p', details.value + '%');
    detailsVal.textContent = details.value === '0' ? 'Off' : details.value;
    if (cfg) cfg.update({ details: +details.value });
  });
  $('#cfg-reset').addEventListener('click', function () { if (cfg) cfg.resetTheme(); });
})();
