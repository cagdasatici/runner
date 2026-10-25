// Character registry and the pure "game state -> animation" mapping. No three.js here, so it is trivial to unit test.
// To add a character: drop a CC0 .glb into public/models, add an entry below, list it in docs/ASSETS.md.

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
}

const animal = (id: string, name: string, height: number, extra: Partial<CharacterDef> = {}): CharacterDef => ({
  id, name, model: `models/${id}.glb`, height, slide: 'tuck', yaw: Math.PI, runSpeed: 1.15,
  clips: { run: 'Gallop', jump: 'Gallop_Jump', crash: 'Death', idle: 'Idle', stumble: 'Idle_HitReact_Left', fly: 'Gallop_Jump', board: 'Idle' },
  ...extra,
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
