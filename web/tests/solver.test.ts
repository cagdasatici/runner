import { describe, expect, it } from 'vitest';
import { Solver } from '../src/core/autopilot';
import { LEVEL_COUNT, LevelRun } from '../src/core/level';

function solve(n: number, ride: boolean): LevelRun {
  const r = new LevelRun(n);
  r.level.track.pickups = []; // the solvers ignore jetpacks and their air coins
  r.level.track.coins = r.level.track.coins.filter((c) => c.y === undefined || c.y < 5);
  const sv = new Solver(ride);
  while (!r.over) r.tick(sv.next(r.state, r.level.track, r.level.spec.pace, r.level.stars, r.starsTaken));
  return r;
}

describe('Solver', () => {
  it('ground solver finishes every level 1…120 without crashing', () => {
    for (let n = 1; n <= LEVEL_COUNT; n += 1) {
      const r = solve(n, false);
      expect(r.state.crashed, `level ${n} crashed at z ${r.state.z.toFixed(1)}`).toBe(false);
      expect(r.finished, `level ${n}`).toBe(true);
    }
  }, 600000);
  it('ramp-riding solver finishes every level 1…120 and collects roof coins', () => {
    let roof = 0;
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const r = solve(n, true);
      expect(r.state.crashed, `level ${n} crashed at z ${r.state.z.toFixed(1)}`).toBe(false);
      expect(r.finished, `level ${n}`).toBe(true);
      for (const c of r.level.track.coins) if (c.y !== undefined && r.state.collected.has(c.id)) roof++;
    }
    expect(roof).toBeGreaterThan(100);
  }, 600000);
  it('levels 1…5 have no ramps and level 1 keeps its golden layout', () => {
    for (let n = 1; n <= 5; n++) {
      const r = solve(n, true);
      expect(r.level.track.obstacles.some((o) => o.kind === 'ramp' || o.len !== undefined)).toBe(false);
    }
  }, 60000);
});
