// Screenshots the character select and every character in each pose (820x1180 @2x), and prints draw calls / frame cost.
// Usage: node scripts/check-characters.mjs http://127.0.0.1:4393/ screenshots   (with `npx vite preview` running)
// Optional env: ONLY=shiba (one character), POSES=run,slide
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4393/';
const dir = process.argv[3] ?? 'screenshots';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-chars-'));
const port = 9337;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chars = process.env.ONLY ? [process.env.ONLY] : ['adventurer', 'shiba', 'cat', 'fox', 'maltese'];
const poses = (process.env.POSES ?? 'run,jump,slide,crash,fly,board,stumble,celebrate').split(',');

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
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) console.log('console.' + d.params.type, d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)); if (d.method === 'Runtime.exceptionThrown') console.log('exception', d.params.exceptionDetails.exception?.description?.slice(0, 400)); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
  const shot = async (name) => writeFileSync(join(dir, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });

  for (const c of chars) {
    await send('Page.navigate', { url: `${base}?char=${c}&debug=1` });
    await sleep(5000);
    await shot(`characters-menu-${c}.png`);
    console.log(c, 'menu', await evaluate(`document.querySelector('canvas#gl') ? 'ok' : 'no canvas'`));
    for (const pose of poses) {
      await send('Page.navigate', { url: `${base}?level=1&autoplay=1&idle=1&skip=${pose === 'run' ? 3 : 1}&char=${c}&pose=${pose === 'run' ? 'none' : pose}&debug=1` });
      await sleep(5000);
      await shot(`characters-${c}-${pose}.png`);
      const fps = await evaluate(`document.body.innerText.match(/\\d+ fps · \\d+ draws/)?.[0]`);
      console.log(c, pose, fps);
    }
  }
} finally {
  proc.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
