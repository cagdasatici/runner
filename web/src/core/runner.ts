// One-to-one port of GameCore/Sources/GameCore/Runner.swift. Keep the step order identical:
// move → sideways → vertical → slide timer → forward → tick → collisions → coins.
import { COIN_Y, laneX, obstacleLength, Track, type ObstacleKind } from './track';

export type Move = 'none' | 'left' | 'right' | 'up' | 'down';

export interface RunnerState {
  tick: number;
  z: number; // distance run, metres
  lane: number; // target lane
  x: number; // sideways position, follows laneX(lane)
  y: number; // feet height
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

export function startState(): RunnerState {
  return { tick: 0, z: 0, lane: 1, x: 0, y: 0, vy: 0, slideTicks: 0, coins: 0, collected: new Set(), crashed: false };
}
export function cloneState(s: RunnerState): RunnerState {
  return { ...s, collected: new Set(s.collected) };
}

export const isGrounded = (s: RunnerState): boolean => s.y === 0 && s.vy === 0;
export const isSliding = (s: RunnerState): boolean => s.slideTicks > 0;
export const height = (s: RunnerState): number => (isSliding(s) ? Runner.slideHeight : Runner.standHeight);
export const speedOf = (s: RunnerState): number => speedAtTick(s.tick);
export const score = (s: RunnerState): number => Math.trunc(s.z) + s.coins * Runner.coinValue;

export function speedAtTick(t: number): number {
  return Math.min(Runner.maxSpeed, Runner.startSpeed + Runner.acceleration * t * Runner.dt);
}

/** Box of an obstacle: x half-width, y bottom, y top. */
export function obstacleBox(kind: ObstacleKind): { halfW: number; y0: number; y1: number } {
  switch (kind) {
    case 'hurdle':
      return { halfW: 1.0, y0: 0.0, y1: 1.0 };
    case 'bar':
      return { halfW: 1.0, y0: 1.2, y1: 2.2 };
    case 'train':
      return { halfW: 1.1, y0: 0.0, y1: 3.5 };
  }
}

// overlap(a0, a1, b0, b1) = a0 < b1 && a1 > b0 (strict)
const overlap = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && a1 > b0;

export function step(prev: RunnerState, move: Move, track: Track): RunnerState {
  if (prev.crashed) return prev;
  const s = cloneState(prev);
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
  if (s.y > 0 || s.vy > 0) {
    s.vy -= Runner.gravity * Runner.dt;
    s.y += s.vy * Runner.dt;
    if (s.y <= 0) {
      s.y = 0;
      s.vy = 0;
    }
  }
  if (s.slideTicks > 0) s.slideTicks -= 1;
  s.z += speedAtTick(s.tick) * Runner.dt;
  s.tick += 1;

  const h = height(s);
  for (const o of track.obstacles) {
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
    if (
      Math.abs(s.x - laneX(c.lane)) < Runner.coinReach &&
      Math.abs(s.z - c.z) < Runner.coinReach &&
      s.y <= COIN_Y &&
      COIN_Y <= s.y + h
    ) {
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
