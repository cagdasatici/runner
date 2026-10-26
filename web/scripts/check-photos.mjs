// Finish photo wave check: arel/nora show #photo-wave (wave, then finale), fox never does.
// Usage: node scripts/check-photos.mjs http://localhost:5173/ /tmp/photo-shots   (dev server running). Screenshots show private photos: never commit them.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173/';
const outDir = process.argv[3] ?? '/tmp/photo-shots';
mkdirSync(outDir, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-photo-'));
const port = 9338;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
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
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const shot = async (name) => writeFileSync(join(outDir, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  ok = true;
  for (const char of ['arel', 'nora', 'fox']) {
    await send('Page.navigate', { url: `${base}?char=${char}&level=1&autoplay=1&skip=25&debug=1` });
    await sleep(3000);
    // poll every 50 ms: when finished, note the time the overlay first appears
    let tFin = 0, seen = false, shots = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const fin = await evaluate('runnerDebug().finished === true');
      if (fin && !tFin) tFin = Date.now();
      if (tFin) {
        const has = await evaluate('!!document.getElementById("photo-wave")');
        if (has) seen = true;
        const el = (Date.now() - tFin) / 1000;
        if (char !== 'fox' && shots === 0 && el >= 1.0) { await shot(`photo-${char}-wave.png`); shots = 1; }
        if (char !== 'fox' && shots === 1 && el >= 3.8) { await shot(`photo-${char}-finale.png`); shots = 2; }
        if (el > 6.5) break;
      }
      await sleep(50);
    }
    const left = await evaluate('!!document.getElementById("photo-wave")');
    console.log(char, 'finished', !!tFin, 'overlay seen', seen, 'left over after 6.5s', left, 'shots', shots);
    if (char === 'fox' ? seen : !(seen && !left && shots === 2)) ok = false;
  }
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'PHOTO CHECK PASSED' : 'PHOTO CHECK FAILED');
process.exit(ok ? 0 : 1);
