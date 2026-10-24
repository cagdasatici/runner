// Pure music theory helpers: seeded RNG, scales, scale-degree -> MIDI. No Web Audio in here.

export function hash32(a: number, b: number): number {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul((b + 0x7f4a7c15) >>> 0, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}

export interface Rng { next(): number; int(n: number): number; chance(p: number): boolean; pick<T>(a: readonly T[]): T }

/** mulberry32: tiny deterministic generator, same seed -> same sequence. */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n), chance: (p) => next() < p, pick: (a) => a[Math.floor(next() * a.length)] };
}

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
} as const;
export type ScaleName = keyof typeof SCALES;

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** MIDI note of scale degree `deg` (0 = tonic, 7 = octave up, negatives go down). base = MIDI of the tonic. */
export function degreeToMidi(scale: readonly number[], base: number, deg: number): number {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  return base + oct * 12 + scale[((deg % n) + n) % n];
}

/** Moves a note by octaves into [lo, hi] without changing its pitch class. */
export function fold(m: number, lo: number, hi: number): number {
  while (m > hi) m -= 12;
  while (m < lo) m += 12;
  return m;
}

export const pitchClass = (m: number) => ((m % 12) + 12) % 12;
