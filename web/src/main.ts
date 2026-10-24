// Entry point: wires the DOM screens, input, audio and the game loop together.
// URL flags (mirroring the iOS launch arguments): ?autoplay=1  ?idle=1  ?seed=N  ?level=N (start journey level N, 1…120)
// Testing only: ?skip=S fast-forwards S seconds of play at start; ?debug=1 shows fps + draw calls.
import './style.css';
import { Audio } from './audio';
import { LEVEL_COUNT, levelSpec, type LevelRun } from './core/level';
import { ProgressStore } from './core/progress';
import { ScoreStore } from './core/scoreStore';
import { Game } from './game';
import type { Move } from './core/runner';
import { buildMap, refreshMap, scrollToLevel, STAR_SVG } from './ui/map';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const autoplay = params.get('autoplay') === '1';
const idle = params.get('idle') === '1';
const fixedSeed = params.get('seed');
const skip = Math.min(600, Math.max(0, Number(params.get('skip')) || 0));
const levelFlag = Number(params.get('level'));

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

const game = new Game($('gl'), {
  onScore: (score, coins) => { $('score').textContent = String(score); $('coins').textContent = String(coins); },
  onSpeed: (v) => audio.setSpeed(v),
  onJump: () => audio.sfx('jump'),
  onCoin: () => audio.sfx('coin'),
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
    $('over-score').textContent = String(score);
    $('over-coins').textContent = String(coins);
    $('newbest').classList.toggle('hidden', !newBest);
    $('again').textContent = current ? 'Try Again' : 'Play Again';
    $('home').textContent = current ? 'Map' : 'Menu';
    later(350, () => show('over'));
  },
  onFinish: (run) => showResults(run),
});

function show(s: typeof screen): void {
  screen = s;
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
}

function playEndless(): void {
  cancelTimers();
  current = 0;
  resetHud(false);
  game.startRun(newSeed(), autoplay, idle, autoplay ? skip : 0);
  show('hud');
  audio.playMusic({ mode: 'endless' });
}

function playLevel(n: number): void {
  cancelTimers();
  current = n;
  resetHud(true);
  $('level-chip').textContent = levelName(n);
  game.startLevel(n, autoplay, idle, autoplay ? skip : 0);
  show('hud');
  audio.playMusic({ mode: 'run', world: levelSpec(n).world });
}

function showResults(run: LevelRun): void {
  const n = run.level.spec.n, stars = run.stars;
  const newBest = progress.record(n, stars);
  audio.playMusic({ mode: 'results', world: run.level.spec.world });
  audio.sfx('win');
  $('r-level').textContent = `LEVEL ${levelName(n)}`;
  document.querySelectorAll<HTMLElement>('#results .bs').forEach((el, i) => {
    el.innerHTML = `<span class="empty">${STAR_SVG}</span><span class="full">${STAR_SVG}</span>`;
    el.classList.toggle('on', i < stars);
    el.style.setProperty('--d', `${0.55 + i * 0.4}s`);
    if (i < stars) later(550 + i * 400 + 250, () => audio.sfx('star'));
  });
  $('r-cheer').textContent = ['', 'Good!', 'Great!', 'PERFECT!'][stars];
  $('r-gold').innerHTML = [0, 1, 2].map((i) => `<i class="${i < run.starsTaken.size ? 'got' : ''}">${STAR_SVG}</i>`).join('');
  show('results'); // first, so the count-up below sees screen === 'results'; un-hiding also restarts the CSS animations
  const total = run.level.totalCoins, coins = run.state.coins;
  const t0 = performance.now();
  const count = () => { // coins count up over 1.2 s, starting after 0.5 s
    const k = Math.min(1, Math.max(0, (performance.now() - t0 - 500) / 1200));
    const c = Math.round(coins * k);
    $('r-coins').textContent = `${c}/${total}`;
    $('r-cfill').style.width = `${(c / total) * 100}%`;
    if (k < 1 && screen === 'results') requestAnimationFrame(count);
  };
  count();
  $('r-best').classList.toggle('hidden', !newBest || stars < 2);
  $('r-next').classList.toggle('hidden', n >= LEVEL_COUNT);
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
window.addEventListener('pointerdown', (e) => {
  audio.unlock();
  start = { x: e.clientX, y: e.clientY, id: e.pointerId, fired: false };
});
window.addEventListener('pointermove', (e) => {
  if (!start || start.fired || e.pointerId !== start.id) return;
  const dx = e.clientX - start.x, dy = e.clientY - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  start.fired = true;
  const move: Move = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  game.queue(move);
});
const endSwipe = () => { start = null; };
window.addEventListener('pointerup', endSwipe);
window.addEventListener('pointercancel', endSwipe);
// keyboard for testing on a computer
const keys: Record<string, Move> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
window.addEventListener('keydown', (e) => { const m = keys[e.key]; if (m) { e.preventDefault(); game.queue(m); } });
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
  (window as unknown as { subwayRunnerDebug: () => unknown }).subwayRunnerDebug = () => ({ ...game.debugState(), screen, unlocked: progress.unlocked, totalStars: progress.totalStars });
}
let fpsFrames = 0, fpsStart = performance.now();

function loop(now: number): void {
  if (screen === 'map') game.resetClock(); // the map covers the screen: skip 3D work
  else game.frame(now);
  if (debugEl) {
    fpsFrames++;
    if (now - fpsStart >= 1000) {
      debugEl.textContent = `${fpsFrames} fps · ${game.drawCalls()} draws · ${game.renderer.getPixelRatio()}x`;
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
