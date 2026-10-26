// Dog messes (Bella, Toby): poop and pee on the track. Placed by a pure hash of (seed, slot), never by the
// track RNG, so every obstacle/coin sequence stays identical with or without messes.
import { laneX, obstacleLength, type Mess, type MessKind, type Track } from './track';

export const MESS_SLOT = 11;
export const MESS_FIRST_Z = 70;
export const MESS_CHANCE = 0.55; // raw per-slot chance; the obstacle/coin/pickup exclusion removes ~60 %, leaving ~0.15-0.30 of slots
export const MESS_TICKS = 660; // 5.5 s at 120 ticks per second
export const MESS_ID_BASE = 1_000_000_000;
export const MESS_HALF_WIDTH = 0.9;

/** 32-bit integer hash (lowbias32 on a mixed pair) → [0, 1). */
export function hash01(seed: number, slot: number, salt = 0): number {
  let x = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(slot + salt * 7919, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Adds messes for every slot whose z is in [zFrom, zTo). Idempotent per slot (skips ids already present). */
export function placeMesses(track: Track, seed: number, zFrom: number, zTo: number, maxZ = Infinity): void {
  const have = new Set(track.messes.map((m) => m.id));
  const first = Math.max(0, Math.ceil((zFrom - MESS_FIRST_Z) / MESS_SLOT));
  for (let k = first; ; k++) {
    const z = MESS_FIRST_Z + k * MESS_SLOT;
    if (z >= zTo) break;
    if (z > maxZ) break;
    const id = MESS_ID_BASE + k;
    if (have.has(id) || hash01(seed, k) >= MESS_CHANCE) continue;
    const lane = Math.floor(hash01(seed, k, 1) * 3);
    const kind: MessKind = hash01(seed, k, 2) < 0.6 ? 'poop' : 'pee';
    const blocked =
      track.obstacles.some((o) => o.lane === lane && o.z < z + 4 && o.z + obstacleLength(o) > z - 4) ||
      track.coins.some((c) => c.lane === lane && Math.abs(c.z - z) < 1.5) ||
      track.pickups.some((p) => p.lane === lane && Math.abs(p.z - z) < 3);
    if (blocked) continue;
    track.messes.push({ id, kind, lane, z });
  }
}

/** True when this tick (prev → next) runs the grounded runner over mess m. */
export function stepsOn(prevZ: number, z: number, x: number, y: number, floor: number, flying: boolean, m: Mess): boolean {
  return !flying && floor === 0 && y - floor < 0.15 && Math.abs(x - laneX(m.lane)) < MESS_HALF_WIDTH && prevZ < m.z && m.z <= z;
}
