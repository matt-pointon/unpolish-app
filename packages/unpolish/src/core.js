/* Unpolish runtime core.
 *
 * Everything lives inside createUnpolish(), so loading this code touches no
 * browser globals; the factory runs only in the browser. scripts/build.mjs wraps
 * it into dist/unpolish.js (script tag) and dist/unpolish.mjs / .cjs (modules).
 */
function createUnpolish() {
  'use strict';

  var VERSION = '__VERSION__';

  /* ------------------------------------------------------------------ *
   * Themes
   * ------------------------------------------------------------------ */

  var THEME_IDS = ['black-white', 'sketch', 'blueprint', 'pastel'];
  var ALIASES = {
    bw: 'black-white', 'black-and-white': 'black-white', mono: 'black-white', monochrome: 'black-white',
    'pastel-blocks': 'pastel', blocks: 'pastel', off: 'original', none: 'original', default: 'original'
  };

  var THEMES = {
    'black-white': {
      label: 'Black & White', short: 'B&W', scheme: 'light',
      detailsHint: 'Status patterns and contrast',
      defaults: {
        palette: { paper: '#ffffff', surface: '#ffffff', ink: '#141414', muted: '#5c5c5c', line: '#1c1c1c', accent: '#141414', danger: '#141414', success: '#141414', warning: '#141414' },
        typography: 'neutral', border: { weight: 1.25, style: 'solid' }, radius: 4, shadows: 'none', details: 45, images: 'theme'
      }
    },
    sketch: {
      label: 'Sketch', short: 'Sketch', scheme: 'light',
      detailsHint: 'Stroke wobble and shading',
      defaults: {
        palette: { paper: '#fbfaf5', surface: '#ffffff', ink: '#232323', muted: '#646464', line: '#2a2a2a', accent: '#2563c9', danger: '#c8423b', success: '#2f7d45', warning: '#b7791f' },
        typography: 'hand', border: { weight: 1.6, style: 'hand' }, radius: 4, shadows: 'none', details: 50, images: 'theme'
      }
    },
    blueprint: {
      label: 'Blueprint', short: 'Blueprint', scheme: 'dark',
      detailsHint: 'Drafting grid and corner marks',
      defaults: {
        palette: { paper: '#1d4b8f', surface: '#235aa3', ink: '#f2f7ff', muted: '#b7cff0', line: '#d4e4fb', accent: '#ffffff', danger: '#ffb4a8', success: '#a8e6bd', warning: '#ffe08f' },
        typography: 'technical', border: { weight: 1, style: 'solid' }, radius: 2, shadows: 'none', details: 45, images: 'theme'
      }
    },
    pastel: {
      label: 'Pastel Blocks', short: 'Pastel', scheme: 'light',
      detailsHint: 'Color fields',
      defaults: {
        palette: { paper: '#fbf8f3', surface: '#ffffff', ink: '#2b2733', muted: '#665f70', line: '#e4dbcf', accent: '#cbc0ff', danger: '#ffc4ba', success: '#c3eacc', warning: '#ffe2a3', block1: '#ffe0d3', block2: '#d6e9ff', block3: '#d9f1df', block4: '#ebe1ff', block5: '#fff0c2' },
        typography: 'rounded', border: { weight: 0, style: 'none' }, radius: 8, shadows: 'none', details: 50, images: 'theme'
      }
    }
  };

  var PALETTE_LABELS = {
    paper: 'Page', surface: 'Surface', ink: 'Text', muted: 'Secondary', line: 'Lines', accent: 'Accent',
    danger: 'Error', success: 'Success', warning: 'Warning',
    block1: 'Block 1', block2: 'Block 2', block3: 'Block 3', block4: 'Block 4', block5: 'Block 5'
  };

  var TYPE_OPTIONS = [
    ['original', 'Keep original'],
    ['neutral', 'Neutral sans'],
    ['hand', 'Hand-drawn'],
    ['technical', 'Technical'],
    ['rounded', 'Rounded']
  ];
  var FONT_STACKS = {
    neutral: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    hand: '"Balsamiq Sans", "Comic Neue", "Segoe Print", "Chalkboard SE", "Comic Sans MS", cursive',
    technical: '"IBM Plex Sans", ui-sans-serif, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    rounded: '"Nunito", ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif'
  };
  var MONO_STACK = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var WEB_FONTS = {
    hand: 'family=Balsamiq+Sans:ital,wght@0,400;0,700;1,400',
    technical: 'family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500',
    rounded: 'family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400'
  };
  var BORDER_STYLES = [['solid', 'Solid'], ['dashed', 'Dashed'], ['hand', 'Hand'], ['none', 'None']];
  var RADIUS_OPTIONS = [['keep', 'Keep'], [0, '0'], [4, '4'], [8, '8'], [14, '14']];
  var SHADOW_OPTIONS = [['none', 'None'], ['soft', 'Soft'], ['flat', 'Flat']];
  var IMAGE_OPTIONS = [['original', 'Original'], ['mono', 'B&amp;W'], ['theme', 'Match theme'], ['placeholder', 'Placeholder']];
  var IMAGE_ALIASES = { simplified: 'theme', themed: 'theme', match: 'theme', bw: 'mono', grayscale: 'mono', greyscale: 'mono', 'black-white': 'mono' };

  var DEFAULT_CONFIG = {
    version: 1,
    id: '',
    defaultTheme: 'original',
    ui: 'visible',
    launcher: 'bottom-right',
    webFonts: true,
    exclude: [],
    include: [],
    roles: {},
    shortcuts: { toggle: '\\', themes: {} },
    themes: {},
    overrides: {}
  };

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function merge(base, over) {
    var out = clone(base) || {};
    if (!isObj(over)) return out;
    Object.keys(over).forEach(function (k) {
      if (isObj(over[k]) && isObj(out[k])) out[k] = merge(out[k], over[k]);
      else if (over[k] !== undefined) out[k] = clone(over[k]);
    });
    return out;
  }
  function equal(a, b) { return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b)); }
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (!isObj(v)) return v;
    var o = {};
    Object.keys(v).sort().forEach(function (k) { o[k] = sortKeys(v[k]); });
    return o;
  }
  /* Keys of `over` whose values differ from `base` (deep, objects collapse to their own diff). */
  function diff(base, over) {
    var out = {};
    if (!isObj(over)) return out;
    Object.keys(over).forEach(function (k) {
      if (isObj(over[k]) && isObj(base && base[k])) {
        var d = diff(base[k], over[k]);
        if (Object.keys(d).length) out[k] = d;
      } else if (!equal(base && base[k], over[k])) out[k] = clone(over[k]);
    });
    return out;
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function round(n, p) { var f = Math.pow(10, p || 0); return Math.round(n * f) / f; }
  function warn() { try { console.warn.apply(console, ['[unpolish]'].concat([].slice.call(arguments))); } catch (e) { /* noop */ } }
  function validSelectors(list, kind) {
    return (Array.isArray(list) ? list : [list]).filter(function (sel) {
      if (typeof sel !== 'string' || !sel.trim()) return false;
      try { document.createDocumentFragment().querySelector(sel); return true; } catch (e) { warn('Ignoring invalid ' + kind + ' selector:', sel); return false; }
    });
  }
  function keptWhere(include) {
    var parts = [KEEP_SEL, KEEP_SEL + ' *'];
    splitSel(include || '').forEach(function (s) { if (s) { parts.push(s); parts.push(s + ' *'); } });
    return ':where(' + parts.join(', ') + ')';
  }
  function skipKind(el) {
    var tag = el.tagName;
    if (tag === 'IMG' || tag === 'PICTURE') return 'image';
    if (tag === 'VIDEO') return 'video';
    if (tag === 'CANVAS') return 'canvas';
    if (tag === 'IFRAME' || tag === 'EMBED' || tag === 'OBJECT') return 'media';
    if (/^GMP-/.test(tag)) return 'map';
    try { if (el.matches(MAP_WIDGET_SEL)) return 'map'; } catch (e) { /* invalid */ }
    return 'heavy';
  }
  function absMajority(el) {
    var kids = el.children, n = Math.min(kids.length, 24), abs = 0, i;
    if (!n) return false;
    for (i = 0; i < n; i++) {
      var s = kids[i].getAttribute('style') || '';
      if (/position\s*:\s*(absolute|fixed)/i.test(s)) abs++;
    }
    return abs * 2 >= n;
  }
  function normTheme(id) {
    if (id == null) return null;
    id = String(id).trim().toLowerCase();
    if (ALIASES[id]) id = ALIASES[id];
    return id === 'original' || THEMES[id] ? id : null;
  }
  function raf(fn) { return (window.requestAnimationFrame || setTimeout)(fn); }
  function scheduleIdle(fn) {
    if (typeof requestIdleCallback === 'function') return requestIdleCallback(fn, { timeout: 48 });
    return raf(fn);
  }
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  var WORK_BUDGET_MS = 8;
  var BATCH_MAX = 24;
  var HEAVY_CHILD_MIN = 80;
  var CHURN_WINDOW_MS = 1000;
  var CHURN_MARK_MIN = 30;
  // Regions that must keep their own look. data-unpolish-ignore and project exclude
  // win over skip filters. Maps and media are skipped separately (filter on the root, no walk).
  var BUILTIN_EXEMPT = ['[data-unpolish-ignore]', 'unpolish-harness', '#unpolish-filters', '#unpolish-probe'];
  var MEDIA_LEAF = { IMG: 1, PICTURE: 1, VIDEO: 1, CANVAS: 1, IFRAME: 1, EMBED: 1, OBJECT: 1 };
  var MAP_WIDGET_SEL = '.leaflet-container, .mapboxgl-map, .maplibregl-map, .gm-style, gmp-map, .ol-viewport, [class*="deckgl"], [class*="deck-gl"], [role="application"]:not(html, body)';
  var SKIP_MEDIA_SEL = 'img, picture, video, canvas, iframe, object, embed';
  var KEEP_SEL = '[data-unpolish="keep"]';
  var ANIM_STYLE = /^(transform|translate|rotate|scale|offset|opacity|filter|perspective|perspective-origin|transform-origin|will-change|left|top|right|bottom|x|y|cx|cy|d|points|transition|animation|offset-path|offset-distance|offset-rotate|contain|content-visibility)$/i;
  function styleDecls(s) {
    var out = {};
    String(s || '').split(';').forEach(function (part) {
      var i = part.indexOf(':');
      if (i < 0) return;
      var k = part.slice(0, i).trim().toLowerCase();
      if (k) out[k] = part.slice(i + 1).trim();
    });
    return out;
  }
  function styleAffectsTheme(oldVal, newVal) {
    var a = styleDecls(oldVal), b = styleDecls(newVal), seen = {};
    function changed(k) {
      if (seen[k]) return false;
      seen[k] = 1;
      return a[k] !== b[k] && !ANIM_STYLE.test(k);
    }
    for (var k in a) if (changed(k)) return true;
    for (var k2 in b) if (changed(k2)) return true;
    return false;
  }
  /* Signature of attributes that can change a node's theme role. Class churn
   * that repeats a previously seen signature is replayed from cache. */
  function attrSig(el) {
    return el.tagName + '\0' + (el.className || '') + '\0' +
      (el.getAttribute('role') || '') + '\0' +
      (el.hasAttribute('open') ? '1' : '0') + '\0' +
      (el.hasAttribute('hidden') ? '1' : '0') + '\0' +
      (el.getAttribute('data-state') || '') + '\0' +
      (el.getAttribute('data-active') || '') + '\0' +
      (el.getAttribute('data-selected') || '') + '\0' +
      (el.getAttribute('aria-selected') || '') + '\0' +
      (el.getAttribute('aria-current') || '') + '\0' +
      (el.getAttribute('aria-pressed') || '') + '\0' +
      (el.getAttribute('aria-checked') || '') + '\0' +
      (el.getAttribute('aria-expanded') || '') + '\0' +
      (el.getAttribute('aria-invalid') || '') + '\0' +
      (el.getAttribute('disabled') || '');
  }
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  var storage = {
    get: function (area, key) {
      try { var v = window[area].getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
    },
    set: function (area, key, val) {
      try { if (val == null) window[area].removeItem(key); else window[area].setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ }
    }
  };

  /* ------------------------------------------------------------------ *
   * Color
   * ------------------------------------------------------------------ */

  var colorCache = new Map();
  var colorCtx = null;
  function parseColor(str) {
    if (!str) return null;
    if (colorCache.has(str)) return colorCache.get(str);
    var m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(str);
    var c;
    if (m) {
      var a = m[4] == null ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
      c = { r: +m[1], g: +m[2], b: +m[3], a: a };
    } else if (/^#[0-9a-f]{3,8}$/i.test(str)) {
      var h = str.slice(1);
      if (h.length <= 4) h = h.split('').map(function (x) { return x + x; }).join('');
      c = { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
    } else if (str === 'transparent') {
      c = { r: 0, g: 0, b: 0, a: 0 };
    } else {
      // Modern color spaces (oklch, lab, color()) — let the browser convert.
      try {
        if (!colorCtx) {
          var cv = document.createElement('canvas'); cv.width = cv.height = 1;
          colorCtx = cv.getContext('2d', { willReadFrequently: true });
        }
        colorCtx.clearRect(0, 0, 1, 1);
        colorCtx.fillStyle = '#000';
        colorCtx.fillStyle = str;
        colorCtx.fillRect(0, 0, 1, 1);
        var d = colorCtx.getImageData(0, 0, 1, 1).data;
        c = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
      } catch (e) { c = null; }
    }
    if (colorCache.size > 4000) colorCache.clear();
    colorCache.set(str, c);
    return c;
  }
  function over(top, bottom) {
    if (!top) return bottom;
    var a = top.a;
    if (a >= 0.999 || !bottom) return { r: top.r, g: top.g, b: top.b, a: 1 };
    return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
  }
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function luminance(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  function contrast(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function oklch(c) {
    var r = lin(c.r), g = lin(c.g), b = lin(c.b);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    var h = Math.atan2(B, A) * 180 / Math.PI;
    return { L: L, C: Math.sqrt(A * A + B * B), h: h < 0 ? h + 360 : h };
  }
  function hex(c) {
    function p(v) { return ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); }
    return '#' + p(c.r) + p(c.g) + p(c.b);
  }
  function mix(a, b, t) {
    var x = parseColor(a) || { r: 0, g: 0, b: 0 }, y = parseColor(b) || { r: 255, g: 255, b: 255 };
    return hex({ r: x.r * (1 - t) + y.r * t, g: x.g * (1 - t) + y.g * t, b: x.b * (1 - t) + y.b * t });
  }
  function cr(a, b) { return contrast(parseColor(a), parseColor(b)); }
  /* Nudge `color` toward `toward` until it reaches `min` contrast against every background. */
  function readable(color, bgs, toward, min) {
    var c = color;
    for (var i = 0; i <= 10; i++) {
      c = i === 0 ? color : mix(color, toward, i / 10);
      if (bgs.every(function (bg) { return cr(c, bg) >= min; })) return c;
    }
    return toward;
  }
  function bestOn(fill, options) {
    var best = options[0], score = 0;
    options.forEach(function (o) { var s = cr(fill, o); if (s > score) { score = s; best = o; } });
    return best;
  }
  function alpha(color, a) { return 'color-mix(in srgb, ' + color + ' ' + round(a * 100, 1) + '%, transparent)'; }
  function isColor(v) { return typeof v === 'string' && (window.CSS && CSS.supports ? CSS.supports('color', v) : true); }

  /* ------------------------------------------------------------------ *
   * Settings & configuration
   * ------------------------------------------------------------------ */

  function normalizeSettings(id, s) {
    var d = THEMES[id].defaults;
    var out = merge(d, s || {});
    delete out.roughness; // retired setting; older configs and drafts may still carry it
    Object.keys(out.palette).forEach(function (k) {
      if (!(k in d.palette) || !isColor(out.palette[k])) out.palette[k] = d.palette[k];
    });
    if (!FONT_STACKS[out.typography] && out.typography !== 'original') out.typography = d.typography;
    out.border = { weight: clamp(+out.border.weight || 0, 0, 4), style: BORDER_STYLES.some(function (o) { return o[0] === out.border.style; }) ? out.border.style : d.border.style };
    if (out.radius !== 'keep') out.radius = isFinite(+out.radius) ? clamp(+out.radius, 0, 40) : d.radius;
    if (!SHADOW_OPTIONS.some(function (o) { return o[0] === out.shadows; })) out.shadows = d.shadows;
    // Details is a 0–100 strength (older configs used true/false).
    if (out.details === true) out.details = d.details;
    else if (out.details === false) out.details = 0;
    out.details = isFinite(+out.details) && out.details !== null && out.details !== '' ? clamp(Math.round(+out.details), 0, 100) : d.details;
    if (IMAGE_ALIASES[out.images]) out.images = IMAGE_ALIASES[out.images];
    if (!IMAGE_OPTIONS.some(function (o) { return o[0] === out.images; })) out.images = d.images;
    return out;
  }

  function normalizeConfig(raw) {
    var cfg = merge(DEFAULT_CONFIG, isObj(raw) ? raw : {});
    cfg.defaultTheme = normTheme(cfg.defaultTheme) || 'original';
    cfg.ui = cfg.ui === 'hidden' ? 'hidden' : 'visible';
    if (!/^(top|bottom)-(left|right)$/.test(cfg.launcher) && cfg.launcher !== false) cfg.launcher = 'bottom-right';
    cfg.exclude = validSelectors(cfg.exclude, 'exclude');
    cfg.include = validSelectors(cfg.include, 'include');
    var themes = {};
    Object.keys(cfg.themes || {}).forEach(function (k) {
      var id = normTheme(k);
      if (id && id !== 'original') themes[id] = normalizeSettings(id, cfg.themes[k]);
      else warn('Unknown theme in config:', k);
    });
    cfg.themes = themes;
    var sc = cfg.shortcuts || {};
    var themeKeys = {};
    Object.keys(sc.themes || {}).forEach(function (k) {
      var id = normTheme(k);
      if (id && typeof sc.themes[k] === 'string' && sc.themes[k]) themeKeys[id] = sc.themes[k];
    });
    cfg.shortcuts = { toggle: typeof sc.toggle === 'string' && sc.toggle ? sc.toggle : '\\', themes: themeKeys };
    return cfg;
  }

  /* ------------------------------------------------------------------ *
   * Derived design tokens for a theme + settings
   * ------------------------------------------------------------------ */

  function svgUrl(svg) {
    return 'url("data:image/svg+xml,' + svg.replace(/"/g, "'").replace(/[#%<>{}]/g, function (ch) { return encodeURIComponent(ch); }).replace(/\s+/g, ' ') + '")';
  }

  /* Seeded noise so strokes stay stable between renders. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* A seamless wobbly line along x, centred at y=c. Returns SVG path data. */
  function wobble(len, c, amp, seed) {
    var rand = rng(seed), pts = [], step = 22;
    var n = Math.round(len / step);
    for (var i = 0; i <= n; i++) pts.push([i * len / n, i === 0 || i === n ? c : c + (rand() * 2 - 1) * amp]);
    var d = 'M' + round(pts[0][0], 2) + ' ' + round(pts[0][1], 2);
    for (var j = 0; j < pts.length - 1; j++) {
      var p0 = pts[j - 1] || pts[j], p1 = pts[j], p2 = pts[j + 1], p3 = pts[j + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + [c1x, c1y, c2x, c2y, p2[0], p2[1]].map(function (v) { return round(v, 2); }).join(' ');
    }
    return d;
  }

  function strips(style, color, weight, amp, doubled, variant) {
    var len = 220, pad = 1;
    var h = Math.ceil(weight + amp * 2 + pad * 2 + (doubled ? 1.2 : 0));
    var centre = pad + amp + weight / 2;
    var out = {};
    ['t', 'b', 'l', 'r'].forEach(function (side, i) {
      var cy = side === 't' || side === 'l' ? centre : h - centre;
      var body;
      if (style === 'dashed') {
        body = '<path d="M0 ' + cy + 'H' + len + '" stroke="' + color + '" stroke-width="' + weight + '" stroke-dasharray="7 5" fill="none"/>';
      } else {
        var seed = 7 + variant * 97 + i * 13;
        body = '<path d="' + wobble(len, cy, amp, seed) + '" stroke="' + color + '" stroke-width="' + weight + '" fill="none" stroke-linecap="round"/>';
        if (doubled) body += '<path d="' + wobble(len, cy + (side === 't' || side === 'l' ? 0.9 : -0.9), amp * 1.1, seed + 5) + '" stroke="' + color + '" stroke-opacity="0.45" stroke-width="' + round(weight * 0.7, 2) + '" fill="none" stroke-linecap="round"/>';
      }
      var vertical = side === 'l' || side === 'r';
      var svg = vertical
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="' + h + '" height="' + len + '"><g transform="matrix(0 1 1 0 0 0)">' + body + '</g></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="' + len + '" height="' + h + '">' + body + '</svg>';
      out[side] = svgUrl(svg);
    });
    out.h = h; out.len = len;
    return out;
  }

  function placeholderSvg(id, v) {
    var stroke = id === 'blueprint' ? v.line : id === 'pastel' ? mix(v.ink, v.surface, 0.75) : mix(v.ink, v.surface, 0.55);
    var lines = id === 'pastel' ? '' :
      '<path d="M0 0L100 100M100 0L0 100" stroke="' + stroke + '" stroke-width="1" vector-effect="non-scaling-stroke"' + (id === 'blueprint' ? ' stroke-dasharray="4 4"' : '') + ' fill="none"/>';
    var frame = '<rect x="0" y="0" width="100" height="100" fill="none" stroke="' + stroke + '" stroke-width="2" vector-effect="non-scaling-stroke"/>';
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + lines + (id === 'pastel' ? '' : frame) + '</svg>');
  }
  function placeholderIcon(color) {
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/></svg>');
  }
  function tickSvg(corner, color, size) {
    var s = size, o = 3.5, d;
    if (corner === 'tl') d = 'M' + o + ' ' + s + 'V' + o + 'H' + s;
    if (corner === 'tr') d = 'M0 ' + o + 'H' + (s - o) + 'V' + s;
    if (corner === 'bl') d = 'M' + o + ' 0V' + (s - o) + 'H' + s;
    if (corner === 'br') d = 'M0 ' + (s - o) + 'H' + (s - o) + 'V0';
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '"><path d="' + d + '" stroke="' + color + '" stroke-width="1" fill="none"/></svg>');
  }

  function derive(id, s, lite) {
    // Details (0–100) sets the strength of each theme's own treatment: wobble, patterns, grid, fields.
    var p = s.palette, T = THEMES[id], r = s.details / 100, on = s.details > 0;
    var v = { id: id, r: r, scheme: T.scheme };
    v.paper = p.paper;
    v.surface = id === 'blueprint' ? mix(p.surface, p.paper, r * 0.65) : p.surface;
    v.ink = p.ink;
    v.muted = readable(p.muted, [v.surface, v.paper], v.ink, 4.5);
    v.line = p.line;
    v.rule = id === 'black-white' ? mix(p.line, v.surface, 0.72)
      : id === 'sketch' ? mix(p.line, v.surface, 0.45)
      : id === 'blueprint' ? mix(p.line, v.paper, 0.45)
      : mix(p.line, v.surface, r * 0.6);
    v.field = id === 'blueprint' ? mix(p.paper, '#000000', 0.12) : '#ffffff';
    if (id === 'pastel' || id === 'sketch') v.field = mix(v.surface, '#ffffff', 0.5);
    if (id === 'black-white') v.field = v.surface;

    var tintRatio = { 'black-white': 0, sketch: 0.16, blueprint: 0.22, pastel: 0.38 + r * 0.42 }[id];
    var tones = {};
    ['accent', 'danger', 'success', 'warning'].forEach(function (t) {
      var fill = p[t];
      var tint;
      if (id === 'black-white') {
        tint = mix(v.surface, p[t], { accent: 0.1, danger: 0.07, success: 0.2, warning: 0.06 }[t]);
        if (t === 'success') fill = mix(p[t], v.surface, 0.3);
      } else {
        tint = mix(v.surface, p[t], tintRatio);
      }
      if (id === 'pastel') fill = mix(v.surface, p[t], 0.75 + r * 0.25);
      tones[t] = {
        fill: fill,
        on: bestOn(fill, [v.ink, '#ffffff', v.paper]),
        tint: tint,
        text: readable(p[t], [v.surface, v.paper, tint], v.ink, 4.5)
      };
    });
    tones.neutral = {
      fill: id === 'blueprint' ? mix(v.ink, v.paper, 0.12) : id === 'pastel' ? mix(v.ink, v.surface, 0.12) : v.ink,
      tint: id === 'blueprint' ? mix(v.surface, v.ink, 0.12) : id === 'pastel' ? mix(v.surface, p.line, 0.55) : mix(v.surface, v.ink, 0.07),
      text: v.ink
    };
    tones.neutral.on = bestOn(tones.neutral.fill, [v.paper, '#ffffff', v.ink]);
    v.tones = tones;
    v.focus = id === 'black-white' ? v.ink : id === 'blueprint' ? v.ink : tones.accent.text;
    v.control = id === 'black-white' ? v.ink : id === 'pastel' ? tones.accent.text : p.accent;
    v.disabledBg = mix(v.surface, v.ink, id === 'blueprint' ? 0.08 : 0.06);

    v.stroke = round(s.border.weight * (id === 'black-white' ? 0.85 + r * 0.45 : 1), 2);
    v.strokeStyle = s.border.weight <= 0 ? 'none' : s.border.style;
    if (s.radius === 'keep') v.radius = null;
    else if (id === 'black-white') v.radius = round(s.radius * (1 - r * 0.75), 1);
    else if (id === 'pastel') v.radius = round(s.radius * (0.7 + r * 0.6), 1);
    else v.radius = s.radius;

    var shadowA = id === 'black-white' ? 1 - r * 0.6 : 1;
    v.elev = s.shadows === 'soft'
      ? '0 1px 2px ' + alpha(v.ink, 0.12 * shadowA) + ', 0 6px 16px ' + alpha(v.ink, 0.08 * shadowA)
      : s.shadows === 'flat'
        ? (id === 'sketch' ? '2px 3px 0 0 ' + alpha(v.ink, 0.85) : id === 'blueprint' ? '3px 3px 0 0 ' + alpha('#000000', 0.25) : '3px 3px 0 0 ' + alpha(id === 'pastel' ? mix(v.ink, v.surface, 0.75) : v.ink, 0.9))
        : '0 0 #0000';
    v.fillRing = id === 'sketch' || id === 'blueprint';

    v.font = s.typography === 'original' ? null : FONT_STACKS[s.typography];
    v.mono = MONO_STACK;
    v.typography = s.typography;

    // Image treatment
    v.images = s.images;
    var mono = 'grayscale(1) contrast(' + round(1.05 + r * 0.3, 2) + ')';
    v.imgFilter = s.images === 'mono' || id === 'black-white' ? mono : 'url(#up-f-' + id + ')';
    v.imgTint = s.images === 'mono' || id === 'black-white' ? '#ffffff' : id === 'blueprint' ? v.paper : id === 'pastel' ? p.block4 : '#ffffff';
    // One CSS filter on each skipped root. Live maps use filter functions only —
    // SVG displacement on a 12k-node animating subtree tanks fps. Stills may add
    // a cheap SVG posterize / blueprint matrix on that one replaced element.
    v.skipFilter = id === 'sketch'
      ? 'grayscale(1) contrast(1.35) brightness(1.05)'
      : id === 'blueprint'
        ? 'grayscale(1) sepia(0.9) hue-rotate(185deg) saturate(2.8) brightness(0.9) contrast(1.15)'
        : id === 'black-white'
          ? 'grayscale(1) contrast(1.4)'
          : 'grayscale(0.4) saturate(0.7) contrast(1.08) brightness(1.04)';
    v.skipFilterStill = id === 'sketch'
      ? v.skipFilter + ' url(#up-f-skip-still)'
      : id === 'blueprint'
        ? 'url(#up-f-blueprint)'
        : v.skipFilter;
    v.ph = placeholderSvg(id, v);
    v.phBg = id === 'blueprint' ? mix(v.paper, '#000000', 0.12) : id === 'pastel' ? p.block2 : id === 'sketch' ? mix(v.surface, v.ink, 0.04) : mix(v.surface, v.ink, 0.05);
    v.phIcon = placeholderIcon(id === 'blueprint' ? v.line : mix(v.ink, v.surface, 0.45));

    v.blocks = id === 'pastel' ? [1, 2, 3, 4, 5].map(function (n) { return mix(v.surface, p['block' + n], 0.3 + r * 0.5); }) : null;
    if (id === 'pastel' && !on) v.blocks = v.blocks.map(function () { return mix(v.surface, p.block2, 0.35 + r * 0.65); });
    if (lite) return v;

    // Details per theme
    v.details = s.details;
    var mode = v.strokeStyle;
    if (mode === 'hand' || mode === 'dashed') {
      var amp = mode === 'hand' ? round(0.25 + r * 2.1, 2) : 0;
      var doubled = mode === 'hand' && r > 0.45;
      var w = Math.max(0.6, v.stroke);
      v.strips = {};
      var colors = { line: v.line, rule: v.rule, danger: tones.danger.text, accent: id === 'black-white' ? v.ink : tones.accent.text };
      Object.keys(colors).forEach(function (k) {
        v.strips[k] = [0, 1].map(function (variant) { return strips(mode, colors[k], k === 'rule' ? Math.max(0.6, w * 0.8) : w, amp, doubled && k !== 'rule', variant); });
      });
      v.stripH = v.strips.line[0].h;
      v.stripLen = v.strips.line[0].len;
    }
    v.patterns = {};
    if (id === 'black-white' && on) {
      var pa = round(0.14 + r * 0.16, 3);
      v.patterns.danger = ['repeating-linear-gradient(-45deg, ' + alpha(v.ink, pa) + ' 0 1.2px, transparent 1.2px 6px)', 'auto'];
      v.patterns.warning = ['radial-gradient(' + alpha(v.ink, pa + 0.06) + ' 0.9px, transparent 1.3px)', '6px 6px'];
      v.patterns.dangerFill = ['repeating-linear-gradient(-45deg, ' + alpha('#ffffff', 0.22) + ' 0 1.2px, transparent 1.2px 6px)', 'auto'];
      v.patterns.warningFill = ['radial-gradient(' + alpha('#ffffff', 0.35) + ' 1px, transparent 1.4px)', '6px 6px'];
    }
    if (id === 'sketch' && r > 0.15) {
      var ha = round(0.05 + r * 0.12, 3);
      v.patterns.shade = ['repeating-linear-gradient(-50deg, ' + alpha(v.ink, ha) + ' 0 0.8px, transparent 0.8px ' + round(7 - r * 2.5, 1) + 'px)', 'auto'];
    }
    if (id === 'blueprint' && on) {
      // A faint grid and small corner marks; Details scales both.
      var g1 = alpha(v.line, round(0.03 + r * 0.11, 3));
      v.page = {
        image: 'linear-gradient(' + g1 + ' 1px, transparent 1px), linear-gradient(90deg, ' + g1 + ' 1px, transparent 1px)',
        size: '24px 24px, 24px 24px'
      };
      var ts = Math.round(6 + r * 8);
      v.tick = { size: ts, tl: tickSvg('tl', v.line, ts), tr: tickSvg('tr', v.line, ts), bl: tickSvg('bl', v.line, ts), br: tickSvg('br', v.line, ts) };
    }
    v.underlineTones = id === 'black-white';
    return v;
  }

  /* ------------------------------------------------------------------ *
   * Stylesheet generation
   * ------------------------------------------------------------------ */

  var TONES = ['neutral', 'accent', 'danger', 'success', 'warning'];
  var CONTROL_SEL = 'button, [role="button"], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="switch"], summary, input[type="button"], input[type="submit"], input[type="reset"], a[data-up~="anchor-block"]';
  var FIELD_SEL = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"], [type="image"], [type="button"], [type="submit"], [type="reset"], [type="hidden"]), textarea, select';

  /* Split a selector list on top-level commas only. */
  function splitSel(sel) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < sel.length; i++) {
      var ch = sel[i];
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function buildCSS(v, opts) {
    var P = opts.shadow ? '' : 'html[data-unpolish] ';
    var EXQ = ':is(' + opts.exempt + ')';
    var SKIPQ = ':is(' + MAP_WIDGET_SEL + ', [data-unpolish-skip])';
    var MEDIAQ = ':is(' + SKIP_MEDIA_SEL + ')';
    var KEPTQ = keptWhere(opts.include);
    var NOTKEEP = ':not(' + KEPTQ + ')';
    var NOTX = ':where(:not(' + EXQ + ', ' + EXQ + ' *, ' + SKIPQ + ', ' + SKIPQ + ' *, ' + MEDIAQ + ':not(svg)))';
    var t = v.tones, I = ' !important';
    var css = [];
    function rule(sel, body) { css.push(sel + '{' + body + '}'); }
    function S(sel) { return splitSel(sel).map(function (x) { return P + x; }).join(','); }

    // Tokens
    if (!opts.shadow) {
      var vars = [
        '--up-paper:' + v.paper, '--up-surface:' + v.surface, '--up-ink:' + v.ink, '--up-muted:' + v.muted,
        '--up-line:' + v.line, '--up-rule:' + v.rule, '--up-field:' + v.field, '--up-focus:' + v.focus,
        '--up-stroke:' + v.stroke + 'px', '--up-elev:' + v.elev, '--up-disabled:' + v.disabledBg,
        '--up-font:' + (v.font || 'inherit'), '--up-mono:' + v.mono
      ];
      if (v.radius != null) vars.push('--up-radius:' + v.radius + 'px');
      TONES.forEach(function (k) {
        vars.push('--up-' + k + ':' + t[k].fill, '--up-on-' + k + ':' + t[k].on, '--up-' + k + '-tint:' + t[k].tint, '--up-' + k + '-text:' + t[k].text);
      });
      if (v.blocks) v.blocks.forEach(function (b, i) { vars.push('--up-block-' + i + ':' + b); });
      if (v.strips) {
        Object.keys(v.strips).forEach(function (k) {
          v.strips[k].forEach(function (st, n) {
            ['t', 'b', 'l', 'r'].forEach(function (side) { vars.push('--up-s' + side + '-' + k + '-' + n + ':' + st[side]); });
          });
        });
      }
      if (v.tick) ['tl', 'tr', 'bl', 'br'].forEach(function (c) { vars.push('--up-tick-' + c + ':' + v.tick[c]); });
      vars.push('--up-ph:' + v.ph, '--up-ph-icon:' + v.phIcon, '--up-ph-bg:' + v.phBg);
      rule('html[data-unpolish]', vars.join(';') + ';color-scheme:' + v.scheme + I + ';background-color:var(--up-paper)' + I +
        (v.page ? ';background-image:' + v.page.image + I + ';background-size:' + v.page.size + I : ';background-image:none' + I) +
        ';scrollbar-color:' + mix(v.line, v.paper, 0.4) + ' ' + v.paper + I);
      rule('html[data-unpolish] body', 'background:transparent' + I + ';color:var(--up-ink)' + I + (v.font ? ';font-family:var(--up-font)' + I : ''));
    }

    // Context colours, inherited by everything below a surface or fill.
    var ctxLight = '--_on:var(--up-ink);--_mut:var(--up-muted);--_xa:var(--up-accent-text);--_xd:var(--up-danger-text);--_xs:var(--up-success-text);--_xw:var(--up-warning-text);--_ln:var(--up-line);--_rl:var(--up-rule)';
    rule(opts.shadow ? ':host' : 'html[data-unpolish] body', ctxLight);
    rule(S('[data-up~="fill-0"], [data-up~="fill-1"], [data-up~="page"]'), ctxLight);

    // Text inherits from the nearest surface; tagged text keeps its role.
    rule(opts.shadow ? ':where(*' + NOTX + ')' : 'html[data-unpolish] body :where(*' + NOTX + ')', 'color:inherit' + I + ';text-shadow:none' + I);
    rule(P + ':where(*' + NOTX + ')::before, ' + P + ':where(*' + NOTX + ')::after', 'color:inherit' + I + ';text-shadow:none' + I);
    if (v.font) {
      rule(P + ':where(*' + NOTX + '):not([data-up~="icon-font"], code, pre, kbd, samp, tt, pre *, code *, svg *)', 'font-family:var(--up-font)' + I);
      rule(S(':where(code, pre, kbd, samp, tt)' + NOTX), 'font-family:var(--up-mono)' + I);
    }
    rule(P + '::placeholder', 'color:var(--up-muted)' + I + ';opacity:1' + I);
    rule(P + '::selection', 'background-color:' + alpha(v.focus, 0.25) + I + ';color:inherit' + I);

    // Backgrounds: every tagged surface gets a palette colour by level and tone.
    var layers = [];
    var hasStrips = !!v.strips;
    if (hasStrips) {
      layers.push(['var(--_st)', 'var(--up-strip-len) var(--up-strip-h)', 'left top', 'repeat-x']);
      layers.push(['var(--_sb)', 'var(--up-strip-len) var(--up-strip-h)', 'left bottom', 'repeat-x']);
      layers.push(['var(--_sl)', 'var(--up-strip-h) var(--up-strip-len)', 'left top', 'repeat-y']);
      layers.push(['var(--_sr)', 'var(--up-strip-h) var(--up-strip-len)', 'right top', 'repeat-y']);
    }
    var hasPat = Object.keys(v.patterns).length > 0;
    if (hasPat) layers.push(['var(--_pat)', 'var(--_pats)', '0 0', 'repeat']);
    var hasTicks = !!v.tick;
    if (hasTicks) {
      ['tl left top', 'tr right top', 'bl left bottom', 'br right bottom'].forEach(function (x) {
        var a = x.split(' ');
        layers.push(['var(--_tk' + a[0] + ')', v.tick.size + 'px ' + v.tick.size + 'px', a[1] + ' ' + a[2], 'no-repeat']);
      });
    }
    var resetVars = '--_st:none;--_sb:none;--_sl:none;--_sr:none;--_pat:none;--_pats:auto;--_tktl:none;--_tktr:none;--_tkbl:none;--_tkbr:none';
    var bgLayers = layers.length
      ? 'background-image:' + layers.map(function (l) { return l[0]; }).join(',') + I +
        ';background-size:' + layers.map(function (l) { return l[1]; }).join(',') + I +
        ';background-position:' + layers.map(function (l) { return l[2]; }).join(',') + I +
        ';background-repeat:' + layers.map(function (l) { return l[3]; }).join(',') + I +
        ';background-origin:border-box' + I
      : 'background-image:none' + I;
    if (hasStrips) css.push('html[data-unpolish]{--up-strip-h:' + v.stripH + 'px;--up-strip-len:' + v.stripLen + 'px}');

    var deco = S('[data-up~="bg"]:not([data-up~="media-bg"], [data-up~="bgi-ui"]), [data-up~="box"]:not([data-up~="media-bg"], [data-up~="bgi-ui"]), [data-up~="edge"]:not([data-up~="media-bg"], [data-up~="bgi-ui"])');
    rule(deco, resetVars + ';' + bgLayers);
    rule(S('[data-up~="bg"]'), 'background-color:var(--_bg)' + I + ';color:var(--_on)' + I);
    rule(S('[data-up~="fill-0"]'), '--_bg:var(--up-surface)');
    rule(S('[data-up~="page"]'), '--_bg:var(--up-paper)');
    if (v.page) rule(S('[data-up~="page"]:not([data-up~="media-bg"])'), 'background-image:' + v.page.image + I + ';background-size:' + v.page.size + I + ';background-position:0 0' + I + ';background-repeat:repeat' + I);
    TONES.forEach(function (k) {
      rule(S('[data-up~="fill-1"][data-up~="tone-' + k + '"]'), '--_bg:var(--up-' + k + '-tint)');
      var on = 'var(--up-on-' + k + ')';
      rule(S('[data-up~="fill-2"][data-up~="tone-' + k + '"]'),
        '--_bg:var(--up-' + k + ');--_on:' + on + ';--_mut:color-mix(in srgb, ' + on + ' 74%, var(--up-' + k + '));--_xa:' + on + ';--_xd:' + on + ';--_xs:' + on + ';--_xw:' + on + ';--_ln:' + on + ';--_rl:color-mix(in srgb, ' + on + ' 45%, var(--up-' + k + '))');
    });
    // A fill inside a fill of the same colour would vanish: show it as a surface instead.
    var surfaceCtx = '--_bg:var(--up-surface);' + ctxLight + ';--_bl:var(--up-line)';
    TONES.forEach(function (k) {
      TONES.forEach(function (o) {
        var same = k === o;
        if (v.id === 'black-white') same = (k === 'success') === (o === 'success');
        if (v.id === 'blueprint') same = true;
        if (same) rule(S('[data-up~="fill-2"][data-up~="tone-' + k + '"][data-up~="in-' + o + '"]'), surfaceCtx);
      });
    });
    // Large dark bands (headers, heroes) become quieter regions in light-line themes.
    if (v.id === 'blueprint') rule(S('[data-up~="fill-2"][data-up~="region"]'), '--_bg:' + mix(v.paper, '#000000', 0.22) + ';' + ctxLight);
    if (v.id === 'pastel') rule(S('[data-up~="fill-2"][data-up~="region"]'), '--_bg:' + v.blocks[3] + ';' + ctxLight);
    if (v.blocks) {
      v.blocks.forEach(function (b, i) {
        rule(S('[data-up~="fill-0"][data-up~="blk-' + i + '"], [data-up~="fill-1"][data-up~="tone-neutral"][data-up~="blk-' + i + '"]'), '--_bg:var(--up-block-' + i + ')');
        rule(S('[data-up~="box"][data-up~="blk-' + i + '"]:not([data-up~="bg"])'), 'background-color:var(--up-block-' + i + ')' + I);
      });
      // Surfaces inside a block take on the block: fewer surface distinctions, flatter result.
      rule(S('[data-up~="fill-0"][data-up~="blk-none"], [data-up~="fill-1"][data-up~="tone-neutral"][data-up~="blk-none"]'), '--_bg:transparent');
    }
    // Translucent layers (scrims, frosted bars) keep their transparency.
    for (var a = 1; a <= 9; a++) rule(S('[data-up~="bg"][data-up~="a' + a + '"]'), 'background-color:color-mix(in srgb, var(--_bg) ' + (a * 10) + '%, transparent)' + I);

    // Patterns
    if (v.patterns.danger) {
      rule(S('[data-up~="fill-1"][data-up~="tone-danger"]'), '--_pat:' + v.patterns.danger[0] + ';--_pats:' + v.patterns.danger[1]);
      rule(S('[data-up~="fill-1"][data-up~="tone-warning"]'), '--_pat:' + v.patterns.warning[0] + ';--_pats:' + v.patterns.warning[1]);
      rule(S('[data-up~="fill-2"][data-up~="tone-danger"]'), '--_pat:' + v.patterns.dangerFill[0] + ';--_pats:' + v.patterns.dangerFill[1]);
      rule(S('[data-up~="fill-2"][data-up~="tone-warning"]'), '--_pat:' + v.patterns.warningFill[0] + ';--_pats:' + v.patterns.warningFill[1]);
    }
    if (v.patterns.shade) rule(S('[data-up~="fill-1"]:not(' + CONTROL_SEL.replace(/a\[data-up~="anchor-block"\]/, 'a') + ', ' + FIELD_SEL + ')'), '--_pat:' + v.patterns.shade[0] + ';--_pats:' + v.patterns.shade[1]);

    // Strokes
    var mode = v.strokeStyle;
    rule(S('[data-up~="box"]'), '--_bl:var(--_ln);--_elev:0 0 #0000');
    rule(S('[data-up~="box"][data-up~="fill-2"]'), '--_bl:' + (v.fillRing ? 'var(--up-line)' : 'var(--_bg)'));
    rule(S('[data-up~="box"][data-up~="line-strong"]'), '--_bl:var(--_on)');
    rule(S('[data-up~="box"][data-up~="line-danger"], [data-up~="box"][aria-invalid="true"]'), '--_bl:var(--up-danger-text)');
    rule(S('[data-up~="box"][data-up~="line-accent"]'), '--_bl:' + (v.id === 'black-white' ? 'var(--up-ink)' : 'var(--up-accent-text)'));
    rule(S('[data-up~="elev"]'), '--_elev:var(--up-elev)');
    if (mode === 'solid') {
      // Outlines paint above children, so full-bleed images or headers can't hide the frame.
      rule(S('[data-up~="box"]'), 'box-shadow:var(--_elev)' + I + ';outline:var(--up-stroke) solid var(--_bl)' + I + ';outline-offset:calc(var(--up-stroke) * -1)' + I);
      rule(S('[data-up~="box"][data-up~="bordered"]:not(:focus-visible)'), 'outline:none' + I);
      rule(S('[data-up~="box"][data-up~="bordered"]'), 'border-color:var(--_bl)' + I + ';box-shadow:inset 0 0 0 max(0px, calc(var(--up-stroke) - 1px)) var(--_bl), var(--_elev)' + I);
    } else if (mode === 'none') {
      rule(S('[data-up~="box"]'), 'box-shadow:var(--_elev)' + I);
      rule(S('[data-up~="box"][data-up~="bordered"]'), 'border-color:transparent' + I);
      rule(S('[data-up~="box"]:is(' + FIELD_SEL + ')'), 'box-shadow:inset 0 0 0 1px ' + (v.id === 'pastel' ? mix(v.line, v.ink, 0.25) : 'var(--up-rule)') + ', var(--_elev)' + I);
      rule(S('[data-up~="box"][data-up~="bordered"]:is([data-up~="line-danger"], [data-up~="line-accent"]), [data-up~="box"][aria-invalid="true"]'), 'box-shadow:inset 0 0 0 1.5px var(--_bl), var(--_elev)' + I);
    } else {
      rule(S('[data-up~="box"]'), 'box-shadow:var(--_elev)' + I);
      rule(S('[data-up~="box"][data-up~="bordered"]'), 'border-color:transparent' + I);
      [0, 1].forEach(function (n) {
        var set = function (c) { return '--_st:var(--up-st-' + c + '-' + n + ');--_sb:var(--up-sb-' + c + '-' + n + ');--_sl:var(--up-sl-' + c + '-' + n + ');--_sr:var(--up-sr-' + c + '-' + n + ')'; };
        rule(S('[data-up~="box"][data-up~="v' + n + '"]'), set('line'));
        rule(S('[data-up~="box"][data-up~="v' + n + '"][data-up~="line-danger"], [data-up~="box"][data-up~="v' + n + '"][aria-invalid="true"]'), set('danger'));
        rule(S('[data-up~="box"][data-up~="v' + n + '"][data-up~="line-accent"]'), set('accent'));
        if (!v.fillRing) rule(S('[data-up~="box"][data-up~="v' + n + '"][data-up~="fill-2"]'), '--_st:none;--_sb:none;--_sl:none;--_sr:none');
        ['t', 'b', 'l', 'r'].forEach(function (side) {
          rule(S('[data-up~="edge"][data-up~="e-' + side + '"][data-up~="v' + n + '"]'), '--_s' + side + ':var(--up-s' + side + '-rule-' + n + ')');
          rule(S('[data-up~="edge"][data-up~="e-' + side + '"][data-up~="v' + n + '"]:is([data-up~="line-strong"])'), '--_s' + side + ':var(--up-s' + side + '-line-' + n + ')');
          rule(S('[data-up~="edge"][data-up~="e-' + side + '"][data-up~="v' + n + '"]:is([data-up~="line-accent"])'), '--_s' + side + ':var(--up-s' + side + '-accent-' + n + ')');
          rule(S('[data-up~="edge"][data-up~="e-' + side + '"][data-up~="v' + n + '"]:is([data-up~="line-danger"])'), '--_s' + side + ':var(--up-s' + side + '-danger-' + n + ')');
        });
      });
      ['top', 'bottom', 'left', 'right'].forEach(function (side) {
        rule(S('[data-up~="edge"][data-up~="e-' + side[0] + '"]'), 'border-' + side + '-color:transparent' + I);
      });
    }
    if (mode !== 'hand' && mode !== 'dashed') {
      rule(S('[data-up~="edge"]'), 'border-color:var(--_rl)' + I);
      rule(S('[data-up~="edge"][data-up~="line-strong"]'), 'border-color:var(--_on)' + I);
      rule(S('[data-up~="edge"][data-up~="line-accent"]'), 'border-color:var(--_xa)' + I);
      rule(S('[data-up~="edge"][data-up~="line-danger"]'), 'border-color:var(--_xd)' + I);
      rule(S('[data-up~="edge"][data-up~="line-success"]'), 'border-color:var(--_xs)' + I);
      rule(S('[data-up~="edge"][data-up~="line-warning"]'), 'border-color:var(--_xw)' + I);
    }
    if (hasTicks) rule(S('[data-up~="box"][data-up~="large"]:not([data-up~="fill-2"])'), '--_tktl:var(--up-tick-tl);--_tktr:var(--up-tick-tr);--_tkbl:var(--up-tick-bl);--_tkbr:var(--up-tick-br)');
    if (v.id === 'blueprint' && mode === 'solid') rule(S('[data-up~="box"]:is(' + FIELD_SEL + ')'), 'box-shadow:inset 0 0 0 var(--up-stroke) var(--_bl)' + I);

    // Corners
    if (v.radius != null) rule(S(':is([data-up~="box"], [data-up~="bg"], [data-up~="media"]):not([data-up~="round"], [data-up~="page"])'), 'border-radius:var(--up-radius)' + I);

    // Text roles (after backgrounds so they win at equal specificity)
    rule(S('[data-up~="text-muted"]'), 'color:var(--_mut)' + I);
    rule(S('[data-up~="text-accent"]'), 'color:var(--_xa)' + I);
    rule(S('[data-up~="text-danger"]'), 'color:var(--_xd)' + I);
    rule(S('[data-up~="text-success"]'), 'color:var(--_xs)' + I);
    rule(S('[data-up~="text-warning"]'), 'color:var(--_xw)' + I);
    // Without colour, inline links keep an underline so they still read as links.
    if (v.underlineTones) rule(S('a[href][data-up~="text-accent"]:not([data-up~="anchor-block"], [data-up~="bg"])'), 'text-decoration-line:underline' + I + ';text-underline-offset:0.2em' + I + ';text-decoration-thickness:1px' + I);
    rule(S('[data-up~="clip-text"]'), '-webkit-text-fill-color:currentColor' + I + ';background-image:none' + I + ';-webkit-background-clip:border-box' + I + ';background-clip:border-box' + I);

    // Pseudo-elements that carry colour (indicators, dots, decorative bars)
    ['before', 'after'].forEach(function (ps) {
      var k = ps === 'before' ? 'pb' : 'pa';
      rule(S('[data-up~="' + k + ':s0"]::' + ps), 'background-color:var(--up-surface)' + I + ';background-image:none' + I);
      TONES.forEach(function (tn) {
        rule(S('[data-up~="' + k + ':t-' + tn + '"]::' + ps), 'background-color:var(--up-' + tn + '-tint)' + I + ';background-image:none' + I);
        rule(S('[data-up~="' + k + ':f-' + tn + '"]::' + ps), 'background-color:var(--up-' + tn + ')' + I + ';background-image:none' + I);
      });
      rule(S('[data-up~="' + k + 'l:soft"]::' + ps), 'border-color:var(--_rl)' + I);
      rule(S('[data-up~="' + k + 'l:strong"]::' + ps), 'border-color:var(--_on)' + I);
      rule(S('[data-up~="' + k + 'l:accent"]::' + ps), 'border-color:var(--_xa)' + I);
      rule(S('[data-up~="' + k + 'l:danger"]::' + ps), 'border-color:var(--_xd)' + I);
      rule(S('[data-up~="' + k + ':shadow"]::' + ps), 'box-shadow:none' + I);
    });

    // Icons follow the text colour around them.
    rule(S('svg[data-up~="icon"][fill]:not([fill="none"], [fill="transparent"], [fill^="url"])'), 'fill:currentColor' + I);
    rule(S('svg[data-up~="icon"] [fill]:not([fill="none"], [fill="transparent"], [fill^="url"], [fill="currentColor"])'), 'fill:currentColor' + I);
    rule(S('svg[data-up~="icon"] [stroke]:not([stroke="none"], [stroke="transparent"], [stroke^="url"], [stroke="currentColor"])'), 'stroke:currentColor' + I);
    rule(S('svg[data-up~="icon"][stroke]:not([stroke="none"], [stroke="transparent"])'), 'stroke:currentColor' + I);

    // Form controls
    rule(S(':is(' + FIELD_SEL + ')' + NOTX), 'caret-color:var(--up-ink)' + I);
    rule(S('input[type="checkbox"], input[type="radio"], input[type="range"], progress, meter'), 'accent-color:' + v.control + I);
    rule(S('[data-up~="bg"]:is(' + FIELD_SEL + ')'), '--_bg:var(--up-field)');
    rule(S('[data-up~="bg"]:is(' + FIELD_SEL + '):is(:disabled, [aria-disabled="true"])'), '--_bg:var(--up-disabled)');

    // Interactive states
    css.push('@media (hover: hover) {' +
      S(':is(' + CONTROL_SEL + ')[data-up~="bg"]:not(:disabled, [aria-disabled="true"]):hover') + '{background-color:color-mix(in srgb, var(--_bg) 88%, var(--_on))' + I + '}' +
      S(':is(' + CONTROL_SEL + '):not([data-up~="bg"], :disabled, [aria-disabled="true"]):hover') + '{background-color:color-mix(in srgb, var(--_on) 8%, transparent)' + I + '}' +
      S('a:not([data-up~="bg"], [data-up~="anchor-block"]):hover') + '{background-color:transparent' + I + '}' +
      '}');
    rule(S(':is(button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"])[data-up~="bg"]:is(:disabled, [aria-disabled="true"])'), '--_bg:var(--up-disabled)' + I + ';--_on:var(--up-muted)' + I + ';--_bl:var(--up-rule)' + I);
    rule(S(':is(button, [role="button"], input, select, textarea):is(:disabled, [aria-disabled="true"])' + NOTX), 'color:var(--up-muted)' + I);
    rule(S('[aria-invalid="true"]:is(' + FIELD_SEL + ')'), '--_bl:var(--up-danger-text)');
    rule(P + ':where(*' + NOTX + '):focus-visible', 'outline:2px solid var(--up-focus)' + I + ';outline-offset:2px' + I);
    rule(S('dialog::backdrop'), 'background-color:' + alpha(v.ink, 0.35) + I + ';backdrop-filter:none' + I);

    // Media that was classified (opted-in with include / data-unpolish="keep", or svg / background-image).
    if (v.images === 'theme' || v.images === 'mono') {
      rule(S('[data-up~="media"]'), 'filter:' + v.imgFilter + I);
      rule(S('[data-up~="media-bg"][data-up~="solo"]'), 'filter:' + v.imgFilter + I);
      rule(S('[data-up~="media-bg"]:not([data-up~="solo"])'), 'background-color:' + v.imgTint + I + ';background-blend-mode:luminosity' + I);
    } else if (v.images === 'placeholder') {
      var ph = 'background-color:var(--up-ph-bg)' + I + ';background-image:var(--up-ph-icon), var(--up-ph)' + I +
        ';background-size:clamp(14px, 28%, 32px) auto, 100% 100%' + I + ';background-position:center, 0 0' + I + ';background-repeat:no-repeat' + I + ';background-origin:border-box' + I;
      rule(S('img[data-up~="media"], video[data-up~="media"], input[type="image"][data-up~="media"]'), 'object-position:-99999px -99999px' + I + ';' + ph);
      rule(S('svg[data-up~="media"]'), ph);
      rule(S('svg[data-up~="media"] > *'), 'visibility:hidden' + I);
      rule(S('[data-up~="media-bg"]'), ph);
    }

    // Project overrides
    var ov = opts.overrides || {};
    if (!opts.shadow) {
      if (ov['*']) css.push('html[data-unpolish]{' + ov['*'] + '}');
      if (ov[v.id]) css.push('html[data-unpolish="' + v.id + '"]{' + ov[v.id] + '}');
    }
    return '@layer unpolish{' + css.join('\n') + '}';
  }

  /* Always-on skip filters. Kept in a separate sheet so mutation-path classify
   * can disable token CSS without restyling skipped maps. */
  function buildSkipCSS(v, opts) {
    var P = opts.shadow ? '' : 'html[data-unpolish] ';
    var EXQ = ':is(' + opts.exempt + ')';
    var KEPTQ = keptWhere(opts.include);
    var NOTKEEP = ':not(' + KEPTQ + ')';
    var NOTEX = ':not(' + EXQ + ', ' + EXQ + ' *)';
    var I = ' !important';
    var css = [];
    function rule(sel, body) { css.push(sel + '{' + body + '}'); }
    function S(sel) { return splitSel(sel).map(function (x) { return P + x; }).join(','); }
    var skipLive = ':is(' + MAP_WIDGET_SEL + ', [data-unpolish-skip="map"], [data-unpolish-skip="heavy"])' + NOTKEEP + NOTEX;
    var skipReplaced = ':is(video, iframe, embed, object, [data-unpolish-skip="video"], [data-unpolish-skip="media"])' + NOTKEEP + NOTEX;
    var skipStill = ':is(img, picture, canvas, input[type="image"], [data-unpolish-skip="image"], [data-unpolish-skip="canvas"])' + NOTKEEP + NOTEX;
    rule(S(skipStill), 'filter:' + v.skipFilterStill + I);
    rule(S(skipReplaced + ', ' + skipLive), 'filter:' + v.skipFilter + I);
    rule(S(skipLive), 'position:relative' + I);
    rule(S(':is(' + MAP_WIDGET_SEL + ', [data-unpolish-skip="map"])' + NOTKEEP + NOTEX + '::after'),
      'content:"Map"' + I + ';position:absolute' + I + ';top:6px' + I + ';left:6px' + I +
      ';padding:2px 6px' + I + ';font:600 10px/1.2 var(--up-font, ui-sans-serif, system-ui, sans-serif)' + I +
      ';letter-spacing:0.06em' + I + ';text-transform:uppercase' + I +
      ';color:var(--up-ink)' + I + ';background:color-mix(in srgb, var(--up-surface) 86%, transparent)' + I +
      ';border:1px solid var(--up-line)' + I + ';pointer-events:none' + I + ';z-index:2' + I);
    return '@layer unpolish{' + css.join('\n') + '}';
  }

  function buildFilters(v) {
    var p = v;
    function ch(c) { var x = parseColor(c); return [x.r / 255, x.g / 255, x.b / 255].map(function (n) { return round(n, 3); }); }
    var r = v.r;
    var k = round(1.6 + r * 2.6, 2);
    var lift = round(0.55 - r * 0.15, 2);
    var a = ch(mix(p.paper, '#000000', 0.25)), b = ch(p.line);
    var blk = v.blocks ? ch(v.blocks[1]) : [1, 1, 1], ink = ch(mix(p.ink, '#ffffff', 0.4));
    function duo(lo, hi) {
      return ['R', 'G', 'B'].map(function (c, i) { return '<feFunc' + c + ' type="table" tableValues="' + lo[i] + ' ' + hi[i] + '"/>'; }).join('');
    }
    var steps = r > 0.5 ? '0 0 0.5 0.5 1 1' : '0 0.25 0.5 0.75 1';
    return '' +
      '<filter id="up-f-sketch" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' +
      '<feColorMatrix type="saturate" values="0" result="g"/>' +
      '<feComponentTransfer in="g" result="soft"><feFuncR type="linear" slope="' + lift + '" intercept="' + round(1 - lift, 2) + '"/><feFuncG type="linear" slope="' + lift + '" intercept="' + round(1 - lift, 2) + '"/><feFuncB type="linear" slope="' + lift + '" intercept="' + round(1 - lift, 2) + '"/></feComponentTransfer>' +
      '<feConvolveMatrix in="g" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="e"/>' +
      '<feComponentTransfer in="e" result="lines"><feFuncR type="linear" slope="-' + k + '" intercept="1"/><feFuncG type="linear" slope="-' + k + '" intercept="1"/><feFuncB type="linear" slope="-' + k + '" intercept="1"/></feComponentTransfer>' +
      '<feBlend in="lines" in2="soft" mode="multiply"/></filter>' +
      '<filter id="up-f-blueprint" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' +
      '<feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0 0.3 0.59 0.11 0 0 0.3 0.59 0.11 0 0 0 0 0 1 0"/>' +
      '<feComponentTransfer>' + duo(a, b) + '</feComponentTransfer></filter>' +
      '<filter id="up-f-pastel" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' +
      '<feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0 0.3 0.59 0.11 0 0 0.3 0.59 0.11 0 0 0 0 0 1 0"/>' +
      '<feComponentTransfer><feFuncR type="discrete" tableValues="' + steps + '"/><feFuncG type="discrete" tableValues="' + steps + '"/><feFuncB type="discrete" tableValues="' + steps + '"/></feComponentTransfer>' +
      '<feComponentTransfer>' + duo(ink, blk) + '</feComponentTransfer></filter>' +
      '<filter id="up-f-skip-still" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' +
      '<feComponentTransfer><feFuncR type="discrete" tableValues="0 0.22 0.45 0.68 1"/><feFuncG type="discrete" tableValues="0 0.22 0.45 0.68 1"/><feFuncB type="discrete" tableValues="0 0.22 0.45 0.68 1"/></feComponentTransfer></filter>' +
      // Comparison-only: edge/pencil lines for skipped maps. Not the default skip filter.
      '<filter id="up-f-skip-edge" color-interpolation-filters="sRGB" x="-2%" y="-2%" width="104%" height="104%">' +
      '<feColorMatrix type="saturate" values="0" result="g"/>' +
      '<feComponentTransfer in="g" result="paper"><feFuncR type="linear" slope="0.22" intercept="0.78"/><feFuncG type="linear" slope="0.20" intercept="0.76"/><feFuncB type="linear" slope="0.16" intercept="0.72"/></feComponentTransfer>' +
      '<feConvolveMatrix in="g" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="e"/>' +
      '<feComponentTransfer in="e" result="inv"><feFuncR type="linear" slope="-10" intercept="1"/><feFuncG type="linear" slope="-10" intercept="1"/><feFuncB type="linear" slope="-10" intercept="1"/></feComponentTransfer>' +
      '<feComponentTransfer in="inv" result="lines"><feFuncR type="discrete" tableValues="0 0 1"/><feFuncG type="discrete" tableValues="0 0 1"/><feFuncB type="discrete" tableValues="0 0 1"/></feComponentTransfer>' +
      '<feBlend in="lines" in2="paper" mode="multiply"/></filter>';
  }

  /* ------------------------------------------------------------------ *
   * Classifier — reads each element's original styles once and tags it
   * with roles (data-up). Themes style roles, never the app's classes.
   * ------------------------------------------------------------------ */

  var SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, HEAD: 1, TITLE: 1, NOSCRIPT: 1, TEMPLATE: 1, BR: 1, WBR: 1, SOURCE: 1, TRACK: 1, PARAM: 1, BASE: 1, OPTION: 1, OPTGROUP: 1, DATALIST: 1, HTML: 1, BODY: 1, 'UNPOLISH-HARNESS': 1 };
  var CONTROL_TAGS = { BUTTON: 1, A: 1, SUMMARY: 1, LABEL: 1 };
  var CONTROL_ROLES = { button: 1, tab: 1, menuitem: 1, menuitemradio: 1, menuitemcheckbox: 1, option: 1, switch: 1, link: 1 };
  var ICON_FONT = /icon|awesome|material|symbols|glyph|feather|ionicons|remix|lucide|phosphor|tabler|codicon|bootstrap-icons|dashicons|fontello|icomoon/i;
  var COLOR_FN = /(rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|oklab\([^)]*\)|lab\([^)]*\)|lch\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b)/gi;

  function Classifier(engine) {
    this.engine = engine;
    this.tags = new WeakMap();      // el -> token string we wrote
    this.memo = new WeakMap();      // el -> { sig -> { tokens, rect } }
    this.info = new WeakMap();      // el -> { bg (effective, opaque), color }
    this.blockCount = new WeakMap(); // sibling group -> pastel block colour
    this.stable = new WeakMap();     // el -> { v, blk, anc }
    this.variant = 0;
    this.pageBg = { r: 255, g: 255, b: 255, a: 1 };
  }

  Classifier.prototype.isExempt = function (el) {
    if (!el || el.nodeType !== 1) return true;
    try { return el.matches(this.engine.exemptSelector); } catch (e) { return false; }
  };

  Classifier.prototype.isSkipRoot = function (el) {
    if (!el || el.nodeType !== 1) return false;
    if (el === document.body || el === document.documentElement) return false;
    if (this.engine.isKept(el)) return false;
    if (this.engine.heavy && this.engine.heavy.has(el)) return true;
    var tag = el.tagName;
    if (MEDIA_LEAF[tag]) return true;
    if (/^GMP-/.test(tag)) return true;
    try { if (el.matches(MAP_WIDGET_SEL)) return true; } catch (e) { /* invalid */ }
    if (el.childElementCount >= HEAVY_CHILD_MIN && absMajority(el)) return true;
    return false;
  };

  Classifier.prototype.markSkip = function (el, kind) {
    if (!el || el.nodeType !== 1) return;
    kind = kind || skipKind(el);
    if (el.getAttribute('data-unpolish-skip') !== kind) el.setAttribute('data-unpolish-skip', kind);
  };

  /* Collect elements under `root` in document order, skipping exempt and heavy subtrees. */
  Classifier.prototype.collect = function (root, out, roots) {
    var self = this;
    (function walk(el) {
      var tag = el.tagName;
      if (SKIP[tag] && tag !== 'HTML' && tag !== 'BODY') return;
      if (self.isExempt(el)) { if (self.exemptRoots) self.exemptRoots.push(el); return; }
      if (self.isSkipRoot(el)) { self.markSkip(el); return; }
      if (tag !== 'HTML' && tag !== 'BODY') out.push(el);
      if (el.shadowRoot && roots) roots.push(el.shadowRoot);
      if (tag === 'svg' || tag === 'SVG' || el instanceof SVGElement) return;
      var kids = el.children;
      for (var i = 0; i < kids.length; i++) walk(kids[i]);
      if (el.shadowRoot && roots) {
        var sk = el.shadowRoot.children;
        for (var j = 0; j < sk.length; j++) walk(sk[j]);
      }
    })(root);
    return out;
  };

  function parentEl(el) {
    return el.parentElement || (el.parentNode && el.parentNode.host) || null;
  }

  function bgOf(cs) {
    var bg = parseColor(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 };
    var bi = cs.backgroundImage;
    var url = false, grad = null;
    if (bi && bi !== 'none') {
      if (/url\(/.test(bi)) url = true;
      var m = bi.match(COLOR_FN);
      if (m && /gradient/.test(bi)) {
        var acc = { r: 0, g: 0, b: 0, a: 0 }, n = 0;
        m.forEach(function (s) { var c = parseColor(s); if (c) { acc.r += c.r; acc.g += c.g; acc.b += c.b; acc.a += c.a; n++; } });
        if (n) grad = { r: acc.r / n, g: acc.g / n, b: acc.b / n, a: acc.a / n };
      }
    }
    if (grad && grad.a > bg.a) bg = { r: grad.r, g: grad.g, b: grad.b, a: grad.a };
    return { color: bg, url: url, grad: !!grad };
  }

  function shadowKind(sh) {
    if (!sh || sh === 'none') return null;
    var parts = sh.split(/,(?![^()]*\))/);
    var ring = false, elev = false;
    parts.forEach(function (s) {
      var c = s.match(COLOR_FN);
      var col = c ? parseColor(c[0]) : { a: 1 };
      if (col && col.a < 0.03) return;
      var nums = s.replace(COLOR_FN, '').match(/-?[\d.]+px/g) || [];
      var x = parseFloat(nums[0] || 0), y = parseFloat(nums[1] || 0), blur = parseFloat(nums[2] || 0), spread = parseFloat(nums[3] || 0);
      if (!x && !y && !blur) { if (spread) ring = true; } else elev = true;
    });
    return ring || elev ? { ring: ring, elev: elev } : null;
  }

  function toneOf(c, control, strict) {
    var o = oklch(c);
    // Light tints carry little chroma, so the threshold scales with lightness.
    // Text and lines need clearer colour before they count as a status.
    var min = strict ? 0.05 : o.L > 0.9 ? 0.0125 : o.L > 0.75 ? 0.03 : 0.055;
    if (o.C < min || o.L > 0.993 || o.L < 0.12) return 'neutral';
    var h = o.h;
    var tone = (h < 45 || h >= 345) ? 'danger' : h < 115 ? 'warning' : h < 175 ? 'success' : 'accent';
    if (control && tone !== 'danger') return 'accent';
    return tone;
  }

  /* 0 = surface, 1 = tint, 2 = strong fill — judged against what sits behind it. */
  function fillLevel(c, behind, tone) {
    var L = oklch(c).L, P = oklch(behind).L, d = L - P;
    if (tone === 'neutral') {
      if (d >= -0.02) return P < 0.5 && d > 0.4 ? 2 : 0;
      return d > -0.34 ? 1 : 2;
    }
    return Math.abs(d) < 0.22 ? 1 : 2;
  }

  function sideVisible(cs, side) {
    var w = parseFloat(cs['border' + side + 'Width']) || 0;
    var st = cs['border' + side + 'Style'];
    var col = parseColor(cs['border' + side + 'Color']);
    return w > 0 && st !== 'none' && st !== 'hidden' && col && col.a > 0.05 ? col : null;
  }

  function isControl(el) {
    if (CONTROL_TAGS[el.tagName] && (el.tagName !== 'A' || el.hasAttribute('href'))) return true;
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(el.type)) return true;
    var role = el.getAttribute && el.getAttribute('role');
    return !!(role && CONTROL_ROLES[role]);
  }

  Classifier.prototype.parentInfo = function (el) {
    var p = parentEl(el);
    if (!p || p === document.documentElement || p === document.body) return { bg: this.pageBg, color: this.pageColor, box: null, depth: 0 };
    var inf = this.info.get(p);
    if (inf) return inf;
    // Unknown ancestor (dynamic insertion into an unclassified subtree): read it directly.
    var chain = [], q = p;
    while (q && q !== document.body && q !== document.documentElement && !this.info.get(q)) { chain.unshift(q); q = parentEl(q); }
    var base = q && this.info.get(q) ? this.info.get(q) : { bg: this.pageBg, color: this.pageColor, box: null };
    var self = this;
    chain.forEach(function (n) {
      var cs = getComputedStyle(n);
      var b = bgOf(cs).color;
      var eff = b.a > 0.01 ? over(b, base.bg) : base.bg;
      base = { bg: eff, color: parseColor(cs.color) || base.color, box: base.box };
      self.info.set(n, base);
    });
    return base;
  };

  /* Read phase must run while Unpolish styles are disabled (see Engine.classify). */
  Classifier.prototype.read = function (el) {
    var cs = getComputedStyle(el);
    var r = {
      el: el, tag: el.tagName, display: cs.display, position: cs.position,
      bg: bgOf(cs), color: parseColor(cs.color), font: cs.fontFamily,
      clip: cs.webkitBackgroundClip || cs.backgroundClip,
      shadow: shadowKind(cs.boxShadow), radius: parseFloat(cs.borderTopLeftRadius) || 0, radiusRaw: cs.borderTopLeftRadius,
      sides: { t: sideVisible(cs, 'Top'), b: sideVisible(cs, 'Bottom'), l: sideVisible(cs, 'Left'), r: sideVisible(cs, 'Right') },
      bwV: (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0),
      bwH: (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0),
      pseudo: null
    };
    if (r.display === 'contents') r.contents = true;
    ['::before', '::after'].forEach(function (ps) {
      var pcs = getComputedStyle(el, ps);
      var content = pcs.content;
      if (!content || content === 'none' || content === 'normal') return;
      var pb = bgOf(pcs);
      var pside = sideVisible(pcs, 'Top') || sideVisible(pcs, 'Bottom') || sideVisible(pcs, 'Left') || sideVisible(pcs, 'Right');
      var psh = pcs.boxShadow && pcs.boxShadow !== 'none';
      if (pb.color.a > 0.05 || pside || psh) {
        (r.pseudo = r.pseudo || {})[ps] = { bg: pb.color.a > 0.05 ? pb.color : null, line: pside, shadow: psh };
      }
    });
    return r;
  };

  Classifier.prototype.decide = function (r, rect, vw, vh) {
    var el = r.el, tokens = [], tag = r.tag;
    var forced = this.engine.forcedRole(el);
    var pinfo = this.parentInfo(el);
    var parentBg = pinfo.bg || this.pageBg;
    var control = isControl(el);
    var w = rect.width, h = rect.height;
    var info = { bg: parentBg, color: r.color || pinfo.color, box: pinfo.box, blk: pinfo.blk, fill2: pinfo.fill2 };

    if (forced === 'plain') { this.info.set(el, info); return ''; }

    // Media & icons
    var lower = tag.toLowerCase();
    if (lower === 'svg') {
      var big = w >= 48 && h >= 48;
      tokens.push(forced === 'icon' || (!big && forced !== 'media') ? 'icon' : 'media');
      this.info.set(el, info);
      return tokens.join(' ');
    }
    if (lower === 'img' || lower === 'video' || (lower === 'input' && el.type === 'image') || forced === 'media') {
      tokens.push('media');
      if (r.radius >= Math.min(w, h) / 2 - 1 && w > 0) tokens.push('round');
    }
    if (lower === 'canvas' || lower === 'iframe' || lower === 'embed' || lower === 'object') {
      this.info.set(el, info);
      return 'media-opaque';
    }
    if (r.font && ICON_FONT.test(r.font.split(',')[0])) tokens.push('icon-font');

    // Backgrounds
    var bg = r.bg;
    var ownBg = bg.color.a > 0.02 ? bg.color : null;
    if (bg.url) {
      var small = w <= 40 && h <= 40;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag) || small) tokens.push('bgi-ui');
      else {
        tokens.push('media-bg');
        if (!el.children.length && !(el.textContent || '').trim()) tokens.push('solo');
      }
    }
    if (bg.grad && !bg.url && r.clip === 'text') {
      tokens.push('clip-text');
      ownBg = null;
    }
    var eff = ownBg ? over(ownBg, parentBg) : parentBg;
    info.bg = eff;
    if (ownBg || forced === 'surface' || forced === 'fill') {
      var tone = toneOf(eff, control);
      var level = fillLevel(eff, parentBg, tone);
      if (forced === 'fill') level = 2;
      var role = el.getAttribute('role');
      var pageLike = w >= vw * 0.6 && h >= vh * 0.6 && level < 2 && !control && r.position !== 'fixed' && r.position !== 'absolute' && tag !== 'DIALOG' && role !== 'dialog' && role !== 'alertdialog';
      tokens.push('bg');
      if (pageLike) tokens.push('page');
      else {
        tokens.push('fill-' + level, 'tone-' + tone);
        if (level === 2 && pinfo.fill2) tokens.push('in-' + pinfo.fill2);
        if (level === 2 && !control && (w >= vw * 0.5 || w * h >= 60000)) tokens.push('region');
        if (level === 2) info.fill2 = tone;
        else info.fill2 = null;
      }
      if (ownBg && ownBg.a < 0.92) tokens.push('a' + clamp(Math.round(ownBg.a * 10), 1, 9));
    }

    // Borders & shadows
    var s = r.sides, vis = ['t', 'b', 'l', 'r'].filter(function (k) { return s[k]; });
    // CSS triangles (zero content box drawn with borders) are left alone.
    var zeroBox = r.tag !== 'HR' && w <= r.bwH + 0.5 && h <= r.bwV + 0.5;
    var full = vis.length === 4;
    var distinct = ownBg && Math.abs(oklch(eff).L - oklch(parentBg).L) * 100 > 2.5;
    var scrim = ownBg && ownBg.a < 0.75 && !full && !r.shadow;
    var box = !zeroBox && w >= 10 && h >= 10 && (full || (r.shadow && (r.shadow.ring || r.shadow.elev)) || (distinct && !scrim && !tokens.includes('page')) || forced === 'surface');
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && !/^(checkbox|radio|range|color|file|hidden)$/.test(el.type) && (full || ownBg || r.shadow)) box = true;
    if (tokens.includes('media')) box = false;
    if (box) {
      tokens.push('box');
      if (full) tokens.push('bordered');
      else if (vis.length && !zeroBox) { tokens.push('edge'); vis.forEach(function (k) { tokens.push('e-' + k); }); }
      if (r.shadow && r.shadow.elev) tokens.push('elev');
      if (w >= 140 && h >= 80) tokens.push('large');
      tokens.push('v' + this.stableVariant(el));
    } else if (vis.length && !zeroBox) {
      tokens.push('edge');
      vis.forEach(function (k) { tokens.push('e-' + k); });
      tokens.push('v' + this.stableVariant(el));
    }
    if (vis.length && !zeroBox) {
      var strongest = null, score = 0;
      vis.forEach(function (k) {
        var c = over(s[k], eff), o = oklch(c), sc = o.C * 3 + Math.abs(o.L - oklch(eff).L);
        if (sc > score) { score = sc; strongest = c; }
      });
      var bt = toneOf(strongest, control, true), bc = contrast(strongest, eff);
      if (bt === 'danger' && bc >= 1.5) tokens.push('line-danger');
      else if (bt === 'accent' && bc >= 1.5) tokens.push('line-accent');
      else if ((bt === 'success' || bt === 'warning') && bc >= 1.5) tokens.push('line-' + bt, 'line-strong');
      else if (bc >= 3) tokens.push('line-strong');
    }
    if (box || ownBg) {
      if (r.radius > 0 && w > 0 && r.radius >= Math.min(w, h) / 2 - 1) tokens.push('round');
    }

    // Pastel colour blocks: alternate fills for sibling surfaces, keep nested ones plain.
    var neutralSurface = tokens.indexOf('bg') < 0 || tokens.indexOf('fill-0') >= 0 || (tokens.indexOf('fill-1') >= 0 && tokens.indexOf('tone-neutral') >= 0);
    if (box && !control && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && neutralSurface) {
      if (pinfo.blk) tokens.push('blk-none');
      else {
        tokens.push('blk-' + this.stableBlock(el));
        info.blk = true;
      }
    }
    if (box) info.box = el;

    // Text roles
    var col = r.color;
    var pcol = pinfo.color;
    if (col && col.a > 0.05 && !(pcol && col.r === pcol.r && col.g === pcol.g && col.b === pcol.b && Math.abs(col.a - pcol.a) < 0.01 && !ownBg)) {
      var tc = over(col, eff);
      var tt = toneOf(tc, control || tag === 'A', true);
      if (tt !== 'neutral') tokens.push('text-' + tt);
      else if (contrast(tc, eff) < 7.2 && Math.abs(oklch(tc).L - oklch(eff).L) < 0.62) tokens.push('text-muted');
    }
    info.color = col || pcol;

    // Badges pair a faint tint with same-hue text; when the tint is too faint to read, trust the text.
    var ti = tokens.indexOf('tone-neutral');
    var textTone = tokens.filter(function (t) { return /^text-(accent|danger|success|warning)$/.test(t); })[0];
    if (ti >= 0 && textTone && ownBg && h <= 48 && (tokens.indexOf('fill-0') >= 0 || tokens.indexOf('fill-1') >= 0)) {
      tokens[ti] = 'tone-' + textTone.slice(5);
      var f0 = tokens.indexOf('fill-0');
      if (f0 >= 0) tokens[f0] = 'fill-1';
      if (info.fill2 === 'neutral') info.fill2 = null;
    }

    if (tag === 'A' && r.display && r.display !== 'inline') tokens.push('anchor-block');

    // Pseudo-elements
    if (r.pseudo) {
      var self = this;
      Object.keys(r.pseudo).forEach(function (ps) {
        var k = ps === '::before' ? 'pb' : 'pa', pd = r.pseudo[ps];
        if (pd.bg) {
          var pc = over(pd.bg, eff), pt = toneOf(pc, control), lv = fillLevel(pc, eff, pt);
          tokens.push(k + ':' + (lv === 0 ? 's0' : (lv === 1 ? 't-' : 'f-') + pt));
        }
        if (pd.line) {
          var lc = over(pd.line, eff), lt = toneOf(lc, control, true), lcc = contrast(lc, eff);
          tokens.push(k + 'l:' + (lt === 'danger' && lcc >= 1.5 ? 'danger' : lt === 'accent' && lcc >= 1.5 ? 'accent' : lcc >= 3 ? 'strong' : 'soft'));
        }
        if (pd.shadow) tokens.push(k + ':shadow');
      });
      void self;
    }

    this.info.set(el, info);
    return tokens.join(' ');
  };

  /* Stroke variant and colour block are assigned once per element, so they never shuffle. */
  Classifier.prototype.stableVariant = function (el) {
    var s = this.stable.get(el) || {};
    if (s.v == null) { s.v = this.variant++ % 2; this.stable.set(el, s); }
    return s.v;
  };
  /* Siblings share one colour field (a grid of cards reads as one block of content);
     each new group takes the next colour. */
  Classifier.prototype.stableBlock = function (el) {
    var s = this.stable.get(el) || {}, group = el.parentElement || el.parentNode;
    if (s.blk == null || s.group !== group) {
      if (!this.blockCount.has(group)) this.blockCount.set(group, (this.nextBlock = (this.nextBlock || 0) + 1) - 1);
      s.blk = this.blockCount.get(group) % 5; s.group = group;
      this.stable.set(el, s);
    }
    return s.blk;
  };

  Classifier.prototype.write = function (el, tokens) {
    var prev = this.tags.get(el);
    if (prev === tokens && el.getAttribute('data-up') === (tokens || null)) return;
    this.tags.set(el, tokens);
    if (tokens) el.setAttribute('data-up', tokens);
    else if (el.hasAttribute('data-up')) el.removeAttribute('data-up');
  };

  /* ------------------------------------------------------------------ *
   * Engine — applies/removes the theme layer and keeps it current.
   * ------------------------------------------------------------------ */

  function Engine(app) {
    this.app = app;
    this.active = null;
    this.style = null;
    this.skipStyle = null;
    this.probe = null;
    this.guard = null;
    this.filters = null;
    this.classifier = new Classifier(this);
    this.observer = null;
    this.shadowRoots = new Set();
    this.shadowSheets = new Map();
    this.pendingRoots = new Set();
    this.pendingNodes = new Set();
    this.workScheduled = false;
    this.exemptSelector = BUILTIN_EXEMPT.join(', ');
    this.includeSelector = '';
    this.roleSelectors = {};
    this.lastCSS = '';
    this.lastSkipCSS = '';
    this.fontsLoaded = {};
    this.exemptRules = [];
    this.exemptCount = 0;
    this.heavy = new WeakSet();
    this.churn = new WeakMap();
  }

  Engine.prototype.configure = function (cfg) {
    var ex = BUILTIN_EXEMPT.concat(cfg.exclude || []);
    this.exemptSelector = ex.join(', ');
    this.includeSelector = (cfg.include || []).join(', ');
    this.overrides = cfg.overrides || {};
    this.webFonts = cfg.webFonts !== false;
    var roles = {};
    Object.keys(cfg.roles || {}).forEach(function (sel) {
      var role = cfg.roles[sel];
      if (/^(surface|fill|media|icon|plain)$/.test(role)) { try { document.querySelector(sel); (roles[role] = roles[role] || []).push(sel); } catch (e) { warn('Ignoring invalid role selector:', sel); } }
    });
    this.roleSelectors = {};
    for (var k in roles) this.roleSelectors[k] = roles[k].join(', ');
  };

  Engine.prototype.forcedRole = function (el) {
    var a = el.getAttribute('data-unpolish-role');
    if (a) return a;
    for (var k in this.roleSelectors) { try { if (el.matches(this.roleSelectors[k])) return k; } catch (e) { /* invalid */ } }
    return null;
  };

  Engine.prototype.isKept = function (el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (el.closest && el.closest(KEEP_SEL)) return true;
      if (this.includeSelector && el.closest && el.closest(this.includeSelector)) return true;
    } catch (e) { return false; }
    return false;
  };

  Engine.prototype.setDisabled = function (off) {
    if (this.style && this.style.sheet) this.style.sheet.disabled = off;
    this.shadowSheets.forEach(function (sheet) { sheet.disabled = off; });
  };

  /* Read original styles for a batch with Unpolish switched off, then tag. */
  Engine.prototype.classify = function (els) {
    var c = this.classifier, eng = this;
    els = (els || []).filter(function (el) { return el && el.isConnected && !eng.inSkipTree(el); });
    var exempts = (c.exemptRoots || []).filter(function (e) { return e.isConnected && !e.hasAttribute('data-unpolish-x') && e.tagName !== 'UNPOLISH-HARNESS' && e !== eng.filters && e !== eng.style; });
    c.exemptRoots = [];
    if (!els.length && !exempts.length) return;
    var sx = window.scrollX, sy = window.scrollY;
    this.setDisabled(true);
    var html = document.documentElement;
    var reads;
    try {
      var bodyCs = getComputedStyle(document.body), htmlCs = getComputedStyle(html);
      var bb = bgOf(bodyCs).color, hb = bgOf(htmlCs).color;
      var page = over(hb.a > 0.01 ? hb : { r: 255, g: 255, b: 255, a: 1 }, { r: 255, g: 255, b: 255, a: 1 });
      c.pageBg = bb.a > 0.01 ? over(bb, page) : page;
      c.pageColor = parseColor(bodyCs.color);
      reads = els.map(function (el) { return c.read(el); });
      // Excluded regions keep the font and colour they would have inherited.
      exempts.forEach(function (el) {
        var par = parentEl(el);
        if (!par) return;
        var pcs = getComputedStyle(par);
        var id = String(++eng.exemptCount);
        el.setAttribute('data-unpolish-x', id);
        eng.exemptRules.push('[data-unpolish-x="' + id + '"]{font-family:' + pcs.fontFamily + ';color:' + pcs.color + '}');
      });
      // Parent chains for dynamic insertions are resolved now, while originals are visible.
      reads.forEach(function (r) { c.parentInfo(r.el); });
    } finally {
      this.setDisabled(false);
    }
    if (window.scrollX !== sx || window.scrollY !== sy) window.scrollTo(sx, sy);
    this.finishClassify(reads, exempts.length);
  };

  /* Mutation-path classify: read original colours without disabling the theme
   * sheet (that restyles the whole page). Clones only this batch into an
   * exempt off-screen probe — skipped maps are never in the batch. */
  Engine.prototype.ensureProbe = function () {
    if (this.probe && this.probe.isConnected) return this.probe;
    var probe = this.probe = document.createElement('div');
    probe.id = 'unpolish-probe';
    probe.setAttribute('data-unpolish-ignore', '');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none';
    (document.body || document.documentElement).appendChild(probe);
    return probe;
  };

  Engine.prototype.classifyLive = function (els) {
    var c = this.classifier, probe = this.ensureProbe();
    els = (els || []).filter(function (el) { return el && el.isConnected; });
    if (!els.length) return;
    var htmlClass = document.documentElement.className || '';
    var bodyClass = (document.body && document.body.className) || '';
    var reads = els.map(function (el) {
      var chain = [];
      for (var n = el; n && n !== document.body && n !== document.documentElement; n = parentEl(n)) chain.unshift(n);
      var wrap = document.createElement('div');
      wrap.className = (htmlClass + ' ' + bodyClass).trim();
      var leaf = wrap;
      chain.forEach(function (orig) {
        var copy = orig.cloneNode(false);
        leaf.appendChild(copy);
        leaf = copy;
      });
      probe.appendChild(wrap);
      var r = c.read(leaf === wrap ? el : leaf);
      probe.removeChild(wrap);
      r.el = el;
      return r;
    });
    reads.forEach(function (r) { c.parentInfo(r.el); });
    this.finishClassify(reads, false);
  };

  Engine.prototype.finishClassify = function (reads, wroteExempt) {
    var c = this.classifier, vw = window.innerWidth, vh = window.innerHeight;
    var rects = reads.map(function (r) { return r.el.getBoundingClientRect(); });
    reads.forEach(function (r, i) {
      if (!r.el.isConnected) return;
      try {
        var tokens = c.decide(r, rects[i], vw, vh);
        c.write(r.el, tokens);
        var bag = c.memo.get(r.el) || Object.create(null);
        bag[attrSig(r.el)] = { tokens: tokens, rect: rects[i], read: r };
        c.memo.set(r.el, bag);
      } catch (e) { warn('classify', e); }
    });
    if (wroteExempt) this.writeExempt();
    if (this.observer) this.observer.takeRecords();
  };

  Engine.prototype.writeExempt = function () {
    if (!this.exemptStyle) {
      this.exemptStyle = document.createElement('style');
      this.exemptStyle.id = 'unpolish-exempt';
      this.exemptStyle.setAttribute('data-unpolish-ignore', '');
    }
    // Normal-importance layered rules: they lose to anything the region declares itself.
    this.exemptStyle.textContent = '@layer unpolish{' + this.exemptRules.join('\n') + '}';
    if (!this.exemptStyle.isConnected && this.style && this.style.isConnected) this.style.after(this.exemptStyle);
  };

  Engine.prototype.fullPass = function () {
    this.classifier.exemptRoots = [];
    var roots = [];
    var els = this.classifier.collect(document.body, [], roots);
    // Keep memo/info across resize so we re-decide from cached reads, not a full reclassify.
    this.retagCached(els);
    if (this.observer) this.observer.takeRecords();
    var self = this;
    roots.forEach(function (r) { self.attachShadow(r); });
  };

  Engine.prototype.retagCached = function (els) {
    var c = this.classifier, vw = window.innerWidth, vh = window.innerHeight, need = [], i;
    for (i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.isConnected) continue;
      var sig = attrSig(el), bag = c.memo.get(el), hit = bag && bag[sig];
      if (hit && hit.read) {
        try {
          var rect = el.getBoundingClientRect();
          var tokens = c.decide(hit.read, rect, vw, vh);
          c.write(el, tokens);
          bag[sig] = { tokens: tokens, rect: rect, read: hit.read };
        } catch (e) { warn('classify', e); }
      } else {
        need.push(el);
      }
    }
    if (need.length) this.classify(need);
  };

  Engine.prototype.attachShadow = function (root) {
    if (this.shadowRoots.has(root) || root === this.app.ui.root) return;
    this.shadowRoots.add(root);
    if (this.observer) this.observer.observe(root, this.observeOpts);
    this.updateShadowSheet(root);
  };

  Engine.prototype.updateShadowSheet = function (root) {
    if (!('adoptedStyleSheets' in root)) return;
    var sheet = this.shadowSheets.get(root);
    if (!sheet) {
      try { sheet = new CSSStyleSheet(); } catch (e) { return; }
      this.shadowSheets.set(root, sheet);
      root.adoptedStyleSheets = root.adoptedStyleSheets.concat([sheet]);
    }
    sheet.replaceSync(this.shadowCSS || '');
  };

  Engine.prototype.ensureNodes = function () {
    var head = document.head || document.documentElement;
    if (!this.style) {
      this.style = document.createElement('style');
      this.style.id = 'unpolish-theme';
      this.style.setAttribute('data-unpolish-ignore', '');
    }
    // First in <head> so the "unpolish" cascade layer is declared first: for
    // !important rules, earlier layers win over later layers and unlayered CSS.
    if (head.firstChild !== this.style) head.insertBefore(this.style, head.firstChild);
    if (!this.skipStyle) {
      this.skipStyle = document.createElement('style');
      this.skipStyle.id = 'unpolish-skip';
      this.skipStyle.setAttribute('data-unpolish-ignore', '');
    }
    if (this.style.nextSibling !== this.skipStyle) this.style.after(this.skipStyle);
    if (!this.filters) {
      var ns = 'http://www.w3.org/2000/svg';
      this.filters = document.createElementNS(ns, 'svg');
      this.filters.setAttribute('id', 'unpolish-filters');
      this.filters.setAttribute('aria-hidden', 'true');
      this.filters.setAttribute('focusable', 'false');
      this.filters.setAttribute('data-unpolish-ignore', '');
      this.filters.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;left:-9999px;top:0');
    }
    if (!this.filters.isConnected) document.body.appendChild(this.filters);
  };

  Engine.prototype.suppressTransitions = function () {
    var self = this;
    if (!this.guard) {
      this.guard = document.createElement('style');
      this.guard.id = 'unpolish-guard';
      this.guard.setAttribute('data-unpolish-ignore', '');
      this.guard.textContent = 'html *, html *::before, html *::after { transition: none !important; }';
    }
    (document.head || document.documentElement).appendChild(this.guard);
    clearTimeout(this.guardTimer);
    raf(function () { raf(function () { self.guardTimer = setTimeout(function () { if (self.guard) self.guard.remove(); }, 30); }); });
  };

  Engine.prototype.loadFont = function (typ) {
    if (!this.webFonts || !WEB_FONTS[typ] || this.fontsLoaded[typ]) return;
    this.fontsLoaded[typ] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?' + WEB_FONTS[typ] + '&display=swap';
    l.setAttribute('data-unpolish-ignore', '');
    l.setAttribute('data-unpolish-font', typ);
    (document.head || document.documentElement).appendChild(l);
  };

  Engine.prototype.apply = function (id, settings) {
    var html = document.documentElement;
    if (id === 'original' || !THEMES[id]) { this.teardown(); return; }
    var first = !this.active;
    var changedTheme = this.active !== id;
    this.ensureNodes();
    var v = derive(id, settings);
    this.loadFont(v.typography);
    var css = buildCSS(v, { exempt: this.exemptSelector, include: this.includeSelector, overrides: this.overrides });
    var skipCss = buildSkipCSS(v, { exempt: this.exemptSelector, include: this.includeSelector });
    this.shadowCSS = buildCSS(v, { exempt: this.exemptSelector, include: this.includeSelector, shadow: true }) +
      buildSkipCSS(v, { exempt: this.exemptSelector, include: this.includeSelector, shadow: true });
    if (changedTheme) this.suppressTransitions();
    if (css !== this.lastCSS) { this.style.textContent = css; this.lastCSS = css; }
    if (skipCss !== this.lastSkipCSS) { this.skipStyle.textContent = skipCss; this.lastSkipCSS = skipCss; }
    var fx = buildFilters(v);
    if (this.filters.innerHTML !== fx) this.filters.innerHTML = fx;
    var self = this;
    this.shadowRoots.forEach(function (r) { self.updateShadowSheet(r); });
    this.active = id;
    if (first) {
      html.setAttribute('data-unpolish', id);
      this.fullPass();
      this.observe();
    }
    if (html.getAttribute('data-unpolish') !== id) html.setAttribute('data-unpolish', id);
  };

  Engine.prototype.teardown = function () {
    if (!this.active) return;
    this.suppressTransitions();
    this.active = null;
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    this.pendingRoots.clear();
    this.pendingNodes.clear();
    this.workScheduled = false;
    document.documentElement.removeAttribute('data-unpolish');
    if (this.style) this.style.remove();
    if (this.skipStyle) this.skipStyle.remove();
    this.lastSkipCSS = '';
    if (this.probe) this.probe.remove();
    if (this.filters) this.filters.remove();
    if (this.exemptStyle) this.exemptStyle.remove();
    this.exemptRules = [];
    this.lastCSS = '';
    var self = this;
    this.shadowSheets.forEach(function (sheet, root) {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter(function (s) { return s !== sheet; });
    });
    this.shadowSheets.clear();
    this.shadowRoots.clear();
    function strip(root) {
      var nodes = root.querySelectorAll('[data-up], [data-unpolish-x], [data-unpolish-skip]');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].removeAttribute('data-up');
        nodes[i].removeAttribute('data-unpolish-x');
        nodes[i].removeAttribute('data-unpolish-skip');
      }
      var all = root.querySelectorAll('*');
      for (var j = 0; j < all.length; j++) if (all[j].shadowRoot) strip(all[j].shadowRoot);
    }
    strip(document);
    this.classifier = new Classifier(this);
    void self;
  };

  var ATTRS = ['class', 'style', 'open', 'hidden', 'disabled', 'checked', 'selected', 'aria-selected', 'aria-current', 'aria-pressed', 'aria-checked', 'aria-expanded', 'aria-invalid', 'aria-disabled', 'aria-busy', 'data-state', 'data-active', 'data-selected', 'data-highlighted', 'data-disabled', 'data-up', 'data-unpolish', 'data-unpolish-role'];

  Engine.prototype.isOwnNode = function (el) {
    if (!el || el.nodeType !== 1) return true;
    if (el === this.style || el === this.skipStyle || el === this.filters || el === this.guard || el === this.exemptStyle || el === this.probe) return true;
    if (el.id && el.id.indexOf('unpolish-') === 0) return true;
    if (el.tagName === 'UNPOLISH-HARNESS') return true;
    return !!(el.closest && el.closest('unpolish-harness, #unpolish-filters, #unpolish-theme, #unpolish-skip, #unpolish-guard, #unpolish-exempt, #unpolish-probe'));
  };

  Engine.prototype.inExemptTree = function (el) {
    if (!el || el.nodeType !== 1) return true;
    try { return !!(el.closest && el.closest(this.exemptSelector)); } catch (e) { return false; }
  };

  Engine.prototype.inSkipTree = function (el) {
    if (!el || el.nodeType !== 1) return false;
    if (this.isKept(el)) return false;
    var tag = el.tagName;
    if (MEDIA_LEAF[tag] || /^GMP-/.test(tag)) return true;
    if (el instanceof SVGElement && tag !== 'svg' && tag !== 'SVG') return true;
    try {
      if (el.closest && el.closest(MAP_WIDGET_SEL + ', [data-unpolish-skip], ' + SKIP_MEDIA_SEL)) return true;
    } catch (e) { return false; }
    return false;
  };

  Engine.prototype.noteChurn = function (el) {
    if (!el || this.isKept(el) || this.inExemptTree(el)) return;
    var t = now(), node = el, depth = 0;
    while (node && node !== document.body && depth < 6) {
      if (node.childElementCount >= 40 && absMajority(node)) {
        var rec = this.churn.get(node);
        if (!rec || t - rec.at > CHURN_WINDOW_MS) rec = { at: t, n: 0 };
        rec.n++;
        this.churn.set(node, rec);
        if (rec.n >= CHURN_MARK_MIN) {
          this.heavy.add(node);
          this.classifier.markSkip(node, 'heavy');
        }
      }
      node = parentEl(node);
      depth++;
    }
  };

  Engine.prototype.scheduleFullPass = function () {
    var self = this;
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(function () { if (self.active) self.fullPass(); }, 250);
  };

  Engine.prototype.scheduleWork = function () {
    if (this.workScheduled) return;
    this.workScheduled = true;
    var self = this;
    scheduleIdle(function () { self.flushWork(); });
  };

  Engine.prototype.queueRoot = function (el) {
    if (!el || el.nodeType !== 1 || !el.isConnected) return;
    if (this.isOwnNode(el) || this.inExemptTree(el) || this.inSkipTree(el)) return;
    this.pendingRoots.add(el);
    this.scheduleWork();
  };

  Engine.prototype.queueNode = function (el) {
    if (!el || el.nodeType !== 1 || !el.isConnected) return;
    if (this.isOwnNode(el) || this.inExemptTree(el) || this.inSkipTree(el)) return;
    this.pendingNodes.add(el);
    this.scheduleWork();
  };

  Engine.prototype.observe = function () {
    var self = this;
    this.observeOpts = { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS, attributeOldValue: true };
    this.observer = new MutationObserver(function (recs) { self.onMutations(recs); });
    this.observer.observe(document.documentElement, this.observeOpts);
    this.shadowRoots.forEach(function (r) { self.observer.observe(r, self.observeOpts); });
    if (!this.eventsBound) {
      this.eventsBound = true;
      // :checked / :has() driven styles don't touch attributes — recheck the surrounding group.
      var recheck = function (e) {
        if (!self.active) return;
        var t = e.composedPath ? e.composedPath()[0] : e.target;
        if (!t || !t.closest) return;
        var group = t.closest('form, fieldset, [role="radiogroup"], [role="group"], [role="tablist"], [role="listbox"], [role="menu"], label, li, tr') || t.parentElement;
        if (group) self.queueAttr(group, true);
      };
      document.addEventListener('change', recheck, true);
      document.addEventListener('click', function (e) { raf(function () { recheck(e); }); }, true);
      window.addEventListener('resize', function () {
        if (!self.active) return;
        self.scheduleFullPass();
      });
    }
  };

  Engine.prototype.queueAttr = function (el, subtree) {
    if (subtree) this.queueRoot(el);
    else this.queueNode(el);
  };

  Engine.prototype.flushWork = function () {
    this.workScheduled = false;
    if (!this.active) {
      this.pendingRoots.clear();
      this.pendingNodes.clear();
      return;
    }
    var roots = this.pendingRoots;
    var nodes = this.pendingNodes;
    this.pendingRoots = new Set();
    this.pendingNodes = new Set();
    var list = [], seen = new Set(), shadowRoots = [], self = this;

    roots.forEach(function (el) {
      if (!el.isConnected || self.isOwnNode(el) || self.inExemptTree(el) || self.inSkipTree(el)) return;
      var p = parentEl(el);
      while (p && p !== document.documentElement && p !== document.body) {
        if (roots.has(p)) return;
        p = parentEl(p);
      }
      self.classifier.collect(el, list, shadowRoots);
    });
    list.forEach(function (el) { seen.add(el); });
    nodes.forEach(function (el) {
      if (!el.isConnected || seen.has(el) || self.isOwnNode(el) || self.inExemptTree(el) || self.inSkipTree(el)) return;
      var p = parentEl(el), covered = false;
      while (p && p !== document.documentElement) {
        if (roots.has(p) || seen.has(p)) { covered = true; break; }
        p = parentEl(p);
      }
      if (covered) return;
      seen.add(el);
      list.push(el);
    });
    list = list.filter(function (el) { return el.isConnected && !self.isOwnNode(el) && !self.inExemptTree(el) && !self.inSkipTree(el); });
    list.sort(function (a, b) { return a === b ? 0 : (a.compareDocumentPosition(b) & 4 ? -1 : 1); });
    this.flushClassify(list, 0, shadowRoots, now());
  };

  Engine.prototype.flushClassify = function (list, start, shadowRoots, t0) {
    this.workScheduled = false;
    if (!this.active) return;
    var need = [], i = start, c = this.classifier, self = this;
    var vw = window.innerWidth, vh = window.innerHeight;
    for (; i < list.length; i++) {
      var el = list[i];
      if (!el.isConnected || self.isOwnNode(el) || self.inExemptTree(el) || self.inSkipTree(el)) continue;
      if ((need.length && now() - t0 >= WORK_BUDGET_MS) || need.length >= BATCH_MAX) {
        this.workScheduled = true;
        scheduleIdle(function () { self.flushClassify(list, i, shadowRoots, now()); });
        this.tagBatch(need, shadowRoots, true);
        return;
      }
      var sig = attrSig(el), bag = c.memo.get(el), hit = bag && bag[sig];
      if (hit && hit.read) {
        if (now() - t0 >= WORK_BUDGET_MS && i > start) {
          this.workScheduled = true;
          scheduleIdle(function () { self.flushClassify(list, i, shadowRoots, now()); });
          this.tagBatch(need, shadowRoots, true);
          return;
        }
        var tagged = c.tags.get(el);
        var cached = hit.rect;
        var tiny = !cached || cached.width < 10 || cached.height < 10;
        if (!tiny && tagged === hit.tokens) continue;
        var rect = el.getBoundingClientRect();
        if (!tiny && cached && Math.abs(rect.width - cached.width) < 1 && Math.abs(rect.height - cached.height) < 1) {
          if (tagged !== hit.tokens) c.write(el, hit.tokens);
          continue;
        }
        try {
          var tokens = c.decide(hit.read, rect, vw, vh);
          if (tagged !== tokens) c.write(el, tokens);
          bag[sig] = { tokens: tokens, rect: rect, read: hit.read };
        } catch (e) { warn('classify', e); }
        continue;
      }
      need.push(el);
    }
    this.tagBatch(need, shadowRoots, false);
  };

  Engine.prototype.tagBatch = function (need, shadowRoots, moreComing) {
    // Read the whole batch, then write. No clone-and-measure, no per-element insert.
    if (need && need.length) this.classifyLive(need);
    if ((this.classifier.exemptRoots || []).length) this.classify([]);
    if (moreComing) return;
    var eng = this;
    shadowRoots.forEach(function (r) { eng.attachShadow(r); });
    if (this.pendingRoots.size || this.pendingNodes.size) this.scheduleWork();
  };

  Engine.prototype.onMutations = function (recs) {
    if (!this.active) return;
    var html = document.documentElement;
    for (var i = 0; i < recs.length; i++) {
      var rec = recs[i], t = rec.target;
      if (t.nodeType === 1 && this.isOwnNode(t)) continue;
      if (rec.type === 'childList') {
        if (t.nodeType === 1 && (MEDIA_LEAF[t.tagName] || this.inSkipTree(t))) continue;
        for (var j = 0; j < rec.addedNodes.length; j++) {
          var n = rec.addedNodes[j];
          if (n.nodeType !== 1 || SKIP[n.tagName]) continue;
          if (this.isOwnNode(n)) continue;
          if (this.inExemptTree(n)) {
            try {
              if (n.matches(this.exemptSelector) && n.parentElement && !this.inExemptTree(n.parentElement)) {
                (this.classifier.exemptRoots = this.classifier.exemptRoots || []).push(n);
                this.scheduleWork();
              }
            } catch (e) { /* invalid */ }
            continue;
          }
          if (this.classifier.isSkipRoot(n)) {
            this.classifier.markSkip(n);
            continue;
          }
          if (this.inSkipTree(n)) continue;
          if (n.getRootNode && n.getRootNode() instanceof ShadowRoot && n.getRootNode() === this.app.ui.root) continue;
          this.noteChurn(n);
          this.queueRoot(n);
        }
        if (t === document.head || t === html) {
          if (this.style && !this.style.isConnected) this.ensureNodes();
        }
        if (this.filters && !this.filters.isConnected && document.body) document.body.appendChild(this.filters);
      } else if (rec.type === 'attributes') {
        var name = rec.attributeName;
        if (t === html && name === 'data-unpolish') {
          if (html.getAttribute('data-unpolish') !== this.active) html.setAttribute('data-unpolish', this.active);
          continue;
        }
        if (name === 'data-up' || name === 'data-unpolish-x' || name === 'data-unpolish-skip') continue;
        if (t === html || t === document.body) {
          if (name === 'class' || name === 'data-state') this.scheduleFullPass();
          continue;
        }
        if (this.inExemptTree(t) || this.inSkipTree(t) || MEDIA_LEAF[t.tagName]) continue;
        if (name === 'style' && !styleAffectsTheme(rec.oldValue, t.getAttribute('style'))) continue;
        this.noteChurn(t);
        if (this.inSkipTree(t)) continue;
        this.queueAttr(t, name === 'class' || name === 'open' || name === 'hidden' || name === 'data-state');
      }
    }
  };

  /* ------------------------------------------------------------------ *
   * Shortcuts
   * ------------------------------------------------------------------ */

  var CODE_KEYS = { Backslash: '\\', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`' };

  function comboFromEvent(e) {
    var key = e.key;
    if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
    else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
    else if ((e.altKey || e.shiftKey) && CODE_KEYS[e.code]) key = CODE_KEYS[e.code];
    else if (key && key.length === 1) key = key.toUpperCase();
    if (key === ' ') key = 'Space';
    var mods = [];
    if (e.ctrlKey && !(e.getModifierState && e.getModifierState('AltGraph'))) mods.push('Ctrl');
    if (e.altKey && !(e.getModifierState && e.getModifierState('AltGraph'))) mods.push('Alt');
    if (e.shiftKey && !(key.length === 1 && !/[A-Z0-9]/.test(key) && !e.altKey && !e.ctrlKey && !e.metaKey && CODE_KEYS[e.code] !== key)) mods.push('Shift');
    if (e.metaKey) mods.push('Meta');
    return mods.concat([key]).join('+');
  }
  function normCombo(s) {
    if (!s) return '';
    var parts = String(s).split('+').map(function (p) { return p.trim(); }).filter(Boolean);
    if (!parts.length && s.indexOf('+') >= 0) parts = ['+'];
    var key = parts.pop();
    if (key.length === 1) key = key.toUpperCase();
    var map = { control: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', option: 'Alt', opt: 'Alt', shift: 'Shift', meta: 'Meta', cmd: 'Meta', command: 'Meta', super: 'Meta' };
    var mods = parts.map(function (m) { return map[m.toLowerCase()] || m; });
    var order = ['Ctrl', 'Alt', 'Shift', 'Meta'];
    mods = order.filter(function (m) { return mods.indexOf(m) >= 0; });
    return mods.concat([key]).join('+');
  }
  function matchCombo(e, binding) {
    var b = normCombo(binding);
    if (!b) return false;
    var c = comboFromEvent(e);
    if (c === b) return true;
    // Single-character bindings also match by produced character (non-US layouts).
    if (b.length === 1 && e.key === b && !e.ctrlKey && !e.metaKey && !(e.altKey && !(e.getModifierState && e.getModifierState('AltGraph')))) return true;
    return false;
  }
  function prettyCombo(s) {
    var b = normCombo(s);
    if (!b) return '';
    return b.split('+').map(function (p) {
      if (isMac) return { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' }[p] || p;
      return { Meta: 'Win' }[p] || p;
    }).join(isMac ? '' : '+');
  }
  var RESERVED_ALT = { D: 1, F: 1, E: 1, Home: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1, Tab: 1, F4: 1, Enter: 1 };
  function checkCombo(combo) {
    var parts = combo.split('+'), key = parts[parts.length - 1], mods = parts.slice(0, -1);
    if (/^(Control|Alt|Shift|Meta|AltGraph|CapsLock|Fn|OS)$/.test(key)) return { pending: true };
    if (mods.indexOf('Ctrl') >= 0 || mods.indexOf('Meta') >= 0) return { error: (isMac ? '⌘ and ⌃' : 'Ctrl and Win') + ' shortcuts belong to the browser and system.' };
    if (/^(Tab|Enter|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|PageUp|PageDown|Home|End|Backspace|Delete|Insert|ContextMenu)$/.test(key)) return { error: 'That key is needed for navigation and typing.' };
    if (/^F(1|3|5|6|7|11|12)$/.test(key)) return { error: key + ' is used by the browser.' };
    if (mods.indexOf('Alt') >= 0 && RESERVED_ALT[key]) return { error: 'Alt+' + key + ' is used by browsers on Windows and Linux.' };
    if (!mods.length && /^[0-4]$/.test(key)) return { error: '0–4 already pick themes while the panel is open.' };
    if (mods.length === 1 && mods[0] === 'Shift' && key.length === 1 && /[A-Z]/.test(key)) return { warn: 'Shift+letter can clash with typing shortcuts in your prototype.' };
    if (!mods.length && key.length === 1) return { warn: 'Single keys may clash with shortcuts in your prototype.' };
    return {};
  }
  function isTyping(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable) return true;
    var tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') return !/^(checkbox|radio|range|button|submit|reset|color|file|image)$/i.test(t.type || 'text');
    var role = t.getAttribute('role');
    return role === 'textbox' || role === 'searchbox' || role === 'combobox' || role === 'spinbutton';
  }

  /* ------------------------------------------------------------------ *
   * Panel UI (shadow DOM, isolated from host styles)
   * ------------------------------------------------------------------ */

  var ICONS = {
    mark: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.75" y="2.75" width="18.5" height="18.5" rx="6" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 13.6c1.3-2.3 2.4-2.6 3.4-.9.9 1.6 1.9 1.7 3.1-.2 1.1-1.7 2.2-2 4.5-.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    chev: '<svg viewBox="0 0 16 16" aria-hidden="true" class="chev"><path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    link: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.8 9.2l2.4-2.4M7.4 4.6l.9-.9a2.6 2.6 0 013.7 3.7l-.9.9M8.6 11.4l-.9.9A2.6 2.6 0 014 8.6l.9-.9" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="7.5" height="7.5" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10.5 3.6V3.5A1.5 1.5 0 009 2H4a1.5 1.5 0 00-1.5 1.5V9A1.5 1.5 0 004 10.5h.1" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
    reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 105-5c-1.6 0-2.9.7-3.8 1.8M3.5 2.5v2.6h2.6" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    keys: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="4" width="12.5" height="8" rx="2" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M4.5 6.8h.01M7 6.8h.01M9.5 6.8h.01M12 6.8h.01M5 9.4h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 4L5.5 8l4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function preview(id, s) {
    var W = 56, H = 38;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" preserveAspectRatio="xMidYMid slice">';
    if (id === 'original') {
      svg += '<defs><linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1ff"/><stop offset="1" stop-color="#fdeef6"/></linearGradient></defs>' +
        '<rect width="56" height="38" fill="url(#og)"/><rect x="8" y="7" width="40" height="25" rx="5" fill="#fff" filter="drop-shadow(0 1px 2px rgba(60,60,120,.18))"/>' +
        '<rect x="13" y="12" width="18" height="3" rx="1.5" fill="#1f2340"/><rect x="13" y="18" width="26" height="2.2" rx="1.1" fill="#a3a8c3"/><rect x="13" y="24" width="12" height="4.5" rx="2.25" fill="#6c5cff"/>';
    } else {
      var p = s.palette, v = derive(id, s, true);
      var stroke = v.strokeStyle === 'none' ? 'none' : v.line, sw = Math.max(0.8, Math.min(1.6, v.stroke));
      var rad = v.radius == null ? 4 : Math.min(6, v.radius / 2);
      svg += '<rect width="56" height="38" fill="' + p.paper + '"/>';
      if (id === 'blueprint' && s.details > 0) {
        for (var gx = 0; gx <= 56; gx += 7) svg += '<path d="M' + gx + ' 0V38" stroke="' + v.line + '" stroke-opacity="0.16" stroke-width="0.5"/>';
        for (var gy = 0; gy <= 38; gy += 7) svg += '<path d="M0 ' + gy + 'H56" stroke="' + v.line + '" stroke-opacity="0.16" stroke-width="0.5"/>';
      }
      var cardFill = id === 'pastel' ? v.blocks[0] : v.surface;
      if (v.strokeStyle === 'hand') {
        var amp = 0.2 + v.r * 0.9;
        svg += '<rect x="8" y="7" width="40" height="25" rx="' + rad + '" fill="' + cardFill + '"/>' +
          '<path d="' + wobble(40, 0, amp, 3) + '" transform="translate(8 7)" stroke="' + stroke + '" stroke-width="' + sw + '" fill="none" stroke-linecap="round"/>' +
          '<path d="' + wobble(40, 0, amp, 9) + '" transform="translate(8 32)" stroke="' + stroke + '" stroke-width="' + sw + '" fill="none" stroke-linecap="round"/>' +
          '<path d="' + wobble(25, 0, amp, 4) + '" transform="matrix(0 1 1 0 8 7)" stroke="' + stroke + '" stroke-width="' + sw + '" fill="none" stroke-linecap="round"/>' +
          '<path d="' + wobble(25, 0, amp, 8) + '" transform="matrix(0 1 1 0 48 7)" stroke="' + stroke + '" stroke-width="' + sw + '" fill="none" stroke-linecap="round"/>';
      } else {
        svg += '<rect x="8.5" y="7.5" width="39" height="24" rx="' + rad + '" fill="' + cardFill + '" stroke="' + stroke + '" stroke-width="' + (stroke === 'none' ? 0 : sw) + '"' + (v.strokeStyle === 'dashed' ? ' stroke-dasharray="3 2"' : '') + '/>';
      }
      if (id === 'blueprint' && s.details > 0) svg += '<path d="M10 13V9.5h3.5M46 13V9.5h-3.5M10 26v3.5h3.5M46 26v3.5h-3.5" stroke="' + v.line + '" stroke-width="0.7" fill="none"/>';
      svg += '<rect x="13" y="12" width="18" height="3" rx="' + (id === 'pastel' ? 1.5 : 0.5) + '" fill="' + v.ink + '"/>' +
        '<rect x="13" y="18" width="26" height="2" rx="' + (id === 'pastel' ? 1 : 0.5) + '" fill="' + v.muted + '" fill-opacity="0.7"/>';
      var bFill = v.tones.accent.fill;
      svg += '<rect x="13" y="23.5" width="13" height="5" rx="' + Math.min(2.5, rad) + '" fill="' + bFill + '"' + (v.fillRing && stroke !== 'none' ? ' stroke="' + v.line + '" stroke-width="0.8"' : '') + '/>';
      if (id === 'pastel') svg += '<rect x="30" y="23.5" width="13" height="5" rx="2.5" fill="' + v.blocks[2] + '"/>';
      if (id === 'black-white' && s.details > 0) svg += '<rect x="30" y="23.5" width="13" height="5" fill="none" stroke="' + v.ink + '" stroke-width="0.8"/><path d="M31 28.5l4-5M34 28.5l4-5M37 28.5l4-5M40 28.5l3-3.7" stroke="' + v.ink + '" stroke-width="0.5"/>';
    }
    return svg + '</svg>';
  }

  var PANEL_CSS = [
    // !important inside a shadow tree beats the page's !important on the host, so page CSS can't reach in.
    ':host{all:initial!important;display:contents!important}',
    ':host{--bg:#141416;--bg2:#1d1d21;--bg3:#26262b;--bg4:#303036;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);--text:#f4f4f5;--text2:#b8b8c0;--text3:#8f8f98;--accent:#e6f36a;--accent-ink:#151515;--warn:#ffcf6e;--ease:cubic-bezier(0.23,1,0.32,1);',
    '}',
    '.launcher,.panel,.hud{font:500 12.5px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;letter-spacing:0;text-align:left;text-transform:none;word-spacing:normal;visibility:visible}',
    '*,*::before,*::after{box-sizing:border-box}',
    '[hidden]{display:none!important}',
    'button,input,select{font:inherit;color:inherit;margin:0}',
    'button{cursor:pointer;background:none;border:0;padding:0;-webkit-tap-highlight-color:transparent}',
    'svg{display:block}',
    ':focus{outline:none}',
    ':focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
    'kbd{font:600 10.5px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:5px;background:var(--bg3);color:var(--text2);box-shadow:inset 0 -1px 0 rgba(0,0,0,.35)}',
    // launcher
    // .vp tracks the visual viewport, so the controls stay reachable even when the host page overflows on mobile.
    '.vp{position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646}',
    '.vp>*{pointer-events:auto}',
    '.launcher{position:absolute;z-index:1;width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:var(--bg);color:var(--text);box-shadow:0 0 0 1px var(--line2),0 8px 24px rgba(0,0,0,.28);opacity:.62;transition:opacity 150ms ease,transform 160ms var(--ease);touch-action:manipulation}',
    '.launcher svg{width:20px;height:20px}',
    '.launcher:active{transform:scale(.95)}',
    '.launcher[aria-expanded="true"],.launcher:focus-visible{opacity:1}',
    '@media (hover:hover) and (pointer:fine){.launcher:hover{opacity:1}}',
    '.launcher .dot{position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2px var(--bg)}',
    // panel
    '.panel{position:absolute;z-index:2;width:312px;max-width:calc(100% - 16px);max-height:calc(100% - 24px);overflow:auto;overscroll-behavior:contain;background:var(--bg);border-radius:22px;box-shadow:0 0 0 1px var(--line2),0 24px 60px -12px rgba(0,0,0,.55),0 8px 20px rgba(0,0,0,.25);padding:6px 12px 10px;transform-origin:var(--origin,bottom right);scrollbar-width:thin;scrollbar-color:var(--bg4) transparent}',
    '.panel.anim{transition:opacity 180ms var(--ease),transform 180ms var(--ease)}',
    '.panel.anim-out{transition:opacity 130ms var(--ease),transform 130ms var(--ease)}',
    '.panel.from{opacity:0;transform:scale(.96)}',
    '.panel.to-out{opacity:0;transform:scale(.98)}',
    '.head{display:flex;align-items:center;gap:8px;height:42px;margin:0 -2px 4px;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}',
    '.head.dragging{cursor:grabbing}',
    '.brand{display:flex;align-items:center;gap:7px;font-weight:650;font-size:13.5px;letter-spacing:-.01em}',
    '.brand svg{width:18px;height:18px;color:var(--accent)}',
    '.source{margin-left:auto;font-size:11px;font-weight:600;color:var(--text2);background:var(--bg2);border-radius:999px;padding:3px 8px 3px 7px;display:inline-flex;align-items:center;gap:5px;transition:color 150ms ease,background-color 150ms ease}',
    '.source::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--text3)}',
    '.source[data-kind="draft"]{color:var(--warn)}.source[data-kind="draft"]::before{background:var(--warn)}',
    '.source[data-kind="review"]{color:var(--accent)}.source[data-kind="review"]::before{background:var(--accent)}',
    '.icon-btn{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:var(--text2);transition:background-color 150ms ease,color 150ms ease,transform 160ms var(--ease)}',
    '.icon-btn svg{width:14px;height:14px}',
    '.icon-btn:active{transform:scale(.95)}',
    '@media (hover:hover) and (pointer:fine){.icon-btn:hover{background:var(--bg2);color:var(--text)}}',
    '.banner{display:flex;align-items:center;gap:8px;margin:0 0 8px;padding:8px 10px;border-radius:12px;background:rgba(230,243,106,.08);color:var(--text2);font-size:11.5px}',
    '.banner b{color:var(--accent);font-weight:600}',
    '.banner button{margin-left:auto;color:var(--text);font-weight:600;padding:3px 8px;border-radius:7px;background:var(--bg3)}',
    // theme tiles
    '.themes{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px}',
    '.tile{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:5px;padding:4px 4px 6px;border-radius:14px;background:var(--bg2);text-align:center;transition:background-color 150ms ease,box-shadow 150ms ease,transform 160ms var(--ease)}',
    '.tile:active{transform:scale(.97)}',
    '@media (hover:hover) and (pointer:fine){.tile:hover{background:var(--bg3)}}',
    '.tile .pv{display:block;border-radius:10px;overflow:hidden;aspect-ratio:56/38;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}',
    '.tile .pv svg{width:100%;height:100%}',
    '.tile .nm{font-size:10.5px;font-weight:600;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color 150ms ease}',
    '.tile kbd{position:absolute;top:7px;left:7px;min-width:14px;height:14px;font-size:9px;padding:0 3px;border-radius:4px;background:rgba(20,20,22,.62);color:#fff;box-shadow:none;opacity:0;transition:opacity 150ms ease}',
    '.tile:focus-visible{outline-offset:1px}',
    '.panel[data-keys="1"] .tile kbd{opacity:1}',
    '.tile[aria-checked="true"]{background:var(--bg3);box-shadow:inset 0 0 0 1.5px var(--accent)}',
    '.tile[aria-checked="true"] .nm{color:var(--text)}',
    // fields
    '.group{background:var(--bg2);border-radius:14px;padding:10px 12px;margin-bottom:8px}',
    '.row{display:flex;align-items:center;gap:8px}',
    '.label{font-weight:600;color:var(--text)}',
    '.hint{color:var(--text3);font-size:11px;font-weight:500}',
    '.val{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--text2);font-weight:600;min-width:2.5ch;text-align:right}',
    'input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:24px;background:transparent;cursor:pointer;margin:2px 0 -4px;touch-action:pan-y}',
    'input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:linear-gradient(90deg,var(--accent) 0 var(--p,50%),var(--bg4) var(--p,50%) 100%)}',
    'input[type=range]::-moz-range-track{height:6px;border-radius:999px;background:var(--bg4)}',
    'input[type=range]::-moz-range-progress{height:6px;border-radius:999px;background:var(--accent)}',
    'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-6px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(0,0,0,.25),0 1px 3px rgba(0,0,0,.4);transition:transform 120ms var(--ease)}',
    'input[type=range]::-moz-range-thumb{width:18px;height:18px;border:0;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(0,0,0,.25)}',
    'input[type=range]:active::-webkit-slider-thumb{transform:scale(1.08)}',
    'input[type=range]:disabled{opacity:.35;cursor:not-allowed}',
    'input[type=range]:focus-visible{outline:none}',
    'input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px var(--accent)}',
    'input[type=range]:focus-visible::-moz-range-thumb{box-shadow:0 0 0 3px var(--accent)}',
    '.actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}',
    '.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 12px;border-radius:11px;background:var(--bg2);font-weight:600;color:var(--text);white-space:nowrap;transition:background-color 150ms ease,color 150ms ease,transform 160ms var(--ease)}',
    '.btn svg{width:14px;height:14px;flex:none}',
    '.btn:active{transform:scale(.97)}',
    '.btn:disabled{opacity:.4;cursor:not-allowed;transform:none}',
    '@media (hover:hover) and (pointer:fine){.btn:not(:disabled):hover{background:var(--bg3)}}',
    '.btn.primary{background:var(--accent);color:var(--accent-ink)}',
    '@media (hover:hover) and (pointer:fine){.btn.primary:not(:disabled):hover{background:#f0fb84}}',
    '.btn.ghost{background:transparent;color:var(--text2)}',
    '.btn.small{height:28px;padding:0 9px;border-radius:9px;font-size:11.5px}',
    '.btn .chev{transition:transform 200ms var(--ease)}',
    '.btn[aria-expanded="true"] .chev{transform:rotate(180deg)}',
    '.btn .swap{display:inline-flex;align-items:center;gap:6px}',
    '.btn .ok{color:var(--accent)}',
    '.btn.primary .ok{color:var(--accent-ink)}',
    // collapsible
    '.collapse{overflow:hidden}',
    '.collapse.anim{transition:height 200ms var(--ease),opacity 200ms var(--ease)}',
    '.note{border-radius:12px;padding:10px 11px;margin:0 0 8px;background:rgba(255,207,110,.08);color:#f3dfb4;font-size:11.5px;line-height:1.45}',
    '.note b{color:var(--warn);font-weight:650}',
    '.note .row{margin-top:8px;gap:6px}',
    '.share{display:flex;flex-direction:column;gap:10px}',
    '.share .note{margin:0}',
    '.share .footer-actions{margin-top:0}',
    '.pill{margin-left:auto;font-size:11px;font-weight:600;color:var(--text);background:var(--bg4);border-radius:999px;padding:3px 9px}',
    '.desc{margin:0;color:var(--text2);font-size:11.5px;line-height:1.45}',
    '.check{display:flex;align-items:center;gap:8px;color:var(--text2);font-size:11.5px;font-weight:500;cursor:pointer;margin:0}',
    '.check input{appearance:none;-webkit-appearance:none;width:16px;height:16px;border-radius:5px;background:var(--bg3);box-shadow:inset 0 0 0 1px var(--line2);display:grid;place-items:center;cursor:pointer;transition:background-color 120ms ease}',
    '.check input:checked{background:var(--accent);box-shadow:none}',
    '.check input:checked::after{content:"";width:8px;height:4px;border:solid var(--accent-ink);border-width:0 0 2px 2px;transform:translateY(-1px) rotate(-45deg)}',
    // editor
    '.editor{padding:2px 12px}',
    '.sec{border-top:1px solid var(--line)}',
    '.sec:first-child{border-top:0}',
    '.sec>summary,.more>summary{list-style:none;display:flex;align-items:center;gap:8px;cursor:pointer;-webkit-user-select:none;user-select:none}',
    '.sec>summary::-webkit-details-marker,.more>summary::-webkit-details-marker{display:none}',
    '.sec>summary{min-height:42px;font-weight:600;color:var(--text);border-radius:8px}',
    '.sec>summary .hint{margin-left:auto}',
    '.sec>summary .chev,.more>summary .chev{width:14px;height:14px;color:var(--text2);flex:none;transition:transform 200ms var(--ease)}',
    '.sec>summary span:first-child+ .chev{margin-left:auto}',
    '.sec[open]>summary .chev,.more[open]>summary .chev{transform:rotate(180deg)}',
    '.sec-body{padding:0 0 14px;display:flex;flex-direction:column;gap:10px}',
    '.sub{font-size:11px;font-weight:600;color:var(--text2);margin-top:2px}',
    '.details-row{padding:12px 0 10px;border-bottom:1px solid var(--line)}',
    '.details-row .label{font-weight:600}',
    '.stack{display:flex;flex-direction:column;gap:8px}',
    '.more>summary{font-size:11.5px;font-weight:600;color:var(--text2);padding:4px 0}',
    '.more[open]>summary{margin-bottom:10px}',
    '.editor-actions{position:sticky;bottom:-10px;margin:0 -12px;padding:10px 12px 12px;background:var(--bg2);border-top:1px solid var(--line);border-radius:0 0 14px 14px}',
    '.swatches{display:grid;grid-template-columns:repeat(5,1fr);gap:8px 6px}',
    '.sw{display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;color:var(--text2);font-size:10.5px;font-weight:600}',
    '.sw span.c{width:28px;height:28px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 0 0 3px var(--bg2);transition:transform 160ms var(--ease)}',
    '.sw input{position:absolute;inset:0 0 auto 50%;width:28px;height:28px;transform:translateX(-50%);opacity:0;cursor:pointer;border:0;padding:0}',
    '.sw:focus-within span.c{box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 0 0 2px var(--bg2),0 0 0 4px var(--accent)}',
    '.sw:active span.c{transform:scale(.95)}',
    '.seg{display:flex;background:var(--bg);border-radius:10px;padding:2px;gap:2px}',
    '.seg button{flex:1 1 auto;min-width:0;height:26px;border-radius:8px;color:var(--text2);font-size:11px;font-weight:600;white-space:nowrap;padding:0 5px;transition:background-color 150ms ease,color 150ms ease}',
    '@media (hover:hover) and (pointer:fine){.seg button:hover{color:var(--text)}}',
    '.seg button[aria-pressed="true"],.seg button[aria-checked="true"]{background:var(--bg4);color:var(--text)}',
    '.field{display:grid;grid-template-columns:68px 1fr;align-items:center;gap:8px;margin:0}',
    '.field>.label{font-weight:500;color:var(--text2)}',
    'select{appearance:none;-webkit-appearance:none;height:30px;border-radius:9px;background:var(--bg) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath d=%27M4.5 6.5L8 10l3.5-3.5%27 stroke=%27%23a7a7af%27 stroke-width=%271.5%27 fill=%27none%27/%3E%3C/svg%3E") no-repeat right 8px center/14px;border:0;padding:0 28px 0 10px;color:var(--text);font-weight:600;cursor:pointer;width:100%}',
    'select option{background:#1d1d21;color:#f4f4f5}',
    '.toggle{position:relative;width:34px;height:20px;border-radius:999px;background:var(--bg4);transition:background-color 150ms ease;flex:none}',
    '.toggle::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform 180ms var(--ease)}',
    '.toggle[aria-checked="true"]{background:var(--accent)}',
    '.toggle[aria-checked="true"]::after{transform:translateX(14px);background:var(--accent-ink)}',
    '.footer-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
    '.footer-actions .btn{flex:1}',
    '.draft{margin-top:8px;padding:10px 11px;border-radius:12px;background:var(--bg);color:var(--text2);font-size:11.5px;line-height:1.45}',
    '.draft b{color:var(--text);font-weight:600}',
    // shortcuts view
    '.kbd-row{display:flex;align-items:center;gap:8px;min-height:36px;padding:3px 0;border-top:1px solid var(--line)}',
    '.kbd-row:first-of-type{border-top:0}',
    '.kbd-row .name{flex:1;color:var(--text2);font-weight:500}',
    '.kbd-row .name b{color:var(--text);font-weight:600}',
    '.bind{min-width:58px;height:28px;padding:0 9px;border-radius:9px;background:var(--bg);font:600 11.5px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--text);display:inline-flex;align-items:center;justify-content:center;transition:background-color 150ms ease,box-shadow 150ms ease}',
    '.bind.empty{color:var(--text3);font-family:inherit;font-weight:600}',
    '.bind.rec{box-shadow:inset 0 0 0 1.5px var(--accent);color:var(--accent)}',
    '@media (hover:hover) and (pointer:fine){.bind:hover{background:var(--bg3)}}',
    '.msg{font-size:11px;margin:2px 0 4px;min-height:0}',
    '.msg.err{color:#ff9d8f}.msg.warn{color:var(--warn)}',
    '.fixed-keys{color:var(--text3);font-size:11px;line-height:1.8;margin-top:6px}',
    // footer & toast
    '.foot{display:flex;align-items:center;gap:6px;padding:8px 2px 0;color:var(--text3);font-size:11px;flex-wrap:wrap}',
    '.foot .k{display:inline-flex;align-items:center;gap:4px;margin-right:4px}',
    '.foot .link{margin-left:auto;display:inline-flex;align-items:center;gap:5px;color:var(--text2);font-weight:600;padding:4px 6px;border-radius:7px;transition:color 150ms ease,background-color 150ms ease}',
    '.foot .link svg{width:14px;height:14px}',
    '@media (hover:hover) and (pointer:fine){.foot .link:hover{color:var(--text);background:var(--bg2)}}',
    '.toast{position:sticky;bottom:0;margin:8px -4px -4px;padding:9px 11px;border-radius:12px;background:var(--bg3);color:var(--text);font-weight:600;display:flex;align-items:center;gap:7px;opacity:0;transform:translateY(4px);transition:opacity 180ms var(--ease),transform 180ms var(--ease);pointer-events:none}',
    '.toast svg{width:14px;height:14px;color:var(--accent)}',
    '.toast.show{opacity:1;transform:none}',
    '.toast:empty{display:none}',
    '.manual{width:100%;height:96px;margin-top:6px;border-radius:9px;border:0;background:var(--bg);color:var(--text2);font:11px/1.45 ui-monospace,Menlo,monospace;padding:8px;resize:vertical}',
    '.hud{position:absolute;z-index:3;left:50%;bottom:24px;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:var(--bg);box-shadow:0 0 0 1px var(--line2),0 10px 30px rgba(0,0,0,.35);font-weight:600;font-size:12.5px;display:flex;gap:8px;align-items:center;transition:opacity 150ms ease;pointer-events:none}',
    '.hud.hide{opacity:0}',
    '.hud svg{width:15px;height:15px;color:var(--accent)}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media (pointer:coarse){.foot .k{display:none}}',
    '@media (max-width:520px){.panel{width:auto;left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;max-height:min(78%,620px);border-radius:20px}.head{cursor:default}.btn{height:38px}.tile{padding-bottom:7px}}',
    '@media (prefers-reduced-motion:reduce){.chev{transition:none!important}.panel.from,.panel.to-out{transform:none}.btn,.tile,.launcher,.icon-btn,.sw span.c{transition-property:background-color,color,opacity,box-shadow}.btn:active,.tile:active,.launcher:active,.icon-btn:active,.sw:active span.c{transform:none}.toast{transform:none}.collapse.anim{transition:opacity 150ms ease}.toggle::after{transition:none}}'
  ].join('\n');

  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === false || attrs[k] == null) return;
      if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    if (html != null) el.innerHTML = html;
    return el;
  }

  function UI(app) {
    this.app = app;
    this.host = document.createElement('unpolish-harness');
    this.host.setAttribute('data-unpolish-ignore', '');
    this.root = this.host.attachShadow({ mode: 'open' });
    this.isOpen = false;
    this.view = 'main';
    this.editOpen = false;
    this.recording = null;
  }

  UI.prototype.mount = function () {
    var self = this, app = this.app;
    var style = h('style'); style.textContent = PANEL_CSS;
    this.root.appendChild(style);

    this.launcher = h('button', { class: 'launcher', type: 'button', 'aria-label': 'Open Unpolish theme selector', 'aria-expanded': 'false', 'aria-controls': 'up-panel' }, ICONS.mark + '<span class="dot" hidden></span>');
    this.vp = h('div', { class: 'vp' });
    this.root.appendChild(this.vp);
    this.vp.appendChild(this.launcher);
    this.launcher.addEventListener('click', function () { self.toggle({ via: 'pointer', fromLauncher: true }); });

    var p = this.panel = h('section', { class: 'panel', id: 'up-panel', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Unpolish', hidden: true });
    p.innerHTML =
      '<div class="head" data-drag>' +
        '<span class="brand">' + ICONS.mark + 'Unpolish</span>' +
        '<span class="source" data-kind="project" title="">Project</span>' +
        '<button class="icon-btn" type="button" data-act="close" aria-label="Close Unpolish">' + ICONS.close + '</button>' +
      '</div>' +
      '<div data-view="main">' +
        '<div class="banner" data-review hidden><span><b>Review link</b> · project preset</span><button type="button" data-act="exit-review">Exit</button></div>' +
        '<div class="themes" role="radiogroup" aria-label="Theme"></div>' +
        '<div class="actions">' +
          '<button class="btn" type="button" data-act="edit" aria-expanded="false" aria-controls="up-editor">Edit theme' + ICONS.chev + '</button>' +
          '<button class="btn" type="button" data-act="share" aria-expanded="false" aria-controls="up-share">' + ICONS.link + 'Review link' + ICONS.chev + '</button>' +
        '</div>' +
        '<div class="collapse" id="up-share" data-share hidden><div class="group share">' +
          '<div class="row"><span class="label">Share this view</span><span class="pill" data-share-theme></span></div>' +
          '<p class="desc" data-share-desc></p>' +
          '<label class="check"><input type="checkbox" data-hide-ui> Hide controls for viewers</label>' +
          '<div class="note" data-share-warn role="status" hidden></div>' +
          '<div class="footer-actions" data-share-actions></div>' +
        '</div></div>' +
        '<div class="collapse" id="up-editor" data-editor hidden></div>' +
        '<div class="draft" data-draft hidden></div>' +
      '</div>' +
      '<div data-view="keys" hidden></div>' +
      '<div class="foot" data-foot>' +
        '<span class="k"><kbd data-toggle-key>\\</kbd> toggle</span>' +
        '<span class="k"><kbd>1</kbd>–<kbd>4</kbd> theme</span>' +
        '<span class="k"><kbd>0</kbd> original</span>' +
        '<button class="link" type="button" data-act="keys">' + ICONS.keys + 'Shortcuts</button>' +
      '</div>' +
      '<div class="toast" role="status" aria-live="polite"></div>' +
      '<div class="sr" data-live aria-live="polite"></div>';
    this.vp.appendChild(p);
    this.hud = h('div', { class: 'hud hide', 'aria-hidden': 'true' });
    this.vp.appendChild(this.hud);
    this.trackViewport();

    this.q = function (s) { return p.querySelector(s); };
    this.tiles = this.q('.themes');
    this.toast = this.q('.toast');

    var ids = ['original'].concat(THEME_IDS);
    ids.forEach(function (id, i) {
      var key = id === 'original' ? '0' : String(i);
      var label = id === 'original' ? 'Original' : THEMES[id].short;
      var b = h('button', { class: 'tile', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-theme': id, tabindex: '-1', title: (id === 'original' ? 'Restore original' : THEMES[id].label) + ' (' + key + ')', 'aria-keyshortcuts': key },
        '<span class="pv"></span><span class="nm">' + label + '</span><kbd aria-hidden="true">' + key + '</kbd>');
      b.setAttribute('aria-label', id === 'original' ? 'Original — restore the prototype\'s appearance' : THEMES[id].label);
      self.tiles.appendChild(b);
    });
    this.tiles.addEventListener('click', function (e) {
      var b = e.target.closest('.tile'); if (!b) return;
      app.setTheme(b.getAttribute('data-theme'), { source: 'panel' });
    });
    this.tiles.addEventListener('keydown', function (e) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!keys[e.key] && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      var list = [].slice.call(self.tiles.children), i = list.indexOf(self.root.activeElement);
      var n = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + keys[e.key] + list.length) % list.length;
      app.setTheme(list[n].getAttribute('data-theme'), { source: 'panel' });
      list[n].focus();
    });


    p.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'close') self.close({ via: e.detail === 0 ? 'keyboard' : 'pointer' });
      if (act === 'edit') self.setEdit(!self.editOpen);
      if (act === 'share') self.setShare(!self.shareOpen);
      if (act === 'copy-link') self.copyLink();
      if (act === 'copy-config') self.copyConfig();
      if (act === 'reset-theme') { app.resetTheme(); self.flash('Reset ' + THEMES[app.state.active].label + ' to project defaults'); }
      if (act === 'discard') { app.discardLocal(); self.flash('Back to project defaults'); }
      if (act === 'keys') self.setView('keys');
      if (act === 'back') self.setView('main');
      if (act === 'exit-review') { app.exitReview(); self.flash('Review link closed'); }
      if (act === 'reset-keys') { app.resetShortcuts(); self.renderKeys(); self.flash('Shortcuts reset'); }
      if (act === 'bind') self.record(b.getAttribute('data-bind'), b);
    });
    this.q('[data-hide-ui]').addEventListener('change', function (e) {
      self.hideForViewers = e.target.checked;
      self.syncShare();
    });

    this.bindDrag();
    document.body.appendChild(this.host);
    var host = this.host;
    new MutationObserver(function () {
      if (!host.isConnected && document.body) document.body.appendChild(host);
    }).observe(document.body, { childList: true });
    this.render();
  };

  UI.prototype.bindDrag = function () {
    var self = this, head = this.q('[data-drag]'), start = null;
    head.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button') || self.viewport().width <= 520) return;
      var r = self.panel.getBoundingClientRect(), v = self.viewport();
      start = { x: e.clientX, y: e.clientY, left: r.left - v.left, top: r.top - v.top, id: e.pointerId };
      head.setPointerCapture(e.pointerId);
      head.classList.add('dragging');
    });
    head.addEventListener('pointermove', function (e) {
      if (!start || e.pointerId !== start.id) return;
      var r = self.panel.getBoundingClientRect();
      var v = self.viewport();
      var left = clamp(start.left + e.clientX - start.x, 8, v.width - r.width - 8);
      var top = clamp(start.top + e.clientY - start.y, 8, v.height - 48);
      self.pos = { left: left, top: top };
      self.place();
    });
    function end(e) {
      if (!start || (e && e.pointerId !== start.id)) return;
      start = null; head.classList.remove('dragging');
      if (self.pos) self.app.saveUI({ pos: self.pos });
    }
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
    window.addEventListener('resize', function () { if (self.isOpen) self.place(); });
  };

  UI.prototype.trackViewport = function () {
    var vv = window.visualViewport, box = this.vp.style, self = this;
    if (!vv) return;
    function sync() {
      box.left = vv.offsetLeft + 'px'; box.top = vv.offsetTop + 'px';
      box.width = vv.width + 'px'; box.height = vv.height + 'px';
      if (self.isOpen) self.place();
    }
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();
  };

  UI.prototype.viewport = function () {
    var r = this.vp.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width || window.innerWidth, height: r.height || window.innerHeight };
  };

  UI.prototype.corner = function () {
    var c = this.app.config.launcher || 'bottom-right';
    return { v: c.indexOf('top') === 0 ? 'top' : 'bottom', h: /left$/.test(c) ? 'left' : 'right' };
  };

  UI.prototype.place = function () {
    var c = this.corner(), L = this.launcher.style, P = this.panel.style;
    L.top = L.bottom = L.left = L.right = '';
    L[c.v] = '16px'; L[c.h] = '16px';
    P.top = P.bottom = P.left = P.right = '';
    var v = this.viewport();
    if (this.pos && v.width > 520) {
      var r = this.panel.getBoundingClientRect();
      P.left = clamp(this.pos.left, 8, Math.max(8, v.width - (r.width || 312) - 8)) + 'px';
      P.top = clamp(this.pos.top, 8, Math.max(8, v.height - 48)) + 'px';
      this.panel.style.setProperty('--origin', 'center');
      P.maxHeight = 'calc(100% - ' + (parseFloat(P.top) + 8) + 'px)';
    } else {
      var off = this.launcherVisible() ? 62 : 16;
      P[c.v] = off + 'px';
      P[c.h] = '16px';
      P.maxHeight = v.width > 520 ? 'calc(100% - ' + (off + 12) + 'px)' : '';
      this.panel.style.setProperty('--origin', c.v + ' ' + c.h);
    }
  };

  UI.prototype.launcherVisible = function () {
    return this.app.config.launcher !== false && !this.app.hiddenUI();
  };

  UI.prototype.open = function (opts) {
    opts = opts || {};
    if (this.isOpen) return;
    this.isOpen = true;
    this.returnFocus = opts.fromLauncher ? this.launcher : deepActive();
    this.render();
    var p = this.panel;
    p.hidden = false;
    this.place();
    // Keyboard toggles are instant; pointer opens get a short scale-in from the launcher.
    if (opts.via === 'pointer') {
      p.classList.remove('anim', 'anim-out', 'to-out');
      p.classList.add('from');
      void p.offsetWidth;
      p.classList.add('anim');
      p.classList.remove('from');
    } else {
      p.classList.remove('anim', 'anim-out', 'from', 'to-out');
    }
    this.launcher.setAttribute('aria-expanded', 'true');
    var target = this.tiles.querySelector('[aria-checked="true"]') || this.tiles.firstChild;
    try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    this.app.emit('open');
  };

  UI.prototype.close = function (opts) {
    opts = opts || {};
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stopRecording();
    var p = this.panel, self = this;
    var focusInside = this.root.activeElement != null;
    this.launcher.setAttribute('aria-expanded', 'false');
    clearTimeout(this.closeTimer);
    if (opts.via === 'pointer') {
      p.classList.remove('anim', 'from');
      p.classList.add('anim-out', 'to-out');
      this.closeTimer = setTimeout(function () { if (!self.isOpen) { p.hidden = true; p.classList.remove('anim-out', 'to-out'); } }, 140);
    } else {
      p.hidden = true;
      p.classList.remove('anim', 'anim-out', 'from', 'to-out');
    }
    if (this.shareOpen) this.setShare(false, true);
    this.renderLauncher();
    if (focusInside) {
      var back = this.returnFocus && this.returnFocus.isConnected && this.returnFocus !== document.body ? this.returnFocus : (this.launcherVisible() ? this.launcher : null);
      if (back && back.focus) { try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); } }
      else if (document.activeElement && this.host.contains(document.activeElement)) document.activeElement.blur();
      else this.host.blur && this.host.blur();
    }
    this.app.emit('close');
  };

  UI.prototype.toggle = function (opts) { if (this.isOpen) this.close(opts); else this.open(opts); };

  function deepActive() {
    var a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  UI.prototype.setView = function (view) {
    this.view = view;
    this.stopRecording();
    this.q('[data-view="main"]').hidden = view !== 'main';
    this.q('[data-view="keys"]').hidden = view !== 'keys';
    this.q('[data-foot]').hidden = view !== 'main';
    if (view === 'keys') {
      this.renderKeys();
      var back = this.q('[data-view="keys"] [data-act="back"]');
      if (back) back.focus();
    } else {
      var k = this.q('[data-act="keys"]');
      if (k) k.focus();
    }
  };

  UI.prototype.setEdit = function (on) {
    var ed = this.q('[data-editor]'), btn = this.q('[data-act="edit"]');
    if (this.app.state.active === 'original') on = false;
    if (on && this.shareOpen) this.setShare(false, true);
    this.editOpen = on;
    btn.setAttribute('aria-expanded', String(on));
    if (on) this.renderEditor();
    reveal(ed, on);
  };

  /* Height + opacity reveal for an occasional, user-initiated section. */
  function reveal(el, on, instant) {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(el._t);
    if (instant) { el.hidden = !on; el.style.height = ''; el.style.opacity = ''; el.classList.remove('anim'); return; }
    if (on) {
      el.hidden = false;
      var target = el.scrollHeight;
      el.classList.remove('anim');
      el.style.height = reduce ? '' : '0px'; el.style.opacity = '0';
      void el.offsetWidth;
      el.classList.add('anim');
      if (!reduce) el.style.height = target + 'px';
      el.style.opacity = '1';
      el._t = setTimeout(function () { el.style.height = ''; el.classList.remove('anim'); }, 210);
    } else {
      if (el.hidden) return;
      el.classList.remove('anim');
      el.style.height = el.scrollHeight + 'px';
      void el.offsetWidth;
      el.classList.add('anim');
      if (!reduce) el.style.height = '0px';
      el.style.opacity = '0';
      el._t = setTimeout(function () { el.hidden = true; el.style.height = ''; el.style.opacity = ''; el.classList.remove('anim'); }, 210);
    }
  }

  UI.prototype.render = function () {
    if (!this.panel) return;
    var app = this.app, st = app.state, active = st.active, self = this;
    [].forEach.call(this.tiles.children, function (b) {
      var id = b.getAttribute('data-theme');
      var on = id === active;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      var pv = b.querySelector('.pv');
      var html = preview(id, id === 'original' ? null : app.settingsFor(id));
      if (pv._html !== html) { pv.innerHTML = html; pv._html = html; }
    });
    var themed = active !== 'original';
    this.q('[data-act="edit"]').disabled = !themed;
    if (!themed && this.editOpen) this.setEdit(false);
    if (this.editOpen) this.renderEditor();

    var src = this.q('.source');
    var kind = st.review ? 'review' : app.hasLocalChanges() ? 'draft' : 'project';
    src.setAttribute('data-kind', kind);
    src.textContent = kind === 'review' ? 'Review link' : kind === 'draft' ? 'Local draft' : 'Project';
    src.title = kind === 'review' ? 'Showing the saved project preset from a review link. Local edits are ignored.'
      : kind === 'draft' ? 'You have adjustments saved only in this browser. Copy configuration to save them to the project.'
      : 'Matches the project configuration.';
    this.q('[data-review]').hidden = !st.review;
    this.syncShare();
    this.q('[data-toggle-key]').textContent = prettyCombo(app.shortcuts().toggle) || '\\';
    this.panel.setAttribute('data-keys', '1');

    var draft = this.q('[data-draft]');
    // The share view carries its own save prompt, so the draft bar steps aside while it's open.
    if (this.shareOpen) draft.hidden = true;
    else if (kind === 'draft') {
      draft.hidden = false;
      draft.innerHTML = '<b>Unsaved in project.</b> Your adjustments live in this browser only.' +
        '<div class="footer-actions"><button class="btn small primary" type="button" data-act="copy-config"><span class="swap">' + ICONS.copy + '<span>Copy configuration</span></span></button>' +
        '<button class="btn small" type="button" data-act="discard">Discard local changes</button></div>';
    } else if (st.review && app.reviewEdited()) {
      draft.hidden = false;
      draft.innerHTML = '<b>Review session edits.</b> These stay in this tab and are not saved locally.' +
        '<div class="footer-actions"><button class="btn small primary" type="button" data-act="copy-config"><span class="swap">' + ICONS.copy + '<span>Copy configuration</span></span></button></div>';
    } else draft.hidden = true;
    this.renderLauncher();
    void self;
  };

  UI.prototype.renderLauncher = function () {
    var show = this.launcherVisible();
    this.launcher.hidden = !show;
    this.launcher.title = 'Unpolish (' + prettyCombo(this.app.shortcuts().toggle) + ')';
    this.launcher.querySelector('.dot').hidden = this.app.state.active === 'original';
    if (!this.isOpen) this.place();
  };

  UI.prototype.renderEditor = function () {
    var app = this.app, id = app.state.active;
    if (id === 'original') return;
    var s = app.settingsFor(id), T = THEMES[id];
    var ed = this.q('[data-editor]');
    var key = app.shortcuts().themes[id] || '';
    var sig = id + '|' + key;
    if (ed._sig !== sig) {
      this.buildEditor(ed, id, s, T, key);
      ed._sig = sig;
    }
    this.syncEditor(ed, s);
  };

  UI.prototype.buildEditor = function (ed, id, s, T, key) {
    var app = this.app, self = this;
    var open = this.openSections = this.openSections || {};
    function swatches(keys) {
      return '<div class="swatches">' + keys.map(function (k) {
        return '<label class="sw"><span class="c"></span><input type="color" data-k="palette.' + k + '" aria-label="' + PALETTE_LABELS[k] + ' color">' + PALETTE_LABELS[k] + '</label>';
      }).join('') + '</div>';
    }
    function section(key, title, hint, body) {
      return '<details class="sec" data-sec="' + key + '"' + (open[key] ? ' open' : '') + '><summary><span>' + title + '</span><span class="hint">' + hint + '</span>' + ICONS.chev + '</summary><div class="sec-body">' + body + '</div></details>';
    }
    var keys = Object.keys(s.palette);
    var status = ['danger', 'success', 'warning'];
    var core = keys.filter(function (k) { return status.indexOf(k) < 0 && !/^block/.test(k); });
    var blocks = keys.filter(function (k) { return /^block/.test(k); });
    var colorBody = swatches(core) + (blocks.length ? '<div class="sub">Color blocks</div>' + swatches(blocks) : '') +
      '<details class="more" data-sec="status"' + (open.status ? ' open' : '') + '><summary>Status colors' + ICONS.chev + '</summary>' + swatches(status) + '</details>';
    var typeBody = '<div class="field"><span class="label" id="up-l-type">Typography</span><select data-k="typography" aria-labelledby="up-l-type">' +
      TYPE_OPTIONS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><span class="label" id="up-l-bw">Border</span><div class="row"><input type="range" min="0" max="4" step="0.25" data-k="border.weight" aria-labelledby="up-l-bw"><span class="val" data-bw-val></span></div></div>' +
      seg('Lines', 'border.style', BORDER_STYLES) + seg('Corners', 'radius', RADIUS_OPTIONS) + seg('Shadows', 'shadows', SHADOW_OPTIONS);
    var imgBody = '<div class="stack"><span class="hint" id="up-l-images">Photos, illustrations and background images</span>' +
      '<div class="seg" role="radiogroup" aria-labelledby="up-l-images">' + IMAGE_OPTIONS.map(function (o) { return '<button type="button" role="radio" data-k="images" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    var detailsBody = '<div class="details-row"><div class="row"><label class="label" for="up-details">Details</label><span class="hint" id="up-details-hint">' + T.detailsHint + '</span><output class="val" for="up-details" data-details-val></output></div>' +
      '<input id="up-details" type="range" min="0" max="100" step="1" data-k="details" aria-describedby="up-details-hint"></div>';
    var keyBody = '<div class="row"><span class="hint" style="flex:1">Jump straight to ' + T.label + ', even with the panel closed</span><button type="button" class="bind' + (key ? '' : ' empty') + '" data-act="bind" data-bind="' + id + '" aria-label="Shortcut for ' + T.label + ': ' + (key ? prettyCombo(key) : 'none') + '. Press to change">' + (key ? prettyCombo(key) : 'Add') + '</button></div><div class="msg" data-msg="' + id + '"></div>';
    var html = '<div class="group editor">' + detailsBody +
      section('color', 'Color', T.label, colorBody) +
      section('type', 'Type &amp; lines', '', typeBody) +
      section('images', 'Images', '', imgBody) +
      section('key', 'Shortcut', key ? prettyCombo(key) : '', keyBody) +
      '<div class="footer-actions editor-actions"><button class="btn small" type="button" data-act="reset-theme">' + ICONS.reset + '<span>Reset preset</span></button>' +
      '<button class="btn small" type="button" data-act="copy-config"><span class="swap">' + ICONS.copy + '<span>Copy configuration</span></span></button></div>' +
      '</div>';
    ed.innerHTML = html;
    ed.querySelectorAll('details[data-sec]').forEach(function (d) {
      d.addEventListener('toggle', function () { open[d.getAttribute('data-sec')] = d.open; });
    });
    function seg(label, k, opts) {
      var lid = 'up-l-' + k.replace('.', '-');
      return '<div class="field"><span class="label" id="' + lid + '">' + label + '</span><div class="seg" role="radiogroup" aria-labelledby="' + lid + '">' +
        opts.map(function (o) { return '<button type="button" role="radio" data-k="' + k + '" data-v="' + o[0] + '"' + (k === 'radius' && o[0] !== 'keep' ? ' aria-label="' + o[0] + ' pixels"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div></div>';
    }
    ed.querySelectorAll('input[type=color]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        inp.previousElementSibling.style.background = inp.value;
        var o = { palette: {} }; o.palette[inp.getAttribute('data-k').split('.')[1]] = inp.value;
        app.updateSettings(o);
      });
    });
    ed.querySelector('select').addEventListener('change', function (e) { app.updateSettings({ typography: e.target.value }); });
    var bw = ed.querySelector('[data-k="border.weight"]');
    bw.addEventListener('input', function () {
      bw.style.setProperty('--p', (bw.value / 4 * 100) + '%');
      ed.querySelector('[data-bw-val]').textContent = bw.value;
      app.updateSettings({ border: { weight: +bw.value } });
    });
    ed.querySelectorAll('.seg').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var k = b.getAttribute('data-k'), v = b.getAttribute('data-v');
        if (k === 'radius') v = v === 'keep' ? 'keep' : +v;
        var o = {};
        if (k === 'border.style') o.border = { style: v }; else o[k] = v;
        app.updateSettings(o);
      });
      g.addEventListener('keydown', function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        var bs = [].slice.call(g.children), i = bs.indexOf(self.root.activeElement);
        var n = bs[(i + d + bs.length) % bs.length];
        n.click(); n.focus();
      });
    });
    var det = ed.querySelector('[data-k="details"]');
    det.addEventListener('input', function () {
      det.style.setProperty('--p', det.value + '%');
      ed.querySelector('[data-details-val]').textContent = det.value;
      app.updateSettings({ details: +det.value });
    });
  };

  /* Update control values in place; never rebuild under the user's pointer. */
  UI.prototype.syncEditor = function (ed, s) {
    var active = this.root.activeElement;
    ed.querySelectorAll('input[type=color]').forEach(function (inp) {
      var k = inp.getAttribute('data-k').split('.')[1], val = s.palette[k];
      inp.previousElementSibling.style.background = val;
      if (inp !== active) inp.value = toHex(val);
    });
    var sel = ed.querySelector('select');
    if (sel !== active || sel.value !== s.typography) sel.value = s.typography;
    var bw = ed.querySelector('[data-k="border.weight"]');
    if (bw !== active) bw.value = s.border.weight;
    bw.style.setProperty('--p', (s.border.weight / 4 * 100) + '%');
    ed.querySelector('[data-bw-val]').textContent = s.border.weight;
    var cur = { 'border.style': s.border.style, radius: s.radius, shadows: s.shadows, images: s.images };
    ed.querySelectorAll('.seg button').forEach(function (b) {
      var on = String(cur[b.getAttribute('data-k')]) === b.getAttribute('data-v');
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    var det = ed.querySelector('[data-k="details"]');
    if (det !== active) det.value = s.details;
    det.style.setProperty('--p', s.details + '%');
    ed.querySelector('[data-details-val]').textContent = s.details === 0 ? 'Off' : s.details;
  };

  function toHex(c) { var x = parseColor(c); return x ? hex(x) : '#000000'; }

  UI.prototype.renderKeys = function () {
    var app = this.app, sc = app.shortcuts();
    var v = this.q('[data-view="keys"]');
    var html = '<div class="row" style="margin:2px 0 8px"><button class="icon-btn" type="button" data-act="back" aria-label="Back to themes">' + ICONS.back + '</button><span class="label">Shortcuts</span><span class="hint" style="margin-left:auto">Click a key to reassign</span></div>';
    html += '<div class="group">';
    html += row('toggle', '<b>Open / close</b> panel', sc.toggle);
    ['original'].concat(THEME_IDS).forEach(function (id) {
      html += row(id, '<b>' + (id === 'original' ? 'Original' : THEMES[id].label) + '</b> directly', sc.themes[id]);
    });
    html += '</div>';
    html += '<div class="fixed-keys">While the panel is open: <kbd>1</kbd>–<kbd>4</kbd> pick a theme · <kbd>0</kbd> original · <kbd>Esc</kbd> close. Shortcuts never fire while you type in a field.</div>';
    html += '<div class="footer-actions"><button class="btn small" type="button" data-act="reset-keys">' + ICONS.reset + '<span>Reset shortcuts</span></button></div>';
    v.innerHTML = html;
    function row(id, label, key) {
      return '<div class="kbd-row"><span class="name">' + label + '</span><button type="button" class="bind' + (key ? '' : ' empty') + '" data-act="bind" data-bind="' + id + '" aria-label="' + label.replace(/<[^>]+>/g, '') + ': ' + (key ? prettyCombo(key) : 'none') + '. Press to change">' + (key ? prettyCombo(key) : 'Add') + '</button></div><div class="msg" data-msg="' + id + '"></div>';
    }
  };

  UI.prototype.record = function (id, btn) {
    var self = this, app = this.app;
    this.stopRecording();
    btn.classList.add('rec');
    btn.classList.remove('empty');
    btn.textContent = 'Press keys…';
    var msg = this.q('[data-msg="' + id + '"]');
    msg.className = 'msg'; msg.textContent = 'Esc to cancel · Backspace to clear';
    this.recording = {
      id: id, btn: btn,
      handler: function (e) {
        e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { self.stopRecording(true); return; }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          if (id === 'toggle') { msg.className = 'msg err'; msg.textContent = 'The panel needs a shortcut. Pick another key.'; return; }
          app.setShortcut(id, null); self.stopRecording(true); self.flash('Shortcut cleared'); return;
        }
        var combo = comboFromEvent(e);
        var chk = checkCombo(combo);
        if (chk.pending) return;
        if (chk.error) { msg.className = 'msg err'; msg.textContent = chk.error; return; }
        var dup = app.shortcutOwner(combo, id);
        if (dup) { msg.className = 'msg err'; msg.textContent = prettyCombo(combo) + ' is already used for ' + dup + '.'; return; }
        app.setShortcut(id, combo);
        self.stopRecording(true);
        var m2 = self.q('[data-msg="' + id + '"]');
        if (m2 && chk.warn) { m2.className = 'msg warn'; m2.textContent = chk.warn; }
        self.flash('Shortcut set to ' + prettyCombo(combo));
      }
    };
    window.addEventListener('keydown', this.recording.handler, true);
  };

  UI.prototype.stopRecording = function (rerender) {
    if (!this.recording) return;
    window.removeEventListener('keydown', this.recording.handler, true);
    var id = this.recording.id;
    this.recording = null;
    if (rerender) {
      if (this.view === 'keys') this.renderKeys();
      if (this.editOpen) { this.q('[data-editor]')._sig = ''; this.renderEditor(); }
      this.render();
      var b = this.q('[data-bind="' + id + '"]');
      if (b) b.focus();
    }
  };

  UI.prototype.flash = function (text, icon) {
    var t = this.toast, self = this;
    t.innerHTML = (icon === false ? '' : ICONS.check) + '<span></span>';
    t.querySelector('span').textContent = text;
    clearTimeout(this.toastTimer);
    void t.offsetWidth;
    t.classList.add('show');
    this.toastTimer = setTimeout(function () { t.classList.remove('show'); setTimeout(function () { if (!t.classList.contains('show')) t.innerHTML = ''; }, 200); }, 2200);
    void self;
  };

  UI.prototype.showHud = function (text) {
    if (this.app.hiddenUI() || this.isOpen) return;
    var hud = this.hud;
    hud.innerHTML = ICONS.mark + '<span></span>';
    hud.querySelector('span').textContent = text;
    hud.classList.remove('hide');
    clearTimeout(this.hudTimer);
    this.hudTimer = setTimeout(function () { hud.classList.add('hide'); }, 1100);
  };

  UI.prototype.markCopied = function (btn, label) {
    if (!btn) return;
    var swap = btn.querySelector('.swap');
    if (!swap) return;
    if (!btn._orig) btn._orig = swap.innerHTML;
    swap.innerHTML = '<span class="ok">' + ICONS.check + '</span><span>' + label + '</span>';
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { if (btn.isConnected) swap.innerHTML = btn._orig; btn._orig = null; }, 1800);
  };

  UI.prototype.announce = function (text) {
    var live = this.q('[data-live]');
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  };

  UI.prototype.setShare = function (on, instant) {
    var box = this.q('[data-share]');
    if (on && this.editOpen) this.setEdit(false);
    this.shareOpen = on;
    this.q('[data-act="share"]').setAttribute('aria-expanded', String(on));
    this.render();
    reveal(box, on, instant);
  };

  /* What a copied link would contain right now; copy feedback is only valid while this holds. */
  UI.prototype.shareSig = function () {
    var app = this.app, id = app.state.active;
    return [id, !!this.hideForViewers, app.unsavedForLink(), JSON.stringify(id === 'original' ? null : app.settingsFor(id))].join('|');
  };

  /* Recomputed on every render, so the view always describes the current theme and saved state. */
  UI.prototype.syncShare = function () {
    if (!this.panel) return;
    var app = this.app, id = app.state.active, label = id === 'original' ? 'Original' : THEMES[id].label;
    var unsaved = app.unsavedForLink();
    var copied = this.copiedSig && this.copiedSig === this.shareSig();
    if (!copied) this.copiedSig = null;
    this.q('[data-share-theme]').textContent = label;
    this.q('[data-hide-ui]').checked = !!this.hideForViewers;
    this.q('[data-share-desc]').textContent = id === 'original'
      ? 'Opens this page with its original design.'
      : 'Opens this page in ' + label + ' using the saved project preset' + (this.hideForViewers ? ', with Unpolish hidden.' : '.');
    var warn = this.q('[data-share-warn]');
    warn.hidden = !unsaved;
    if (unsaved) warn.innerHTML = '<b>' + label + ' has unsaved edits.</b> Viewers will see the saved preset, not your edits. Copy the configuration to your coding agent and redeploy before sharing.';
    var html = (unsaved ? '<button class="btn small primary" type="button" data-act="copy-config"><span class="swap">' + ICONS.copy + '<span>Copy configuration</span></span></button>' : '') +
      '<button class="btn small' + (unsaved ? '' : ' primary') + '" type="button" data-act="copy-link">' +
      (copied ? '<span class="ok">' + ICONS.check + '</span>Link copied' : ICONS.link + (unsaved ? 'Copy link without edits' : 'Copy link')) + '</button>';
    var actions = this.q('[data-share-actions]');
    if (actions._html !== html) {
      var hadFocus = this.root.activeElement && actions.contains(this.root.activeElement) ? this.root.activeElement.getAttribute('data-act') : null;
      actions.innerHTML = html; actions._html = html;
      if (hadFocus) { var f = actions.querySelector('[data-act="' + hadFocus + '"]'); if (f) f.focus(); }
    }
  };

  UI.prototype.copyLink = function () {
    var self = this, url = this.app.reviewLink({ hideUI: this.hideForViewers }), sig = this.shareSig();
    copyText(url, this.root).then(function (ok) {
      if (!ok) { self.manualCopy(url, 'Copy this review link'); return; }
      self.copiedSig = sig;
      self.syncShare();
      self.announce('Review link copied');
    });
  };

  UI.prototype.copyConfig = function () {
    var self = this, text = this.app.configInstructions();
    var btns = this.panel.querySelectorAll('[data-act="copy-config"]');
    copyText(text, this.root).then(function (ok) {
      if (ok) { btns.forEach(function (b) { self.markCopied(b, 'Copied'); }); self.flash('Configuration copied — paste it to your coding agent'); }
      else self.manualCopy(text, 'Copy this configuration');
    });
  };

  UI.prototype.manualCopy = function (text, label) {
    var t = this.toast;
    clearTimeout(this.toastTimer);
    t.innerHTML = '<div style="width:100%"><div>' + label + '</div><textarea class="manual" readonly></textarea></div>';
    t.style.pointerEvents = 'auto';
    var ta = t.querySelector('textarea');
    ta.value = text;
    t.classList.add('show');
    ta.focus(); ta.select();
    this.toastTimer = setTimeout(function () { t.classList.remove('show'); t.style.pointerEvents = ''; }, 12000);
  };

  function copyText(text, root) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.setAttribute('data-unpolish-ignore', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) { return false; }
    }
    void root;
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  /* ------------------------------------------------------------------ *
   * App — state, persistence, precedence, keyboard, public API
   * ------------------------------------------------------------------ */

  function App() {
    this.listeners = {};
    this.engine = new Engine(this);
    this.ui = new UI(this);
    this.state = { active: 'original', review: null };
    this.local = { themes: {}, shortcuts: {} };
  }

  App.prototype.emit = function (ev, data) {
    (this.listeners[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { warn(e); } });
  };

  App.prototype.init = function (opts) {
    opts = opts || {};
    if (this.started) { warn('Unpolish is already running.'); return this; }
    this.started = true;
    this.config = normalizeConfig(opts.config || {});
    if (opts.config && opts.config.enabled === false) { this.disabled = true; return this; }
    var key = 'unpolish:' + (this.config.id || 'default');
    this.keys = { local: key, review: key + ':review' };
    this.local = merge({ themes: {}, shortcuts: {} }, storage.get('localStorage', this.keys.local) || {});
    // Drop retired settings from older drafts so they don't read as unsaved changes.
    var lt = this.local.themes;
    Object.keys(lt).forEach(function (id) { if (lt[id]) delete lt[id].roughness; if (!lt[id] || !Object.keys(lt[id]).length) delete lt[id]; });
    this.engine.configure(this.config);
    this.readURL();
    var self = this;
    var start = function () {
      self.ui.mount();
      if (self.local.ui && self.local.ui.pos) self.ui.pos = self.local.ui.pos;
      self.bindKeys();
      self.apply();
      self.emit('ready', self.snapshot());
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
    return this;
  };

  App.prototype.readURL = function () {
    var params;
    try { params = new URL(window.location.href).searchParams; } catch (e) { params = null; }
    var has = params && (params.has('unpolish') || params.has('unpolish-ui'));
    if (has) {
      var theme = normTheme(params.get('unpolish'));
      if (params.has('unpolish') && !theme) warn('Unknown theme in URL:', params.get('unpolish'), '— using the project default.');
      var ui = params.get('unpolish-ui');
      this.state.review = {
        theme: theme || this.config.defaultTheme,
        ui: ui === 'hidden' ? 'hidden' : 'visible',
        edits: {}
      };
      storage.set('sessionStorage', this.keys.review, this.state.review);
    } else {
      var saved = storage.get('sessionStorage', this.keys.review);
      if (saved && saved.theme && normTheme(saved.theme)) {
        saved.theme = normTheme(saved.theme);
        saved.edits = saved.edits || {};
        this.state.review = saved;
      }
    }
    if (this.state.review) this.state.active = this.state.review.active || this.state.review.theme;
    else this.state.active = normTheme(this.local.active) || this.config.defaultTheme;
  };

  /* Project preset: built-in defaults overlaid with the repo configuration. */
  App.prototype.projectSettings = function (id) {
    return normalizeSettings(id, this.config.themes[id] || {});
  };

  /* Effective settings, by precedence: review URL > local draft > project config. */
  App.prototype.settingsFor = function (id) {
    var base = this.projectSettings(id);
    var rv = this.state.review;
    if (rv) {
      return normalizeSettings(id, merge(base, rv.edits[id] || {}));
    }
    return normalizeSettings(id, merge(base, this.local.themes[id] || {}));
  };

  App.prototype.shortcuts = function () {
    var sc = merge(this.config.shortcuts, {});
    var src = this.state.review ? (this.state.review.shortcuts || {}) : (this.local.shortcuts || {});
    if (src.toggle) sc.toggle = src.toggle;
    Object.keys(src.themes || {}).forEach(function (id) {
      if (src.themes[id] === null) delete sc.themes[id]; else sc.themes[id] = src.themes[id];
    });
    return sc;
  };

  App.prototype.hiddenUI = function () {
    if (this.state.review) return this.state.review.ui === 'hidden';
    return this.config.ui === 'hidden';
  };

  App.prototype.persist = function () {
    if (this.state.review) {
      this.state.review.active = this.state.active;
      storage.set('sessionStorage', this.keys.review, this.state.review);
    } else {
      this.local.active = this.state.active;
      storage.set('localStorage', this.keys.local, this.local);
    }
  };

  App.prototype.saveUI = function (o) {
    this.local.ui = merge(this.local.ui || {}, o);
    storage.set('localStorage', this.keys.local, this.local);
  };

  App.prototype.apply = function () {
    var id = this.state.active;
    try { this.engine.apply(id, id === 'original' ? null : this.settingsFor(id)); } catch (e) { warn('Could not apply theme', e); }
    this.ui.render();
  };

  App.prototype.setTheme = function (id, opts) {
    var t = normTheme(id);
    if (!t) { warn('Unknown theme:', id); return; }
    var changed = t !== this.state.active;
    this.state.active = t;
    this.persist();
    this.apply();
    if (changed) this.emit('change', this.snapshot());
    if (opts && opts.hud) this.ui.showHud(t === 'original' ? 'Original' : THEMES[t].label);
  };

  App.prototype.updateSettings = function (partial) {
    var id = this.state.active;
    if (id === 'original') return;
    var self = this;
    var bucket = this.state.review ? this.state.review.edits : this.local.themes;
    var next = merge(bucket[id] || {}, partial);
    // Keep only what differs from the project preset, so a "draft" means a real difference.
    var proj = this.projectSettings(id);
    var d = diff(proj, normalizeSettings(id, merge(proj, next)));
    if (Object.keys(d).length) bucket[id] = d; else delete bucket[id];
    this.persist();
    clearTimeout(this.persistTimer);
    if (!this.frame) {
      this.frame = true;
      raf(function () { self.frame = false; self.apply(); self.emit('change', self.snapshot()); });
    }
  };

  App.prototype.resetTheme = function () {
    var id = this.state.active;
    if (this.state.review) delete this.state.review.edits[id];
    else delete this.local.themes[id];
    this.persist();
    this.ui.q('[data-editor]')._sig = '';
    this.apply();
    this.emit('change', this.snapshot());
  };

  App.prototype.discardLocal = function () {
    this.local = { themes: {}, shortcuts: {}, ui: this.local.ui };
    this.state.active = this.config.defaultTheme;
    this.persist();
    this.ui.q('[data-editor]')._sig = '';
    this.apply();
    this.emit('change', this.snapshot());
  };

  App.prototype.exitReview = function () {
    this.state.review = null;
    storage.set('sessionStorage', this.keys.review, null);
    this.state.active = normTheme(this.local.active) || this.config.defaultTheme;
    this.ui.q('[data-editor]')._sig = '';
    this.apply();
    this.emit('change', this.snapshot());
  };

  App.prototype.hasLocalChanges = function () {
    var l = this.local;
    return Object.keys(l.themes || {}).length > 0 || !!(l.shortcuts && (l.shortcuts.toggle || Object.keys(l.shortcuts.themes || {}).length));
  };

  App.prototype.reviewEdited = function () {
    return !!(this.state.review && Object.keys(this.state.review.edits || {}).length);
  };

  /* True when the active theme differs from the saved preset (links only carry the theme). */
  App.prototype.unsavedForLink = function () {
    var id = this.state.active;
    if (id === 'original') return false;
    return Object.keys(diff(this.projectSettings(id), this.settingsFor(id))).length > 0;
  };

  App.prototype.reviewLink = function (opts) {
    var u = new URL(window.location.href);
    var id = this.state.active;
    u.searchParams.set('unpolish', id);
    u.searchParams.delete('unpolish-roughness'); // retired parameter
    if (opts && opts.hideUI) u.searchParams.set('unpolish-ui', 'hidden');
    else u.searchParams.delete('unpolish-ui');
    return u.toString();
  };

  App.prototype.setShortcut = function (id, combo) {
    var bucket = this.state.review ? (this.state.review.shortcuts = this.state.review.shortcuts || {}) : (this.local.shortcuts = this.local.shortcuts || {});
    if (id === 'toggle') {
      if (normCombo(combo) === normCombo(this.config.shortcuts.toggle)) delete bucket.toggle; else bucket.toggle = combo;
    } else {
      bucket.themes = bucket.themes || {};
      var proj = this.config.shortcuts.themes[id] || null;
      if ((combo || null) === proj) delete bucket.themes[id];
      else bucket.themes[id] = combo;
      if (!Object.keys(bucket.themes).length) delete bucket.themes;
    }
    this.persist();
    this.ui.render();
  };

  App.prototype.resetShortcuts = function () {
    if (this.state.review) this.state.review.shortcuts = {};
    else this.local.shortcuts = {};
    this.persist();
    this.ui.render();
  };

  App.prototype.shortcutOwner = function (combo, except) {
    var sc = this.shortcuts(), n = normCombo(combo);
    if (except !== 'toggle' && normCombo(sc.toggle) === n) return 'opening the panel';
    var owner = null;
    Object.keys(sc.themes).forEach(function (id) {
      if (id !== except && normCombo(sc.themes[id]) === n) owner = id === 'original' ? 'Original' : THEMES[id].label;
    });
    return owner;
  };

  App.prototype.bindKeys = function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (e.defaultPrevented && !self.ui.isOpen) { /* still honour our toggle below */ }
      if (e.isComposing || e.keyCode === 229 || self.ui.recording) return;
      var path = e.composedPath ? e.composedPath() : [e.target];
      var target = path[0];
      var inPanel = path.indexOf(self.ui.host) >= 0;
      var typing = isTyping(target);
      if (e.key === 'Escape') {
        if (self.ui.isOpen && (inPanel || !typing)) {
          if (self.ui.view === 'keys' && inPanel) { self.ui.setView('main'); e.preventDefault(); e.stopPropagation(); return; }
          self.ui.close({ via: 'keyboard' });
          if (inPanel) { e.preventDefault(); e.stopPropagation(); }
        }
        return;
      }
      if (typing) return;
      var sc = self.shortcuts();
      if (matchCombo(e, sc.toggle)) {
        e.preventDefault(); e.stopPropagation();
        self.ui.toggle({ via: 'keyboard' });
        return;
      }
      if (self.ui.isOpen && !e.ctrlKey && !e.metaKey && !e.altKey && /^Digit[0-4]$|^Numpad[0-4]$/.test(e.code)) {
        var n = +e.code.slice(-1);
        e.preventDefault(); e.stopPropagation();
        var id = n === 0 ? 'original' : THEME_IDS[n - 1];
        self.setTheme(id, { source: 'key' });
        var tile = self.ui.tiles.querySelector('[data-theme="' + id + '"]');
        if (inPanel && tile) tile.focus();
        return;
      }
      for (var tid in sc.themes) {
        if (matchCombo(e, sc.themes[tid])) {
          e.preventDefault(); e.stopPropagation();
          self.setTheme(tid, { source: 'shortcut', hud: true });
          return;
        }
      }
    }, true);
  };

  /* Config file contents: project config + local adjustments, ready to commit. */
  App.prototype.exportConfig = function () {
    var self = this;
    var cfg = clone(this.config);
    var out = { $schema: './unpolish.config.schema.json', version: 1 };
    if (cfg.id) out.id = cfg.id;
    out.defaultTheme = cfg.defaultTheme;
    out.ui = cfg.ui;
    if (cfg.launcher !== 'bottom-right') out.launcher = cfg.launcher;
    if (cfg.webFonts === false) out.webFonts = false;
    out.exclude = cfg.exclude;
    if (cfg.include && cfg.include.length) out.include = cfg.include;
    if (Object.keys(cfg.roles || {}).length) out.roles = cfg.roles;
    out.shortcuts = this.shortcuts();
    out.themes = {};
    THEME_IDS.forEach(function (id) {
      var s = self.settingsFor(id);
      if (!equal(s, normalizeSettings(id, {}))) out.themes[id] = s;
    });
    if (Object.keys(cfg.overrides || {}).length) out.overrides = cfg.overrides;
    return out;
  };

  App.prototype.configInstructions = function () {
    var json = JSON.stringify(this.exportConfig(), null, 2);
    var changed = [];
    var self = this;
    THEME_IDS.forEach(function (id) { if (!equal(self.settingsFor(id), self.projectSettings(id))) changed.push(THEMES[id].label); });
    return 'Update the Unpolish configuration in this repository.\n\n' +
      '1. Find the existing Unpolish config file (usually `unpolish.config.json`, next to `unpolish.js` or referenced by the `data-config` attribute or `Unpolish.init` call). Replace its contents with the JSON below. If there is none, create it where the Unpolish script expects it.\n' +
      '2. Change nothing else: no application code, markup or styles.\n' +
      '3. Verify: start the prototype, press `' + prettyCombo(this.shortcuts().toggle) + '` to open Unpolish, and check that the panel shows "Project" (not "Local draft") for the updated themes' + (changed.length ? ' (' + changed.join(', ') + ')' : '') + '.\n\n' +
      '```json\n' + json + '\n```\n';
  };

  App.prototype.snapshot = function () {
    var id = this.state.active;
    return {
      theme: id,
      settings: id === 'original' ? null : this.settingsFor(id),
      source: this.state.review ? 'review' : this.hasLocalChanges() ? 'draft' : 'project',
      open: this.ui.isOpen
    };
  };

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  var app = new App();
  var pending = false;

  function loadConfig(url, fallback) {
    function get(u) {
      return fetch(u, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      });
    }
    return get(url)
      .catch(function (e) { if (fallback && fallback !== url) return get(fallback); throw e; })
      .catch(function (e) { warn('Could not load config from', url, '— using built-in presets.', (e && e.message) || e); return {}; });
  }

  var api = {
    version: VERSION,
    themes: ['original'].concat(THEME_IDS),
    // Safe to call repeatedly (hot reloads, double installs): only the first call starts Unpolish.
    init: function (opts) {
      opts = opts || {};
      if (app.started || pending) return api;
      if (opts.configUrl && !opts.config) {
        pending = true;
        loadConfig(opts.configUrl, opts.fallbackConfigUrl).then(function (cfg) {
          pending = false;
          if (!app.started) app.init({ config: cfg });
        });
        return api;
      }
      app.init(opts);
      return api;
    },
    setTheme: function (id) { app.setTheme(id, { source: 'api' }); return api; },
    getTheme: function () { return app.state.active; },
    update: function (partial) { app.updateSettings(partial || {}); return api; },
    getSettings: function (id) { id = normTheme(id || app.state.active); return id && id !== 'original' ? app.settingsFor(id) : null; },
    getConfig: function () { return app.exportConfig(); },
    getConfigInstructions: function () { return app.configInstructions(); },
    getReviewLink: function (opts) { return app.reviewLink(opts); },
    open: function () { app.ui.open({ via: 'pointer' }); return api; },
    close: function () { app.ui.close({ via: 'pointer' }); return api; },
    toggle: function () { app.ui.toggle({ via: 'pointer' }); return api; },
    restore: function () { app.setTheme('original'); return api; },
    resetTheme: function () { app.resetTheme(); return api; },
    discardLocalChanges: function () { app.discardLocal(); return api; },
    on: function (ev, fn) { (app.listeners[ev] = app.listeners[ev] || []).push(fn); return function () { app.listeners[ev] = (app.listeners[ev] || []).filter(function (f) { return f !== fn; }); }; },
    state: function () { return app.snapshot(); },
    destroy: function () {
      app.engine.teardown();
      if (app.ui.host) app.ui.host.remove();
      app.started = false;
    },
    _internal: { derive: derive, buildCSS: buildCSS, normalizeConfig: normalizeConfig, normalizeSettings: normalizeSettings, THEMES: THEMES, comboFromEvent: comboFromEvent, checkCombo: checkCombo }
  };
  /* ------------------------------------------------------------------ *
   * Auto-start for classic <script> tags
   *   <script src="unpolish.js" data-config="unpolish.config.json" defer></script>
   * data-config resolves against the page, like any URL in HTML (older
   * installs kept it next to the script, so that location is tried second).
   * Add data-manual to skip auto-start and call Unpolish.init() yourself.
   * ------------------------------------------------------------------ */

  api._autoStart = function (s) {
    if (!s || s.hasAttribute('data-manual')) return;
    if (window.UnpolishConfig) { api.init({ config: window.UnpolishConfig }); return; }
    var inline = document.getElementById('unpolish-config');
    if (inline && inline.type === 'application/json') {
      try { api.init({ config: JSON.parse(inline.textContent) }); } catch (e) { warn('Invalid inline config', e); api.init({}); }
      return;
    }
    var src = s.getAttribute('data-config');
    if (!src) { api.init({}); return; }
    var pageUrl, scriptUrl = null;
    try { pageUrl = new URL(src, document.baseURI).href; } catch (e) { pageUrl = src; }
    try { if (s.src) scriptUrl = new URL(src, s.src).href; } catch (e) { scriptUrl = null; }
    api.init({ configUrl: pageUrl, fallbackConfigUrl: scriptUrl });
  };

  return api;

}
