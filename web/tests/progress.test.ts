import { describe, expect, it } from 'vitest';
import { PROGRESS_KEY, ProgressStore } from '../src/core/progress';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
}
class BrokenStorage {
  getItem(): string | null { throw new Error('SecurityError'); }
  setItem(): void { throw new Error('QuotaExceededError'); }
}

describe('ProgressStore', () => {
  it('starts with only level 1 open and no stars', () => {
    const p = new ProgressStore(new MemStorage());
    expect(p.unlocked).toBe(1);
    expect(p.totalStars).toBe(0);
    expect(p.isUnlocked(1)).toBe(true);
    expect(p.isUnlocked(2)).toBe(false);
  });
  it('finishing a level opens the next and keeps only the best rating', () => {
    const mem = new MemStorage();
    const p = new ProgressStore(mem);
    expect(p.record(1, 2)).toBe(true);
    expect(p.unlocked).toBe(2);
    expect(p.record(1, 1)).toBe(false);
    expect(p.record(1, 3)).toBe(true);
    expect(p.stars(1)).toBe(3);
    expect(p.totalStars).toBe(3);
    const again = new ProgressStore(mem); // survives a reload
    expect(again.stars(1)).toBe(3);
    expect(again.unlocked).toBe(2);
  });
  it('a crash (0 stars) or a locked level records nothing', () => {
    const p = new ProgressStore(new MemStorage());
    expect(p.record(1, 0)).toBe(false);
    expect(p.record(5, 3)).toBe(false);
    expect(p.unlocked).toBe(1);
  });
  it('the last level stays the highest unlocked level', () => {
    const mem = new MemStorage();
    mem.setItem(PROGRESS_KEY, JSON.stringify({ best: new Array(120).fill(1) }));
    const p = new ProgressStore(mem);
    expect(p.unlocked).toBe(120);
    expect(p.totalStars).toBe(120);
  });
  it('garbage in storage reads as no progress, and bad entries are clamped', () => {
    for (const raw of ['not json', '42', 'null', '{"best":"x"}', '[]', '{}']) {
      const mem = new MemStorage();
      mem.setItem(PROGRESS_KEY, raw);
      expect(new ProgressStore(mem).totalStars, raw).toBe(0);
    }
    const mem = new MemStorage();
    mem.setItem(PROGRESS_KEY, JSON.stringify({ best: [9, -2, 2.7, 'x', null, 1] }));
    const p = new ProgressStore(mem);
    expect([1, 2, 3, 4, 5, 6].map((n) => p.stars(n))).toEqual([3, 0, 2, 0, 0, 1]);
    expect(p.unlocked).toBe(2);
  });
  it('blocked storage never throws', () => {
    const p = new ProgressStore(new BrokenStorage());
    expect(p.totalStars).toBe(0);
    expect(p.record(1, 3)).toBe(true); // kept for this session only
    expect(p.stars(1)).toBe(3);
  });
});
