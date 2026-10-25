import { describe, expect, it } from 'vitest';
import { onRoof, startState, step, type Move, type RunnerState } from '../src/core/runner';
import { ROOF_Y, Track, type Obstacle } from '../src/core/track';
import { buildLevel, CHAIN_FIRST_LEVEL, LEVEL_COUNT } from '../src/core/level';

const train = (id: number, lane: number, z: number, len: number): Obstacle => ({ id, kind: 'train', lane, z, len });
const onRoofAt = (z: number): RunnerState => ({ ...startState(), z, y: ROOF_Y, floor: ROOF_Y });
function go(t: Track, s: RunnerState, moves: Record<number, Move>, ticks: number): RunnerState {
  for (let i = 0; i < ticks && !s.crashed; i++) s = step(s, moves[i] ?? 'none', t);
  return s;
}

describe('roof to roof', () => {
  it('jumps the gap to the next roof in the same lane and lands on it', () => {
    const t = Track.fixed([train(0, 1, 0, 20), train(1, 1, 23, 16)]);
    let s = onRoofAt(18), peak = 0;
    for (let i = 0; i < 400 && s.z < 30; i++) { s = step(s, i === 0 ? 'up' : 'none', t); peak = Math.max(peak, s.y); }
    expect(s.crashed).toBe(false);
    expect(peak).toBeGreaterThan(ROOF_Y + 1); // the jump is based at roof height
    expect(onRoof(s)).toBe(true);
  });
  it('without a jump the runner drops into the gap to the ground and then hits the next train', () => {
    const t = Track.fixed([train(0, 1, 0, 20), train(1, 1, 23, 16)]);
    const s = go(t, onRoofAt(15), {}, 400);
    expect(s.crashed).toBe(true);
  });
  it('switches lanes at roof height onto an adjacent roof without a side crash', () => {
    const t = Track.fixed([train(0, 1, 0, 40), train(1, 2, 0, 40)]);
    const s = go(t, onRoofAt(10), { 0: 'right' }, 60);
    expect(s.crashed).toBe(false);
    expect(s.lane).toBe(2);
    expect(onRoof(s)).toBe(true);
  });
});

describe('generated chains', () => {
  it('late levels contain a roof C one gap behind a long roof in the same lane', () => {
    let found = 0;
    for (let n = CHAIN_FIRST_LEVEL; n <= LEVEL_COUNT; n++) {
      const o = buildLevel(n).track.obstacles.filter((x) => x.kind === 'train');
      if (o.some((a) => a.len === 28 && o.some((c) => c.lane === a.lane && Math.abs(c.z - (a.z + 28 + 3)) < 1e-9))) found++;
    }
    expect(found).toBeGreaterThan(5);
  });
});
