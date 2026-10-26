// Tiny static HTTPS server for the built game (no dependencies). Serves one folder on the home network.
// Usage: node serve-https.mjs --dir <site folder> --cert <cert.pem> --key <key.pem> [--port 8843]
// Started at login by launchd (see Task W8). Files are read from disk on every request, so a new
// deploy is live immediately without a restart.
import { createServer } from 'node:https';
import { readFileSync, createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const root = resolve(args.dir ?? 'dist');
const port = Number(args.port ?? 8843);
const tls = { cert: readFileSync(args.cert), key: readFileSync(args.key) };

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
};

/** sw.js, html and the manifest must always be re-checked so updates reach the iPad; hashed assets never change. */
function cacheControl(path) {
  if (path.endsWith('version.json') || path.endsWith('index.json')) return 'no-store';
  if (path.includes(`${sep}assets${sep}`)) return 'public, max-age=31536000, immutable';
  if (/\.(html|webmanifest)$/.test(path) || path.endsWith(`${sep}sw.js`)) return 'no-cache';
  return 'public, max-age=86400';
}

const server = createServer(tls, (req, res) => {
  const started = Date.now();
  const done = (status) => console.log(`${new Date().toISOString()} ${status} ${req.method} ${req.url} ${Date.now() - started}ms`);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return done(405); }
  let path;
  try {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'https://x').pathname);
    path = normalize(join(root, urlPath));
  } catch { res.writeHead(400).end(); return done(400); }
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return done(403); } // no ../ escapes
  try {
    if (statSync(path).isDirectory()) path = join(path, 'index.html');
    const st = statSync(path);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cacheControl(path),
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') { res.end(); return done(200); }
    createReadStream(path).pipe(res);
    done(200);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    done(404);
  }
});
server.listen(port, '0.0.0.0', () => console.log(`Runner serving ${root} on https://0.0.0.0:${port}`));
