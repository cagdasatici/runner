import { describe, expect, it } from 'vitest';
import { tierFor } from '../src/ui/tiers';

const run = (stars: number, coins: number, totalCoins = 80) => ({ stars, goldenStars: stars, coins, totalCoins });

describe('tierFor', () => {
  it('picks tiers by stars and coin share', () => {
    expect(tierFor(run(1, 10)).id).toBe('good');
    expect(tierFor(run(1, 60)).id).toBe('great');
    expect(tierFor(run(2, 10)).id).toBe('great');
    expect(tierFor(run(3, 60)).id).toBe('amazing');
    expect(tierFor(run(3, 76)).id).toBe('legendary');
  });
  it('handles a level with no coins', () => {
    expect(tierFor(run(1, 0, 0)).id).toBe('good');
  });
  it('higher tiers rank higher with more confetti', () => {
    const a = tierFor(run(1, 0)), b = tierFor(run(3, 80));
    expect(b.rank).toBeGreaterThan(a.rank);
    expect(b.confetti).toBeGreaterThan(a.confetti);
  });
});
