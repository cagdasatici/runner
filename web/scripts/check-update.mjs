// Proves in-app updates: opens the production preview, lets the service worker take control, rebuilds
// (new build id), fires visibilitychange on the menu and expects a reload with ?v= on the new version,
// with localStorage untouched. Usage: node scripts/check-update.mjs http://localhost:4173/?debug=1
// (with `npx vite preview --port 4173` running; this script runs `npm run build` itself for the rebuild)
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:4173/?debug=1';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-update-'));
const port = 9334;
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
  const evaluate = async (expr) => (await Promise.race([
    send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
    sleep(20000).then(() => ({ result: { result: { value: { error: 'timed out after 20 s' } } } })),
  ])).result?.result?.value ?? 'EVALFAIL';

  await send('Page.navigate', { url });
  await sleep(4000);
  await evaluate(`navigator.serviceWorker.ready.then(() => localStorage.setItem('character', 'nora'))`);
  await send('Page.reload');
  await sleep(4000);
  for (let i = 0; i < 60 && !(await evaluate(`typeof runnerDebug === 'function'`)); i++) await sleep(1000); // software renderer is slow
  const before = await evaluate(`({ controller: !!navigator.serviceWorker.controller, v: runnerDebug().version, screen: runnerDebug().screen })`);
  console.log('before:', JSON.stringify(before));

  execSync('npm run build', { stdio: 'ignore' }); // new build id; the running preview serves dist/ from disk
  await sleep(1500);
  await evaluate(`Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`);
  for (let i = 0; i < 12 && !(await evaluate(`location.search.includes('v=')`)); i++) await sleep(1000);
  await sleep(3000);
  const after = await evaluate(`(async () => ({ href: location.href, remote: await (await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })).json(), label: document.getElementById('version').textContent, character: localStorage.getItem('character') }))()`);
  console.log('after:', JSON.stringify(after));
  ok = before?.controller && before.screen === 'menu' && after?.href.includes('?v=') && after.href.endsWith('?v=' + after.remote.version) && after.remote.version !== before.v && after.label === 'v ' + after.remote.label && after.character === 'nora';
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'UPDATE CHECK PASSED' : 'UPDATE CHECK FAILED');
process.exit(ok ? 0 : 1);
