// In-app speed test (long-press the version label on the menu): the autopilot plays the same endless run
// in four render setups, so "too many pixels" can be told apart from "too much JS" on the kids' iPads.
import type { Quality } from '../game';

export interface PerfSetup { name: string; quality: Quality; dpr: number }
// 2×2: effects (bloom + big shadows) × resolution. Kept fixed so runs stay comparable; iPads normally play High 1x.
export const PERF_SETUPS: PerfSetup[] = [
  { name: 'High 1.5x', quality: 'high', dpr: 1.5 },
  { name: 'High 1x', quality: 'high', dpr: 1 },
  { name: 'Low 1.5x', quality: 'low', dpr: 1.5 },
  { name: 'Low 1x', quality: 'low', dpr: 1 },
];
export const WARMUP_MS = 5000; // shader compiles and texture uploads land here, not in the numbers
export const MEASURE_MS = 30000;
export const SLOW_MS = 20; // a frame slower than this is a visible hitch at 60 Hz

export interface PerfResult { name: string; fps: number; slowPct: number; worstMs: number; cpuMs: number; draws: number }

/** Frame-time accumulator: ft = time between frames, cpu = JS time spent in game.frame(). */
export class FrameStats {
  frames = 0; time = 0; slow = 0; worst = 0; cpu = 0; draws = 0;
  add(ft: number, cpu: number, draws: number): void {
    if (ft <= 0 || ft > 500) return; // tab switches and alerts are not the game's fault
    this.frames++;
    this.time += ft;
    this.cpu += cpu;
    this.draws += draws;
    if (ft > SLOW_MS) this.slow++;
    this.worst = Math.max(this.worst, ft);
  }
  result(name: string): PerfResult {
    const n = this.frames || 1;
    return {
      name,
      fps: this.time ? Math.round((1000 * this.frames) / this.time) : 0,
      slowPct: Math.round((100 * this.slow) / n),
      worstMs: Math.round(this.worst),
      cpuMs: Math.round((10 * this.cpu) / n) / 10,
      draws: Math.round(this.draws / n),
    };
  }
}

/** One-line reading of the results, for the card shown at the end. */
export function verdict(rs: PerfResult[]): string {
  if (rs.length < PERF_SETUPS.length) return 'Test was stopped early.';
  const [hi15, hi1, lo15, lo1] = rs;
  if (hi15.fps >= 57 && hi15.slowPct <= 3) return 'Smooth even at full settings: no limit hit.';
  if (hi15.fps >= 54) return 'Nearly smooth at full settings: only small hitches.';
  const cpuHeavy = hi15.cpuMs >= 12;
  const gain = (a: PerfResult, b: PerfResult) => (b.fps - a.fps) / Math.max(1, a.fps);
  const resGain = gain(hi15, hi1), fxGain = gain(hi15, lo15), bothGain = gain(hi15, lo1);
  if (cpuHeavy && bothGain < 0.15) return 'CPU-bound: game code is the limit (native would help).';
  if (bothGain >= 0.25) return `GPU-bound: fewer pixels ${resGain >= fxGain ? '(resolution)' : '(effects)'} helps most (tune the web build).`;
  return 'Mixed: neither resolution nor effects fix it alone.';
}

/** Which of the two family iPads this is, from the CSS screen size (either orientation). */
export function ipadName(w: number, h: number): string {
  const [a, b] = [Math.min(w, h), Math.max(w, h)];
  if (a === 810 && b === 1080) return 'iPad (2021) 10.2"';
  if (a === 834 && b === 1112) return 'iPad Air (2019) 10.5"';
  return `unknown ${a}x${b}`;
}

export interface PerfReport { ipad: string; version: string; device: string; verdict: string; results: PerfResult[] }

/** Sends a finished test to the home server (Mac Studio). False when it is not reachable, e.g. away from home Wi-Fi. */
export async function sendReport(r: PerfReport, base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}api/perf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
    return res.ok;
  } catch { return false; }
}
