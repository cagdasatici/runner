// Character registry and the pure "game state -> animation" mapping. No three.js here, so it is trivial to unit test.
// To add a character: drop a CC0 .glb into public/models, add an entry below, list it in docs/ASSETS.md.

import type { FaceDef } from './face';

export type AnimKey = 'run' | 'jump' | 'slide' | 'crash' | 'idle' | 'stumble' | 'fly' | 'board';

export interface CharacterDef {
  id: string;
  name: string;
  /** Path relative to the page (the service worker precaches public/models). */
  model: string;
  /** Standing height (metres) the model is scaled to; animals use their body height. */
  height: number;
  /** Clip name per animation. Missing keys are handled procedurally (see RunnerFigure). */
  clips: Partial<Record<AnimKey, string>>;
  /** How the runner ducks under bars: play a roll clip, or tuck (a procedural crouch: squash and lean). */
  slide: 'clip' | 'tuck';
  /** Optional colour multiplier for the model's materials (0xffffff = unchanged). */
  tint?: number;
  /** Rotation about Y (radians) so the model faces the running direction (-z). */
  yaw: number;
  /** Speed of the run clip at 10 m/s (1 = as authored). */
  runSpeed: number;
  /** Built in code instead of loaded from `model` (no clips; animated by the procedural rig). */
  procedural?: 'maltese' | 'maltese-senior';
  /** Replaces the colour of materials by glTF material name (e.g. { Hair: 0x8a5a33 }). */
  recolor?: Record<string, number>;
  /** Meshes (by glTF node name) left out of the model. */
  hide?: string[];
  /** Extra props built in code and attached to the head bone. */
  extras?: 'dress'[];
  /** Hand-built eyes, mouth, hair and glasses (see face.ts). */
  face?: FaceDef;
  /** Head bone scale: children get proportionally bigger heads. */
  bigHead?: number;
  /** Cuts the beard out of the adventurer's hair mesh (it shares the Hair material). */
  beardless?: boolean;
  /** Bella and Toby: poop and pee appear on the track. */
  messes?: boolean;
  /** Kids and dogs: file-name prefix of their photos in faces/ for the finish photo wave. */
  photoSet?: string;
}

const animal = (id: string, name: string, height: number, extra: Partial<CharacterDef> = {}): CharacterDef => ({
  id, name, model: `models/${id}.glb`, height, slide: 'tuck', yaw: Math.PI, runSpeed: 1.15,
  clips: { run: 'Gallop', jump: 'Gallop_Jump', crash: 'Death', idle: 'Idle', stumble: 'Idle_HitReact_Left', fly: 'Gallop_Jump', board: 'Idle' },
  ...extra,
});

/** A child built on the adventurer model: no backpack, lighter skin, own colours. */
const kid = (id: string, name: string, height: number, extra: Partial<CharacterDef>): CharacterDef => ({
  id, name, model: 'models/adventurer.glb', height, slide: 'tuck', yaw: Math.PI, runSpeed: 1.05, hide: ['Backpack'], beardless: true,
  clips: { run: 'Run', jump: 'Run', crash: 'Death', idle: 'Idle', stumble: 'HitRecieve', fly: 'Run', board: 'Idle' },
  ...extra,
  recolor: { Skin: 0xf2c9a6, ...extra.recolor },
});

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'adventurer', name: 'Alex', model: 'models/adventurer.glb', height: 1.7, slide: 'tuck', yaw: Math.PI, runSpeed: 1.0,
    // slide: the Roll clip is a full somersault (inverts the body, clips the head into the track), so Alex crouches procedurally instead
    clips: { run: 'Run', jump: 'Run', crash: 'Death', idle: 'Idle', stumble: 'HitRecieve', fly: 'Run', board: 'Idle' },
  },
  animal('shiba', 'Biscuit', 1.35),
  animal('cat', 'Whiskers', 1.15, {
    runSpeed: 1.0,
    clips: { run: 'Run', jump: 'Jump_Loop', crash: 'Death', idle: 'Idle', fly: 'Jump_Loop', board: 'Idle' },
  }),
  animal('fox', 'Rusty', 1.4),
  {
    id: 'maltese', name: 'Bella', model: '', procedural: 'maltese', height: 1.1, slide: 'tuck', yaw: 0, runSpeed: 1.2, messes: true, photoSet: 'bella',
    // clip names are only labels here: the procedural rig animates every key itself
    clips: { run: 'run', jump: 'jump', slide: 'slide', crash: 'crash', idle: 'idle', fly: 'fly', board: 'idle' },
  },
  kid('arel', 'Arel', 1.3, {
    photoSet: 'arel',
    bigHead: 1.3,
    face: { iris: 0x5a3a22, lip: 0xc4695f, smile: 'closed', hair: [0xb08a5a, 0xc9a574], style: 'messy', blush: 0.16, brow: 0x7a5a38, browThick: 0.017,
      photo: { url: `${import.meta.env.BASE_URL}faces/arel3.png`, eyes: [[121, 132], [170, 133]], mouth: [144, 187], mouthDrop: 0.36 } },
    recolor: { Hair: 0xb08a5a, Eyebrows: 0x6b5030, Green: 0x3a9d5d, LightGreen: 0x4fb46f, Brown: 0x334155, Brown2: 0x1e293b },
  }),
  kid('nora', 'Nora', 1.35, {
    photoSet: 'nora',
    bigHead: 1.3,
    // Brown/Brown2 are the trousers: skin-coloured so the legs under the skirt read as bare; Green/LightGreen is the bodice
    recolor: { Hair: 0xa8774c, Eyebrows: 0x7a5a38, Green: 0xf4f4f6, LightGreen: 0xffffff, Brown: 0xf2c9a6, Brown2: 0xe8bb96 },
    face: { iris: 0x7a5a2c, lip: 0xd9707a, smile: 'open', hair: [0x9c6f45, 0xc29566], style: 'long', glasses: true, lashes: true, blush: 0.14, brow: 0x9a7448, browThick: 0.011,
      photo: { url: `${import.meta.env.BASE_URL}faces/nora1.png`, eyes: [[84, 105], [118, 104]], mouth: [101, 143], mouthDrop: 0.35 } },
    extras: ['dress'],
  }),
  {
    id: 'toby', name: 'Toby', model: '', procedural: 'maltese-senior', height: 1.05, slide: 'tuck', yaw: 0, runSpeed: 1.1, messes: true, photoSet: 'toby',
    clips: { run: 'run', jump: 'jump', slide: 'slide', crash: 'crash', idle: 'idle', fly: 'fly', board: 'idle' },
  },
];

export const DEFAULT_CHARACTER = CHARACTERS[0].id;

export function characterById(id: string | null | undefined): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/** The id `step` places away from `id` in the list, wrapping around (step = +1 next, -1 previous). */
export function stepCharacter(id: string, step: number): string {
  const i = CHARACTERS.findIndex((c) => c.id === id);
  const n = CHARACTERS.length;
  return CHARACTERS[(((i < 0 ? 0 : i) + step) % n + n) % n].id;
}

const KEY = 'character';

/** Reads the saved character id; any storage failure or unknown id gives the default. */
export function loadCharacter(storage: Pick<Storage, 'getItem'> | null = safeStorage()): string {
  try {
    const v = storage?.getItem(KEY);
    return CHARACTERS.some((c) => c.id === v) ? (v as string) : DEFAULT_CHARACTER;
  } catch {
    return DEFAULT_CHARACTER;
  }
}
export function saveCharacter(id: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try { storage?.setItem(KEY, id); } catch { /* private mode / quota: selection just isn't remembered */ }
}
function safeStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** The part of RunnerState that decides the animation. Optional fields belong to power-ups that may not exist yet. */
export interface AnimInput {
  y: number;
  vy: number;
  slideTicks: number;
  crashed: boolean;
  board?: number; // > 0 while riding the hoverboard
  fly?: number; // > 0 while flying with the jetpack
}

/** Priority: crash > stumble > fly > slide > airborne (jump) > hoverboard > run. */
export function animFor(s: AnimInput, stumbling = false): AnimKey {
  if (s.crashed) return 'crash';
  if (stumbling) return 'stumble';
  if ((s.fly ?? 0) > 0) return 'fly';
  if (s.slideTicks > 0) return 'slide';
  if (s.y !== 0 || s.vy !== 0) return 'jump';
  if ((s.board ?? 0) > 0) return 'board';
  return 'run';
}
