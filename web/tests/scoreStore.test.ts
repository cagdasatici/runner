import { describe, expect, it } from 'vitest';
import { ScoreStore } from '../src/core/scoreStore';

/** In-memory stand-in for localStorage. */
function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('ScoreStoreTests', () => {
  it('testRecordKeepsBest', () => {
    const store = new ScoreStore(memory());
    expect(store.best).toBe(0);
    expect(store.record(50)).toBe(true);
    expect(store.record(30)).toBe(false);
    expect(store.best).toBe(50);
  });
  it('testNegativeStoredBestReadsAsZero', () => {
    expect(new ScoreStore(memory({ 'best.score': '-7' })).best).toBe(0);
  });
  it('garbage or failing storage reads as zero', () => {
    expect(new ScoreStore(memory({ 'best.score': 'banana' })).best).toBe(0);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const store = new ScoreStore(broken);
    expect(store.best).toBe(0);
    expect(store.record(10)).toBe(true); // doesn't throw
  });
});
