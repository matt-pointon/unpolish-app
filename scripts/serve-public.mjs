// Serves ./public with the same trailing-slash, SPA-fallback and cache behaviour
// as vercel.json, so Playwright can check the hosted site locally.
//
//   node scripts/serve-public.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cacheControl, compileVercel, spaDestination } from './site-routing.mjs';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = join(repo, 'public');
const vercel = compileVercel(JSON.parse(readFileSync(join(repo, 'vercel.json'), 'utf8')));

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.tgz': 'application/gzip',
};

function lastSegment(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function startPublicServer(port, { required = true } = {}) {
  if (required && !existsSync(join(root, 'index.html'))) {
    console.error('public/ is missing. Run npm run build:site first.');
    process.exit(1);
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      if (path !== '/' && !path.startsWith('/')) path = '/' + path;

      if (vercel.trailingSlash && path !== '/' && !path.endsWith('/') && !lastSegment(path).includes('.')) {
        res.writeHead(308, { location: path + '/' + url.search, 'cache-control': 'no-cache' });
        res.end();
        return;
      }

      let file = join(root, path);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      let info = await stat(file).catch(() => null);
      if (info && info.isDirectory()) {
        file = join(file, 'index.html');
        info = await stat(file).catch(() => null);
      }

      if (!info) {
        const candidates = [path, path.endsWith('/') ? path.slice(0, -1) : `${path}/`];
        let rewrite = null;
        for (const c of candidates) {
          rewrite = spaDestination(vercel.rewrites, c);
          if (rewrite) break;
        }
        if (rewrite) {
          file = join(root, rewrite);
          info = await stat(file).catch(() => null);
        }
      }

      if (!info) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' }).end('Not found');
        return;
      }
      const body = await readFile(file);
      const type = types[extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control': cacheControl(vercel.headers, path) });
      res.end(body);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  return new Promise((resolveListen, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      console.log(`Unpolish public/ at http://localhost:${port}  (Ctrl+C to stop)`);
      resolveListen(server);
    });
  });
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return import.meta.url === pathToFileURL(resolve(process.argv[1])).href; } catch { return false; }
}

if (invokedDirectly()) {
  const fixed = process.argv[2] || process.env.PORT;
  startPublicServer(Number(fixed || 4175)).catch((e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${e.port || fixed || 4175} is already in use.`);
      process.exit(1);
    }
    throw e;
  });
}
