// Port of GameCore/Sources/GameCore/ScoreStore.swift, using localStorage (or any Storage) instead of UserDefaults.
export const BEST_KEY = 'best.score';

export class ScoreStore {
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  /** Never negative or NaN, even if storage holds garbage. Storage errors count as 0. */
  get best(): number {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(BEST_KEY);
    } catch {
      return 0;
    }
    const n = Math.trunc(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** Saves `score` if it beats the best. Returns true when it is a new best. */
  record(score: number): boolean {
    if (!(score > this.best)) return false;
    try {
      this.storage.setItem(BEST_KEY, String(score));
    } catch {
      // private mode / storage full: keep playing, just don't persist
    }
    return true;
  }
}
