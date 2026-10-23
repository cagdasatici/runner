// Entry point: wires the DOM screens, input, audio and the game loop together.
// URL flags (mirroring the iOS launch arguments): ?autoplay=1  ?idle=1  ?seed=N
// Testing only: ?skip=S fast-forwards S seconds of play at start; ?debug=1 shows fps + draw calls.
import './style.css';
import { Audio } from './audio';
import { ScoreStore } from './core/scoreStore';
import { Game } from './game';
import type { Move } from './core/runner';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const autoplay = params.get('autoplay') === '1';
const idle = params.get('idle') === '1';
const fixedSeed = params.get('seed');
const skip = Math.min(600, Math.max(0, Number(params.get('skip')) || 0));

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; }
}
const store = new ScoreStore(safeStorage());
const audio = new Audio();

function newSeed(): bigint {
  if (fixedSeed && /^\d+$/.test(fixedSeed) && fixedSeed !== '0') return BigInt(fixedSeed);
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (BigInt(a[0]) << 32n) | BigInt(a[1] | 1);
}

const game = new Game($('gl'), {
  onScore: (score, coins) => { $('score').textContent = String(score); $('coins').textContent = String(coins); },
  onJump: () => audio.sfx('jump'),
  onCoin: () => audio.sfx('coin'),
  onCrash: (score, coins) => {
    const newBest = store.record(score);
    audio.stopMusic();
    audio.sfx('crash');
    navigator.vibrate?.(60);
    $('over-score').textContent = String(score);
    $('over-coins').textContent = String(coins);
    $('newbest').classList.toggle('hidden', !newBest);
    window.setTimeout(() => show('over'), 350);
  },
});

function show(screen: 'menu' | 'hud' | 'over'): void {
  $('menu').classList.toggle('hidden', screen !== 'menu');
  $('hud').classList.toggle('hidden', screen === 'menu');
  $('over').classList.toggle('hidden', screen !== 'over');
}

function goMenu(): void {
  game.showMenu();
  $('best').textContent = String(store.best);
  show('menu');
  audio.playMusic('menu');
}

function play(): void {
  $('score').textContent = '0';
  $('coins').textContent = '0';
  game.startRun(newSeed(), autoplay, idle, autoplay ? skip : 0);
  show('hud');
  audio.playMusic('run');
}

// --- buttons ---
const tapped = (id: string, fn: () => void) => $(id).addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); fn(); });
tapped('play', play);
tapped('again', play);
tapped('home', goMenu);
tapped('exit', goMenu);
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
// iPad Safari: block pinch-zoom, double-tap zoom and the context menu
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

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
  (window as unknown as { subwayRunnerDebug: () => unknown }).subwayRunnerDebug = () => game.debugState();
}
let fpsFrames = 0, fpsStart = performance.now();

function loop(now: number): void {
  game.frame(now);
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

if (autoplay) play(); else goMenu();
requestAnimationFrame(loop);

// Offline support: the service worker is generated by vite.config.ts at build time (not in dev).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js'); });
}
