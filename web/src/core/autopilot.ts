// One-to-one port of GameCore/Sources/GameCore/Autopilot.swift.
import { isGrounded, Runner, speedOf, type Move, type RunnerState } from './runner';
import { obstacleLength, type Track } from './track';

export function autopilotMove(s: RunnerState, track: Track): Move {
  const speed = speedOf(s);
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
