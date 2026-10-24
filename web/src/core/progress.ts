// Journey progress in localStorage (or any Storage): the best star rating (0…3) of every level.
// Level 1 is always open; level n+1 opens once level n is finished (1+ stars).
// Robust: garbage, wrong types, wrong lengths or blocked storage never throw; they read as "no progress".
import { LEVEL_COUNT } from './level';

export const PROGRESS_KEY = 'journey.v1';

export class ProgressStore {
  private best: number[];

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'>) {
    this.best = ProgressStore.parse(this.read());
  }

  private read(): string | null {
    try {
      return this.storage.getItem(PROGRESS_KEY);
    } catch {
      return null;
    }
  }

  /** Accepts only {"best":[...]} with numbers; each entry is clamped to a whole number 0…3; missing levels are 0. */
  static parse(raw: string | null): number[] {
    const out = new Array<number>(LEVEL_COUNT).fill(0);
    if (!raw) return out;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return out;
    }
    const list = (data as { best?: unknown } | null)?.best;
    if (!Array.isArray(list)) return out;
    for (let i = 0; i < LEVEL_COUNT && i < list.length; i++) {
      const v = list[i];
      if (typeof v === 'number' && Number.isFinite(v)) out[i] = Math.max(0, Math.min(3, Math.trunc(v)));
    }
    return out;
  }

  /** Best stars for level n (1…120); 0 = never finished. */
  stars(n: number): number {
    return this.best[n - 1] ?? 0;
  }

  get totalStars(): number {
    return this.best.reduce((a, b) => a + b, 0);
  }

  /** Highest playable level: one past the last finished level in an unbroken chain from level 1. */
  get unlocked(): number {
    let n = 1;
    while (n < LEVEL_COUNT && this.best[n - 1] > 0) n++;
    return n;
  }

  isUnlocked(n: number): boolean {
    return n >= 1 && n <= this.unlocked;
  }

  /** Saves a finished level's rating if it beats the old best. Returns true when it is a new best. */
  record(n: number, stars: number): boolean {
    if (!this.isUnlocked(n) || !(stars > this.stars(n)) || stars > 3) return false;
    this.best[n - 1] = Math.trunc(stars);
    try {
      this.storage.setItem(PROGRESS_KEY, JSON.stringify({ best: this.best }));
    } catch {
      // private mode / storage full: keep playing, progress just isn't kept
    }
    return true;
  }
}
