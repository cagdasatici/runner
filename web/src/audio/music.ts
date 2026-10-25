// Pure, deterministic music logic: bar generation, layer gating, tempo, and the step sequencer.
// Nothing here touches Web Audio, so it is unit-tested with exact assertions (tests/music.test.ts).
import type { Theme } from './themes';
import { degreeToMidi, fold, hash32, makeRng } from './theory';

export type Inst = 'kick' | 'snare' | 'clap' | 'hat' | 'ohat' | 'tom' | 'shaker' | 'bass' | 'pad' | 'pluck' | 'arp' | 'counter'
  | 'lead' | 'crash';
export type Layer = 0 | 1 | 2 | 3;

export interface NoteEvent {
  step: number;      // 0..15 (16th notes inside the bar)
  dur: number;       // in steps
  inst: Inst;
  layer: Layer;
  vel: number;       // 0..1
  midi?: number;     // single pitched note
  notes?: number[];  // chords (pad, pluck)
  nudge?: number;    // humanised timing offset in steps (small, +-0.08)
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
  kick: 0, pad: 0, lead: 0, hat: 1, snare: 1, bass: 1, pluck: 1, crash: 1, arp: 2, counter: 3, shaker: 3, tom: 3, clap: 3, ohat: 3,
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

// ---- composition ----
// The song form is 32 bars: verse (8), chorus (8), verse 2 (8), breakdown (8), then it repeats.
// Each section has its own 8-bar progression built from the theme's 4 chords, and the lead plays
// hand-written motifs (below) chosen per theme, so a theme always plays the same tune.
export type Section = 'verse' | 'chorus' | 'verse2' | 'breakdown';
export const SECTION_BARS = 8;
const FORM: readonly Section[] = ['verse', 'chorus', 'verse2', 'breakdown'];

export function sectionOf(bar: number): { section: Section; bar: number } {
  const b = ((bar % 32) + 32) % 32;
  return { section: FORM[Math.floor(b / SECTION_BARS)], bar: b % SECTION_BARS };
}

/** Chord root (scale degree) of bar `sb` in a section, from the theme's 4-chord progression p. */
export function sectionChord(p: readonly number[], section: Section, sb: number): number {
  const order: Record<Section, number[]> = {
    verse: [0, 1, 2, 3, 0, 1, 2, 3],
    verse2: [0, 1, 2, 3, 0, 1, 2, 3],
    chorus: [3, 0, 2, 1, 3, 0, 1, 3],
    breakdown: [0, 0, 3, 3, 2, 2, 3, 3],
  };
  return p[order[section][sb]];
}

/**
 * Melodic motifs, one bar each: [step, durSteps, degree above the chord root].
 * Even degrees (0, 2, 4, 7) are chord tones and sit on strong beats; odd ones are passing/neighbour notes.
 */
export const MOTIFS: readonly (readonly [number, number, number][])[] = [
  [[0, 3, 4], [3, 1, 2], [4, 4, 0], [8, 2, 2], [10, 2, 4], [12, 4, 7]],          // 0 rising answer
  [[0, 2, 7], [2, 2, 6], [4, 4, 4], [8, 3, 2], [11, 1, 3], [12, 4, 4]],          // 1 falling from the top
  [[0, 6, 2], [6, 2, 1], [8, 2, 0], [10, 2, 2], [12, 4, 4]],                     // 2 long-short
  [[0, 2, 0], [3, 2, 2], [6, 2, 4], [8, 1, 5], [9, 3, 4], [12, 2, 2], [14, 2, 4]], // 3 syncopated climb
  [[0, 1, 4], [1, 1, 5], [2, 2, 7], [4, 4, 4], [10, 2, 5], [12, 4, 4]],          // 4 grace-note leap
  [[2, 2, 4], [4, 2, 5], [6, 2, 7], [8, 4, 9], [12, 2, 7], [14, 2, 4]],          // 5 pickup to the 3rd above
  [[0, 3, 7], [3, 3, 4], [6, 2, 2], [8, 3, 4], [11, 1, 5], [12, 4, 7]],          // 6 bouncing
  [[0, 2, 2], [2, 2, 4], [4, 2, 2], [6, 2, 0], [8, 8, 2]],                       // 7 turn and hold
];
/** Bar 8 of a phrase: land on a chord tone and breathe. */
const CADENCE: readonly [number, number, number][] = [[0, 4, 4], [4, 2, 2], [6, 2, 1], [8, 8, 0]];
const CADENCE_HIGH: readonly [number, number, number][] = [[0, 2, 7], [2, 2, 6], [4, 4, 4], [8, 8, 7]];

/** Which motif plays in each bar of a section, from the theme's 4-motif set [a, b, c, d]. */
function motifFor(t: Theme, section: Section, sb: number): readonly [number, number, number][] | null {
  const [a, b, c, d] = t.melody;
  if (section === 'breakdown') return null;
  if (sb === 7) return section === 'chorus' ? CADENCE_HIGH : CADENCE;
  const verse = [a, b, a, c, a, b, d];
  const chorus = [c, d, c, a, c, d, b];
  return MOTIFS[(section === 'chorus' ? chorus : verse)[sb] % MOTIFS.length];
}

/** All events of one bar for every layer. Deterministic in (theme, bar). */
export function generateBar(t: Theme, bar: number): NoteEvent[] {
  const rng = makeRng(hash32(t.seed, bar));
  const { section, bar: sb } = sectionOf(bar);
  const root = sectionChord(t.prog, section, sb);
  const nextRoot = sb === 7 ? sectionChord(t.prog, sectionOf(bar + 1).section, 0) : sectionChord(t.prog, section, sb + 1);
  const chorus = section === 'chorus', brk = section === 'breakdown', fillBar = sb === 7 && !brk;
  const ev: NoteEvent[] = [];
  // Humanise: every note gets a small velocity spread and (except the kick) a tiny timing drift.
  const add = (inst: Inst, step: number, dur: number, vel: number, extra: Partial<NoteEvent> = {}) => {
    const v = Math.min(1, Math.max(0.05, vel * (0.9 + 0.2 * rng.next())));
    let nudge = inst === 'kick' ? 0 : (rng.next() - 0.5) * (inst === 'hat' || inst === 'shaker' ? 0.12 : 0.08);
    if (step === 0) nudge = Math.abs(nudge); // never before the bar line (the very first bar may start at t = 0)
    ev.push({ step, dur, inst, layer: LAYER_OF[inst], vel: v, nudge, ...extra });
  };
  const d = DRUM_PATTERNS[t.drums];
  const deg = (base: number, x: number) => degreeToMidi(t.scale, base, x);

  // L0: pad (whole bar, breakdown swells louder), kick, lead melody
  add('pad', 0, 16, brk ? 0.65 : chorus ? 0.55 : 0.48, { notes: chordMidi(t, root, padBase(t)) });
  if (brk) {
    if (sb < 6) add('kick', 0, 1, 0.8);
    else for (const s of sb === 6 ? [0, 8] : [0, 4, 8, 12]) add('kick', s, 1, 0.75 + s / 64); // build back in
  } else {
    for (const s of d.kick) add('kick', s, 1, s === 0 ? 1 : 0.82);
    if (chorus && sb % 2 === 1 && !d.kick.includes(14)) add('kick', 14, 1, 0.6); // push into the next bar
  }
  const mot = motifFor(t, section, sb);
  if (mot) {
    const raw = mot.map(([, , x]) => deg(leadBase(t), root + x));
    let shift = chorus ? 12 : 0; // chorus sings an octave up when it fits
    while (Math.max(...raw) + shift > 88) shift -= 12;
    while (Math.min(...raw) + shift < 62) shift += 12;
    mot.forEach(([s, du, ], i) => {
      const strong = s % 4 === 0;
      add('lead', s, du * 0.92, (strong ? 0.85 : 0.68) * (chorus ? 1 : 0.9), { midi: raw[i] + shift });
    });
  } else if (sb % 2 === 0) {
    // breakdown: the lead hums long chord tones
    add('lead', 0, 14, 0.5, { midi: fold(deg(leadBase(t), root + 4), 64, 84) });
  }

  // L1: hats (accented), snare with ghosts and fills, bass, chord plucks, crash on section starts
  const accent = [1, 0.45, 0.7, 0.5];
  if (!brk) for (const s of d.hat) add('hat', s, 1, 0.5 * accent[s % 4]);
  if (brk) {
    if (sb === 7) for (let s = 4; s < 16; s++) add('snare', s, 1, 0.2 + (s - 4) * 0.06); // roll back into the verse
  } else {
    for (const s of d.snare) if (!(fillBar && s >= 12)) add('snare', s, 1, 0.85);
    if (sb % 2 === 1 && !fillBar) { add('snare', 7, 1, 0.18); add('snare', 15, 1, 0.22); } // ghost notes
    if (fillBar) [12, 13, 14, 15].forEach((s, i) => add('snare', s, 1, 0.45 + i * 0.12));
  }
  if (sb === 0 && bar > 0 && section !== 'breakdown') add('crash', 0, 16, chorus ? 0.9 : 0.6);
  if (brk && sb === 0) add('crash', 0, 16, 0.5);
  if (brk) {
    add('bass', 0, 15, 0.8, { midi: deg(bassBase(t), root) });
  } else {
    const pat = chorus ? t.bassPattern.replace(/\.(?=.$)/, 'o') : t.bassPattern;
    for (let s = 0; s < 16; s++) {
      const c = pat[s];
      if (c === 'r' || c === 'o' || c === 'f') {
        const x = root + (c === 'f' ? 4 : 0);
        add('bass', s, c === 'o' ? 1 : 1.6, s === 0 ? 0.95 : c === 'o' ? 0.6 : 0.78, { midi: deg(bassBase(t), x) + (c === 'o' ? 12 : 0) });
      }
    }
    // walk-up: last 16th leads stepwise into the next chord when it changes
    if (nextRoot !== root && pat[15] === '.') add('bass', 15, 0.9, 0.6, { midi: deg(bassBase(t), nextRoot + (nextRoot > root ? -1 : 1)) });
  }
  if (!brk) for (const s of t.stabs) {
    add('pluck', s, 1.5, chorus ? 0.5 : 0.4, { notes: chordMidi(t, root, leadBase(t), false).map((m) => fold(m, 60, 79)) });
  }

  // L2: arpeggio (verse: theme rate, chorus: 16ths, breakdown: soft 8ths rising through the section)
  const tones = [...chordMidi(t, root, leadBase(t), false), deg(leadBase(t), root + 7)].map((m) => fold(m, 60, 84));
  const stride = chorus ? 1 : brk ? 2 : t.arpRate;
  const rot = section === 'verse2' ? 2 : 0; // second verse turns the contour around
  for (let s = 0, i = 0; s < 16; s += stride, i++) {
    const idx = t.arpContour[(i + rot) % t.arpContour.length] % tones.length;
    const base = brk ? 0.25 + sb * 0.04 : 0.55;
    add('arp', s, stride * 0.85, base * (s % 4 === 0 ? 1.1 : s % 2 === 0 ? 0.85 : 0.65), { midi: tones[idx] });
  }

  // L3: counter line (harmony a third under the lead's long notes, or a sustained chord tone), shaker, toms, clap, open hat
  const cBase = 48 + t.rootPc;
  add('counter', 0, 7, 0.5, { midi: fold(deg(cBase, root + 9), 64, 83) });
  if (mot) {
    for (const [s, du, x] of mot) if (du >= 3 && s >= 4) add('counter', s, du * 0.9, 0.4, { midi: fold(deg(cBase, root + x - 2 + 7), 62, 83) });
  } else {
    add('counter', 8, 7, 0.42, { midi: fold(deg(cBase, root + 11), 64, 83) });
  }
  for (let s = 1; s < 16; s += 2) add('shaker', s, 1, s % 4 === 3 ? 0.45 : 0.28);
  if (!brk) {
    for (const s of d.clap) add('clap', s, 1, 0.55);
    for (const s of d.ohat) add('ohat', s, 2, chorus ? 0.5 : 0.38);
  }
  if (fillBar || sb === 3) {
    const steps = fillBar ? [8, 10, 12, 13, 14, 15] : [14, 15];
    const pitches = [4, 4, 3, 2, 1, 0];
    steps.forEach((s, i) => add('tom', s, 1, 0.55 + i * 0.06, { midi: deg(36 + t.rootPc + 12, pitches[pitches.length - steps.length + i]) }));
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
      for (const e of this.byStep[this.step]) emit(e, this.time + swing + (e.nudge ?? 0) * sd, sd, this);
      this.time += sd;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
  }
}
