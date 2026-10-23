# Subway Runner Web (iPad Home-Screen app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web version of Subway Runner that plays the same as the iOS app. The kid opens it on an **iPad** from the Home Screen, where it runs full-screen and offline. It's served privately from this Mac Studio over home-Wi-Fi HTTPS, which avoids the Apple Developer Program, App Review and re-signing, and nothing is public.

**Architecture:** A new `web/` folder in this repo. The native iOS app (`App/`, `GameCore/`, `project.yml`) is **not touched**.
- **Game logic:** `web/src/core/*.ts` is a one-to-one TypeScript port of `GameCore`. Swift `Double` and JS `number` are both IEEE-754, so the same order of operations gives identical results. The 64-bit RNG uses `BigInt`. The XCTest suite is ported to Vitest **with the same names and values** (idle crash on seed 2 at tick 467 = score 39; autopilot seed 1 golden 1899.958333 m / 252 coins / 4419).
- **Rendering:** Three.js ports the new iOS look (character, city, trains, coins, particles). Each 18 m segment's geometry is merged per material, coins are instanced, and there's one 1024² shadow map.
- **UI:** HTML/CSS overlays in the same chunky style.
- **Audio:** synthesised with Web Audio (a port of `make_audio.swift`).
- **Offline:** a generated service worker precaches every file, plus a web manifest and Apple Home-Screen meta tags.
- **Hosting:** private, on the home network only. This Mac Studio serves the built game over HTTPS on port **8843**:
  - a small dependency-free Node `https` server (`serve-https.mjs`), with certificates from `mkcert`
  - kept running by a `launchd` LaunchAgent
  - the site and certificates live in `~/Library/Application Support/SubwayRunner/` (outside the repo)

  Nothing is published to the internet.

**Tech Stack (exact pins):** three 0.186.1, @types/three 0.186.0, vite 8.3.5, vitest 5.0.5, typescript 7.0.2. Node v26.10.0 and npm 11.19.1 are installed. Google Chrome 155 (installed) is used headless for checks.

**Pre-verified on 2026-10-23:** every file below was built and run from a scratch copy:
- `npm test` → **29 passed**
- `npm run build` → OK, with one JS file of about 147 kB gzipped
- headless-Chrome screenshots at iPad portrait 820×1180, iPad Pro 1024×1366 and landscape 1180×820 (menu, run, crash = "Score 39")
- a touch-only swipe check (lane 1 → 2) passes
- an offline check passes (service worker active, 8 files cached, page reloads with the network off), including when served from a sub-path
- the HTTPS server returns 200 at `https://Mac-Studio.local:8843/`, at both LAN IPs and at `localhost`, with correct MIME types and `no-cache` on `sw.js`/html/manifest; `../` escapes return 404
- the offline and touch checks pass over HTTPS
- the LaunchAgent install, `kickstart -k` restart, restart-after-kill and uninstall were tested under a throwaway label (since removed)

Port 8443 was **already in use** on this Mac, which is why the plan uses 8843. mkcert itself (1.4.4 via Homebrew) wasn't installed during pre-verification; its commands below are the standard ones.

The game ran at 61 fps with about 230 draw calls in Chrome on this Mac. Copy the code exactly.

---

## Executor Rules (read first, follow literally)

1. Work in `/Users/cagdas/Projects/Subway_Runner/web` (create it). Paths below are relative to `web/` unless they start with `../`. **Don't modify anything outside `web/`**, except the commit of this plan file. Never touch `/Users/cagdas/Projects/First_Game`.
2. Do the tasks in order. Run every "Run" step and compare with "Expected". If it differs, fix it within the task. Never weaken or delete a test.
3. Copy every file **exactly**: names, numbers, colours. Don't add dependencies or change versions.
4. If a step still fails after 3 fix attempts, stop and report the exact command and output.
5. Commit at the end of each task with exactly the given message, from the repo root (`cd /Users/cagdas/Projects/Subway_Runner`). **Never push. Never create any GitHub repo or publish anything.** The game is served only on the home network.
6. The game's name is **Subway Runner**. Never use the names "Subway Surfers", "SYBO", "Jake", "Tricky", "Fresh", "hoverboard" or "Inspector", or that game's art or sounds.
7. Long-running commands: run the preview server in the background. Run the others with a 10-minute timeout.
8. Don't use the in-app browser pane for checks: it throttles hidden pages and blocks service workers (verified). Use the headless-Chrome scripts in Task W6.
9. **Never run `mkcert -install`**, and never change macOS trust, firewall, Energy or sleep settings. The Mac doesn't need to trust the certificate; checks use the root certificate file directly. Never copy, print or commit `rootCA-key.pem` (the CA private key).

## Product Spec (same as iOS unless noted)

- Same rules, constants, track generator, scoring, autopilot and launch flags as the iOS app. Flags are URL parameters:
  - `?autoplay=1`: the bot steers
  - `?idle=1`: with autoplay, never steers (crashes at score 39 on seed 2)
  - `?seed=N`
  - Testing only: `?skip=S` fast-forwards S seconds of autoplay before the first frame; `?debug=1` shows fps and draw calls and exposes the read-only `subwayRunnerDebug()`.
- **Controls:** swipe left/right/up/down (it fires once the finger has moved 24 px). Taps don't move the runner. Arrow keys / WASD also work on a computer.
- **Orientation:** works in portrait **and** landscape. iPad Home-Screen web apps can't lock orientation, so it adapts.
- **Audio:** starts on the first tap (Safari rule). It respects the silent switch where Safari supports `navigator.audioSession`. The mute setting is saved in `localStorage` key `muted`. The best score is in `localStorage` key `best.score`.
- **No-zoom / no-bounce:** `touch-action: none`; `user-scalable=no`; `gesturestart`, `dblclick` and `touchmove` are blocked; `overscroll-behavior: none`; safe-area insets via `env()`.
- **Performance:** device pixel ratio capped at 2. If more than 25 % of frames take over 22 ms, resolution drops in 0.25 steps down to 1×. At most 8 physics ticks per frame.
- **Offline:** a service worker (generated at build) precaches all files. A new build changes the cache name, so the iPad updates the next time it opens the game online.

## File Structure

```
web/package.json, web/package-lock.json (generated), web/tsconfig.json, web/vite.config.ts, web/.gitignore
web/index.html                      # screens: menu, HUD, crash card; Apple Home-Screen meta tags
web/public/manifest.webmanifest     # PWA manifest
web/public/icons/{apple-touch-icon,icon-192,icon-512}.png   # resized from the iOS icon
web/src/core/{rng,track,runner,autopilot,scoreStore}.ts     # 1:1 port of GameCore
web/src/gfx/{textures,materials,shapes,character,world,coins,effects}.ts   # Three.js port of the iOS look
web/src/{audio,game,main}.ts, web/src/style.css
web/tests/{rng,track,runner,autopilot,scoreStore}.test.ts   # ported XCTest suite (29 tests)
web/scripts/check-touch.mjs, web/scripts/check-offline.mjs
web/scripts/serve-https.mjs        # static HTTPS server (copied to the site folder by deploy)
web/scripts/deploy-local.sh        # npm run deploy: test + build + copy to the site folder
web/scripts/install-service.sh, web/scripts/uninstall-service.sh   # LaunchAgent
~/Library/Application Support/SubwayRunner/{www/, certs/, serve-https.mjs}   # outside the repo, never committed
~/Library/LaunchAgents/com.cagdasatici.subwayrunner.plist, ~/Library/Logs/SubwayRunner/server.log
web/screenshots/*.png               # Task W6 evidence
```

---

### Task W0: Scaffold

- [ ] **W0.1** Run `cd /Users/cagdas/Projects/Subway_Runner && git status --short`. Expected: no output, or only this plan file. Run `mkdir -p web/src/core web/src/gfx web/tests web/scripts web/public/icons`.
- [ ] **W0.2** Create `web/package.json`:

```json
{
  "name": "subway-runner-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "deploy": "scripts/deploy-local.sh"
  },
  "dependencies": {
    "three": "0.186.1"
  },
  "devDependencies": {
    "@types/three": "0.186.0",
    "typescript": "7.0.2",
    "vite": "8.3.5",
    "vitest": "5.0.5"
  }
}
```

- [ ] **W0.3** Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **W0.4** Create `web/.gitignore`:

```
node_modules/
dist/
*.pem
```

- [ ] **W0.5** Run `cd web && npm install --no-audit --no-fund`. Expected: `added 45 packages` (the number may vary slightly). Then run `npx tsc --version && npx vite --version && npx vitest --version`. Expected: `Version 7.0.2`, `vite/8.3.5 …` and `vitest/5.0.5 …`.
- [ ] **W0.6** Commit: `git add docs/superpowers/plans web && git commit -m "chore(web): scaffold Vite + TypeScript + Three.js"`

---

### Task W1: Port RNG and Track (test first)

- [ ] **W1.1 Write the failing tests** `web/tests/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SplitMix64 } from '../src/core/rng';

describe('RNGTests', () => {
  it('testSplitMix64KnownValues', () => {
    const r = new SplitMix64(0n);
    expect(r.next()).toBe(0xe220a8397b1dcdafn);
    expect(r.next()).toBe(0x6e789e6aa1b965f4n);
  });
  it('testIntStaysInRangeAndHitsEveryValue', () => {
    const r = new SplitMix64(42n);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3);
      expect(v >= 0 && v < 3).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
```

and `web/tests/track.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { laneX, ROW_GAP, rowZ, Track } from '../src/core/track';

describe('TrackTests', () => {
  it('testLaneX', () => {
    expect([0, 1, 2].map(laneX)).toEqual([-2.5, 0, 2.5]);
  });
  it('testSeed1FirstRows', () => {
    const t = new Track(1n);
    t.generate(120);
    expect(t.rowsGenerated).toBe(5);
    expect(t.obstacles.map((o) => o.kind)).toEqual(['bar', 'hurdle', 'hurdle', 'bar', 'train']);
    expect(t.obstacles.map((o) => o.lane)).toEqual([2, 2, 0, 0, 1]);
    expect(t.obstacles.map((o) => o.z)).toEqual([40, 58, 76, 94, 112]);
    expect(t.coins.length).toBe(25);
    expect(t.coins.slice(0, 5).map((c) => c.z)).toEqual([40, 42, 44, 46, 48]);
    expect(new Set(t.coins.slice(0, 5).map((c) => c.lane))).toEqual(new Set([0]));
  });
  it('testSameSeedSameTrack', () => {
    const a = new Track(99n);
    const b = new Track(99n);
    a.generate(2000);
    b.generate(2000);
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.coins).toEqual(b.coins);
  });
  it('testFirstThreeRowsHaveOneObstacle', () => {
    for (let seed = 1n; seed <= 50n; seed++) {
      const t = new Track(seed);
      t.generate(rowZ(2));
      expect(t.obstacles.length, `seed ${seed}`).toBe(3);
    }
  });
  it('testEveryRowLeavesAFreeLaneAndCoinsAreInAFreeLane', () => {
    for (let seed = 1n; seed <= 50n; seed++) {
      const t = new Track(seed);
      t.generate(3000);
      for (let row = 0; row < t.rowsGenerated; row++) {
        const z0 = rowZ(row);
        const lanes = t.obstacles.filter((o) => o.z === z0).map((o) => o.lane);
        expect(lanes.length >= 1 && lanes.length <= 2, `seed ${seed} row ${row}`).toBe(true);
        expect(new Set(lanes).size, `seed ${seed} row ${row}: two obstacles in one lane`).toBe(lanes.length);
        const coinLanes = new Set(t.coins.filter((c) => c.z >= z0 && c.z < z0 + ROW_GAP).map((c) => c.lane));
        expect(coinLanes.size).toBe(1);
        expect(lanes.includes([...coinLanes][0]), `seed ${seed} row ${row}: coins on an obstacle`).toBe(false);
      }
    }
  });
  it('testDropBehindForgetsPassedThings', () => {
    const t = new Track(1n);
    t.generate(120);
    t.dropBehind(60); // keeps anything whose far end is at or after z 55
    expect(t.obstacles.map((o) => o.z)).toEqual([58, 76, 94, 112]);
    expect(t.coins[0]?.z).toBe(58);
  });
});
```

- [ ] **W1.2** Run `cd web && npx vitest run`. Expected: FAIL, because the imports `../src/core/rng` and `../src/core/track` don't exist yet.
- [ ] **W1.3 Implement** `web/src/core/rng.ts`:

```ts
// One-to-one port of GameCore/Sources/GameCore/RNG.swift (SplitMix64).
// Uses BigInt because JavaScript numbers can't hold 64-bit integers exactly.
const MASK = (1n << 64n) - 1n;

export class SplitMix64 {
  state: bigint;
  constructor(seed: bigint) {
    this.state = seed & MASK;
  }
  next(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  }
  /** Integer in 0..<n (n > 0). Same as Swift `Int(next() % UInt64(n))`. */
  int(n: number): number {
    return Number(this.next() % BigInt(n));
  }
}
```

and `web/src/core/track.ts`:

```ts
// One-to-one port of GameCore/Sources/GameCore/Track.swift.
import { SplitMix64 } from './rng';

export type ObstacleKind = 'hurdle' | 'bar' | 'train';
export const OBSTACLE_KINDS: ObstacleKind[] = ['hurdle', 'bar', 'train']; // same order as Swift allCases

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  lane: number; // 0 = left, 1 = middle, 2 = right
  z: number; // near edge; far edge is z + obstacleLength(o)
}

export interface Coin {
  id: number;
  lane: number;
  z: number;
}

export const LANE_WIDTH = 2.5;
export const FIRST_ROW_Z = 40.0;
export const ROW_GAP = 18.0;
export const TRAIN_LENGTH = 10.0;
export const THIN_LENGTH = 0.5;
export const COINS_PER_ROW = 5;
export const COIN_SPACING = 2.0;
export const COIN_Y = 0.9;

export function laneX(lane: number): number {
  return (lane - 1) * LANE_WIDTH;
}
export function rowZ(row: number): number {
  return FIRST_ROW_Z + row * ROW_GAP;
}
export function obstacleLength(o: Obstacle): number {
  return o.kind === 'train' ? TRAIN_LENGTH : THIN_LENGTH;
}

export class Track {
  obstacles: Obstacle[] = [];
  coins: Coin[] = [];
  rowsGenerated = 0;
  private rng: SplitMix64;
  private nextID = 0;

  constructor(seed: bigint) {
    this.rng = new SplitMix64(seed);
  }

  /** Hand-made track for tests. Don't call generate() on it. */
  static fixed(obstacles: Obstacle[], coins: Coin[] = []): Track {
    const t = new Track(0n);
    t.obstacles = obstacles;
    t.coins = coins;
    return t;
  }

  /** Adds rows until the next row would start beyond `z`. */
  generate(upTo: number): void {
    while (rowZ(this.rowsGenerated) <= upTo) {
      this.addRow(this.rowsGenerated);
      this.rowsGenerated += 1;
    }
  }

  /** Forgets things the runner has fully passed. */
  dropBehind(z: number): void {
    this.obstacles = this.obstacles.filter((o) => !(o.z + obstacleLength(o) < z - 5));
    this.coins = this.coins.filter((c) => !(c.z < z - 5));
  }

  private addRow(row: number): void {
    const z0 = rowZ(row);
    const count = row < 3 ? 1 : 1 + this.rng.int(2); // 1 or 2 obstacles; one lane always free
    const a = this.rng.int(3);
    const lanes = [a];
    if (count === 2) lanes.push((a + 1 + this.rng.int(2)) % 3);
    for (const lane of lanes) {
      const kind = OBSTACLE_KINDS[this.rng.int(3)];
      this.obstacles.push({ id: this.nextID, kind, lane, z: z0 });
      this.nextID += 1;
    }
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    const coinLane = free[this.rng.int(free.length)];
    for (let i = 0; i < COINS_PER_ROW; i++) {
      this.coins.push({ id: this.nextID, lane: coinLane, z: z0 + i * COIN_SPACING });
      this.nextID += 1;
    }
  }
}
```

- [ ] **W1.4** Run `cd web && npx vitest run`. Expected: `Tests  8 passed (8)`.
- [ ] **W1.5** Commit: `git add -A web && git commit -m "feat(web): port seeded RNG and track generation"`

---

### Task W2: Port runner physics (test first)

- [ ] **W2.1 Write the failing test** `web/tests/runner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  height, isGrounded, isSliding, Runner, score, speedAtTick, startState, step,
  type Move, type RunnerState,
} from '../src/core/runner';
import { Track } from '../src/core/track';

const empty = Track.fixed([]);

/** Steps with 'none' (or `moveAt`'s pick the first time it returns one) until crashed or `ticks` reached. */
function run(track: Track, ticks: number, moveAt?: (s: RunnerState) => Move | null, from: RunnerState = startState()): RunnerState {
  let s = from;
  let used = false;
  for (let i = 0; i < ticks && !s.crashed; i++) {
    let m: Move = 'none';
    if (!used && moveAt) {
      const pick = moveAt(s);
      if (pick !== null) { m = pick; used = true; }
    }
    s = step(s, m, track);
  }
  return s;
}

describe('RunnerTests', () => {
  it('testSpeedRamp', () => {
    expect(speedAtTick(0)).toBe(10);
    expect(speedAtTick(1200)).toBeCloseTo(11, 9);
    expect(speedAtTick(12000)).toBe(20);
    expect(speedAtTick(50000)).toBe(20);
  });
  it('testRunsForwardOnEmptyTrack', () => {
    const s = run(empty, 12000);
    expect(Math.abs(s.z - 1499.958333)).toBeLessThan(1e-5);
    expect(s.crashed).toBe(false);
    expect(isGrounded(s)).toBe(true);
  });
  it('testJumpArc', () => {
    let s = step(startState(), 'up', empty);
    let ticks = 1;
    let peak = 0;
    while (!isGrounded(s)) { peak = Math.max(peak, s.y); s = step(s, 'none', empty); ticks += 1; }
    expect(ticks).toBe(72);
    expect(peak).toBeCloseTo(1.3125, 9);
  });
  it('testCannotDoubleJump', () => {
    const up = step(startState(), 'up', empty);
    const next = step(up, 'up', empty);
    expect(next.vy).toBeLessThan(up.vy);
  });
  it('testSlideLasts72TicksAndLowersHeight', () => {
    let s = step(startState(), 'down', empty);
    expect(height(s)).toBe(0.9);
    let ticks = 1;
    while (isSliding(s)) { s = step(s, 'none', empty); ticks += 1; }
    expect(ticks).toBe(72);
    expect(height(s)).toBe(1.8);
  });
  it('testUpCancelsSlide', () => {
    const sliding = step(startState(), 'down', empty);
    const s = step(sliding, 'up', empty);
    expect(isSliding(s)).toBe(false);
    expect(s.y).toBeGreaterThan(0);
  });
  it('testDownInAirFastFalls', () => {
    const air = run(empty, 10, () => 'up');
    const s = step(air, 'down', empty);
    expect(s.vy).toBeLessThanOrEqual(-15);
    expect(isSliding(s)).toBe(true);
  });
  it('testLaneChangeTakes12TicksAndClampsAtEdges', () => {
    let s = step(startState(), 'left', empty);
    let ticks = 1;
    while (s.x !== -2.5) { s = step(s, 'none', empty); ticks += 1; }
    expect(ticks).toBe(12);
    s = step(s, 'left', empty);
    expect(s.lane).toBe(0);
    expect(s.x).toBe(-2.5);
  });
  it('testHurdleCrashesUnlessJumped', () => {
    const track = Track.fixed([{ id: 0, kind: 'hurdle', lane: 1, z: 10 }]);
    const hit = run(track, 240);
    expect(hit.crashed).toBe(true);
    expect(Math.abs(hit.z - 9.6)).toBeLessThan(0.1);
    expect(run(track, 240, (s) => (s.z >= 8 ? 'up' : null)).crashed).toBe(false);
  });
  it('testBarCrashesUnlessSlid', () => {
    const track = Track.fixed([{ id: 0, kind: 'bar', lane: 1, z: 10 }]);
    expect(run(track, 240).crashed).toBe(true);
    expect(run(track, 240, (s) => (s.z >= 8 ? 'up' : null)).crashed).toBe(true); // jumping is not enough
    expect(run(track, 240, (s) => (s.z >= 8 ? 'down' : null)).crashed).toBe(false);
  });
  it('testTrainCrashesEvenWhenJumpingButNotInOtherLane', () => {
    const track = Track.fixed([{ id: 0, kind: 'train', lane: 1, z: 10 }]);
    expect(run(track, 480, (s) => (s.z >= 8 ? 'up' : null)).crashed).toBe(true);
    expect(run(track, 480, (s) => (s.z >= 5 ? 'right' : null)).crashed).toBe(false);
  });
  it('testSwitchingIntoTrainSideCrashes', () => {
    const track = Track.fixed([{ id: 0, kind: 'train', lane: 0, z: 2 }]);
    expect(run(track, 120, (s) => (s.z >= 5 ? 'left' : null)).crashed).toBe(true);
  });
  it('testCollectsCoinsInOwnLaneOnly', () => {
    const track = Track.fixed([], [{ id: 0, lane: 1, z: 5 }, { id: 1, lane: 1, z: 7 }, { id: 2, lane: 2, z: 5 }]);
    const s = run(track, 120);
    expect(s.coins).toBe(2);
    expect(s.collected).toEqual(new Set([0, 1]));
    expect(score(s)).toBe(Math.trunc(s.z) + 20);
  });
  it('testCrashedStateIsFrozen', () => {
    const s = { ...startState(), crashed: true };
    expect(step(s, 'up', empty)).toEqual(s);
  });
  it('constants match GameCore', () => {
    expect(Runner.dt).toBe(1 / 120);
    expect(Runner.slideDuration).toBe(72);
  });
});
```

- [ ] **W2.2** Run `cd web && npx vitest run`. Expected: FAIL (`../src/core/runner` is missing).
- [ ] **W2.3 Implement** `web/src/core/runner.ts`. Keep the step order exactly:

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

export function startState(): RunnerState {
  return { tick: 0, z: 0, lane: 1, x: 0, y: 0, vy: 0, slideTicks: 0, coins: 0, collected: new Set(), crashed: false };
}
export function cloneState(s: RunnerState): RunnerState {
  return { ...s, collected: new Set(s.collected) };
}

export const isGrounded = (s: RunnerState): boolean => s.y === 0 && s.vy === 0;
export const isSliding = (s: RunnerState): boolean => s.slideTicks > 0;
export const height = (s: RunnerState): number => (isSliding(s) ? Runner.slideHeight : Runner.standHeight);
export const speedOf = (s: RunnerState): number => speedAtTick(s.tick);
export const score = (s: RunnerState): number => Math.trunc(s.z) + s.coins * Runner.coinValue;

export function speedAtTick(t: number): number {
  return Math.min(Runner.maxSpeed, Runner.startSpeed + Runner.acceleration * t * Runner.dt);
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

export function step(prev: RunnerState, move: Move, track: Track): RunnerState {
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
  s.z += speedAtTick(s.tick) * Runner.dt;
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
    if (
      Math.abs(s.x - laneX(c.lane)) < Runner.coinReach &&
      Math.abs(s.z - c.z) < Runner.coinReach &&
      s.y <= COIN_Y &&
      COIN_Y <= s.y + h
    ) {
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

- [ ] **W2.4** Run `cd web && npx vitest run`. Expected: `Tests  23 passed (23)`.
- [ ] **W2.5** Commit: `git add -A web && git commit -m "feat(web): port runner physics and run session"`

---

### Task W3: Port autopilot and score storage (test first)

- [ ] **W3.1 Write the failing tests** `web/tests/autopilot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { autopilotMove } from '../src/core/autopilot';
import { RunSession, score } from '../src/core/runner';

describe('AutopilotTests', () => {
  it('testIdleRunnerCrashesOnSeed2', () => {
    const g = new RunSession(2n);
    while (!g.state.crashed && g.state.tick < 20000) g.tick('none');
    expect(g.state.crashed).toBe(true);
    expect(g.state.tick).toBe(467);
    expect(score(g.state)).toBe(39); // the iOS crash screenshot shows "Score 39"
  });
  it('testAutopilotSurvivesTwoMinutesOnSeeds1to20', () => {
    for (let seed = 1n; seed <= 20n; seed++) {
      const g = new RunSession(seed);
      while (!g.state.crashed && g.state.tick < 14400) g.tick(autopilotMove(g.state, g.track));
      expect(g.state.crashed, `seed ${seed} crashed at z ${g.state.z}`).toBe(false);
    }
  });
  it('testAutopilotSeed1Golden', () => {
    const g = new RunSession(1n);
    while (g.state.tick < 14400) g.tick(autopilotMove(g.state, g.track));
    expect(Math.abs(g.state.z - 1899.958333)).toBeLessThan(1e-4);
    expect(g.state.coins).toBe(252);
    expect(score(g.state)).toBe(4419);
  });
});
```

and `web/tests/scoreStore.test.ts`:

```ts
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
```

- [ ] **W3.2** Run `cd web && npx vitest run`. Expected: FAIL (`autopilot` / `scoreStore` are missing).
- [ ] **W3.3 Implement** `web/src/core/autopilot.ts`:

```ts
// One-to-one port of GameCore/Sources/GameCore/Autopilot.swift.
import { isGrounded, Runner, speedOf, type Move, type RunnerState } from './runner';
import { obstacleLength, type Track } from './track';

export function autopilotMove(s: RunnerState, track: Track): Move {
  const speed = speedOf(s);
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
```

and `web/src/core/scoreStore.ts`:

```ts
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
```

- [ ] **W3.4** Run `cd web && npx vitest run`. Expected: `Test Files  5 passed (5)` and `Tests  29 passed (29)`. If a golden value fails (tick 467 / score 39 / 252 / 4419), the port differs from Swift. Compare it line by line with `../GameCore/Sources/GameCore/*.swift`. Don't change the numbers.
- [ ] **W3.5** Commit: `git add -A web && git commit -m "feat(web): port autopilot and score store; 29 tests"`

---

### Task W4: Graphics (Three.js port of the iOS look)

- [ ] **W4.1** Create `web/src/gfx/textures.ts`:

```ts
// Port of App/Textures.swift: every image is drawn in code with Canvas 2D (no downloaded art).
import * as THREE from 'three';

export const hex = (v: number, a = 1): string =>
  `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;

/** Fixed-seed noise so textures look the same on every load. */
function noise(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 8) / 16777216;
  };
}

function canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  draw(el.getContext('2d')!);
  return el;
}

function texture(el: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Sky: deep blue top → warm horizon → pink haze, with small clouds just above the horizon. Equirectangular. */
export function skyTexture(): THREE.Texture {
  const el = canvas(1024, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, hex(0x1d4ed8));
    g.addColorStop(0.3, hex(0x38bdf8));
    g.addColorStop(0.44, hex(0xbae6fd));
    g.addColorStop(0.5, hex(0xfde68a));
    g.addColorStop(1, hex(0xfbcfe8));
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 512);
    const n = noise(7);
    c.fillStyle = hex(0xffffff, 0.7);
    for (let i = 0; i < 18; i++) {
      const x = n() * 1024, y = 196 + n() * 44, r = 6 + n() * 10;
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.ellipse(x + k * r * 1.1 + r * 1.2, y - (k % 2) * r * 0.4 + r * 0.45, r * 1.2, r * 0.45, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
  const t = texture(el);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

export function gravelTexture(): THREE.Texture {
  return texture(
    canvas(256, 256, (c) => {
      c.fillStyle = hex(0x6b6f76);
      c.fillRect(0, 0, 256, 256);
      const n = noise(11);
      for (let i = 0; i < 1800; i++) {
        const v = Math.round((0.35 + n() * 0.45) * 255);
        c.fillStyle = `rgb(${v},${v},${v})`;
        const r = 2 + n() * 5;
        c.beginPath();
        c.ellipse(n() * 256, n() * 256, r / 2, r * 0.4, 0, 0, Math.PI * 2);
        c.fill();
      }
    }),
    true,
  );
}

export function woodTexture(): THREE.Texture {
  return texture(
    canvas(256, 64, (c) => {
      c.fillStyle = hex(0x7c4a21);
      c.fillRect(0, 0, 256, 64);
      const n = noise(3);
      for (let i = 0; i < 40; i++) {
        c.strokeStyle = hex(n() > 0.5 ? 0x5b3416 : 0x96612f, 0.7);
        c.lineWidth = 1 + n() * 2;
        const y = n() * 64;
        c.beginPath();
        c.moveTo(0, y);
        c.bezierCurveTo(80, y + 6, 170, y - 6, 256, y + (n() - 0.5) * 10);
        c.stroke();
      }
    }),
  );
}

export const BUILDING_COLORS = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa, 0xf472b6, 0xfb923c, 0x2dd4bf];

/** Building facade: 4 floors × 4 windows; some windows lit. */
export function facadeTexture(wall: number): THREE.Texture {
  return texture(
    canvas(256, 256, (c) => {
      c.fillStyle = hex(wall);
      c.fillRect(0, 0, 256, 256);
      const n = noise(wall);
      for (let row = 0; row < 4; row++) {
        c.fillStyle = hex(0x000000, 0.12);
        c.fillRect(0, row * 64 + 60, 256, 4);
        for (let col = 0; col < 4; col++) {
          const x = col * 64 + 14, y = row * 64 + 12;
          c.fillStyle = hex(0xffffff, 0.85);
          c.fillRect(x - 3, y - 3, 42, 46);
          c.fillStyle = hex(n() > 0.7 ? 0xfde68a : 0x1e3a5f);
          c.fillRect(x, y, 36, 40);
          c.fillStyle = hex(0xffffff, 0.25);
          c.fillRect(x + 4, y + 4, 8, 32);
        }
      }
    }),
    true,
  );
}

/** Diagonal warning stripes. */
export function stripesTexture(a: number, b: number): THREE.Texture {
  const t = texture(
    canvas(256, 64, (c) => {
      c.fillStyle = hex(a);
      c.fillRect(0, 0, 256, 64);
      c.fillStyle = hex(b);
      for (let x = -64; x < 320; x += 64) {
        c.beginPath();
        c.moveTo(x, 64);
        c.lineTo(x + 32, 64);
        c.lineTo(x + 96, 0);
        c.lineTo(x + 64, 0);
        c.closePath();
        c.fill();
      }
    }),
    true,
  );
  t.repeat.set(2, 1);
  return t;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

/** Train side livery for the whole 10 m side. */
export function trainSideTexture(): THREE.Texture {
  return texture(
    canvas(1024, 256, (c) => {
      c.fillStyle = hex(0xf8fafc);
      c.fillRect(0, 0, 1024, 256);
      c.fillStyle = hex(0x1e40af);
      c.fillRect(0, 52, 1024, 70);
      for (let i = 0; i < 9; i++) {
        const x = 30 + i * 110;
        c.fillStyle = hex(0x93c5fd);
        roundRect(c, x, 60, 80, 54, 10);
        c.fillStyle = hex(0xffffff, 0.5);
        c.fillRect(x + 8, 66, 14, 42);
      }
      c.fillStyle = hex(0xef4444);
      c.fillRect(0, 140, 1024, 22);
      c.fillStyle = hex(0xfacc15);
      c.fillRect(0, 166, 1024, 6);
      c.strokeStyle = hex(0x94a3b8);
      c.lineWidth = 5;
      for (const d of [300, 700]) c.strokeRect(d, 40, 70, 170);
      c.fillStyle = hex(0x475569);
      c.fillRect(0, 214, 1024, 42);
    }),
  );
}

/** Train front: windscreen, sign, stripes, lamp housings. */
export function trainFrontTexture(): THREE.Texture {
  return texture(
    canvas(256, 384, (c) => {
      c.fillStyle = hex(0xf8fafc);
      c.fillRect(0, 0, 256, 384);
      c.fillStyle = hex(0x0f172a);
      roundRect(c, 26, 60, 204, 120, 22);
      c.fillStyle = hex(0x60a5fa, 0.5);
      c.fillRect(40, 72, 40, 96);
      c.fillStyle = hex(0x111827);
      c.fillRect(60, 20, 136, 30);
      c.fillStyle = hex(0xf59e0b);
      c.fillRect(72, 28, 112, 14);
      c.fillStyle = hex(0xef4444);
      c.fillRect(0, 210, 256, 30);
      c.fillStyle = hex(0x1e40af);
      c.fillRect(0, 244, 256, 10);
      c.fillStyle = hex(0x334155);
      for (const x of [58, 198]) { c.beginPath(); c.ellipse(x, 290, 28, 20, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = hex(0x475569);
      c.fillRect(0, 330, 256, 54);
    }),
  );
}

/** Soft white dot for particles (with alpha). */
export function dotTexture(): THREE.Texture {
  return texture(
    canvas(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }),
  );
}
```

- [ ] **W4.2** Create `web/src/gfx/materials.ts`:

```ts
// Port of App/Materials.swift. Shared materials keep draw cost low.
// Lambert (cheap) for most things; Standard (PBR) only where shine matters (rails, coins, train).
import * as THREE from 'three';
import * as T from './textures';

const lambert = (color: number, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
const std = (color: number, roughness: number, metalness: number, emissive = 0x000000) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive });
const mapped = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });

export function createMaterials() {
  return {
    // character
    skin: lambert(0xf2c29b),
    hoodie: lambert(0x14b8a6),
    pants: lambert(0x1e3a8a),
    cap: lambert(0xef4444),
    shoe: lambert(0xf8fafc),
    sole: lambert(0xf97316),
    backpack: lambert(0xf59e0b),
    eyeWhite: lambert(0xffffff),
    pupil: lambert(0x111827),
    hair: lambert(0x5b3a1e),
    cheek: lambert(0xf9a8a8),
    // track and city
    gravel: mapped(T.gravelTexture()),
    wood: mapped(T.woodTexture()),
    rail: std(0xcbd5e1, 0.3, 0.9),
    railBase: lambert(0x57534e),
    concrete: lambert(0xd6d3d1),
    curbStripe: lambert(0xfacc15),
    roof: lambert(0x475569),
    pole: lambert(0x334155),
    lamp: lambert(0xfff7d6, 0xffe9a8),
    leaf: lambert(0x22c55e),
    trunk: lambert(0x92400e),
    grass: lambert(0x4ade80),
    facades: T.BUILDING_COLORS.map((c) => mapped(T.facadeTexture(c))),
    // obstacles
    hurdleStripes: mapped(T.stripesTexture(0xef4444, 0xffffff)),
    barStripes: mapped(T.stripesTexture(0xfacc15, 0x111827)),
    darkMetal: lambert(0x1f2937),
    warning: lambert(0xef4444, 0xff3b3b),
    trainSide: new THREE.MeshStandardMaterial({ map: T.trainSideTexture(), roughness: 0.4, metalness: 0.1 }),
    trainFront: new THREE.MeshStandardMaterial({ map: T.trainFrontTexture(), roughness: 0.4, metalness: 0.1 }),
    trainRoof: lambert(0xcbd5e1),
    trainBottom: lambert(0x1f2937),
    headlight: lambert(0xffffff, 0xfff3c4),
    wheel: lambert(0x111827),
    // coins
    gold: std(0xfbbf24, 0.25, 0.9, 0x5c3d00),
    goldDark: std(0xd97706, 0.3, 0.9, 0x3a2600),
  };
}
export type Materials = ReturnType<typeof createMaterials>;
```

- [ ] **W4.3** Create `web/src/gfx/shapes.ts`:

```ts
// Port of the SCNNode helpers in App/Materials.swift. Sizes use SceneKit's meaning:
// box(w, h, l), capsule(radius, TOTAL height), sphere(r), cylinder(r, h).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function boxGeo(w: number, h: number, l: number, chamfer = 0): THREE.BufferGeometry {
  return chamfer > 0 ? new RoundedBoxGeometry(w, h, l, 2, chamfer) : new THREE.BoxGeometry(w, h, l);
}
export const capsuleGeo = (r: number, h: number) => new THREE.CapsuleGeometry(r, Math.max(0, h - 2 * r), 4, 12);
export const sphereGeo = (r: number) => new THREE.SphereGeometry(r, 20, 14);
export const cylinderGeo = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 24);

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
```

- [ ] **W4.4** Create `web/src/gfx/character.ts`:

```ts
// Port of App/Character.swift: a cartoon kid built from primitives, posed every frame.
// Faces -z (the running direction). Feet touch y = 0 when standing.
// Rotation sign guide: a positive x-rotation swings a hanging limb forward (-z); knees bend with negative values.
import * as THREE from 'three';
import { isGrounded, isSliding, Runner, startState, type RunnerState } from '../core/runner';
import { laneX } from '../core/track';
import type { Materials } from './materials';
import { boxGeo, capsuleGeo, cylinderGeo, mesh, sphereGeo } from './shapes';

const SPIN_HEIGHT = 0.55;
const HIP_HEIGHT = 0.88;

type Pair = [number, number];

export class RunnerFigure {
  readonly root = new THREE.Group();
  private spin = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private shoulder = [new THREE.Group(), new THREE.Group()];
  private elbow = [new THREE.Group(), new THREE.Group()];
  private hip = [new THREE.Group(), new THREE.Group()];
  private knee = [new THREE.Group(), new THREE.Group()];

  constructor(m: Materials) {
    this.root.add(this.spin);
    this.spin.position.y = SPIN_HEIGHT;
    this.spin.add(this.hips);
    this.hips.position.y = HIP_HEIGHT - SPIN_HEIGHT;

    // legs: hip → thigh → knee → shin → shoe
    [-0.15, 0.15].forEach((x, i) => {
      const hip = this.hip[i], knee = this.knee[i];
      hip.position.set(x, -0.02, 0);
      this.hips.add(hip);
      hip.add(mesh(capsuleGeo(0.12, 0.46), m.pants, 0, -0.2, 0));
      knee.position.y = -0.4;
      hip.add(knee);
      knee.add(mesh(capsuleGeo(0.105, 0.42), m.pants, 0, -0.18, 0));
      knee.add(mesh(boxGeo(0.22, 0.12, 0.36, 0.05), m.shoe, 0, -0.4, -0.06));
      knee.add(mesh(boxGeo(0.23, 0.04, 0.37), m.sole, 0, -0.46, -0.06));
    });

    // torso (hoodie) with backpack on the back (+z)
    this.hips.add(this.torso);
    this.torso.add(mesh(boxGeo(0.62, 0.64, 0.4, 0.16), m.hoodie, 0, 0.32, 0));
    this.torso.add(mesh(boxGeo(0.5, 0.52, 0.22, 0.09), m.backpack, 0, 0.36, 0.28));
    this.torso.add(mesh(boxGeo(0.36, 0.14, 0.06), m.sole, 0, 0.24, 0.4));
    this.torso.add(mesh(capsuleGeo(0.05, 0.6), m.sole, -0.18, 0.4, 0.18));
    this.torso.add(mesh(capsuleGeo(0.05, 0.6), m.sole, 0.18, 0.4, 0.18));

    // head: face, hair, cap, eyes, cheeks, nose, smile
    const h = this.head;
    h.position.y = 0.86;
    this.torso.add(h);
    h.add(mesh(sphereGeo(0.33), m.skin));
    const hair = mesh(sphereGeo(0.345), m.hair, 0, 0.03, 0.04);
    hair.scale.y = 0.8;
    h.add(hair);
    const capTop = mesh(sphereGeo(0.355), m.cap, 0, 0.1, 0);
    capTop.scale.y = 0.62;
    h.add(capTop);
    const brim = mesh(cylinderGeo(0.24, 0.04), m.cap, 0, 0.1, -0.3);
    brim.scale.z = 0.75;
    h.add(brim);
    for (const x of [-0.12, 0.12]) {
      h.add(mesh(sphereGeo(0.085), m.eyeWhite, x, 0.05, -0.27));
      h.add(mesh(sphereGeo(0.045), m.pupil, x, 0.05, -0.345));
      h.add(mesh(sphereGeo(0.06), m.cheek, x * 1.7, -0.08, -0.25));
    }
    h.add(mesh(sphereGeo(0.05), m.skin, 0, -0.04, -0.33));
    const mouth = mesh(capsuleGeo(0.022, 0.14), m.pupil, 0, -0.15, -0.3);
    mouth.rotation.z = Math.PI / 2;
    h.add(mouth);
    for (const x of [-0.075, 0.075]) {
      const corner = mesh(capsuleGeo(0.02, 0.07), m.pupil, x, -0.13, -0.295);
      corner.rotation.z = x > 0 ? 0.9 : -0.9;
      h.add(corner);
    }

    // arms: shoulder → upper arm → elbow → forearm → hand
    [-0.42, 0.42].forEach((x, i) => {
      const sh = this.shoulder[i], el = this.elbow[i];
      sh.position.set(x, 0.56, 0);
      this.torso.add(sh);
      sh.add(mesh(capsuleGeo(0.095, 0.38), m.hoodie, 0, -0.16, 0));
      el.position.y = -0.33;
      sh.add(el);
      el.add(mesh(capsuleGeo(0.085, 0.32), m.hoodie, 0, -0.13, 0));
      el.add(mesh(sphereGeo(0.1), m.skin, 0, -0.32, 0));
    });
    this.root.traverse((o) => { o.castShadow = true; });
  }

  /** Poses the figure for this frame from the game state. */
  pose(s: RunnerState): void {
    this.root.position.set(s.x, s.y, -s.z);
    this.root.rotation.z = Math.max(-0.35, Math.min(0.35, -(laneX(s.lane) - s.x) * 0.18));

    if (s.crashed) {
      this.spin.rotation.set(1.35, 0, 0.2); // falls backwards
      this.spin.position.y = SPIN_HEIGHT * 0.5;
      this.limbs([0.9, 0.4], [-0.6, -0.9], [2.6, 2.4], [0.3, 0.3], 0);
      return;
    }
    this.spin.position.y = SPIN_HEIGHT;
    this.spin.rotation.z = 0;

    if (isSliding(s)) {
      // roll: tuck into a ball and spin forward
      this.spin.rotation.x = -s.slideTicks * Runner.dt * 18;
      this.limbs([2.1, 2.1], [-2.3, -2.3], [1.6, 1.6], [1.6, 1.6], -0.5);
      return;
    }
    this.spin.rotation.x = 0;

    if (!isGrounded(s)) {
      const up = s.vy > 0; // jump: knees tucked, arms thrown up
      this.limbs([up ? 1.3 : 0.7, up ? 0.5 : 0.9], [-1.6, -1.2], [up ? 2.7 : 2.0, up ? 2.4 : 2.2], [0.4, 0.4], -0.1);
      return;
    }

    // run cycle: one stride every 2.6 m
    const p = (s.z / 2.6) * 2 * Math.PI;
    const swing = Math.sin(p);
    this.hips.position.y = HIP_HEIGHT - SPIN_HEIGHT + Math.abs(Math.cos(p)) * 0.07;
    this.limbs(
      [0.9 * swing, -0.9 * swing],
      [-0.2 - 1.1 * Math.max(0, -Math.cos(p)), -0.2 - 1.1 * Math.max(0, Math.cos(p))],
      [-0.8 * swing, 0.8 * swing],
      [1.3, 1.3],
      -0.18,
    );
  }

  /** Menu: jogging in place at the origin. */
  menuPose(time: number): void {
    const s = startState();
    s.z = time * 6;
    this.pose(s);
    this.root.position.set(0, 0, 0);
  }

  private limbs(hip: Pair, knee: Pair, shoulder: Pair, elbow: Pair, lean: number): void {
    for (let i = 0; i < 2; i++) {
      this.hip[i].rotation.x = hip[i];
      this.knee[i].rotation.x = knee[i];
      this.shoulder[i].rotation.x = shoulder[i];
      this.elbow[i].rotation.x = elbow[i];
    }
    this.torso.rotation.x = lean;
  }
}
```

- [ ] **W4.5** Create `web/src/gfx/world.ts`:

```ts
// Port of App/World.swift. Pure visuals: never reads or changes game rules beyond positions.
// World → scene mapping: scene position = (x, y, -z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SplitMix64 } from '../core/rng';
import { laneX, TRAIN_LENGTH, type Obstacle } from '../core/track';
import type { Materials } from './materials';
import { boxGeo, cylinderGeo, sphereGeo } from './shapes';
import { skyTexture } from './textures';

export const SEGMENT_LENGTH = 18.0;

/** Collects transformed pieces per material, then merges each material's pieces into one mesh (few draw calls). */
class Merger {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number,
      opts: { rotX?: number; rotZ?: number; uv?: [number, number] } = {}): void {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (opts.uv) {
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * opts.uv[0], uv.getY(i) * opts.uv[1]);
    }
    if (opts.rotX) g.rotateX(opts.rotX);
    if (opts.rotZ) g.rotateZ(opts.rotZ);
    g.translate(x, y, z);
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
    if (g !== geo) geo.dispose();
  }
  build(castShadow: boolean, receiveShadow: (m: THREE.Material) => boolean): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false)!;
      list.forEach((g) => g.dispose());
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow(mat);
      group.add(m);
    }
    return group;
  }
}

/** Sky, image lighting for shiny materials, sun with shadows, soft fill light, fog. Returns the sun. */
export function setupEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): THREE.DirectionalLight {
  const sky = skyTexture();
  scene.background = sky;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(sky).texture;
  pmrem.dispose();
  scene.fog = new THREE.Fog(0xe9eef0, 45, 115);

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x8a8170, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const cam = sun.shadow.camera;
  cam.left = -14; cam.right = 14; cam.top = 14; cam.bottom = -14; cam.near = 1; cam.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  return sun;
}

/** Keeps the sun's shadow box centred just ahead of the runner. Same light direction as the iOS version. */
export function followSun(sun: THREE.DirectionalLight, x: number, sceneZ: number): void {
  sun.target.position.set(x, 0, sceneZ - 6);
  sun.position.set(x + 6.1, 16.3, sceneZ - 6 + 9.9);
}

/** One 18 m piece of track and city. Same k always gives the same piece (seeded by k, like iOS). */
export function makeSegment(k: number, m: Materials): THREE.Group {
  const len = SEGMENT_LENGTH;
  const rng = new SplitMix64(BigInt.asUintN(64, BigInt(k)) + 1000n);
  const mg = new Merger();

  mg.add(boxGeo(8.6, 0.3, len), m.gravel, 0, -0.15, -len / 2, { uv: [4, 8] });
  for (let lane = 0; lane < 3; lane++) {
    const x = laneX(lane);
    for (let z = 0.6; z < len; z += 1.2) mg.add(boxGeo(2.3, 0.1, 0.3), m.wood, x, 0.03, -z);
    for (const side of [-0.72, 0.72]) {
      mg.add(boxGeo(0.18, 0.06, len), m.railBase, x + side, 0.11, -len / 2);
      mg.add(boxGeo(0.1, 0.1, len), m.rail, x + side, 0.19, -len / 2);
    }
  }
  for (const side of [-1, 1]) {
    mg.add(boxGeo(1.4, 0.6, len), m.concrete, side * 5.0, 0.3, -len / 2);
    mg.add(boxGeo(0.18, 0.02, len), m.curbStripe, side * 4.42, 0.61, -len / 2);
    for (let lot = 0; lot < 2; lot++) {
      const zc = -(lot * 9 + 4.5);
      if (rng.int(4) === 0) {
        mg.add(boxGeo(7, 0.5, 9), m.grass, side * 9.2, 0.25, zc);
        for (let t = 0; t < 2; t++) {
          const tz = zc + (t === 0 ? -2.2 : 2.2);
          mg.add(cylinderGeo(0.18, 1.6), m.trunk, side * 7.4, 1.3, tz);
          mg.add(sphereGeo(1.25), m.leaf, side * 7.4, 2.9, tz);
          mg.add(sphereGeo(0.9), m.leaf, side * 7.4 + 0.5, 3.7, tz + 0.3);
        }
      } else {
        const h = 6 + rng.int(9); // 6…14 m
        const facade = m.facades[rng.int(m.facades.length)];
        mg.add(boxGeo(7, h, 8.6), facade, side * 9.6, h / 2, zc, { uv: [1, h / 6] });
        mg.add(boxGeo(7.4, 0.5, 9.0), m.roof, side * 9.6, h + 0.25, zc);
        if (rng.int(2) === 0) mg.add(cylinderGeo(0.9, 1.6), m.roof, side * 10.5, h + 1.3, zc + 2);
      }
    }
    if (k % 2 === 0) {
      mg.add(cylinderGeo(0.08, 4.4), m.pole, side * 4.9, 2.2, -9);
      mg.add(boxGeo(0.9, 0.08, 0.12), m.pole, side * 4.5, 4.4, -9);
      mg.add(boxGeo(0.5, 0.12, 0.3), m.lamp, side * 4.15, 4.32, -9);
    }
  }
  if (((k % 3) + 3) % 3 === 0) {
    for (const side of [-1, 1]) mg.add(boxGeo(0.25, 7.5, 0.25), m.pole, side * 4.6, 3.75, -2);
    mg.add(boxGeo(9.5, 0.2, 0.2), m.pole, 0, 7.5, -2);
  }
  const ground = new Set<THREE.Material>([m.gravel, m.wood, m.railBase, m.rail, m.concrete, m.curbStripe, m.grass]);
  const g = mg.build(false, (mat) => ground.has(mat));
  g.position.z = -k * len;
  return g;
}

export function makeObstacle(o: Obstacle, m: Materials): THREE.Group {
  const mg = new Merger();
  const extra: THREE.Mesh[] = [];
  let zCenter = o.z + 0.25;
  switch (o.kind) {
    case 'hurdle':
      for (const side of [-0.92, 0.92]) {
        mg.add(boxGeo(0.09, 1.0, 0.09), m.darkMetal, side, 0.5, 0);
        mg.add(boxGeo(0.14, 0.06, 0.5), m.darkMetal, side, 0.03, 0);
        mg.add(sphereGeo(0.07), m.warning, side, 1.04, 0);
      }
      mg.add(boxGeo(2.0, 0.42, 0.08, 0.03), m.hurdleStripes, 0, 0.76, 0);
      mg.add(boxGeo(2.0, 0.18, 0.06, 0.02), m.hurdleStripes, 0, 0.34, 0);
      break;
    case 'bar':
      for (const side of [-1.12, 1.12]) mg.add(boxGeo(0.16, 2.3, 0.16), m.darkMetal, side, 1.15, 0);
      mg.add(boxGeo(2.4, 0.95, 0.22, 0.05), m.barStripes, 0, 1.7, 0);
      for (const lx of [-0.7, 0, 0.7]) mg.add(sphereGeo(0.09), m.warning, lx, 2.25, 0);
      break;
    case 'train': {
      const L = TRAIN_LENGTH;
      zCenter = o.z + L / 2;
      // Three's box face order: +x, -x, +y, -y, +z (front, toward the runner), -z
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.0, L),
        [m.trainSide, m.trainSide, m.trainRoof, m.trainBottom, m.trainFront, m.trainFront]);
      body.position.y = 1.95;
      body.castShadow = true;
      extra.push(body);
      mg.add(boxGeo(1.2, 0.25, 3.2, 0.08), m.trainRoof, 0, 3.55, 0);
      for (const bz of [-3.2, 3.2]) {
        mg.add(boxGeo(1.9, 0.35, 2.4), m.trainBottom, 0, 0.3, bz);
        for (const wz of [-0.7, 0.7]) for (const wx of [-0.86, 0.86]) {
          mg.add(cylinderGeo(0.27, 0.12), m.wheel, wx, 0.27, bz + wz, { rotZ: Math.PI / 2 });
        }
      }
      for (const hx of [-0.72, 0.72]) mg.add(sphereGeo(0.13), m.headlight, hx, 1.05, L / 2 + 0.02);
      break;
    }
  }
  const g = mg.build(true, () => false);
  extra.forEach((e) => g.add(e));
  g.position.set(laneX(o.lane), 0, -zCenter);
  return g;
}

/** Frees a built group's geometry (materials are shared and stay). */
export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
}
```

- [ ] **W4.6** Create `web/src/gfx/coins.ts`:

```ts
// Coins drawn with two InstancedMeshes (outer disc + inner disc): 2 draw calls for every coin on screen.
import * as THREE from 'three';
import type { Coin } from '../core/track';
import { COIN_Y, laneX } from '../core/track';
import type { Materials } from './materials';

const MAX = 96;
const POP_TIME = 0.18;

export class CoinRenderer {
  readonly group = new THREE.Group();
  private outer: THREE.InstancedMesh;
  private inner: THREE.InstancedMesh;
  private pops: { x: number; z: number; id: number; t: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(mats: Materials) {
    const outerGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 28).rotateX(Math.PI / 2);
    const innerGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 24).rotateX(Math.PI / 2);
    this.outer = new THREE.InstancedMesh(outerGeo, mats.gold, MAX);
    this.inner = new THREE.InstancedMesh(innerGeo, mats.goldDark, MAX);
    for (const im of [this.outer, this.inner]) {
      im.castShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    }
  }

  /** A collected coin pops up, grows and vanishes over 0.18 s. */
  pop(c: Coin): void { this.pops.push({ x: laneX(c.lane), z: c.z, id: c.id, t: 0 }); }

  clearPops(): void { this.pops = []; }

  /** Draws `coins` (already filtered to visible, uncollected ones) spinning once per 1.2 s. */
  update(coins: Coin[], time: number, dt: number): void {
    let n = 0;
    const put = (x: number, y: number, z: number, id: number, scale: number) => {
      if (n >= MAX) return;
      this.e.set(0, (time / 1.2) * Math.PI * 2 + (id % 8) * 0.4, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(this.v.set(x, y, z), this.q, this.s.set(scale, scale, scale));
      this.outer.setMatrixAt(n, this.m);
      this.inner.setMatrixAt(n, this.m);
      n++;
    };
    for (const c of coins) put(laneX(c.lane), COIN_Y, -c.z, c.id, 1);
    this.pops = this.pops.filter((p) => (p.t += dt) < POP_TIME);
    for (const p of this.pops) {
      const k = p.t / POP_TIME;
      put(p.x, COIN_Y + 0.9 * k, -p.z - 1.5 * k, p.id, (1 + 0.7 * k) * (1 - k * k));
    }
    for (const im of [this.outer, this.inner]) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
```

- [ ] **W4.7** Create `web/src/gfx/effects.ts`:

```ts
// Port of App/Effects.swift: CPU particles drawn as one Points object per pool (1 draw call each).
import * as THREE from 'three';
import { dotTexture } from './textures';

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; age: number;
  size: number; r: number; g: number; b: number; gravity: number; }

/** A fixed-size pool of soft round particles. `additive` = glowing (sparkle, crash); otherwise normal (dust). */
export class ParticlePool {
  readonly points: THREE.Points;
  private ps: P[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;

  constructor(private max: number, additive: boolean) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTexture() }, scale: { value: 600 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform float scale; varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor, t.a * vAlpha); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** Viewport height in device pixels: keeps particle size right on any screen. */
  setScale(viewportHeightPx: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = viewportHeightPx * 0.75;
  }

  burst(x: number, y: number, z: number, count: number, o: { color: number; speed: number; life: number;
    size: number; gravity?: number; spread?: number; dir?: [number, number, number]; colorJitter?: number }): void {
    const c = new THREE.Color(o.color);
    for (let i = 0; i < count && this.ps.length < this.max; i++) {
      let vx = Math.random() * 2 - 1, vy = Math.random() * 2 - 1, vz = Math.random() * 2 - 1;
      const l = Math.hypot(vx, vy, vz) || 1;
      vx /= l; vy /= l; vz /= l;
      if (o.dir) { const s = o.spread ?? 0.4; vx = o.dir[0] + vx * s; vy = o.dir[1] + vy * s; vz = o.dir[2] + vz * s; }
      const sp = o.speed * (0.6 + Math.random() * 0.8);
      const j = o.colorJitter ?? 0;
      this.ps.push({ x, y, z, vx: vx * sp, vy: vy * sp, vz: vz * sp, life: o.life, age: 0,
        size: o.size * (0.7 + Math.random() * 0.6), gravity: o.gravity ?? 0,
        r: Math.min(1, c.r + (Math.random() - 0.5) * j), g: Math.min(1, c.g + (Math.random() - 0.5) * j), b: c.b });
    }
  }

  update(dt: number): void {
    this.ps = this.ps.filter((p) => (p.age += dt) < p.life);
    this.ps.forEach((p, i) => {
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      this.pos.set([p.x, p.y, p.z], i * 3);
      this.col.set([p.r, p.g, p.b], i * 3);
      this.size[i] = p.size;
      this.alpha[i] = 1 - p.age / p.life;
    });
    for (let i = this.ps.length; i < this.max; i++) this.alpha[i] = 0;
    const geo = this.points.geometry;
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) geo.getAttribute(name).needsUpdate = true;
    geo.setDrawRange(0, Math.max(1, this.ps.length));
  }

  clear(): void { this.ps = []; this.update(0); }
}
```

- [ ] **W4.8** Run `cd web && npx tsc --noEmit -p .`. Expected: no output (no type errors).
- [ ] **W4.9** Commit: `git add -A web && git commit -m "feat(web): Three.js graphics port"`

---

### Task W5: Audio, game loop, UI, PWA

- [ ] **W5.1** Create `web/src/audio.ts`:

```ts
// Port of scripts/make_audio.swift: music and sound effects are synthesised in code with Web Audio.
// iPad Safari only allows sound after a user gesture, so call unlock() from the first tap.

const RATE = 22050;
type Chord = [number, boolean]; // [pitch class of root, minor?]
const C: Chord = [0, false], G: Chord = [7, false], Am: Chord = [9, true], F: Chord = [5, false];
const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let lcg = 12345;
const noise = () => { lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0; return lcg / 2147483648 - 1; };

class Buf {
  s: Float32Array;
  constructor(seconds: number) { this.s = new Float32Array(Math.round(seconds * RATE)); }
  add(start: number, dur: number, amp: number, gen: (t: number) => number, env = true): void {
    const i0 = Math.round(start * RATE), n = Math.round(dur * RATE);
    for (let k = 0; k < n && i0 + k < this.s.length; k++) {
      const t = k / RATE;
      let e = 1;
      if (env) e = Math.min(1, t / 0.005, Math.max(0, (dur - t) / 0.02));
      this.s[i0 + k] += amp * e * gen(t);
    }
  }
}
const square = (f: number, duty = 0.25) => (t: number) => ((t * f) % 1 < duty ? 1 : -1);
const triangle = (f: number) => (t: number) => 4 * Math.abs(((t * f) % 1) - 0.5) - 1;
const sweep = (f0: number, f1: number, dur: number) => (t: number) => {
  const k = Math.log(f1 / f0) / dur;
  return ((f0 * (Math.exp(k * t) - 1)) / k) % 1 < 0.5 ? 1 : -1;
};

function music(bpm: number, chords: Chord[], leadAmp: number, kick: boolean): Buf {
  const beat = 60 / bpm;
  const b = new Buf(16 * 4 * beat);
  const arp = [1, 3, 5, 8, 5, 3, 5, 8, 1, 3, 5, 8, 10, 8, 5, 3];
  for (let bar = 0; bar < 16; bar++) {
    const [pc, minor] = chords[bar % 4];
    const t0 = bar * 4 * beat;
    const third = minor ? 3 : 4;
    const off = (d: number) => (d === 1 ? 0 : d === 3 ? third : d === 5 ? 7 : d === 8 ? 12 : 12 + third);
    const base = 72 + pc - (pc >= 7 ? 12 : 0);
    for (let i = 0; i < 16; i++) b.add(t0 + (i * beat) / 4, beat / 4, leadAmp, square(freq(base + off(arp[i]))));
    const bassBase = 36 + pc - (pc >= 7 ? 12 : 0);
    for (let i = 0; i < 8; i++) {
      const st = t0 + (i * beat) / 2;
      b.add(st, beat / 2, 0.22, triangle(freq(bassBase + (i % 2 === 0 ? 0 : 12))));
      b.add(st, 0.03, 0.06, (t) => noise() * Math.max(0, 1 - t / 0.03), false);
    }
    if (kick) {
      for (const bt of [0, 2]) {
        b.add(t0 + bt * beat, 0.12, 0.5, (t) => {
          const k = Math.log(45 / 150) / 0.12;
          return Math.sin((2 * Math.PI * 150 * (Math.exp(k * t) - 1)) / k) * Math.max(0, 1 - t / 0.12);
        }, false);
      }
    }
  }
  return b;
}

function makeSounds(): Record<string, Buf> {
  const crash = new Buf(0.35);
  crash.add(0, 0.35, 0.5, (t) => noise() * Math.exp(-t * 12), false);
  crash.add(0, 0.35, 0.25, sweep(400, 80, 0.35));
  const coin = new Buf(0.2);
  coin.add(0, 0.06, 0.2, square(freq(83), 0.5));
  coin.add(0.06, 0.14, 0.2, square(freq(88), 0.5));
  const jump = new Buf(0.15);
  jump.add(0, 0.15, 0.2, sweep(300, 600, 0.15));
  return {
    menu: music(100, [C, Am, F, G], 0.16 * 0.6, false),
    run: music(140, [C, G, Am, F], 0.16, true),
    crash, coin, jump,
  };
}

const MUTE_KEY = 'muted';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private musicNode: AudioBufferSourceNode | null = null;
  private wanted: string | null = null;
  muted: boolean;

  constructor() {
    let m = false;
    try { m = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked: default unmuted */ }
    this.muted = m;
    // Like the iOS app's .ambient session: respect the iPad's silent switch where Safari supports it.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  }

  /** Call from a tap/click handler. Safe to call many times. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      const sounds = makeSounds();
      for (const [name, buf] of Object.entries(sounds)) {
        const ab = this.ctx.createBuffer(1, buf.s.length, RATE);
        const data = ab.getChannelData(0);
        for (let i = 0; i < buf.s.length; i++) data[i] = Math.tanh(1.2 * buf.s[i]); // soft clip, as on iOS
        this.buffers[name] = ab;
      }
      if (this.wanted) this.playMusic(this.wanted);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  playMusic(name: string): void {
    this.wanted = name;
    this.stopMusic(false);
    if (!this.ctx || !this.master || !this.buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = true;
    src.connect(this.master);
    src.start();
    this.musicNode = src;
  }

  stopMusic(forget = true): void {
    if (forget) this.wanted = null;
    this.musicNode?.stop();
    this.musicNode = null;
  }

  sfx(name: string): void {
    if (!this.ctx || !this.master || !this.buffers[name] || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.connect(this.master);
    src.start();
  }

  /** Pause/resume everything when the app goes to the background. */
  suspend(hidden: boolean): void {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }
}
```

- [ ] **W5.2** Create `web/src/game.ts`:

```ts
// Port of App/GameController.swift + the menu backdrop: one WebGL canvas, two modes (menu, playing).
// Fixed-step loop: session.tick() runs once per Runner.dt, at most 8 ticks per frame (extra time dropped).
import * as THREE from 'three';
import { autopilotMove } from './core/autopilot';
import { isGrounded, Runner, RunSession, score, speedOf, type Move } from './core/runner';
import { COIN_Y, laneX, type Coin } from './core/track';
import { RunnerFigure } from './gfx/character';
import { CoinRenderer } from './gfx/coins';
import { ParticlePool } from './gfx/effects';
import { createMaterials, type Materials } from './gfx/materials';
import { disposeGroup, followSun, makeObstacle, makeSegment, SEGMENT_LENGTH, setupEnvironment } from './gfx/world';

const VIEW_AHEAD = 115;

export interface GameEvents {
  onScore(score: number, coins: number): void;
  onCrash(score: number, coins: number): void;
  onJump(): void;
  onCoin(): void;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(66, 1, 0.1, 160);
  private mats: Materials;
  private sun: THREE.DirectionalLight;
  private figure: RunnerFigure;
  private coins: CoinRenderer;
  private dust = new ParticlePool(160, false);
  private glow = new ParticlePool(400, true);
  private segments = new Map<number, THREE.Group>();
  private obstacleNodes = new Map<number, THREE.Group>();
  private session: RunSession | null = null;
  private mode: 'menu' | 'playing' = 'menu';
  private autoplay = false;
  private idle = false;
  private pending: Move[] = [];
  private last: number | null = null;
  private acc = 0;
  private time = 0;
  private shake = 0;
  private crashHandled = false;
  private lastScore = -1;
  private lastCoins = -1;
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
    this.scene.add(this.figure.root, this.coins.group, this.dust.points, this.glow.points);
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
    this.session = null;
    this.clearDynamic();
    this.clearSegments();
    for (let k = -7; k <= 1; k++) this.addSegment(k); // the menu camera looks back along +z
    followSun(this.sun, 0, 0);
  }

  /** `skipSeconds` fast-forwards the simulation before the first frame (for screenshots/tests; 0 in normal play). */
  startRun(seed: bigint, autoplay: boolean, idle: boolean, skipSeconds = 0): void {
    this.mode = 'playing';
    this.autoplay = autoplay;
    this.idle = idle;
    this.session = new RunSession(seed);
    this.pending = [];
    this.acc = 0;
    this.shake = 0;
    this.crashHandled = false;
    this.lastScore = this.lastCoins = -1;
    this.lastJumpTick = -100;
    this.clearDynamic();
    this.clearSegments();
    for (let i = 0; i < skipSeconds / Runner.dt && !this.session.state.crashed; i++) this.session.tick(this.nextMove());
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
    } else if (this.session) {
      if (!this.session.state.crashed) {
        this.acc += dt;
        let ticks = 0;
        while (this.acc >= Runner.dt && ticks < 8) {
          this.acc -= Runner.dt;
          ticks++;
          this.session.tick(this.nextMove());
          if (this.session.state.crashed) break;
        }
        if (ticks === 8) this.acc = 0;
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
  debugState(): { mode: string; lane: number; tick: number; score: number; crashed: boolean } {
    const s = this.session?.state;
    return { mode: this.mode, lane: s?.lane ?? -1, tick: s?.tick ?? 0, score: s ? score(s) : 0, crashed: s?.crashed ?? false };
  }

  private nextMove(): Move {
    const s = this.session!;
    if (this.autoplay) return this.idle ? 'none' : autopilotMove(s.state, s.track);
    return this.pending.shift() ?? 'none';
  }

  private report(dt: number): void {
    const s = this.session!.state;
    if (s.vy > 0 && s.tick - this.lastJumpTick > 30) { this.lastJumpTick = s.tick; this.events.onJump(); }
    if (this.lastCoins >= 0 && s.coins !== this.lastCoins) this.events.onCoin();
    const sc = score(s);
    if (sc !== this.lastScore || s.coins !== this.lastCoins) {
      this.lastScore = sc;
      this.lastCoins = s.coins;
      this.events.onScore(sc, s.coins);
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

  /** Makes scene objects match the session: adds new things, removes passed or collected ones. */
  private sync(): void {
    const s = this.session!.state, track = this.session!.track;
    const firstSeg = Math.max(-1, Math.trunc((s.z - 10) / SEGMENT_LENGTH) - 1);
    const lastSeg = Math.trunc((s.z + VIEW_AHEAD) / SEGMENT_LENGTH);
    for (let k = firstSeg; k <= lastSeg; k++) if (!this.segments.has(k)) this.addSegment(k);
    for (const [k, g] of this.segments) if (k < firstSeg) { this.scene.remove(g); disposeGroup(g); this.segments.delete(k); }

    const live = new Set<number>();
    for (const o of track.obstacles) {
      if (o.z >= s.z + VIEW_AHEAD) continue;
      live.add(o.id);
      if (!this.obstacleNodes.has(o.id)) { const g = makeObstacle(o, this.mats); this.obstacleNodes.set(o.id, g); this.scene.add(g); }
    }
    for (const [id, g] of this.obstacleNodes) if (!live.has(id)) { this.scene.remove(g); disposeGroup(g); this.obstacleNodes.delete(id); }

    const visible: Coin[] = [];
    for (const c of track.coins) {
      if (c.z >= s.z + VIEW_AHEAD) continue;
      if (s.collected.has(c.id)) {
        if (!this.popped.has(c.id)) {
          this.popped.add(c.id);
          this.coins.pop(c);
          this.glow.burst(laneX(c.lane), COIN_Y, -c.z, 16, { color: 0xfde047, speed: 3.5, life: 0.35, size: 0.16 });
        }
      } else visible.push(c);
    }
    this.coins.update(visible, this.time, this.frameDt);

    this.figure.pose(s);
    this.camera.fov = 66 + (speedOf(s) - Runner.startSpeed); // 66° → 76° as it speeds up
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

- [ ] **W5.3** Create `web/src/style.css`:

```css
/* iPad-friendly full-screen game shell: no scroll, no zoom, no text selection, safe-area aware. */
:root { --ink: #1e1b4b; --top: env(safe-area-inset-top, 0px); --bottom: env(safe-area-inset-bottom, 0px); }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #0f172a; overscroll-behavior: none;
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  font-family: ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif; }
canvas#gl { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
#vignette { position: fixed; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(15, 10, 40, 0.35) 100%); }
.hidden { display: none !important; }
svg { width: 1em; height: 1em; fill: currentColor; }

.screen { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; pointer-events: none;
  padding: calc(var(--top) + 24px) 22px calc(var(--bottom) + 40px); }
.screen button, .screen .card { pointer-events: auto; }
#menu { background: linear-gradient(rgba(30, 27, 75, 0.55), transparent 35%, transparent 65%, rgba(30, 27, 75, 0.65)); gap: 18px; }
.grow { flex: 1; }

.round { position: absolute; top: calc(var(--top) + 20px); width: 58px; height: 58px; border-radius: 50%; border: 2px solid rgba(255,255,255,.6);
  background: rgba(255, 255, 255, 0.22); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  color: #fff; font-size: 24px; display: grid; place-items: center; }
#mute { right: 22px; } #exit { left: 22px; }

.title { display: flex; flex-direction: column; align-items: center; margin-top: 70px; transform: rotate(-4deg); line-height: 0.92; }
.title span { font-size: clamp(56px, 11vmin, 104px); font-weight: 900; letter-spacing: 1px;
  color: #fff; background: linear-gradient(#fff, #fef08a); -webkit-background-clip: text; background-clip: text;
  -webkit-text-stroke: 7px var(--ink); paint-order: stroke fill; filter: drop-shadow(0 6px 0 #ea580c); }
.title.small { margin: 0 0 6px; transform: none; }
.title.small span { font-size: 60px; }

.chip { display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 20px; border-radius: 24px; color: #fff;
  font-size: 24px; font-weight: 800; background: rgba(30, 27, 75, 0.6); border: 2px solid rgba(255, 255, 255, 0.5); }
.chip .trophy { color: #fde047; }

.chunky { display: flex; align-items: center; justify-content: center; gap: 12px; width: 240px; height: 76px; border-radius: 26px;
  border: 3px solid rgba(255, 255, 255, 0.85); color: #fff; font: inherit; font-size: 30px; font-weight: 900;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.25); box-shadow: 0 7px 0 var(--base); transition: transform 0.08s, box-shadow 0.08s; }
.chunky:active { transform: translateY(6px); box-shadow: 0 1px 0 var(--base); }
.chunky.big { width: 260px; height: 92px; font-size: 38px; animation: pulse 1.6s ease-in-out infinite; }
.chunky.green { background: linear-gradient(#4ade80, #16a34a); --base: #14532d; }
.chunky.orange { background: linear-gradient(#fb923c, #ea580c); --base: #9a3412; }
.chunky.blue { background: linear-gradient(#38bdf8, #0284c7); --base: #075985; height: 64px; }
@keyframes pulse { 50% { transform: scale(1.06); } }

.hints { display: flex; gap: 14px; }
.hints div { width: 88px; height: 70px; border-radius: 18px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; color: #fff; font-size: 15px; font-weight: 800; background: rgba(30, 27, 75, 0.55); border: 2px solid rgba(255, 255, 255, 0.4); }
.hints svg { font-size: 22px; }

#hud { align-items: flex-end; }
.pills { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.pill { display: flex; align-items: center; gap: 8px; height: 54px; padding: 0 18px; border-radius: 27px;
  background: rgba(30, 27, 75, 0.55); border: 2px solid rgba(255, 255, 255, 0.5); color: #fff; }
.pill small, .stat small { font-size: 14px; font-weight: 900; opacity: 0.8; }
.pill b { font-size: 34px; font-weight: 900; font-variant-numeric: tabular-nums; }
.pill.gold { height: 46px; padding: 0 14px; border-color: rgba(253, 224, 71, 0.6); }
.pill.gold b { font-size: 28px; color: #fde047; }

.coin { display: inline-block; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #b45309;
  background: radial-gradient(circle, #fbbf24 0 34%, #d97706 35% 42%, transparent 43%), linear-gradient(#fde047, #f59e0b); }
.coin.big { width: 30px; height: 30px; }

#over { justify-content: center; background: rgba(0, 0, 0, 0.35); }
.card { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px 30px; border-radius: 36px;
  background: linear-gradient(#6366f1, #312e81); border: 4px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35); animation: pop 0.45s cubic-bezier(.34, 1.56, .64, 1); }
@keyframes pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.stat { display: flex; align-items: center; gap: 12px; color: #fff; }
.stat b { font-size: 44px; font-weight: 900; }
.stat.gold b { font-size: 30px; color: #fde047; }
.newbest { padding: 8px 18px; border-radius: 20px; background: #fde047; color: var(--ink); font-size: 24px; font-weight: 900; }
```

- [ ] **W5.4** Create `web/index.html`:

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
      <div class="chip"><svg viewBox="0 0 24 24" class="trophy"><path d="M7 3h10v3h3v2a5 5 0 0 1-4.3 4.95A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 12.95 5 5 0 0 1 4 8V6h3V3zm0 5H6a3 3 0 0 0 1 2.2V8zm10 0v2.2A3 3 0 0 0 18 8h-1z"/></svg><span>Best <b id="best">0</b></span></div>
      <div class="grow"></div>
      <button id="play" class="chunky green big"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>PLAY</button>
      <div class="hints">
        <div><svg viewBox="0 0 24 24"><path d="M3 12l5-5v3h8V7l5 5-5 5v-3H8v3z"/></svg>Lanes</div>
        <div><svg viewBox="0 0 24 24"><path d="M12 3l6 7h-4v10h-4V10H6z"/></svg>Jump</div>
        <div><svg viewBox="0 0 24 24"><path d="M12 21l-6-7h4V4h4v10h4z"/></svg>Roll</div>
      </div>
    </section>

    <section id="hud" class="screen hidden">
      <button id="exit" class="round" aria-label="Back to menu"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg></button>
      <div class="pills">
        <div class="pill"><small>SCORE</small><b id="score">0</b></div>
        <div class="pill gold"><i class="coin"></i><b id="coins">0</b></div>
      </div>
    </section>

    <section id="over" class="screen hidden">
      <div class="card">
        <div class="title small"><span>Crash!</span></div>
        <div class="stat"><small>SCORE</small><b id="over-score">0</b></div>
        <div class="stat gold"><i class="coin big"></i><b id="over-coins">0</b></div>
        <div id="newbest" class="newbest hidden">New best!</div>
        <button id="again" class="chunky orange">Play Again</button>
        <button id="home" class="chunky blue">Menu</button>
      </div>
    </section>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **W5.5** Create `web/src/main.ts`:

```ts
// Entry point: wires the DOM screens, input, audio and the game loop together.
// URL flags (mirroring the iOS launch arguments): ?autoplay=1  ?idle=1  ?seed=N
// Testing only: ?skip=S fast-forwards S seconds of play at start; ?debug=1 shows fps + draw calls.
import './style.css';
import { Audio } from './audio';
import { ScoreStore } from './core/scoreStore';
import { Game } from './game';
import type { Move } from './core/runner';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const autoplay = params.get('autoplay') === '1';
const idle = params.get('idle') === '1';
const fixedSeed = params.get('seed');
const skip = Math.min(600, Math.max(0, Number(params.get('skip')) || 0));

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; }
}
const store = new ScoreStore(safeStorage());
const audio = new Audio();

function newSeed(): bigint {
  if (fixedSeed && /^\d+$/.test(fixedSeed) && fixedSeed !== '0') return BigInt(fixedSeed);
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (BigInt(a[0]) << 32n) | BigInt(a[1] | 1);
}

const game = new Game($('gl'), {
  onScore: (score, coins) => { $('score').textContent = String(score); $('coins').textContent = String(coins); },
  onJump: () => audio.sfx('jump'),
  onCoin: () => audio.sfx('coin'),
  onCrash: (score, coins) => {
    const newBest = store.record(score);
    audio.stopMusic();
    audio.sfx('crash');
    navigator.vibrate?.(60);
    $('over-score').textContent = String(score);
    $('over-coins').textContent = String(coins);
    $('newbest').classList.toggle('hidden', !newBest);
    window.setTimeout(() => show('over'), 350);
  },
});

function show(screen: 'menu' | 'hud' | 'over'): void {
  $('menu').classList.toggle('hidden', screen !== 'menu');
  $('hud').classList.toggle('hidden', screen === 'menu');
  $('over').classList.toggle('hidden', screen !== 'over');
}

function goMenu(): void {
  game.showMenu();
  $('best').textContent = String(store.best);
  show('menu');
  audio.playMusic('menu');
}

function play(): void {
  $('score').textContent = '0';
  $('coins').textContent = '0';
  game.startRun(newSeed(), autoplay, idle, autoplay ? skip : 0);
  show('hud');
  audio.playMusic('run');
}

// --- buttons ---
const tapped = (id: string, fn: () => void) => $(id).addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); fn(); });
tapped('play', play);
tapped('again', play);
tapped('home', goMenu);
tapped('exit', goMenu);
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
// iPad Safari: block pinch-zoom, double-tap zoom and the context menu
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

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
  (window as unknown as { subwayRunnerDebug: () => unknown }).subwayRunnerDebug = () => game.debugState();
}
let fpsFrames = 0, fpsStart = performance.now();

function loop(now: number): void {
  game.frame(now);
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

if (autoplay) play(); else goMenu();
requestAnimationFrame(loop);

// Offline support: the service worker is generated by vite.config.ts at build time (not in dev).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js'); });
}
```

- [ ] **W5.6** Create `web/vite.config.ts`. It writes `dist/sw.js`:

```ts
import { defineConfig, type Plugin } from 'vite';

/**
 * Writes dist/sw.js after the build: a tiny service worker that precaches every built file,
 * so the game works offline from the iPad Home Screen. The cache name changes on every build,
 * so an update replaces the old files the next time the game is opened online.
 */
function serviceWorker(): Plugin {
  return {
    name: 'subway-runner-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['./', './index.html', ...Object.keys(bundle).map((f) => './' + f)]
        .concat(['./manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png']);
      const version = Date.now().toString(36);
      const source = `// Generated by vite.config.ts – do not edit.
const CACHE = 'subway-runner-${version}';
const FILES = ${JSON.stringify([...new Set(files)])};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) =>
    hit || fetch(e.request).catch(() => caches.match('./'))));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './', // relative paths: works at https://<user>.github.io/<repo>/ and on localhost
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  plugins: [serviceWorker()],
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **W5.7** Create `web/public/manifest.webmanifest`:

```json
{
  "name": "Subway Runner",
  "short_name": "Runner",
  "description": "A free, offline 3-lane runner. Swipe to change lanes, jump and roll.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#1e1b4b",
  "theme_color": "#1e1b4b",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **W5.8** Make the icons from the iOS icon, which has no alpha (good for Apple):

```bash
cd web
ICON=../App/Assets.xcassets/AppIcon.appiconset/icon-1024.png
sips -z 180 180 $ICON --out public/icons/apple-touch-icon.png
sips -z 192 192 $ICON --out public/icons/icon-192.png
sips -z 512 512 $ICON --out public/icons/icon-512.png
```

- [ ] **W5.9** Run `cd web && npm test && npm run build`. Expected:
  - `Tests  29 passed (29)`
  - then `✓ built in …`, listing `dist/sw.js`, `dist/index.html`, `dist/assets/index-….css` and `dist/assets/index-….js` (about 574 kB, about 147 kB gzipped)
  - no TypeScript errors

  Run `head -3 dist/sw.js`. Expected: a `FILES` list containing `"./"`, `"./index.html"`, the js, the css, `manifest.webmanifest` and the 3 icons.
- [ ] **W5.10** Commit: `git add -A web && git commit -m "feat(web): game loop, UI, audio, PWA manifest and service worker"`

---

### Task W6: Verify like an iPad (headless Chrome)

- [ ] **W6.1** Create `web/scripts/check-touch.mjs`:

```js
// Plays the built game like an iPad: 820×1180 viewport, 2× pixels, touch events only.
// Taps PLAY, swipes right, and checks the runner changed lane. Then saves a screenshot.
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
  const btn = await evaluate(`(() => { const r = document.getElementById('play').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await touch('touchStart', btn.x, btn.y);
  await touch('touchEnd');
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
  ok = before?.mode === 'playing' && before.lane === 1 && after?.lane === 2;
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'TOUCH CHECK PASSED' : 'TOUCH CHECK FAILED');
process.exit(ok ? 0 : 1);
```

- [ ] **W6.2** Create `web/scripts/check-offline.mjs`:

```js
// Proves the built game works offline: loads it in headless Chrome, waits for the service worker
// to cache everything, switches the network off, reloads, and checks the game still starts.
// Usage: node scripts/check-offline.mjs http://127.0.0.1:4391/   (with `npx vite preview` running)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:4391/';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'sr-offline-'));
const port = 9333;
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

  await send('Network.enable');
  await send('Page.navigate', { url });
  await sleep(4000);
  const sw = await evaluate(`(async () => {
    const reg = await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const files = keys.length ? (await (await caches.open(keys[0])).keys()).map((q) => new URL(q.url).pathname) : [];
    return { active: reg.active?.state, caches: keys, files };
  })()`);
  console.log('service worker:', JSON.stringify(sw));

  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Page.reload', { ignoreCache: false });
  await sleep(4000);
  const page = await evaluate(`({ online: navigator.onLine, title: document.title,
    play: !!document.getElementById('play'), canvas: !!document.querySelector('canvas#gl'),
    scripts: performance.getEntriesByType('resource').length })`);
  console.log('offline reload:', JSON.stringify(page));
  ok = sw?.active === 'activated' && sw.files.length >= 8 && page?.title === 'Subway Runner' && page.play && page.canvas;
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(ok ? 'OFFLINE CHECK PASSED' : 'OFFLINE CHECK FAILED');
process.exit(ok ? 0 : 1);
```

- [ ] **W6.3** Start the preview server **in the background**: `cd web && npx vite preview --port 4391 --strictPort --host 127.0.0.1`. If it fails with "Port 4391 is already in use", use 4393 instead, and use that port everywhere below.
- [ ] **W6.4 Screenshots.** Run this from `web/`. Each shot uses a fresh browser profile; a shared profile occasionally gives a black 3D view.

```bash
mkdir -p screenshots
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
shot() { P=$(mktemp -d); "$C" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --user-data-dir=$P --window-size=$2 --virtual-time-budget=3000 --screenshot=screenshots/$1.png \
  "http://127.0.0.1:4391/$3" >/dev/null 2>&1; rm -rf $P; }
shot menu-ipad      820,1180  ""
shot menu-ipadpro   1024,1366 ""
shot run-ipad       820,1180  "?autoplay=1&seed=1&skip=13"
shot crash-ipad     820,1180  "?autoplay=1&idle=1&seed=2&skip=5"
shot run-landscape  1180,820  "?autoplay=1&seed=1&skip=40"
ls -la screenshots
```

Look at each PNG (read the image). Expected:
- **menu-*:** a 3D city with the kid jogging toward the camera, the outlined "SUBWAY / RUNNER" title, "Best 0", a green PLAY button, 3 hint tiles and a round speaker button top-right
- **run-ipad:** the kid from behind on the gravel track, colourful buildings, obstacles/coins, and a SCORE capsule with a number between 200 and 300
- **crash-ipad:** an indigo card with "Crash!", **SCORE 39**, coin 0, "New best!", "Play Again" and "Menu"
- **run-landscape:** a wide view of the same scene, with the HUD in the corners and score > 900

If a 3D view is black, run that one `shot` line again.

- [ ] **W6.5** Run `cd web && node scripts/check-touch.mjs http://127.0.0.1:4391/ screenshots/touch-ipad.png`. Expected: `before swipe:` shows `"mode":"playing","lane":1`, `after swipe:` shows `"lane":2`, then `TOUCH CHECK PASSED`.
- [ ] **W6.6** Run `cd web && node scripts/check-offline.mjs http://127.0.0.1:4391/`. Expected:
  - `service worker: {"active":"activated",…}` with 8 files
  - `offline reload: {"online":false,"title":"Subway Runner","play":true,"canvas":true,…}`
  - `OFFLINE CHECK PASSED`
- [ ] **W6.7** Stop the preview server. Commit: `git add -A web && git commit -m "test(web): iPad touch, offline checks and screenshots"`

---

### Task W7: Home-network HTTPS hosting on this Mac Studio

- [ ] **W7.1** Create `web/scripts/serve-https.mjs`:

```js
// Tiny static HTTPS server for the built game (no dependencies). Serves one folder on the home network.
// Usage: node serve-https.mjs --dir <site folder> --cert <cert.pem> --key <key.pem> [--port 8843]
// Started at login by launchd (see Task W8). Files are read from disk on every request, so a new
// deploy is live immediately without a restart.
import { createServer } from 'node:https';
import { readFileSync, createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const root = resolve(args.dir ?? 'dist');
const port = Number(args.port ?? 8843);
const tls = { cert: readFileSync(args.cert), key: readFileSync(args.key) };

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
};

/** sw.js, html and the manifest must always be re-checked so updates reach the iPad; hashed assets never change. */
function cacheControl(path) {
  if (path.includes(`${sep}assets${sep}`)) return 'public, max-age=31536000, immutable';
  if (/\.(html|webmanifest)$/.test(path) || path.endsWith(`${sep}sw.js`)) return 'no-cache';
  return 'public, max-age=86400';
}

const server = createServer(tls, (req, res) => {
  const started = Date.now();
  const done = (status) => console.log(`${new Date().toISOString()} ${status} ${req.method} ${req.url} ${Date.now() - started}ms`);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return done(405); }
  let path;
  try {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'https://x').pathname);
    path = normalize(join(root, urlPath));
  } catch { res.writeHead(400).end(); return done(400); }
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return done(403); } // no ../ escapes
  try {
    if (statSync(path).isDirectory()) path = join(path, 'index.html');
    const st = statSync(path);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cacheControl(path),
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') { res.end(); return done(200); }
    createReadStream(path).pipe(res);
    done(200);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    done(404);
  }
});
server.listen(port, '0.0.0.0', () => console.log(`Subway Runner serving ${root} on https://0.0.0.0:${port}`));
```

- [ ] **W7.2** Create `web/scripts/deploy-local.sh`:

```bash
#!/bin/bash
# Builds the game and copies it into the folder the home HTTPS server serves (outside the repo).
# Run from web/:  npm run deploy
# The iPad gets the new version the next time it opens the game on the home Wi-Fi
# (the service worker's cache name changes on every build).
set -euo pipefail
SITE="${SUBWAY_RUNNER_SITE:-$HOME/Library/Application Support/SubwayRunner}"   # override only for testing
npm test
npm run build
mkdir -p "$SITE/www"
rsync -a --delete dist/ "$SITE/www/"
mkdir -p "$SITE/www/support" && cp ../docs/site/*.html "$SITE/www/support/"   # privacy + support pages
cp scripts/serve-https.mjs "$SITE/serve-https.mjs"
echo "Deployed to $SITE/www:"
(cd "$SITE/www" && find . -type f | sort)
echo "Open https://$(scutil --get LocalHostName).local:8843/ on the iPad (home Wi-Fi)."
```

- [ ] **W7.3** Create `web/scripts/install-service.sh`:

```bash
#!/bin/bash
# Installs (or reinstalls) the LaunchAgent that serves the game over HTTPS at login and keeps it running.
# Run from web/ after `npm run deploy` and after the certificate exists (Task W7).
set -euo pipefail
LABEL="${SUBWAY_RUNNER_LABEL:-com.cagdasatici.subwayrunner}"     # overrides only for testing
SITE="${SUBWAY_RUNNER_SITE:-$HOME/Library/Application Support/SubwayRunner}"
PLIST="${SUBWAY_RUNNER_PLIST:-$HOME/Library/LaunchAgents/$LABEL.plist}"
PORT=8843
LOGS="$HOME/Library/Logs/SubwayRunner"
NODE=/opt/homebrew/bin/node

for f in "$NODE" "$SITE/serve-https.mjs" "$SITE/www/index.html" "$SITE/certs/cert.pem" "$SITE/certs/key.pem"; do
  [ -e "$f" ] || { echo "Missing: $f"; exit 1; }
done
mkdir -p "$LOGS" "$(dirname "$PLIST")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$SITE/serve-https.mjs</string>
    <string>--dir</string><string>$SITE/www</string>
    <string>--cert</string><string>$SITE/certs/cert.pem</string>
    <string>--key</string><string>$SITE/certs/key.pem</string>
    <string>--port</string><string>$PORT</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOGS/server.log</string>
  <key>StandardErrorPath</key><string>$LOGS/server.log</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true    # replace an older copy
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 1
launchctl print "gui/$(id -u)/$LABEL" | grep -E "state =|pid =" | head -2
echo "Installed $LABEL. Logs: $LOGS/server.log"
```

- [ ] **W7.4** Create `web/scripts/uninstall-service.sh`:

```bash
#!/bin/bash
# Stops the HTTPS server and removes its LaunchAgent. The site folder and certificates are kept.
set -uo pipefail
LABEL="${SUBWAY_RUNNER_LABEL:-com.cagdasatici.subwayrunner}"
PLIST="${SUBWAY_RUNNER_PLIST:-$HOME/Library/LaunchAgents/$LABEL.plist}"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null && echo "Stopped $LABEL" || echo "$LABEL was not running"
rm -f "$PLIST" && echo "Removed $PLIST"
```

Then run `chmod +x web/scripts/*.sh`.

- [ ] **W7.5 Deploy the site:** `cd web && npm run deploy`. Expected:
  - `Tests  29 passed (29)` and a successful build
  - `Deployed to …/Application Support/SubwayRunner/www:` listing 10 files: `assets/…js`, `assets/…css`, 3 icons, `index.html`, `manifest.webmanifest`, `support/index.html`, `support/privacy.html` and `sw.js`
  - last line: `Open https://Mac-Studio.local:8843/ on the iPad (home Wi-Fi).`
- [ ] **W7.6 Install mkcert:** `brew install mkcert`, then `mkcert -version`. Expected: `v1.4.4`. **Don't run `mkcert -install`** (Rule 9).
- [ ] **W7.7 Make the certificate.** It covers the `.local` name, `localhost` and the Mac's current LAN IPs:

```bash
SITE="$HOME/Library/Application Support/SubwayRunner"
mkdir -p "$SITE/certs" && cd "$SITE/certs"
NAMES="$(scutil --get LocalHostName).local localhost 127.0.0.1 ::1"
for IF in en0 en1; do IP=$(ipconfig getifaddr $IF || true); [ -n "$IP" ] && NAMES="$NAMES $IP"; done
echo $NAMES
mkcert -cert-file cert.pem -key-file key.pem $NAMES
chmod 600 key.pem
ls -la "$SITE/certs" "$(mkcert -CAROOT)"
```

Expected:
- `echo` shows `Mac-Studio.local localhost 127.0.0.1 ::1 192.168.2.49 192.168.2.51` (the IPs may differ)
- mkcert prints `Created a new local CA` (first time only) and `Created a new certificate valid for the following names`
- it also prints a note that the CA isn't installed in the system trust store. **That's expected, so ignore it.**
- `certs/` contains `cert.pem` and `key.pem`
- the CAROOT folder (`~/Library/Application Support/mkcert`) contains `rootCA.pem` and `rootCA-key.pem`

- [ ] **W7.8 Check that the port is free:** `lsof -nP -iTCP:8843 -sTCP:LISTEN`. Expected: no output. If something is listening, stop and report it. Don't pick another port on your own.
- [ ] **W7.9 Install the service:** `cd /Users/cagdas/Projects/Subway_Runner/web && scripts/install-service.sh`. Expected: `…/com.cagdasatici.subwayrunner.plist: OK`, `state = running`, a `pid = …` line and `Installed com.cagdasatici.subwayrunner.`
- [ ] **W7.10 Verify HTTPS** (using the root certificate file, so the Mac doesn't need to trust it):

```bash
CA="$(mkcert -CAROOT)/rootCA.pem"
HOST="$(scutil --get LocalHostName).local"
for U in "https://$HOST:8843/" "https://localhost:8843/" "https://$(ipconfig getifaddr en0):8843/"; do
  curl -s -o /dev/null -w "%{http_code} $U\n" --cacert "$CA" "$U"; done
for P in sw.js manifest.webmanifest index.html; do printf "%-22s" $P
  curl -sI --cacert "$CA" "https://$HOST:8843/$P" | grep -iE "^(content-type|cache-control)" | tr -d '\r' | tr '\n' ' '; echo; done
curl -s -o /dev/null -w "escape attempt %{http_code}\n" --cacert "$CA" --path-as-is "https://localhost:8843/../../certs/key.pem"
```

Expected:
- `200` for all three URLs
- `sw.js` → `text/javascript; charset=utf-8` with `no-cache`
- `manifest.webmanifest` → `application/manifest+json` with `no-cache`
- `index.html` → `text/html; charset=utf-8` with `no-cache`
- `escape attempt 404`

- [ ] **W7.11 Restart test:**

```bash
L=gui/$(id -u)/com.cagdasatici.subwayrunner
launchctl print $L | grep "pid ="; launchctl kickstart -k $L; sleep 2; launchctl print $L | grep "pid ="
curl -s -o /dev/null -w "after restart %{http_code}\n" --cacert "$(mkcert -CAROOT)/rootCA.pem" https://localhost:8843/
tail -3 ~/Library/Logs/SubwayRunner/server.log
```

Expected: two **different** pids, `after restart 200`, and log lines like `Subway Runner serving … on https://0.0.0.0:8843` and `200 GET /`.

- [ ] **W7.12 Offline and touch checks over HTTPS.** Headless Chrome can't resolve `.local` names here (it hangs), so use `localhost`, which the certificate covers. Pin the certificate with its SPKI hash:

```bash
cd /Users/cagdas/Projects/Subway_Runner/web
SPKI=$(openssl x509 -in "$HOME/Library/Application Support/SubwayRunner/certs/cert.pem" -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64)
CHROME_FLAGS="--ignore-certificate-errors-spki-list=$SPKI" node scripts/check-offline.mjs https://localhost:8843/
CHROME_FLAGS="--ignore-certificate-errors-spki-list=$SPKI" node scripts/check-touch.mjs https://localhost:8843/ screenshots/touch-https.png
```

Expected: `OFFLINE CHECK PASSED` (8 cached files; `"online":false` reload works) and `TOUCH CHECK PASSED`.

- [ ] **W7.13** Run `cd /Users/cagdas/Projects/Subway_Runner && git status --short | grep -i pem || echo "no keys in repo"`. Expected: `no keys in repo`. Then run `grep -ri "surfers\|sybo" web --exclude-dir=node_modules --exclude-dir=dist || echo clean`. Expected: `clean`.
- [ ] **W7.14** Commit: `git add -A web && git commit -m "feat(web): home-network HTTPS hosting with mkcert and launchd"`
- [ ] **W7.15** **STOP** and report:
  - the commits and the test count
  - the screenshot paths
  - the results of W7.10–W7.12
  - the URL `https://Mac-Studio.local:8843/`
  - the path to `rootCA.pem` (`mkcert -CAROOT`)
  - anything that differed or was skipped

  Then print the Task W8 steps for the human.

---

### Task W8: Set up the iPad (HUMAN steps, done once)

> ⚠️ **Security note:** installing the mkcert root certificate on the iPad means the iPad trusts **any** certificate made with this Mac's mkcert CA, for any website. The CA's private key (`rootCA-key.pem` in `~/Library/Application Support/mkcert`) must **never** leave this Mac. Don't share it, back it up to a cloud folder or commit it. AirDrop only `rootCA.pem`.

1. **Keep the Mac Studio awake.** System Settings → Energy → turn on "Prevent automatic sleeping when the display is off". (The user said they handle this; the agent never changes it.)
2. **Send the root certificate to the iPad:** in Finder, press Go → Go to Folder…, paste `~/Library/Application Support/mkcert`, then AirDrop **`rootCA.pem`** (not the `-key` file) to the iPad. The iPad says "Profile Downloaded".
3. **Install it on the iPad:** Settings → General → VPN & Device Management → the downloaded "mkcert …" profile → Install (enter the iPad passcode) → Install.
4. **Trust it on the iPad:** Settings → General → About → Certificate Trust Settings → turn **on** full trust for the "mkcert …" root → Continue.
5. **Add the game:** on the home Wi-Fi, open **Safari** at `https://Mac-Studio.local:8843/` (there should be no warning). If `.local` doesn't resolve, use `https://192.168.2.49:8843/`. Tap **Share**, then **Add to Home Screen**, then **Add**.
6. **First run:** open "Subway Runner" from the Home Screen and play once. This caches the game for offline use.
7. **Offline check:** turn on Airplane Mode, open the game from the Home Screen, and play. It should work. Turn Airplane Mode off afterwards.

**Updating later (on the Mac):** `cd /Users/cagdas/Projects/Subway_Runner/web && npm run deploy`. No restart is needed. The next time the iPad opens the game on the home Wi-Fi, it fetches the new version in the background. Close and reopen the game to see it.

**If the Mac's IP changes,** the `.local` name keeps working. To use the new IP directly, rerun W7.7 and then `launchctl kickstart -k gui/$(id -u)/com.cagdasatici.subwayrunner`.

**To turn the server off:** `web/scripts/uninstall-service.sh`. The game stays playable offline on the iPad.

**Only a real iPad can confirm:**
- that it holds 60 fps (open `https://Mac-Studio.local:8843/?debug=1` in Safari)
- that sound starts after the first tap and respects the silent switch
- the safe-area padding
- the Home-Screen launch
- that Airplane Mode play works
- that the certificate shows as trusted
