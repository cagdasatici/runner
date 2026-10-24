// One original theme per world (12) plus menu and endless. Pure data.
import { SCALES, type ScaleName } from './theory';

export type DrumStyle = 'four' | 'broken' | 'half' | 'shuffle' | 'bounce';
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
}

interface Def {
  id: string; rootPc: number; scale: ScaleName; prog: number[]; bpm: [number, number]; drums: DrumStyle;
  lead: Wave; pad: Wave; bass: Wave; sevenths?: boolean; arpRate?: 1 | 2; contour?: number[]; bassPat?: string;
  stabs?: number[]; swing?: number; fixed?: number;
}

const CONTOURS = [[0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 1, 3, 2, 3, 1, 2], [0, 1, 2, 1, 3, 2, 1, 0], [3, 2, 1, 0, 1, 2, 3, 2]];
const BASS = ['r.o.r.o.r.o.r.f.', 'r..or..or..or.f.', 'r.rrr.or.rrr.of.', 'r...r.o.r...r.f.', 'rr.or.r.rr.or.of'.padEnd(16, '.')];

function make(d: Def, i: number): Theme {
  return {
    id: d.id, seed: 1000 + i * 77, rootPc: d.rootPc, scaleName: d.scale, scale: SCALES[d.scale], prog: d.prog,
    sevenths: d.sevenths ?? false, bpmMin: d.bpm[0], bpmMax: d.bpm[1], drums: d.drums, swing: d.swing ?? 0,
    lead: d.lead, pad: d.pad, bass: d.bass, arpRate: d.arpRate ?? 1, arpContour: d.contour ?? CONTOURS[i % 4],
    bassPattern: d.bassPat ?? BASS[i % 5], stabs: d.stabs ?? [2, 6, 10, 14], fixedLevel: d.fixed ?? null,
  };
}

// Progressions only use degrees whose diatonic triad is not diminished.
const DEFS: Def[] = [
  { id: 'world1', rootPc: 0, scale: 'major', prog: [0, 4, 5, 3], bpm: [112, 126], drums: 'four', lead: 'triangle', pad: 'sawtooth', bass: 'triangle' },
  { id: 'world2', rootPc: 7, scale: 'mixolydian', prog: [0, 6, 3, 4], bpm: [114, 128], drums: 'bounce', lead: 'sawtooth', pad: 'triangle', bass: 'sawtooth' },
  { id: 'world3', rootPc: 9, scale: 'dorian', prog: [0, 3, 0, 4], bpm: [116, 130], drums: 'broken', lead: 'square', pad: 'sawtooth', bass: 'triangle', sevenths: true },
  { id: 'world4', rootPc: 2, scale: 'lydian', prog: [0, 1, 4, 0], bpm: [112, 128], drums: 'half', lead: 'triangle', pad: 'triangle', bass: 'sine', arpRate: 2 },
  { id: 'world5', rootPc: 4, scale: 'minor', prog: [0, 5, 2, 6], bpm: [118, 134], drums: 'four', lead: 'sawtooth', pad: 'sawtooth', bass: 'sawtooth' },
  { id: 'world6', rootPc: 5, scale: 'major', prog: [0, 2, 3, 4], bpm: [114, 130], drums: 'shuffle', lead: 'square', pad: 'triangle', bass: 'triangle', swing: 0.18 },
  { id: 'world7', rootPc: 10, scale: 'dorian', prog: [0, 3, 6, 3], bpm: [116, 132], drums: 'bounce', lead: 'triangle', pad: 'sawtooth', bass: 'sine', sevenths: true },
  { id: 'world8', rootPc: 2, scale: 'mixolydian', prog: [0, 6, 3, 0], bpm: [118, 134], drums: 'broken', lead: 'sawtooth', pad: 'triangle', bass: 'sawtooth', arpRate: 2 },
  { id: 'world9', rootPc: 9, scale: 'minor', prog: [0, 5, 3, 6], bpm: [120, 136], drums: 'four', lead: 'square', pad: 'sawtooth', bass: 'triangle' },
  { id: 'world10', rootPc: 3, scale: 'lydian', prog: [0, 4, 1, 4], bpm: [114, 130], drums: 'half', lead: 'triangle', pad: 'sawtooth', bass: 'sine' },
  { id: 'world11', rootPc: 5, scale: 'dorian', prog: [0, 3, 6, 4], bpm: [120, 136], drums: 'shuffle', lead: 'sawtooth', pad: 'triangle', bass: 'sawtooth', swing: 0.14, sevenths: true },
  { id: 'world12', rootPc: 0, scale: 'lydian', prog: [0, 4, 1, 5], bpm: [122, 136], drums: 'bounce', lead: 'triangle', pad: 'sawtooth', bass: 'triangle' },
];

export const WORLD_THEMES: readonly Theme[] = DEFS.map(make);
export const MENU_THEME: Theme = make({ id: 'menu', rootPc: 5, scale: 'major', prog: [0, 3, 0, 4], bpm: [92, 92], drums: 'half', lead: 'triangle', pad: 'triangle', bass: 'sine', arpRate: 2, contour: [0, 1, 2, 1, 3, 2, 1, 2], bassPat: 'r.......o.......', stabs: [6, 14], fixed: 1 }, 20);
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
