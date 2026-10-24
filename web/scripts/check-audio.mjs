// Offline render check: renders 20 s of several themes with OfflineAudioContext in headless Chrome and asserts
// no NaN, peak <= 0.95 and non-silent output. Usage: node scripts/check-audio.mjs   (starts its own vite dev server)
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vite = spawn('npx', ['vite', '--port', '4393', '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' });
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9344', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'sr-audio-'))}`, 'about:blank'], { stdio: 'ignore' });
let ok = false;
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9344/json/list')).json()).find((t) => t.type === 'page'); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await sleep(2500);
  await send('Page.navigate', { url: 'http://127.0.0.1:4393/scripts/audio-check.html' });
  await sleep(3000);
  const res = await send('Runtime.evaluate', { expression: 'window.runCheck()', awaitPromise: true, returnByValue: true });
  const rows = res.result?.result?.value;
  if (!rows) throw new Error(JSON.stringify(res));
  ok = true;
  for (const r of rows) {
    const pass = r.nan === 0 && r.peak <= 0.95 && r.rms > 0.005 && r.voices < 24;
    console.log(pass ? 'PASS' : 'FAIL', JSON.stringify(r));
    ok = ok && pass;
  }
} catch (e) { console.error(e); } finally { proc.kill(); vite.kill(); }
console.log(ok ? 'audio check OK' : 'audio check FAILED');
process.exit(ok ? 0 : 1);
