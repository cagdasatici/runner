import { describe, expect, it } from 'vitest';
import { radiusAt } from '../src/gfx/chaser';

describe('chaser cloak profile', () => {
  it('flares at the hem, narrows at the waist, ends small at the neck', () => {
    expect(radiusAt(0)).toBeGreaterThan(radiusAt(0.55));
    expect(radiusAt(0.78)).toBeGreaterThan(radiusAt(0.55)); // shoulders
    expect(radiusAt(1)).toBeLessThan(0.2);
  });
  it('never goes negative or jumps', () => {
    let prev = radiusAt(0);
    for (let i = 1; i <= 100; i++) { const r = radiusAt(i / 100); expect(r).toBeGreaterThan(0); expect(Math.abs(r - prev)).toBeLessThan(0.05); prev = r; }
  });
});
