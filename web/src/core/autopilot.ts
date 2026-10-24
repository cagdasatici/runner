// One-to-one port of GameCore/Sources/GameCore/Autopilot.swift.
import { ENDLESS_PACE, isGrounded, Runner, speedOf, type Move, type Pace, type RunnerState } from './runner';
import { obstacleLength, type Track } from './track';

export function autopilotMove(s: RunnerState, track: Track, pace: Pace = ENDLESS_PACE): Move {
  const speed = speedOf(s, pace);
  const ahead = speed * 0.6 + 3;
  const trainIn = (lane: number, z0: number, z1: number): boolean =>
    track.obstacles.some((o) => o.kind === 'train' && o.lane === lane && o.z < z1 && o.z + obstacleLength(o) > z0);

  if (trainIn(s.lane, s.z - 1, s.z + ahead)) {
    const order = [s.lane - 1, s.lane + 1, s.lane - 2, s.lane + 2].filter((l) => l >= 0 && l <= 2);
    for (const target of order) {
      if (trainIn(target, s.z - 1, s.z + ahead)) continue;
      const dir = target < s.lane ? -1 : 1;
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
    if (o.lane === s.lane && o.kind !== 'train' && o.z + obstacleLength(o) > s.z - Runner.halfDepth) {
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
  const dodge = autopilotMove(s, track, pace);
  if (dodge !== 'none') return dodge;
  let target: { lane: number; z: number } | undefined;
  const consider = (lane: number, z: number) => {
    if (z > s.z + Runner.halfDepth && z < s.z + 40 && (target === undefined || z < target.z)) target = { lane, z };
  };
  for (const g of stars) if (!starsTaken.has(g.id)) consider(g.lane, g.z);
  for (const c of track.coins) if (!s.collected.has(c.id)) consider(c.lane, c.z);
  if (target === undefined || target.lane === s.lane) return 'none';
  const dir = target.lane < s.lane ? -1 : 1;
  const next = s.lane + dir;
  const speed = speedOf(s, pace);
  const ahead = speed * 0.6 + 3;
  for (const o of track.obstacles) {
    if (o.lane !== next) continue;
    if (o.kind === 'train' && o.z < s.z + ahead && o.z + obstacleLength(o) > s.z - 1.5) return 'none';
    const gap = o.z - (s.z + Runner.halfDepth);
    if (o.kind !== 'train' && gap > -1 && gap < speed * 0.35) return 'none'; // too close to jump or roll in time
  }
  return dir < 0 ? 'left' : 'right';
}
