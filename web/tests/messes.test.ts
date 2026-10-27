import { describe, expect, it } from 'vitest';
import { autopilotMove } from '../src/core/autopilot';
import { LevelRun } from '../src/core/level';
import { MESS_ID_BASE, MESS_SLOT, placeMesses } from '../src/core/messes';
import { RunSession, startState, step } from '../src/core/runner';
import { laneX, obstacleLength, Track } from '../src/core/track';
import { CHARACTERS, characterById } from '../src/gfx/characters';

function drive(seed: bigint, messes: boolean, ticks: number): RunSession {
  const g = new RunSession(seed, { messes });
  for (let i = 0; i < ticks; i++) g.tick(autopilotMove(g.state, g.track));
  return g;
}

describe('messes', () => {
  it('is deterministic', () => {
    const a = new RunSession(42n, { messes: true });
    const b = new RunSession(42n, { messes: true });
    for (let i = 0; i < 3000; i++) { a.tick(autopilotMove(a.state, a.track)); b.tick(autopilotMove(b.state, b.track)); }
    expect(a.track.messes).toEqual(b.track.messes);
    expect(a.track.messes.length).toBeGreaterThan(0);
  });
  it('never changes the track', () => {
    for (const seed of [1n, 7n, 42n]) {
      const a = drive(seed, true, 2000), b = drive(seed, false, 2000);
      expect(a.track.obstacles).toEqual(b.track.obstacles);
      expect(a.track.coins).toEqual(b.track.coins);
      expect(a.track.pickups).toEqual(b.track.pickups);
      expect(b.track.messes.length).toBe(0);
    }
  });
  it('never sits under an obstacle or coin', () => {
    const t = new Track(42n); t.generate(2000); placeMesses(t, 42, 0, 2000);
    expect(t.messes.length).toBeGreaterThan(0);
    for (const m of t.messes) {
      expect(t.obstacles.some((o) => o.lane === m.lane && o.z < m.z + 4 && o.z + obstacleLength(o) > m.z - 4)).toBe(false);
      expect(t.coins.some((c) => c.lane === m.lane && Math.abs(c.z - m.z) < 1.5)).toBe(false);
      expect(t.pickups.some((p) => p.lane === m.lane && Math.abs(p.z - m.z) < 3)).toBe(false);
    }
  });
  it('endless messes respect the final track (no row added on top later)', () => {
    const g = new RunSession(42n, { messes: true });
    const seen = new Map<number, (typeof g.track.messes)[number]>();
    for (let i = 0; i < 3000; i++) { g.tick(autopilotMove(g.state, g.track)); for (const m of g.track.messes) seen.set(m.id, m); }
    expect(seen.size).toBeGreaterThan(0);
    const t = g.track;
    for (const m of t.messes) {
      expect(t.obstacles.some((o) => o.lane === m.lane && o.z < m.z + 4 && o.z + obstacleLength(o) > m.z - 4)).toBe(false);
      expect(t.coins.some((c) => c.lane === m.lane && Math.abs(c.z - m.z) < 1.5)).toBe(false);
      expect(t.pickups.some((p) => p.lane === m.lane && Math.abs(p.z - m.z) < 3)).toBe(false);
    }
  });
  it('has a sane density', () => {
    const t = new Track(42n); t.generate(2000); placeMesses(t, 42, 0, 2000);
    const slots = (2000 - 70) / MESS_SLOT;
    expect(t.messes.length).toBeGreaterThan(0.15 * slots);
    expect(t.messes.length).toBeLessThan(0.30 * slots);
  });
  const mkTrack = () => Track.fixed([], [], [], [{ id: MESS_ID_BASE, kind: 'pee', lane: 1, z: 5 }]);
  it('sticks on a grounded runner', () => {
    const t = mkTrack(); let s = startState({ friendly: true });
    while (s.z <= 6) s = step(s, 'none', t);
    expect(s.messKind).toBe('pee');
    expect(s.messTicks).toBeGreaterThanOrEqual(600);
    expect(s.messTicks).toBeLessThanOrEqual(660);
    expect(s.messes).toBe(1);
    expect(s.crashed).toBe(false);
  });
  it('is avoided by jumping', () => {
    const t = mkTrack(); let s = startState({ friendly: true });
    s = step(s, 'up', t);
    while (s.z <= 6) s = step(s, 'none', t);
    expect(s.messes).toBe(0);
  });
  it('wears off', () => {
    const t = mkTrack(); let s = startState({ friendly: true });
    while (s.z <= 6) s = step(s, 'none', t);
    for (let i = 0; i < 700; i++) s = step(s, 'none', t);
    expect(s.messTicks).toBe(0);
    expect(s.messKind).toBeNull();
  });
  it('levels get messes only when asked, with no cache leak', () => {
    expect(new LevelRun(1, { messes: true }).level.track.messes.length).toBeGreaterThan(0);
    expect(new LevelRun(1, {}).level.track.messes.length).toBe(0);
  });
  it('flags the dogs and kids', () => {
    for (const c of CHARACTERS) expect(!!c.messes).toBe(c.id === 'maltese' || c.id === 'toby');
    expect(characterById('arel').photoSet).toBe('arel');
    expect(characterById('nora').photoSet).toBe('nora');
    expect(characterById('maltese').photoSet).toBe('bella');
    expect(characterById('toby').photoSet).toBe('toby');
    for (const c of CHARACTERS) if (!['arel', 'nora', 'maltese', 'toby'].includes(c.id)) expect(c.photoSet).toBeUndefined();
    expect(laneX(1)).toBe(0);
  });
});
