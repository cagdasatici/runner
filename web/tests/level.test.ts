import { describe, expect, it } from 'vitest';
import { collectorMove } from '../src/core/autopilot';
import { buildLevel, coinsFor3Stars, LEVEL_COUNT, LevelRun, levelSpec, rating, rowStart } from '../src/core/level';

/** Plays a level with the journey autopilot until it finishes or crashes. */
function autoplay(n: number): LevelRun {
  const r = new LevelRun(n);
  while (!r.over) r.tick(collectorMove(r.state, r.level.track, r.level.spec.pace, r.level.stars, r.starsTaken));
  return r;
}

describe('LevelSpec', () => {
  it('has 120 levels in 12 worlds of 10', () => {
    expect(LEVEL_COUNT).toBe(120);
    expect([1, 10, 11, 120].map((n) => [levelSpec(n).world, levelSpec(n).inWorld])).toEqual([[1, 1], [1, 10], [2, 1], [12, 10]]);
  });
  it('level 1 and level 120 golden values', () => {
    expect(levelSpec(1)).toEqual({ n: 1, world: 1, inWorld: 1, seed: 112648n, rows: 14, rowGap: 22, twoChance: 10, trainChance: 10, pace: { start: 9, accel: 0.08, max: 12 } });
    expect(levelSpec(120)).toEqual({ n: 120, world: 12, inWorld: 10, seed: 1055009n, rows: 48, rowGap: 17, twoChance: 55, trainChance: 50, pace: { start: 13, accel: 0.2, max: 20 } });
  });
  it('gets harder level by level: never shorter rows, slower pace or fewer trains than the level before (boss levels aside)', () => {
    for (let n = 2; n <= LEVEL_COUNT; n++) {
      const a = levelSpec(n - 1), b = levelSpec(n);
      expect(b.rowGap, `level ${n}`).toBeLessThanOrEqual(a.rowGap);
      expect(b.pace.start, `level ${n}`).toBeGreaterThanOrEqual(a.pace.start);
      expect(b.pace.max, `level ${n}`).toBeGreaterThanOrEqual(a.pace.max);
      expect(b.trainChance, `level ${n}`).toBeGreaterThanOrEqual(a.trainChance);
      expect(b.twoChance, `level ${n}`).toBeGreaterThanOrEqual(a.twoChance);
    }
    expect(levelSpec(10).rows).toBe(levelSpec(9).rows + 4); // boss level: 4 extra rows
  });
  it('rejects levels outside 1…120', () => {
    for (const n of [0, 121, 1.5, NaN]) expect(() => levelSpec(n)).toThrow(RangeError);
  });
});

describe('buildLevel', () => {
  it('level 1 golden layout', () => {
    const L = buildLevel(1);
    expect(L.track.obstacles.slice(0, 6).map((o) => [o.kind, o.lane, o.z])).toEqual([
      ['bar', 0, 40], ['hurdle', 0, 62], ['bar', 0, 84], ['bar', 2, 106], ['hurdle', 1, 128], ['hurdle', 0, 150],
    ]);
    expect(L.track.obstacles).toHaveLength(14);
    expect(L.totalCoins).toBe(70);
    expect(L.finishZ).toBe(340);
    expect(L.stars).toEqual([{ id: 84, lane: 1, z: 116 }, { id: 85, lane: 2, z: 204 }, { id: 86, lane: 1, z: 292 }]);
  });
  it('same level, same layout', () => {
    expect(buildLevel(77)).toEqual(buildLevel(77));
  });
  it('every level: one free lane per row, coins in a free lane, 3 golden stars at the end of a coin trail, finish after the last row', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const L = buildLevel(n), spec = L.spec;
      for (let row = 0; row < spec.rows; row++) {
        const z0 = rowStart(spec, row);
        const lanes = L.track.obstacles.filter((o) => o.z === z0).map((o) => o.lane);
        expect(lanes.length >= 1 && lanes.length <= (row < 3 ? 1 : 2), `level ${n} row ${row}`).toBe(true);
        const coinLanes = new Set(L.track.coins.filter((c) => c.y === undefined && c.z >= z0 && c.z <= z0 + 8).map((c) => c.lane)); // the 5-coin trail
        expect(coinLanes.size, `level ${n} row ${row}`).toBe(1);
        expect(lanes.includes([...coinLanes][0]), `level ${n} row ${row}: coins on an obstacle`).toBe(false);
      }
      expect(L.stars, `level ${n}`).toHaveLength(3);
      for (const g of L.stars) expect(L.track.coins.some((c) => c.lane === g.lane && c.z === g.z - 2), `level ${n} star at ${g.z}`).toBe(true);
      expect(L.finishZ).toBeCloseTo(rowStart(spec, spec.rows - 1) + 14, 9);
    }
  });
});

describe('rating', () => {
  const r = (finished: boolean, goldenStars: number, coins: number) => rating({ finished, goldenStars, coins, totalCoins: 70 });
  it('crash is 0 stars whatever was collected', () => {
    expect(r(false, 3, 70)).toBe(0);
  });
  it('finish = 1, finish + 2 golden stars = 2, all 3 + 70 % coins = 3', () => {
    expect(coinsFor3Stars(70)).toBe(49);
    expect(coinsFor3Stars(71)).toBe(50);
    expect(r(true, 0, 70)).toBe(1);
    expect(r(true, 1, 70)).toBe(1);
    expect(r(true, 2, 0)).toBe(2);
    expect(r(true, 3, 48)).toBe(2); // all golden stars but too few coins
    expect(r(true, 3, 49)).toBe(3);
  });
});

describe('LevelRun', () => {
  it('idle runner crashes on every level (no level can be won without playing)', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const g = new LevelRun(n);
      while (!g.over) g.tick('none');
      expect(g.state.crashed, `level ${n}`).toBe(true);
    }
    const g = new LevelRun(1);
    while (!g.over) g.tick('none');
    expect(g.state.tick).toBe(1606);
  });
  it('autopilot finishes level 1 with every coin and 3 stars (golden)', () => {
    const g = autoplay(1);
    expect(g.finished).toBe(true);
    expect(g.state.tick).toBe(3955);
    expect(g.state.z).toBeCloseTo(340.0640833, 6);
    expect(g.state.coins).toBe(70);
    expect(g.starsTaken.size).toBe(3);
    expect(g.stars).toBe(3);
  });
  it('stops ticking once finished', () => {
    const g = autoplay(2);
    const z = g.state.z;
    g.tick('left');
    expect(g.state.z).toBe(z);
  });
});
