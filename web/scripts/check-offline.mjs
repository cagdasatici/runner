// Proves the built game works offline: loads it in headless Chrome, waits for the service worker
// to cache everything, switches the network off, reloads, and checks the game still starts.
// Usage: node scripts/check-offline.mjs http://127.0.0.1:4391/   (with `npx vite preview` running)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:4391/';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-offline-'));
const port = 9333;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CHROME_FLAGS ?? '').split(' ').filter(Boolean), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = false;
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => (await Promise.race([   // give up after 20 s instead of hanging
    send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
    sleep(20000).then(() => ({ result: { result: { value: { error: 'timed out after 20 s' } } } })),
  ])).result?.result?.value;

  await send('Network.enable');
  await send('Page.navigate', { url });
  await sleep(4000);
  const sw = await evaluate(`(async () => {
    const reg = await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const files = keys.length ? (await (await caches.open(keys[0])).keys()).map((q) => new URL(q.url).pathname) : [];
    return { active: reg.active?.state, caches: keys, files };
  })()`);
  console.log('service worker:', JSON.stringify(sw));

  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Page.reload', { ignoreCache: false });
  await sleep(4000);
  const page = await evaluate(`({ online: navigator.onLine, title: document.title,
    play: !!document.getElementById('play'), canvas: !!document.querySelector('canvas#gl'),
    scripts: performance.getEntriesByType('resource').length })`);
  console.log('offline reload:', JSON.stringify(page));
  ok = sw?.active === 'activated' && sw.files.length >= 8 && page?.title === 'Subway Runner' && page.play && page.canvas;
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'OFFLINE CHECK PASSED' : 'OFFLINE CHECK FAILED');
process.exit(ok ? 0 : 1);
