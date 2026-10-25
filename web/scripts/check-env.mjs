// Environment screenshots + render stats in headless Chrome (820x1180). Saves <dir>/env-*.png and prints draws/triangles
// and the mean software-renderer frame time (relative numbers only: swiftshader is a CPU rasteriser).
// Usage: node scripts/check-env.mjs http://127.0.0.1:4394/ screenshots [quality=high|low] [levels=1,12,...]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4394/';
const dir = process.argv[3] ?? 'screenshots';
const quality = process.argv[4] ?? 'high';
const levels = (process.argv[5] ?? '1,12,25,45,70,100,120').split(',').map(Number);
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-env-'));
const port = 9341;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const shot = async (name) => writeFileSync(join(dir, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });
  const stats = async () => evaluate(`new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 20) requestAnimationFrame(f); else res({ ms: (performance.now() - t0) / 20, ...subwayRunnerDebug() }); }; requestAnimationFrame(f); })`);
  const shotAt = async (name, q) => {
    await send('Page.navigate', { url: base + q });
    for (let i = 0; i < 60; i++) { await sleep(500); if (await evaluate(`typeof subwayRunnerDebug === 'function'`)) break; }
    await sleep(2500);
    await shot(name);
    const s = await stats();
    console.log(name.padEnd(22), `draws ${s.draws}  tris ${s.tris}  quality ${s.quality}  ${s.ms.toFixed(0)} ms/frame (swiftshader)`);
  };
  await shotAt(`env-menu.png`, `?debug=1&quality=${quality}`);
  for (const n of levels) await shotAt(`env-level${n}.png`, `?level=${n}&autoplay=1&skip=${n >= 10 ? 14 : 6}&debug=1&quality=${quality}`);
} finally { proc.kill(); }
