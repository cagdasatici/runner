// One-to-one port of GameCore/Sources/GameCore/Runner.swift. Keep the step order identical:
// move → sideways → vertical → slide timer → forward → tick → collisions → coins.
import { COIN_Y, coinY, laneX, obstacleLength, ROOF_TOLERANCE, ROOF_Y, SUPPORT_HALF, RAMP_LENGTH, Track, type ObstacleKind } from './track';

export type Move = 'none' | 'left' | 'right' | 'up' | 'down';

export interface RunnerState {
  tick: number;
  z: number; // distance run, metres
  lane: number; // target lane
  x: number; // sideways position, follows laneX(lane)
  y: number; // feet height
  floor: number; // height of the ground, ramp or roof under the feet at the end of the last tick
  vy: number;
  slideTicks: number; // > 0 while sliding
  coins: number;
  collected: Set<number>;
  crashed: boolean;
}

export const Runner = {
  dt: 1.0 / 120.0,
  startSpeed: 10.0,
  acceleration: 0.1, // m/s gained per second
  maxSpeed: 20.0,
  laneSwitchSpeed: 25.0, // sideways m/s → 0.1 s per lane
  jumpVelocity: 9.0,
  gravity: 30.0,
  fastFallVelocity: -15.0,
  slideDuration: 72, // ticks = 0.6 s
  halfWidth: 0.4,
  halfDepth: 0.4,
  standHeight: 1.8,
  slideHeight: 0.9,
  coinValue: 10,
  coinReach: 0.9,
} as const;

/** How fast a run goes: start speed, gain per second, top speed (m/s). Endless mode uses ENDLESS_PACE. */
export interface Pace {
  start: number;
  accel: number;
  max: number;
}
export const ENDLESS_PACE: Pace = { start: Runner.startSpeed, accel: Runner.acceleration, max: Runner.maxSpeed };

export function startState(): RunnerState {
  return { tick: 0, z: 0, lane: 1, x: 0, y: 0, floor: 0, vy: 0, slideTicks: 0, coins: 0, collected: new Set(), crashed: false };
}
export function cloneState(s: RunnerState): RunnerState {
  return { ...s, collected: new Set(s.collected) };
}

export const isGrounded = (s: RunnerState): boolean => s.y === s.floor && s.vy === 0;
export const onRoof = (s: RunnerState): boolean => s.floor === ROOF_Y && s.y === ROOF_Y;
export const isSliding = (s: RunnerState): boolean => s.slideTicks > 0;
export const height = (s: RunnerState): number => (isSliding(s) ? Runner.slideHeight : Runner.standHeight);
export const speedOf = (s: RunnerState, pace: Pace = ENDLESS_PACE): number => speedAtTick(s.tick, pace);
export const score = (s: RunnerState): number => Math.trunc(s.z) + s.coins * Runner.coinValue;

export function speedAtTick(t: number, pace: Pace = ENDLESS_PACE): number {
  return Math.min(pace.max, pace.start + pace.accel * t * Runner.dt);
}

/** True when the runner is close enough to pick up a coin (or golden star) floating at height `y` (default COIN_Y) in `lane` at `z`. */
export function canReach(s: RunnerState, lane: number, z: number, y: number = COIN_Y): boolean {
  return Math.abs(s.x - laneX(lane)) < Runner.coinReach && Math.abs(s.z - z) < Runner.coinReach && s.y <= y && y <= s.y + height(s);
}

/** Height of the surface under the runner's feet: 0 (ground), a ramp slope, or ROOF_Y (a train roof). */
export function floorAt(x: number, z: number, track: Track): number {
  let f = 0;
  for (const o of track.obstacles) {
    if (o.kind !== 'train' && o.kind !== 'ramp') continue;
    if (Math.abs(x - laneX(o.lane)) > SUPPORT_HALF) continue;
    const front = z + Runner.halfDepth, back = z - Runner.halfDepth;
    if (!(back < o.z + obstacleLength(o) && front > o.z)) continue;
    const h = o.kind === 'train' ? ROOF_Y : ROOF_Y * Math.min(1, Math.max(0, (front - o.z) / RAMP_LENGTH));
    if (h > f) f = h;
  }
  return f;
}

const STEP_UP = 0.35; // the runner is lifted by a rising ramp only up to this much per tick; a taller edge is a wall

/** Box of an obstacle: x half-width, y bottom, y top. */
export function obstacleBox(kind: ObstacleKind): { halfW: number; y0: number; y1: number } {
  switch (kind) {
    case 'hurdle':
      return { halfW: 1.0, y0: 0.0, y1: 1.0 };
    case 'bar':
      return { halfW: 1.0, y0: 1.2, y1: 2.2 };
    case 'train':
      return { halfW: 1.1, y0: 0.0, y1: ROOF_Y - ROOF_TOLERANCE };
    case 'ramp':
      return { halfW: 1.1, y0: 0.0, y1: 0.0 }; // never collides
  }
}

// overlap(a0, a1, b0, b1) = a0 < b1 && a1 > b0 (strict)
const overlap = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && a1 > b0;

export function step(prev: RunnerState, move: Move, track: Track, pace: Pace = ENDLESS_PACE): RunnerState {
  if (prev.crashed) return prev;
  const s: RunnerState = { ...prev }; // `collected` is shared with prev until a coin is picked up (copy on write)
  switch (move) {
    case 'left':
      s.lane = Math.max(0, s.lane - 1);
      break;
    case 'right':
      s.lane = Math.min(2, s.lane + 1);
      break;
    case 'up':
      if (isGrounded(s)) {
        s.vy = Runner.jumpVelocity;
        s.slideTicks = 0;
      }
      break;
    case 'down':
      if (!isGrounded(s)) s.vy = Math.min(s.vy, Runner.fastFallVelocity);
      s.slideTicks = Runner.slideDuration;
      break;
    case 'none':
      break;
  }
  const maxStep = Runner.laneSwitchSpeed * Runner.dt;
  s.x += Math.max(-maxStep, Math.min(maxStep, laneX(s.lane) - s.x));
  if (s.y > s.floor || s.vy > 0) {
    s.vy -= Runner.gravity * Runner.dt;
    s.y += s.vy * Runner.dt;
  }
  if (s.slideTicks > 0) s.slideTicks -= 1;
  s.z += speedAtTick(s.tick, pace) * Runner.dt;
  s.tick += 1;
  // land on, or ride up, whatever is under the feet now
  s.floor = floorAt(s.x, s.z, track);
  if (s.y <= s.floor && s.vy <= 0 && (prev.y >= s.floor - 1e-9 || s.floor - s.y <= STEP_UP)) {
    s.y = s.floor;
    s.vy = 0;
  }

  const h = height(s);
  for (const o of track.obstacles) {
    if (o.kind === 'ramp') continue;
    const b = obstacleBox(o.kind);
    const ox = laneX(o.lane);
    if (
      overlap(s.x - Runner.halfWidth, s.x + Runner.halfWidth, ox - b.halfW, ox + b.halfW) &&
      overlap(s.y, s.y + h, b.y0, b.y1) &&
      overlap(s.z - Runner.halfDepth, s.z + Runner.halfDepth, o.z, o.z + obstacleLength(o))
    ) {
      s.crashed = true;
      return s;
    }
  }
  for (const c of track.coins) {
    if (s.collected.has(c.id)) continue;
    if (canReach(s, c.lane, c.z, coinY(c))) {
      if (s.collected === prev.collected) s.collected = new Set(prev.collected);
      s.collected.add(c.id);
      s.coins += 1;
    }
  }
  return s;
}

/** One run: the track plus the runner. The renderer and the tests drive the game through this. */
export class RunSession {
  static readonly generateAhead = 120.0;
  state: RunnerState = startState();
  track: Track;

  constructor(seed: bigint) {
    this.track = new Track(seed);
    this.track.generate(RunSession.generateAhead);
  }

  tick(move: Move): void {
    this.state = step(this.state, move, this.track);
    this.track.generate(this.state.z + RunSession.generateAhead);
    this.track.dropBehind(this.state.z);
  }
}
