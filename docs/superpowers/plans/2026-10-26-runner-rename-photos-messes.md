# Runner: Rename, Kid Photo Wave, Dog Messes (web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Target executor:** Claude Sonnet 5.5, low effort. Everything you need is in this file. Do not redesign; implement what is written. Where code is given, use it. Where only behaviour is given, the constants and file locations here are binding.

**Goal (five changes, one branch):**
1. **Rename** the game from "Subway Runner" to **"Runner"**: display name, web app, docs, GitHub repo, local folder.
2. **Kid photo wave:** when **Arel** or **Nora** finishes a journey level, their photos fly across the screen in a bouncing wave, ending in one big "Go Arel!" / "Go Nora!" photo pop.
3. **Dog messes:** when **Bella** or **Toby** is the runner, poop and pee puddles appear on the track. Running over one sticks it on the dog for **5.5 s** (poop on the head and muzzle with buzzing flies; pee as a yellow coat with drips), shows a **2 s close-up "reaction cam"** of the dog's face, plays a **cartoon laugh**, and ends with a **bath** (tub + bubbles). Messes never crash or slow the runner.

4. **In-app updates:** the Home Screen app checks for a new build at launch and on every reopen, updates itself automatically on the menu/map, and has an update button plus a version label.
5. **Push notifications:** each kid's iPad can turn on "News"; Dad sends a notification from the Mac (`npm run notify` or `NOTIFY=... npm run deploy`); tapping it opens the app, which then updates itself. Gated by a one-iPad test (Task 6.0).

**Out of scope (do not build):** the wormhole / 5 s lightning-speed idea (stays in the backlog), any change to `App/` or `GameCore/` Swift code beyond the two display-name lines in Task 1, any new npm dependency.

---

## Executor Rules (read first, follow literally)

1. Repo root on the Mac: `/Users/cagdas/Projects/Subway_Runner` (it is renamed to `/Users/cagdas/Projects/Runner` by the human **after** this plan, see Task 9). Web paths below are relative to `web/` unless they start with `../`.
2. Do the tasks in order. Run every "Run" step and compare with "Expected". **Never weaken, skip or delete an existing test, and never change existing golden numbers.** The obstacle/coin/pickup sequence of every endless seed and every level must stay byte-identical (messes are placed by a separate hash, never by the track RNG).
3. Tech stack is pinned: three 0.186.1, @types/three 0.186.0, vite 8.3.5, vitest 5.0.5, typescript 7.0.2. Add no dependencies, except `web-push@3.6.7` as a dev dependency in Task 6.
4. If a step still fails after 3 fix attempts, stop and report the exact command and output.
5. Work on branch `feat/runner-photos-messes`. Commit at the end of each task with the given message. Push only in Task 8.
6. Never use the names "Subway Surfers", "SYBO", "Jake", "Tricky", "Fresh", "hoverboard" or "Inspector".
7. **Private photos never enter git.** `web/public/faces/` stays git-ignored. Never commit, print or upload a face picture.
8. Use the headless-Chrome check scripts (`web/scripts/check-*.mjs`) with `localhost`, not `.local` names and not the in-app browser pane.
9. Never run `mkcert -install`; never touch certificates, launchd configuration, firewall or sleep settings. The only allowed launchd command is the service restart named in Task 6.

---

## Task 0: Sync and branch

- [ ] **0.1** `cd /Users/cagdas/Projects/Subway_Runner && git status --short` → Expected: empty.
- [ ] **0.2** `git checkout main && git pull --ff-only` → Expected: fast-forward to `c086974` or later (the local main was 6 commits behind on 2026-10-26: Arel/Nora/Toby, photo faces).
- [ ] **0.3** `git checkout -b feat/runner-photos-messes`
- [ ] **0.4** `cd web && npm ci && npm test` → Expected: all tests pass. Write down the pass count as **N0**; later steps refer to it.

---

## Task 1: Rename "Subway Runner" → "Runner"

### Decisions (binding)

| Item | Action | Why |
|---|---|---|
| Player-facing name (web title, home-screen name, manifest, menu title, support pages, README, logo) | **Rename to "Runner"** | The request |
| Web code identifiers (`subwayRunnerDebug`, SW plugin name, cache prefix, package name, temp dir names) | **Rename** (table below) | Consistency |
| iOS display name (`CFBundleDisplayName`) and SwiftUI menu title | **Rename** | Player-facing |
| iOS bundle id `com.cagdasatici.subwayrunner`, Swift type `SubwayRunnerApp`, Xcode target/project name `SubwayRunner` | **Keep** | Bundle id is the App Store identity; target rename is churn with no user benefit |
| Home server: `~/Library/Application Support/SubwayRunner`, launchd label `com.cagdasatici.subwayrunner`, `~/Library/Logs/SubwayRunner`, env var names `SUBWAY_RUNNER_*` | **Keep** | Live service with certificates; renaming means reinstalling the service. Not worth the risk |
| Historical plans and research under `docs/superpowers/` (dated files) | **Keep** | They are records of what was built at the time |
| `store/metadata.md` app name | **Rename to "Runner"**, keep fallbacks, add a line: `Note: "Runner" alone is likely taken on the App Store; use a fallback at submission.` | Honest |

### Exact edits

- [ ] **1.1** `web/index.html`: `<title>Runner</title>`; `apple-mobile-web-app-title` content `Runner`; the menu title div becomes `<div class="title"><span>RUNNER</span></div>`.
- [ ] **1.2** `web/public/manifest.webmanifest`: `"name": "Runner"` (and `"short_name": "Runner"` if the key exists).
- [ ] **1.3** `web/package.json` + `web/package-lock.json`: `"name": "runner-web"` (lock file: only the two top-level `"name"` fields).
- [ ] **1.4** `web/vite.config.ts`: plugin name `'runner-sw'`; cache `const CACHE = 'runner-${version}';`.
- [ ] **1.5** `web/src/main.ts`: rename the debug global `subwayRunnerDebug` → `runnerDebug` (both the type cast and the property). Then in `web/scripts/check-env.mjs`, `check-touch.mjs`, `check-boost.mjs`, `check-journey.mjs`: replace every `subwayRunnerDebug` with `runnerDebug`.
- [ ] **1.6** `web/scripts/check-offline.mjs`: expected title `'Runner'`.
- [ ] **1.7** `web/scripts/serve-https.mjs`: log text `Runner serving ...`. (Keep the `SUBWAY_RUNNER_*` env var names and default paths in `deploy-local.sh`, `install-service.sh`, `uninstall-service.sh` unchanged.)
- [ ] **1.8** `scripts/redeploy.sh` (repo root): `TMP="$(mktemp -d)/runner-main"`.
- [ ] **1.9** `docs/site/index.html` and `docs/site/privacy.html`: every "Subway Runner" → "Runner" (titles, h1, body text).
- [ ] **1.10** `docs/readme/logo.svg`: `aria-label="Runner"`; delete both `<text>` elements whose content is `SUBWAY`; move the `RUNNER` text elements up so the word is vertically centred in the 360 px viewBox (adjust their `y`, keep their 6 px offset pair). Verify `grep -c SUBWAY docs/readme/logo.svg` → `0` and that the file still parses (`node -e "require('fs').readFileSync('../docs/readme/logo.svg','utf8')"`).
- [ ] **1.11** `README.md`: title alt text `Runner`; the clone/repo mentions become `runner`; keep `open SubwayRunner.xcodeproj` (Xcode name unchanged). Add one line under "Two builds, one game": `The iOS target is still named SubwayRunner internally (bundle id unchanged); only the display name is Runner.`
- [ ] **1.12** `CLAUDE.md` and `AGENTS.md`: first heading `# Runner` / `# Runner: agent instructions`.
- [ ] **1.13** `project.yml`: `CFBundleDisplayName: Runner` only. `App/MenuView.swift`: the `OutlinedTitle(text: "SUBWAY", ...)` line is removed so only `RUNNER` shows (keep the RUNNER line exactly). Do not build iOS.
- [ ] **1.14** `store/metadata.md`: as in the decisions table.
- [ ] **1.15 Run** from repo root:
  ```bash
  grep -rIn "Subway Runner\|subwayRunnerDebug\|subway-runner-sw\|'subway-runner-" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=superpowers --exclude-dir=dist . 
  ```
  Expected: no output.
- [ ] **1.16 Run** `cd web && npx tsc --noEmit && npm test && npm run build` → Expected: N0 passed, build OK.
- [ ] **1.17** Commit: `chore: rename the game to Runner (display name, web, docs)`

---

## Task 2: Dog messes, core logic (pure, tested)

### Rules

- Messes exist only when the run is started with `StartOptions.messes === true`. `main.ts` sets it for characters with `messes: true` (Bella `maltese`, Toby `toby`).
- Kinds: `'poop'` (60 %) and `'pee'` (40 %).
- Placement: candidate slots every **`MESS_SLOT = 11` m** from `MESS_FIRST_Z = 70` m. Each slot gets a mess with probability **0.28**, chosen by a pure integer hash of (seed, slot), **never** the track RNG. Lane from the same hash. A slot is skipped if in that lane:
  - any obstacle (including ramps and roof trains) overlaps `[z - 4, z + 4]`;
  - any coin is within 1.5 m in z (coins sit at ground height there, the mess would hide under them);
  - any pickup is within 3 m in z;
  - (levels) `z > finishZ - 15`.
- Hit: the runner is on the ground (`s.floor === 0 && s.y - s.floor < 0.15`), not flying or descending, its x is within **0.9 m** of the mess lane centre, and this tick moved it across the mess (`prev.z < m.z && m.z <= s.z`). Iframes do **not** protect from messes (funnier). A mess is hit at most once (its id goes into `collected`).
- Effect: `messKind = kind`, `messTicks = MESS_TICKS = 660` (5.5 s at 120 Hz), `messes += 1`. Hitting a second mess while one is active replaces the kind and restarts the timer. **No speed, score or crash effect.**
- Mess ids: `MESS_ID_BASE + slot` with `MESS_ID_BASE = 1_000_000_000`, so they can never clash with track ids in `collected`.

### Code

- [ ] **2.1** `src/core/track.ts`: add after the `Pickup` interface:
  ```ts
  export type MessKind = 'poop' | 'pee';
  export interface Mess { id: number; kind: MessKind; lane: number; z: number }
  ```
  Add the field `messes: Mess[] = [];` to `Track` (after `pickups`), extend `Track.fixed(obstacles, coins = [], pickups = [], messes: Mess[] = [])` to set it, and in `dropBehind` add `this.messes = this.messes.filter((m) => !(m.z < z - 5));`.

- [ ] **2.2** Create `src/core/messes.ts` (whole file):
  ```ts
  // Dog messes (Bella, Toby): poop and pee on the track. Placed by a pure hash of (seed, slot), never by the
  // track RNG, so every obstacle/coin sequence stays identical with or without messes.
  import { laneX, obstacleLength, type Mess, type MessKind, type Track } from './track';

  export const MESS_SLOT = 11;
  export const MESS_FIRST_Z = 70;
  export const MESS_CHANCE = 0.28;
  export const MESS_TICKS = 660; // 5.5 s at 120 ticks per second
  export const MESS_ID_BASE = 1_000_000_000;
  export const MESS_HALF_WIDTH = 0.9;

  /** 32-bit integer hash (lowbias32 on a mixed pair) → [0, 1). */
  export function hash01(seed: number, slot: number, salt = 0): number {
    let x = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(slot + salt * 7919, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /** Adds messes for every slot whose z is in [zFrom, zTo). Idempotent per slot (skips ids already present). */
  export function placeMesses(track: Track, seed: number, zFrom: number, zTo: number, maxZ = Infinity): void {
    const have = new Set(track.messes.map((m) => m.id));
    const first = Math.max(0, Math.ceil((zFrom - MESS_FIRST_Z) / MESS_SLOT));
    for (let k = first; ; k++) {
      const z = MESS_FIRST_Z + k * MESS_SLOT;
      if (z >= zTo) break;
      if (z > maxZ) break;
      const id = MESS_ID_BASE + k;
      if (have.has(id) || hash01(seed, k) >= MESS_CHANCE) continue;
      const lane = Math.floor(hash01(seed, k, 1) * 3);
      const kind: MessKind = hash01(seed, k, 2) < 0.6 ? 'poop' : 'pee';
      const blocked =
        track.obstacles.some((o) => o.lane === lane && o.z < z + 4 && o.z + obstacleLength(o) > z - 4) ||
        track.coins.some((c) => c.lane === lane && Math.abs(c.z - z) < 1.5) ||
        track.pickups.some((p) => p.lane === lane && Math.abs(p.z - z) < 3);
      if (blocked) continue;
      track.messes.push({ id, kind, lane, z });
    }
  }

  /** True when this tick (prev → next) runs the grounded runner over mess m. */
  export function stepsOn(prevZ: number, z: number, x: number, y: number, floor: number, flying: boolean, m: Mess): boolean {
    return !flying && floor === 0 && y - floor < 0.15 && Math.abs(x - laneX(m.lane)) < MESS_HALF_WIDTH && prevZ < m.z && m.z <= z;
  }
  ```
  `Mess`/`MessKind` come from 2.1.

- [ ] **2.3** `src/core/runner.ts`:
  - Import `MESS_TICKS, stepsOn` from `./messes` and `type MessKind` from `./track`.
  - `RunnerState` gains three fields at the end: `messTicks: number; // ticks of mess left (dogs only)`, `messKind: MessKind | null;`, `messes: number; // counter, for the renderer`.
  - `StartOptions` becomes `{ board?: boolean; friendly?: boolean; messes?: boolean }`.
  - `startState` adds `messTicks: 0, messKind: null, messes: 0`.
  - In `step`, right after `if (s.chaser > 0) s.chaser -= 1;` add `if (s.messTicks > 0) { s.messTicks -= 1; if (s.messTicks === 0) s.messKind = null; }`.
  - In `step`, immediately **before** the `const mult = s.double > 0 ...` line, add:
    ```ts
    const airborne = s.fly > 0 || s.descend > 0;
    for (const m of track.messes) {
      if (s.collected.has(m.id) || !stepsOn(prev.z, s.z, s.x, s.y, s.floor, airborne, m)) continue;
      own();
      s.collected.add(m.id);
      s.messKind = m.kind;
      s.messTicks = MESS_TICKS;
      s.messes += 1;
    }
    ```
    (This block is after the crash `return`, so a crash tick never also messes.)
  - `RunSession`: store `private seed: number` = `Number(seed & 0xffffffffn)` and `private messes: boolean` from `opts.messes`, plus `private messHorizon = 0`. At the end of the constructor and of `tick` (after `generate`, before `dropBehind`), when `this.messes`: `placeMesses(this.track, this.seed, this.messHorizon, this.state.z + RunSession.generateAhead); this.messHorizon = this.state.z + RunSession.generateAhead;`. Import `placeMesses` from `./messes`.

- [ ] **2.4** `src/core/level.ts`, `LevelRun` constructor: after `this.state = startState(opts);` add
  `if (opts.messes) placeMesses(this.level.track, 7919 * n, 0, this.level.finishZ - 15);`
  `buildLevel` is not memoized today (checked 2026-10-26), so each `LevelRun` owns its track; test 8 in 2.7 guards against a cache being added later.

- [ ] **2.5** `src/gfx/characters.ts`: `CharacterDef` gains
  ```ts
  /** Bella and Toby: poop and pee appear on the track. */
  messes?: boolean;
  /** Arel and Nora: file-name prefix of their photos in faces/ for the finish photo wave. */
  photoSet?: string;
  ```
  Set `messes: true` on `maltese` and `toby`; `photoSet: 'arel'` on Arel and `photoSet: 'nora'` on Nora.

- [ ] **2.6** `src/main.ts`: `runOptions` becomes
  `const runOptions = () => ({ board: startBoard, friendly: true, messes: !!characterById(game.character).messes });`
  Find the endless-run start call; make sure it also passes `runOptions()` (it must, if it does not, add it).

- [ ] **2.7** Create `tests/messes.test.ts` with these tests (write them before 2.2–2.4 if you follow TDD; the assertions are binding):
  1. **Deterministic:** two `RunSession(42n, { messes: true })` ticked 3000 times with `'none'` have identical `track.messes` arrays (use `autopilotMove` instead of `'none'` so the runner survives; import from `../src/core/autopilot` and mirror how `tests/autopilot.test.ts` drives a session).
  2. **Track unchanged:** for seeds 1, 7, 42: the `obstacles`, `coins`, `pickups` after 2000 autopilot ticks are deep-equal between `{ messes: true }` and `{}`; and `{}` has `track.messes.length === 0`.
  3. **Never under an obstacle:** for seed 42 after `placeMesses(track, 42, 0, 2000)` on a fresh `new Track(42n)` with `generate(2000)`: every mess has no obstacle in its lane overlapping `[z-4, z+4]` and no coin within 1.5 m.
  4. **Density:** same setup, `messes.length` is between 0.15 and 0.30 times the slot count `(2000-70)/11`.
  5. **Hit:** `Track.fixed([], [], [], [{ id: MESS_ID_BASE, kind: 'pee', lane: 1, z: 5 }])`, runner `startState({ friendly: true })`, step `'none'` until `z > 6` → `messKind === 'pee'`, `messTicks` between 600 and 660, `messes === 1`, `crashed === false`.
  6. **Jump avoids it:** same track with the mess at z 5; step `'up'` once at tick 0, then `'none'` → `messes === 0`.
  7. **Expires:** after the hit in test 5, step 700 more ticks → `messTicks === 0`, `messKind === null`.
  8. **Level:** `new LevelRun(1, { messes: true }).level.track.messes.length > 0`, and `new LevelRun(1, {}).level.track.messes.length === 0` when constructed **after** the first one (proves no shared-cache leak).
  9. **Characters:** `characterById('maltese').messes`, `characterById('toby').messes` are true; every other id is falsy; `photoSet` is `'arel'` / `'nora'` for the kids only.
- [ ] **2.8 Run** `npx tsc --noEmit && npm test` → Expected: N0 + 9 passed.
- [ ] **2.9** Commit: `feat(core): poop and pee messes for the dog runners (hash-placed, never change the track)`

---

## Task 3: Dog messes, visuals, reaction cam, sounds

### 3A. Track meshes: `src/gfx/messes.ts` (new)

- [ ] **3.1** Class `MessRenderer` with `readonly group = new THREE.Group()`, `update(visible: Mess[], time: number)`, `clear()`. Keep a `Map<number, THREE.Object3D>` like the coin renderer: add nodes for new ids, remove nodes whose ids are not in `visible`, dispose geometry on removal (share geometries/materials across instances: create them once in the constructor).
  - **Poop** (centred at `laneX(lane), 0, -z`): three stacked spheres, scaled flat (`scale.y = 0.6`), radii 0.22 / 0.16 / 0.10 at y 0.08 / 0.2 / 0.3, plus a cone tip (r 0.06, h 0.12) at y 0.37 bent 0.3 rad. Material `MeshStandardMaterial({ color: 0x6b4423, roughness: 0.55 })`, highlight material `0x8a5a2b` on the middle sphere. Two white sphere eyes (r 0.035) with black pupils (r 0.018) on the middle sphere's front (−z side) — it is a kids' game; the poop is a cartoon. Three wavy green "stink" lines: thin `TubeGeometry` along a small sine curve (height 0.5, amplitude 0.05), material `MeshBasicMaterial({ color: 0x9acd32, transparent: true, opacity: 0.7 })`; in `update`, bob them `y += 0.05 * sin(time*3 + i)` and fade opacity `0.4 + 0.3 * sin(time*2 + i)`.
  - **Pee:** flat irregular puddle: `CircleGeometry(0.75, 24)` rotated flat, vertices radially jittered by ±18 % with a fixed per-id pattern (`Math.sin(id * 12.9898 + a * 3)`), at y 0.02; material `MeshStandardMaterial({ color: 0xf2d43a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 })`. A smaller white `RingGeometry(0.25, 0.3)` shine at y 0.025, opacity 0.35.
- [ ] **3.2** `src/game.ts`: create `private messes = new MessRenderer();`, add `this.messes.group` to the scene in the constructor next to `this.coins.group`. In `sync()`, after the coin block: `this.messes.update(track.messes.filter((m) => !s.collected.has(m.id) && m.z < s.z + VIEW_AHEAD && m.z > s.z - 5), this.time);`. In `begin()` and wherever `clearDynamic()` runs, call `this.messes.clear()`.

### 3B. On the dog: `src/gfx/maltese.ts` and `src/gfx/character.ts`

- [ ] **3.3** `MalteseFigure` gains:
  - `setMess(kind: MessKind | null): void`: builds (lazily, once per kind) and shows/hides two groups.
    - **Poop group**, child of `this.head`: a mini poop (same shape as 3.1 at scale 0.45) on top of the head (local y ≈ +0.2 above the head centre, tilted 0.25 rad), plus 3 flattened brown spheres (r 0.04–0.06, `scale.z = 0.4`) smeared on the muzzle/cheeks. Three flies: black spheres r 0.018 each with two tiny white transparent wings (`PlaneGeometry(0.03,0.02)`, opacity 0.6).
    - **Pee group**: no extra meshes on the head. Instead, remember the original `fur` and `furShade` colours and lerp both toward `0xf2df74` by 0.55 (`color.lerpColors(orig, yellow, 0.55)`). Add 4 drip spheres (r 0.03, yellow, opacity 0.9) under the belly and legs.
    - `setMess(null)` hides both groups and restores the fur colours exactly.
    - Keep `fur`/`furShade` as private fields (they are locals in the constructor today: promote them).
  - `updateMess(t: number, left01: number)`: flies orbit the head (radius 0.28, angular speeds 7, −9, 11 rad/s, vertical bob 0.06), wings flap `scale.y = 0.5 + 0.5*|sin(t*60)|`; drips slide down 0.15 and loop every 0.6 s. When `left01 < 0.15` (last ~0.8 s) show the **bath**: a white tub (outer `CylinderGeometry(0.62, 0.52, 0.36, 28, 1, true)` double-sided + bottom disc) around the body at y 0.18 and a light-blue water disc at y 0.3 with soap-bubble spheres (8 white transparent spheres r 0.05–0.1, rising and popping by scaling to 0). Hide the tub when `left01 === 0`.
- [ ] **3.4** `RunnerFigure` (character.ts): add `setMess(kind: MessKind | null)` and `updateMess(t: number, left01: number)` that forward to the procedural rig when it is a `MalteseFigure` (no-op for other characters). Add `headWorld(target: THREE.Vector3): THREE.Vector3` that returns the head world position (for the Maltese: `this.head.getWorldPosition`, exposed through a public getter `headObject` on `MalteseFigure`; for others: the root position + `(0, height*0.85, 0)`). Call `setMess(null)` inside `setCharacter` and `reset()`.

### 3C. Game hooks (`src/game.ts`)

- [ ] **3.5** `GameEvents` gains optional `onMess?(kind: MessKind): void;` and `onMessClear?(): void;`. `lastCounters` becomes 5 long: `[nearMisses, combos, boardBreaks, stumbles, messes]` (update both resets and the destructuring in `report`).
- [ ] **3.6** In `report()`, after the existing toast chain (do not put it in the `else if` chain: it must fire even on the same frame as a near miss):
  ```ts
  if (s.messes !== this.lastMessCount) {
    this.lastMessCount = s.messes;
    if (s.messKind) {
      this.figure.setMess(s.messKind);
      this.reactionT = REACTION_SECONDS;
      this.shake = 0.15;
      const brown = s.messKind === 'poop';
      this.glow.burst(s.x, 0.3, -s.z, 40, { color: brown ? 0x7a4a24 : 0xf2d43a, speed: 4, life: 0.5, size: 0.22, gravity: 9, colorJitter: 0.2 });
      this.events.onMess?.(s.messKind);
    }
  }
  if (this.lastMessTicks > 0 && s.messTicks === 0) {
    this.figure.setMess(null);
    this.sparkles.burst(s.x, s.y + 0.6, -s.z, 40, { color: 0xffffff, speed: 3, life: 0.8, size: 0.32 });
    this.events.onMessClear?.();
  }
  this.lastMessTicks = s.messTicks;
  ```
  with new fields `private lastMessCount = 0; private lastMessTicks = 0; private reactionT = 0;` reset in `begin()`, and `const REACTION_SECONDS = 2.0;` at the top. (Keep `lastCounters` handling consistent; `lastMessCount` replaces using its 5th entry if simpler; pick one, not both.)
- [ ] **3.7** In `sync()`, every frame while `s.messTicks > 0`: `this.figure.updateMess(this.time, s.messTicks / MESS_TICKS)`; and for poop, every ~0.15 s emit one green stink particle: `this.glow.burst(s.x + rand(-0.2,0.2), s.y + 1.0, -s.z, 1, { color: 0x9acd32, speed: 0.8, life: 0.7, size: 0.18, gravity: -2, dir: [0, 1, 0], spread: 0.3 })`; for pee, one yellow drip: `{ color: 0xf2d43a, speed: 0.5, life: 0.4, size: 0.12, gravity: 8 }` at `s.y + 0.3`.
- [ ] **3.8 Reaction cam** (the "show their face" moment). In `frame()`, right after `this.post.render(this.scene, this.camera);`:
  ```ts
  if (this.reactionT > 0 && this.mode === 'playing') {
    this.reactionT = Math.max(0, this.reactionT - dt);
    this.renderReaction();
  }
  ```
  and add:
  ```ts
  private reactionCam = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
  private headPos = new THREE.Vector3();
  /** A 2 s close-up of the dog's face in a rounded frame at the top centre (see #reaction in style.css). */
  private renderReaction(): void {
    const r = this.renderer, w = window.innerWidth, h = window.innerHeight;
    const size = Math.round(Math.min(w, h) * 0.34), left = Math.round((w - size) / 2), top = Math.round(h * 0.13);
    this.figure.headWorld(this.headPos);
    this.reactionCam.position.set(this.headPos.x + 0.35, this.headPos.y + 0.12, this.headPos.z - 1.15); // in front: the dog runs toward -z
    this.reactionCam.lookAt(this.headPos);
    this.reactionCam.aspect = 1; this.reactionCam.updateProjectionMatrix();
    const autoClear = r.autoClear;
    r.setScissorTest(true);
    r.setScissor(left, h - top - size, size, size);
    r.setViewport(left, h - top - size, size, size);
    r.autoClear = true;
    r.render(this.scene, this.reactionCam);
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
    r.autoClear = autoClear;
    this.events.onReaction?.(this.reactionT > 0 ? { left, top, size } : null);
  }
  ```
  `GameEvents` gains `onReaction?(rect: { left: number; top: number; size: number } | null): void;`. If `PostFx` renders to an internal target and composites at the end, the inset still draws on top because it is rendered after `post.render`; if the inset appears black or stretched, check `renderer.getRenderTarget()` is `null` before rendering it (set it to `null` explicitly).
- [ ] **3.9** HTML/CSS overlay: in `index.html` inside the HUD section add `<div id="reaction" class="hidden"><span>EWWW!</span></div>`. In `style.css`:
  ```css
  #reaction { position: fixed; border: 6px solid #fff; border-radius: 28px; box-shadow: 0 0 0 4px var(--ink), 0 10px 30px rgba(0,0,0,.35); pointer-events: none; z-index: 20; animation: reactPop .35s cubic-bezier(.2,1.6,.4,1); }
  #reaction span { position: absolute; left: 50%; bottom: -22px; transform: translateX(-50%) rotate(-4deg); background: #84cc16; color: #fff; font-weight: 900; font-size: 26px; padding: 2px 14px; border-radius: 14px; -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; white-space: nowrap; }
  @keyframes reactPop { from { transform: scale(.2) rotate(-12deg); opacity: 0 } to { transform: scale(1) rotate(0); opacity: 1 } }
  ```
  `main.ts` `onReaction`: if `rect` → set `left/top/width/height` px on `#reaction`, remove `hidden`, text `EWWW!` (poop) or `OOPS!` (pee; keep the kind from the last `onMess`); if `null` → add `hidden`.
- [ ] **3.10** Toasts and sound in `main.ts`:
  - `onMess(kind)`: toast `kind === 'poop' ? 'Ewww, poop! 💩' : 'Oops, a puddle! 💦'`; `audio.sfx(kind === 'poop' ? 'splat' : 'splash')`; after 180 ms `audio.sfx('laugh')`.
  - `onMessClear()`: toast `'Bath time! 🛁'`; `audio.sfx('bubbles')`.
- [ ] **3.11** Sounds in `src/audio/engine.ts` `sfx()` switch. Follow the style of the existing cases (`this.blip`, `this.noiseHit`, `this.sfxBus`, `prio`). Exact recipes:
  - `'splat'`: `this.noiseHit({ t, dur: 0.16, type: 'lowpass', f: 420, peak: 0.22, bus: b, wet: 0.1, prio: 3 })` + `this.blip({ t, f: 170, f2: 55, type: 'sine', dur: 0.18, peak: 0.18, bus: b, prio: 3 })` (`f2` is the existing glide option).
  - `'splash'`: two `noiseHit` bursts, bandpass 1800 Hz then 2600 Hz, 0.22 s and 0.15 s, peak 0.14, 60 ms apart.
  - `'laugh'`: five "ha" syllables, 0.11 s each, 0.18 s apart: for i = 0..4 at `t + i*0.18`: `this.blip({ t: ti, f: 300 - i*18, f2: (300 - i*18) * 0.8, type: 'triangle', dur: 0.11, att: 0.01, peak: 0.13 - i*0.012, lp: 1100, detune: 12, bus: b, wet: 0.2, prio: 3 })` plus a breathy `this.noiseHit({ t: ti, dur: 0.08, type: 'bandpass', f: 1200, peak: 0.05, bus: b, prio: 3 })`. It must sound like a giggle, not a buzzer: if harsh, lower `lp` to 900.
  - `'bubbles'`: 9 blips, `'sine'`, random f in [600, 1500] Hz, dur 0.06, peak 0.08, at `t + i*0.07 + rand*0.03`.
  - Do **not** add them to `STINGERS` (`'crash'` is not in it either; short sfx do not duck the music).
- [ ] **3.12** Debug flag for checks: `?mess=poop|pee` in `main.ts` → after the run starts, call a new `game.debugMess(kind)` that injects a mess 6 m ahead of the runner in its lane (`play.track.messes.push({ id: MESS_ID_BASE + 999999, kind, lane: s.lane, z: s.z + 6 })`). Only honoured with `?debug=1`.
- [ ] **3.13 Run** `npx tsc --noEmit && npm test` → Expected: N0 + 9 passed.
- [ ] **3.14 Manual-equivalent check** (headless Chrome, iPad 820×1180): start the dev server in the background (`npm run dev -- --port 5173`), then add `scripts/check-messes.mjs` modelled on `check-boost.mjs`: open `http://localhost:5173/?char=maltese&level=1&debug=1&mess=poop`, wait until `runnerDebug().tick > 200`, screenshot to `screenshots/mess-poop.png`; wait 0.7 s, screenshot `mess-poop-reaction.png`; repeat with `char=toby&mess=pee` → `mess-pee.png`. Expected (look at the PNGs): a poop/puddle visible ahead in the first shot; the dog with poop on its head and the framed close-up with "EWWW!" in the second; the yellow dog and "OOPS!" in the pee shot. `runnerDebug().crashed` stays false. Then `?char=adventurer&level=1&debug=1` for 20 s: no messes anywhere on the track (`runnerDebug()` can expose `messes: track.messes.length`; add it).
- [ ] **3.15** Commit: `feat(web): poop and pee on the dogs, reaction close-up, laugh and bath`

---

## Task 4: Kid photo wave at the finish (Arel, Nora)

### Behaviour (binding)

- Only in journey levels (endless has no finish), only when the finished character has `photoSet`, and only if at least one photo loaded. Crashes never show it.
- Photos: every file in the served `faces/` folder whose lower-case name starts with the `photoSet` prefix and ends in `.png`, `.jpg`, `.jpeg` or `.webp`. The folder is listed by `faces/index.json` (an array of file names). If `index.json` is missing (e.g. dev without faces), fall back to the character's existing `face.photo.url` only. If that fails too, skip silently.
- Preload when the level **starts** (not at the finish) so the wave never waits on the network. Cache per prefix for the session.
- Timeline (starts at `onFinishLine`, total **5.0 s**, an overlay above the canvas **and** the results card, `pointer-events: none`):
  - 0.0–3.6 s, **the wave**: 12 round photo bubbles (cycle through the photos if fewer than 12), size `clamp(72px, 16vmin, 150px)`, 5 px white border, `0 0 0 3px var(--ink)` outline, soft drop shadow. Two rows: row A centred at 34 % viewport height, row B at 62 %; bubble i is in row `i % 2`. Each bubble starts at `0.15 * i` s, travels from `x = -size` to `x = vw + size` in 2.6 s (ease-in-out), with `y = rowY + A * sin(2π * x / λ + phase)` where `A = 0.07 * vh`, `λ = 0.55 * vw`, `phase = 0` for row A and `π` for row B. Rotation `10° * sin(4 * t + i)`. Pop-in scale 0 → 1.15 → 1 over the first 0.3 s of its travel.
  - Every 3rd bubble's entrance plays `audio.sfx('star')`.
  - 3.4–5.0 s, **the finale**: the first photo pops in at the centre, size `38vmin`, with a rotating gold ring (`conic-gradient` of `#fde047`/`#f59e0b`, 10 px) and the label `Go Arel!` / `Go Nora!` below it in the title style (white, 900 weight, ink stroke). Scale 0 → 1.1 → 1 (0.4 s), hold, then fade out over the last 0.5 s. Call the existing `confetti(count, rank)` helper in `main.ts` as `confetti(40, 1)` at 3.4 s.
  - `prefers-reduced-motion: reduce` → no travel: a centred grid of up to 6 photos fades in 0.4 s, holds 1.8 s, fades out 0.4 s; finale skipped.
- Remove all overlay nodes at the end; starting a new level mid-animation cancels it immediately.

### Code

- [ ] **4.1** Create `src/ui/photoWave.ts`. Export pure, tested helpers plus the DOM player:
  ```ts
  export const WAVE = { count: 12, stagger: 0.15, travel: 2.6, total: 5.0, finaleAt: 3.4, rows: [0.34, 0.62], amp: 0.07, lambda: 0.55 } as const;

  /** File names in faces/ that belong to a kid (prefix match, image extensions only), sorted for a stable order. */
  export function pickPhotos(names: string[], prefix: string): string[] {
    const p = prefix.toLowerCase();
    return names.filter((n) => n.toLowerCase().startsWith(p) && /\.(png|jpe?g|webp)$/i.test(n)).sort();
  }

  const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

  /** Centre position (CSS px) of bubble i at time t (s since the wave began), or null when it is not on its path yet / any more. */
  export function wavePos(i: number, t: number, vw: number, vh: number, size: number): { x: number; y: number; rot: number; scale: number } | null {
    const local = t - i * WAVE.stagger;
    if (local < 0 || local > WAVE.travel) return null;
    const u = easeInOut(local / WAVE.travel);
    const x = -size + u * (vw + 2 * size);
    const row = i % 2;
    const y = WAVE.rows[row] * vh + WAVE.amp * vh * Math.sin((2 * Math.PI * x) / (WAVE.lambda * vw) + (row ? Math.PI : 0));
    const k = Math.min(1, local / 0.3);
    const scale = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
    return { x, y, rot: 10 * Math.sin(4 * t + i), scale };
  }
  ```
  Then the DOM part: `loadPhotos(prefix: string, fallbackUrl?: string): Promise<string[]>` (fetch `${import.meta.env.BASE_URL}faces/index.json` with `cache: 'no-cache'`, `pickPhotos`, load each with `new Image()`, keep the URLs that loaded; on any failure try `fallbackUrl`; memoize per prefix), and `playPhotoWave(urls: string[], name: string, hooks: { onPop?: (i: number) => void; onFinale?: () => void }): () => void` that builds `<div id="photo-wave">` on `document.body`, drives bubbles with one `requestAnimationFrame` loop using `wavePos` and `transform: translate3d(x - size/2, y - size/2, 0) rotate(rot deg) scale(scale)`, runs the finale, honours reduced motion, removes itself at `WAVE.total`, and returns a `cancel()` function.
- [ ] **4.2** `style.css`: `#photo-wave { position: fixed; inset: 0; pointer-events: none; z-index: 30; overflow: hidden; }`, `.pw-bubble` (absolute, top/left 0, round, white border, outline, `object-fit: cover` on the img, `will-change: transform`), `.pw-finale` (centred, ring via `::before` with `conic-gradient` and `animation: spin 2s linear infinite`), `.pw-name` (title style). Keep it in the existing chunky look; reuse `var(--ink)`.
- [ ] **4.3** `main.ts`:
  - When a level starts (the function that calls `game.startLevel`): `const d = characterById(game.character); kidPhotos = d.photoSet ? loadPhotos(d.photoSet, d.face?.photo?.url) : null;` and cancel any running wave.
  - `onFinishLine`: keep `audio.playFinishFanfare()`; then `if (kidPhotos) kidPhotos.then((urls) => { if (urls.length && screenIsLevelFinish()) cancelWave = playPhotoWave(urls, d.name, { onPop: (i) => { if (i % 3 === 0) audio.sfx('star'); }, onFinale: () => confetti(40, 1) }); });` where `screenIsLevelFinish()` checks the screen is still `'hud'` or `'results'`.
  - Leaving to the map, retry, next level, or the menu calls `cancelWave?.()`.
- [ ] **4.4** `scripts/deploy-local.sh`: after the `faces` copy line, add:
  ```bash
  # list the private photos for the finish photo wave (the file never enters git or the build)
  [ -d "$SITE/www/faces" ] && (cd "$SITE/www/faces" && ls -1 | grep -Ei '\.(png|jpe?g|webp)$' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(s.split("\n").filter(Boolean))))' > index.json)
  ```
  And add an npm script for local dev: `"faces:index": "node -e \"const fs=require('fs');const d='public/faces';if(fs.existsSync(d))fs.writeFileSync(d+'/index.json',JSON.stringify(fs.readdirSync(d).filter(n=>/\\.(png|jpe?g|webp)$/i.test(n))))\""`. `public/faces/` is git-ignored, so `index.json` stays private too. Verify with `git check-ignore -v web/public/faces/index.json` → prints the ignore rule.
- [ ] **4.5** Tests `tests/photoWave.test.ts`:
  1. `pickPhotos(['arel3.png','Arel1.JPG','nora1.png','arel.txt','index.json'], 'arel')` → `['Arel1.JPG','arel3.png']`.
  2. `wavePos(0, 0, 1000, 800, 100)` → x = −100, scale 0. `wavePos(0, WAVE.travel, ...)` → x = 1100.
  3. `wavePos(3, 0.2, ...)` → null (not started: starts at 0.45 s). `wavePos(0, WAVE.travel + 0.01, ...)` → null.
  4. Rows: for i = 0 and 1 at the same `u`, |y − 0.34·vh| ≤ amp·vh and |y − 0.62·vh| ≤ amp·vh.
  5. The last bubble ends before the overlay does: `(WAVE.count - 1) * WAVE.stagger + WAVE.travel <= WAVE.total`.
- [ ] **4.6 Run** `npx tsc --noEmit && npm test` → Expected: N0 + 14 passed.
- [ ] **4.7 Check** (headless Chrome): `npm run faces:index`, dev server running, open `/?char=arel&level=1&autoplay=1&skip=25&debug=1`; poll `runnerDebug().finished === true`; screenshot at +1.0 s (`photo-wave.png`: several round Arel photos in two wavy rows) and +3.8 s (`photo-finale.png`: big centred photo, gold ring, "Go Arel!", results card behind). Same for `char=nora`. With `char=fox`: no `#photo-wave` element ever appears. Do not commit these PNGs (they contain the children's photos): save them under `/tmp` and add `web/screenshots/photo-*` to `.gitignore`.
- [ ] **4.8** Commit: `feat(web): photo wave and finale for Arel and Nora at the finish`

---

## Task 5: In-app updates (the Home Screen app pulls the newest version)

### Problem
The Home Screen app is served cache-first by the service worker. A new deploy changes the cache name, but iPadOS often resumes the app instead of relaunching it, so the kids keep playing the old build for days.

### Behaviour (binding)
- Every build carries a **build id** (the same base-36 timestamp as the cache name) and a human label like `26 Oct 20:15`.
- The build writes `version.json` = `{ "version": "<id>", "label": "<label>" }`. It is **never** precached and never served from cache.
- The app checks `version.json` (network only, `cache: 'no-store'`, 4 s timeout):
  1. at launch;
  2. whenever the app becomes visible again (`visibilitychange` → `visible`, which is how an iPad "reopen" looks);
  3. every 10 minutes while on the menu or map.
- If the remote id differs from the running one, an update is available:
  - **On the menu or map:** apply it **automatically** right away, with a full-screen "Getting the new version…" card (spinner, 1–3 s).
  - **During a run or on the results card:** never interrupt. Show the badge, and apply when the player next lands on the menu or map.
  - Set the Home Screen icon badge: `navigator.setAppBadge?.(1)`. Clear it with `navigator.clearAppBadge?.()` after updating.
- **Update button** on the menu, top right next to the mute button: a round ⟳ button.
  - Normal: plain. Tap → check now; if nothing new, toast `You have the newest version ✓`.
  - Update available: green, with a pulsing dot. Tap → apply now.
  - Offline: toast `No internet, try at home`.
- Tiny version label under the hints: `v 26 Oct 20:15` (so a parent can see which build an iPad runs).
- **Applying an update:**
  1. `reg.update()`;
  2. delete **every** Cache Storage entry;
  3. `location.replace('./?v=<remote id>')`.
- **Never touch `localStorage`** (stars, best score, chosen character and board setting must survive). Test this.

### Code
- [ ] **5.1** `vite.config.ts`: compute once at the top: `const BUILD = Date.now().toString(36);` and `const LABEL = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).replace(',', '');`. Use `BUILD` as the cache suffix (replacing the local `version`). Add `define: { __APP_VERSION__: JSON.stringify(BUILD), __APP_LABEL__: JSON.stringify(LABEL) }` to the config. In `generateBundle`, also `this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: BUILD, label: LABEL }) })`. Do not add `version.json` to `FILES`.
- [ ] **5.2** Declare the globals in `src/env.d.ts` (create it if missing, or add to the existing vite env file): `declare const __APP_VERSION__: string; declare const __APP_LABEL__: string;`. For vitest, add `define: { __APP_VERSION__: '"test"', __APP_LABEL__: '"test"' }` under `test` if tests import `update.ts`. Easiest: keep the globals out of the pure helpers.
- [ ] **5.3** Service worker source in `vite.config.ts`. At the top of the `fetch` listener, after the method/origin check:
  ```js
  const p = new URL(e.request.url).pathname;
  if (p.endsWith('/version.json') || p.includes('/api/') || p.endsWith('/faces/index.json')) return; // always network
  ```
- [ ] **5.4** `scripts/serve-https.mjs`, `cacheControl`: return `'no-store'` for paths ending in `version.json` or `index.json` (keep the other rules).
- [ ] **5.5** Create `src/ui/update.ts`:
  - pure `isNewer(local: string, remote: string | null | undefined): boolean` → `!!remote && remote !== local`;
  - `fetchRemote(): Promise<{ version: string; label: string } | null>` (fetch with `AbortController` 4 s, `cache: 'no-store'`, URL `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, null on any failure);
  - `applyUpdate(remote: string, deps = { caches, sw: navigator.serviceWorker, location })`: show `#updating`, then try `(await deps.sw?.getRegistration())?.update()` and ignore errors. Then `for (const k of await deps.caches.keys()) await deps.caches.delete(k);`, then `deps.location.replace('./?v=' + remote)`. The `deps` parameter exists so the test can pass fakes.
  - `startUpdateWatcher(opts: { canApply: () => boolean; onAvailable: (label: string) => void })`: runs the three checks above. When an update is found and `canApply()`, call `applyUpdate`; else call `onAvailable` and set the icon badge.
  - Skip everything in dev (`!import.meta.env.PROD`) except the button, which then just toasts `Dev build`.
- [ ] **5.6** `index.html` menu: add `<button id="update" class="round" aria-label="Check for updates"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg><i class="dot hidden"></i></button>` next to `#mute`. Add `<div id="version" class="version"></div>` after `.hints`. Add `<div id="updating" class="hidden"><div class="card"><div class="spin"></div>Getting the new version…</div></div>` at body level. CSS: position `#update` like `#mute` but mirrored to the other corner (if `#mute` is top right, put `#update` top left). `.dot` is a 12 px green circle with a pulse animation. `.version` is 11 px, 50 % opacity, white. `#updating` is a full-screen dim overlay (z-index 50) with a centred chunky card.
- [ ] **5.7** `main.ts`: show `v ${__APP_LABEL__}` in `#version`. Wire the button as specified. Call `startUpdateWatcher({ canApply: () => screen === 'menu' || screen === 'map', onAvailable: () => $('update').classList.add('ready') })`. In `show(s)`, when switching to `'menu'` or `'map'` while an update is pending, apply it. Call `navigator.clearAppBadge?.()` at startup.
- [ ] **5.8** Tests `tests/update.test.ts`:
  1. `isNewer('a', 'b')` true; `isNewer('a', 'a')` false; `isNewer('a', null)` false.
  2. `applyUpdate` with fakes: a fake caches holding 2 keys ends empty; `replace` is called once with `./?v=b`; a fake `localStorage` with `character=nora` and progress data is unchanged afterwards.
  3. `applyUpdate` still deletes caches and reloads when `getRegistration` rejects.
- [ ] **5.9 Run** `npx tsc --noEmit && npm test` → Expected: N0 + 17 passed.
- [ ] **5.10 Check** (headless Chrome, production preview `npm run build && npx vite preview --port 4173`):
  1. Open `http://localhost:4173/`, wait for the service worker to activate (`navigator.serviceWorker.controller` non-null after a reload).
  2. Rebuild (new id) and restart preview.
  3. Trigger `document.dispatchEvent(new Event('visibilitychange'))` while on the menu.
  4. Expected within 6 s: the page reloads with `?v=`, `runnerDebug()` reports the new version (add `version: __APP_VERSION__` to the debug object), and a pre-set `localStorage.character` is unchanged.
  
  Add this as `scripts/check-update.mjs`.
- [ ] **5.11** Commit: `feat(web): in-app update check, auto-apply on the menu, update button and version label`

---

## Task 6: Push notifications ("New level!", "Poop mode is here 💩")

### What works and the limits (read once)
- iPadOS/iOS **16.4+** supports Web Push **only for apps added to the Home Screen**, and only after the user **taps a button** that requests permission. Safari tabs never get it.
- The message travels: Mac → Apple's push service (`*.push.apple.com`) → iPad. Both the Mac and the iPad need internet, not just home Wi-Fi.
- **Unproven for this setup:** the game's origin is a home IP/`.local` name with a private CA. Apple's push service is expected to accept it (subscriptions are not tied to public DNS), but this has not been tested. **Step 6.0 is a gate:** if it fails, stop Task 6, revert its changes, and report. Tasks 5, 7–9 still ship.
- Tapping a notification opens the app; Task 5 then updates it automatically on the menu. So the deploy flow becomes "deploy → push → kid taps → newest version".

### Dependency exception
Rule 3 is relaxed for exactly one package: `npm i -D --save-exact web-push@3.6.7`. It is used only by `scripts/push.mjs` on the Mac, never by the game bundle. Run `npm run build` and confirm `web-push` does not appear in `dist/` (`grep -r "web-push" dist` → no output).

### Launchd exception
Rule 9 is relaxed for exactly one command, restarting (not reconfiguring) the existing service so it loads the new server code: `launchctl kickstart -k gui/$(id -u)/com.cagdasatici.subwayrunner`.

### Server (`scripts/serve-https.mjs`, still no dependencies)
- [ ] **6.1** Storage folder `PUSH_DIR = resolve(root, '..', 'push')` (that is `$SITE/push`, outside `www`, never served). On start:
  - create it (mode 0700);
  - if `vapid.json` is missing, generate a P-256 key pair with `crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })`. Export the private key as JWK and store `{ publicKey, privateKey }`:
    - `publicKey`: base64url of `0x04 || x || y` (65 bytes);
    - `privateKey`: the JWK `d` (base64url, 32 bytes).
    
    Mode 0600. Never log the private key.
- [ ] **6.2** Routes:
  - `GET /api/push/key` → `{ "publicKey": "<base64url>" }`.
  - `POST /api/push/subscribe` with body `{ "who": "arel" | "nora" | "other", "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } } }`. Max body 4 kB; else 413.
    - Validate that `endpoint` is `https:` and its host ends with one of `push.apple.com`, `fcm.googleapis.com`, `push.services.mozilla.com`, `notify.windows.com`; else 400.
    - Upsert by `endpoint` into `subscriptions.json` (array of `{ who, subscription, addedAt }`). Write to `subscriptions.json.tmp` then `rename`.
    - Respond 204.
  - `POST /api/push/unsubscribe` with body `{ "endpoint": "..." }` → remove it, 204.
  - Everything under `/api/` gets `Cache-Control: no-store`. Allow `POST` only on these two paths (keep 405 elsewhere).
- [ ] **6.3** Log one line per subscribe/unsubscribe with `who` and the endpoint host only (never the full endpoint or keys).

### Sender (`scripts/push.mjs`, Mac only)
- [ ] **6.4** CLI: `node scripts/push.mjs --body "Poop mode is here 💩" [--title Runner] [--to all|arel|nora|other] [--url ./]`.
  - Reads `$SITE/push/vapid.json` and `subscriptions.json` (`SITE` same default/override as `deploy-local.sh`).
  - `webpush.setVapidDetails('mailto:cagdasatici@users.noreply.github.com', publicKey, privateKey)`.
  - Sends `JSON.stringify({ title, body, url })` with `{ TTL: 86400, urgency: 'normal' }` to each matching subscription.
  - Removes subscriptions that answer 404 or 410, and saves the file.
  - Prints `sent N, removed M, failed K` plus one line per failure with the status code. Exit code 1 if all sends failed.
- [ ] **6.5** `package.json` script `"notify": "node scripts/push.mjs"`. `deploy-local.sh`: at the end, `if [ -n "${NOTIFY:-}" ]; then node scripts/push.mjs --body "$NOTIFY"; fi`, so `NOTIFY="New: poop mode 💩" npm run deploy` deploys and announces in one go.

### Service worker (in `vite.config.ts`'s generated source)
- [ ] **6.6** Add:
  ```js
  self.addEventListener('push', (e) => {
    let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
    e.waitUntil(Promise.all([
      self.registration.showNotification(d.title || 'Runner', { body: d.body || 'Something new is waiting!', icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: 'runner-news', data: { url: d.url || './' } }),
      self.navigator.setAppBadge ? self.navigator.setAppBadge(1).catch(() => {}) : Promise.resolve(),
    ]));
  });
  self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const c = cs.find((w) => w.url.startsWith(self.registration.scope));
      return c ? c.focus().then(() => c.navigate(url)) : self.clients.openWindow(url);
    }));
  });
  ```
  Every push **must** show a notification (iOS revokes the subscription after silent pushes).

### Client (`src/ui/push.ts`)
- [ ] **6.7** Pure helpers:
  - `urlBase64ToUint8Array(s: string): Uint8Array`;
  - `pushSupported(env = { window, navigator })` → true only if `serviceWorker`, `PushManager` and `Notification` all exist **and** the app runs standalone (`matchMedia('(display-mode: standalone)').matches || navigator.standalone === true`).
- [ ] **6.8** Menu button `🔔 News: OFF` / `🔔 News: ON` in `.modes`, styled like `#board-toggle`. Shown only when `pushSupported()`.
  - Tapping it while OFF opens a small chunky sheet: **"Whose iPad is this?"** with buttons **Arel**, **Nora**, **Someone else**.
  - In that button's click handler, **first and synchronously**, call `Notification.requestPermission()`. iOS only allows it inside the gesture, so nothing may be `await`ed before it.
  - Then:
    1. fetch `api/push/key`;
    2. `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`;
    3. POST `api/push/subscribe` with `{ who, subscription: sub.toJSON() }`;
    4. save `localStorage['push-who'] = who` and toast `News is ON 🔔`.
  - If permission is `denied`: toast `Notifications are off. Turn them on in Settings › Notifications › Runner`.
  - Tapping while ON: `sub.unsubscribe()`, POST `api/push/unsubscribe`, toast `News is OFF`.
- [ ] **6.9** At every launch, when permission is `granted`, re-POST the current subscription (subscriptions can rotate; the server upserts). Clear the app badge at launch.
- [ ] **6.10** Tests `tests/push.test.ts`:
  1. `urlBase64ToUint8Array` round-trips a known 65-byte key (first byte 4);
  2. `pushSupported` false in a non-standalone env, true with all features and standalone;
  3. `pushSupported` false when `PushManager` is missing.

### Gate and verification
- [ ] **6.0 GATE (do this right after 6.1–6.8, before the tests in 6.10):**
  1. `npm run deploy`, then `launchctl kickstart -k gui/$(id -u)/com.cagdasatici.subwayrunner`.
  2. `curl -s --cacert "$(mkcert -CAROOT)/rootCA.pem" https://localhost:8843/api/push/key` → a JSON with a ~87-char `publicKey`.
  3. **Stop and ask the human** to:
     - open the Home Screen app on **one** iPad (iPadOS 16.4+; check Settings › General › About);
     - tap 🔔, pick a name, accept.
  4. Then `cat "$HOME/Library/Application Support/SubwayRunner/push/subscriptions.json" | node -e 'const a=JSON.parse(require("fs").readFileSync(0));console.log(a.length, a.map(s=>new URL(s.subscription.endpoint).host))'` → Expected: `1 [ 'web.push.apple.com' ]`.
  5. `npm run notify -- --body "Test from Dad 🚀"` → Expected: `sent 1, removed 0, failed 0`, and the notification appears on the iPad within a minute with the app closed.
  6. **If any step fails** (subscribe throws in the app, no subscription arrives, or Apple returns 403/400), record the exact error and **stop Task 6**:
     - `git checkout -- .`, then `git clean -fd` limited to the new Task 6 files;
     - `npm uninstall web-push`;
     - restart the service once more;
     - report. Continue with Task 7.
- [ ] **6.11 Run** `npx tsc --noEmit && npm test` → Expected: N0 + 20 passed. `grep -r "web-push" dist` → no output.
- [ ] **6.12** `git status --short` must not list anything under `push/`, and no key material anywhere: `git grep -n "privateKey" -- ':!*.md'` only matches code that reads the field, never a key value.
- [ ] **6.13** Commit: `feat: push notifications for the Home Screen app (subscribe per kid, send from the Mac)`

---

## Task 7: Full verification and deploy

- [ ] **7.1** `npx tsc --noEmit && npm test && npm run build` → Expected: N0 + 20 passed (N0 + 17 if the Task 6 gate failed); build OK; gzipped JS grows by less than 20 kB.
- [ ] **7.2** Existing checks still pass: `node scripts/check-touch.mjs`, `check-journey.mjs`, `check-boost.mjs`, `check-offline.mjs` (title `Runner`), and the new `check-update.mjs`.
- [ ] **7.3** Grep for leaks: `git diff main --stat` shows no file under `web/public/faces`; `git ls-files | grep -i -E 'faces/|photo-'` → only source files (`src/gfx/face.ts`, `src/ui/photoWave.ts`, tests), no images.
- [ ] **7.4** `npm run deploy` (runs tests, builds, copies to the home server, writes `faces/index.json`). Expected: the listing includes `faces/index.json` next to the photos.
- [ ] **7.5** Commit any check-script additions: `test(web): headless checks for messes and the photo wave`

## Task 8: GitHub

- [ ] **8.1** Rename the repo: `gh repo rename runner --repo cagdasatici/subway-runner --yes`. Expected: `✓ Renamed repository cagdasatici/runner`. GitHub keeps redirecting the old URL.
- [ ] **8.2** `git remote set-url origin https://github.com/cagdasatici/runner.git && git remote -v`.
- [ ] **8.3** `git push -u origin feat/runner-photos-messes`, then `gh pr create --base main --title "Runner: rename, kid photo wave, dog messes" --body-file <(printf '...')` with a short body listing the five changes and the "kept on purpose" table from Task 1.
- [ ] **8.4** Report the PR URL. **Do not merge**: the human merges, then runs `scripts/redeploy.sh`.

## Task 9: Hand-off for the human (print this, do not do it)

Renaming the folder from inside the session would pull the working directory out from under the agent, so the agent prints these steps instead:

```bash
# after merging the PR, with no editor or Claude Code session open in the folder:
mv ~/Projects/Subway_Runner ~/Projects/Runner
cd ~/Projects/Runner && git pull && scripts/redeploy.sh
grep -rIl "Subway_Runner" ~/Projects --include='*.md' --include='*.json' --include='*.sh' 2>/dev/null | grep -v node_modules   # any other project (e.g. a control tower) that points at the old path
```
Expected: the home server keeps working unchanged (its paths do not depend on the repo folder); the iPad picks up "Runner" after the next open on home Wi-Fi. The Home Screen icon keeps its old label until it is removed and re-added from Safari (iOS caches the name at install).

---

## Acceptance (what the human will test on the iPad)

1. Home Screen / tab / menu say **Runner**.
2. Play a level as **Bella**: poops and puddles appear in free lanes; running over one shows the close-up with "EWWW!" / "OOPS!", a giggle, the mess stays on the dog ~5.5 s, then a tub and bubbles with "Bath time!". Jumping over avoids it. Never a crash.
3. Same as **Toby**. As any other character: no messes.
4. Finish a level as **Arel**: his photos wave across the screen, then a big "Go Arel!" photo; same for **Nora** with hers. Crashing shows nothing. Other characters: nothing.
5. No photo is in the GitHub repo.
6. Deploy a new build while the iPad app is open on the menu. Switch to another app and back: within a few seconds it shows "Getting the new version…" and reloads, with stars and character kept. The version label under the menu changes. Mid-run it waits until the menu.
7. (If the Task 6 gate passed) On each kid's iPad: tap 🔔, pick the name, accept. Then run `NOTIFY="Poop mode is here 💩" npm run deploy` on the Mac. The notification arrives with the app closed; tapping it opens the game on the new version.
