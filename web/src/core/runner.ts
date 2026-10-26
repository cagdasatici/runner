// One-to-one port of GameCore/Sources/GameCore/Runner.swift. Keep the step order identical:
// TODO: port messes to GameCore (Swift) when the iOS app gets them.
// move → sideways → vertical → slide timer → forward → tick → collisions → coins.
import { COIN_Y, coinY, laneX, obstacleLength, ROOF_TOLERANCE, ROOF_Y, SUPPORT_HALF, RAMP_LENGTH, Track, rowZ, type MessKind, type ObstacleKind, type PickupKind } from './track';
import { MESS_TICKS, placeMesses, stepsOn } from './messes';

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
  points: number; // coin points (10 each, ×2 with the double), added to the distance in score()
  bonus: number; // near-miss and combo points
  board: number; // ticks of hoverboard left (absorbs one crash)
  magnet: number;
  sneakers: number;
  double: number;
  fly: number; // fuel of the jetpack left, in ticks (boost burns it faster)
  descend: number; // ticks of landing left
  flyFrom: number; // feet height when the jetpack was picked up (lift-off start)
  flyUp: number; // ticks since lift-off, capped at Power.flyRiseTicks
  iframes: number; // ticks of invulnerability left
  slow: number; // ticks of stumble slow-down left
  chaser: number; // ticks the chaser stays behind; a hit while > 0 is a crash
  friendly: boolean; // true (the game's default): the first hit is a stumble with a chaser, and near-miss and combo bonuses count; false: the classic rules
  streak: number; // coins in a row
  lastCoinTick: number;
  nearMisses: number; // counters, for the renderer and the HUD
  combos: number;
  boardBreaks: number;
  stumbles: number;
  pickups: number;
  messTicks: number; // ticks of mess left (dogs only)
  messKind: MessKind | null;
  messes: number; // counter, for the renderer
}

export interface StartOptions { board?: boolean; friendly?: boolean; messes?: boolean }

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

/** Power-ups and forgiveness. All durations are in ticks (120 per second). Tunable. */
export const Power = {
  boardTicks: 3600, // 30 s of hoverboard
  magnetTicks: 1200, // 10 s
  sneakersTicks: 960, // 8 s
  doubleTicks: 1200, // 10 s of 2× coins
  flyTicks: 720, // 6 s of fuel at normal speed
  flyBoostDrain: 720 / 420, // fuel burnt per tick while boosting: the tank lasts 3.5 s
  flyBoostSpeed: 2.6, // forward speed factor while flying with boost ("lightning"; Boost.factor on the ground)
  flyHeight: 4.4, // feet height while flying: 0.9 m over the roofs (ROOF_Y 3.5)
  flyRiseTicks: 108, // 0.9 s lift-off
  flyDescendTicks: 132, // 1.1 s landing
  flyWarnTicks: 360, // "3-2-1" landing warning
  iframesBoard: 180, // 1.5 s after the board breaks
  iframesLanding: 180, // 1.5 s after touchdown
  iframesStumble: 120, // 1 s after a stumble
  stumbleSlowTicks: 72, // 0.6 s at 70 % speed
  stumbleSlow: 0.7,
  chaserTicks: 960, // the chaser stays 8 s; a second hit in that time ends the run
  magnetRadius: 3.5, // metres
  sneakerJump: 1.265, // × jump velocity = 1.6× jump height
  doubleFactor: 2,
  nearMissMargin: 0.25, // metres of clearance
  nearMissPoints: 25,
  comboEvery: 8, // coins in a row
  comboPoints: 50,
  comboGapTicks: 120, // 1 s
} as const;
/**
 * Hold-to-speed-up. While the player holds SPACE / a still finger, forward speed is multiplied by `factor`
 * (tunable). Only the forward speed changes: the tick-based acceleration curve, jump/slide timers and lane
 * switching stay the same, and collisions use the real boosted distance per tick. Ratings ignore boost.
 */
export const Boost = { factor: 1.6 } as const;

/** How fast a run goes: start speed, gain per second, top speed (m/s). Endless mode uses ENDLESS_PACE. */
export interface Pace {
  start: number;
  accel: number;
  max: number;
}
export const ENDLESS_PACE: Pace = { start: Runner.startSpeed, accel: Runner.acceleration, max: Runner.maxSpeed };

export function startState(opts: StartOptions = {}): RunnerState {
  return {
    tick: 0, z: 0, lane: 1, x: 0, y: 0, floor: 0, vy: 0, slideTicks: 0, coins: 0, collected: new Set(), crashed: false,
    points: 0, bonus: 0, board: opts.board ? Power.boardTicks : 0, magnet: 0, sneakers: 0, double: 0, fly: 0, descend: 0, flyFrom: 0, flyUp: 0, iframes: 0,
    slow: 0, chaser: 0, friendly: opts.friendly ?? false, streak: 0, lastCoinTick: -1000, nearMisses: 0, combos: 0, boardBreaks: 0, stumbles: 0, pickups: 0,
    messTicks: 0, messKind: null, messes: 0,
  };
}
export function cloneState(s: RunnerState): RunnerState {
  return { ...s, collected: new Set(s.collected) };
}

export const isGrounded = (s: RunnerState): boolean => s.y === s.floor && s.vy === 0;
export const onRoof = (s: RunnerState): boolean => s.floor === ROOF_Y && s.y === ROOF_Y;
export const isSliding = (s: RunnerState): boolean => s.slideTicks > 0;
export const height = (s: RunnerState): number => (isSliding(s) ? Runner.slideHeight : Runner.standHeight);
export const speedOf = (s: RunnerState, pace: Pace = ENDLESS_PACE): number => speedAtTick(s.tick, pace);
export const score = (s: RunnerState): number => Math.trunc(s.z) + s.points + s.bonus;
export const isFlying = (s: RunnerState): boolean => s.fly > 0 || s.descend > 0;

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

/** The lane to land in when the jetpack ends: the nearest one with no train in the way for the whole landing and the invulnerable time after it. */
export function pickLandingLane(track: Track, lane: number, z: number, speed: number): number {
  const reach = speed * ((Power.flyDescendTicks + Power.iframesLanding) * Runner.dt) + 2;
  const order = [lane, lane - 1, lane + 1, lane - 2, lane + 2].filter((l) => l >= 0 && l <= 2);
  for (const l of order) {
    if (!track.obstacles.some((o) => o.kind === 'train' && o.lane === l && o.z < z + reach && o.z + obstacleLength(o) > z - 1)) return l;
  }
  return lane;
}

/** What a pickup does once it is in the runner's hands. A mystery box turns into one of the others, by its id. */
export function resolvePickup(kind: PickupKind, id: number): Exclude<PickupKind, 'mystery'> {
  if (kind !== 'mystery') return kind;
  const all: Exclude<PickupKind, 'mystery'>[] = ['board', 'magnet', 'sneakers', 'double', 'jetpack'];
  return all[id % all.length];
}

const ease = (u: number): number => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };

export function step(prev: RunnerState, move: Move, track: Track, pace: Pace = ENDLESS_PACE, boost = false): RunnerState {
  if (prev.crashed) return prev;
  const s: RunnerState = { ...prev }; // `collected` is shared with prev until something is picked up (copy on write)
  const own = () => { if (s.collected === prev.collected) s.collected = new Set(prev.collected); };
  const flying = prev.fly > 0 || prev.descend > 0;
  if (!flying) { // timed power-ups pause while flying
    if (s.board > 0) s.board -= 1;
    if (s.magnet > 0) s.magnet -= 1;
    if (s.sneakers > 0) s.sneakers -= 1;
    if (s.double > 0) s.double -= 1;
  }
  if (s.iframes > 0) s.iframes -= 1;
  if (s.slow > 0) s.slow -= 1;
  if (s.chaser > 0) s.chaser -= 1;
  if (s.messTicks > 0) { s.messTicks -= 1; if (s.messTicks === 0) s.messKind = null; }
  switch (move) {
    case 'left':
      s.lane = Math.max(0, s.lane - 1);
      break;
    case 'right':
      s.lane = Math.min(2, s.lane + 1);
      break;
    case 'up':
      if (isGrounded(s)) {
        s.vy = Runner.jumpVelocity * (s.sneakers > 0 ? Power.sneakerJump : 1);
        s.slideTicks = 0;
      }
      break;
    case 'down':
      if (!isGrounded(s) && !flying) s.vy = Math.min(s.vy, Runner.fastFallVelocity);
      s.slideTicks = Runner.slideDuration;
      break;
    case 'none':
      break;
  }
  const maxStep = Runner.laneSwitchSpeed * Runner.dt;
  s.x += Math.max(-maxStep, Math.min(maxStep, laneX(s.lane) - s.x));
  const speed = speedAtTick(s.tick, pace) * (s.slow > 0 ? Power.stumbleSlow : 1);
  if (s.fly > 0) {
    s.fly = Math.max(0, s.fly - (boost ? Power.flyBoostDrain : 1)); // fuel
    s.vy = 0;
    s.flyUp = Math.min(Power.flyRiseTicks, s.flyUp + 1);
    s.y = s.flyFrom + (Power.flyHeight - s.flyFrom) * ease(s.flyUp / Power.flyRiseTicks);
    if (s.fly === 0) { // time is up: pick a clear lane and start the descent
      s.lane = pickLandingLane(track, s.lane, s.z, speed * Power.flyBoostSpeed);
      s.descend = Power.flyDescendTicks;
      s.iframes = Power.flyDescendTicks + Power.iframesLanding;
    }
  } else if (s.descend > 0) {
    s.descend -= 1;
    s.y = Math.max(s.floor, Power.flyHeight * ease(s.descend / Power.flyDescendTicks));
  } else if (s.y > s.floor || s.vy > 0) {
    s.vy -= Runner.gravity * Runner.dt;
    s.y += s.vy * Runner.dt;
  }
  if (s.slideTicks > 0) s.slideTicks -= 1;
  s.z += speed * (boost ? (prev.fly > 0 ? Power.flyBoostSpeed : Boost.factor) : 1) * Runner.dt;
  s.tick += 1;
  // land on, or ride up, whatever is under the feet now
  s.floor = floorAt(s.x, s.z, track);
  const stillFlying = s.fly > 0;
  if (!stillFlying && s.y <= s.floor && s.vy <= 0 && (prev.y >= s.floor - 1e-9 || s.floor - s.y <= STEP_UP || s.descend > 0 || prev.descend > 0)) {
    s.y = s.floor;
    s.vy = 0;
    if (s.descend > 0 || prev.descend > 0) s.descend = 0; // touched down
  }

  const h = height(s);
  const safe = s.iframes > 0 || s.fly > 0 || s.descend > 0;
  let hit = false;
  if (!safe) {
    for (const o of track.obstacles) {
      if (o.kind === 'ramp') continue;
      const b = obstacleBox(o.kind);
      const ox = laneX(o.lane);
      if (
        overlap(s.x - Runner.halfWidth, s.x + Runner.halfWidth, ox - b.halfW, ox + b.halfW) &&
        overlap(s.y, s.y + h, b.y0, b.y1) &&
        overlap(s.z - Runner.halfDepth, s.z + Runner.halfDepth, o.z, o.z + obstacleLength(o))
      ) { hit = true; break; }
    }
  }
  if (hit) {
    if (s.board > 0) { // the board takes the hit and breaks
      s.board = 0;
      s.boardBreaks += 1;
      s.iframes = Power.iframesBoard;
    } else if (s.friendly && s.chaser === 0) { // first hit: stumble, the chaser closes in
      s.stumbles += 1;
      s.chaser = Power.chaserTicks;
      s.iframes = Power.iframesStumble;
      s.slow = Power.stumbleSlowTicks;
      s.streak = 0;
    } else {
      s.crashed = true;
      return s;
    }
  } else if (!stillFlying) {
    // near miss: a hurdle jumped or a bar rolled under with less than the margin to spare, at the moment its near edge passes
    for (const o of track.obstacles) {
      if ((o.kind !== 'hurdle' && o.kind !== 'bar') || o.lane !== s.lane || !(prev.z < o.z && o.z <= s.z)) continue;
      const clear = o.kind === 'hurdle' ? s.y - 1.0 : 1.2 - (s.y + h);
      if (s.friendly && clear >= 0 && clear < Power.nearMissMargin) { s.nearMisses += 1; s.bonus += Power.nearMissPoints; }
    }
  }
  const airborne = s.fly > 0 || s.descend > 0;
  for (const m of track.messes) {
    if (s.collected.has(m.id) || !stepsOn(prev.z, s.z, s.x, s.y, s.floor, airborne, m)) continue;
    own();
    s.collected.add(m.id);
    s.messKind = m.kind;
    s.messTicks = MESS_TICKS;
    s.messes += 1;
  }
  const mult = s.double > 0 ? Power.doubleFactor : 1;
  for (const c of track.coins) {
    if (s.collected.has(c.id)) continue;
    const pulled = s.magnet > 0 && Math.hypot(s.x - laneX(c.lane), s.z - c.z) < Power.magnetRadius;
    if (pulled || canReach(s, c.lane, c.z, coinY(c))) {
      own();
      s.collected.add(c.id);
      s.coins += 1;
      s.points += Runner.coinValue * mult;
      s.streak = s.tick - s.lastCoinTick > Power.comboGapTicks ? 1 : s.streak + 1;
      s.lastCoinTick = s.tick;
      if (s.friendly && s.streak % Power.comboEvery === 0) { s.combos += 1; s.bonus += Power.comboPoints; }
    }
  }
  for (const p of track.pickups) {
    if (s.collected.has(p.id) || !canReach(s, p.lane, p.z)) continue;
    own();
    s.collected.add(p.id);
    s.pickups += 1;
    switch (resolvePickup(p.kind, p.id)) {
      case 'board': s.board = Power.boardTicks; break;
      case 'magnet': s.magnet = Power.magnetTicks; break;
      case 'sneakers': s.sneakers = Power.sneakersTicks; break;
      case 'double': s.double = Power.doubleTicks; break;
      case 'jetpack': s.fly = Power.flyTicks; s.descend = 0; s.flyFrom = s.y; s.flyUp = 0; break;
    }
  }
  return s;
}

/** One run: the track plus the runner. The renderer and the tests drive the game through this. */
export class RunSession {
  static readonly generateAhead = 120.0;
  state: RunnerState = startState();
  track: Track;
  private seed: number;
  private messes: boolean;
  private messHorizon = 0;

  constructor(seed: bigint, opts: StartOptions = {}) {
    this.state = startState(opts);
    this.seed = Number(seed & 0xffffffffn);
    this.messes = !!opts.messes;
    this.track = new Track(seed);
    this.track.generate(RunSession.generateAhead);
    this.placeMesses();
  }

  private placeMesses(): void {
    if (!this.messes) return;
    // Only place where the track is final: rows beyond the frontier may still add things within 4 m (obstacle reach) of a slot.
    const to = Math.min(this.state.z + RunSession.generateAhead, rowZ(this.track.rowsGenerated) - 8);
    if (to <= this.messHorizon) return;
    placeMesses(this.track, this.seed, this.messHorizon, to);
    this.messHorizon = to;
  }

  tick(move: Move, boost = false): void {
    this.state = step(this.state, move, this.track, ENDLESS_PACE, boost);
    this.track.generate(this.state.z + RunSession.generateAhead);
    this.placeMesses();
    this.track.dropBehind(this.state.z);
  }
}
