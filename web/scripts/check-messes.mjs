// Dog mess check: Bella gets poop, Toby a puddle (?debug=1&mess=...), the adventurer must never see a mess.
// Looks at the track ahead, then the reaction close-up; saves PNGs into the directory given as 2nd argument (never commit them).
// Usage: node scripts/check-messes.mjs http://localhost:5173/ /tmp/mess-shots   (with `npm run dev -- --port 5173` running)
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4391/';
const outDir = process.argv[3] ?? 'screenshots';
mkdirSync(outDir, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-mess-'));
const port = 9337;
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
  const state = () => evaluate('runnerDebug()');
  const until = async (pred, ms = 30000) => { const t0 = Date.now(); for (;;) { const s = await state(); if (s && pred(s)) return s; if (Date.now() - t0 > ms) throw new Error('timeout waiting for ' + pred); await sleep(25); } };
  const shot = async (name) => writeFileSync(join(outDir, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  ok = true;
  for (const [char, kind] of [['maltese', 'poop'], ['toby', 'pee']]) {
    await send('Page.navigate', { url: `${base}?char=${char}&level=1&debug=1&mess=${kind}` });
    await sleep(3000);
    await until((s) => s.tick >= 155);
    await shot(`mess-${kind}.png`);
    await until((s) => s.messTicks > 0);
    await sleep(700);
    const shown = await evaluate(`!document.getElementById('reaction').classList.contains('hidden') && document.getElementById('reaction').textContent`);
    await shot(`mess-${kind}-reaction.png`);
    const s = await state();
    console.log(char, kind, 'messTicks', s.messTicks, 'crashed', s.crashed, 'reaction', shown);
    if (s.crashed || !shown) ok = false;
  }
  // a character without messes: none on the track after 20 s of play
  await send('Page.navigate', { url: `${base}?char=adventurer&level=1&debug=1&autoplay=1` });
  await sleep(3000);
  await until((s) => s.tick > 2400, 60000);
  const a = await state();
  console.log('adventurer messes on track', a.messes, 'crashed', a.crashed);
  if (a.messes !== 0) ok = false;
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'MESS CHECK PASSED' : 'MESS CHECK FAILED');
process.exit(ok ? 0 : 1);
