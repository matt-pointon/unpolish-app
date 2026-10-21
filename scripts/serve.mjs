// Minimal static file server for the site, examples and tests.
// Usage: node scripts/serve.mjs [port]
// Without a port it starts at 4173 and moves to the next free port if that one is taken.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixed = process.argv[2] || process.env.PORT;
let port = Number(fixed || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    let info = await stat(file).catch(() => null);
    if (info && info.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
    // SPA fallback for example apps built with history routing.
    if (!info) {
      const spa = path.match(/^\/examples\/([^/]+)\/dist\//);
      if (spa) { file = join(root, 'examples', spa[1], 'dist', 'index.html'); info = await stat(file).catch(() => null); }
    }
    if (!info) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  if (fixed) {
    console.error(`Port ${port} is already in use — probably an earlier server is still running.`);
    console.error(`Stop it (Ctrl+C in its terminal, or: lsof -ti :${port} | xargs kill), or pick another port: node scripts/serve.mjs ${port + 1}`);
    process.exit(1);
  }
  console.log(`Port ${port} is busy (an earlier server may still be running); trying ${port + 1}…`);
  port += 1;
  server.listen(port);
});
server.on('listening', () => console.log(`Unpolish site running at http://localhost:${port}  (Ctrl+C to stop)`));
server.listen(port);
