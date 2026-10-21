// Site SEO: titles, canonical/OG/Twitter tags, robots.txt and sitemap.xml.
// Absolute URLs come from release.config.json `siteUrl` — the only place they are set.
//
//   node scripts/site-seo.mjs
//
// `npm run build:site` runs this so public/ matches. Source HTML is updated in place
// so the local test server and the hosted copy share the same tags.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadReleaseSettings } from './release-config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export function siteOrigin(settings = loadReleaseSettings(JSON.parse(readFileSync(join(root, 'release.config.json'), 'utf8')))) {
  if (!settings.siteUrl) throw new Error('release.config.json: siteUrl is required to build canonical URLs');
  return settings.siteUrl.replace(/\/$/, '');
}

export function sitePages(origin = siteOrigin()) {
  const description = 'Unpolish puts a reversible lo-fi layer over your working prototype, so stakeholder reviews focus on structure, content and flow.';
  return [
    {
      file: 'index.html',
      path: '/',
      title: 'Unpolish — Less polish. Better conversations.',
      description,
      ogAlt: 'Less polish. Better conversations.',
    },
    {
      file: 'site/demo/index.html',
      path: '/site/demo/',
      title: 'Unpolish demo — Fieldtrip',
      description: 'A working prototype with Unpolish: reversible lo-fi review themes over a live offsite planner.',
      ogAlt: 'Less polish. Better conversations.',
    },
  ].map((p) => ({ ...p, url: origin + p.path, image: `${origin}/og.png` }));
}

export function sitemapUrls(origin = siteOrigin()) {
  return [
    `${origin}/`,
    `${origin}/site/demo/`,
    `${origin}/docs/VALIDATION.md`,
    `${origin}/unpolish/README.md`,
  ];
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function seoHead(page, { origin = siteOrigin(), noindex = false } = {}) {
  const url = page.url || origin + page.path;
  const image = page.image || `${origin}/og.png`;
  const robots = noindex ? 'noindex' : 'index,follow';
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<meta name="robots" content="${robots}">`,
    `<meta name="theme-color" content="#f7f6f2">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<link rel="icon" href="${esc(origin)}/site/favicon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${esc(origin)}/apple-touch-icon.png">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Unpolish">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="${OG_WIDTH}">`,
    `<meta property="og:image:height" content="${OG_HEIGHT}">`,
    `<meta property="og:image:alt" content="${esc(page.ogAlt || page.title)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
  ].join('\n  ');
}

export function robotsTxt(origin = siteOrigin()) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /examples/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(origin = siteOrigin()) {
  const urls = sitemapUrls(origin).map((loc) => `  <url>\n    <loc>${esc(loc)}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const SEO_START = '<!--seo-->';
const SEO_END = '<!--/seo-->';

export function withSeoRegion(html, inner) {
  const block = `${SEO_START}\n  ${inner}\n  ${SEO_END}`;
  if (html.includes(SEO_START) && html.includes(SEO_END)) {
    return html.replace(new RegExp(`${SEO_START}[\\s\\S]*?${SEO_END}`), block);
  }
  if (/<meta name="viewport"[^>]*>/i.test(html)) {
    return html.replace(/(<meta name="viewport"[^>]*>)/i, `$1\n  ${block}`);
  }
  return html.replace(/<head>/i, `<head>\n  ${block}`);
}

export function applySiteSeo({ origin = siteOrigin() } = {}) {
  for (const page of sitePages(origin)) {
    const file = join(root, page.file);
    const html = readFileSync(file, 'utf8');
    writeFileSync(file, withSeoRegion(html, seoHead(page, { origin })));
  }
  writeFileSync(join(root, 'robots.txt'), robotsTxt(origin));
  writeFileSync(join(root, 'sitemap.xml'), sitemapXml(origin));
  return origin;
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return import.meta.url === pathToFileURL(resolve(process.argv[1])).href; } catch { return false; }
}

if (invokedDirectly()) {
  const origin = applySiteSeo();
  console.log(`SEO written for ${origin}`);
}
