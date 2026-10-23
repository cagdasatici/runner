import { describe, expect, it } from 'vitest';
import { laneX, ROW_GAP, rowZ, Track } from '../src/core/track';

describe('TrackTests', () => {
  it('testLaneX', () => {
    expect([0, 1, 2].map(laneX)).toEqual([-2.5, 0, 2.5]);
  });
  it('testSeed1FirstRows', () => {
    const t = new Track(1n);
    t.generate(120);
    expect(t.rowsGenerated).toBe(5);
    expect(t.obstacles.map((o) => o.kind)).toEqual(['bar', 'hurdle', 'hurdle', 'bar', 'train']);
    expect(t.obstacles.map((o) => o.lane)).toEqual([2, 2, 0, 0, 1]);
    expect(t.obstacles.map((o) => o.z)).toEqual([40, 58, 76, 94, 112]);
    expect(t.coins.length).toBe(25);
    expect(t.coins.slice(0, 5).map((c) => c.z)).toEqual([40, 42, 44, 46, 48]);
    expect(new Set(t.coins.slice(0, 5).map((c) => c.lane))).toEqual(new Set([0]));
  });
  it('testSameSeedSameTrack', () => {
    const a = new Track(99n);
    const b = new Track(99n);
    a.generate(2000);
    b.generate(2000);
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.coins).toEqual(b.coins);
  });
  it('testFirstThreeRowsHaveOneObstacle', () => {
    for (let seed = 1n; seed <= 50n; seed++) {
      const t = new Track(seed);
      t.generate(rowZ(2));
      expect(t.obstacles.length, `seed ${seed}`).toBe(3);
    }
  });
  it('testEveryRowLeavesAFreeLaneAndCoinsAreInAFreeLane', () => {
    for (let seed = 1n; seed <= 50n; seed++) {
      const t = new Track(seed);
      t.generate(3000);
      for (let row = 0; row < t.rowsGenerated; row++) {
        const z0 = rowZ(row);
        const lanes = t.obstacles.filter((o) => o.z === z0).map((o) => o.lane);
        expect(lanes.length >= 1 && lanes.length <= 2, `seed ${seed} row ${row}`).toBe(true);
        expect(new Set(lanes).size, `seed ${seed} row ${row}: two obstacles in one lane`).toBe(lanes.length);
        const coinLanes = new Set(t.coins.filter((c) => c.z >= z0 && c.z < z0 + ROW_GAP).map((c) => c.lane));
        expect(coinLanes.size).toBe(1);
        expect(lanes.includes([...coinLanes][0]), `seed ${seed} row ${row}: coins on an obstacle`).toBe(false);
      }
    }
  });
  it('testDropBehindForgetsPassedThings', () => {
    const t = new Track(1n);
    t.generate(120);
    t.dropBehind(60); // keeps anything whose far end is at or after z 55
    expect(t.obstacles.map((o) => o.z)).toEqual([58, 76, 94, 112]);
    expect(t.coins[0]?.z).toBe(58);
  });
});
