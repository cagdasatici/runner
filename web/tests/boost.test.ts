import { describe, expect, it } from 'vitest';
import { Boost, boostedSpeed, Runner, startState, step, speedAtTick, type RunnerState } from '../src/core/runner';
import { Track } from '../src/core/track';

const empty = Track.fixed([]);
const N = 240;
function run(boostAt: (i: number) => boolean, from: RunnerState = startState()): RunnerState {
  let s = from;
  for (let i = 0; i < N; i++) s = step(s, 'none', empty, undefined, boostAt(i));
  return s;
}

describe('Boost', () => {
  it('covers more distance than a normal run on flat ground', () => {
    expect(run(() => true).z).toBeGreaterThan(run(() => false).z);
  });
  it('boosted speed is capped, so a long hold never keeps speeding up', () => {
    expect(boostedSpeed(10, false)).toBeCloseTo(10 * Boost.factor, 9);
    expect(boostedSpeed(20, false)).toBe(Boost.maxSpeed); // 1.6 × 20 = 32 → capped
    expect(boostedSpeed(18, false)).toBe(Boost.maxSpeed);
    expect(boostedSpeed(20, true)).toBe(Boost.flyMaxSpeed);
    expect(boostedSpeed(50, false)).toBe(50); // never slower than not boosting
  });
  it('is always much faster than not boosting, even at top speed', () => {
    for (const v of [10, 14, 18, 20]) expect(boostedSpeed(v, false) / v).toBeGreaterThanOrEqual(1.4);
  });
  it('boost=false is identical to the default call', () => {
    expect(step(startState(), 'none', empty)).toEqual(step(startState(), 'none', empty, undefined, false));
  });
  it('release returns to normal speed immediately', () => {
    const s = run((i) => i < 100);
    expect(s.z).toBeGreaterThan(run(() => false).z);
    const a = step(s, 'none', empty);
    expect(a.z - s.z).toBeCloseTo(speedAtTick(s.tick) * Runner.dt, 9);
  });
  it('does not change jump physics, only forward distance (flight)', () => {
    let a = step(startState(), 'up', empty, undefined, false), b = step(startState(), 'up', empty, undefined, true);
    for (let i = 0; i < 40; i++) { a = step(a, 'none', empty); b = step(b, 'none', empty, undefined, true); expect(b.y).toBe(a.y); }
    expect(b.z).toBeGreaterThan(a.z);
  });
  it('collides using the real boosted position', () => {
    const wall = Track.fixed([{ id: 1, kind: 'hurdle', lane: 1, z: 20 }] as never);
    let s = startState(), i = 0;
    for (; i < 2000 && !s.crashed; i++) s = step(s, 'none', wall, undefined, true);
    let t = startState(), j = 0;
    for (; j < 2000 && !t.crashed; j++) t = step(t, 'none', wall);
    expect(s.crashed && t.crashed).toBe(true);
    expect(i).toBeLessThan(j);
  });
});
