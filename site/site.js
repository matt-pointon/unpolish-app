(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- Installation prompt ---------------- */
  // Files are referenced from wherever this site is served, so the links are always real.
  var base = new URL('unpolish/', location.href);
  base.search = ''; base.hash = '';
  var isLocal = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);

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
      '2. Vendor the files into the static assets folder, e.g. public/unpolish/unpolish.js, public/unpolish/unpolish.config.json and public/unpolish/unpolish.config.schema.json (use the project\'s equivalent path).',
      '3. Load the script with the smallest integration that fits:',
      '   - Static HTML, Vite, Vue, Svelte, Astro, CRA: add <script src="/unpolish/unpolish.js" data-config="unpolish.config.json" defer></script> to the HTML entry or root layout <head>. data-config resolves relative to the script file.',
      '   - Next.js: use next/script with strategy="afterInteractive" in the root layout (app/layout or pages/_app), keeping the data-config attribute.',
      '   - Other server-rendered apps: load it on the client after hydration; never execute it on the server.',
      '   - If a script tag doesn\'t fit, import the file once from the client entry and call window.Unpolish.init({ config }) with the imported JSON.',
      '   Respect the base path if the app is served from a sub-path.',
      '4. Configure unpolish.config.json (it is the shared, version-controlled project preset): keep "defaultTheme": "original" unless I say otherwise; set a short project "id"; add "exclude" selectors (or data-unpolish-ignore attributes) for regions that must keep their look, such as logos, maps, charts, video or canvas. Leave theme presets at their defaults.',
      '5. Verify: run the dev server, open the prototype and press \\ to open the Unpolish panel. Switch through Black & White, Sketch, Blueprint and Pastel Blocks; check that navigation, forms, menus, dialogs and any client-side routes still work; open ?unpolish=sketch and confirm Sketch loads; choose Original and confirm the app looks exactly as before. Run the project\'s existing tests, linters and type checks.',
      '6. Report what you changed, anything that may need a role hint or override (see the guide), and how to remove Unpolish: delete the script tag (or import) and the unpolish folder — nothing else.',
      ''
    ].join('\n');
  }
  $('#prompt-text').textContent = prompt();
  if (isLocal) {
    $('#origin-note').textContent = 'You are viewing this page locally, so the prompt points at ' + base.href + '. Publish this site (any static host) or share the files directly so your agent can reach them.';
  } else {
    $('#origin-note').textContent = 'Files are served from ' + base.href;
  }

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

  /* ---------------- Live demo ---------------- */
  var frame = $('#demo-frame');
  var seg = $('#demo-themes');
  var badge = $('#demo-badge');
  var labels = { original: 'Original', 'black-white': 'Black & White', sketch: 'Sketch', blueprint: 'Blueprint', pastel: 'Pastel Blocks' };
  var api = null;

  function sync(state) {
    var t = state.theme;
    $$('button', seg).forEach(function (b) {
      var on = b.getAttribute('data-theme') === t;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    badge.textContent = labels[t];
    badge.setAttribute('data-theme', t);
  }

  function connect() {
    var w = frame.contentWindow;
    if (!w || !w.Unpolish) return false;
    if (!w.document.querySelector('unpolish-harness')) return false;
    api = w.Unpolish;
    api.on('change', sync);
    api.on('ready', sync);
    sync(api.state());
    return true;
  }
  function waitForApi() {
    var tries = 0;
    (function poll() {
      if (connect() || ++tries > 100) return;
      setTimeout(poll, 100);
    })();
  }
  frame.addEventListener('load', waitForApi);
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete') waitForApi();

  seg.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !api) return;
    api.setTheme(b.getAttribute('data-theme'));
  });
  seg.addEventListener('keydown', function (e) {
    var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d || !api) return;
    e.preventDefault();
    var bs = $$('button', seg), i = bs.indexOf(document.activeElement);
    var n = bs[(i + d + bs.length) % bs.length];
    api.setTheme(n.getAttribute('data-theme'));
    n.focus();
  });
})();
