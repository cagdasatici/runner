// Entry point: wires the DOM screens, input, audio and the game loop together.
// URL flags (mirroring the iOS launch arguments): ?autoplay=1  ?idle=1  ?seed=N  ?level=N (start journey level N, 1…120)
// Testing only: ?skip=S fast-forwards S seconds of play at start; ?debug=1 shows fps + draw calls.
import './style.css';
import { Audio } from './audio';
import { LEVEL_COUNT, levelSpec, type LevelRun } from './core/level';
import { ProgressStore } from './core/progress';
import { ScoreStore } from './core/scoreStore';
import { Game, type PowerHud } from './game';
import { CHARACTERS, characterById, saveCharacter, stepCharacter } from './gfx/characters';
import type { Move } from './core/runner';
import { tierFor } from './ui/tiers';
import { buildMap, refreshMap, scrollToLevel, STAR_SVG } from './ui/map';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const autoplay = params.get('autoplay') === '1';
const idle = params.get('idle') === '1';
const fixedSeed = params.get('seed');
const skip = Math.min(600, Math.max(0, Number(params.get('skip')) || 0));
const levelFlag = Number(params.get('level'));
const qualityFlag = (): 'low' | 'high' | undefined => { const q = params.get('quality'); return q === 'low' || q === 'high' ? q : undefined; };

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; }
}
const store = new ScoreStore(safeStorage());
const progress = new ProgressStore(safeStorage());
const audio = new Audio();
let current = 0; // journey level being played (0 = endless run)
let screen: 'menu' | 'map' | 'hud' | 'over' | 'results' = 'menu';
const timers: number[] = [];
const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
const cancelTimers = () => { while (timers.length) window.clearTimeout(timers.pop()); };

function newSeed(): bigint {
  if (fixedSeed && /^\d+$/.test(fixedSeed) && fixedSeed !== '0') return BigInt(fixedSeed);
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (BigInt(a[0]) << 32n) | BigInt(a[1] | 1);
}

const levelName = (n: number) => { const s = levelSpec(n); return `${s.world}-${s.inWorld}`; };

/** Counts a number up in `el` (ease-out) after `delay` ms. Cancelled by a newer count on the same element. */
const countTokens = new WeakMap<HTMLElement, number>();
function countUp(el: HTMLElement, to: number, delay = 250, dur = 900): void {
  const token = (countTokens.get(el) ?? 0) + 1;
  countTokens.set(el, token);
  el.textContent = '0';
  const t0 = performance.now() + delay;
  const tickFn = () => {
    if (countTokens.get(el) !== token) return;
    const k = Math.min(1, Math.max(0, (performance.now() - t0) / dur));
    el.textContent = String(Math.round(to * (1 - (1 - k) * (1 - k))));
    el.classList.toggle('counting', k < 1);
    if (k < 1) requestAnimationFrame(tickFn);
  };
  tickFn();
}

/** A gold sprite flies from where the coin was collected to the HUD counter (~0.4 s), then the counter pops. */
let flying = 0;
function flyCoin(px: number, py: number): void {
  const target = document.querySelector('#hud .pill.gold .coin') as HTMLElement | null;
  if (!target || flying >= 10) return;
  const r = target.getBoundingClientRect();
  const el = document.createElement('i');
  el.className = 'coin fly';
  el.style.left = `${px - 14}px`;
  el.style.top = `${py - 14}px`;
  document.body.appendChild(el);
  flying++;
  const done = () => {
    el.remove(); flying--;
    const pill = target.parentElement!;
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
  };
  if (!el.animate) { done(); return; }
  const a = el.animate([
    { transform: 'translate(0,0) scale(1.1)', opacity: 1 },
    { transform: `translate(${r.left + r.width / 2 - px}px, ${r.top + r.height / 2 - py}px) scale(0.7)`, opacity: 0.9 },
  ], { duration: 400, easing: 'cubic-bezier(.5,0,.9,.6)' });
  a.onfinish = done;
}

// Power-up state -> music/SFX: opens the top music layer, jetpack loop, landing ticks, pickup arpeggio.
let prevPow = { any: false, fly: false, landing: 0 };
function audioPower(p: { board: number; magnet: number; sneakers: number; double: number; fly: number; landing: number }): void {
  const fly = p.fly > 0, any = fly || p.board > 0 || p.magnet > 0 || p.sneakers > 0 || p.double > 0;
  if (any && !prevPow.any) audio.sfx('powerup');
  audio.setPowerUp(any);
  if (fly !== prevPow.fly) audio.sfx(fly ? 'jetpack' : 'jetpackStop');
  if (p.landing !== prevPow.landing && p.landing > 0) audio.sfx('warn', p.landing);
  prevPow = { any, fly, landing: p.landing };
}

const game = new Game($('gl'), {
  onBoost: (on) => { document.body.classList.toggle('boosting', on); audio.setBoost(on); },
  onCoinFly: flyCoin,
  onScore: (score, coins) => { $('score').textContent = String(score); $('coins').textContent = String(coins); },
  onSpeed: (v) => audio.setSpeed(v),
  onJump: () => audio.sfx('jump'),
  onCoin: () => audio.sfx('coin'),
  onStreak: (n) => {
    audio.sfx('powerup');
    const el = $('streak'); el.textContent = `COIN STREAK ×${n}!`;
    el.classList.remove('hidden'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    setTimeout(() => el.classList.add('hidden'), 1300);
  },
  onStar: (taken) => {
    audio.sfx('star');
    $('star-slots').querySelectorAll('span').forEach((s, i) => s.classList.toggle('got', i < taken));
  },
  onProgress: (f) => {
    $('progress-fill').style.width = `${f * 100}%`;
    $('progress-me').style.left = `${f * 100}%`;
  },
  onCrash: (score, coins) => {
    const newBest = current ? false : store.record(score); // journey levels have no high score
    audio.sfx('crash'); // also fades the music out
    navigator.vibrate?.(60);
    $('over-title').textContent = current ? 'Oops!' : 'Crash!';
    countUp($('over-score'), score, 450, 900);
    countUp($('over-coins'), coins, 450, 700);
    $('newbest').classList.toggle('hidden', !newBest);
    $('again').textContent = current ? 'Try Again' : 'Play Again';
    $('home').textContent = current ? 'Map' : 'Menu';
    later(350, () => show('over'));
  },
  onFinish: (run) => showResults(run),
  // Optional hook owned by audio.ts; guarded so this compiles whether or not it exists yet.
  onFinishLine: () => { audio.playFinishFanfare(); },
  onPower: (p) => { renderPowers(p); audioPower(p); },
  onToast: (text) => {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the animation
    el.classList.add('show');
    audio.sfx(text.startsWith('Close') ? 'nearmiss' : text.startsWith('Combo') ? 'combo' : text.startsWith('Board') ? 'boardbreak' : 'lane');
  },
}, qualityFlag());

const RING_ICONS: [keyof PowerHud, string][] = [['board', '🛹'], ['magnet', '🧲'], ['sneakers', '👟'], ['double', '×2'], ['fly', '🚀']];
function renderPowers(p: PowerHud): void {
  $('powers').innerHTML = RING_ICONS.filter(([k]) => (p[k] as number) > 0)
    .map(([k, icon]) => `<div class="ring${(p[k] as number) < 0.2 ? ' low' : ''}" style="--p:${Math.round((p[k] as number) * 100)}">${icon}</div>`).join('');
  document.body.classList.toggle('lightning', p.lightning);
  const fuel = $('fuel');
  const showFuel = p.fly > 0 || p.landing > 0;
  if (showFuel && fuel.classList.contains('hidden')) { fuel.classList.add('pop'); setTimeout(() => fuel.classList.remove('pop'), 450); }
  fuel.classList.toggle('hidden', !showFuel);
  $('fuel-label').textContent = p.fly > 0 ? 'JETPACK' : 'LANDING';
  fuel.classList.toggle('low', p.fly < 0.2);
  $('fuel-fill').style.width = `${Math.round(p.fly * 100)}%`;
  const land = $('landing');
  land.classList.toggle('hidden', p.landing === 0);
  land.textContent = p.landing > 0 ? `LANDING ${p.landing}` : '';
}

// "Start with a board" (chosen before a run, free): remembered on this device
const BOARD_KEY = 'start.board';
let startBoard = true;
try { startBoard = localStorage.getItem(BOARD_KEY) !== '0'; } catch { /* blocked storage: keep the default */ }
function paintBoardToggle(): void {
  const b = $('board-toggle');
  b.textContent = `🛹 Board: ${startBoard ? 'ON' : 'OFF'}`;
  b.setAttribute('aria-pressed', String(startBoard));
}
paintBoardToggle();
$('board-toggle').addEventListener('click', () => {
  startBoard = !startBoard;
  try { localStorage.setItem(BOARD_KEY, startBoard ? '1' : '0'); } catch { /* ignore */ }
  paintBoardToggle();
});
const runOptions = () => ({ board: startBoard, friendly: true });

function show(s: typeof screen): void {
  screen = s;
  if (s !== 'hud') { $('fuel').classList.add('hidden'); document.body.classList.remove('lightning'); }
  if (s === 'menu' || s === 'map') { $('powers').innerHTML = ''; $('landing').classList.add('hidden'); }
  $('menu').classList.toggle('hidden', s !== 'menu');
  $('map').classList.toggle('hidden', s !== 'map');
  $('hud').classList.toggle('hidden', s !== 'hud' && s !== 'over' && s !== 'results');
  $('over').classList.toggle('hidden', s !== 'over');
  $('results').classList.toggle('hidden', s !== 'results');
}

function goMenu(): void {
  cancelTimers();
  current = 0;
  game.showMenu();
  $('best').textContent = String(store.best);
  $('total-stars').textContent = String(progress.totalStars);
  show('menu');
  audio.playMusic('menu');
}

const mapScroll = $('map-scroll');
buildMap(mapScroll, (n) => { audio.unlock(); playLevel(n); });

function goMap(): void {
  cancelTimers();
  current = 0;
  game.showMenu(); // the 3D scene is hidden behind the map and not drawn (see loop)
  refreshMap(mapScroll, progress);
  $('map-stars').textContent = String(progress.totalStars);
  show('map');
  scrollToLevel(mapScroll, progress.unlocked);
  audio.playMusic('menu');
}

function resetHud(level: boolean): void {
  $('score').textContent = '0';
  $('coins').textContent = '0';
  $('hud').classList.toggle('level', level);
  $('level-bar').classList.toggle('hidden', !level);
  $('star-slots').classList.toggle('hidden', !level);
  $('score-pill').classList.toggle('hidden', level);
  $('star-slots').querySelectorAll('span').forEach((s) => { s.classList.remove('got'); s.innerHTML = STAR_SVG; });
  $('progress-fill').style.width = '0%';
  $('progress-me').style.left = '0%';
  $('powers').innerHTML = '';
  $('landing').classList.add('hidden');
}

function playEndless(): void {
  cancelTimers();
  current = 0;
  resetHud(false);
  game.startRun(newSeed(), autoplay, idle, autoplay ? skip : 0, runOptions());
  show('hud');
  audio.playMusic({ mode: 'endless' });
}

function playLevel(n: number): void {
  cancelTimers();
  current = n;
  resetHud(true);
  $('level-chip').textContent = levelName(n);
  game.startLevel(n, autoplay, idle, autoplay ? skip : 0, runOptions());
  show('hud');
  audio.playMusic({ mode: 'run', world: levelSpec(n).world });
}

const CONFETTI_COLORS = ['#f472b6', '#60a5fa', '#fde047', '#4ade80', '#fb923c', '#c084fc'];
/** Falling confetti over the results card; higher tiers also get star-shaped pieces. */
function confetti(count: number, rank: number): void {
  const box = $('r-confetti');
  box.textContent = '';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    if (rank >= 2 && i % 4 === 0) p.className = 'star';
    p.style.cssText = `left:${Math.random() * 100}%;--c:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};` +
      `--dl:${(Math.random() * 1.6).toFixed(2)}s;--du:${(2.2 + Math.random() * 1.8).toFixed(2)}s;--dx:${Math.round(Math.random() * 120 - 60)}px;--r:${Math.round(Math.random() * 720)}deg`;
    box.appendChild(p);
  }
}

function showResults(run: LevelRun): void {
  const n = run.level.spec.n, stars = run.stars;
  const newBest = progress.record(n, stars);
  audio.playMusic({ mode: 'results', world: run.level.spec.world });
  // the finish fanfare (started at the line) covers the win sting
  $('r-level').textContent = `LEVEL ${levelName(n)}`;
  document.querySelectorAll<HTMLElement>('#results .bs').forEach((el, i) => {
    el.innerHTML = `<span class="empty">${STAR_SVG}</span><span class="full">${STAR_SVG}</span>`;
    el.classList.toggle('on', i < stars);
    el.style.setProperty('--d', `${0.55 + i * 0.4}s`);
    if (i < stars) later(550 + i * 400 + 250, () => audio.sfx('star'));
  });
  const total = run.level.totalCoins, coins = run.state.coins;
  const tier = tierFor({ stars, goldenStars: run.starsTaken.size, coins, totalCoins: total });
  $('r-card').dataset.tier = tier.id;
  $('r-cheer').textContent = tier.label;
  $('r-tier').textContent = tier.id.toUpperCase();
  confetti(tier.confetti, tier.rank);
  $('r-gold').innerHTML = [0, 1, 2].map((i) => `<i class="${i < run.starsTaken.size ? 'got' : ''}">${STAR_SVG}</i>`).join('');
  show('results'); // first, so the count-up below sees screen === 'results'; un-hiding also restarts the CSS animations
  // roof coins are a bonus beyond the level total: show them separately instead of e.g. 77/75
  const bonus = Math.max(0, coins - total);
  $('r-total').textContent = bonus ? `/${total} +${bonus} bonus` : `/${total}`;
  let shown = -1;
  const t0 = performance.now();
  const count = () => { // coins count up over 1.2 s, starting after 0.5 s
    const k = Math.min(1, Math.max(0, (performance.now() - t0 - 500) / 1200));
    const c = Math.round(Math.min(coins, total || coins) * k);
    if (c !== shown) {
      shown = c;
      const el = $('r-coins');
      el.textContent = String(c);
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); // restart the tick animation
    }
    $('r-cfill').style.width = `${total ? Math.min(1, c / total) * 100 : 0}%`;
    if (k < 1 && screen === 'results') requestAnimationFrame(count);
  };
  count();
  $('r-best').classList.toggle('hidden', !newBest || stars < 2);
  $('r-next').classList.toggle('hidden', n >= LEVEL_COUNT);
}

// --- character select: arrows, swipe on the 3D preview; the choice is remembered (localStorage 'character') ---
const dots = $('char-dots');
dots.innerHTML = CHARACTERS.map(() => '<i></i>').join('');
function showCharacter(): void {
  const id = game.character;
  $('char-name').textContent = characterById(id).name;
  dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', CHARACTERS[i].id === id));
}
function stepChar(step: number): void {
  const id = stepCharacter(game.character, step);
  game.setCharacter(id);
  saveCharacter(id);
  showCharacter();
  audio.sfx('coin');
}
const charFlag = params.get('char');
if (charFlag && CHARACTERS.some((c) => c.id === charFlag)) game.setCharacter(charFlag);
const poseFlag = params.get('pose');
if (poseFlag) game.debugPose = poseFlag;
showCharacter();
$('prev-char').addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); stepChar(-1); });
$('next-char').addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); stepChar(1); });
{
  let sx: number | null = null;
  const swipe = $('swipe');
  swipe.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  swipe.addEventListener('pointerup', (e) => {
    if (sx !== null && Math.abs(e.clientX - sx) > 40) { audio.unlock(); stepChar(e.clientX < sx ? 1 : -1); }
    sx = null;
  });
  swipe.addEventListener('pointercancel', () => { sx = null; });
}

// --- buttons ---
const tapped = (id: string, fn: () => void) => $(id).addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); fn(); });
tapped('play', goMap);
tapped('endless', playEndless);
tapped('again', () => (current ? playLevel(current) : playEndless()));
tapped('home', () => (current ? goMap() : goMenu()));
tapped('exit', () => (current ? goMap() : goMenu()));
tapped('map-home', goMenu);
tapped('r-map', goMap);
tapped('r-retry', () => playLevel(current));
tapped('r-next', () => playLevel(Math.min(LEVEL_COUNT, current + 1)));
tapped('mute', () => {
  audio.setMuted(!audio.muted);
  syncMuteIcon();
  if (!audio.muted) audio.playMusic('menu');
});
function syncMuteIcon(): void {
  $('icon-sound').classList.toggle('hidden', audio.muted);
  $('icon-muted').classList.toggle('hidden', !audio.muted);
}
syncMuteIcon();

// --- swipes: one move per swipe, fired as soon as the finger has moved 24 px ---
const SWIPE_PX = 24;
let start: { x: number; y: number; id: number; fired: boolean } | null = null;
// Hold-to-boost: a press that stays put (no swipe) for HOLD_MS speeds the run up until release (Boost in core/runner.ts).
const HOLD_MS = 150;
let holdTimer = 0;
const releaseBoost = () => { clearTimeout(holdTimer); game.setBoost(false); };
window.addEventListener('pointerdown', (e) => {
  audio.unlock();
  start = { x: e.clientX, y: e.clientY, id: e.pointerId, fired: false };
  clearTimeout(holdTimer);
  if (screen === 'hud' && !(e.target as Element).closest?.('button')) {
    holdTimer = window.setTimeout(() => { if (start && !start.fired) game.setBoost(true); }, HOLD_MS);
  }
});
window.addEventListener('pointermove', (e) => {
  if (!start || start.fired || e.pointerId !== start.id) return;
  const dx = e.clientX - start.x, dy = e.clientY - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  start.fired = true;
  releaseBoost(); // it became a swipe
  const move: Move = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  game.queue(move);
});
const endSwipe = () => { start = null; releaseBoost(); };
window.addEventListener('pointerup', endSwipe);
window.addEventListener('pointercancel', endSwipe);
// keyboard for testing on a computer
const keys: Record<string, Move> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
window.addEventListener('keydown', (e) => { if (e.key === ' ' && screen === 'hud') { e.preventDefault(); game.setBoost(true); return; } const m = keys[e.key]; if (m) { e.preventDefault(); if (e.repeat) return; game.queue(m); } });
window.addEventListener('keyup', (e) => { if (e.key === ' ') game.setBoost(false); });
window.addEventListener('blur', releaseBoost);
// iPad Safari: block pinch-zoom, double-tap zoom and the context menu; only the map may scroll
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (!(e.target as Element).closest?.('.scroll')) e.preventDefault(); }, { passive: false });

// --- background / foreground ---
document.addEventListener('visibilitychange', () => {
  audio.suspend(document.hidden);
  if (!document.hidden) game.resetClock();
});

// --- debug overlay (?debug=1): fps and draw calls ---
let debugEl: HTMLDivElement | null = null;
if (params.get('debug') === '1') {
  debugEl = document.createElement('div');
  debugEl.style.cssText = 'position:fixed;left:8px;bottom:8px;color:#0f0;font:14px monospace;background:#000a;padding:4px 8px;z-index:9';
  document.body.appendChild(debugEl);
  (window as unknown as { runnerDebug: () => unknown }).runnerDebug = () => ({ ...game.debugState(), draws: game.drawCalls(), tris: game.triangles(), quality: game.quality, screen, unlocked: progress.unlocked, totalStars: progress.totalStars });
}
let fpsFrames = 0, fpsStart = performance.now();

function loop(now: number): void {
  if (screen === 'map') game.resetClock(); // the map covers the screen: skip 3D work
  else game.frame(now);
  if (debugEl) {
    fpsFrames++;
    if (now - fpsStart >= 1000) {
      debugEl.textContent = `${fpsFrames} fps · ${game.drawCalls()} draws · ${Math.round(game.triangles() / 1000)}k tris · ${game.renderer.getPixelRatio()}x`;
      fpsFrames = 0;
      fpsStart = now;
    }
  }
  requestAnimationFrame(loop);
}

if (Number.isInteger(levelFlag) && levelFlag >= 1 && levelFlag <= LEVEL_COUNT) playLevel(levelFlag);
else if (autoplay) playEndless();
else goMenu();
requestAnimationFrame(loop);

// Offline support: the service worker is generated by vite.config.ts at build time (not in dev).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js'); });
}
