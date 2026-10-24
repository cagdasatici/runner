// One-to-one port of GameCore/Sources/GameCore/Track.swift.
import { SplitMix64 } from './rng';

export type ObstacleKind = 'hurdle' | 'bar' | 'train' | 'ramp';
export const OBSTACLE_KINDS: ObstacleKind[] = ['hurdle', 'bar', 'train']; // same order as Swift allCases

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  lane: number; // 0 = left, 1 = middle, 2 = right
  z: number; // near edge; far edge is z + obstacleLength(o)
  len?: number; // overrides the default length (long roof trains)
}

export interface Coin {
  id: number;
  lane: number;
  z: number;
  y?: number; // height; COIN_Y when missing (roof coins sit at ROOF_Y + COIN_Y)
}

export type PickupKind = 'board' | 'magnet' | 'sneakers' | 'double' | 'jetpack' | 'mystery';
export const PICKUP_KINDS: PickupKind[] = ['board', 'magnet', 'sneakers', 'double', 'jetpack', 'mystery'];
export interface Pickup {
  id: number;
  kind: PickupKind;
  lane: number;
  z: number;
}

export const LANE_WIDTH = 2.5;
export const FIRST_ROW_Z = 40.0;
export const ROW_GAP = 18.0;
export const TRAIN_LENGTH = 10.0;
export const THIN_LENGTH = 0.5;
export const COINS_PER_ROW = 5;
export const COIN_SPACING = 2.0;
export const COIN_Y = 0.9;
export const ROOF_Y = 3.5; // top of every train: the runner stands here on a roof
export const ROOF_TOLERANCE = 0.25; // feet this close under the roof still count as on it (lane hops, falling off an end)
export const RAMP_LENGTH = 7.0; // a ramp rises from 0 to ROOF_Y over this distance and ends at the train's front
export const SUPPORT_HALF = LANE_WIDTH / 2; // roofs and ramps carry the runner up to the lane border, so adjacent roofs join

export function laneX(lane: number): number {
  return (lane - 1) * LANE_WIDTH;
}
export function rowZ(row: number): number {
  return FIRST_ROW_Z + row * ROW_GAP;
}
export function obstacleLength(o: Obstacle): number {
  if (o.len !== undefined) return o.len;
  if (o.kind === 'ramp') return RAMP_LENGTH;
  return o.kind === 'train' ? TRAIN_LENGTH : THIN_LENGTH;
}
export const coinY = (c: Coin): number => c.y ?? COIN_Y;

export class Track {
  obstacles: Obstacle[] = [];
  coins: Coin[] = [];
  pickups: Pickup[] = [];
  rowsGenerated = 0;
  private rng: SplitMix64;
  private nextID = 0;

  constructor(seed: bigint) {
    this.rng = new SplitMix64(seed);
  }

  /** Hand-made track for tests. Don't call generate() on it. */
  static fixed(obstacles: Obstacle[], coins: Coin[] = [], pickups: Pickup[] = []): Track {
    const t = new Track(0n);
    t.obstacles = obstacles;
    t.coins = coins;
    t.pickups = pickups;
    return t;
  }

  /** Adds rows until the next row would start beyond `z`. */
  generate(upTo: number): void {
    while (rowZ(this.rowsGenerated) <= upTo) {
      this.addRow(this.rowsGenerated);
      this.rowsGenerated += 1;
    }
  }

  /** Forgets things the runner has fully passed. */
  dropBehind(z: number): void {
    this.obstacles = this.obstacles.filter((o) => !(o.z + obstacleLength(o) < z - 5));
    this.coins = this.coins.filter((c) => !(c.z < z - 5));
    this.pickups = this.pickups.filter((p) => !(p.z < z - 5));
  }

  private addRow(row: number): void {
    const z0 = rowZ(row);
    const count = row < 3 ? 1 : 1 + this.rng.int(2); // 1 or 2 obstacles; one lane always free
    const a = this.rng.int(3);
    const lanes = [a];
    if (count === 2) lanes.push((a + 1 + this.rng.int(2)) % 3);
    for (const lane of lanes) {
      const kind = OBSTACLE_KINDS[this.rng.int(3)];
      this.obstacles.push({ id: this.nextID, kind, lane, z: z0 });
      this.nextID += 1;
    }
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    const coinLane = free[this.rng.int(free.length)];
    for (let i = 0; i < COINS_PER_ROW; i++) {
      this.coins.push({ id: this.nextID, lane: coinLane, z: z0 + i * COIN_SPACING });
      this.nextID += 1;
    }
  }
}
