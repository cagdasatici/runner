// Coin streak: coins collected with less than STREAK_GAP seconds between them build a streak; milestones fire once each.
export const STREAK_GAP = 0.8;
export const MILESTONES = [10, 25, 50, 100] as const;
export interface Streak { count: number; last: number }
export const newStreak = (): Streak => ({ count: 0, last: -Infinity });
/** Adds `n` coins at time `t` (s). Returns the milestone just reached, or 0. */
export function addCoins(s: Streak, n: number, t: number): number {
  if (n <= 0) return 0;
  const before = t - s.last <= STREAK_GAP ? s.count : 0;
  s.count = before + n; s.last = t;
  for (const m of MILESTONES) if (before < m && s.count >= m) return m;
  return 0;
}
