// Plays the built game like an iPad: 820×1180 viewport, 2× pixels, touch events only.
// Taps PLAY, swipes right, and checks the runner changed lane. Then saves a screenshot.
// Usage: node scripts/check-touch.mjs http://127.0.0.1:4391/ shot.png   (with `npx vite preview` running)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4391/';
const shotPath = process.argv[3] ?? 'touch-check.png';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-touch-'));
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
  const evaluate = async (expr) => (await Promise.race([   // give up after 20 s instead of hanging
    send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
    sleep(20000).then(() => ({ result: { result: { value: { error: 'timed out after 20 s' } } } })),
  ])).result?.result?.value;
  const touch = async (type, x, y) => send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });

  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: base + '?debug=1&seed=1' });
  await sleep(3000);
  const btn = await evaluate(`(() => { const r = document.getElementById('play').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await touch('touchStart', btn.x, btn.y);
  await touch('touchEnd');
  await sleep(1500);
  const before = await evaluate('subwayRunnerDebug()');
  // swipe right in 5 small steps, like a finger
  await touch('touchStart', 300, 700);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', 300 + i * 30, 700); await sleep(16); }
  await touch('touchEnd');
  await sleep(2500);
  const after = await evaluate('subwayRunnerDebug()');
  console.log('before swipe:', JSON.stringify(before));
  console.log('after swipe: ', JSON.stringify(after));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));
  ok = before?.mode === 'playing' && before.lane === 1 && after?.lane === 2;
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'TOUCH CHECK PASSED' : 'TOUCH CHECK FAILED');
process.exit(ok ? 0 : 1);
