// Journey levels: 12 worlds × 10 levels. Each level is a finite, seeded track with a finish line,
// 3 golden stars and a difficulty that grows with the level number. Pure logic, no DOM.
import { SplitMix64 } from './rng';
import { canReach, cloneState, Runner, startState, step, type Move, type Pace, type RunnerState } from './runner';
import { COIN_SPACING, COINS_PER_ROW, FIRST_ROW_Z, OBSTACLE_KINDS, Track, type Coin, type Obstacle, type ObstacleKind } from './track';

export const WORLDS = 12;
export const LEVELS_PER_WORLD = 10;
export const LEVEL_COUNT = WORLDS * LEVELS_PER_WORLD; // 120
export const STARS_PER_LEVEL = 3;
export const COIN_SHARE_FOR_3_STARS = 0.7;
export const FINISH_AFTER_LAST_ROW = 14; // metres past the last row's near edge (clears a train)

export interface LevelSpec {
  n: number;          // 1…120
  world: number;      // 1…12
  inWorld: number;    // 1…10
  seed: bigint;
  rows: number;       // obstacle rows before the finish
  rowGap: number;     // metres between rows
  twoChance: number;  // % of rows (after the first 3) with two obstacles
  trainChance: number; // % of obstacles that are trains; the rest split hurdle/bar
  pace: Pace;
}

export interface GoldenStar { id: number; lane: number; z: number }

export interface Level {
  spec: LevelSpec;
  track: Track;       // finite: every obstacle and coin of the level
  stars: GoldenStar[];
  finishZ: number;
  totalCoins: number;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Difficulty curve. t goes 0 → 1 over the journey; boss levels (x-10) are a bit longer. */
export function levelSpec(n: number): LevelSpec {
  if (!Number.isInteger(n) || n < 1 || n > LEVEL_COUNT) throw new RangeError(`level ${n} is not 1…${LEVEL_COUNT}`);
  const t = (n - 1) / (LEVEL_COUNT - 1);
  const inWorld = ((n - 1) % LEVELS_PER_WORLD) + 1;
  return {
    n,
    world: Math.floor((n - 1) / LEVELS_PER_WORLD) + 1,
    inWorld,
    seed: BigInt(7919 * n + 104729),
    rows: 14 + Math.round(30 * t) + (inWorld === 10 ? 4 : 0),
    rowGap: r1(22 - 5 * t),
    twoChance: Math.round(10 + 45 * t),
    trainChance: Math.round(10 + 40 * t),
    pace: { start: r1(9 + 4 * t), accel: Math.round((0.08 + 0.12 * t) * 1000) / 1000, max: r1(12 + 8 * t) },
  };
}

export function rowStart(spec: LevelSpec, row: number): number {
  return FIRST_ROW_Z + row * spec.rowGap;
}

/** Builds the whole level up front. Same n → same level, always. */
export function buildLevel(n: number): Level {
  const spec = levelSpec(n);
  const rng = new SplitMix64(spec.seed);
  const obstacles: Obstacle[] = [];
  const coins: Coin[] = [];
  const coinLanes: number[] = [];
  const trainLanes: number[][] = [];
  let id = 0;
  const kindOf = (): ObstacleKind => {
    if (rng.int(100) < spec.trainChance) return 'train';
    return OBSTACLE_KINDS[rng.int(2)]; // hurdle or bar
  };
  for (let row = 0; row < spec.rows; row++) {
    const z0 = rowStart(spec, row);
    const count = row >= 3 && rng.int(100) < spec.twoChance ? 2 : 1;
    const a = rng.int(3);
    const lanes = [a];
    if (count === 2) lanes.push((a + 1 + rng.int(2)) % 3);
    const trains: number[] = [];
    for (const lane of lanes) {
      const kind = kindOf();
      if (kind === 'train') trains.push(lane);
      obstacles.push({ id: id++, kind, lane, z: z0 });
    }
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    const coinLane = free[rng.int(free.length)];
    for (let i = 0; i < COINS_PER_ROW; i++) coins.push({ id: id++, lane: coinLane, z: z0 + i * COIN_SPACING });
    coinLanes.push(coinLane);
    trainLanes.push(trains);
  }
  // Golden stars: the prize at the end of a coin trail (2 m after the last coin), aiming for 25 %, 55 % and 85 %
  // of the level and trying the nearest rows outward (+1, -1, +2, -2 …) when a row doesn't qualify.
  // A row qualifies when (a) the next row has no train in that lane and (b) the star is not in a side lane
  // while a train fills the middle lane (a runner on the far side could not get across in time).
  const stars: GoldenStar[] = [];
  const usedRows = new Set<number>();
  for (const share of [0.25, 0.55, 0.85]) {
    const target = Math.floor(spec.rows * share);
    for (let k = 0; k < spec.rows * 2; k++) {
      const row = target + (k % 2 === 0 ? k / 2 : -(k + 1) / 2);
      if (row < 1 || row > spec.rows - 2 || usedRows.has(row)) continue;
      const blocked = coinLanes[row] !== 1 && trainLanes[row].includes(1);
      if (blocked || trainLanes[row + 1].includes(coinLanes[row])) continue;
      usedRows.add(row);
      stars.push({ id: id++, lane: coinLanes[row], z: rowStart(spec, row) + COINS_PER_ROW * COIN_SPACING });
      break;
    }
  }
  stars.sort((p, q) => p.z - q.z);
  if (stars.length !== STARS_PER_LEVEL) throw new Error(`level ${n}: could only place ${stars.length} golden stars`);
  const track = Track.fixed(obstacles, coins);
  return { spec, track, stars, finishZ: rowStart(spec, spec.rows - 1) + FINISH_AFTER_LAST_ROW, totalCoins: coins.length };
}

/** Coins needed for 3 stars: 70 % rounded up. */
export function coinsFor3Stars(totalCoins: number): number {
  return Math.ceil(totalCoins * COIN_SHARE_FOR_3_STARS - 1e-9);
}

/** 0 = crashed (retry), 1 = finished, 2 = finished + at least 2 golden stars, 3 = all 3 golden stars + 70 % of coins. */
export function rating(r: { finished: boolean; goldenStars: number; coins: number; totalCoins: number }): number {
  if (!r.finished) return 0;
  if (r.goldenStars >= STARS_PER_LEVEL && r.coins >= coinsFor3Stars(r.totalCoins)) return 3;
  if (r.goldenStars >= 2) return 2;
  return 1;
}

/** One attempt at a level: runner + finite track + golden stars + finish line. */
export const FINISH_EASE_SECONDS = 0.3;

export class LevelRun {
  readonly level: Level;
  state: RunnerState = startState();
  readonly starsTaken = new Set<number>();
  finished = false;

  constructor(n: number) {
    this.level = buildLevel(n);
  }

  get over(): boolean { return this.finished || this.state.crashed; }

  tick(move: Move): void {
    if (this.over) return;
    this.state = step(this.state, move, this.level.track, this.level.spec.pace);
    if (this.state.crashed) return;
    for (const g of this.level.stars) if (!this.starsTaken.has(g.id) && canReach(this.state, g.lane, g.z)) this.starsTaken.add(g.id);
    if (this.state.z >= this.level.finishZ) this.finished = true;
  }

  get stars(): number {
    return rating({ finished: this.finished, goldenStars: this.starsTaken.size, coins: this.state.coins, totalCoins: this.level.totalCoins });
  }

  /** For the finish celebration: keeps the runner jogging past the line without any more rules. */
  private coastTicks = 0;
  private coastY0 = 0;

  coast(): void {
    const s = cloneState(this.state);
    // Release crawl and ease any airborne height back to the ground over FINISH_EASE_SECONDS (smoothstep).
    if (this.coastTicks === 0) this.coastY0 = s.y;
    this.coastTicks += 1;
    s.slideTicks = 0;
    s.vy = 0;
    const k = Math.min(1, (this.coastTicks * Runner.dt) / FINISH_EASE_SECONDS);
    s.y = this.coastY0 * (1 - k * k * (3 - 2 * k));
    s.z += this.level.spec.pace.max * 0.6 * Runner.dt;
    s.tick += 1;
    this.state = s;
  }
}

