// Results celebration tiers. Pure logic (no DOM) so it is unit-tested; the results screen styles by `id`.
// Add a tier by inserting into TIERS (highest first): the first tier whose `test` passes wins.

export interface RunSummary { stars: number; goldenStars: number; coins: number; totalCoins: number }
export interface Tier {
  id: 'good' | 'great' | 'amazing' | 'legendary';
  label: string;
  rank: number;     // 0 = lowest; drives how many flourishes the UI adds
  confetti: number; // confetti pieces on the results card
}

const frac = (r: RunSummary) => (r.totalCoins > 0 ? Math.min(1, r.coins / r.totalCoins) : 0);

const TIERS: (Tier & { test: (r: RunSummary) => boolean })[] = [
  { id: 'legendary', label: 'LEGENDARY!', rank: 3, confetti: 90, test: (r) => r.stars >= 3 && frac(r) >= 0.95 },
  { id: 'amazing', label: 'AMAZING!', rank: 2, confetti: 60, test: (r) => r.stars >= 3 },
  { id: 'great', label: 'Great!', rank: 1, confetti: 35, test: (r) => r.stars >= 2 || frac(r) >= 0.6 },
  { id: 'good', label: 'Good!', rank: 0, confetti: 18, test: () => true },
];

export function tierFor(r: RunSummary): Tier {
  const t = TIERS.find((x) => x.test(r))!;
  return { id: t.id, label: t.label, rank: t.rank, confetti: t.confetti };
}
