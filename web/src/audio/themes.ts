// One original theme per world (12) plus menu and endless. Pure data.
import { SCALES, type ScaleName } from './theory';

export type DrumStyle = 'four' | 'broken' | 'half' | 'shuffle' | 'bounce';
/** Instrument palette: what the tune, the arps/plucks and the pad are played on, and which drum kit keeps time. */
export type LeadKind = 'synth' | 'marimba' | 'bell' | 'musicbox' | 'steel' | 'pluck' | 'harp' | 'flute' | 'brass' | 'toypiano';
export type PadKind = 'warm' | 'strings' | 'choir' | 'glass';
export type Kit = 'electro' | 'soft' | 'tribal' | 'chip';
export interface Voice { lead: LeadKind; arp: LeadKind; pad: PadKind; kit: Kit }
export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface Theme {
  id: string;
  seed: number;
  rootPc: number;            // 0..11, C = 0
  scaleName: ScaleName;
  scale: readonly number[];
  prog: readonly number[];   // 4 bars, diatonic chord roots as scale degrees (0-based)
  sevenths: boolean;
  bpmMin: number;
  bpmMax: number;
  drums: DrumStyle;
  swing: number;             // 0..0.3, delays odd 16ths
  lead: Wave;
  pad: Wave;
  bass: Wave;
  arpRate: 1 | 2;            // 1 = 16ths, 2 = 8ths
  arpContour: readonly number[]; // chord-tone indices 0..3
  bassPattern: string;       // 16 chars: r root, o octave, f fifth, . rest
  stabs: readonly number[];  // 16th steps for chord plucks
  fixedLevel: number | null; // menu: ignore speed and stay on this layer
  melody: readonly [number, number, number, number]; // motif ids (music.ts MOTIFS) for the theme's tune
  voice: Voice;
}

interface Def {
  id: string; rootPc: number; scale: ScaleName; prog: number[]; bpm: [number, number]; drums: DrumStyle;
  lead: Wave; pad: Wave; bass: Wave; sevenths?: boolean; arpRate?: 1 | 2; contour?: number[]; bassPat?: string;
  stabs?: number[]; swing?: number; fixed?: number; mel?: [number, number, number, number]; voice?: Voice;
}

// Motif sets: [verse A, verse B, chorus hook, chorus answer]. Each world gets its own tune.
const MELODIES: [number, number, number, number][] = [
  [0, 2, 3, 1], [3, 7, 5, 2], [2, 0, 6, 4], [7, 1, 0, 5], [1, 3, 4, 6], [6, 2, 3, 7], [4, 0, 5, 1], [5, 7, 6, 0],
];

const CONTOURS = [[0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 1, 3, 2, 3, 1, 2], [0, 1, 2, 1, 3, 2, 1, 0], [3, 2, 1, 0, 1, 2, 3, 2]];
const BASS = ['r.o.r.o.r.o.r.f.', 'r..or..or..or.f.', 'r.rrr.or.rrr.of.', 'r...r.o.r...r.f.', 'rr.or.r.rr.or.of'.padEnd(16, '.')];

function make(d: Def, i: number): Theme {
  return {
    id: d.id, seed: 1000 + i * 77, rootPc: d.rootPc, scaleName: d.scale, scale: SCALES[d.scale], prog: d.prog,
    sevenths: d.sevenths ?? false, bpmMin: d.bpm[0], bpmMax: d.bpm[1], drums: d.drums, swing: d.swing ?? 0.06, // a little swing everywhere: straight 16ths sound robotic
    melody: d.mel ?? MELODIES[i % MELODIES.length],
    voice: d.voice ?? { lead: 'synth', arp: 'synth', pad: 'warm', kit: 'electro' },
    lead: d.lead, pad: d.pad, bass: d.bass, arpRate: d.arpRate ?? 1, arpContour: d.contour ?? CONTOURS[i % 4],
    bassPattern: d.bassPat ?? BASS[i % 5], stabs: d.stabs ?? [2, 6, 10, 14], fixedLevel: d.fixed ?? null,
  };
}

// Progressions only use degrees whose diatonic triad is not diminished.
const DEFS: Def[] = [
  { id: 'world1', rootPc: 0, scale: 'major', prog: [0, 4, 5, 3], bpm: [112, 126], drums: 'four', lead: 'triangle', pad: 'sawtooth', bass: 'triangle', voice: { lead: 'marimba', arp: 'pluck', pad: 'strings', kit: 'electro' } },
  { id: 'world2', rootPc: 7, scale: 'mixolydian', prog: [0, 6, 3, 4], bpm: [114, 128], drums: 'bounce', lead: 'sawtooth', pad: 'triangle', bass: 'sawtooth', voice: { lead: 'flute', arp: 'harp', pad: 'warm', kit: 'soft' } },
  { id: 'world3', rootPc: 9, scale: 'dorian', prog: [0, 3, 0, 4], bpm: [116, 130], drums: 'broken', lead: 'square', pad: 'sawtooth', bass: 'triangle', sevenths: true, voice: { lead: 'steel', arp: 'marimba', pad: 'warm', kit: 'tribal' } },
  { id: 'world4', rootPc: 2, scale: 'lydian', prog: [0, 1, 4, 0], bpm: [112, 128], drums: 'half', lead: 'triangle', pad: 'triangle', bass: 'sine', arpRate: 2, voice: { lead: 'musicbox', arp: 'bell', pad: 'glass', kit: 'soft' } },
  { id: 'world5', rootPc: 4, scale: 'minor', prog: [0, 5, 2, 6], bpm: [118, 134], drums: 'four', lead: 'sawtooth', pad: 'sawtooth', bass: 'sawtooth', voice: { lead: 'pluck', arp: 'pluck', pad: 'strings', kit: 'tribal' } },
  { id: 'world6', rootPc: 5, scale: 'major', prog: [0, 2, 3, 4], bpm: [114, 130], drums: 'shuffle', lead: 'square', pad: 'triangle', bass: 'triangle', swing: 0.18, voice: { lead: 'bell', arp: 'musicbox', pad: 'choir', kit: 'soft' } },
  { id: 'world7', rootPc: 10, scale: 'dorian', prog: [0, 3, 6, 3], bpm: [116, 132], drums: 'bounce', lead: 'triangle', pad: 'sawtooth', bass: 'sine', sevenths: true, voice: { lead: 'marimba', arp: 'flute', pad: 'warm', kit: 'tribal' } },
  { id: 'world8', rootPc: 2, scale: 'mixolydian', prog: [0, 6, 3, 0], bpm: [118, 134], drums: 'broken', lead: 'sawtooth', pad: 'triangle', bass: 'sawtooth', arpRate: 2, voice: { lead: 'synth', arp: 'synth', pad: 'strings', kit: 'electro' } },
  { id: 'world9', rootPc: 9, scale: 'minor', prog: [0, 5, 3, 6], bpm: [120, 136], drums: 'four', lead: 'square', pad: 'sawtooth', bass: 'triangle', voice: { lead: 'toypiano', arp: 'musicbox', pad: 'warm', kit: 'chip' } },
  { id: 'world10', rootPc: 3, scale: 'lydian', prog: [0, 4, 1, 4], bpm: [114, 130], drums: 'half', lead: 'triangle', pad: 'sawtooth', bass: 'sine', voice: { lead: 'brass', arp: 'pluck', pad: 'strings', kit: 'tribal' } },
  { id: 'world11', rootPc: 5, scale: 'dorian', prog: [0, 3, 6, 4], bpm: [120, 136], drums: 'shuffle', lead: 'sawtooth', pad: 'triangle', bass: 'sawtooth', swing: 0.14, sevenths: true, voice: { lead: 'harp', arp: 'bell', pad: 'choir', kit: 'soft' } },
  { id: 'world12', rootPc: 0, scale: 'lydian', prog: [0, 4, 1, 5], bpm: [122, 136], drums: 'bounce', lead: 'triangle', pad: 'sawtooth', bass: 'triangle', voice: { lead: 'bell', arp: 'synth', pad: 'glass', kit: 'electro' } },
];

export const WORLD_THEMES: readonly Theme[] = DEFS.map(make);
export const MENU_THEME: Theme = make({ id: 'menu', rootPc: 5, scale: 'major', prog: [0, 3, 0, 4], bpm: [92, 92], drums: 'half', lead: 'triangle', pad: 'triangle', bass: 'sine', arpRate: 2, contour: [0, 1, 2, 1, 3, 2, 1, 2], bassPat: 'r.......o.......', stabs: [6, 14], fixed: 1, swing: 0.16, mel: [2, 7, 0, 4], voice: { lead: 'musicbox', arp: 'harp', pad: 'glass', kit: 'soft' } }, 20);
export const ENDLESS_THEME: Theme = make({ id: 'endless', rootPc: 2, scale: 'dorian', prog: [0, 3, 6, 4], bpm: [112, 136], drums: 'four', lead: 'sawtooth', pad: 'sawtooth', bass: 'triangle', sevenths: true }, 21);

export type MusicMode = 'menu' | 'run' | 'endless' | 'results';

/** Results keeps the world's key so the fanfare matches, but is calm and slower. */
export function themeFor(mode: MusicMode, world = 1): Theme {
  if (mode === 'menu') return MENU_THEME;
  if (mode === 'endless') return ENDLESS_THEME;
  const w = WORLD_THEMES[Math.min(WORLD_THEMES.length, Math.max(1, Math.round(world))) - 1];
  if (mode === 'results') return { ...w, id: `${w.id}-results`, bpmMin: 100, bpmMax: 100, drums: 'half', fixedLevel: 1, lead: 'triangle' };
  return w;
}
