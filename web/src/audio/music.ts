// Pure, deterministic music logic: bar generation, layer gating, tempo, and the step sequencer.
// Nothing here touches Web Audio, so it is unit-tested with exact assertions (tests/music.test.ts).
import type { Theme } from './themes';
import { degreeToMidi, fold, hash32, makeRng } from './theory';

export type Inst = 'kick' | 'snare' | 'clap' | 'hat' | 'ohat' | 'tom' | 'shaker' | 'bass' | 'pad' | 'pluck' | 'arp' | 'counter';
export type Layer = 0 | 1 | 2 | 3;

export interface NoteEvent {
  step: number;      // 0..15 (16th notes inside the bar)
  dur: number;       // in steps
  inst: Inst;
  layer: Layer;
  vel: number;       // 0..1
  midi?: number;     // single pitched note
  notes?: number[];  // chords (pad, pluck)
}

// ---- constants (documented in docs/music-design.md) ----
export const STEPS_PER_BAR = 16;
export const BEATS_PER_BAR = 4;
export const LEVEL_SPEEDS = [0, 14, 18, 22] as const;   // m/s at which layers 1..3 come in
export const BOOST_SPEED_BONUS = 3;                     // held boost counts as +3 m/s
export const HYSTERESIS = 0.8;                          // m/s below a threshold before a layer leaves
export const FADE_IN_BARS = 1;
export const FADE_OUT_BARS = 2;
export const SPEED_FOR_MIN_BPM = 9;
export const SPEED_FOR_MAX_BPM = 24;
export const BPM_STEP = 2;                              // tempo is quantised to even BPM
export const MAX_BPM_CHANGE_PER_BAR = 4;
export const SPEED_SMOOTH_SECONDS = 1.5;

export const LAYER_OF: Record<Inst, Layer> = {
  kick: 0, pad: 0, hat: 1, snare: 1, bass: 1, pluck: 1, arp: 2, counter: 3, shaker: 3, tom: 3, clap: 3, ohat: 3,
};

export const stepSeconds = (bpm: number) => 15 / bpm;
export const beatSeconds = (bpm: number) => 60 / bpm;
export const barSeconds = (bpm: number) => 240 / bpm;

// ---- layering & tempo ----
/** Which layer level (0..3) is wanted for an effective speed. `current` adds hysteresis. */
export function levelFor(speed: number, boost: boolean, powerUp: boolean, current = 0): number {
  const eff = speed + (boost ? BOOST_SPEED_BONUS : 0);
  let lvl = 0;
  for (let l = 1; l <= 3; l++) {
    const th = LEVEL_SPEEDS[l] - (current >= l ? HYSTERESIS : 0);
    if (eff >= th) lvl = l;
  }
  return powerUp ? 3 : lvl;
}

export interface LayerRamp { layer: Layer; to: number; bars: number }
/** Fade plan when the wanted level changes at a bar line: in over 1 bar, out over 2 bars. */
export function layerRamp(prev: number, next: number): LayerRamp[] {
  const out: LayerRamp[] = [];
  for (let l = 1; l <= 3; l++) {
    const was = prev >= l, now = next >= l;
    if (was !== now) out.push({ layer: l as Layer, to: now ? 1 : 0, bars: now ? FADE_IN_BARS : FADE_OUT_BARS });
  }
  return out;
}

export function targetBpm(theme: Theme, effSpeed: number): number {
  const k = Math.min(1, Math.max(0, (effSpeed - SPEED_FOR_MIN_BPM) / (SPEED_FOR_MAX_BPM - SPEED_FOR_MIN_BPM)));
  const raw = theme.bpmMin + (theme.bpmMax - theme.bpmMin) * k;
  return Math.round(raw / BPM_STEP) * BPM_STEP;
}

/** Tempo moves in small steps, evaluated at bar lines only. */
export function nextBpm(current: number, target: number): number {
  return current + Math.max(-MAX_BPM_CHANGE_PER_BAR, Math.min(MAX_BPM_CHANGE_PER_BAR, target - current));
}

/** One-pole smoothing sampled at bar boundaries (dt = seconds since the last bar). */
export function smoothSpeed(prev: number, target: number, dt: number): number {
  return prev + (target - prev) * (1 - Math.exp(-dt / SPEED_SMOOTH_SECONDS));
}

// ---- notes ----
const padBase = (t: Theme) => 48 + t.rootPc;
const leadBase = (t: Theme) => 60 + t.rootPc;
const bassBase = (t: Theme) => 36 + t.rootPc;

/** Diatonic chord (scale degrees d, d+2, d+4 and optionally d+6). Every note is in the scale. */
export function chordMidi(t: Theme, degree: number, base: number, sevenths = t.sevenths): number[] {
  const degs = sevenths ? [0, 2, 4, 6] : [0, 2, 4];
  return degs.map((o) => degreeToMidi(t.scale, base, degree + o));
}

/** Key-correct pitch for the n-th coin of a streak: climbs the scale, one octave at most. */
export function coinMidi(t: Theme, streak: number): number {
  return degreeToMidi(t.scale, 72 + t.rootPc - 12, Math.min(Math.max(streak, 0), t.scale.length) + 0);
}

interface DrumPat { kick: number[]; snare: number[]; clap: number[]; hat: number[]; ohat: number[] }
const even = [0, 2, 4, 6, 8, 10, 12, 14];
const all16 = Array.from({ length: 16 }, (_, i) => i);
export const DRUM_PATTERNS: Record<Theme['drums'], DrumPat> = {
  four: { kick: [0, 4, 8, 12], snare: [4, 12], clap: [4, 12], hat: even, ohat: [6, 14] },
  broken: { kick: [0, 6, 8, 11], snare: [4, 12], clap: [12], hat: all16, ohat: [14] },
  half: { kick: [0, 10], snare: [8], clap: [8], hat: even, ohat: [14] },
  shuffle: { kick: [0, 7, 8], snare: [4, 12], clap: [4, 12], hat: even, ohat: [10] },
  bounce: { kick: [0, 3, 8, 11], snare: [4, 12], clap: [12], hat: even, ohat: [6, 14] },
};

/** All events of one bar for every layer. Deterministic in (theme, bar). */
export function generateBar(t: Theme, bar: number): NoteEvent[] {
  const rng = makeRng(hash32(t.seed, bar));
  const phrase = ((bar % 4) + 4) % 4;
  const root = t.prog[phrase];
  const ev: NoteEvent[] = [];
  const add = (inst: Inst, step: number, dur: number, vel: number, extra: Partial<NoteEvent> = {}) =>
    ev.push({ step, dur, inst, layer: LAYER_OF[inst], vel, ...extra });
  const d = DRUM_PATTERNS[t.drums];

  // L0: pad (whole bar) + kick
  add('pad', 0, 16, 0.5, { notes: chordMidi(t, root, padBase(t)) });
  for (const s of d.kick) add('kick', s, 1, s === 0 ? 1 : 0.85);

  // L1: hats, snare, bass, chord plucks
  for (const s of d.hat) add('hat', s, 1, s % 4 === 2 ? 0.5 : 0.32);
  for (const s of d.snare) add('snare', s, 1, 0.8);
  for (let s = 0; s < 16; s++) {
    const c = t.bassPattern[s];
    if (c === 'r' || c === 'o' || c === 'f') {
      const deg = root + (c === 'f' ? 4 : 0);
      add('bass', s, 1.6, s === 0 ? 0.95 : 0.75, { midi: degreeToMidi(t.scale, bassBase(t), deg) + (c === 'o' ? 12 : 0) });
    }
  }
  for (const s of t.stabs) {
    add('pluck', s, 1.5, 0.45, { notes: chordMidi(t, root, leadBase(t), false).map((m) => fold(m, 60, 79)) });
  }

  // L2: arpeggio over the chord tones (chord tones + octave)
  const tones = [...chordMidi(t, root, leadBase(t), false), degreeToMidi(t.scale, leadBase(t), root + 7)].map((m) => fold(m, 60, 84));
  const stride = t.arpRate;
  const shift = rng.chance(0.3) ? 1 : 0;
  for (let s = 0, i = 0; s < 16; s += stride, i++) {
    const idx = t.arpContour[(i + shift * (phrase % 2)) % t.arpContour.length] % tones.length;
    if (stride === 1 && s % 4 === 3 && rng.chance(0.35)) continue; // little gaps keep it from sounding mechanical
    add('arp', s, stride * 0.9, s % 4 === 0 ? 0.62 : 0.45, { midi: tones[idx] });
  }

  // L3: counter-melody (long notes: chord tone on beat 1, passing neighbour on beat 3), shaker, toms, clap, open hat
  const cBase = 48 + t.rootPc;
  const first = rng.pick([7, 9, 11]) + root;
  const second = first + rng.pick([-1, 1, 2]);
  add('counter', 0, 7, 0.5, { midi: fold(degreeToMidi(t.scale, cBase, first), 64, 83) });
  add('counter', 8, 7, 0.42, { midi: fold(degreeToMidi(t.scale, cBase, second), 64, 83) });
  for (let s = 1; s < 16; s += 2) add('shaker', s, 1, s % 4 === 3 ? 0.45 : 0.3);
  for (const s of d.clap) add('clap', s, 1, 0.55);
  for (const s of d.ohat) add('ohat', s, 2, 0.4);
  if (phrase === 3) {
    [12, 13, 14, 15].forEach((s, i) => add('tom', s, 1, 0.7, { midi: degreeToMidi(t.scale, 36 + t.rootPc + 12, [4, 3, 2, 0][i]) }));
  }
  return ev;
}

// ---- sequencer ----
export interface BarDecision { bpm?: number; theme?: Theme }

/**
 * Walks 16th-note steps in absolute time. Call pump(until, ...) from the 25 ms scheduler; every step that starts
 * before `until` is emitted exactly once. Tempo and theme only change at bar lines (onBar).
 */
export class Sequencer {
  step = 0;
  bar = 0;
  time: number;
  barStart = 0;
  private byStep: NoteEvent[][] = [];

  constructor(public theme: Theme, startTime: number, public bpm: number) { this.time = startTime; }

  /** Start time of the next bar line (now if already on one). */
  nextBarTime(): number { return this.step === 0 ? this.time : this.time + (16 - this.step) * stepSeconds(this.bpm); }

  /** Time of the next beat line at or after `t` (t within the current bar). */
  nextBeatTime(t: number): number {
    const beat = beatSeconds(this.bpm);
    const k = Math.max(0, Math.ceil((t - this.barStart) / beat - 1e-9));
    return this.barStart + k * beat;
  }

  pump(until: number, emit: (e: NoteEvent, time: number, stepDur: number, seq: Sequencer) => void,
       onBar: (bar: number, time: number, seq: Sequencer) => BarDecision | void): void {
    while (this.time < until) {
      if (this.step === 0) {
        const dec = onBar(this.bar, this.time, this);
        if (dec?.theme) { this.theme = dec.theme; this.bar = 0; }
        if (dec?.bpm) this.bpm = dec.bpm;
        this.barStart = this.time;
        this.byStep = Array.from({ length: 16 }, () => []);
        for (const e of generateBar(this.theme, this.bar)) this.byStep[Math.floor(e.step)].push(e);
      }
      const sd = stepSeconds(this.bpm);
      const swing = this.step % 2 === 1 ? this.theme.swing * sd * 2 : 0;
      for (const e of this.byStep[this.step]) emit(e, this.time + swing, sd, this);
      this.time += sd;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
  }
}
