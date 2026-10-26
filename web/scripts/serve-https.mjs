// Tiny static HTTPS server for the built game (no dependencies). Serves one folder on the home network.
// Usage: node serve-https.mjs --dir <site folder> --cert <cert.pem> --key <key.pem> [--port 8843]
// Started at login by launchd (see Task W8). Files are read from disk on every request, so a new
// deploy is live immediately without a restart.
import { createServer } from 'node:https';
import { readFileSync, createReadStream, statSync, mkdirSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
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

// --- push notifications: keys and subscriptions live in $SITE/push, outside the served folder ---
const PUSH_DIR = resolve(root, '..', 'push');
const VAPID_FILE = join(PUSH_DIR, 'vapid.json');
const SUBS_FILE = join(PUSH_DIR, 'subscriptions.json');
const PUSH_HOSTS = ['push.apple.com', 'fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com'];
const WHO = ['arel', 'nora', 'other'];
const MAX_BODY = 4096;
mkdirSync(PUSH_DIR, { recursive: true, mode: 0o700 });
chmodSync(PUSH_DIR, 0o700);
function loadVapid() {
  try {
    const v = JSON.parse(readFileSync(VAPID_FILE, 'utf8'));
    if (typeof v?.publicKey === 'string' && typeof v?.privateKey === 'string') return v;
  } catch { /* missing or corrupt: regenerate below */ }
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]); // 0x04 || x || y
  const v = { publicKey: raw.toString('base64url'), privateKey: priv.d };
  writeFileSync(`${VAPID_FILE}.tmp`, JSON.stringify(v), { mode: 0o600 });
  renameSync(`${VAPID_FILE}.tmp`, VAPID_FILE);
  console.log('Generated push keys (public key only is ever logged).');
  return v;
}
const vapidPublic = loadVapid().publicKey;

function readSubs() {
  try { const a = JSON.parse(readFileSync(SUBS_FILE, 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; }
}
function writeSubs(list) { // atomic: write a temp file, then rename over the real one
  writeFileSync(`${SUBS_FILE}.tmp`, JSON.stringify(list, null, 2), { mode: 0o600 });
  renameSync(`${SUBS_FILE}.tmp`, SUBS_FILE);
}
const hostOk = (host) => PUSH_HOSTS.some((h) => host === h || host.endsWith('.' + h));
function endpointHost(endpoint) {
  try { const u = new URL(endpoint); return u.protocol === 'https:' && hostOk(u.hostname) ? u.hostname : null; } catch { return null; }
}

/** Reads a small JSON body; resolves null (and answers 413) when it is larger than MAX_BODY. */
function readJson(req, res) {
  return new Promise((ok) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { if (size - c.length <= MAX_BODY) ok({ tooBig: true }); return; } // answer 413, drop the rest
      chunks.push(c);
    });
    req.on('end', () => { if (size > MAX_BODY) return; try { ok({ json: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); } catch { ok({ json: undefined }); } });
    req.on('error', () => ok({ json: undefined }));
  });
}

async function handleApi(req, res, pathname, done) {
  const send = (status, body) => {
    const headers = { 'Cache-Control': 'no-store' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    res.writeHead(status, headers).end(body === undefined ? undefined : JSON.stringify(body));
    done(status);
  };
  if (pathname === '/api/push/key' && (req.method === 'GET' || req.method === 'HEAD')) return send(200, { publicKey: vapidPublic });
  if (req.method === 'POST' && (pathname === '/api/push/subscribe' || pathname === '/api/push/unsubscribe')) {
    const { tooBig, json } = await readJson(req, res);
    if (tooBig) { res.writeHead(413, { 'Cache-Control': 'no-store', Connection: 'close' }).end(); return done(413); }
    if (!json || typeof json !== 'object') return send(400);
    if (pathname === '/api/push/unsubscribe') {
      const host = endpointHost(json.endpoint);
      if (!host) return send(400);
      writeSubs(readSubs().filter((s) => s.subscription?.endpoint !== json.endpoint));
      console.log(`push unsubscribe ${host}`);
      return send(204);
    }
    const sub = json.subscription;
    const host = endpointHost(sub?.endpoint);
    if (!host || !WHO.includes(json.who) || typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') return send(400);
    const entry = { who: json.who, subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, addedAt: new Date().toISOString() };
    const list = readSubs();
    const i = list.findIndex((s) => s.subscription?.endpoint === sub.endpoint);
    if (i >= 0) list[i] = { ...entry, who: json.who === 'other' && ['arel', 'nora'].includes(list[i].who) ? list[i].who : entry.who, addedAt: list[i].addedAt ?? entry.addedAt }; // no downgrade from arel/nora to other
    else list.push(entry);
    writeSubs(list);
    console.log(`push subscribe ${json.who} ${host}`);
    return send(204);
  }
  res.writeHead(405, { Allow: 'GET, HEAD, POST', 'Cache-Control': 'no-store' }).end();
  return done(405);
}

const server = createServer(tls, (req, res) => {
  const started = Date.now();
  const done = (status) => console.log(`${new Date().toISOString()} ${status} ${req.method} ${(req.url ?? '').split('?')[0]} ${Date.now() - started}ms`);
  let apiPath = null;
  try { const p = new URL(req.url ?? '/', 'https://x').pathname; if (p.startsWith('/api/')) apiPath = p; } catch { /* handled below */ }
  if (apiPath) {
    handleApi(req, res, apiPath, done).catch(() => { if (!res.headersSent) res.writeHead(500, { 'Cache-Control': 'no-store' }).end(); done(500); });
    return;
  }
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
