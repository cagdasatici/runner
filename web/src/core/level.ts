// Journey levels: 12 worlds × 10 levels. Each level is a finite, seeded track with a finish line,
// 3 golden stars and a difficulty that grows with the level number. Pure logic, no DOM.
import { placeMesses } from './messes';
import { SplitMix64 } from './rng';
import { canReach, cloneState, Power, Runner, startState, step, type Move, type Pace, type RunnerState, type StartOptions } from './runner';
import { COIN_SPACING, COIN_Y, COINS_PER_ROW, FIRST_ROW_Z, OBSTACLE_KINDS, obstacleLength, RAMP_LENGTH, ROOF_Y, Track, type Coin, type Obstacle, type ObstacleKind, type Pickup, type PickupKind } from './track';

export const WORLDS = 12;
export const LEVELS_PER_WORLD = 10;
export const LEVEL_COUNT = WORLDS * LEVELS_PER_WORLD; // 120
export const STARS_PER_LEVEL = 3;
export const COIN_SHARE_FOR_3_STARS = 0.7;
export const FINISH_AFTER_LAST_ROW = 14; // metres past the last row's near edge (clears a train)
export const RAMP_FIRST_LEVEL = 6; // levels before this have no ramps
export const RAMP_TRAIN_LENGTH = 28; // a ramp train (A) is long enough to run on for a while
export const TWIN_TRAIN_LENGTH = 12; // the second roof (B) of a twin piece, in the next row
export const CHAIN_FIRST_LEVEL = 12; // roof-to-roof chains (a second roof ahead in the same lane, one jump away) start here
export const CHAIN_GAP = 3; // metres of air between the end of roof A and the start of roof C
export const CHAIN_TRAIN_LENGTH = 16; // roof C
export const RAMP_COOLDOWN = 4; // rows after a ramp piece before the next one may start
export const ROOF_COIN_STEP = 4; // metres between roof coins

export const POWER_FIRST_LEVEL = 3; // levels before this have no pickups (level 1 keeps its golden layout)
export const JETPACKS_PER_LEVEL = 2; // placed on purpose (see buildLevel), not drawn from the pickup weights
export const PICKUP_OFFSET = 12; // metres after a row's start, in its coin lane, just past the golden star
export const FLY_STAR_FREE = 170; // no golden star within this distance after a jetpack pickup (flying skips the ground)
export const JETPACK_STAR_FREE = 75; // a jetpack is placed, if it can be, so that no golden star lies within this distance after it (~one flight)
export const FLY_TRAIL_COINS = 30; // air coins after a jetpack pickup, 4 m apart
/** % of rows (from row 3) with a pickup: 10 % at level 3 … 16 % at level 120. */
export const pickupChance = (n: number): number => (n < POWER_FIRST_LEVEL ? 0 : Math.round(10 + 6 * ((n - 1) / (LEVEL_COUNT - 1))));
const PICKUP_WEIGHTS: [PickupKind, number][] = [['board', 24], ['magnet', 45], ['sneakers', 14], ['double', 18], ['mystery', 12]];

/** % of eligible rows that start a ramp piece: 0 before level 6, then 10 … 30. */
export const rampChance = (n: number): number => (n < RAMP_FIRST_LEVEL ? 0 : Math.round(10 + 20 * ((n - 1) / (LEVEL_COUNT - 1))));
/** % of ramp pieces that are twins (a second roof next door to hop onto): 0 before level 20, then up to 70. */
export const twinChance = (n: number): number => (n < 20 ? 0 : Math.round(70 * ((n - 1) / (LEVEL_COUNT - 1))));

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
    rows: Math.round((14 + 30 * t) * 1.3) + (inWorld === 10 ? 5 : 0), // 30 % longer than the original 14…44 rows
    rowGap: r1(22 - 5 * t),
    twoChance: Math.round(10 + 45 * t),
    trainChance: Math.round(10 + 40 * t),
    pace: { start: r1(9 + 4 * t), accel: Math.round((0.08 + 0.12 * t) * 1000) / 1000, max: r1(12 + 8 * t) },
  };
}

export function rowStart(spec: LevelSpec, row: number): number {
  return FIRST_ROW_Z + row * spec.rowGap;
}

interface PlanObstacle { lane: number; kind: ObstacleKind; len?: number }
interface RowPlan { obst: PlanObstacle[]; coinLane: number }

/** Builds the whole level up front. Same n → same level, always. */
export function buildLevel(n: number): Level {
  const spec = levelSpec(n);
  const rng = new SplitMix64(spec.seed);
  const kindOf = (): ObstacleKind => {
    if (rng.int(100) < spec.trainChance) return 'train';
    return OBSTACLE_KINDS[rng.int(2)]; // hurdle or bar
  };
  // 1. The plain rows. This uses the main random stream exactly as before ramps existed.
  const plan: RowPlan[] = [];
  for (let row = 0; row < spec.rows; row++) {
    const count = row >= 3 && rng.int(100) < spec.twoChance ? 2 : 1;
    const a = rng.int(3);
    const lanes = [a];
    if (count === 2) lanes.push((a + 1 + rng.int(2)) % 3);
    const obst = lanes.map((lane) => ({ lane, kind: kindOf() }));
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    plan.push({ obst, coinLane: free[rng.int(free.length)] });
  }
  // 2. Ramp pieces, from a second random stream so levels without ramps stay byte-for-byte the same.
  //    Row r: a long train A in lane L with a ramp in front of it. Row r+1: exactly one obstacle (twin: a short train B
  //    in the lane next to L, to hop onto). Row r+2: lane L (and for a twin also B's lane) free of obstacles, so the drop
  //    from the roof always lands on a clear lane. Rows r+1 and r+2 keep one free ground lane.
  const roofLane: (number | null)[] = plan.map(() => null); // lane of the long train A that covers the row's start
  const pieces: { row: number; lane: number; twinLane: number | null; chain: boolean }[] = [];
  if (n >= RAMP_FIRST_LEVEL) {
    const rr = new SplitMix64(spec.seed ^ 0x52414d50n);
    const pickFree = (p: RowPlan) => {
      const lanes = p.obst.map((o) => o.lane);
      const free = [0, 1, 2].filter((l) => !lanes.includes(l));
      p.coinLane = free[rr.int(free.length)];
    };
    const cr = new SplitMix64(spec.seed ^ 0x434841n); // own stream: chains never shift the other draws
    for (let r = 2; r <= spec.rows - 6; r++) {
      if (rr.int(100) >= rampChance(n)) continue;
      const here = plan[r];
      const L = here.obst[rr.int(here.obst.length)].lane;
      if (plan[r - 1].obst.some((o) => o.lane === L && o.kind === 'train')) continue; // the ramp needs clear ground behind it
      const twin = rr.int(100) < twinChance(n);
      const sides = [L - 1, L + 1].filter((l) => l >= 0 && l <= 2);
      const M = sides[rr.int(sides.length)];
      const a = here.obst.find((o) => o.lane === L)!;
      a.kind = 'train';
      a.len = RAMP_TRAIN_LENGTH;
      if (twin) here.obst = [a]; // a twin piece is already two lanes wide: nothing else in A's row
      const nx = plan[r + 1];
      if (twin) {
        nx.obst = [{ lane: M, kind: 'train', len: TWIN_TRAIN_LENGTH }];
        nx.coinLane = 3 - L - M;
      } else {
        const keep = nx.obst.find((o) => o.lane !== L);
        const lane = keep ? keep.lane : (L + 1 + rr.int(2)) % 3;
        const kind = keep ? keep.kind : nx.obst[0].kind;
        nx.obst = [{ lane, kind: kind === 'train' ? 'hurdle' : kind }]; // no plain train next to A
        nx.coinLane = 3 - L - lane;
      }
      roofLane[r + 1] = L;
      const after = plan[r + 2];
      if (twin) {
        after.obst = [{ lane: 3 - L - M, kind: after.obst[0].kind }];
        pickFree(after);
      } else {
        const kind = after.obst[0].kind;
        after.obst = after.obst.filter((o) => o.lane !== L);
        if (after.obst.length === 0) after.obst = [{ lane: (L + 1 + rr.int(2)) % 3, kind }];
        if (after.obst.some((o) => o.lane === after.coinLane)) pickFree(after);
      }
      // chain: roof C in lane L, CHAIN_GAP m past the end of A, reachable with one normal jump; lane L stays clear after it
      const chain = !twin && n >= CHAIN_FIRST_LEVEL && cr.int(100) < 50;
      if (chain) {
        roofLane[r + 2] = L;
        const after3 = plan[r + 3];
        after3.obst = after3.obst.filter((o) => o.lane !== L);
        if (after3.obst.length === 0) after3.obst = [{ lane: (L + 1 + cr.int(2)) % 3, kind: 'hurdle' }];
        if (after3.obst.some((o) => o.lane === after3.coinLane)) pickFree(after3);
        const mid = plan[r + 2];
        if (mid.obst.length === 2) mid.obst = [mid.obst[0]]; // keep a free ground lane next to the two roofs
        if (mid.coinLane === L || mid.obst.some((o) => o.lane === mid.coinLane)) mid.coinLane = [0, 1, 2].find((l) => l !== L && !mid.obst.some((o) => o.lane === l))!; // its ground coins can't sit inside roof C
      }
      pieces.push({ row: r, lane: L, twinLane: twin ? M : null, chain });
      r += RAMP_COOLDOWN - 1 + (chain ? 1 : 0);
    }
  }
  // 3. Turn the plan into obstacles and coins (ids in the same order as before).
  const obstacles: Obstacle[] = [];
  const coins: Coin[] = [];
  const coinLanes: number[] = [];
  const trainLanes: number[][] = [];
  let id = 0;
  plan.forEach((p, row) => {
    const z0 = rowStart(spec, row);
    const trains: number[] = [];
    for (const o of p.obst) {
      if (o.kind === 'train') trains.push(o.lane);
      obstacles.push(o.len === undefined ? { id: id++, kind: o.kind, lane: o.lane, z: z0 } : { id: id++, kind: o.kind, lane: o.lane, z: z0, len: o.len });
    }
    for (let i = 0; i < COINS_PER_ROW; i++) coins.push({ id: id++, lane: p.coinLane, z: z0 + i * COIN_SPACING });
    coinLanes.push(p.coinLane);
    const roof = roofLane[row];
    if (roof !== null) trains.push(roof);
    trainLanes.push(trains);
  });
  // 4. Golden stars: the prize at the end of a coin trail (2 m after the last coin), aiming for 25 %, 55 % and 85 %
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
  const totalCoins = coins.length; // roof coins below are a bonus and do not count toward 3 stars
  // 5. Ramps and roof coins (ids after everything else, so levels without ramps keep their ids).
  for (const pc of pieces) {
    const z0 = rowStart(spec, pc.row);
    obstacles.push({ id: id++, kind: 'ramp', lane: pc.lane, z: z0 - RAMP_LENGTH });
    for (let d = 2; d <= RAMP_TRAIN_LENGTH - 2; d += ROOF_COIN_STEP) coins.push({ id: id++, lane: pc.lane, z: z0 + d, y: ROOF_Y + COIN_Y });
    if (pc.chain) {
      const zc = z0 + RAMP_TRAIN_LENGTH + CHAIN_GAP;
      obstacles.push({ id: id++, kind: 'train', lane: pc.lane, z: zc, len: CHAIN_TRAIN_LENGTH });
      for (let d = 2; d <= CHAIN_TRAIN_LENGTH - 2; d += ROOF_COIN_STEP) coins.push({ id: id++, lane: pc.lane, z: zc + d, y: ROOF_Y + COIN_Y });
    }
    if (pc.twinLane !== null) {
      const z1 = rowStart(spec, pc.row + 1);
      for (let d = 2; d <= TWIN_TRAIN_LENGTH - 2; d += ROOF_COIN_STEP) coins.push({ id: id++, lane: pc.twinLane, z: z1 + d, y: ROOF_Y + COIN_Y });
    }
  }
  // 6. Pickups (ids after everything else): a power-up at the end of some coin trails; jetpacks bring a trail of air coins.
  const pickups: Pickup[] = [];
  if (n >= POWER_FIRST_LEVEL) {
    const pr = new SplitMix64(spec.seed ^ 0x504f5745n);
    const pieceRows = new Set<number>();
    for (const pc of pieces) for (let k = 0; k <= 4; k++) pieceRows.add(pc.row + k);
    const finishZ = rowStart(spec, spec.rows - 1) + FINISH_AFTER_LAST_ROW;
    for (let row = 3; row < spec.rows - 3; row++) {
      if (pr.int(100) >= pickupChance(n)) continue;
      let pick = pr.int(100);
      let kind: PickupKind = 'board';
      for (const [k, w] of PICKUP_WEIGHTS) { if (pick < w) { kind = k; break; } pick -= w; }
      if (pieceRows.has(row)) continue;
      const z = rowStart(spec, row) + PICKUP_OFFSET;
      if (kind === 'jetpack' || kind === 'mystery') {
        // a mystery box can turn into a jetpack, so both keep the golden stars out of the flight
        const flightEnd = z + FLY_STAR_FREE;
        if ((stars.some((g) => g.z > z && g.z < flightEnd) || flightEnd > finishZ - 10 || pieces.some((pc) => rowStart(spec, pc.row) > z - 30 && rowStart(spec, pc.row) < flightEnd))) {
          if (kind === 'jetpack') kind = 'magnet'; else continue;
        }
      }
      const pid = id++;
      pickups.push({ id: pid, kind, lane: coinLanes[row], z });
      if (kind === 'jetpack' || (kind === 'mystery' && pid % 5 === 4)) {
        for (let k = 0; k < FLY_TRAIL_COINS; k++) coins.push({ id: id++, lane: Math.round(1 + Math.sin(k * 0.45)), z: z + 6 + k * 4, y: Power.flyHeight + COIN_Y });
      }
    }
  }
  // 7. Exactly JETPACKS_PER_LEVEL jetpacks, at ~1/3 and ~2/3 of the level: the closest free row, preferring a flight with no golden star in it.
  {
    const finishZ2 = rowStart(spec, spec.rows - 1) + FINISH_AFTER_LAST_ROW;
    const pieceRows = new Set<number>();
    for (const pc of pieces) for (let k = 0; k <= 4; k++) pieceRows.add(pc.row + k);
    const taken = new Set(pickups.map((p) => Math.round(p.z)));
    const rowOk = (row: number, strict: boolean): boolean => {
      if (row < 2 || row >= spec.rows - 3) return false;
      const z = rowStart(spec, row) + PICKUP_OFFSET, flightEnd = z + JETPACK_STAR_FREE;
      if (taken.has(Math.round(z)) || (strict ? flightEnd > finishZ2 - 10 : z + 40 > finishZ2)) return false;
      if (obstacles.some((o) => o.kind !== 'ramp' && o.lane === coinLanes[row] && z > o.z - 2 && z < o.z + obstacleLength(o) + 2)) return false;
      if (strict && pieceRows.has(row)) return false;
      return !strict || !stars.some((g) => g.z > z && g.z < flightEnd);
    };
    for (let j = 1; j <= JETPACKS_PER_LEVEL; j++) {
      const target = Math.round((spec.rows * j) / (JETPACKS_PER_LEVEL + 1));
      let placed = -1;
      for (const strict of [true, false]) {
        for (let d = 0; d < spec.rows && placed < 0; d++) {
          for (const row of [target + d, target - d]) if (placed < 0 && rowOk(row, strict)) placed = row;
        }
        if (placed >= 0) break;
      }
      if (placed < 0) throw new Error(`level ${n}: no room for jetpack ${j}`);
      const z = rowStart(spec, placed) + PICKUP_OFFSET;
      taken.add(Math.round(z));
      pickups.push({ id: id++, kind: 'jetpack', lane: coinLanes[placed], z });
      for (let k = 0; k < FLY_TRAIL_COINS; k++) coins.push({ id: id++, lane: Math.round(1 + Math.sin(k * 0.45)), z: z + 6 + k * 4, y: Power.flyHeight + COIN_Y });
    }
  }
  const track = Track.fixed(obstacles, coins, pickups);
  return { spec, track, stars, finishZ: rowStart(spec, spec.rows - 1) + FINISH_AFTER_LAST_ROW, totalCoins };
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

  constructor(n: number, opts: StartOptions = {}) {
    this.level = buildLevel(n);
    this.state = startState(opts);
    if (opts.messes) placeMesses(this.level.track, 7919 * n, 0, this.level.finishZ - 15);
  }

  get over(): boolean { return this.finished || this.state.crashed; }

  tick(move: Move, boost = false): void {
    if (this.over) return;
    this.state = step(this.state, move, this.level.track, this.level.spec.pace, boost);
    if (this.state.crashed) return;
    for (const g of this.level.stars) if (!this.starsTaken.has(g.id) && canReach(this.state, g.lane, g.z)) this.starsTaken.add(g.id);
    if (this.state.z >= this.level.finishZ) {
      this.finished = true;
      this.state.iframes = 0; // no landing-protection flashing past the finish line
    }
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
    s.iframes = 0;
    const k = Math.min(1, (this.coastTicks * Runner.dt) / FINISH_EASE_SECONDS);
    s.y = this.coastY0 * (1 - k * k * (3 - 2 * k));
    s.z += this.level.spec.pace.max * 0.6 * Runner.dt;
    s.tick += 1;
    this.state = s;
  }
}

