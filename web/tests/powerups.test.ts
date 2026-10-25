import { describe, expect, it } from 'vitest';
import { isFlying, Power, pickLandingLane, resolvePickup, Runner, score, startState, step, type Move, type RunnerState } from '../src/core/runner';
import { Track, type Obstacle, type Pickup } from '../src/core/track';

const hurdle = (id: number, lane: number, z: number): Obstacle => ({ id, kind: 'hurdle', lane, z });
const train = (id: number, lane: number, z: number, len?: number): Obstacle => ({ id, kind: 'train', lane, z, len });
const pickup = (id: number, kind: Pickup['kind'], lane: number, z: number): Pickup => ({ id, kind, lane, z });

function run(track: Track, from: RunnerState, max: number, moveAt?: (s: RunnerState) => Move | null, done?: (s: RunnerState) => boolean): RunnerState {
  let s = from;
  let used = false;
  for (let i = 0; i < max && !s.crashed && !(done && done(s)); i++) {
    let m: Move = 'none';
    if (!used && moveAt) { const p = moveAt(s); if (p !== null) { m = p; used = true; } }
    s = step(s, m, track);
  }
  return s;
}

describe('hoverboard', () => {
  it('starts a run with a board, lasts 30 s and then is gone', () => {
    const s = run(Track.fixed([]), startState({ board: true }), 3599);
    expect(s.board).toBe(1);
    expect(step(s, 'none', Track.fixed([])).board).toBe(0);
  });
  it('absorbs one crash: breaks, 1.5 s of invulnerability, the run goes on; the next hit crashes', () => {
    const t = Track.fixed([hurdle(0, 1, 10), hurdle(1, 1, 40)]);
    const s = run(t, startState({ board: true }), 400, undefined, (r) => r.boardBreaks === 1);
    expect(s.crashed).toBe(false);
    expect(s.board).toBe(0);
    expect(s.iframes).toBe(Power.iframesBoard);
    const end = run(t, s, 800);
    expect(end.crashed).toBe(true); // hurdle at 40, no board left
    expect(end.z).toBeGreaterThan(39);
  });
  it('a pickup gives the board and refreshes (not stacks) the timer', () => {
    const t = Track.fixed([], [], [pickup(7, 'board', 1, 5)]);
    const s = run(t, startState(), 200, undefined, (r) => r.pickups === 1);
    expect(s.board).toBe(Power.boardTicks);
  });
});

describe('stumble and chaser (friendly mode)', () => {
  it('the first hit is a stumble: slow-down, chaser, 1 s invulnerability; a second hit within 8 s crashes', () => {
    const t = Track.fixed([hurdle(0, 1, 10), hurdle(1, 1, 30)]);
    const s = run(t, startState({ friendly: true }), 400, undefined, (r) => r.stumbles === 1);
    expect(s.crashed).toBe(false);
    expect(s.chaser).toBe(Power.chaserTicks);
    expect(s.slow).toBe(Power.stumbleSlowTicks);
    expect(run(t, s, 1500).crashed).toBe(true);
  });
  it('after the chaser is gone a new hit is a stumble again', () => {
    const t = Track.fixed([hurdle(0, 1, 10), hurdle(1, 1, 400)]);
    const s = run(t, startState({ friendly: true }), 6000, undefined, (r) => r.stumbles === 2);
    expect(s.stumbles).toBe(2);
    expect(s.crashed).toBe(false);
  });
  it('classic mode (friendly false) crashes on the first hit', () => {
    expect(run(Track.fixed([hurdle(0, 1, 10)]), startState(), 400).crashed).toBe(true);
  });
  it('stumble slows to 70 % for 0.6 s', () => {
    const t = Track.fixed([hurdle(0, 1, 10)]);
    const s = run(t, startState({ friendly: true }), 400, undefined, (r) => r.stumbles === 1);
    const z0 = s.z;
    const after = run(Track.fixed([]), s, 10);
    expect(after.z - z0).toBeCloseTo(10 * (10 / 120) * 0.7 + 0 * 0, 1);
  });
});

describe('magnet, sneakers, double', () => {
  it('magnet pulls coins from other lanes within 3.5 m, for 10 s', () => {
    const coins = [{ id: 1, lane: 0, z: 20 }, { id: 2, lane: 2, z: 20 }, { id: 3, lane: 1, z: 40 }];
    const withMagnet = { ...startState(), magnet: Power.magnetTicks };
    const s = run(Track.fixed([], coins), withMagnet, 400, undefined, (r) => r.z > 22);
    expect(s.collected).toEqual(new Set([1, 2]));
    const without = run(Track.fixed([], coins), startState(), 400, undefined, (r) => r.z > 22);
    expect(without.coins).toBe(0);
    expect(step(run(Track.fixed([]), withMagnet, 1199), 'none', Track.fixed([])).magnet).toBe(0);
  });
  it('sneakers: jump 1.6 × as high, for 8 s', () => {
    let s = step({ ...startState(), sneakers: Power.sneakersTicks }, 'up', Track.fixed([]));
    let peak = 0;
    while (s.y > 0 || s.vy > 0) { peak = Math.max(peak, s.y); s = step(s, 'none', Track.fixed([])); }
    expect(peak).toBeCloseTo(1.3125 * 1.265 * 1.265, 1);
  });
  it('double: coins are worth 20 points', () => {
    const coins = [{ id: 1, lane: 1, z: 5 }];
    const s = run(Track.fixed([], coins), { ...startState(), double: Power.doubleTicks }, 200, undefined, (r) => r.coins === 1);
    expect(s.points).toBe(20);
    expect(score(s)).toBe(Math.trunc(s.z) + 20);
  });
});

describe('near miss and combo (friendly mode)', () => {
  it('a hurdle cleared by less than 0.25 m earns Close! +25; plenty of room does not', () => {
    const t = Track.fixed([hurdle(0, 1, 20)]);
    let tight = 0, loose = 0;
    for (let jumpZ = 12; jumpZ <= 19; jumpZ += 0.25) {
      const s = run(t, startState({ friendly: true }), 600, (r) => (r.z >= jumpZ ? 'up' : null), (r) => r.z > 22 || r.crashed);
      if (s.crashed) continue;
      if (s.nearMisses === 1) { tight++; expect(s.bonus).toBe(25); } else loose++;
    }
    expect(tight).toBeGreaterThan(0);
    expect(loose).toBeGreaterThan(0);
  });
  it('8 coins in a row give a combo +50; a gap of more than 1 s resets the streak', () => {
    const coins = Array.from({ length: 8 }, (_, i) => ({ id: i, lane: 1, z: 5 + i * 2 }));
    const s = run(Track.fixed([], coins), startState({ friendly: true }), 600, undefined, (r) => r.z > 25);
    expect(s.combos).toBe(1);
    expect(s.bonus).toBe(50);
    const gap = Array.from({ length: 8 }, (_, i) => ({ id: i, lane: 1, z: 5 + i * 2 + (i >= 4 ? 40 : 0) }));
    expect(run(Track.fixed([], gap), startState({ friendly: true }), 1200, undefined, (r) => r.z > 70).combos).toBe(0);
  });
});

describe('jetpack', () => {
  const t = () => Track.fixed([train(0, 1, 60, 30)], [], [pickup(5, 'jetpack', 1, 8)]);
  it('lifts off over 0.9 s, flies above the trains for 6 s, collecting air coins', () => {
    const coins = [{ id: 9, lane: 1, z: 30, y: Power.flyHeight + 0.9 }];
    const track = Track.fixed([train(0, 1, 60, 30)], coins, [pickup(5, 'jetpack', 1, 8)]);
    let s = run(track, startState(), 400, undefined, (r) => r.fly > 0);
    expect(isFlying(s)).toBe(true);
    s = run(track, s, Power.flyRiseTicks + 1);
    expect(s.y).toBe(Power.flyHeight);
    s = run(track, s, 1000, undefined, (r) => r.z > 70 || r.fly === 0);
    expect(s.crashed).toBe(false); // flew over the train
    expect(s.collected.has(9)).toBe(true);
  });
  it('lift-off is eased', () => {
    let s: RunnerState = { ...startState(), fly: Power.flyTicks, flyFrom: 0, flyUp: 0 };
    const ys = [0];
    for (let i = 0; i < 60; i++) { s = step(s, 'none', Track.fixed([])); ys.push(s.y); }
    expect((ys[10] - ys[0]) / 10).toBeLessThan((ys[60] - ys[50]) / 10);
  });
  it('landing is eased and ends on the ground', () => {
    let s: RunnerState = { ...startState(), fly: 1, y: Power.flyHeight, flyUp: Power.flyRiseTicks, z: 30 };
    let n = 0, maxDrop = 0;
    do {
      const y0 = s.y;
      s = step(s, 'none', Track.fixed([]));
      maxDrop = Math.max(maxDrop, y0 - s.y);
      n++;
    } while ((s.fly > 0 || s.descend > 0) && n < 1000);
    expect(s.y).toBe(0);
    expect(maxDrop).toBeLessThanOrEqual(Power.flyHeight / Power.flyDescendTicks * 1.6);
  });
  it('timers of other power-ups pause while flying', () => {
    const s0 = { ...startState(), fly: 600, magnet: 1000, y: Power.flyHeight, flyUp: Power.flyRiseTicks, flyFrom: 0 };
    const s = run(Track.fixed([]), s0, 300);
    expect(s.magnet).toBe(1000);
  });
  it('lands in a clear lane and is invulnerable for 1.5 s after touchdown, never an unfair death', () => {
    const track = Track.fixed([train(0, 1, 40, 200)]); // the middle lane is a long train
    const s0 = { ...startState(), fly: 2, y: Power.flyHeight, flyUp: Power.flyRiseTicks, flyFrom: 0, lane: 1, x: 0, z: 30 };
    let s = run(track, s0, 5); // flight ends
    expect(s.descend).toBeGreaterThan(0);
    expect(s.lane).not.toBe(1);
    s = run(track, s, 300, undefined, (r) => r.descend === 0 && r.y === 0);
    expect(s.crashed).toBe(false);
    expect(s.y).toBe(0);
    expect(s.iframes).toBeGreaterThan(Power.iframesLanding - 10);
  });
  it('fuel lasts 6 s normally and 3.5 s with boost', () => {
    const burn = (boost: boolean) => {
      let s: RunnerState = { ...startState(), fly: Power.flyTicks, y: Power.flyHeight, flyUp: Power.flyRiseTicks, flyFrom: 0 };
      let n = 0;
      while (s.fly > 0 && n < 5000) { s = step(s, 'none', Track.fixed([]), undefined, boost); n++; }
      return n / 120;
    };
    expect(burn(false)).toBeCloseTo(6, 1);
    expect(burn(true)).toBeCloseTo(3.5, 1);
  });
  it('boosted flight is much faster than boosted ground running', () => {
    const f = step({ ...startState(), fly: 500, y: Power.flyHeight, flyUp: Power.flyRiseTicks, flyFrom: 0 }, 'none', Track.fixed([]), undefined, true);
    const g = step(startState(), 'none', Track.fixed([]), undefined, true);
    expect(f.z).toBeGreaterThan(g.z * 1.5);
  });
  it('crashes are ignored for 1.5 s after landing, then count again', () => {
    const wall = Track.fixed([{ id: 1, kind: 'train', lane: 1, z: 3, len: 5000 } as Obstacle]);
    let s: RunnerState = { ...startState(), fly: 0, descend: 1, iframes: Power.iframesLanding + 1, y: 0.01, lane: 1 };
    s = step(s, 'none', wall); // touches down
    expect(s.descend).toBe(0);
    for (let i = 0; i < Power.iframesLanding - 3; i++) s = step(s, 'none', wall);
    expect(s.crashed).toBe(false); // the hurdle is inside the runner, ignored
    for (let i = 0; i < 20; i++) s = step(s, 'none', wall);
    expect(s.crashed).toBe(true);
  });
  it('pickLandingLane prefers the current lane when it is clear', () => {
    expect(pickLandingLane(Track.fixed([]), 2, 10, 12)).toBe(2);
    expect(pickLandingLane(Track.fixed([train(0, 2, 20, 10)]), 2, 10, 12)).toBe(1);
  });
  it('landing warning: fly counts down in ticks so the HUD can show 3-2-1', () => {
    expect(Math.ceil(Power.flyWarnTicks / 120)).toBe(3);
    expect(t().pickups).toHaveLength(1);
  });
});

describe('mystery box', () => {
  it('resolves to a real power-up by id', () => {
    expect(resolvePickup('mystery', 0)).toBe('board');
    expect(resolvePickup('mystery', 4)).toBe('jetpack');
    expect(resolvePickup('magnet', 3)).toBe('magnet');
  });
  it('constants', () => {
    expect(Runner.dt).toBe(1 / 120);
    expect(Power.boardTicks).toBe(3600);
  });
});
