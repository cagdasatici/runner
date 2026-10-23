import { describe, expect, it } from 'vitest';
import { SplitMix64 } from '../src/core/rng';

describe('RNGTests', () => {
  it('testSplitMix64KnownValues', () => {
    const r = new SplitMix64(0n);
    expect(r.next()).toBe(0xe220a8397b1dcdafn);
    expect(r.next()).toBe(0x6e789e6aa1b965f4n);
  });
  it('testIntStaysInRangeAndHitsEveryValue', () => {
    const r = new SplitMix64(42n);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3);
      expect(v >= 0 && v < 3).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
