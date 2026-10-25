// Crawl clearance: whatever a character's slide pose looks like (lean, tuck, squash, frozen clip frame), the posed
// mesh must sit on the track (no part below y = 0) and fit under the slide hitbox (Runner.slideHeight), so it
// visibly passes under bars. Measuring the real posed bounds and correcting them is shared by every character,
// so no per-model magic numbers can drift out of sync with the art again.

/** Top of the crawl pose (m): a little under Runner.slideHeight (0.9) so the art never pokes into a bar. */
export const CRAWL_LIMIT = 0.86;

/**
 * Given the posed vertical bounds [lo, hi] (relative to the feet pivot, before correction), returns the extra
 * vertical scale `f` (about the pivot, ≤ 1) and the `lift` that make the pose sit on the ground and fit under `limit`.
 * Resulting bounds: [lo*f + lift, hi*f + lift] with the bottom at max(0, lo*f) and the top ≤ limit.
 */
export function fitClearance(lo: number, hi: number, limit = CRAWL_LIMIT): { f: number; lift: number } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return { f: 1, lift: 0 };
  const span = lo < 0 ? hi - lo : hi; // after lifting, the bottom sits at 0 when lo < 0
  const f = span > limit ? limit / span : 1;
  const lift = lo < 0 ? -lo * f : 0;
  return { f, lift };
}
