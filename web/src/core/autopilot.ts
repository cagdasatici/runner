// One-to-one port of GameCore/Sources/GameCore/Autopilot.swift.
import { canReach, cloneState, ENDLESS_PACE, isGrounded, onRoof, Runner, speedOf, step, type Move, type Pace, type RunnerState } from './runner';
import { obstacleLength, RAMP_LENGTH, Track, type Obstacle } from './track';

/** Long trains (those with an explicit length, i.e. ramp pieces) are planned for this many metres early, so the ground runner picks its lane in time. */
export const PLAN_EARLY = 12;
const isHurdleOrBar = (o: Obstacle): boolean => o.kind === 'hurdle' || o.kind === 'bar';

export function autopilotMove(s: RunnerState, track: Track, pace: Pace = ENDLESS_PACE, skip?: (o: Obstacle) => boolean, careful = false): Move {
  const speed = speedOf(s, pace);
  const ahead = speed * 0.6 + 3;
  // early = true: occupancy for choosing a lane; false: the real train, for crossing a lane
  const trainIn = (lane: number, z0: number, z1: number, early = false): boolean =>
    track.obstacles.some((o) => o.kind === 'train' && o.lane === lane && !(skip && skip(o)) && o.z - (early && o.len !== undefined ? PLAN_EARLY : 0) < z1 && o.z + obstacleLength(o) > z0);

  const thinTooClose = (lane: number): boolean =>
    track.obstacles.some((o) => o.lane === lane && isHurdleOrBar(o) && o.z - (s.z + Runner.halfDepth) > -1 && o.z - (s.z + Runner.halfDepth) < speed * 0.35);
  if (trainIn(s.lane, s.z - 1, s.z + ahead, true)) {
    const order = [s.lane - 1, s.lane + 1, s.lane - 2, s.lane + 2].filter((l) => l >= 0 && l <= 2);
    for (const target of order) {
      if (trainIn(target, s.z - 1, s.z + ahead, true)) continue;
      const dir = target < s.lane ? -1 : 1;
      if (careful && (thinTooClose(target) || thinTooClose(s.lane + dir))) continue; // a planned early switch must not land on a hurdle or bar
      let lane = s.lane + dir;
      let pathClear = true;
      while (lane !== target) {
        if (trainIn(lane, s.z - 1.5, s.z + 2.5)) pathClear = false;
        lane += dir;
      }
      if (pathClear) return dir < 0 ? 'left' : 'right';
    }
    return 'none';
  }
  let next: (typeof track.obstacles)[number] | undefined;
  for (const o of track.obstacles) {
    if (o.lane === s.lane && isHurdleOrBar(o) && o.z + obstacleLength(o) > s.z - Runner.halfDepth) {
      if (next === undefined || o.z < next.z) next = o;
    }
  }
  if (next === undefined) return 'none';
  const gap = next.z - (s.z + Runner.halfDepth);
  if (next.kind === 'hurdle' && isGrounded(s) && gap <= speed * 0.25) return 'up';
  if (next.kind === 'bar' && gap <= speed * 0.3 && s.slideTicks * Runner.dt * speed < gap + 1.3) return 'down';
  return 'none';
}

/**
 * Journey autopilot: dodges exactly like autopilotMove, and when nothing needs dodging it steers one lane
 * toward the nearest uncollected golden star or coin ahead, but only into a lane that is safe right now.
 */
export function collectorMove(s: RunnerState, track: Track, pace: Pace, stars: { id: number; lane: number; z: number }[], starsTaken: Set<number>): Move {
  const dodge = autopilotMove(s, track, pace, undefined, true);
  if (dodge !== 'none') return dodge;
  let target: { lane: number; z: number } | undefined;
  const consider = (lane: number, z: number) => {
    if (z > s.z + Runner.halfDepth && z < s.z + 40 && (target === undefined || z < target.z)) target = { lane, z };
  };
  for (const g of stars) if (!starsTaken.has(g.id)) consider(g.lane, g.z);
  for (const c of track.coins) if (!s.collected.has(c.id)) consider(c.lane, c.z);
  if (target === undefined || target.lane === s.lane) return 'none';
  const dir = target.lane < s.lane ? -1 : 1;
  return laneIsSafe(s, track, pace, s.lane + dir) ? (dir < 0 ? 'left' : 'right') : 'none';
}

/** True when switching into `next` right now is safe: no train about to fill it, no hurdle or bar too close to jump or roll. */
export function laneIsSafe(s: RunnerState, track: Track, pace: Pace, next: number, skip?: (o: Obstacle) => boolean): boolean {
  const speed = speedOf(s, pace);
  const ahead = speed * 0.6 + 3;
  for (const o of track.obstacles) {
    if (o.lane !== next || (skip && skip(o))) continue;
    if (o.kind === 'train' && o.z - (o.len !== undefined ? PLAN_EARLY : 0) < s.z + ahead && o.z + obstacleLength(o) > s.z - 1.5) return false;
    const gap = o.z - (s.z + Runner.halfDepth);
    if (isHurdleOrBar(o) && gap > -1 && gap < speed * 0.35) return false; // too close to jump or roll in time
  }
  return true;
}

// ---- ramps and roofs -------------------------------------------------------------------------------------------

export const RIDE_MIN = 10; // the runner only turns into a ramp lane when the ramp is at least this far ahead
export const RIDE_MAX = 60; // … and looks for ramps up to this far ahead
const AIRBORNE_FROM_ROOF = 1.4; // above a normal jump's peak (1.3125): the runner is falling off a roof

const ramps = (track: Track): Obstacle[] => track.obstacles.filter((o) => o.kind === 'ramp');

/** The train a ramp leads onto. */
const trainOfRamp = (r: Obstacle) => (o: Obstacle): boolean => o.kind === 'train' && o.lane === r.lane && o.z === r.z + RAMP_LENGTH;

/** Standing on a roof: stay on it, and hop to the neighbouring roof when this one is about to end and the neighbour goes on. */
export function roofMove(s: RunnerState, track: Track): Move {
  const covers = (o: Obstacle, z: number) => o.kind === 'train' && o.z <= z && o.z + obstacleLength(o) > z;
  let end = s.z;
  for (const o of track.obstacles) if (o.lane === s.lane && covers(o, s.z)) end = Math.max(end, o.z + obstacleLength(o));
  for (const dir of [-1, 1]) {
    const lane = s.lane + dir;
    if (lane < 0 || lane > 2) continue;
    const next = track.obstacles.find((o) => o.lane === lane && covers(o, s.z - 0.5) && o.z + obstacleLength(o) > end + 2);
    if (next !== undefined && end - s.z >= 1.5) return dir < 0 ? 'left' : 'right';
  }
  return 'none';
}

/**
 * Base policy of the journey solver: like collectorMove, and in addition it turns into the lane of a ramp ahead, rides
 * up, runs along the roofs (hopping to a neighbouring roof when it goes on) and drops off the end. Set `ride` to false
 * for a runner that treats every ramp train like any other train.
 */
export function riderMove(s: RunnerState, track: Track, pace: Pace, stars: { id: number; lane: number; z: number }[], starsTaken: Set<number>, ride = true, steer = true): Move {
  const ground = (): Move => (steer ? collectorMove(s, track, pace, stars, starsTaken) : autopilotMove(s, track, pace, undefined, true));
  if (!ride) return ground();
  if (s.floor === 0 && s.y > AIRBORNE_FROM_ROOF) return 'none';
  if (s.floor > 0) return onRoof(s) ? roofMove(s, track) : 'none';
  let ramp: Obstacle | undefined;
  for (const r of ramps(track)) if (r.z - s.z > -RAMP_LENGTH && r.z - s.z <= RIDE_MAX && (ramp === undefined || r.z < ramp.z)) ramp = r;
  if (ramp === undefined || ramp.z < s.z - 1) return ground();
  const dodge = autopilotMove(s, track, pace, s.lane === ramp.lane ? trainOfRamp(ramp) : undefined, true);
  if (dodge !== 'none') return dodge;
  if (s.lane === ramp.lane) return 'none';
  if (ramp.z - s.z >= RIDE_MIN) {
    const dir = ramp.lane < s.lane ? -1 : 1;
    if (laneIsSafe(s, track, pace, s.lane + dir, trainOfRamp(ramp))) return dir < 0 ? 'left' : 'right';
  }
  return ground();
}

// ---- the solver ------------------------------------------------------------------------------------------------

export const PLAN_HORIZON = 420; // ticks (2 s) a plan must survive
export const PLAN_KEEP = 45; // ticks of a plan that are followed before planning again
export const PLAN_WINDOW = 140; // metres of track copied for the rollouts (the horizon at top speed is 80 m)
const PLAN_OFFSETS = [0, 8, 16, 32, 48, 64];
export const PLAN_DECIDE_EVERY = 3; // the base policy decides every 3rd tick inside a plan (0.025 s): 3× faster, same precision
const PLAN_SECOND_GAPS = [10, 20, 30, 45];
const STAR_WEIGHT = 1000;

type StarList = { id: number; lane: number; z: number }[];

/**
 * Journey solver. Every PLAN_KEEP ticks it plays the base policy (riderMove) forward on a copy of the run, and also
 * "one lane change now (or a few ticks later), then the base policy". Among the plans that survive PLAN_HORIZON ticks it
 * follows the one that picks up the most golden stars, then coins. Deterministic, uses only the real physics.
 */
export class Solver {
  private queue: Move[] = [];
  constructor(private ride = true) {}

  reset(): void { this.queue = []; }

  next(s: RunnerState, track: Track, pace: Pace, stars: StarList, taken: Set<number>): Move {
    if (this.queue.length === 0) this.queue = this.plan(s, track, pace, stars, taken);
    return this.queue.shift() ?? 'none';
  }

  private rollout(s: RunnerState, track: Track, pace: Pace, stars: StarList, taken: Set<number>, forced: [number, Move][], steer: boolean): { moves: Move[]; ok: boolean; score: number } {
    const moves: Move[] = [];
    const got = new Set(taken);
    let st = cloneState(s);
    const coins0 = st.coins;
    for (let i = 0; i < PLAN_HORIZON; i++) {
      const f = forced.find((x) => x[0] === i);
      const m: Move = f !== undefined ? f[1] : i % PLAN_DECIDE_EVERY === 0 ? riderMove(st, track, pace, stars, got, this.ride, steer) : 'none';
      moves.push(m);
      st = step(st, m, track, pace);
      if (st.crashed) return { moves, ok: false, score: -1 };
      for (const g of stars) if (!got.has(g.id) && canReach(st, g.lane, g.z)) got.add(g.id);
    }
    return { moves, ok: true, score: (got.size - taken.size) * STAR_WEIGHT + (st.coins - coins0) };
  }

  private plan(s: RunnerState, full: Track, pace: Pace, stars: StarList, taken: Set<number>): Move[] {
    const near = Track.fixed(
      full.obstacles.filter((o) => o.z + obstacleLength(o) > s.z - 10 && o.z < s.z + PLAN_WINDOW),
      full.coins.filter((c) => c.z > s.z - 10 && c.z < s.z + PLAN_WINDOW),
    );
    const base = this.rollout(s, near, pace, stars, taken, [], true);
    let best = base;
    const consider = (forced: [number, Move][], steer: boolean) => {
      const r = this.rollout(s, near, pace, stars, taken, forced, steer);
      if (r.ok && (!best.ok || r.score > best.score)) best = r;
    };
    const dirs: Move[] = ['left', 'right'];
    for (const steer of [true, false]) { // false = dodge only, no steering toward coins: stops a coin trail leading into a dead end
      if (!steer) consider([], false);
      for (const o of PLAN_OFFSETS) for (const f of dirs) consider([[o, f]], steer);
    }
    if (!best.ok) { // nothing survives with one change: try two
      for (const steer of [true, false]) {
        for (const o1 of PLAN_OFFSETS) for (const f1 of dirs) for (const gap of PLAN_SECOND_GAPS) for (const f2 of dirs) consider([[o1, f1], [o1 + gap, f2]], steer);
      }
    }
    return best.moves.slice(0, PLAN_KEEP);
  }
}
