# Subway Runner v2, Stage 1: Journey, Levels, Stars and Ratings (web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the web game from one endless run into a **journey**: 120 finite levels with a finish line (12 worlds × 10 levels), 3 golden stars to find in each level, a 1–3 star rating, a scrolling journey map, an animated results screen (Next / Retry / Map), and saved progress. The endless run stays, behind a smaller "Endless run" button on the menu.

**Architecture:** Everything is in `web/`. The native iOS app (`App/`, `GameCore/`, `project.yml`) is **not touched**.
- **Game logic (pure, tested):**
  - `src/core/level.ts` builds each level up front from a seed with a difficulty curve, and runs one attempt (`LevelRun`).
  - `src/core/progress.ts` saves the best rating per level in `localStorage`.
  - `src/core/runner.ts` gains a `Pace` (start speed, gain per second, top speed) so each level has its own speed curve. Endless mode keeps `ENDLESS_PACE`, so **all 29 existing tests, including the golden values, stay unchanged and green**.
  - `src/core/autopilot.ts` gains `collectorMove`, which dodges exactly like `autopilotMove` and otherwise steers toward the next golden star or coin.
- **Rendering:** `src/gfx/goldStars.ts` draws the spinning golden stars. `makeFinishArch` in `src/gfx/world.ts` draws the finish arch. `src/game.ts` runs either an endless run or a level, and jogs the runner 1.2 s past the finish before the results card.
- **UI:** HTML/CSS overlays, in the same chunky style.
  - `src/ui/map.ts` and `src/ui/worlds.ts`: the journey map, with generated SVG scenery per world.
  - `index.html`: new map, level HUD and results sections.
  - `src/main.ts`: the screen flow.

**Tech Stack (unchanged, exact pins):** three 0.186.1, @types/three 0.186.0, vite 8.3.5, vitest 5.0.5, typescript 7.0.2. Node v26.10.0, npm 11.19.1, Google Chrome (headless) for checks.

**Pre-verified on 2026-10-24.** Every file below was built and run in a scratch copy of `web/`, and the tasks were replayed in order on a clean copy:
- `npx tsc --noEmit` passes after every task.
- `npm test` gives **42 passed** after Task S1 and **48 passed** after Task S2 (29 old + 13 level + 6 progress); the whole suite takes about 2 s.
- **All 120 levels:** `collectorMove` finishes and 3-stars every level with no crash. An idle runner crashes on every level. Level 1 takes 33.0 s (3955 ticks, 70/70 coins); level 120 takes 48.8 s (5854 ticks, 188/240 coins).
- `npm run build` gives one JS file of about **163 kB gzipped**.
- **Headless-Chrome checks** (iPad 820×1180):
  - `check-touch.mjs` (PLAY → map → drag-scroll the map → tap level 1 → swipe, lane 1 → 2) passes.
  - The new `check-journey.mjs` (autoplay level 1 → results with 3 stars and 70/70 coins → map shows level 1 done and level 2 next → "Oops!" card on an idle crash) passes.
  - `check-offline.mjs` passes (8 cached files).

Copy the code **exactly**.

---

## Executor Rules (read first, follow literally)

1. Work in `/Users/cagdas/Projects/Subway_Runner/web`. Paths below are relative to `web/` unless they start with `../`. **Don't modify anything outside `web/`**, except committing this plan file. Never touch `App/`, `GameCore/`, `project.yml` or `/Users/cagdas/Projects/First_Game`.
2. Do the tasks in order. Run every "Run" step and compare with "Expected". If it differs, fix it within the task. **Never weaken, skip or delete a test**, and never change the golden numbers.
3. Copy every file **exactly**: names, numbers, colours, comments. Don't add dependencies or change versions. Where a step says "replace the whole file", overwrite it completely. Where it says "insert" or "replace this text", change only that text.
4. If a step still fails after 3 fix attempts, stop and report the exact command and output.
5. Commit at the end of each task with exactly the given message, from the repo root (`cd /Users/cagdas/Projects/Subway_Runner`). **Never push. Never create any GitHub repo or publish anything.**
6. The game's name is **Subway Runner**. Never use the names "Subway Surfers", "SYBO", "Jake", "Tricky", "Fresh", "hoverboard" or "Inspector", or that game's art or sounds.
7. Long-running commands: run the preview server in the background. Run the others with a 10-minute timeout.
8. Don't use the in-app browser pane for checks: it throttles hidden pages and blocks service workers. Use the headless-Chrome scripts. Headless Chrome hangs on `.local` names, so use `localhost`.
9. **Never run `mkcert -install`**, and never change macOS trust, firewall, Energy or sleep settings. Never copy, print or commit `rootCA-key.pem`.
10. **This is Stage 1 only.** Don't add characters, world themes, ramps, bloom or a new music engine; those are Stages 2–5. Every level uses today's city look and today's kid character.

## Product Spec (Stage 1)

- **Flow:**
  - **Menu:** total stars `★ N / 360`, `Best N` (endless), a green **PLAY** button that opens the journey map, and a blue **Endless run** button for the old endless game.
  - **Map:** 12 worlds stacked bottom (World 1) to top (World 12), 10 level buttons each on a dotted winding path, with a world banner showing `★ got/30`.
    - Finished levels show their number and 1–3 small stars.
    - The next level to play is bigger, pulses and has a **GO!** bubble.
    - Later levels are grey with a lock.
    - Tapping an open level starts it. The map opens scrolled to the next level. It scrolls by finger (only the map may scroll; zoom stays blocked).
  - **Level:**
    - **HUD:** the ✕ button (back to the map), a level chip (`world-level`, e.g. `2-4`), a progress bar from start to the checkered flag, 3 golden-star slots that light up when a star is taken, and the coin count.
  - **Finish:**
    - **Celebration:** the runner jogs on past the arch for 1.2 s with a burst of sparkles, then the results card appears.
    - **Results card:** ribbon `LEVEL w-l`; 3 big stars that pop in at 0.55 / 0.95 / 1.35 s (earned ones only, with sparkles and a chime each); the cheer `Good!` / `Great!` / `PERFECT!`; the golden stars found; a coin bar with a mark at 70 % that counts up; `New best!` when the rating improved to 2 or 3; and the buttons **Map** / **Retry** / **Next** (no Next after level 120).
  - **Crash in a level:** an "Oops!" card with **Try Again** and **Map**. A crash never records stars.
  - **Endless run:** exactly as before ("Crash!", Play Again / Menu, best score).
- **Rating:** 1★ = finished. 2★ = finished + at least 2 golden stars. 3★ = finished + all 3 golden stars + at least 70 % of the level's coins (rounded up). A crash = 0 = retry.
- **Unlocking:** level 1 is always open. Finishing level n (any rating) opens level n+1. The best rating per level is kept.
- **Saving:** `localStorage` key `journey.v1` = `{"best":[120 numbers 0…3]}`. Garbage, wrong types, wrong lengths or blocked storage never throw; they read as no progress. Existing keys `best.score` and `muted` are unchanged.
- **URL flags:** existing `?autoplay=1 ?idle=1 ?seed=N ?skip=S ?debug=1`, plus new `?level=N` (1…120), which starts that level directly (for checks). With `?debug=1`, `subwayRunnerDebug()` also returns `level`, `finished`, `stars`, `screen`, `unlocked` and `totalStars`.
- **Offline:** unchanged. `vite.config.ts` already gives the service-worker cache a new name on every build (that is the version bump). Task S6 checks that the name changed.

## Constants and formulas (all in `src/core/level.ts`)

| What | Value |
|---|---|
| Levels | `LEVEL_COUNT = 120` = `WORLDS 12` × `LEVELS_PER_WORLD 10` |
| t | `(n − 1) / 119` (0 at level 1, 1 at level 120) |
| seed | `7919·n + 104729` |
| rows | `14 + round(30·t)`, **+4** on every 10th level (boss) → 14 … 48 |
| rowGap (m) | `round1(22 − 5·t)` → 22 … 17 |
| twoChance (% of rows from row 3 on with two obstacles) | `round(10 + 45·t)` → 10 … 55 |
| trainChance (% of obstacles that are trains; rest = hurdle/bar 50/50) | `round(10 + 40·t)` → 10 … 50 |
| pace start / accel / max (m/s, m/s², m/s) | `round1(9 + 4·t)` / `round3(0.08 + 0.12·t)` / `round1(12 + 8·t)` → 9/0.08/12 … 13/0.2/20 |
| rows | first row at z = 40 (`FIRST_ROW_Z`). Each row: 1–2 obstacles, never all 3 lanes. The first 3 rows have 1. 5 coins, 2 m apart, in a free lane from the row start |
| golden stars | 3, aiming at rows 25 % / 55 % / 85 % (then nearest rows +1, −1, +2 …): at the end of that row's coin trail (row start + 10 m), only if the next row has no train in that lane **and** it isn't a side lane while a train fills the middle lane |
| finish | last row start + 14 m (`FINISH_AFTER_LAST_ROW`) |
| 3★ coins | `ceil(0.7 × totalCoins)` (`COIN_SHARE_FOR_3_STARS = 0.7`) |
| golden star height / pickup | drawn at y 1.25; picked up with the coin rule (`canReach`: within 0.9 m sideways and forward, and COIN_Y 0.9 inside the runner's body) |
| celebration before results | 1.2 s (`CELEBRATE_SECONDS` in `game.ts`) |
| map | 12 sections × 1060 px; level i of world w at x = `50 + 30·sin(1.05·i + 1.7·w)` %, y = `1060 − 200 − 87·i` px |

## File Structure

```
web/src/core/runner.ts        # CHANGED: Pace, ENDLESS_PACE, canReach; step/speedAtTick/speedOf take an optional pace
web/src/core/autopilot.ts     # CHANGED: autopilotMove takes an optional pace; new collectorMove
web/src/core/level.ts         # NEW: level specs, generator, rating, LevelRun
web/src/core/progress.ts      # NEW: ProgressStore (localStorage journey.v1)
web/src/gfx/textures.ts       # CHANGED: + finishBannerTexture, checkerTexture
web/src/gfx/materials.ts      # CHANGED: + finishBanner, checker, finishPost, finishBall
web/src/gfx/world.ts          # CHANGED: + makeFinishArch
web/src/gfx/goldStars.ts      # NEW: GoldenStarRenderer
web/src/game.ts               # REPLACED: endless or level runs, stars, finish, celebration
web/src/audio.ts              # CHANGED: + 'star' and 'win' sounds
web/src/ui/worlds.ts          # NEW: 12 world names/colours + SVG map scenery
web/src/ui/map.ts             # NEW: journey map build/refresh/scroll
web/index.html                # REPLACED: + map, level HUD, results sections
web/src/style.css             # CHANGED: + map, level HUD, results styles (appended)
web/src/main.ts               # REPLACED: screen flow menu → map → level → results / crash
web/tests/level.test.ts       # NEW (13 tests)
web/tests/progress.test.ts    # NEW (6 tests)
web/scripts/check-touch.mjs   # REPLACED: PLAY now opens the map; also checks the map scrolls by touch
web/scripts/check-journey.mjs # NEW: results / map / crash check + screenshots
```

---

### Task S1: Pace, level generator, rating and journey autopilot (test first)

- [ ] **S1.1 Write the failing tests:** create `web/tests/level.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collectorMove } from '../src/core/autopilot';
import { buildLevel, coinsFor3Stars, LEVEL_COUNT, LevelRun, levelSpec, rating, rowStart } from '../src/core/level';

/** Plays a level with the journey autopilot until it finishes or crashes. */
function autoplay(n: number): LevelRun {
  const r = new LevelRun(n);
  while (!r.over) r.tick(collectorMove(r.state, r.level.track, r.level.spec.pace, r.level.stars, r.starsTaken));
  return r;
}

describe('LevelSpec', () => {
  it('has 120 levels in 12 worlds of 10', () => {
    expect(LEVEL_COUNT).toBe(120);
    expect([1, 10, 11, 120].map((n) => [levelSpec(n).world, levelSpec(n).inWorld])).toEqual([[1, 1], [1, 10], [2, 1], [12, 10]]);
  });
  it('level 1 and level 120 golden values', () => {
    expect(levelSpec(1)).toEqual({ n: 1, world: 1, inWorld: 1, seed: 112648n, rows: 14, rowGap: 22, twoChance: 10, trainChance: 10, pace: { start: 9, accel: 0.08, max: 12 } });
    expect(levelSpec(120)).toEqual({ n: 120, world: 12, inWorld: 10, seed: 1055009n, rows: 48, rowGap: 17, twoChance: 55, trainChance: 50, pace: { start: 13, accel: 0.2, max: 20 } });
  });
  it('gets harder level by level: never shorter rows, slower pace or fewer trains than the level before (boss levels aside)', () => {
    for (let n = 2; n <= LEVEL_COUNT; n++) {
      const a = levelSpec(n - 1), b = levelSpec(n);
      expect(b.rowGap, `level ${n}`).toBeLessThanOrEqual(a.rowGap);
      expect(b.pace.start, `level ${n}`).toBeGreaterThanOrEqual(a.pace.start);
      expect(b.pace.max, `level ${n}`).toBeGreaterThanOrEqual(a.pace.max);
      expect(b.trainChance, `level ${n}`).toBeGreaterThanOrEqual(a.trainChance);
      expect(b.twoChance, `level ${n}`).toBeGreaterThanOrEqual(a.twoChance);
    }
    expect(levelSpec(10).rows).toBe(levelSpec(9).rows + 4); // boss level: 4 extra rows
  });
  it('rejects levels outside 1…120', () => {
    for (const n of [0, 121, 1.5, NaN]) expect(() => levelSpec(n)).toThrow(RangeError);
  });
});

describe('buildLevel', () => {
  it('level 1 golden layout', () => {
    const L = buildLevel(1);
    expect(L.track.obstacles.slice(0, 6).map((o) => [o.kind, o.lane, o.z])).toEqual([
      ['bar', 0, 40], ['hurdle', 0, 62], ['bar', 0, 84], ['bar', 2, 106], ['hurdle', 1, 128], ['hurdle', 0, 150],
    ]);
    expect(L.track.obstacles).toHaveLength(14);
    expect(L.totalCoins).toBe(70);
    expect(L.finishZ).toBe(340);
    expect(L.stars).toEqual([{ id: 84, lane: 1, z: 116 }, { id: 85, lane: 2, z: 204 }, { id: 86, lane: 1, z: 292 }]);
  });
  it('same level, same layout', () => {
    expect(buildLevel(77)).toEqual(buildLevel(77));
  });
  it('every level: one free lane per row, coins in a free lane, 3 golden stars at the end of a coin trail, finish after the last row', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const L = buildLevel(n), spec = L.spec;
      for (let row = 0; row < spec.rows; row++) {
        const z0 = rowStart(spec, row);
        const lanes = L.track.obstacles.filter((o) => o.z === z0).map((o) => o.lane);
        expect(lanes.length >= 1 && lanes.length <= (row < 3 ? 1 : 2), `level ${n} row ${row}`).toBe(true);
        const coinLanes = new Set(L.track.coins.filter((c) => c.z >= z0 && c.z <= z0 + 8).map((c) => c.lane)); // the 5-coin trail
        expect(coinLanes.size, `level ${n} row ${row}`).toBe(1);
        expect(lanes.includes([...coinLanes][0]), `level ${n} row ${row}: coins on an obstacle`).toBe(false);
      }
      expect(L.stars, `level ${n}`).toHaveLength(3);
      for (const g of L.stars) expect(L.track.coins.some((c) => c.lane === g.lane && c.z === g.z - 2), `level ${n} star at ${g.z}`).toBe(true);
      expect(L.finishZ).toBeCloseTo(rowStart(spec, spec.rows - 1) + 14, 9);
    }
  });
});

describe('rating', () => {
  const r = (finished: boolean, goldenStars: number, coins: number) => rating({ finished, goldenStars, coins, totalCoins: 70 });
  it('crash is 0 stars whatever was collected', () => {
    expect(r(false, 3, 70)).toBe(0);
  });
  it('finish = 1, finish + 2 golden stars = 2, all 3 + 70 % coins = 3', () => {
    expect(coinsFor3Stars(70)).toBe(49);
    expect(coinsFor3Stars(71)).toBe(50);
    expect(r(true, 0, 70)).toBe(1);
    expect(r(true, 1, 70)).toBe(1);
    expect(r(true, 2, 0)).toBe(2);
    expect(r(true, 3, 48)).toBe(2); // all golden stars but too few coins
    expect(r(true, 3, 49)).toBe(3);
  });
});

describe('LevelRun', () => {
  it('idle runner crashes on every level (no level can be won without playing)', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const g = new LevelRun(n);
      while (!g.over) g.tick('none');
      expect(g.state.crashed, `level ${n}`).toBe(true);
    }
    const g = new LevelRun(1);
    while (!g.over) g.tick('none');
    expect(g.state.tick).toBe(1606);
  });
  it('autopilot finishes level 1 with every coin and 3 stars (golden)', () => {
    const g = autoplay(1);
    expect(g.finished).toBe(true);
    expect(g.state.tick).toBe(3955);
    expect(g.state.z).toBeCloseTo(340.0640833, 6);
    expect(g.state.coins).toBe(70);
    expect(g.starsTaken.size).toBe(3);
    expect(g.stars).toBe(3);
  });
  it('autopilot finishes and 3-stars every level 1…120', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const g = autoplay(n);
      expect(g.state.crashed, `level ${n} crashed at z ${g.state.z.toFixed(1)}`).toBe(false);
      expect(g.finished, `level ${n}`).toBe(true);
      expect(g.starsTaken.size, `level ${n} golden stars`).toBe(3);
      expect(g.state.coins, `level ${n} coins`).toBeGreaterThanOrEqual(coinsFor3Stars(g.level.totalCoins));
      expect(g.stars, `level ${n} rating`).toBe(3);
    }
  });
  it('stops ticking once finished', () => {
    const g = autoplay(2);
    const z = g.state.z;
    g.tick('left');
    expect(g.state.z).toBe(z);
  });
});
```

- [ ] **S1.2** Run `cd web && npx vitest run`. Expected: FAIL, with `Error: Cannot find module '../src/core/level' imported from …/tests/level.test.ts`; the other 29 tests still pass.
- [ ] **S1.3 Replace the whole file** `web/src/core/runner.ts` with:

```ts
// One-to-one port of GameCore/Sources/GameCore/Runner.swift. Keep the step order identical:
// move → sideways → vertical → slide timer → forward → tick → collisions → coins.
import { COIN_Y, laneX, obstacleLength, Track, type ObstacleKind } from './track';

export type Move = 'none' | 'left' | 'right' | 'up' | 'down';

export interface RunnerState {
  tick: number;
  z: number; // distance run, metres
  lane: number; // target lane
  x: number; // sideways position, follows laneX(lane)
  y: number; // feet height
  vy: number;
  slideTicks: number; // > 0 while sliding
  coins: number;
  collected: Set<number>;
  crashed: boolean;
}

export const Runner = {
  dt: 1.0 / 120.0,
  startSpeed: 10.0,
  acceleration: 0.1, // m/s gained per second
  maxSpeed: 20.0,
  laneSwitchSpeed: 25.0, // sideways m/s → 0.1 s per lane
  jumpVelocity: 9.0,
  gravity: 30.0,
  fastFallVelocity: -15.0,
  slideDuration: 72, // ticks = 0.6 s
  halfWidth: 0.4,
  halfDepth: 0.4,
  standHeight: 1.8,
  slideHeight: 0.9,
  coinValue: 10,
  coinReach: 0.9,
} as const;

/** How fast a run goes: start speed, gain per second, top speed (m/s). Endless mode uses ENDLESS_PACE. */
export interface Pace {
  start: number;
  accel: number;
  max: number;
}
export const ENDLESS_PACE: Pace = { start: Runner.startSpeed, accel: Runner.acceleration, max: Runner.maxSpeed };

export function startState(): RunnerState {
  return { tick: 0, z: 0, lane: 1, x: 0, y: 0, vy: 0, slideTicks: 0, coins: 0, collected: new Set(), crashed: false };
}
export function cloneState(s: RunnerState): RunnerState {
  return { ...s, collected: new Set(s.collected) };
}

export const isGrounded = (s: RunnerState): boolean => s.y === 0 && s.vy === 0;
export const isSliding = (s: RunnerState): boolean => s.slideTicks > 0;
export const height = (s: RunnerState): number => (isSliding(s) ? Runner.slideHeight : Runner.standHeight);
export const speedOf = (s: RunnerState, pace: Pace = ENDLESS_PACE): number => speedAtTick(s.tick, pace);
export const score = (s: RunnerState): number => Math.trunc(s.z) + s.coins * Runner.coinValue;

export function speedAtTick(t: number, pace: Pace = ENDLESS_PACE): number {
  return Math.min(pace.max, pace.start + pace.accel * t * Runner.dt);
}

/** True when the runner is close enough to pick up a coin (or golden star) floating at COIN_Y in `lane` at `z`. */
export function canReach(s: RunnerState, lane: number, z: number): boolean {
  return Math.abs(s.x - laneX(lane)) < Runner.coinReach && Math.abs(s.z - z) < Runner.coinReach && s.y <= COIN_Y && COIN_Y <= s.y + height(s);
}

/** Box of an obstacle: x half-width, y bottom, y top. */
export function obstacleBox(kind: ObstacleKind): { halfW: number; y0: number; y1: number } {
  switch (kind) {
    case 'hurdle':
      return { halfW: 1.0, y0: 0.0, y1: 1.0 };
    case 'bar':
      return { halfW: 1.0, y0: 1.2, y1: 2.2 };
    case 'train':
      return { halfW: 1.1, y0: 0.0, y1: 3.5 };
  }
}

// overlap(a0, a1, b0, b1) = a0 < b1 && a1 > b0 (strict)
const overlap = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && a1 > b0;

export function step(prev: RunnerState, move: Move, track: Track, pace: Pace = ENDLESS_PACE): RunnerState {
  if (prev.crashed) return prev;
  const s = cloneState(prev);
  switch (move) {
    case 'left':
      s.lane = Math.max(0, s.lane - 1);
      break;
    case 'right':
      s.lane = Math.min(2, s.lane + 1);
      break;
    case 'up':
      if (isGrounded(s)) {
        s.vy = Runner.jumpVelocity;
        s.slideTicks = 0;
      }
      break;
    case 'down':
      if (!isGrounded(s)) s.vy = Math.min(s.vy, Runner.fastFallVelocity);
      s.slideTicks = Runner.slideDuration;
      break;
    case 'none':
      break;
  }
  const maxStep = Runner.laneSwitchSpeed * Runner.dt;
  s.x += Math.max(-maxStep, Math.min(maxStep, laneX(s.lane) - s.x));
  if (s.y > 0 || s.vy > 0) {
    s.vy -= Runner.gravity * Runner.dt;
    s.y += s.vy * Runner.dt;
    if (s.y <= 0) {
      s.y = 0;
      s.vy = 0;
    }
  }
  if (s.slideTicks > 0) s.slideTicks -= 1;
  s.z += speedAtTick(s.tick, pace) * Runner.dt;
  s.tick += 1;

  const h = height(s);
  for (const o of track.obstacles) {
    const b = obstacleBox(o.kind);
    const ox = laneX(o.lane);
    if (
      overlap(s.x - Runner.halfWidth, s.x + Runner.halfWidth, ox - b.halfW, ox + b.halfW) &&
      overlap(s.y, s.y + h, b.y0, b.y1) &&
      overlap(s.z - Runner.halfDepth, s.z + Runner.halfDepth, o.z, o.z + obstacleLength(o))
    ) {
      s.crashed = true;
      return s;
    }
  }
  for (const c of track.coins) {
    if (s.collected.has(c.id)) continue;
    if (canReach(s, c.lane, c.z)) {
      s.collected.add(c.id);
      s.coins += 1;
    }
  }
  return s;
}

/** One run: the track plus the runner. The renderer and the tests drive the game through this. */
export class RunSession {
  static readonly generateAhead = 120.0;
  state: RunnerState = startState();
  track: Track;

  constructor(seed: bigint) {
    this.track = new Track(seed);
    this.track.generate(RunSession.generateAhead);
  }

  tick(move: Move): void {
    this.state = step(this.state, move, this.track);
    this.track.generate(this.state.z + RunSession.generateAhead);
    this.track.dropBehind(this.state.z);
  }
}
```

- [ ] **S1.4 Replace the whole file** `web/src/core/autopilot.ts` with:

```ts
// One-to-one port of GameCore/Sources/GameCore/Autopilot.swift.
import { ENDLESS_PACE, isGrounded, Runner, speedOf, type Move, type Pace, type RunnerState } from './runner';
import { obstacleLength, type Track } from './track';

export function autopilotMove(s: RunnerState, track: Track, pace: Pace = ENDLESS_PACE): Move {
  const speed = speedOf(s, pace);
  const ahead = speed * 0.6 + 3;
  const trainIn = (lane: number, z0: number, z1: number): boolean =>
    track.obstacles.some((o) => o.kind === 'train' && o.lane === lane && o.z < z1 && o.z + obstacleLength(o) > z0);

  if (trainIn(s.lane, s.z - 1, s.z + ahead)) {
    const order = [s.lane - 1, s.lane + 1, s.lane - 2, s.lane + 2].filter((l) => l >= 0 && l <= 2);
    for (const target of order) {
      if (trainIn(target, s.z - 1, s.z + ahead)) continue;
      const dir = target < s.lane ? -1 : 1;
      let lane = s.lane + dir;
      let pathClear = true;
      while (lane !== target) {
        if (trainIn(lane, s.z - 1.5, s.z + 2.5)) pathClear = false;
        lane += dir;
      }
      if (pathClear) return dir < 0 ? 'left' : 'right';
    }
    return 'none';
  }
  let next: (typeof track.obstacles)[number] | undefined;
  for (const o of track.obstacles) {
    if (o.lane === s.lane && o.kind !== 'train' && o.z + obstacleLength(o) > s.z - Runner.halfDepth) {
      if (next === undefined || o.z < next.z) next = o;
    }
  }
  if (next === undefined) return 'none';
  const gap = next.z - (s.z + Runner.halfDepth);
  if (next.kind === 'hurdle' && isGrounded(s) && gap <= speed * 0.25) return 'up';
  if (next.kind === 'bar' && gap <= speed * 0.3 && s.slideTicks * Runner.dt * speed < gap + 1.3) return 'down';
  return 'none';
}

/**
 * Journey autopilot: dodges exactly like autopilotMove, and when nothing needs dodging it steers one lane
 * toward the nearest uncollected golden star or coin ahead, but only into a lane that is safe right now.
 */
export function collectorMove(s: RunnerState, track: Track, pace: Pace, stars: { id: number; lane: number; z: number }[], starsTaken: Set<number>): Move {
  const dodge = autopilotMove(s, track, pace);
  if (dodge !== 'none') return dodge;
  let target: { lane: number; z: number } | undefined;
  const consider = (lane: number, z: number) => {
    if (z > s.z + Runner.halfDepth && z < s.z + 40 && (target === undefined || z < target.z)) target = { lane, z };
  };
  for (const g of stars) if (!starsTaken.has(g.id)) consider(g.lane, g.z);
  for (const c of track.coins) if (!s.collected.has(c.id)) consider(c.lane, c.z);
  if (target === undefined || target.lane === s.lane) return 'none';
  const dir = target.lane < s.lane ? -1 : 1;
  const next = s.lane + dir;
  const speed = speedOf(s, pace);
  const ahead = speed * 0.6 + 3;
  for (const o of track.obstacles) {
    if (o.lane !== next) continue;
    if (o.kind === 'train' && o.z < s.z + ahead && o.z + obstacleLength(o) > s.z - 1.5) return 'none';
    const gap = o.z - (s.z + Runner.halfDepth);
    if (o.kind !== 'train' && gap > -1 && gap < speed * 0.35) return 'none'; // too close to jump or roll in time
  }
  return dir < 0 ? 'left' : 'right';
}
```

- [ ] **S1.5 Create** `web/src/core/level.ts`:

```ts
// Journey levels: 12 worlds × 10 levels. Each level is a finite, seeded track with a finish line,
// 3 golden stars and a difficulty that grows with the level number. Pure logic, no DOM.
import { SplitMix64 } from './rng';
import { canReach, cloneState, Runner, startState, step, type Move, type Pace, type RunnerState } from './runner';
import { COIN_SPACING, COINS_PER_ROW, FIRST_ROW_Z, OBSTACLE_KINDS, Track, type Coin, type Obstacle, type ObstacleKind } from './track';

export const WORLDS = 12;
export const LEVELS_PER_WORLD = 10;
export const LEVEL_COUNT = WORLDS * LEVELS_PER_WORLD; // 120
export const STARS_PER_LEVEL = 3;
export const COIN_SHARE_FOR_3_STARS = 0.7;
export const FINISH_AFTER_LAST_ROW = 14; // metres past the last row's near edge (clears a train)

export interface LevelSpec {
  n: number;          // 1…120
  world: number;      // 1…12
  inWorld: number;    // 1…10
  seed: bigint;
  rows: number;       // obstacle rows before the finish
  rowGap: number;     // metres between rows
  twoChance: number;  // % of rows (after the first 3) with two obstacles
  trainChance: number; // % of obstacles that are trains; the rest split hurdle/bar
  pace: Pace;
}

export interface GoldenStar { id: number; lane: number; z: number }

export interface Level {
  spec: LevelSpec;
  track: Track;       // finite: every obstacle and coin of the level
  stars: GoldenStar[];
  finishZ: number;
  totalCoins: number;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Difficulty curve. t goes 0 → 1 over the journey; boss levels (x-10) are a bit longer. */
export function levelSpec(n: number): LevelSpec {
  if (!Number.isInteger(n) || n < 1 || n > LEVEL_COUNT) throw new RangeError(`level ${n} is not 1…${LEVEL_COUNT}`);
  const t = (n - 1) / (LEVEL_COUNT - 1);
  const inWorld = ((n - 1) % LEVELS_PER_WORLD) + 1;
  return {
    n,
    world: Math.floor((n - 1) / LEVELS_PER_WORLD) + 1,
    inWorld,
    seed: BigInt(7919 * n + 104729),
    rows: 14 + Math.round(30 * t) + (inWorld === 10 ? 4 : 0),
    rowGap: r1(22 - 5 * t),
    twoChance: Math.round(10 + 45 * t),
    trainChance: Math.round(10 + 40 * t),
    pace: { start: r1(9 + 4 * t), accel: Math.round((0.08 + 0.12 * t) * 1000) / 1000, max: r1(12 + 8 * t) },
  };
}

export function rowStart(spec: LevelSpec, row: number): number {
  return FIRST_ROW_Z + row * spec.rowGap;
}

/** Builds the whole level up front. Same n → same level, always. */
export function buildLevel(n: number): Level {
  const spec = levelSpec(n);
  const rng = new SplitMix64(spec.seed);
  const obstacles: Obstacle[] = [];
  const coins: Coin[] = [];
  const coinLanes: number[] = [];
  const trainLanes: number[][] = [];
  let id = 0;
  const kindOf = (): ObstacleKind => {
    if (rng.int(100) < spec.trainChance) return 'train';
    return OBSTACLE_KINDS[rng.int(2)]; // hurdle or bar
  };
  for (let row = 0; row < spec.rows; row++) {
    const z0 = rowStart(spec, row);
    const count = row >= 3 && rng.int(100) < spec.twoChance ? 2 : 1;
    const a = rng.int(3);
    const lanes = [a];
    if (count === 2) lanes.push((a + 1 + rng.int(2)) % 3);
    const trains: number[] = [];
    for (const lane of lanes) {
      const kind = kindOf();
      if (kind === 'train') trains.push(lane);
      obstacles.push({ id: id++, kind, lane, z: z0 });
    }
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    const coinLane = free[rng.int(free.length)];
    for (let i = 0; i < COINS_PER_ROW; i++) coins.push({ id: id++, lane: coinLane, z: z0 + i * COIN_SPACING });
    coinLanes.push(coinLane);
    trainLanes.push(trains);
  }
  // Golden stars: the prize at the end of a coin trail (2 m after the last coin), aiming for 25 %, 55 % and 85 %
  // of the level and trying the nearest rows outward (+1, -1, +2, -2 …) when a row doesn't qualify.
  // A row qualifies when (a) the next row has no train in that lane and (b) the star is not in a side lane
  // while a train fills the middle lane (a runner on the far side could not get across in time).
  const stars: GoldenStar[] = [];
  const usedRows = new Set<number>();
  for (const share of [0.25, 0.55, 0.85]) {
    const target = Math.floor(spec.rows * share);
    for (let k = 0; k < spec.rows * 2; k++) {
      const row = target + (k % 2 === 0 ? k / 2 : -(k + 1) / 2);
      if (row < 1 || row > spec.rows - 2 || usedRows.has(row)) continue;
      const blocked = coinLanes[row] !== 1 && trainLanes[row].includes(1);
      if (blocked || trainLanes[row + 1].includes(coinLanes[row])) continue;
      usedRows.add(row);
      stars.push({ id: id++, lane: coinLanes[row], z: rowStart(spec, row) + COINS_PER_ROW * COIN_SPACING });
      break;
    }
  }
  stars.sort((p, q) => p.z - q.z);
  if (stars.length !== STARS_PER_LEVEL) throw new Error(`level ${n}: could only place ${stars.length} golden stars`);
  const track = Track.fixed(obstacles, coins);
  return { spec, track, stars, finishZ: rowStart(spec, spec.rows - 1) + FINISH_AFTER_LAST_ROW, totalCoins: coins.length };
}

/** Coins needed for 3 stars: 70 % rounded up. */
export function coinsFor3Stars(totalCoins: number): number {
  return Math.ceil(totalCoins * COIN_SHARE_FOR_3_STARS - 1e-9);
}

/** 0 = crashed (retry), 1 = finished, 2 = finished + at least 2 golden stars, 3 = all 3 golden stars + 70 % of coins. */
export function rating(r: { finished: boolean; goldenStars: number; coins: number; totalCoins: number }): number {
  if (!r.finished) return 0;
  if (r.goldenStars >= STARS_PER_LEVEL && r.coins >= coinsFor3Stars(r.totalCoins)) return 3;
  if (r.goldenStars >= 2) return 2;
  return 1;
}

/** One attempt at a level: runner + finite track + golden stars + finish line. */
export class LevelRun {
  readonly level: Level;
  state: RunnerState = startState();
  readonly starsTaken = new Set<number>();
  finished = false;

  constructor(n: number) {
    this.level = buildLevel(n);
  }

  get over(): boolean { return this.finished || this.state.crashed; }

  tick(move: Move): void {
    if (this.over) return;
    this.state = step(this.state, move, this.level.track, this.level.spec.pace);
    if (this.state.crashed) return;
    for (const g of this.level.stars) if (!this.starsTaken.has(g.id) && canReach(this.state, g.lane, g.z)) this.starsTaken.add(g.id);
    if (this.state.z >= this.level.finishZ) this.finished = true;
  }

  get stars(): number {
    return rating({ finished: this.finished, goldenStars: this.starsTaken.size, coins: this.state.coins, totalCoins: this.level.totalCoins });
  }

  /** For the finish celebration: keeps the runner jogging past the line without any more rules. */
  coast(): void {
    const s = cloneState(this.state);
    s.z += this.level.spec.pace.max * 0.6 * Runner.dt;
    s.tick += 1;
    this.state = s;
  }
}

```

- [ ] **S1.6** Run `cd web && npx vitest run`. Expected: `Test Files  6 passed (6)` and `Tests  42 passed (42)`. In particular `AutopilotTests` is still green (idle seed 2 crashes at tick 467 with score 39; seed 1 golden 1899.958333 m / 252 coins / 4419), and `autopilot finishes and 3-stars every level 1…120` passes.
- [ ] **S1.7** Run `cd web && npx tsc --noEmit`. Expected: no output.
- [ ] **S1.8** Commit: `git add -A web && git commit -m "feat(web): journey levels, golden stars, rating and collector autopilot"`

---

### Task S2: Saved progress (test first)

- [ ] **S2.1 Write the failing tests:** create `web/tests/progress.test.ts`:

```ts
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
```

- [ ] **S2.2** Run `cd web && npx vitest run`. Expected: FAIL, with `Error: Cannot find module '../src/core/progress' …`; 42 tests still pass.
- [ ] **S2.3 Create** `web/src/core/progress.ts`:

```ts
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
```

- [ ] **S2.4** Run `cd web && npx vitest run`. Expected: `Test Files  7 passed (7)` and `Tests  48 passed (48)`.
- [ ] **S2.5** Commit: `git add -A web && git commit -m "feat(web): journey progress store, robust to bad or blocked storage"`

---

### Task S3: Golden stars and finish arch (3D)

- [ ] **S3.1 Append** this block to the **end** of `web/src/gfx/textures.ts` (after `dotTexture`):

```ts
/** Finish banner: red band with "FINISH" between two checkered strips. */
export function finishBannerTexture(): THREE.Texture {
  return texture(
    canvas(512, 96, (c) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 32; x++) {
        c.fillStyle = (x + y) % 2 ? hex(0x111827) : hex(0xffffff);
        c.fillRect(x * 16, y * 16, 16, 16);
        c.fillRect(x * 16, 64 + y * 16, 16, 16);
      }
      c.fillStyle = hex(0xef4444);
      c.fillRect(0, 32, 512, 32);
      c.fillStyle = hex(0xffffff);
      c.font = '900 30px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('F I N I S H', 256, 49);
    }),
  );
}

/** Checkered finish line on the ground (2 rows of squares). */
export function checkerTexture(): THREE.Texture {
  return texture(
    canvas(256, 16, (c) => {
      for (let x = 0; x < 32; x++) for (let y = 0; y < 2; y++) {
        c.fillStyle = (x + y) % 2 ? hex(0x111827) : hex(0xffffff);
        c.fillRect(x * 8, y * 8, 8, 8);
      }
    }),
  );
}
```

- [ ] **S3.2 Insert** in `web/src/gfx/materials.ts`, directly **above** the line `    // coins` (keep that line):

```ts
    // finish line
    finishBanner: new THREE.MeshLambertMaterial({ map: T.finishBannerTexture() }),
    checker: mapped(T.checkerTexture()),
    finishPost: lambert(0xffffff),
    finishBall: lambert(0xfde047, 0x6b5500),
```

- [ ] **S3.3** In `web/src/gfx/world.ts`, replace the line
`import { boxGeo, cylinderGeo, sphereGeo } from './shapes';`
with
`import { boxGeo, cylinderGeo, mesh, sphereGeo } from './shapes';`
and insert this function directly **above** the comment `/** Frees a built group's geometry (materials are shared and stay). */`:

```ts
/** Finish arch over all three lanes (posts, banner, checkered ground line). `z` is the finish distance. */
export function makeFinishArch(z: number, m: Materials): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    g.add(mesh(cylinderGeo(0.22, 6), m.finishPost, side * 4.3, 3, 0));
    g.add(mesh(sphereGeo(0.4), m.finishBall, side * 4.3, 6.2, 0));
  }
  // Three's box face order: +x, -x, +y, -y, +z (toward the runner), -z
  const banner = new THREE.Mesh(boxGeo(9, 1.6, 0.2), [m.finishPost, m.finishPost, m.finishPost, m.finishPost, m.finishBanner, m.finishPost]);
  banner.position.y = 5.4;
  g.add(banner);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.55), m.checker);
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.2;
  g.add(line);
  g.traverse((o) => { o.castShadow = true; });
  g.position.z = -z;
  return g;
}

```

- [ ] **S3.4 Create** `web/src/gfx/goldStars.ts`:

```ts
// The 3 golden stars of a level: chunky spinning 5-point stars with a soft glow. Taken stars pop and vanish.
import * as THREE from 'three';
import type { GoldenStar } from '../core/level';
import { laneX } from '../core/track';
import { dotTexture } from './textures';

const STAR_Y = 1.25;
const POP_TIME = 0.3;

function starGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.26 : 0.6, a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3 });
  geo.center();
  return geo;
}

export class GoldenStarRenderer {
  readonly group = new THREE.Group();
  private geo = starGeometry();
  private mat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.25, metalness: 0.55, emissive: 0xc98a00, emissiveIntensity: 0.9 });
  private glow = new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffd75e, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75 });
  private nodes = new Map<number, { g: THREE.Group; star: GoldenStar; popT: number }>();

  /** Shows the stars of a new level (removes the old ones). */
  set(stars: GoldenStar[]): void {
    for (const n of this.nodes.values()) this.group.remove(n.g);
    this.nodes.clear();
    for (const star of stars) {
      const g = new THREE.Group();
      const halo = new THREE.Sprite(this.glow);
      halo.scale.setScalar(2.2);
      const mesh = new THREE.Mesh(this.geo, this.mat);
      mesh.castShadow = true;
      g.add(halo, mesh);
      g.position.set(laneX(star.lane), STAR_Y, -star.z);
      this.group.add(g);
      this.nodes.set(star.id, { g, star, popT: -1 });
    }
  }

  /** Spins and bobs the stars; a newly taken star pops (grows, rises, shrinks away). */
  update(taken: Set<number>, time: number, dt: number): void {
    for (const n of this.nodes.values()) {
      if (taken.has(n.star.id) && n.popT < 0) n.popT = 0;
      const spin = n.g.children[1];
      spin.rotation.y = time * 2.6 + n.star.id;
      if (n.popT >= 0) {
        n.popT += dt;
        const k = Math.min(1, n.popT / POP_TIME);
        n.g.visible = k < 1;
        n.g.scale.setScalar((1 + 0.8 * k) * (1 - k * k));
        n.g.position.y = STAR_Y + 1.2 * k;
      } else {
        n.g.position.y = STAR_Y + Math.sin(time * 3 + n.star.id) * 0.12;
      }
    }
  }
}
```

- [ ] **S3.5** Run `cd web && npx tsc --noEmit && npx vitest run`. Expected: no type errors; `Tests  48 passed (48)`.
- [ ] **S3.6** Commit: `git add -A web && git commit -m "feat(web): golden star and finish arch graphics"`

---

### Task S4: Game loop, sounds, map, HUD and results screens

- [ ] **S4.1 Replace the whole file** `web/src/game.ts` with:

```ts
// Port of App/GameController.swift + the menu backdrop: one WebGL canvas, two modes (menu, playing).
// A run is either endless (RunSession) or a journey level (LevelRun, finite with a finish line and golden stars).
// Fixed-step loop: one tick per Runner.dt, at most 8 ticks per frame (extra time dropped).
import * as THREE from 'three';
import { autopilotMove, collectorMove } from './core/autopilot';
import { LevelRun } from './core/level';
import { ENDLESS_PACE, isGrounded, Runner, RunSession, score, speedOf, type Move, type Pace, type RunnerState } from './core/runner';
import { COIN_Y, laneX, type Coin, type Track } from './core/track';
import { RunnerFigure } from './gfx/character';
import { CoinRenderer } from './gfx/coins';
import { ParticlePool } from './gfx/effects';
import { GoldenStarRenderer } from './gfx/goldStars';
import { createMaterials, type Materials } from './gfx/materials';
import { disposeGroup, followSun, makeFinishArch, makeObstacle, makeSegment, SEGMENT_LENGTH, setupEnvironment } from './gfx/world';

const VIEW_AHEAD = 115;
const CELEBRATE_SECONDS = 1.2; // the runner jogs on past the finish line before the results card

export interface GameEvents {
  onScore(score: number, coins: number): void;
  onCrash(score: number, coins: number): void;
  onJump(): void;
  onCoin(): void;
  onStar(taken: number): void;
  onProgress(fraction: number): void;
  onFinish(run: LevelRun): void;
}

/** What the loop needs from either kind of run. */
interface Play {
  state: RunnerState;
  track: Track;
  pace: Pace;
  level: LevelRun | null;
  tick(move: Move): void;
  readonly over: boolean;
}

function endlessPlay(seed: bigint): Play {
  const s = new RunSession(seed);
  return {
    get state() { return s.state; },
    get track() { return s.track; },
    pace: ENDLESS_PACE,
    level: null,
    tick: (m) => s.tick(m),
    get over() { return s.state.crashed; },
  };
}

function levelPlay(n: number): Play {
  const r = new LevelRun(n);
  return {
    get state() { return r.state; },
    track: r.level.track,
    pace: r.level.spec.pace,
    level: r,
    tick: (m) => r.tick(m),
    get over() { return r.over; },
  };
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(66, 1, 0.1, 160);
  private mats: Materials;
  private sun: THREE.DirectionalLight;
  private figure: RunnerFigure;
  private coins: CoinRenderer;
  private stars = new GoldenStarRenderer();
  private finishArch: THREE.Group | null = null;
  private dust = new ParticlePool(160, false);
  private glow = new ParticlePool(400, true);
  private segments = new Map<number, THREE.Group>();
  private obstacleNodes = new Map<number, THREE.Group>();
  private play: Play | null = null;
  private mode: 'menu' | 'playing' = 'menu';
  private autoplay = false;
  private idle = false;
  private pending: Move[] = [];
  private last: number | null = null;
  private acc = 0;
  private time = 0;
  private shake = 0;
  private crashHandled = false;
  private finishT = -1; // seconds since the finish line (-1 = not finished)
  private lastScore = -1;
  private lastCoins = -1;
  private lastStars = 0;
  private lastProgress = -1;
  private lastJumpTick = -100;
  private dustTimer = 0;
  private frameDt = 0;
  private popped = new Set<number>(); // coin ids already shown popping
  private pixelRatio: number;
  private slowFrames = 0;
  private frames = 0;

  constructor(canvas: HTMLCanvasElement, private events: GameEvents) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.mats = createMaterials();
    this.sun = setupEnvironment(this.scene, this.renderer);
    this.figure = new RunnerFigure(this.mats);
    this.coins = new CoinRenderer(this.mats);
    this.scene.add(this.figure.root, this.coins.group, this.stars.group, this.dust.points, this.glow.points);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const px = h * this.renderer.getPixelRatio();
    this.dust.setScale(px);
    this.glow.setScale(px);
  }

  /** Swipes and keys queue moves; one is applied per tick (like the iOS NSLock queue). */
  queue(move: Move): void {
    if (this.mode === 'playing' && !this.autoplay) this.pending.push(move);
  }

  showMenu(): void {
    this.mode = 'menu';
    this.play = null;
    this.clearDynamic();
    this.clearSegments();
    for (let k = -7; k <= 1; k++) this.addSegment(k); // the menu camera looks back along +z
    followSun(this.sun, 0, 0);
  }

  /** Endless run. `skipSeconds` fast-forwards the simulation before the first frame (screenshots/tests; 0 in normal play). */
  startRun(seed: bigint, autoplay: boolean, idle: boolean, skipSeconds = 0): void {
    this.begin(endlessPlay(seed), autoplay, idle, skipSeconds);
  }

  /** Journey level n (1…120). */
  startLevel(n: number, autoplay: boolean, idle: boolean, skipSeconds = 0): void {
    this.begin(levelPlay(n), autoplay, idle, skipSeconds);
  }

  private begin(play: Play, autoplay: boolean, idle: boolean, skipSeconds: number): void {
    this.mode = 'playing';
    this.autoplay = autoplay;
    this.idle = idle;
    this.play = play;
    this.pending = [];
    this.acc = 0;
    this.shake = 0;
    this.crashHandled = false;
    this.finishT = -1;
    this.lastScore = this.lastCoins = this.lastProgress = -1;
    this.lastStars = 0;
    this.lastJumpTick = -100;
    this.clearDynamic();
    this.clearSegments();
    const level = play.level;
    this.stars.set(level ? level.level.stars : []);
    if (level) {
      this.finishArch = makeFinishArch(level.level.finishZ, this.mats);
      this.scene.add(this.finishArch);
    }
    for (let i = 0; i < skipSeconds / Runner.dt && !play.over; i++) play.tick(this.nextMove());
    this.sync();
  }

  get isPlaying(): boolean { return this.mode === 'playing'; }

  /** Called every animation frame with performance.now() in ms. */
  frame(nowMs: number): void {
    const now = nowMs / 1000;
    const dt = this.last === null ? 0 : Math.min(now - this.last, 0.25);
    this.last = now;
    this.time += dt;
    this.frameDt = dt;

    if (this.mode === 'menu') {
      this.figure.menuPose(this.time);
      const a = 0.35 * Math.sin(this.time * 0.3);
      this.camera.position.set(5.2 * Math.sin(a), 2.3, -6.4 * Math.cos(a));
      this.camera.fov = 66;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(0, 1.35, 0);
    } else if (this.play) {
      const play = this.play;
      if (!play.over) {
        this.acc += dt;
        let ticks = 0;
        while (this.acc >= Runner.dt && ticks < 8) {
          this.acc -= Runner.dt;
          ticks++;
          play.tick(this.nextMove());
          if (play.over) break;
        }
        if (ticks === 8) this.acc = 0;
      } else if (play.level?.finished && this.finishT < CELEBRATE_SECONDS) {
        for (let i = 0; i < Math.round(dt / Runner.dt); i++) play.level.coast();
      }
      this.sync();
      this.report(dt);
    }
    this.dust.update(dt);
    this.glow.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.adaptQuality(dt);
  }

  /** Forget the frame clock (after the tab was hidden) so the next frame doesn't jump. */
  resetClock(): void { this.last = null; }

  drawCalls(): number { return this.renderer.info.render.calls; }

  /** Read-only snapshot for automated checks (exposed only with ?debug=1). */
  debugState(): { mode: string; lane: number; tick: number; score: number; crashed: boolean; level: number; finished: boolean; stars: number } {
    const s = this.play?.state, l = this.play?.level;
    return { mode: this.mode, lane: s?.lane ?? -1, tick: s?.tick ?? 0, score: s ? score(s) : 0, crashed: s?.crashed ?? false,
      level: l?.level.spec.n ?? 0, finished: l?.finished ?? false, stars: l?.starsTaken.size ?? 0 };
  }

  private nextMove(): Move {
    const p = this.play!;
    if (this.autoplay) {
      if (this.idle) return 'none';
      return p.level ? collectorMove(p.state, p.track, p.pace, p.level.level.stars, p.level.starsTaken) : autopilotMove(p.state, p.track);
    }
    return this.pending.shift() ?? 'none';
  }

  private report(dt: number): void {
    const p = this.play!, s = p.state, level = p.level;
    if (s.vy > 0 && s.tick - this.lastJumpTick > 30) { this.lastJumpTick = s.tick; this.events.onJump(); }
    if (this.lastCoins >= 0 && s.coins !== this.lastCoins) this.events.onCoin();
    const sc = score(s);
    if (sc !== this.lastScore || s.coins !== this.lastCoins) {
      this.lastScore = sc;
      this.lastCoins = s.coins;
      this.events.onScore(sc, s.coins);
    }
    if (level) {
      if (level.starsTaken.size !== this.lastStars) {
        this.lastStars = level.starsTaken.size;
        this.events.onStar(this.lastStars);
        const g = level.level.stars.find((x) => level.starsTaken.has(x.id) && Math.abs(x.z - s.z) < 2);
        if (g) this.glow.burst(laneX(g.lane), 1.3, -g.z, 40, { color: 0xffd23f, speed: 4.5, life: 0.5, size: 0.26, colorJitter: 0.3 });
      }
      const f = Math.min(1, s.z / level.level.finishZ);
      if (Math.abs(f - this.lastProgress) >= 0.002) { this.lastProgress = f; this.events.onProgress(f); }
      if (level.finished) {
        if (this.finishT < 0) {
          this.finishT = 0;
          this.glow.burst(s.x, 2.5, -level.level.finishZ, 120, { color: 0xfde047, speed: 6, life: 0.9, size: 0.3, gravity: 4, colorJitter: 0.8 });
        }
        const before = this.finishT;
        this.finishT += dt;
        if (before < CELEBRATE_SECONDS && this.finishT >= CELEBRATE_SECONDS) this.events.onFinish(level);
      }
    }
    if (s.crashed && !this.crashHandled) {
      this.crashHandled = true;
      this.shake = 0.28;
      this.glow.burst(s.x, s.y + 1, -s.z - 0.5, 90, { color: 0xfff3b0, speed: 5, life: 0.7, size: 0.3, gravity: 6, colorJitter: 0.6 });
      this.events.onCrash(sc, s.coins);
    }
    // dust puffs behind the feet while running on the ground (45 per second, like iOS)
    if (isGrounded(s) && !s.crashed) {
      this.dustTimer += dt * 45;
      while (this.dustTimer >= 1) {
        this.dustTimer -= 1;
        this.dust.burst(s.x, 0.05, -s.z + 0.25, 1, { color: 0xd6cfc4, speed: 1.4, life: 0.45, size: 0.25, dir: [0, 0.7, 0.7], spread: 0.5 });
      }
    }
  }

  /** Makes scene objects match the run: adds new things, removes passed or collected ones. */
  private sync(): void {
    const p = this.play!, s = p.state, track = p.track;
    const firstSeg = Math.max(-1, Math.trunc((s.z - 10) / SEGMENT_LENGTH) - 1);
    const lastSeg = Math.trunc((s.z + VIEW_AHEAD) / SEGMENT_LENGTH);
    for (let k = firstSeg; k <= lastSeg; k++) if (!this.segments.has(k)) this.addSegment(k);
    for (const [k, g] of this.segments) if (k < firstSeg) { this.scene.remove(g); disposeGroup(g); this.segments.delete(k); }

    const live = new Set<number>();
    for (const o of track.obstacles) {
      if (o.z >= s.z + VIEW_AHEAD || o.z + 12 < s.z - 10) continue;
      live.add(o.id);
      if (!this.obstacleNodes.has(o.id)) { const g = makeObstacle(o, this.mats); this.obstacleNodes.set(o.id, g); this.scene.add(g); }
    }
    for (const [id, g] of this.obstacleNodes) if (!live.has(id)) { this.scene.remove(g); disposeGroup(g); this.obstacleNodes.delete(id); }

    const visible: Coin[] = [];
    for (const c of track.coins) {
      if (c.z >= s.z + VIEW_AHEAD || c.z < s.z - 5) continue;
      if (s.collected.has(c.id)) {
        if (!this.popped.has(c.id)) {
          this.popped.add(c.id);
          this.coins.pop(c);
          this.glow.burst(laneX(c.lane), COIN_Y, -c.z, 16, { color: 0xfde047, speed: 3.5, life: 0.35, size: 0.16 });
        }
      } else visible.push(c);
    }
    this.coins.update(visible, this.time, this.frameDt);
    if (p.level) this.stars.update(p.level.starsTaken, this.time, this.frameDt);

    this.figure.pose(s);
    this.camera.fov = 66 + (speedOf(s, p.pace) - Runner.startSpeed); // 66° → 76° as it speeds up
    this.camera.updateProjectionMatrix();
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - this.frameDt);
      const k = this.shake / 0.28;
      sx = Math.sin(this.time * 90) * 0.22 * k;
      sy = -sx * 0.6;
    }
    this.camera.position.set(s.x * 0.6 + sx, 4.0 + sy, -s.z + 7.2);
    this.camera.rotation.set(-0.2, 0, 0);
    followSun(this.sun, s.x, -s.z);
  }

  private addSegment(k: number): void {
    const g = makeSegment(k, this.mats);
    this.segments.set(k, g);
    this.scene.add(g);
  }
  private clearSegments(): void {
    for (const g of this.segments.values()) { this.scene.remove(g); disposeGroup(g); }
    this.segments.clear();
  }
  private clearDynamic(): void {
    for (const g of this.obstacleNodes.values()) { this.scene.remove(g); disposeGroup(g); }
    this.obstacleNodes.clear();
    if (this.finishArch) { this.scene.remove(this.finishArch); disposeGroup(this.finishArch); this.finishArch = null; }
    this.stars.set([]);
    this.popped.clear();
    this.coins.clearPops();
    this.coins.update([], 0, 0);
    this.dust.clear();
    this.glow.clear();
  }

  /** If frames are slow (iPad struggling), render fewer pixels. Never goes below 1×. */
  private adaptQuality(dt: number): void {
    if (dt <= 0) return;
    this.frames++;
    if (dt > 1 / 45) this.slowFrames++;
    if (this.frames >= 120) {
      if (this.slowFrames > 30 && this.pixelRatio > 1) {
        this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      }
      this.frames = 0;
      this.slowFrames = 0;
    }
  }
}
```

- [ ] **S4.2** In `web/src/audio.ts`, inside `makeSounds()`, replace

```ts
  return {
    menu: music(100, [C, Am, F, G], 0.16 * 0.6, false),
```

with

```ts
  const star = new Buf(0.45); // golden star: quick rising sparkle
  [84, 88, 91, 96].forEach((m, i) => star.add(i * 0.05, 0.25, 0.16, square(freq(m), 0.5)));
  const win = new Buf(1.3); // level complete: little fanfare
  [72, 76, 79].forEach((m, i) => win.add(i * 0.12, 0.12, 0.2, square(freq(m), 0.5)));
  for (const m of [72, 76, 79, 84]) win.add(0.36, 0.9, 0.1, triangle(freq(m)));
  win.add(0.36, 0.9, 0.14, square(freq(84), 0.25));
  return {
    star, win,
    menu: music(100, [C, Am, F, G], 0.16 * 0.6, false),
```

- [ ] **S4.3 Create** `web/src/ui/worlds.ts`:

```ts
// The 12 journey worlds: name and map colours (a = main, b = light, c = accent), plus simple generated
// scenery for the map, drawn as SVG shapes (no images).
export const WORLD_INFO = [
  { name: 'Sunny City', a: '#38bdf8', b: '#bae6fd', c: '#f59e0b' },
  { name: 'Leafy Park', a: '#22c55e', b: '#bbf7d0', c: '#15803d' },
  { name: 'Sandy Beach', a: '#f59e0b', b: '#fef3c7', c: '#0ea5e9' },
  { name: 'Candy Land', a: '#ec4899', b: '#fbcfe8', c: '#a855f7' },
  { name: 'Desert Canyon', a: '#ea580c', b: '#fed7aa', c: '#9a3412' },
  { name: 'Snowy Peaks', a: '#0ea5e9', b: '#e0f2fe', c: '#1e40af' },
  { name: 'Jungle Ruins', a: '#16a34a', b: '#86efac', c: '#854d0e' },
  { name: 'Neon Night', a: '#7c3aed', b: '#312e81', c: '#f0abfc' },
  { name: 'Toy Factory', a: '#ef4444', b: '#fecaca', c: '#2563eb' },
  { name: 'Volcano Valley', a: '#dc2626', b: '#fca5a5', c: '#1c1917' },
  { name: 'Cloud Kingdom', a: '#818cf8', b: '#e0e7ff', c: '#fbbf24' },
  { name: 'Space Station', a: '#1e293b', b: '#475569', c: '#22d3ee' },
] as const;

/** Scenery for world w (0…11) in an 820 × h box, seeded so it never changes. */
export function worldDecor(w: number, h: number): string {
  let s = 17 + w * 31;
  const n = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) >>> 8) / 16777216;
  const c = WORLD_INFO[w].c;
  const out: string[] = [];
  for (let i = 0; i < 14; i++) {
    const x = i % 2 ? n() * 160 : 640 + n() * 160, y = 60 + i * (h / 15) + n() * 30, k = 0.7 + n() * 0.6;
    switch (w) {
      case 0: out.push(`<rect x="${x}" y="${y}" width="${50 * k}" height="${90 * k}" rx="6" fill="${['#f87171', '#fbbf24', '#60a5fa', '#a78bfa'][i % 4]}" opacity=".75"/><rect x="${x + 10 * k}" y="${y + 14 * k}" width="${12 * k}" height="${12 * k}" fill="#fff8"/><rect x="${x + 28 * k}" y="${y + 14 * k}" width="${12 * k}" height="${12 * k}" fill="#fff8"/>`); break;
      case 1: case 6: out.push(`<rect x="${x + 22 * k}" y="${y + 40 * k}" width="${8 * k}" height="${36 * k}" fill="#92400e"/><circle cx="${x + 26 * k}" cy="${y + 30 * k}" r="${30 * k}" fill="${c}" opacity=".8"/>`); break;
      case 2: out.push(`<ellipse cx="${x + 30}" cy="${y + 50}" rx="${40 * k}" ry="${12 * k}" fill="#fde68a"/><path d="M${x + 30} ${y + 50}q-4 -40 6 -60" stroke="#92400e" stroke-width="6" fill="none"/><circle cx="${x + 36}" cy="${y - 10}" r="${18 * k}" fill="#22c55e"/>`); break;
      case 3: out.push(`<rect x="${x + 26}" y="${y + 20}" width="6" height="${60 * k}" fill="#fff"/><circle cx="${x + 29}" cy="${y + 16}" r="${26 * k}" fill="${['#f472b6', '#a855f7', '#22c55e'][i % 3]}"/><circle cx="${x + 29}" cy="${y + 16}" r="${14 * k}" fill="none" stroke="#fff" stroke-width="5"/>`); break;
      case 4: out.push(`<path d="M${x} ${y + 80}l${20 * k} -${70 * k}h${30 * k}l${20 * k} ${70 * k}z" fill="${c}" opacity=".6"/><rect x="${x + 70}" y="${y + 30}" width="10" height="${46 * k}" rx="5" fill="#16a34a"/>`); break;
      case 5: out.push(`<path d="M${x} ${y + 80}l${40 * k} -${80 * k}l${40 * k} ${80 * k}z" fill="#166534"/><path d="M${x + 24 * k} ${y + 32 * k}l${16 * k} -${32 * k}l${16 * k} ${32 * k}z" fill="#fff"/>`); break;
      case 7: out.push(`<rect x="${x}" y="${y}" width="${46 * k}" height="${100 * k}" fill="#1e1b4b"/><rect x="${x + 6}" y="${y + 10}" width="${34 * k}" height="6" fill="${['#f0abfc', '#67e8f9', '#fde047'][i % 3]}"/>`); break;
      case 8: out.push(`<rect x="${x}" y="${y}" width="${44 * k}" height="${44 * k}" rx="8" fill="${['#ef4444', '#2563eb', '#facc15', '#22c55e'][i % 4]}" transform="rotate(${n() * 30 - 15} ${x} ${y})"/>`); break;
      case 9: out.push(`<path d="M${x} ${y + 80}l${36 * k} -${70 * k}h${12 * k}l${36 * k} ${70 * k}z" fill="#44403c"/><circle cx="${x + 42 * k}" cy="${y + 4}" r="${12 * k}" fill="#f97316" opacity=".8"/>`); break;
      case 10: out.push(`<ellipse cx="${x + 40}" cy="${y + 40}" rx="${50 * k}" ry="${22 * k}" fill="#fff" opacity=".9"/><ellipse cx="${x + 20}" cy="${y + 30}" rx="${26 * k}" ry="${18 * k}" fill="#fff"/>`); break;
      default: out.push(`<circle cx="${x + 40}" cy="${y + 30}" r="${22 * k}" fill="${['#f472b6', '#22d3ee', '#fbbf24'][i % 3]}" opacity=".85"/><ellipse cx="${x + 40}" cy="${y + 30}" rx="${36 * k}" ry="${8 * k}" fill="none" stroke="#e2e8f0" stroke-width="3"/>`);
        for (let j = 0; j < 4; j++) out.push(`<circle cx="${n() * 820}" cy="${y + n() * 70}" r="1.6" fill="#fff"/>`);
    }
  }
  return `<svg class="decor" viewBox="0 0 820 ${h}" preserveAspectRatio="none">${out.join('')}</svg>`;
}
```

- [ ] **S4.4 Create** `web/src/ui/map.ts`:

```ts
// The journey map: 12 worlds stacked bottom (world 1) to top (world 12), 10 level buttons each on a winding path.
import { LEVELS_PER_WORLD, WORLDS } from '../core/level';
import type { ProgressStore } from '../core/progress';
import { worldDecor, WORLD_INFO } from './worlds';

export const SECTION_H = 1060;
export const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';

/** Where level i (0…9) of world w sits: x in % of the width, y in px from the top of its section. */
export function nodePos(w: number, i: number): [number, number] {
  return [50 + 30 * Math.sin(i * 1.05 + w * 1.7), SECTION_H - 200 - i * 87];
}

/** Builds the map once into `scroller`; tapping an open level calls onPick(n). */
export function buildMap(scroller: HTMLElement, onPick: (n: number) => void): void {
  let html = '';
  for (let w = WORLDS - 1; w >= 0; w--) {
    const info = WORLD_INFO[w];
    const pts = [...Array(LEVELS_PER_WORLD).keys()].map((i) => nodePos(w, i));
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x * 8.2} ${y}`).join(' ');
    html += `<section class="world" data-world="${w + 1}" style="height:${SECTION_H}px;--a:${info.a};--b:${info.b};--c:${info.c}">
      ${worldDecor(w, SECTION_H)}
      <svg class="path" viewBox="0 0 820 ${SECTION_H}" preserveAspectRatio="none"><path d="${d}"/></svg>
      ${pts.map(([x, y], i) => `<button class="node${i === 9 ? ' boss' : ''}" data-level="${w * 10 + i + 1}" style="left:${x}%;top:${y}px"></button>`).join('')}
      <div class="banner"><small>WORLD ${w + 1}</small><b>${info.name}</b><span class="wstars"></span></div>
    </section>`;
  }
  scroller.innerHTML = html;
  scroller.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.node');
    if (b && !b.classList.contains('locked')) onPick(Number(b.dataset.level));
  });
}

/** Updates every button (done / next / locked, stars) and world banner from saved progress. */
export function refreshMap(scroller: HTMLElement, progress: ProgressStore): void {
  const next = progress.unlocked;
  scroller.querySelectorAll<HTMLButtonElement>('.node').forEach((b) => {
    const n = Number(b.dataset.level), stars = progress.stars(n);
    const state = n === next && stars === 0 ? 'now' : stars > 0 ? 'done' : 'locked';
    b.className = `node ${state}${n % 10 === 0 ? ' boss' : ''}`;
    b.innerHTML = state === 'locked' ? LOCK_SVG
      : `${n - Math.floor((n - 1) / 10) * 10}${state === 'done' ? `<span class="ns">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'got' : ''}">${STAR_SVG}</i>`).join('')}</span>` : '<span class="go">GO!</span>'}`;
    b.setAttribute('aria-label', `Level ${n}${state === 'locked' ? ', locked' : `, ${stars} stars`}`);
  });
  scroller.querySelectorAll<HTMLElement>('.world').forEach((sec) => {
    const w = Number(sec.dataset.world);
    let got = 0;
    for (let i = 1; i <= 10; i++) got += progress.stars((w - 1) * 10 + i);
    sec.querySelector('.wstars')!.innerHTML = `${STAR_SVG}${got}/30`;
    sec.classList.toggle('lockedw', (w - 1) * 10 + 1 > next);
  });
}

/** Scrolls so the next level to play sits in the middle of the screen. */
export function scrollToLevel(scroller: HTMLElement, n: number): void {
  const b = scroller.querySelector<HTMLElement>(`.node[data-level="${n}"]`);
  if (!b) return;
  const sec = b.closest<HTMLElement>('.world')!;
  scroller.scrollTop = sec.offsetTop + b.offsetTop - scroller.clientHeight / 2;
}
```

- [ ] **S4.5 Replace the whole file** `web/index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <title>Subway Runner</title>
    <meta name="description" content="A free, offline 3-lane runner. Swipe to change lanes, jump and roll." />
    <meta name="theme-color" content="#1e1b4b" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Subway Runner" />
    <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="icons/icon-192.png" />
    <link rel="manifest" href="manifest.webmanifest" />
  </head>
  <body>
    <canvas id="gl"></canvas>
    <div id="vignette"></div>

    <section id="menu" class="screen">
      <button id="mute" class="round" aria-label="Sound on or off">
        <svg id="icon-sound" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <svg id="icon-muted" viewBox="0 0 24 24" class="hidden"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      </button>
      <div class="title"><span>SUBWAY</span><span>RUNNER</span></div>
      <div class="chips">
        <div class="chip"><svg viewBox="0 0 24 24" class="trophy"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg><span><b id="total-stars">0</b> / 360</span></div>
        <div class="chip"><svg viewBox="0 0 24 24" class="trophy"><path d="M7 3h10v3h3v2a5 5 0 0 1-4.3 4.95A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 12.95 5 5 0 0 1 4 8V6h3V3zm0 5H6a3 3 0 0 0 1 2.2V8zm10 0v2.2A3 3 0 0 0 18 8h-1z"/></svg><span>Best <b id="best">0</b></span></div>
      </div>
      <div class="grow"></div>
      <button id="play" class="chunky green big"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>PLAY</button>
      <button id="endless" class="chunky blue small">Endless run</button>
      <div class="hints">
        <div><svg viewBox="0 0 24 24"><path d="M3 12l5-5v3h8V7l5 5-5 5v-3H8v3z"/></svg>Lanes</div>
        <div><svg viewBox="0 0 24 24"><path d="M12 3l6 7h-4v10h-4V10H6z"/></svg>Jump</div>
        <div><svg viewBox="0 0 24 24"><path d="M12 21l-6-7h4V4h4v10h4z"/></svg>Roll</div>
      </div>
    </section>

    <section id="map" class="screen hidden">
      <div id="map-scroll" class="scroll"></div>
      <div class="mapbar">
        <button id="map-home" class="round" aria-label="Back to menu"><svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg></button>
        <div class="mtitle">Journey</div>
        <div class="pill gold"><svg viewBox="0 0 24 24" class="st"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg><b id="map-stars">0</b><small>/360</small></div>
      </div>
    </section>

    <section id="hud" class="screen hidden">
      <button id="exit" class="round" aria-label="Back"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg></button>
      <div id="level-bar" class="level-bar hidden">
        <div id="level-chip" class="lvlchip">1-1</div>
        <div class="track"><div id="progress-fill" class="fill"></div><i id="progress-me" class="me"></i><i class="flag"></i></div>
      </div>
      <div class="pills">
        <div id="score-pill" class="pill"><small>SCORE</small><b id="score">0</b></div>
        <div id="star-slots" class="slots hidden"><span></span><span></span><span></span></div>
        <div class="pill gold"><i class="coin"></i><b id="coins">0</b></div>
      </div>
    </section>

    <section id="over" class="screen hidden">
      <div class="card">
        <div class="title small"><span id="over-title">Crash!</span></div>
        <div class="stat"><small>SCORE</small><b id="over-score">0</b></div>
        <div class="stat gold"><i class="coin big"></i><b id="over-coins">0</b></div>
        <div id="newbest" class="newbest hidden">New best!</div>
        <button id="again" class="chunky orange">Play Again</button>
        <button id="home" class="chunky blue">Menu</button>
      </div>
    </section>

    <section id="results" class="screen hidden">
      <div class="rcard">
        <div id="r-level" class="ribbon">LEVEL 1-1</div>
        <div class="bigstars"><div class="bs s0"></div><div class="bs s1"></div><div class="bs s2"></div></div>
        <div id="r-cheer" class="cheer">Great!</div>
        <div class="rrow"><span class="lbl">Golden stars</span><span id="r-gold" class="gs"></span></div>
        <div class="rrow"><i class="coin"></i><div class="cbar"><div id="r-cfill" class="cfill"></div><i class="mark"></i></div><b id="r-coins" class="cnum">0/0</b></div>
        <div id="r-best" class="newbest hidden">New best!</div>
        <div class="rbtns">
          <button id="r-map" class="rb blue" aria-label="Map"><svg viewBox="0 0 24 24"><path d="M9 4l6 2 5-2v16l-5 2-6-2-5 2V6zm0 2.2v11.6l6 2V8.2z"/></svg></button>
          <button id="r-retry" class="rb orange" aria-label="Retry"><svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg></button>
          <button id="r-next" class="rb green wide">Next <svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg></button>
        </div>
      </div>
    </section>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **S4.6 Append** this block to the **end** of `web/src/style.css`:

```css
/* ---------- v2 stage 1: menu chips, journey map, level HUD, results ---------- */
.chips { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.chunky.small { width: 220px; height: 58px; font-size: 22px; }

#map { padding: 0; background: #0f172a; }
#map .scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; touch-action: pan-y; -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain; pointer-events: auto; }
.mapbar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 14px;
  padding: calc(var(--top) + 18px) 20px 26px; background: linear-gradient(rgba(30, 27, 75, 0.9), rgba(30, 27, 75, 0)); pointer-events: none; }
.mapbar .round { position: static; pointer-events: auto; }
.mtitle { flex: 1; color: #fff; font-size: 34px; font-weight: 900; -webkit-text-stroke: 5px var(--ink); paint-order: stroke fill; }
.mapbar .pill b { font-size: 26px; color: #fde047; } .mapbar .pill small { color: #fde047; font-size: 16px; font-weight: 900; }
.mapbar .st { color: #fde047; font-size: 26px; }
.world { position: relative; overflow: hidden; background: linear-gradient(var(--b), color-mix(in srgb, var(--a) 55%, var(--b))); }
.world + .world { border-bottom: 6px dashed rgba(255, 255, 255, 0.6); }
.world .decor, .world .path { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.world .path path { fill: none; stroke: rgba(255, 255, 255, 0.85); stroke-width: 20; stroke-linecap: round; stroke-dasharray: 2 30; }
.node { position: absolute; width: 80px; height: 80px; margin: -40px 0 0 -40px; border-radius: 50%; display: grid; place-items: center; padding: 0;
  font: inherit; font-size: 34px; font-weight: 900; color: #fff; border: 5px solid #fff; pointer-events: auto;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--a) 60%, #fff), var(--a));
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.25); text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3); }
.node.boss { width: 100px; height: 100px; margin: -50px 0 0 -50px; border-color: #fde047; font-size: 40px; }
.node.locked { background: #cbd5e1; color: #64748b; border-color: #e2e8f0; text-shadow: none; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.15); }
.node.locked svg { width: 32px; height: 32px; }
.node.now { width: 100px; height: 100px; margin: -50px 0 0 -50px; border-color: #fde047; animation: pulse 1.4s ease-in-out infinite;
  box-shadow: 0 0 0 10px rgba(253, 224, 71, 0.45), 0 6px 0 rgba(0, 0, 0, 0.25); }
.node .go { position: absolute; bottom: 92px; padding: 6px 14px; border-radius: 16px; background: #fde047; color: var(--ink);
  font-size: 22px; text-shadow: none; border: 3px solid #fff; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2); }
.node .ns { position: absolute; bottom: -24px; display: flex; gap: 1px; font-size: 26px; }
.node .ns i { color: #94a3b8; filter: drop-shadow(0 1px 0 #0006); display: flex; } .node .ns i.got { color: #fde047; }
.node .ns i:nth-child(2) { transform: translateY(5px); }
.banner { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;
  padding: 10px 34px 12px; border-radius: 20px; background: var(--c); color: #fff; border: 4px solid #fff; box-shadow: 0 6px 0 rgba(0, 0, 0, 0.25);
  white-space: nowrap; pointer-events: none; }
.banner small { font-size: 15px; font-weight: 900; opacity: 0.85; letter-spacing: 2px; } .banner b { font-size: 34px; font-weight: 900; }
.banner .wstars { display: flex; align-items: center; gap: 4px; color: #fde047; font-size: 20px; font-weight: 900; }
.lockedw { filter: saturate(0.75) brightness(0.92); }

.level-bar { position: absolute; top: calc(var(--top) + 26px); left: 94px; right: 22px; display: flex; align-items: center; gap: 12px; }
.lvlchip { height: 48px; padding: 0 16px; border-radius: 24px; background: var(--ink); color: #fde047; font-size: 24px; font-weight: 900;
  display: grid; place-items: center; border: 2px solid rgba(255, 255, 255, 0.6); }
.track { position: relative; flex: 1; height: 18px; border-radius: 9px; background: rgba(30, 27, 75, 0.55); border: 2px solid rgba(255, 255, 255, 0.7); margin-right: 10px; }
.track .fill { width: 0; height: 100%; border-radius: 9px; background: linear-gradient(90deg, #4ade80, #22c55e); }
.track .me { position: absolute; left: 0; top: 50%; width: 28px; height: 28px; border-radius: 50%; background: #fbbf24; border: 3px solid #fff; transform: translate(-50%, -50%); }
.track .flag { position: absolute; right: -10px; top: -14px; width: 26px; height: 22px; border: 2px solid #fff; border-radius: 3px;
  background: repeating-conic-gradient(#111 0 25%, #fff 0 50%) 0 0 / 11px 11px; }
#hud.level .pills { margin-top: 74px; }
.slots { display: flex; gap: 4px; padding: 6px 10px; border-radius: 22px; background: rgba(30, 27, 75, 0.55); border: 2px solid rgba(255, 255, 255, 0.5); font-size: 30px; }
.slots span { width: 1em; height: 1em; color: rgba(255, 255, 255, 0.35); display: flex; }
.slots span.got { color: #fde047; filter: drop-shadow(0 0 6px #facc15); animation: pop 0.4s cubic-bezier(.34, 1.56, .64, 1); }

#results { justify-content: flex-end; padding-bottom: calc(var(--bottom) + 50px); background: rgba(15, 10, 40, 0.3); }
.rcard { position: relative; width: min(560px, 100%); padding: 70px 30px 28px; border-radius: 40px; display: flex; flex-direction: column; align-items: center; gap: 14px;
  background: linear-gradient(#6366f1, #312e81); border: 5px solid rgba(255, 255, 255, 0.85); box-shadow: 0 14px 50px rgba(0, 0, 0, 0.4); color: #fff;
  pointer-events: auto; animation: pop 0.45s cubic-bezier(.34, 1.56, .64, 1); }
.ribbon { position: absolute; top: -30px; padding: 12px 40px; border-radius: 16px; font-size: 30px; font-weight: 900; letter-spacing: 2px;
  background: linear-gradient(#fb923c, #ea580c); border: 4px solid #fff; box-shadow: 0 6px 0 #9a3412; }
.bigstars { display: flex; align-items: flex-end; gap: 6px; height: 160px; }
.bs { position: relative; width: 120px; height: 120px; }
.bs.s1 { width: 160px; height: 160px; } .bs.s0 { transform: rotate(-14deg) translateY(-6px); } .bs.s2 { transform: rotate(14deg) translateY(-6px); }
.bs span { position: absolute; inset: 0; display: block; } /* spans must be blocks: inline elements ignore transform */
.bs svg { width: 100%; height: 100%; }
.bs .empty { color: rgba(15, 10, 40, 0.45); }
.bs .full { color: #fde047; filter: drop-shadow(0 5px 0 #ca8a04) drop-shadow(0 0 16px rgba(253, 224, 71, 0.8)); transform: scale(0); }
.bs.on .full { animation: starPop 0.5s cubic-bezier(.34, 1.56, .64, 1) forwards; animation-delay: var(--d); }
.bs.on::after { content: ''; position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px; border-radius: 50%; opacity: 0;
  box-shadow: 0 -70px #fef08a, 50px -50px #fde047, 70px 0 #fef08a, 50px 50px #fde047, 0 70px #fef08a, -50px 50px #fde047, -70px 0 #fef08a, -50px -50px #fde047;
  animation: sparkle 0.6s ease-out forwards; animation-delay: calc(var(--d) + 0.2s); }
@keyframes starPop { 0% { transform: scale(0) rotate(-120deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes sparkle { 0% { opacity: 1; transform: scale(0.3); } 100% { opacity: 0; transform: scale(1.3); } }
.cheer { font-size: 52px; font-weight: 900; color: #fde047; -webkit-text-stroke: 6px var(--ink); paint-order: stroke fill; margin-top: -8px;
  transform: scale(0); animation: pop 0.35s cubic-bezier(.34, 1.56, .64, 1) 1.8s forwards; }
.rrow { display: flex; align-items: center; gap: 14px; width: 100%; padding: 10px 16px; border-radius: 20px; background: rgba(15, 10, 40, 0.3); }
.lbl { font-size: 22px; font-weight: 800; flex: 1; }
.gs { display: flex; gap: 4px; font-size: 34px; } .gs i { width: 1em; height: 1em; display: flex; color: rgba(255, 255, 255, 0.3); } .gs i.got { color: #fde047; }
.cbar { position: relative; flex: 1; height: 20px; border-radius: 10px; background: rgba(15, 10, 40, 0.5); }
.cfill { width: 0; height: 100%; border-radius: 10px; background: linear-gradient(90deg, #fde047, #f59e0b); }
.cbar .mark { position: absolute; left: 70%; top: -6px; bottom: -6px; width: 4px; border-radius: 2px; background: #fff; }
.cnum { font-size: 28px; font-weight: 900; color: #fde047; min-width: 96px; text-align: right; font-variant-numeric: tabular-nums; }
.rbtns { display: flex; gap: 14px; margin-top: 6px; opacity: 0; animation: fadeIn 0.3s ease 2s forwards; }
@keyframes fadeIn { to { opacity: 1; } }
.rb { width: 92px; height: 84px; border-radius: 26px; border: 3px solid rgba(255, 255, 255, 0.85); color: #fff; font: inherit; font-size: 34px; font-weight: 900;
  display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 7px 0 var(--base); transition: transform 0.08s, box-shadow 0.08s; }
.rb:active { transform: translateY(6px); box-shadow: 0 1px 0 var(--base); }
.rb.wide { width: 230px; font-size: 36px; }
.rb.green { background: linear-gradient(#4ade80, #16a34a); --base: #14532d; }
.rb.orange { background: linear-gradient(#fb923c, #ea580c); --base: #9a3412; }
.rb.blue { background: linear-gradient(#38bdf8, #0284c7); --base: #075985; }
```

- [ ] **S4.7 Replace the whole file** `web/src/main.ts` with:

```ts
// Entry point: wires the DOM screens, input, audio and the game loop together.
// URL flags (mirroring the iOS launch arguments): ?autoplay=1  ?idle=1  ?seed=N  ?level=N (start journey level N, 1…120)
// Testing only: ?skip=S fast-forwards S seconds of play at start; ?debug=1 shows fps + draw calls.
import './style.css';
import { Audio } from './audio';
import { LEVEL_COUNT, levelSpec, type LevelRun } from './core/level';
import { ProgressStore } from './core/progress';
import { ScoreStore } from './core/scoreStore';
import { Game } from './game';
import type { Move } from './core/runner';
import { buildMap, refreshMap, scrollToLevel, STAR_SVG } from './ui/map';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const autoplay = params.get('autoplay') === '1';
const idle = params.get('idle') === '1';
const fixedSeed = params.get('seed');
const skip = Math.min(600, Math.max(0, Number(params.get('skip')) || 0));
const levelFlag = Number(params.get('level'));

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; }
}
const store = new ScoreStore(safeStorage());
const progress = new ProgressStore(safeStorage());
const audio = new Audio();
let current = 0; // journey level being played (0 = endless run)
let screen: 'menu' | 'map' | 'hud' | 'over' | 'results' = 'menu';
const timers: number[] = [];
const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
const cancelTimers = () => { while (timers.length) window.clearTimeout(timers.pop()); };

function newSeed(): bigint {
  if (fixedSeed && /^\d+$/.test(fixedSeed) && fixedSeed !== '0') return BigInt(fixedSeed);
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (BigInt(a[0]) << 32n) | BigInt(a[1] | 1);
}

const levelName = (n: number) => { const s = levelSpec(n); return `${s.world}-${s.inWorld}`; };

const game = new Game($('gl'), {
  onScore: (score, coins) => { $('score').textContent = String(score); $('coins').textContent = String(coins); },
  onJump: () => audio.sfx('jump'),
  onCoin: () => audio.sfx('coin'),
  onStar: (taken) => {
    audio.sfx('star');
    $('star-slots').querySelectorAll('span').forEach((s, i) => s.classList.toggle('got', i < taken));
  },
  onProgress: (f) => {
    $('progress-fill').style.width = `${f * 100}%`;
    $('progress-me').style.left = `${f * 100}%`;
  },
  onCrash: (score, coins) => {
    const newBest = current ? false : store.record(score); // journey levels have no high score
    audio.stopMusic();
    audio.sfx('crash');
    navigator.vibrate?.(60);
    $('over-title').textContent = current ? 'Oops!' : 'Crash!';
    $('over-score').textContent = String(score);
    $('over-coins').textContent = String(coins);
    $('newbest').classList.toggle('hidden', !newBest);
    $('again').textContent = current ? 'Try Again' : 'Play Again';
    $('home').textContent = current ? 'Map' : 'Menu';
    later(350, () => show('over'));
  },
  onFinish: (run) => showResults(run),
});

function show(s: typeof screen): void {
  screen = s;
  $('menu').classList.toggle('hidden', s !== 'menu');
  $('map').classList.toggle('hidden', s !== 'map');
  $('hud').classList.toggle('hidden', s !== 'hud' && s !== 'over' && s !== 'results');
  $('over').classList.toggle('hidden', s !== 'over');
  $('results').classList.toggle('hidden', s !== 'results');
}

function goMenu(): void {
  cancelTimers();
  current = 0;
  game.showMenu();
  $('best').textContent = String(store.best);
  $('total-stars').textContent = String(progress.totalStars);
  show('menu');
  audio.playMusic('menu');
}

const mapScroll = $('map-scroll');
buildMap(mapScroll, (n) => { audio.unlock(); playLevel(n); });

function goMap(): void {
  cancelTimers();
  current = 0;
  game.showMenu(); // the 3D scene is hidden behind the map and not drawn (see loop)
  refreshMap(mapScroll, progress);
  $('map-stars').textContent = String(progress.totalStars);
  show('map');
  scrollToLevel(mapScroll, progress.unlocked);
  audio.playMusic('menu');
}

function resetHud(level: boolean): void {
  $('score').textContent = '0';
  $('coins').textContent = '0';
  $('hud').classList.toggle('level', level);
  $('level-bar').classList.toggle('hidden', !level);
  $('star-slots').classList.toggle('hidden', !level);
  $('score-pill').classList.toggle('hidden', level);
  $('star-slots').querySelectorAll('span').forEach((s) => { s.classList.remove('got'); s.innerHTML = STAR_SVG; });
  $('progress-fill').style.width = '0%';
  $('progress-me').style.left = '0%';
}

function playEndless(): void {
  cancelTimers();
  current = 0;
  resetHud(false);
  game.startRun(newSeed(), autoplay, idle, autoplay ? skip : 0);
  show('hud');
  audio.playMusic('run');
}

function playLevel(n: number): void {
  cancelTimers();
  current = n;
  resetHud(true);
  $('level-chip').textContent = levelName(n);
  game.startLevel(n, autoplay, idle, autoplay ? skip : 0);
  show('hud');
  audio.playMusic('run');
}

function showResults(run: LevelRun): void {
  const n = run.level.spec.n, stars = run.stars;
  const newBest = progress.record(n, stars);
  audio.stopMusic();
  audio.sfx('win');
  $('r-level').textContent = `LEVEL ${levelName(n)}`;
  document.querySelectorAll<HTMLElement>('#results .bs').forEach((el, i) => {
    el.innerHTML = `<span class="empty">${STAR_SVG}</span><span class="full">${STAR_SVG}</span>`;
    el.classList.toggle('on', i < stars);
    el.style.setProperty('--d', `${0.55 + i * 0.4}s`);
    if (i < stars) later(550 + i * 400 + 250, () => audio.sfx('star'));
  });
  $('r-cheer').textContent = ['', 'Good!', 'Great!', 'PERFECT!'][stars];
  $('r-gold').innerHTML = [0, 1, 2].map((i) => `<i class="${i < run.starsTaken.size ? 'got' : ''}">${STAR_SVG}</i>`).join('');
  show('results'); // first, so the count-up below sees screen === 'results'; un-hiding also restarts the CSS animations
  const total = run.level.totalCoins, coins = run.state.coins;
  const t0 = performance.now();
  const count = () => { // coins count up over 1.2 s, starting after 0.5 s
    const k = Math.min(1, Math.max(0, (performance.now() - t0 - 500) / 1200));
    const c = Math.round(coins * k);
    $('r-coins').textContent = `${c}/${total}`;
    $('r-cfill').style.width = `${(c / total) * 100}%`;
    if (k < 1 && screen === 'results') requestAnimationFrame(count);
  };
  count();
  $('r-best').classList.toggle('hidden', !newBest || stars < 2);
  $('r-next').classList.toggle('hidden', n >= LEVEL_COUNT);
}

// --- buttons ---
const tapped = (id: string, fn: () => void) => $(id).addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); fn(); });
tapped('play', goMap);
tapped('endless', playEndless);
tapped('again', () => (current ? playLevel(current) : playEndless()));
tapped('home', () => (current ? goMap() : goMenu()));
tapped('exit', () => (current ? goMap() : goMenu()));
tapped('map-home', goMenu);
tapped('r-map', goMap);
tapped('r-retry', () => playLevel(current));
tapped('r-next', () => playLevel(Math.min(LEVEL_COUNT, current + 1)));
tapped('mute', () => {
  audio.setMuted(!audio.muted);
  syncMuteIcon();
  if (!audio.muted) audio.playMusic('menu');
});
function syncMuteIcon(): void {
  $('icon-sound').classList.toggle('hidden', audio.muted);
  $('icon-muted').classList.toggle('hidden', !audio.muted);
}
syncMuteIcon();

// --- swipes: one move per swipe, fired as soon as the finger has moved 24 px ---
const SWIPE_PX = 24;
let start: { x: number; y: number; id: number; fired: boolean } | null = null;
window.addEventListener('pointerdown', (e) => {
  audio.unlock();
  start = { x: e.clientX, y: e.clientY, id: e.pointerId, fired: false };
});
window.addEventListener('pointermove', (e) => {
  if (!start || start.fired || e.pointerId !== start.id) return;
  const dx = e.clientX - start.x, dy = e.clientY - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  start.fired = true;
  const move: Move = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  game.queue(move);
});
const endSwipe = () => { start = null; };
window.addEventListener('pointerup', endSwipe);
window.addEventListener('pointercancel', endSwipe);
// keyboard for testing on a computer
const keys: Record<string, Move> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
window.addEventListener('keydown', (e) => { const m = keys[e.key]; if (m) { e.preventDefault(); game.queue(m); } });
// iPad Safari: block pinch-zoom, double-tap zoom and the context menu; only the map may scroll
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (!(e.target as Element).closest?.('.scroll')) e.preventDefault(); }, { passive: false });

// --- background / foreground ---
document.addEventListener('visibilitychange', () => {
  audio.suspend(document.hidden);
  if (!document.hidden) game.resetClock();
});

// --- debug overlay (?debug=1): fps and draw calls ---
let debugEl: HTMLDivElement | null = null;
if (params.get('debug') === '1') {
  debugEl = document.createElement('div');
  debugEl.style.cssText = 'position:fixed;left:8px;bottom:8px;color:#0f0;font:14px monospace;background:#000a;padding:4px 8px;z-index:9';
  document.body.appendChild(debugEl);
  (window as unknown as { subwayRunnerDebug: () => unknown }).subwayRunnerDebug = () => ({ ...game.debugState(), screen, unlocked: progress.unlocked, totalStars: progress.totalStars });
}
let fpsFrames = 0, fpsStart = performance.now();

function loop(now: number): void {
  if (screen === 'map') game.resetClock(); // the map covers the screen: skip 3D work
  else game.frame(now);
  if (debugEl) {
    fpsFrames++;
    if (now - fpsStart >= 1000) {
      debugEl.textContent = `${fpsFrames} fps · ${game.drawCalls()} draws · ${game.renderer.getPixelRatio()}x`;
      fpsFrames = 0;
      fpsStart = now;
    }
  }
  requestAnimationFrame(loop);
}

if (Number.isInteger(levelFlag) && levelFlag >= 1 && levelFlag <= LEVEL_COUNT) playLevel(levelFlag);
else if (autoplay) playEndless();
else goMenu();
requestAnimationFrame(loop);

// Offline support: the service worker is generated by vite.config.ts at build time (not in dev).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js'); });
}
```

- [ ] **S4.8** Run `cd web && npx tsc --noEmit && npx vitest run && npm run build`. Expected: no type errors; `Tests  48 passed (48)`; the build prints `dist/sw.js`, `dist/index.html`, one `dist/assets/index-*.css` (about 11.8 kB) and one `dist/assets/index-*.js` of about **626 kB (163 kB gzip)**, then `✓ built`.
- [ ] **S4.9** Run `cd /Users/cagdas/Projects/Subway_Runner && grep -ri "surfers\|sybo" web --exclude-dir=node_modules --exclude-dir=dist || echo clean`. Expected: `clean`.
- [ ] **S4.10** Commit: `git add -A web && git commit -m "feat(web): journey map, level HUD, animated results and retry flow"`

---

### Task S5: Verify like an iPad (headless Chrome)

- [ ] **S5.1 Replace the whole file** `web/scripts/check-touch.mjs` with:

```js
// Plays the built game like an iPad: 820×1180 viewport, 2× pixels, touch events only.
// Taps PLAY (opens the journey map), drags the map to check it scrolls, taps level 1,
// swipes right, and checks the runner changed lane. Then saves a screenshot.
// Usage: node scripts/check-touch.mjs http://127.0.0.1:4391/ shot.png   (with `npx vite preview` running)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4391/';
const shotPath = process.argv[3] ?? 'touch-check.png';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-touch-'));
const port = 9334;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CHROME_FLAGS ?? '').split(' ').filter(Boolean), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = false;
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => (await Promise.race([   // give up after 20 s instead of hanging
    send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
    sleep(20000).then(() => ({ result: { result: { value: { error: 'timed out after 20 s' } } } })),
  ])).result?.result?.value;
  const touch = async (type, x, y) => send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });

  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: base + '?debug=1&seed=1' });
  await sleep(3000);
  const tap = async (selector) => {
    const p = await evaluate(`(() => { const el = document.querySelector('${selector}'); el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await touch('touchStart', p.x, p.y);
    await touch('touchEnd');
  };
  await tap('#play');
  await sleep(1500);
  const onMap = await evaluate('subwayRunnerDebug().screen');
  // drag the map down by 300 px like a finger (shows the worlds above), then check it scrolled
  const top0 = await evaluate(`document.getElementById('map-scroll').scrollTop`);
  await touch('touchStart', 410, 400);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', 410, 400 + i * 30); await sleep(16); }
  await touch('touchEnd');
  await sleep(800);
  const top1 = await evaluate(`document.getElementById('map-scroll').scrollTop`);
  console.log('map:', onMap, 'scrollTop', top0, '->', top1);
  await tap('.node[data-level="1"]');
  await sleep(1500);
  const before = await evaluate('subwayRunnerDebug()');
  // swipe right in 5 small steps, like a finger
  await touch('touchStart', 300, 700);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', 300 + i * 30, 700); await sleep(16); }
  await touch('touchEnd');
  await sleep(2500);
  const after = await evaluate('subwayRunnerDebug()');
  console.log('before swipe:', JSON.stringify(before));
  console.log('after swipe: ', JSON.stringify(after));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));
  ok = onMap === 'map' && top1 < top0 - 100 && before?.mode === 'playing' && before.level === 1 && before.lane === 1 && after?.lane === 2;
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'TOUCH CHECK PASSED' : 'TOUCH CHECK FAILED');
process.exit(ok ? 0 : 1);
```

- [ ] **S5.2 Create** `web/scripts/check-journey.mjs`:

```js
// Checks the journey screens in the built game, like an iPad (820×1180, 2× pixels):
// 1) the autopilot plays level 1 to the results card (3 stars, 70/70 coins) and the progress is saved,
// 2) the map then shows level 1 done and level 2 as next,
// 3) an idle runner on level 3 gets the "Oops!" card.
// Saves screenshots: <dir>/journey-results.png, journey-map.png, journey-crash.png
// Usage: node scripts/check-journey.mjs http://127.0.0.1:4391/ screenshots   (with `npx vite preview` running)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:4391/';
const dir = process.argv[3] ?? 'screenshots';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-journey-'));
const port = 9335;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CHROME_FLAGS ?? '').split(' ').filter(Boolean), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = false;
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
  const shot = async (name) => writeFileSync(join(dir, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  /** Polls subwayRunnerDebug() until its screen is `want` (up to 60 s; the software renderer is slow). */
  const waitScreen = async (want) => {
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      const d = await evaluate(`typeof subwayRunnerDebug === 'function' ? subwayRunnerDebug() : null`);
      if (d?.screen === want) return d;
    }
    return null;
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true });

  await send('Page.navigate', { url: base + '?level=1&autoplay=1&skip=60&debug=1' });
  const done = await waitScreen('results');
  await sleep(3500); // let the stars pop and the coins count up
  const card = await evaluate(`({ coins: document.getElementById('r-coins').textContent, cheer: document.getElementById('r-cheer').textContent,
    lit: document.querySelectorAll('#results .bs.on').length })`);
  console.log('results:', JSON.stringify(done), JSON.stringify(card));
  await shot('journey-results.png');

  await send('Page.navigate', { url: base + '?debug=1' });
  await waitScreen('menu');
  await evaluate(`document.getElementById('play').click()`);
  const map = await waitScreen('map');
  await sleep(1000);
  const nodes = await evaluate(`[1, 2, 3].map((n) => document.querySelector('.node[data-level="' + n + '"]').className)`);
  console.log('map:', JSON.stringify(map), JSON.stringify(nodes));
  await shot('journey-map.png');

  await send('Page.navigate', { url: base + '?level=3&autoplay=1&idle=1&skip=30&debug=1' });
  const crash = await waitScreen('over');
  await sleep(800);
  const title = await evaluate(`document.getElementById('over-title').textContent`);
  console.log('crash:', JSON.stringify(crash), title);
  await shot('journey-crash.png');

  ok = done?.finished === true && done.stars === 3 && card?.coins === '70/70' && card.cheer === 'PERFECT!' && card.lit === 3
    && map?.unlocked === 2 && map.totalStars === 3 && nodes?.[0] === 'node done' && nodes[1] === 'node now' && nodes[2] === 'node locked'
    && crash?.crashed === true && title === 'Oops!';
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'JOURNEY CHECK PASSED' : 'JOURNEY CHECK FAILED');
process.exit(ok ? 0 : 1);
```

- [ ] **S5.3** Run `cd web && npm run build`, then start the preview server **in the background**: `cd web && npx vite preview --port 4391 --strictPort --host 127.0.0.1`. If port 4391 is in use, use 4393 everywhere below.
- [ ] **S5.4 Screenshots.** Run from `web/`. Each shot uses a fresh browser profile (a shared profile occasionally gives a black 3D view):

```bash
mkdir -p screenshots
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
shot() { P=$(mktemp -d); "$C" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --user-data-dir=$P --window-size=$2 --virtual-time-budget=6000 --screenshot=screenshots/$1.png \
  "http://127.0.0.1:4391/$3" >/dev/null 2>&1; rm -rf $P; }
shot menu-ipad   820,1180 ""
shot level-ipad  820,1180 "?level=12&autoplay=1&skip=14"
shot run-ipad    820,1180 "?autoplay=1&seed=1&skip=13"
shot crash-ipad  820,1180 "?autoplay=1&idle=1&seed=2&skip=5"
ls -la screenshots
```

Look at each PNG (read the image). Expected:
- **menu-ipad:** the 3D city with the kid jogging; the "SUBWAY / RUNNER" title; two chips, `★ 0 / 360` and `Best 0`; a green **PLAY** button with a smaller blue **Endless run** button under it; the 3 hint tiles; and the speaker button top-right.
- **level-ipad:** the kid from behind on the track; at the top, ✕, the chip **`2-2`** and a green progress bar about a third of the way to the checkered flag; on the right, 3 star slots (the first lit gold) and a coin pill around 25.
- **run-ipad:** the endless run as before, with a SCORE capsule between 200 and 300.
- **crash-ipad:** the endless "Crash!" card with **SCORE 39**, "Play Again" and "Menu".

If a 3D view is black, run that one `shot` line again.
- [ ] **S5.5** Run `cd web && node scripts/check-touch.mjs http://127.0.0.1:4391/ screenshots/touch-ipad.png`. Expected:
  - `map: map scrollTop <A> -> <B>`, with B at least 100 smaller than A (about 450 smaller)
  - `before swipe:` with `"mode":"playing","lane":1` and `"level":1`
  - `after swipe:` with `"lane":2`
  - `TOUCH CHECK PASSED`
- [ ] **S5.6** Run `cd web && node scripts/check-journey.mjs http://127.0.0.1:4391/ screenshots`. It takes about 20 s. Expected:
  - `results: {… "level":1,"finished":true,"stars":3,"screen":"results","unlocked":2,"totalStars":3} {"coins":"70/70","cheer":"PERFECT!","lit":3}`
  - `map: {… "screen":"map","unlocked":2,"totalStars":3} ["node done","node now","node locked"]`
  - `crash: {… "crashed":true,"level":3 … "screen":"over" …} Oops!`
  - `JOURNEY CHECK PASSED`

  Then look at the three PNGs:
  - **journey-results.png:** the indigo card with ribbon `LEVEL 1-1`, three gold stars, `PERFECT!`, 3 gold golden stars, a full coin bar with `70/70`, `New best!` and the Map / Retry / Next buttons.
  - **journey-map.png:** the green "Leafy Park"-style world above the light-blue Sunny City world. Level 1 has 3 small stars, level 2 is the big pulsing node with **GO!**, and the rest show locks. The top bar shows ⌂, "Journey" and `★ 3 /360`.
  - **journey-crash.png:** the "Oops!" card with **Try Again** and **Map**.
- [ ] **S5.7** Run `cd web && node scripts/check-offline.mjs http://127.0.0.1:4391/`. Expected: `service worker: {"active":"activated",…}` with 8 files, `offline reload: {"online":false,…,"play":true,"canvas":true,…}`, then `OFFLINE CHECK PASSED`.
- [ ] **S5.8** Stop the preview server. Commit: `git add -A web && git commit -m "test(web): journey touch, results/map/crash checks and screenshots"`

---

### Task S6: Ship to the iPad (home-network HTTPS)

- [ ] **S6.1** Note the live service-worker cache name: `grep -o "subway-runner-[a-z0-9]*" "$HOME/Library/Application Support/SubwayRunner/www/sw.js"`. Write it down.
- [ ] **S6.2** Run `cd web && npm run deploy`. Expected: `Tests  48 passed (48)`, the build output, then `Deployed to …/SubwayRunner/www:` with the file list, and `Open https://Mac-Studio.local:8843/ on the iPad (home Wi-Fi).`
- [ ] **S6.3** Run the S6.1 command again. Expected: a **different** `subway-runner-…` name. That is the version bump, which makes the iPad pick up the new game the next time it opens online.
- [ ] **S6.4** Run `curl -s -o /dev/null -w "%{http_code}\n" --cacert "$(mkcert -CAROOT)/rootCA.pem" https://localhost:8843/`. Expected: `200`. If not, restart the server with `launchctl kickstart -k gui/$(id -u)/com.cagdasatici.subwayrunner`, wait 2 s and retry once.
- [ ] **S6.5 Checks over HTTPS** (pin the certificate; headless Chrome can't use `.local`):

```bash
cd /Users/cagdas/Projects/Subway_Runner/web
SPKI=$(openssl x509 -in "$HOME/Library/Application Support/SubwayRunner/certs/cert.pem" -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64)
CHROME_FLAGS="--ignore-certificate-errors-spki-list=$SPKI" node scripts/check-offline.mjs https://localhost:8843/
CHROME_FLAGS="--ignore-certificate-errors-spki-list=$SPKI" node scripts/check-touch.mjs https://localhost:8843/ screenshots/touch-https.png
CHROME_FLAGS="--ignore-certificate-errors-spki-list=$SPKI" node scripts/check-journey.mjs https://localhost:8843/ /tmp
```

Expected: `OFFLINE CHECK PASSED`, `TOUCH CHECK PASSED`, `JOURNEY CHECK PASSED`. The last one writes its screenshots to `/tmp`, so they don't replace the committed ones.
- [ ] **S6.6** Run `cd /Users/cagdas/Projects/Subway_Runner && git status --short | grep -i pem || echo "no keys in repo"`. Expected: `no keys in repo`.
- [ ] **S6.7** Commit (the HTTPS touch screenshot): `git add -A web && git commit -m "chore(web): ship journey stage 1 to the home server"`. If there's nothing to commit, skip this step.
- [ ] **S6.8 STOP** and report:
  - the commits
  - the test count
  - the screenshot paths
  - the old and new service-worker cache names
  - the results of S5.5–S5.7 and S6.4–S6.5
  - anything that differed or was skipped

  Then tell the human: "Open Subway Runner on the iPad while on home Wi-Fi, close it, and open it again; PLAY now opens the journey map."
