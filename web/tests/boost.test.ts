import { describe, expect, it } from 'vitest';
import { Boost, boostFactor, Runner, startState, step, speedAtTick, type RunnerState } from '../src/core/runner';
import { Track } from '../src/core/track';

const empty = Track.fixed([]);
const N = 240;
function run(boostAt: (i: number) => boolean, from: RunnerState = startState()): RunnerState {
  let s = from;
  for (let i = 0; i < N; i++) s = step(s, 'none', empty, undefined, boostAt(i));
  return s;
}

describe('Boost', () => {
  it('covers factor times the distance of a normal run on flat ground', () => {
    const n = run(() => false), b = run(() => true);
    expect(b.z / n.z).toBeCloseTo(Boost.factor, 6);
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
  it('keeps speeding up after 3 s of continuous hold, and resets on release', () => {
    expect(boostFactor(Boost.rampAfter)).toBe(Boost.factor);
    expect(boostFactor(Boost.rampAfter + Boost.rampTicks / 2)).toBeGreaterThan(Boost.factor);
    expect(boostFactor(10 ** 6)).toBeCloseTo(Boost.maxFactor, 9);
    const s = run(() => true, startState());
    const long = (() => { let t = startState(); for (let i = 0; i < 700; i++) t = step(t, 'none', empty, undefined, true); return t; })();
    expect(long.boostTicks).toBe(700);
    expect(step(long, 'none', empty, undefined, false).boostTicks).toBe(0);
    expect(s.boostTicks).toBe(N);
  });
});
