import { describe, expect, it } from 'vitest';
import { addCoins, newStreak } from '../src/core/streak';

describe('coin streak', () => {
  it('fires the x10 milestone exactly once', () => {
    const s = newStreak();
    const hits: number[] = [];
    for (let i = 0; i < 10; i++) hits.push(addCoins(s, 1, i * 0.1));
    expect(hits.filter((h) => h > 0)).toEqual([10]);
  });
  it('a 1 s gap resets the count', () => {
    const s = newStreak();
    addCoins(s, 5, 0);
    addCoins(s, 2, 1.0);
    expect(s.count).toBe(2);
  });
  it('0 coins returns 0', () => {
    expect(addCoins(newStreak(), 0, 0)).toBe(0);
  });
});
