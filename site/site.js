(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- Installation prompt ---------------- */
  // Files are referenced from wherever this site is served, so the links are always real.
  var base = new URL('unpolish/', location.href);
  base.search = ''; base.hash = '';
  var isLocal = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);

  // One-line installer: works with any stack, no package manager.
  function command() { return 'curl -fsSL ' + base.href + 'install.sh | sh -s -- ' + base.href; }
  function uninstallCommand() { return 'curl -fsSL ' + base.href + 'install.sh | sh -s -- --uninstall'; }

  function prompt() {
    var js = new URL('unpolish.js', base).href;
    var cfg = new URL('unpolish.config.json', base).href;
    var schema = new URL('unpolish.config.schema.json', base).href;
    var docs = new URL('README.md', base).href;
    return [
      'Install Unpolish in this prototype.',
      '',
      'Unpolish is a reversible lo-fi visual layer for working web prototypes: one dependency-free script plus a JSON config file. It must not change application logic, routes, state, markup or existing styles.',
      '',
      'Get the files (they are not on npm — do not add a package dependency):',
      '- ' + js,
      '- ' + cfg + '  (starting config)',
      '- ' + schema + '  (JSON schema for the config)',
      '- Integration guide: ' + docs,
      'If you cannot download them, stop and ask me to add the files to the repo.',
      '',
      'Steps:',
      '1. Inspect the repository first: framework, build tool, where static assets are served from (public/, static/, assets/), the HTML entry point or root layout, whether pages are server-rendered, and how other third-party scripts are added. Follow those conventions.',
      '2. Vendor the files into the static assets folder. Preferably run the installer from the project root, which copies them into public/, static/ or the site root and adds the script tag where there is an HTML entry:',
      '   ' + command(),
      '   Otherwise copy them by hand, e.g. public/unpolish/unpolish.js, public/unpolish/unpolish.config.json and public/unpolish/unpolish.config.schema.json (use the project\'s equivalent path).',
      '3. Make sure the script loads with the smallest integration that fits (check what the installer did):',
      '   - Static HTML, Vite, Vue, Svelte, Astro, CRA: add <script src="/unpolish/unpolish.js" data-config="unpolish.config.json" defer></script> to the HTML entry or root layout <head>. data-config resolves relative to the script file.',
      '   - Next.js: use next/script with strategy="afterInteractive" in the root layout (app/layout or pages/_app), keeping the data-config attribute.',
      '   - Other server-rendered apps: load it on the client after hydration; never execute it on the server.',
      '   - If a script tag doesn\'t fit, import the file once from the client entry and call window.Unpolish.init({ config }) with the imported JSON.',
      '   Respect the base path if the app is served from a sub-path.',
      '4. Configure unpolish.config.json (it is the shared, version-controlled project preset): keep "defaultTheme": "original" unless I say otherwise; set a short project "id"; add "exclude" selectors (or data-unpolish-ignore attributes) for regions that must keep their look, such as logos, maps, charts, video or canvas. Leave theme presets at their defaults.',
      '5. Verify: run the dev server, open the prototype and press \\ to open the Unpolish panel. Switch through Black & White, Sketch, Blueprint and Pastel Blocks; check that navigation, forms, menus, dialogs and any client-side routes still work; open ?unpolish=sketch and confirm Sketch loads; choose Original and confirm the app looks exactly as before. Run the project\'s existing tests, linters and type checks.',
      '6. Report what you changed, anything that may need a role hint or override (see the guide), and how to remove Unpolish: ' + uninstallCommand() + ', or delete the script tag (or import) and the unpolish folder — nothing else.',
      ''
    ].join('\n');
  }
  $('#prompt-text').textContent = prompt();
  $$('[data-cmd]').forEach(function (el) { el.textContent = command(); });
  $$('[data-cmd-uninstall]').forEach(function (el) { el.textContent = uninstallCommand(); });
  $('#origin-note').textContent = isLocal
    ? 'You are viewing this page locally, so the command downloads from ' + base.href + ' — great for trying it on projects on this machine. Publish the site to share it.'
    : 'Files are served from ' + base.href;

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
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }
  function copied(btn) {
    var swap = btn.querySelector('.swap');
    if (!btn._orig) btn._orig = swap.innerHTML;
    swap.innerHTML = CHECK + '<span>Copied</span>';
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { swap.innerHTML = btn._orig; btn._orig = null; }, 1800);
  }
  $$('[data-copy-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copy(command()).then(function (ok) {
        if (ok) { copied(btn); toast(CHECK + '<span>Install command copied. Run it in your project folder.</span>'); return; }
        var code = $('[data-cmd]');
        var range = document.createRange(); range.selectNodeContents(code);
        var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
        toast('<span>Clipboard unavailable — the command is selected, press Ctrl/⌘ + C.</span>');
      });
    });
  });
  $$('[data-copy-prompt]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copy(prompt()).then(function (ok) {
        var swap = btn.querySelector('.swap');
        if (ok) {
          if (!btn._orig) btn._orig = swap.innerHTML;
          swap.innerHTML = CHECK + '<span>Copied</span>';
          clearTimeout(btn._t);
          btn._t = setTimeout(function () { swap.innerHTML = btn._orig; btn._orig = null; }, 1800);
          toast(CHECK + '<span>Installation prompt copied. Paste it into your coding agent.</span>');
        } else {
          var pre = $('#prompt-text');
          pre.scrollIntoView({ block: 'center' });
          var range = document.createRange(); range.selectNodeContents(pre);
          var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
          toast('<span>Clipboard unavailable — the prompt is selected, press Ctrl/⌘ + C.</span>');
        }
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
