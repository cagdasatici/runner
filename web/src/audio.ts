// Music and sound effects are synthesised in code with Web Audio.
// iPad Safari only allows sound after a user gesture, so call unlock() from the first tap.
//
// Music is composed, not random: each song is an arrangement of sections (intro / verse / chorus /
// breakdown) with written chord progressions and melodies. composeBar() turns one bar into note
// events (pure + deterministic, so it is unit-tested); the Audio class schedules those events a
// little ahead of time on real synth voices (detuned pads, plucky bass, lead, arp, noise drums)
// through a mix bus with sidechain-style ducking, convolution reverb, tempo delay and a compressor.

// ---------------------------------------------------------------- composition (pure)

export type Inst = 'pad' | 'bass' | 'lead' | 'arp' | 'kick' | 'snare' | 'hat' | 'ohat' | 'crash'
  | 'brass' | 'timp' | 'swell' | 'bell';
/** One note. t and d are in beats from the start of the bar (fanfare: seconds from start). */
export interface NoteEvent { inst: Inst; t: number; d: number; m: number; v: number }

type Section = 'intro' | 'verse' | 'verseB' | 'chorus' | 'breakdown' | 'menuA' | 'menuB';
type Mel = [number, number, number][]; // [beat, durBeats, midi] per bar

interface Song {
  bpm: number;
  swing: number; // fraction of the swing grid unit that offbeats are pushed late
  swingGrid: 0.5 | 0.25; // swing 8ths or 16ths
  /** Played once, then `loop` repeats forever. */
  intro: Section[];
  loop: Section[];
}

// Chords: root midi (bass octave) + intervals.
const MAJ = [0, 4, 7], MIN = [0, 3, 7], MAJ7 = [0, 4, 7, 11], MIN7 = [0, 3, 7, 10], DOM7 = [0, 4, 7, 10];
type Chord = { root: number; iv: number[] };
const ch = (root: number, iv: number[]): Chord => ({ root, iv });
const Am = ch(45, MIN), F = ch(41, MAJ), C = ch(36, MAJ), G = ch(43, MAJ), Em = ch(40, MIN), E = ch(40, MAJ),
  Dm = ch(38, MIN);
const Cmaj7 = ch(36, MAJ7), Am7 = ch(45, MIN7), Dm7 = ch(38, MIN7), G7 = ch(43, DOM7), Fmaj7 = ch(41, MAJ7),
  Em7 = ch(40, MIN7);

const PROG: Record<Section, Chord[]> = {
  intro: [Am, F, C, G],
  verse: [Am, F, C, G, Am, F, C, G],
  verseB: [Am, F, C, G, Am, F, C, G],
  chorus: [F, G, Em, Am, F, G, C, E],
  breakdown: [Dm, Am, F, G, Dm, Am, F, E],
  menuA: [Cmaj7, Am7, Dm7, G7, Cmaj7, Am7, Dm7, G7],
  menuB: [Fmaj7, Em7, Dm7, Cmaj7, Fmaj7, Em7, Dm7, G7],
};

const VERSE_MEL: Mel[] = [
  [[0, 0.5, 69], [0.5, 0.5, 72], [1, 1, 76], [2.5, 0.5, 74], [3, 1, 72]],
  [[0, 1.5, 72], [1.5, 0.5, 69], [2, 1, 69], [3, 0.5, 67], [3.5, 0.5, 69]],
  [[0, 0.5, 67], [0.5, 0.5, 72], [1, 1.5, 76], [2.5, 0.5, 79], [3, 1, 76]],
  [[0, 1, 74], [1, 0.5, 71], [1.5, 0.5, 74], [2, 2, 74]],
  [[0, 0.5, 69], [0.5, 0.5, 72], [1, 1, 76], [2.5, 0.5, 74], [3, 1, 72]],
  [[0, 0.5, 77], [0.5, 0.5, 76], [1, 1, 72], [2, 2, 69]],
  [[0, 1, 67], [1, 0.5, 72], [1.5, 0.5, 76], [2, 1, 79], [3, 1, 81]],
  [[0, 1.5, 79], [1.5, 0.5, 74], [2, 2, 71]],
];
const CHORUS_MEL: Mel[] = [
  [[0, 1, 81], [1, 0.5, 79], [1.5, 0.5, 77], [2, 1.5, 77], [3.5, 0.5, 76]],
  [[0, 1, 79], [1, 0.5, 77], [1.5, 0.5, 74], [2, 2, 74]],
  [[0, 0.5, 76], [0.5, 0.5, 79], [1, 1, 83], [2, 0.5, 81], [2.5, 0.5, 79], [3, 1, 76]],
  [[0, 3, 81], [3, 0.5, 79], [3.5, 0.5, 81]],
  [[0, 1, 84], [1, 0.5, 81], [1.5, 0.5, 77], [2, 1.5, 81], [3.5, 0.5, 79]],
  [[0, 1, 79], [1, 0.5, 83], [1.5, 0.5, 86], [2, 2, 83]],
  [[0, 0.5, 84], [0.5, 0.5, 83], [1, 1, 79], [2, 1, 76], [3, 1, 79]],
  [[0, 1.5, 80], [1.5, 0.5, 83], [2, 2, 83]],
];
const MENU_MEL_A: Mel[] = [
  [[0, 1.5, 76], [1.5, 0.5, 74], [2, 1, 72], [3, 1, 79]],
  [[0, 2, 76], [2.5, 0.5, 72], [3, 1, 69]],
  [[0, 1, 72], [1, 0.5, 74], [1.5, 1.5, 77], [3, 1, 76]],
  [[0, 3, 74], [3.5, 0.5, 71]],
  [[0, 1.5, 76], [1.5, 0.5, 79], [2, 1, 83], [3, 1, 81]],
  [[0, 2, 79], [2.5, 0.5, 76], [3, 1, 72]],
  [[0, 1, 77], [1, 0.5, 76], [1.5, 1.5, 74], [3, 1, 71]],
  [[0, 4, 72]],
];
const MENU_MEL_B: Mel[] = [
  [[0.5, 0.5, 72], [1, 1, 77], [2, 1.5, 76], [3.5, 0.5, 74]],
  [[0, 2, 71], [2, 1, 74], [3, 1, 79]],
  [[0, 1.5, 77], [1.5, 0.5, 76], [2, 2, 74]],
  [[0, 3, 76], [3, 1, 79]],
  [[0.5, 0.5, 77], [1, 1, 81], [2, 1.5, 79], [3.5, 0.5, 77]],
  [[0, 2, 76], [2, 1, 74], [3, 1, 71]],
  [[0, 1.5, 74], [1.5, 0.5, 77], [2, 2, 81]],
  [[0, 2, 79], [2, 1, 77], [3, 1, 74]],
];

export const SONGS: Record<string, Song> = {
  run: { bpm: 128, swing: 0.18, swingGrid: 0.25, intro: ['intro'], loop: ['verse', 'chorus', 'verseB', 'breakdown', 'chorus'] },
  menu: { bpm: 88, swing: 0.5, swingGrid: 0.5, intro: [], loop: ['menuA', 'menuB'] },
};

/** Which section / bar-in-section a running bar index falls on. */
export function sectionAt(song: Song, bar: number): { section: Section; bar: number } {
  let b = bar;
  for (const s of song.intro) { const n = PROG[s].length; if (b < n) return { section: s, bar: b }; b -= n; }
  const loopLen = song.loop.reduce((a, s) => a + PROG[s].length, 0);
  b %= loopLen;
  for (const s of song.loop) { const n = PROG[s].length; if (b < n) return { section: s, bar: b }; b -= n; }
  throw new Error('unreachable');
}

/** Small deterministic PRNG so humanising is repeatable (and testable). */
function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Chord tones voiced into [lo, lo+12). */
function voice(c: Chord, lo: number): number[] {
  return c.iv.map((i) => { let m = c.root + i; while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; }).sort((a, b) => a - b);
}

/** All note events for one bar of a song. Times in beats, already swung and humanised. */
export function composeBar(songName: string, bar: number): NoteEvent[] {
  const song = SONGS[songName];
  if (!song) return [];
  const { section, bar: sb } = sectionAt(song, bar);
  const chord = PROG[section][sb];
  const r = rng(bar * 7919 + songName.length);
  const ev: NoteEvent[] = [];
  const hum = (v: number) => Math.max(0.05, Math.min(1, v * (0.88 + 0.24 * r())));
  const add = (inst: Inst, t: number, d: number, m: number, v: number, jitter = 0.012) =>
    ev.push({ inst, t: t + (r() - 0.5) * jitter, d, m, v: hum(v) });
  const lastBar = sb === PROG[section].length - 1;
  const menu = songName === 'menu';

  // Pads: whole-bar chord, voiced around middle C, plus a soft high fifth in the chorus.
  const padNotes = voice(chord, menu ? 57 : 55);
  for (const m of padNotes) add('pad', 0, 4, m, section === 'intro' ? 0.5 : section === 'breakdown' ? 0.75 : 0.6, 0);
  if (section === 'chorus') add('pad', 0, 4, padNotes[padNotes.length - 1] + 12, 0.35, 0);

  // Bass.
  const root = chord.root;
  if (menu) {
    for (const [t, d, o, v] of [[0, 1.4, 0, 0.9], [1.5, 0.5, 7, 0.55], [2, 1.4, 12, 0.7], [3.5, 0.5, 7, 0.55]] as const) add('bass', t, d, root + o, v);
  } else if (section === 'chorus') {
    for (const [t, d, o, v] of [[0, 0.6, 0, 1], [0.75, 0.25, 12, 0.6], [1, 0.4, 0, 0.8], [1.5, 0.4, 12, 0.7], [2, 0.6, 0, 0.95],
      [2.75, 0.25, 7, 0.6], [3, 0.4, 0, 0.8], [3.5, 0.4, 12, 0.75]] as const) add('bass', t, d, root + o, v);
  } else if (section === 'breakdown') {
    add('bass', 0, 3.5, root, 0.7);
  } else {
    for (let i = 0; i < 8; i++) add('bass', i * 0.5, 0.38, root + (i % 2 ? 12 : 0), i % 2 ? 0.55 : 0.9);
  }

  // Arpeggio: 16ths over chord tones, pattern changes with the section.
  const tones = voice(chord, menu ? 64 : 69);
  const up = [...tones, tones[0] + 12];
  const pat = section === 'chorus' ? [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 3, 2, 1, 2, 3, 2]
    : section === 'verseB' ? [3, 2, 1, 0, 1, 2, 3, 2, 3, 2, 1, 0, 1, 0, 1, 2]
      : [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 3, 2, 1, 2];
  if (menu) {
    for (let i = 0; i < 8; i++) if (i % 3 !== 2) add('arp', i * 0.5, 0.45, up[pat[i] % up.length], 0.35);
  } else if (section !== 'intro' || sb >= 2) {
    const vScale = section === 'breakdown' ? 0.35 + 0.08 * sb : section === 'intro' ? 0.4 : 0.55;
    for (let i = 0; i < 16; i++) add('arp', i * 0.25, 0.22, up[pat[i] % up.length], vScale * (i % 4 === 0 ? 1 : 0.7));
  }

  // Lead melody.
  const mel = section === 'verse' ? VERSE_MEL[sb] : section === 'verseB' ? VERSE_MEL[sb] : section === 'chorus' ? CHORUS_MEL[sb]
    : section === 'menuA' ? MENU_MEL_A[sb] : section === 'menuB' ? MENU_MEL_B[sb] : null;
  if (mel) {
    const shift = section === 'verseB' && sb >= 4 ? 12 : 0; // second verse climbs an octave halfway
    for (const [t, d, m] of mel) add('lead', t, d * 0.95, m + shift, section === 'chorus' ? 0.85 : 0.7);
    if (section === 'chorus') for (const [t, d, m] of mel) add('bell', t, d * 0.5, m + 12, 0.25); // octave doubling
  } else if (section === 'breakdown') {
    add('bell', 0, 2, tones[tones.length - 1] + 12, 0.4);
    add('bell', 2, 2, tones[1] + 12, 0.3);
  }

  // Drums.
  if (menu) {
    add('kick', 0, 0.5, 0, 0.7); add('kick', 2.5, 0.5, 0, 0.55);
    add('snare', 1, 0.5, 0, 0.35); add('snare', 3, 0.5, 0, 0.4);
    for (let i = 0; i < 8; i++) add('hat', i * 0.5, 0.1, 0, i % 2 ? 0.2 : 0.3, 0.02);
    if (sb === 0 && section === 'menuA') add('crash', 0, 2, 0, 0.25);
  } else if (section === 'breakdown') {
    if (lastBar) for (let i = 0; i < 16; i++) add('snare', i * 0.25, 0.2, 0, 0.15 + i * 0.05, 0.004); // build-up roll
    if (sb === 0) add('crash', 0, 3, 0, 0.6);
    if (sb >= 4) for (let i = 0; i < 4; i++) add('kick', i, 0.5, 0, 0.35 + 0.1 * (sb - 4));
  } else if (section === 'intro') {
    for (let i = 0; i < 8; i++) add('hat', i * 0.5, 0.08, 0, 0.25);
    if (sb >= 2) { add('kick', 0, 0.5, 0, 0.8); add('kick', 2, 0.5, 0, 0.8); }
    if (lastBar) for (let i = 8; i < 16; i++) add('snare', i * 0.25, 0.2, 0, 0.3 + (i - 8) * 0.07, 0.004);
  } else {
    const chorus = section === 'chorus';
    const kicks = chorus ? [0, 1, 2, 3] : sb % 2 ? [0, 1.5, 2, 2.75] : [0, 2, 2.5];
    for (const k of kicks) add('kick', k, 0.5, 0, k % 1 ? 0.75 : 1);
    if (lastBar) {
      add('snare', 1, 0.3, 0, 0.9);
      for (let i = 0; i < 6; i++) add('snare', 2.5 + i * 0.25, 0.2, 0, 0.45 + i * 0.09, 0.004); // fill
    } else {
      add('snare', 1, 0.3, 0, 0.95); add('snare', 3, 0.3, 0, 1);
      if (sb % 4 === 3) add('snare', 3.75, 0.2, 0, 0.3); // ghost
    }
    for (let i = 0; i < 16; i++) {
      if (chorus && i % 4 === 2) { add('ohat', i * 0.25, 0.4, 0, 0.45); continue; }
      add('hat', i * 0.25, 0.06, 0, i % 4 === 0 ? 0.5 : i % 2 ? 0.22 : 0.36, 0.008);
    }
    if (sb === 0) add('crash', 0, 3, 0, chorus ? 0.85 : 0.55);
  }

  // Swing: push off-grid notes late.
  const g = song.swingGrid;
  for (const e of ev) {
    const pos = e.t / g;
    const k = Math.round(pos);
    if (Math.abs(pos - k) < 0.08 && k % 2 === 1) e.t += song.swing * g;
  }
  return ev;
}

/** The finish fanfare: B-flat major, bVI-bVII-I cadence. Times in seconds. */
export function fanfareEvents(): NoteEvent[] {
  const ev: NoteEvent[] = [];
  const add = (inst: Inst, t: number, d: number, m: number, v: number) => ev.push({ inst, t, d, m, v });
  // 0.0-1.2s: cymbal swell + snare roll under a rising Bb major run (Bb3 -> Bb5).
  add('swell', 0, 1.25, 0, 0.8);
  for (let i = 0; i < 20; i++) add('snare', i * 0.06, 0.06, 0, 0.15 + i * 0.035);
  const scale = [58, 60, 62, 63, 65, 67, 69, 70, 72, 74, 75, 77, 79, 81, 82];
  scale.forEach((m, i) => add('brass', i * 0.08, 0.12, m, 0.45 + i * 0.03));
  // Hits: Bb ... Bb ... Bb (triplet pickup), then Gb, Ab, and the big Bb.
  const stab = (t: number, d: number, notes: number[], top: number, v: number) => {
    for (const m of notes) add('brass', t, d, m, v);
    add('lead', t, d, top, v);
    add('bass', t, d, notes[0] - 12, v);
  };
  const Bb = [46, 58, 62, 65, 70], Gb = [42, 54, 58, 61, 66], Ab = [44, 56, 60, 63, 68];
  stab(1.25, 0.22, Bb, 77, 0.9); add('kick', 1.25, 0.3, 0, 1); add('crash', 1.25, 1.5, 0, 0.7);
  stab(1.55, 0.18, Bb, 77, 0.75);
  stab(1.8, 0.5, Bb, 82, 0.95); add('kick', 1.8, 0.3, 0, 0.9);
  stab(2.4, 0.5, Gb, 78, 0.9); add('kick', 2.4, 0.3, 0, 0.9); add('timp', 2.4, 0.5, 42, 0.8);
  stab(3.0, 0.5, Ab, 80, 0.95); add('kick', 3.0, 0.3, 0, 0.9); add('timp', 3.0, 0.5, 44, 0.8);
  add('swell', 2.6, 1.0, 0, 0.7);
  for (let i = 0; i < 8; i++) add('snare', 3.1 + i * 0.06, 0.06, 0, 0.3 + i * 0.08);
  // Final chord at 3.6s, held with a timpani roll and a long shimmer, fading out by ~7.5s.
  const final = [34, 46, 53, 58, 62, 65, 70, 74, 77];
  for (const m of final) add('brass', 3.6, 3.6, m, 1);
  add('lead', 3.6, 3.6, 82, 1); add('bell', 3.6, 3.0, 94, 0.5); add('bell', 3.75, 2.6, 89, 0.4);
  add('pad', 3.6, 3.8, 58, 0.8); add('pad', 3.6, 3.8, 65, 0.8); add('pad', 3.6, 3.8, 70, 0.8);
  add('kick', 3.6, 0.5, 0, 1); add('crash', 3.6, 3.5, 0, 1); add('crash', 3.62, 3.5, 0, 0.6);
  for (let i = 0; i < 14; i++) add('timp', 3.6 + i * 0.07, 0.12, 34, 0.9 - i * 0.05);
  return ev;
}
export const FANFARE_SECONDS = 7.5;

// ---------------------------------------------------------------- sound effects (offline buffers)

const RATE = 22050;
const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
let lcg = 12345;
const noise = () => { lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0; return lcg / 2147483648 - 1; };

class Buf {
  s: Float32Array;
  constructor(seconds: number) { this.s = new Float32Array(Math.round(seconds * RATE)); }
  add(start: number, dur: number, amp: number, gen: (t: number) => number, env = true): void {
    const i0 = Math.round(start * RATE), n = Math.round(dur * RATE);
    for (let k = 0; k < n && i0 + k < this.s.length; k++) {
      const t = k / RATE;
      let e = 1;
      if (env) e = Math.min(1, t / 0.005, Math.max(0, (dur - t) / 0.02));
      this.s[i0 + k] += amp * e * gen(t);
    }
  }
}
const square = (f: number, duty = 0.25) => (t: number) => ((t * f) % 1 < duty ? 1 : -1);
const triangle = (f: number) => (t: number) => 4 * Math.abs(((t * f) % 1) - 0.5) - 1;
const sweep = (f0: number, f1: number, dur: number) => (t: number) => {
  const k = Math.log(f1 / f0) / dur;
  return ((f0 * (Math.exp(k * t) - 1)) / k) % 1 < 0.5 ? 1 : -1;
};

function makeSounds(): Record<string, Buf> {
  const crash = new Buf(0.35);
  crash.add(0, 0.35, 0.5, (t) => noise() * Math.exp(-t * 12), false);
  crash.add(0, 0.35, 0.25, sweep(400, 80, 0.35));
  const coin = new Buf(0.2);
  coin.add(0, 0.06, 0.2, square(freq(83), 0.5));
  coin.add(0.06, 0.14, 0.2, square(freq(88), 0.5));
  const jump = new Buf(0.15);
  jump.add(0, 0.15, 0.2, sweep(300, 600, 0.15));
  const star = new Buf(0.45);
  [84, 88, 91, 96].forEach((m, i) => star.add(i * 0.05, 0.25, 0.16, square(freq(m), 0.5)));
  const win = new Buf(1.3);
  [72, 76, 79].forEach((m, i) => win.add(i * 0.12, 0.12, 0.2, square(freq(m), 0.5)));
  for (const m of [72, 76, 79, 84]) win.add(0.36, 0.9, 0.1, triangle(freq(m)));
  win.add(0.36, 0.9, 0.14, square(freq(84), 0.25));
  return { star, win, crash, coin, jump };
}

// ---------------------------------------------------------------- live synthesis

/** A song playing on its own bus, so it can be faded and dropped without touching the others. */
interface Player {
  bus: GainNode; // everything for this song ends here
  duck: GainNode; // pads/bass/arp go through this, pumped by the kick
  ins: Partial<Record<Inst, GainNode>>;
  sends: GainNode[];
  timer: number | null;
  song: string | null;
  bar: number;
  nextBar: number; // ctx time of next bar to schedule
}

const MIX: Record<Inst, { gain: number; rev: number; dly: number; duck: boolean }> = {
  pad: { gain: 0.09, rev: 0.6, dly: 0, duck: true },
  bass: { gain: 0.32, rev: 0.05, dly: 0, duck: true },
  lead: { gain: 0.16, rev: 0.35, dly: 0.3, duck: false },
  arp: { gain: 0.07, rev: 0.3, dly: 0.35, duck: true },
  bell: { gain: 0.08, rev: 0.5, dly: 0.4, duck: false },
  kick: { gain: 0.85, rev: 0.03, dly: 0, duck: false },
  snare: { gain: 0.35, rev: 0.25, dly: 0, duck: false },
  hat: { gain: 0.12, rev: 0.1, dly: 0, duck: false },
  ohat: { gain: 0.1, rev: 0.15, dly: 0, duck: false },
  crash: { gain: 0.14, rev: 0.3, dly: 0, duck: false },
  brass: { gain: 0.07, rev: 0.4, dly: 0, duck: false },
  timp: { gain: 0.45, rev: 0.4, dly: 0, duck: false },
  swell: { gain: 0.2, rev: 0.4, dly: 0, duck: false },
};

const MUTE_KEY = 'muted';
const LOOKAHEAD = 0.35; // seconds of music scheduled ahead of the clock

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null; // mute switch
  private mix: GainNode | null = null; // into the compressor
  private reverb: ConvolverNode | null = null;
  private delayIn: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private player: Player | null = null;
  private wanted: string | null = null;
  muted: boolean;

  constructor() {
    let m = false;
    try { m = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked: default unmuted */ }
    this.muted = m;
    // Like the iOS app's .ambient session: respect the iPad's silent switch where Safari supports it.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  }

  /** Call from a tap/click handler. Safe to call many times. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
      comp.attack.value = 0.005; comp.release.value = 0.2;
      comp.connect(this.master);
      this.mix = ctx.createGain();
      this.mix.gain.value = 0.9;
      this.mix.connect(comp);

      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.6);
      const revOut = ctx.createGain(); revOut.gain.value = 0.55;
      this.reverb.connect(revOut).connect(this.mix);

      // Dotted-eighth delay at 128 bpm with a darkening feedback loop.
      this.delayIn = ctx.createGain();
      const delay = ctx.createDelay(1.5); delay.delayTime.value = (60 / 128) * 0.75;
      const fb = ctx.createGain(); fb.gain.value = 0.35;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2800;
      this.delayIn.connect(delay); delay.connect(tone).connect(fb).connect(delay);
      const dOut = ctx.createGain(); dOut.gain.value = 0.5;
      tone.connect(dOut).connect(this.mix);

      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      for (const [name, buf] of Object.entries(makeSounds())) {
        const ab = ctx.createBuffer(1, buf.s.length, RATE);
        const data = ab.getChannelData(0);
        for (let i = 0; i < buf.s.length; i++) data[i] = Math.tanh(1.2 * buf.s[i]); // soft clip, as on iOS
        this.buffers[name] = ab;
      }
      if (this.wanted) this.playMusic(this.wanted);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  playMusic(name: string): void {
    this.wanted = name;
    this.stopMusic(false);
    if (!this.ctx || !SONGS[name]) return;
    const p = this.newPlayer(0.6);
    p.song = name;
    p.nextBar = this.ctx.currentTime + 0.08;
    const tick = () => {
      if (!this.ctx || this.player !== p) return;
      const song = SONGS[name];
      const barLen = (4 * 60) / song.bpm;
      // After a background suspend, don't try to catch up on missed bars.
      if (p.nextBar < this.ctx.currentTime - 0.1) p.nextBar = this.ctx.currentTime + 0.05;
      while (p.nextBar < this.ctx.currentTime + LOOKAHEAD) {
        const spb = 60 / song.bpm;
        for (const e of composeBar(name, p.bar).sort((a, b) => a.t - b.t)) this.voice(p, e, p.nextBar + Math.max(0, e.t) * spb, e.d * spb);
        p.bar++;
        p.nextBar += barLen;
      }
    };
    tick();
    p.timer = window.setInterval(tick, 50);
    this.player = p;
  }

  stopMusic(forget = true): void {
    if (forget) this.wanted = null;
    if (this.player) this.release(this.player, 0.15);
    this.player = null;
  }

  sfx(name: string): void {
    if (!this.ctx || !this.mix || !this.buffers[name] || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.connect(this.mix);
    src.start();
  }

  /**
   * Triumphant level-finish piece (~7.5 s): rising brass run over a cymbal swell, stabs, a
   * bVI-bVII-I cadence and a big held final chord. Fades out and stops any run/menu music.
   * Returns the piece's length in seconds (0 if audio is not unlocked yet).
   */
  playFinishFanfare(): number {
    this.wanted = null;
    if (this.player) this.release(this.player, 0.4);
    this.player = null;
    if (!this.ctx) return 0;
    const p = this.newPlayer(0.75);
    const t0 = this.ctx.currentTime + 0.05;
    for (const e of fanfareEvents().sort((a, b) => a.t - b.t)) this.voice(p, e, t0 + e.t, e.d);
    p.bus.gain.setValueAtTime(0.75, t0 + FANFARE_SECONDS - 1.5);
    p.bus.gain.linearRampToValueAtTime(0, t0 + FANFARE_SECONDS);
    const done = p;
    window.setTimeout(() => { if (this.player !== done) this.release(done, 0); }, (FANFARE_SECONDS + 0.2) * 1000);
    // Not stored in this.player, so a later playMusic() starts cleanly while the tail rings out.
    return FANFARE_SECONDS;
  }

  /** Pause/resume everything when the app goes to the background. */
  suspend(hidden: boolean): void {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }

  // ---- internals

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const n = Math.round(seconds * ctx.sampleRate);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const x = i / n;
        const k = 0.15 + 0.8 * x; // tail gets darker
        lp += (Math.random() * 2 - 1 - lp) * (1 - k);
        d[i] = lp * Math.pow(1 - x, 3) * (i < 200 ? i / 200 : 1);
      }
    }
    return b;
  }

  private newPlayer(level: number): Player {
    const ctx = this.ctx!;
    const bus = ctx.createGain(); bus.gain.value = level; bus.connect(this.mix!);
    const duck = ctx.createGain(); duck.connect(bus);
    const rev = ctx.createGain(); rev.connect(this.reverb!);
    const dly = ctx.createGain(); dly.connect(this.delayIn!);
    const ins: Partial<Record<Inst, GainNode>> = {};
    for (const [name, mx] of Object.entries(MIX) as [Inst, typeof MIX[Inst]][]) {
      const g = ctx.createGain(); g.gain.value = mx.gain;
      g.connect(mx.duck ? duck : bus);
      if (mx.rev) { const s = ctx.createGain(); s.gain.value = mx.rev; g.connect(s).connect(rev); }
      if (mx.dly) { const s = ctx.createGain(); s.gain.value = mx.dly; g.connect(s).connect(dly); }
      ins[name] = g;
    }
    return { bus, duck, ins, sends: [rev, dly], timer: null, song: null, bar: 0, nextBar: 0 };
  }

  private release(p: Player, fade: number): void {
    if (p.timer !== null) window.clearInterval(p.timer);
    p.timer = null;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const g of [p.bus, ...p.sends]) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + Math.max(0.02, fade));
    }
    window.setTimeout(() => { p.bus.disconnect(); for (const s of p.sends) s.disconnect(); }, (fade + 0.3) * 1000);
  }

  /** Schedule one note on a synth voice. */
  private voice(p: Player, e: NoteEvent, t: number, d: number): void {
    const ctx = this.ctx!;
    const out = p.ins[e.inst]!;
    const v = e.v;
    const f = freq(e.m);
    const env = (g: GainNode, a: number, peak: number, hold: number, rel: number) => {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setTargetAtTime(peak * 0.7, t + a, Math.max(0.01, hold / 3));
      g.gain.setTargetAtTime(0, t + Math.max(a, hold), rel / 4);
    };
    const osc = (type: OscillatorType, hz: number, detune: number, dest: AudioNode, end: number) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; o.detune.value = detune;
      o.connect(dest); o.start(t); o.stop(end);
      return o;
    };
    const noiseSrc = (dest: AudioNode, end: number) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      s.connect(dest); s.start(t, Math.random() * 0.8); s.stop(end);
    };
    switch (e.inst) {
      case 'pad': case 'brass': {
        const brass = e.inst === 'brass';
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = brass ? 2 : 0.8;
        const base = brass ? 500 : 400;
        const peakF = brass ? 2200 + 2500 * v : 1400 + 800 * v;
        lp.frequency.setValueAtTime(base, t);
        lp.frequency.linearRampToValueAtTime(peakF, t + (brass ? 0.07 : 0.6));
        lp.frequency.setTargetAtTime(brass ? peakF * 0.5 : peakF * 0.6, t + (brass ? 0.1 : 0.8), brass ? 0.3 : 1.2);
        lp.connect(g).connect(out);
        const a = brass ? 0.025 : 0.35, rel = brass ? Math.min(0.6, 0.15 + d * 0.3) : 0.9;
        env(g, a, v, d, rel);
        const end = t + d + rel + 0.1;
        for (const dt of brass ? [-9, 0, 8] : [-12, -4, 5, 13]) {
          const o = osc('sawtooth', f, dt, lp, end);
          if (brass) { o.detune.setValueAtTime(dt - 40, t); o.detune.linearRampToValueAtTime(dt, t + 0.06); } // lip "blip" into pitch
        }
        if (!brass) osc('triangle', f / 2, 0, lp, end);
        break;
      }
      case 'bass': {
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
        lp.frequency.setValueAtTime(200 + 2200 * v, t);
        lp.frequency.setTargetAtTime(160, t, 0.07);
        lp.connect(g).connect(out);
        env(g, 0.004, v, Math.min(d, 0.4), 0.08);
        const end = t + d + 0.2;
        osc('sawtooth', f, 0, lp, end);
        osc('square', f / 2, 3, lp, end);
        break;
      }
      case 'lead': {
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 1;
        lp.connect(g).connect(out);
        env(g, 0.012, v, d, 0.18);
        const end = t + d + 0.3;
        const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
        const vibAmt = ctx.createGain();
        vibAmt.gain.setValueAtTime(0, t); vibAmt.gain.linearRampToValueAtTime(d > 0.6 ? 14 : 4, t + Math.min(d, 0.5));
        vib.connect(vibAmt); vib.start(t); vib.stop(end);
        for (const [type, dt] of [['square', -5], ['triangle', 5], ['sawtooth', 0]] as [OscillatorType, number][]) {
          const o = osc(type, f, dt, lp, end); vibAmt.connect(o.detune);
        }
        break;
      }
      case 'arp': case 'bell': {
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(e.inst === 'bell' ? 6000 : 4500, t);
        lp.frequency.setTargetAtTime(900, t, 0.08);
        lp.connect(g).connect(out);
        const rel = e.inst === 'bell' ? Math.max(0.6, d) : 0.12;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003);
        g.gain.setTargetAtTime(0, t + 0.004, rel / 3);
        const end = t + rel * 2 + 0.1;
        if (e.inst === 'bell') { osc('sine', f, 0, lp, end); osc('sine', f * 2.01, 0, lp, end); osc('triangle', f, 7, lp, end); }
        else { osc('square', f, -6, lp, end); osc('sawtooth', f, 6, lp, end); }
        break;
      }
      case 'kick': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        g.connect(out);
        const o = osc('sine', 150, 0, g, t + 0.4);
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        const click = ctx.createGain(); click.gain.setValueAtTime(v * 0.4, t); click.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
        click.connect(out); osc('square', 1200, 0, click, t + 0.02);
        // Sidechain-like pump on pads/bass/arp.
        p.duck.gain.cancelScheduledValues(t);
        p.duck.gain.setValueAtTime(1, t);
        p.duck.gain.linearRampToValueAtTime(1 - 0.6 * v, t + 0.01);
        p.duck.gain.setTargetAtTime(1, t + 0.04, 0.08);
        break;
      }
      case 'snare': {
        const g = ctx.createGain(); g.connect(out);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7;
        bp.connect(g); noiseSrc(bp, t + 0.2);
        const tg = ctx.createGain(); tg.gain.setValueAtTime(v * 0.6, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        tg.connect(out);
        const o = osc('triangle', 220, 0, tg, t + 0.1); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
        break;
      }
      case 'hat': case 'ohat': case 'crash': case 'swell': {
        const g = ctx.createGain(); g.connect(out);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
        hp.frequency.value = e.inst === 'hat' ? 8000 : e.inst === 'ohat' ? 7000 : 5000;
        hp.connect(g);
        const len = e.inst === 'hat' ? 0.05 : e.inst === 'ohat' ? 0.3 : d;
        if (e.inst === 'swell') { // reverse-cymbal: rises, then cuts
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d); g.gain.setTargetAtTime(0, t + d, 0.02);
          hp.frequency.setValueAtTime(9000, t); hp.frequency.exponentialRampToValueAtTime(3000, t + d);
        } else {
          g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        }
        noiseSrc(hp, t + len + 0.1);
        if (e.inst === 'crash') { // metallic shimmer partials
          for (const hz of [3150, 4870, 6420]) osc('square', hz, 0, hp, t + Math.min(len, 1.5));
        }
        break;
      }
      case 'timp': {
        const g = ctx.createGain(); g.connect(out);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.4, d * 3));
        const o = osc('sine', f, 0, g, t + Math.max(0.5, d * 3));
        o.frequency.setValueAtTime(f * 1.15, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        osc('triangle', f * 1.5, 0, g, t + 0.3);
        break;
      }
    }
  }
}
