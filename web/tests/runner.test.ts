import { describe, expect, it } from 'vitest';
import {
  height, isGrounded, isSliding, Runner, score, speedAtTick, startState, step,
  type Move, type RunnerState,
} from '../src/core/runner';
import { Track } from '../src/core/track';

const empty = Track.fixed([]);

/** Steps with 'none' (or `moveAt`'s pick the first time it returns one) until crashed or `ticks` reached. */
function run(track: Track, ticks: number, moveAt?: (s: RunnerState) => Move | null, from: RunnerState = startState()): RunnerState {
  let s = from;
  let used = false;
  for (let i = 0; i < ticks && !s.crashed; i++) {
    let m: Move = 'none';
    if (!used && moveAt) {
      const pick = moveAt(s);
      if (pick !== null) { m = pick; used = true; }
    }
    s = step(s, m, track);
  }
  return s;
}

describe('RunnerTests', () => {
  it('testSpeedRamp', () => {
    expect(speedAtTick(0)).toBe(10);
    expect(speedAtTick(1200)).toBeCloseTo(11, 9);
    expect(speedAtTick(12000)).toBe(20);
    expect(speedAtTick(50000)).toBe(20);
  });
  it('testRunsForwardOnEmptyTrack', () => {
    const s = run(empty, 12000);
    expect(Math.abs(s.z - 1499.958333)).toBeLessThan(1e-5);
    expect(s.crashed).toBe(false);
    expect(isGrounded(s)).toBe(true);
  });
  it('testJumpArc', () => {
    let s = step(startState(), 'up', empty);
    let ticks = 1;
    let peak = 0;
    while (!isGrounded(s)) { peak = Math.max(peak, s.y); s = step(s, 'none', empty); ticks += 1; }
    expect(ticks).toBe(72);
    expect(peak).toBeCloseTo(1.3125, 9);
  });
  it('testCannotDoubleJump', () => {
    const up = step(startState(), 'up', empty);
    const next = step(up, 'up', empty);
    expect(next.vy).toBeLessThan(up.vy);
  });
  it('testSlideLasts72TicksAndLowersHeight', () => {
    let s = step(startState(), 'down', empty);
    expect(height(s)).toBe(0.9);
    let ticks = 1;
    while (isSliding(s)) { s = step(s, 'none', empty); ticks += 1; }
    expect(ticks).toBe(72);
    expect(height(s)).toBe(1.8);
  });
  it('testUpCancelsSlide', () => {
    const sliding = step(startState(), 'down', empty);
    const s = step(sliding, 'up', empty);
    expect(isSliding(s)).toBe(false);
    expect(s.y).toBeGreaterThan(0);
  });
  it('testDownInAirFastFalls', () => {
    const air = run(empty, 10, () => 'up');
    const s = step(air, 'down', empty);
    expect(s.vy).toBeLessThanOrEqual(-15);
    expect(isSliding(s)).toBe(true);
  });
  it('testLaneChangeTakes12TicksAndClampsAtEdges', () => {
    let s = step(startState(), 'left', empty);
    let ticks = 1;
    while (s.x !== -2.5) { s = step(s, 'none', empty); ticks += 1; }
    expect(ticks).toBe(12);
    s = step(s, 'left', empty);
    expect(s.lane).toBe(0);
    expect(s.x).toBe(-2.5);
  });
  it('testHurdleCrashesUnlessJumped', () => {
    const track = Track.fixed([{ id: 0, kind: 'hurdle', lane: 1, z: 10 }]);
    const hit = run(track, 240);
    expect(hit.crashed).toBe(true);
    expect(Math.abs(hit.z - 9.6)).toBeLessThan(0.1);
    expect(run(track, 240, (s) => (s.z >= 8 ? 'up' : null)).crashed).toBe(false);
  });
  it('testBarCrashesUnlessSlid', () => {
    const track = Track.fixed([{ id: 0, kind: 'bar', lane: 1, z: 10 }]);
    expect(run(track, 240).crashed).toBe(true);
    expect(run(track, 240, (s) => (s.z >= 8 ? 'up' : null)).crashed).toBe(true); // jumping is not enough
    expect(run(track, 240, (s) => (s.z >= 8 ? 'down' : null)).crashed).toBe(false);
  });
  it('testTrainCrashesEvenWhenJumpingButNotInOtherLane', () => {
    const track = Track.fixed([{ id: 0, kind: 'train', lane: 1, z: 10 }]);
    expect(run(track, 480, (s) => (s.z >= 8 ? 'up' : null)).crashed).toBe(true);
    expect(run(track, 480, (s) => (s.z >= 5 ? 'right' : null)).crashed).toBe(false);
  });
  it('testSwitchingIntoTrainSideCrashes', () => {
    const track = Track.fixed([{ id: 0, kind: 'train', lane: 0, z: 2 }]);
    expect(run(track, 120, (s) => (s.z >= 5 ? 'left' : null)).crashed).toBe(true);
  });
  it('testCollectsCoinsInOwnLaneOnly', () => {
    const track = Track.fixed([], [{ id: 0, lane: 1, z: 5 }, { id: 1, lane: 1, z: 7 }, { id: 2, lane: 2, z: 5 }]);
    const s = run(track, 120);
    expect(s.coins).toBe(2);
    expect(s.collected).toEqual(new Set([0, 1]));
    expect(score(s)).toBe(Math.trunc(s.z) + 20);
  });
  it('testCrashedStateIsFrozen', () => {
    const s = { ...startState(), crashed: true };
    expect(step(s, 'up', empty)).toEqual(s);
  });
  it('constants match GameCore', () => {
    expect(Runner.dt).toBe(1 / 120);
    expect(Runner.slideDuration).toBe(72);
  });
});
