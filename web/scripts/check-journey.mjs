// Checks the journey screens in the built game, like an iPad (820×1180, 2× pixels):
// 1) the autopilot plays level 1 to the results card (3 stars, 70/70 coins) and the progress is saved,
// 2) the map then shows level 1 done and level 2 as next,
// 3) an idle runner on level 3 gets the "Oops!" card.
// Saves screenshots: <dir>/journey-results.png, journey-map.png, journey-crash.png
// Usage: node scripts/check-journey.mjs http://127.0.0.1:4391/ screenshots   (with `npx vite preview` running)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4391/';
const dir = process.argv[3] ?? 'screenshots';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-journey-'));
const port = 9335;
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
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
  const shot = async (name) => writeFileSync(join(dir, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  /** Polls subwayRunnerDebug() until its screen is `want` (up to 60 s; the software renderer is slow). */
  const waitScreen = async (want) => {
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      const d = await evaluate(`typeof subwayRunnerDebug === 'function' ? subwayRunnerDebug() : null`);
      if (d?.screen === want) return d;
    }
    return null;
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });

  await send('Page.navigate', { url: base + '?level=1&autoplay=1&skip=60&debug=1' });
  const done = await waitScreen('results');
  await sleep(3500); // let the stars pop and the coins count up
  const card = await evaluate(`({ coins: document.getElementById('r-coins').textContent, cheer: document.getElementById('r-cheer').textContent,
    lit: document.querySelectorAll('#results .bs.on').length })`);
  console.log('results:', JSON.stringify(done), JSON.stringify(card));
  await shot('journey-results.png');

  await send('Page.navigate', { url: base + '?debug=1' });
  await waitScreen('menu');
  await evaluate(`document.getElementById('play').click()`);
  const map = await waitScreen('map');
  await sleep(1000);
  const nodes = await evaluate(`[1, 2, 3].map((n) => document.querySelector('.node[data-level="' + n + '"]').className)`);
  console.log('map:', JSON.stringify(map), JSON.stringify(nodes));
  await shot('journey-map.png');

  await send('Page.navigate', { url: base + '?level=3&autoplay=1&idle=1&skip=30&debug=1' });
  const crash = await waitScreen('over');
  await sleep(800);
  const title = await evaluate(`document.getElementById('over-title').textContent`);
  console.log('crash:', JSON.stringify(crash), title);
  await shot('journey-crash.png');

  ok = done?.finished === true && done.stars === 3 && card?.coins === '70/70' && card.cheer === 'PERFECT!' && card.lit === 3
    && map?.unlocked === 2 && map.totalStars === 3 && nodes?.[0] === 'node done' && nodes[1] === 'node now' && nodes[2] === 'node locked'
    && crash?.crashed === true && title === 'Oops!';
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'JOURNEY CHECK PASSED' : 'JOURNEY CHECK FAILED');
process.exit(ok ? 0 : 1);
