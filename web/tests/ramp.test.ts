import { describe, expect, it } from 'vitest';
import { floorAt, onRoof, Runner, startState, step, type Move, type RunnerState } from '../src/core/runner';
import { RAMP_LENGTH, ROOF_Y, Track, type Obstacle } from '../src/core/track';

const ramp = (id: number, lane: number, z: number): Obstacle => ({ id, kind: 'ramp', lane, z });
const train = (id: number, lane: number, z: number, len?: number): Obstacle => ({ id, kind: 'train', lane, z, len });

/** Steps until `done` or crashed or `max` ticks; `moveAt` may return a move once, the first time it returns non-null. */
function run(track: Track, max: number, moveAt?: (s: RunnerState) => Move | null, done?: (s: RunnerState) => boolean, from: RunnerState = startState()): RunnerState {
  let s = from;
  let used = false;
  for (let i = 0; i < max && !s.crashed && !(done && done(s)); i++) {
    let m: Move = 'none';
    if (!used && moveAt) {
      const pick = moveAt(s);
      if (pick !== null) { m = pick; used = true; }
    }
    s = step(s, m, track);
  }
  return s;
}

// ramp in lane 1 from z 20 to 27, train in lane 1 from 27 to 37 (the default 10 m)
const rampTrain = () => Track.fixed([ramp(0, 1, 20), train(1, 1, 20 + RAMP_LENGTH)]);

describe('roof height', () => {
  it('floorAt: ground 0, ramp slope, roof 3.5, only inside the lane', () => {
    const t = rampTrain();
    expect(floorAt(0, 10, t)).toBe(0);
    expect(floorAt(0, 20 - Runner.halfDepth, t)).toBe(0); // front foot just touching the ramp start
    expect(floorAt(0, 23.5 - Runner.halfDepth, t)).toBeCloseTo(ROOF_Y / 2, 9); // front foot at mid-ramp
    expect(floorAt(0, 30, t)).toBe(ROOF_Y);
    expect(floorAt(0, 37 + Runner.halfDepth + 0.01, t)).toBe(0); // past the back end
    expect(floorAt(2.5, 30, t)).toBe(0); // lane 2 has nothing
    expect(floorAt(1.25, 30, t)).toBe(ROOF_Y); // the lane border still carries
    expect(floorAt(1.26, 30, t)).toBe(0);
  });
});

describe('ramp transitions', () => {
  it('rides the ramp up onto the roof without crashing and stands at exactly 3.5', () => {
    const s = run(rampTrain(), 2000, undefined, (r) => r.z > 32);
    expect(s.crashed).toBe(false);
    expect(s.y).toBe(ROOF_Y);
    expect(onRoof(s)).toBe(true);
  });
  it('climbs gradually, never faster than the step limit, never sinking', () => {
    const t = rampTrain();
    let s = startState();
    let prevY = 0;
    while (!s.crashed && s.z < 30) {
      s = step(s, 'none', t);
      expect(s.y - prevY).toBeLessThan(0.1);
      expect(s.y).toBeGreaterThanOrEqual(prevY);
      prevY = s.y;
    }
    expect(s.crashed).toBe(false);
  });
  it('falls off the back end and lands on the ground, alive', () => {
    const s = run(rampTrain(), 3000, undefined, (r) => r.z > 60);
    expect(s.crashed).toBe(false);
    expect(s.y).toBe(0);
    expect(s.floor).toBe(0);
    expect(s.z).toBeGreaterThan(60);
  });
  it('falls from the roof with gravity: takes about half a second, lands within 10 m of the end', () => {
    const t = rampTrain();
    let s = run(t, 3000, undefined, (r) => r.z > 37 + Runner.halfDepth + 0.1);
    expect(s.y).toBeGreaterThan(0); // still in the air just after the end
    const z0 = s.z;
    while (s.y > 0) s = step(s, 'none', t);
    expect(s.z - z0).toBeGreaterThan(2);
    expect(s.z - z0).toBeLessThan(10);
    expect(s.crashed).toBe(false);
  });
  it('a jump on the roof is a normal jump from 3.5', () => {
    const t = rampTrain();
    const s = run(t, 3000, (r) => (onRoof(r) ? 'up' : null), (r) => r.y > ROOF_Y + 1);
    expect(s.y).toBeGreaterThan(ROOF_Y + 1);
    expect(s.crashed).toBe(false);
  });
});

describe('crashes', () => {
  it('running into the front of a train without a ramp crashes, even when jumping', () => {
    const t = Track.fixed([train(0, 1, 20)]);
    expect(run(t, 2000).crashed).toBe(true);
    expect(run(t, 2000, (s) => (s.z >= 17 ? 'up' : null)).crashed).toBe(true);
  });
  it('switching sideways into a train from the ground crashes', () => {
    const t = Track.fixed([train(0, 0, 5, 30)]);
    expect(run(t, 600, (s) => (s.z >= 6 ? 'left' : null)).crashed).toBe(true);
  });
  it('a ramp alone never crashes and the runner walks up it and falls off its end when no train follows', () => {
    const t = Track.fixed([ramp(0, 1, 20)]);
    const s = run(t, 1500, undefined, (r) => r.z > 40);
    expect(s.crashed).toBe(false);
    expect(s.y).toBe(0);
  });
  it('hurdle and bar behave as before on the ground next to a ramp lane', () => {
    const t = Track.fixed([ramp(0, 0, 20), train(1, 0, 27), { id: 2, kind: 'hurdle', lane: 1, z: 15 }]);
    expect(run(t, 600).crashed).toBe(true);
    expect(run(t, 600, (s) => (s.z >= 12.5 ? 'up' : null)).crashed).toBe(false);
  });
});

describe('hopping between adjacent roofs', () => {
  it('moving from a roof onto the neighbouring roof keeps the runner at 3.5', () => {
    const t = Track.fixed([ramp(0, 1, 20), train(1, 1, 27, 24), train(2, 2, 40, 12)]);
    const s = run(t, 4000, (r) => (onRoof(r) && r.z > 42 ? 'right' : null), (r) => r.z > 48);
    expect(s.crashed).toBe(false);
    expect(s.lane).toBe(2);
    expect(s.y).toBe(ROOF_Y);
    expect(onRoof(s)).toBe(true);
  });
  it('moving from a roof to a lane with no roof drops down beside the train without crashing', () => {
    const t = Track.fixed([ramp(0, 1, 20), train(1, 1, 27, 40)]);
    const s = run(t, 4000, (r) => (onRoof(r) ? 'right' : null), (r) => r.lane === 2 && r.y === 0 && r.z > 30);
    expect(s.crashed).toBe(false);
    expect(s.lane).toBe(2);
    expect(s.y).toBe(0);
  });
  it('a parallel roof next door: hopping sideways between two roofs side by side never crashes', () => {
    const t = Track.fixed([ramp(0, 1, 20), train(1, 1, 27, 40), train(2, 0, 27, 40)]);
    const s = run(t, 4000, (r) => (onRoof(r) ? 'left' : null), (r) => r.z > 50);
    expect(s.crashed).toBe(false);
    expect(s.lane).toBe(0);
    expect(onRoof(s)).toBe(true);
  });
});

describe('roof coins', () => {
  it('collects a coin at roof height only from the roof', () => {
    const coins = [{ id: 5, lane: 1, z: 31, y: ROOF_Y + 0.9 }, { id: 6, lane: 0, z: 31, y: ROOF_Y + 0.9 }];
    const up = run(Track.fixed([ramp(0, 1, 20), train(1, 1, 27)], coins), 2000, undefined, (r) => r.z > 36);
    expect(up.collected).toEqual(new Set([5]));
    const ground = run(Track.fixed([train(1, 2, 27)], coins), 2000, undefined, (r) => r.z > 36);
    expect(ground.coins).toBe(0);
  });
});
