# Polish round 2 — crawl, jetpack flight, living sky, HD pass, coin streak

Branch: `claude/game-polish-visuals-5c8dcb` (fast-forwarded to `claude/graphics-gameplay-features-6aadd6` @ 78f2cfd).
All paths are relative to `web/`. Run every command from `web/`.

Executor: Sonnet 5.5, low effort. One slice per agent. Do not redesign; implement exactly what is written.
Every slice ends with:

```bash
npx tsc --noEmit && npx vitest run
```

Both must pass. Then commit ONLY the files the slice lists, with the given subject:

```bash
git add <listed files> && git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- <listed files>
```

Visual check (where a slice asks for it): `npx vite build && (npx vite preview --port 4393 --strictPort &)`, then
`ONLY=adventurer POSES=<poses> node scripts/check-characters.mjs http://127.0.0.1:4393/ /tmp/sr-shots` and Read the PNGs.
Kill the preview server afterwards (`pkill -f "vite preview --port 4393"`).

**Stop and report** (do not improvise) if: a listed symbol does not exist, tests that you did not touch fail,
or a screenshot contradicts the "expected" sentence of the slice.

---

## Slice 1 — Natural feet-first slide for Alex, no stutter when holding down

Files: `src/gfx/character.ts`, `src/main.ts`, `tests/characters.test.ts`
Commit: `feat(web): Alex feet-first slide pose, held down key no longer restarts the slide clip`

Root causes: (a) Alex "crawls" by squashing the whole model to 60 % height while the Run clip plays at 1.4×;
(b) holding the key fires keyboard auto-repeat → `queue('down')` every ~30 ms → `slideTicks` jumps up →
`character.ts` line `if (key === 'slide' && s.slideTicks > this.lastSlide && this.key === 'slide') this.key = null;`
resets the clip each repeat.

1. `src/main.ts`, the `keydown` listener: right after `const m = keys[e.key];`, change `if (m) {` to
   `if (m) { e.preventDefault(); if (e.repeat) return; game.queue(m); }` (keep the existing space/boost branch as is).
   Holding down still extends nothing; a fresh press re-slides. This is intended.
2. `src/gfx/character.ts`:
   - Add constants near the other top-level constants:
     ```ts
     const SLIDE_PHASE = 0.3;   // fraction of the Run clip frozen during a slide: one leg forward, one back
     const SLIDE_LEAN = 1.15;   // rad the humanoid leans back during a slide (feet first, head behind)
     const SLIDE_LIFT = 0.12;   // m the pivot rises so the heel does not sink into the track
     ```
   - Delete the clip-restart line quoted above (and keep `this.lastSlide = s.slideTicks;`).
   - Add `const humanoid = e.def.id === 'adventurer';` next to `const tuck = ...`.
   - Replace the slide-tuck target line with:
     ```ts
     if (key === 'slide' && tuck && humanoid) { pitch = SLIDE_LEAN; squash = 1; }
     else if (key === 'slide' && tuck) { pitch = -0.08; squash = 0.6; }
     ```
     (keep the following `else if (key === 'fly')…` chain unchanged).
   - Easing: replace `const a = dt > 0 ? 1 - Math.exp(-dt * 16) : 1;` with
     `const a = dt > 0 ? 1 - Math.exp(-dt * (key === 'slide' || this.pitch > 0.3 ? 11 : 16)) : 1;`
   - Lift: replace `this.pivot.position.y = 0;` (inside `pose`, not `menuPose`) with
     `this.pivot.position.y = humanoid ? SLIDE_LIFT * Math.max(0, Math.min(1, this.pitch / SLIDE_LEAN)) : 0;`
   - Freeze the stride: in `play()`, in the `if (key !== this.key) { … }` block, after `next.play();` add
     `if (key === 'slide' && !clips.slide && e.def.id === 'adventurer') next.time = next.getClip().duration * SLIDE_PHASE;`
     and in the rate `switch`, change the `'slide'` case to
     `case 'slide': rate = clips.slide ? dur / (Runner.slideDuration * Runner.dt) : e.def.id === 'adventurer' ? 0 : e.def.runSpeed * 1.4; break;`
3. `tests/characters.test.ts`: add one test that `animFor({ ...base, slideTicks: 5 })` is `'slide'` (if it already
   exists, skip this step and list no test file in the commit).

Visual check: POSES=slide,run. Expected: in `slide` Alex leans back feet-first (head closer to the camera than the feet),
not squashed, feet not under the track. If the head goes AWAY from the camera (face-down), flip the sign:
`SLIDE_LEAN = -1.15` and change `this.pitch > 0.3` to `this.pitch < -0.3` and `this.pitch / SLIDE_LEAN` stays. Re-check once; if still wrong, stop and report.

---

## Slice 2 — Living sky: slow colour drift + drifting clouds

Files: `src/gfx/skyDome.ts` (new), `src/gfx/world.ts`, `src/game.ts`
Commit: `feat(web): living sky dome - slow 120 s colour drift and scrolling clouds over the theme sky`

1. Create `src/gfx/skyDome.ts`:
   ```ts
   // Background sky: the theme's equirect sky texture, slowly tinted over a 120 s cycle, with procedural clouds drifting
   // across it. A big inverted sphere that follows the camera; fog off, drawn first.
   import * as THREE from 'three';

   const VERT = `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
   const FRAG = `
   uniform sampler2D sky; uniform float time; uniform vec3 tint; uniform float clouds; varying vec3 vDir;
   float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
   float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
     return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
   float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
   void main() {
     vec3 d = normalize(vDir);
     vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
     vec3 c = texture2D(sky, uv).rgb;
     float k = 0.5 + 0.5 * sin(time * 6.2831853 / 120.0);
     c = mix(c, c * tint * 1.15, k * 0.55);
     if (d.y > 0.02) {
       vec2 q = d.xz / (d.y + 0.25) * 1.6 + vec2(time * 0.012, time * 0.004);
       float m = smoothstep(0.52, 0.78, fbm(q)) * smoothstep(0.02, 0.25, d.y) * clouds;
       c = mix(c, mix(vec3(1.0), tint, 0.25), m * 0.75);
     }
     gl_FragColor = vec4(c, 1.0);
     #include <colorspace_fragment>
   }`;

   export class SkyDome {
     readonly mesh: THREE.Mesh;
     private mat: THREE.ShaderMaterial;
     constructor() {
       this.mat = new THREE.ShaderMaterial({
         uniforms: { sky: { value: null }, time: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, clouds: { value: 1 } },
         vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
       });
       this.mesh = new THREE.Mesh(new THREE.SphereGeometry(140, 48, 24), this.mat);
       this.mesh.renderOrder = -2;
       this.mesh.frustumCulled = false;
     }
     /** `tint` is the colour the sky drifts toward; `clouds` 0…1 (0 for night themes with many stars is fine too). */
     set(sky: THREE.Texture, tint: number, clouds: number): void {
       this.mat.uniforms.sky.value = sky;
       (this.mat.uniforms.tint.value as THREE.Color).setHex(tint);
       this.mat.uniforms.clouds.value = clouds;
     }
     /** Returns 0…1, the current drift amount, so fog can follow it. */
     update(time: number, camera: THREE.Camera): number {
       this.mat.uniforms.time.value = time;
       this.mesh.position.copy(camera.position);
       return (0.5 + 0.5 * Math.sin(time * Math.PI * 2 / 120)) * 0.55;
     }
   }
   ```
2. `src/gfx/world.ts` (the Environment class that has `apply(t: Theme)`):
   - import `SkyDome`; add field `readonly dome = new SkyDome();` and in the constructor `scene.add(this.dome.mesh);`.
   - add field `private fogBase = new THREE.Color();` and `private fogTint = new THREE.Color();`.
   - in `apply`, replace `this.scene.background = this.skyTex;` with `this.scene.background = null;` and add after the
     fog line:
     ```ts
     const tint = t.stars > 0.5 ? 0x8fa8ff : t.sky.mid === 0xf2788a ? 0xffb38a : 0xffd9a8; // night: cooler, sunset: warmer, day: golden hour
     this.dome.set(this.skyTex, tint, t.stars > 0.5 ? 0.35 : 1);
     this.fogBase.setHex(t.fog.color); this.fogTint.setHex(tint);
     ```
     (keep `pmrem.fromEquirectangular(this.skyTex)` — reflections stay static, that is intended.)
   - add method:
     ```ts
     /** Per frame: sky drift and fog colour follow the same slow cycle. */
     tick(time: number, camera: THREE.Camera): void {
       const k = this.dome.update(time, camera);
       (this.scene.fog as THREE.Fog | null)?.color.copy(this.fogBase).lerp(this.fogBase.clone().multiply(this.fogTint).multiplyScalar(1.15), k);
     }
     ```
3. `src/game.ts`: find the field holding the Environment instance (search `apply(` called on it). In `frame()`, right
   before the render call, add `this.<envField>.tick(this.time, this.camera);`. In the menu branch (camera at
   `4.4 * Math.sin(a)`), also call it before rendering. If the menu and play share one render call, one call is enough.

Visual check: POSES=run. Expected: sky still shows the theme gradient (and sun/moon), soft white clouds in the upper sky,
no black background, no seam visible. If the background is black, stop and report.

---

## Slice 3 — Jetpack: lower flight, eased lift-off and landing, early gauge, smoke trail, cooler pack and pickup

Files: `src/core/runner.ts`, `src/game.ts`, `src/gfx/powerups.ts`, `src/main.ts`, `src/style.css`, `index.html`,
`tests/powerups.test.ts`
Commit: `feat(web): jetpack flies lower with eased lift-off/landing, gauge from pickup, smoke trail, new pack and beacon pickup`

### 3a Core (`src/core/runner.ts`)
- `Power`: `flyHeight: 4.4` (comment: "feet height while flying: 0.9 m over the roofs (ROOF_Y 3.5)"),
  `flyRiseTicks: 108` (0.9 s), `flyDescendTicks: 132` (1.1 s).
- `RunnerState`: add `flyFrom: number; // feet height when the jetpack was picked up (lift-off start)` and
  `flyUp: number; // ticks since lift-off, capped at Power.flyRiseTicks`. Initialise both to 0 in `startState`.
- Add above `step`: `const ease = (u: number): number => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };`
- Replace the flying branch's height line `s.y = Math.min(Power.flyHeight, s.y + ...)` with:
  ```ts
  s.flyUp = Math.min(Power.flyRiseTicks, s.flyUp + 1);
  s.y = s.flyFrom + (Power.flyHeight - s.flyFrom) * ease(s.flyUp / Power.flyRiseTicks);
  ```
- Replace the descend line `s.y -= Power.flyHeight / Power.flyDescendTicks;` with:
  ```ts
  s.y = Math.max(s.floor, Power.flyHeight * ease(s.descend / Power.flyDescendTicks));
  ```
  (decrement of `s.descend` stays before it).
- In the `case 'jetpack':` pickup line, set also `s.flyFrom = s.y; s.flyUp = 0;`.
- `tests/powerups.test.ts`: existing tests use `Power.flyHeight` symbolically. Where a test builds a state with
  `fly: …, y: Power.flyHeight`, also add `flyUp: Power.flyRiseTicks, flyFrom: 0` so it starts at cruise height.
  Add test: "lift-off is eased": from `{ ...startState(), fly: Power.flyTicks, flyFrom: 0, flyUp: 0 }` step 10 ticks
  with `Track.fixed([])`, height gain per tick over the first 10 ticks is smaller than over ticks 50–60.
  Add test: "landing is eased and ends on the ground": from `{ ...startState(), fly: 1, y: Power.flyHeight, flyUp: Power.flyRiseTicks, z: 30 }`
  run until `descend === 0`; final `y` is 0 and no tick drops more than `Power.flyHeight / Power.flyDescendTicks * 1.6`.
- `src/game.ts` debug pose `case 'fly':` → `v.fly = 500; v.y = 4.4; v.flyUp = 108;`.

### 3b Camera (`src/game.ts`)
- Replace `this.camY += (s.floor * 0.7 - this.camY) * Math.min(1, this.frameDt * 5);` with:
  ```ts
  const flyingNow = s.fly > 0 || s.descend > 0;
  const camTarget = flyingNow ? s.y * 0.72 : s.floor * 0.7;
  this.camY += (camTarget - this.camY) * Math.min(1, this.frameDt * (flyingNow ? 2.6 : 5)); // flight: slow, floaty follow
  ```
- FOV: change the flying extra from `24` to `16`.

### 3c HUD gauge (`index.html`, `src/main.ts`, `src/style.css`)
- `index.html`: replace the fuel div with
  `<div id="fuel" class="fuel hidden"><b class="jp">🚀</b><span id="fuel-label">JETPACK</span><div class="bar"><i id="fuel-fill"></i></div></div>`
- `src/main.ts` fuel block: show while `p.fly > 0 || p.landing > 0`; label text `p.fly > 0 ? 'JETPACK' : 'LANDING'`;
  when it goes from hidden to shown, add class `pop` and remove it after 450 ms (`setTimeout`). Keep `low` logic.
- `src/style.css`: move `.fuel` to `top: calc(var(--top, 0px) + 96px)`, and add:
  ```css
  .fuel .jp { font-size: 22px; filter: drop-shadow(0 0 6px #22d3ee); }
  .fuel.pop { animation: fuelpop 0.45s cubic-bezier(.2, 1.6, .4, 1); }
  @keyframes fuelpop { 0% { transform: translateX(-50%) scale(0.3); opacity: 0; } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
  ```
  If `--top` + 96 px overlaps the score row in a screenshot, use 120 px.

### 3d Smoke trail and pack (`src/gfx/powerups.ts`)
- New class `SmokeTrail` in the same file:
  - 220 particles, `THREE.Points` with `BufferGeometry` (attributes `position` (vec3), `aLife` (float), `aSize` (float)),
    `ShaderMaterial` transparent, `depthWrite: false`, normal blending, a round soft sprite in the fragment shader
    (`float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r) * vAlpha;`), colour
    `mix(vec3(1.0, 0.75, 0.35), vec3(0.85, 0.88, 0.92), smoothstep(0.0, 0.25, 1.0 - vLife))` (hot orange near the nozzle → grey-white smoke),
    alpha `vLife * 0.55`, point size `aSize * (300.0 / -mvPosition.z)`.
  - CPU arrays for velocity and age; `emit(x, y, z)` takes the next slot (ring buffer), life 1.2 s, size 0.35,
    velocity `(rand(-0.3, 0.3), rand(-1.2, -0.6), rand(0.8, 1.6))`.
  - `update(dt)`: age, move by velocity, velocity *= `Math.exp(-dt * 1.5)`, size grows `+dt * 1.4`, life = 1 - age/1.2,
    dead particles get life 0. Set `needsUpdate` on the three attributes. `frustumCulled = false`.
- `JetpackVisual`:
  - add `readonly trail = new SmokeTrail();` — `PowerVisuals` adds `this.jetpack.trail.points` to its `group` (world space,
    not the pivot). Emit 60 particles/s from both nozzles' world positions (`this.group.localToWorld(new Vector3(±0.14, -0.3, 0))`,
    reuse one temp vector) while `on`; always call `trail.update(dt)` (also when off, so smoke fades out after landing).
  - Restyle: tank material `color 0xdc2626, metalness 0.75, roughness 0.22`; add a thin emissive cyan ring
    (`TorusGeometry(0.1, 0.018, 8, 20)`, `MeshBasicMaterial 0x22d3ee`) around each nozzle, rotated `x = Math.PI / 2`,
    and two fins (`BoxGeometry(0.02, 0.18, 0.12)`, material `metal`) on the outer side of each tank at y 0.0.
  - Flame: inner core colour `0xffffff`, outer `0x60a5fa` blending into `0xfb923c`: keep the two cones, set the outer
    cone colour to `0x38bdf8` when boosted "lightning" — skip if `update` has no boost info (do not add parameters).
- Pickup (`makePickup`, `case 'jetpack'`): replace the two cylinders with: group scale 1.3; two tanks
  `CapsuleGeometry(0.15, 0.45, 4, 12)` with `MeshStandardMaterial({ color: 0xdc2626, metalness: 0.75, roughness: 0.22, emissive: 0x7f1d1d, emissiveIntensity: 0.6 })`
  at x ±0.19; a strap `BoxGeometry(0.62, 0.08, 0.14)` grey `0xe2e8f0`; two flame cones `MeshBasicMaterial 0xfde047`;
  plus a vertical beacon `CylinderGeometry(0.06, 0.32, 6, 16, 1, true)` positioned at y 3.2, `MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })`.
  Keep the existing glow sphere. The pickup already spins/bobs via existing code — do not change that.

Visual check: POSES=fly,run. Expected: jetpack red/chrome with cyan rings, flames visible, character not cropped at top of frame.
Also run `node scripts/check-boost.mjs` and `node scripts/check-journey.mjs` if they take the same args (read their header
comment); they must not throw.

---

## Slice 4 — HD pass (two notches)

Files: `src/game.ts`, `src/gfx/post.ts`, `src/gfx/world.ts`, `src/gfx/envTextures.ts`, `src/gfx/powerups.ts`
Commit: `feat(web): HD pass - ACES tone mapping, half-res bloom, vignette+sharpen, rim light, 2x env textures, standard pickup materials`

Only the high quality tier changes resolution-dependent costs; find the tier variable in `game.ts` (search `tier`).

1. `game.ts` renderer: add `this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;`.
   If post-processing renders to a target and composites with its own shader, ACES on the renderer only applies to the
   final draw: in that case instead add ACES in the COMPOSITE shader (step 2) and leave the renderer at `NoToneMapping`.
   Decide by reading `post.ts`: if the composite shader writes `gl_FragColor` itself → shader route.
2. `post.ts` COMPOSITE: after bloom add and grading, before output, apply (only if `uniform float hd` > 0.5, a new uniform set from the tier, 1 on high):
   ```glsl
   vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
   // sharpen: 4-tap unsharp mask from the scene texture
   vec3 blurN = (texture2D(scene, vUv + vec2(texel.x, 0.0)).rgb + texture2D(scene, vUv - vec2(texel.x, 0.0)).rgb
              + texture2D(scene, vUv + vec2(0.0, texel.y)).rgb + texture2D(scene, vUv - vec2(0.0, texel.y)).rgb) * 0.25;
   c += (c - blurN) * 0.35;
   c = aces(c * 1.05);
   float vig = smoothstep(1.15, 0.35, length(vUv - 0.5) * 1.4); c *= mix(0.82, 1.0, vig);
   ```
   (add `uniform vec2 texel;` to COMPOSITE if missing, set to `1/width, 1/height` of the scene target on resize).
   ACES may darken/dull theme colours: if a screenshot looks clearly duller than before, multiply input by 1.2 instead of 1.05. One retry only.
   Bloom on high tier: bright/blur targets at 1/2 resolution instead of 1/4 (find the divisor).
3. `world.ts`: add a rim light: `DirectionalLight(0xbfe3ff, 0.55)` positioned each frame at camera + (0, 3, -8) relative
   to the runner… simpler: a fixed light at `(−4, 6, 10)` relative to the sun target, `castShadow = false`, added in the
   constructor; intensity × `t.hemi.intensity / 1.5` in `apply`. High tier shadow map: 2048 (find where 1536 is set in game.ts).
4. `envTextures.ts`: every canvas texture size constant (`W = 1024, H = 512` etc., search `canvas(`) doubles on high tier
   is too invasive — instead double them all unconditionally but cap at 2048. Keep anisotropy as is.
5. `powerups.ts`: replace `lambert(col, emissive)` helper body to return `MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.35 })`
   (keep the function name; check its signature first).

Visual check: POSES=run,fly. Expected: crisper edges, richer contrast, slight dark vignette, colours still saturated.
Report the draw-call / frame-cost numbers the script prints before and after (run it once before your edits).

---

## Slice 5 — Coin streak (creative extra)

Files: `src/core/streak.ts` (new), `tests/streak.test.ts` (new), `src/game.ts`, `src/main.ts`, `src/style.css`, `index.html`
Commit: `feat(web): coin streak - x10/x25/x50 toasts for coins collected without a 0.8 s gap`

1. `src/core/streak.ts`:
   ```ts
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
   ```
2. `tests/streak.test.ts`: (a) 10 coins 0.1 s apart → returns 10 exactly once; (b) a 1 s gap resets the count to the new coins; (c) 0 coins returns 0.
3. `src/game.ts`: where `this.lastCoins = s.coins;` is updated, compute `const got = s.coins - this.lastCoins` before it
   (if the existing code has this delta already, reuse it), call `addCoins(this.streak, got, this.time)`, and if it
   returns m > 0 call a new optional event `this.events.onStreak?.(m)`. Add `onStreak?: (n: number) => void` to the events interface.
   Reset `this.streak = newStreak()` wherever a run starts (same place `lastCoins` is reset).
4. `index.html`: add `<div id="streak" class="streak hidden"></div>` next to the fuel div.
   `src/main.ts`: `onStreak: (n) => { const el = $('streak'); el.textContent = `COIN STREAK ×${n}!`; el.classList.remove('hidden'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); setTimeout(() => el.classList.add('hidden'), 1300); }`
   `src/style.css`:
   ```css
   .streak { position: absolute; left: 50%; top: 34%; transform: translateX(-50%); font-size: 30px; font-weight: 900; color: #fde047; -webkit-text-stroke: 2px #92400e; text-shadow: 0 4px 0 #92400e, 0 0 18px #fbbf24; z-index: 6; pointer-events: none; white-space: nowrap; }
   .streak.go { animation: streakgo 1.3s cubic-bezier(.2, 1.4, .4, 1) forwards; }
   @keyframes streakgo { 0% { transform: translateX(-50%) scale(0.2); opacity: 0; } 15% { transform: translateX(-50%) scale(1.15); opacity: 1; } 80% { opacity: 1; } 100% { transform: translateX(-50%) translateY(-40px) scale(1); opacity: 0; } }
   ```
   If `audio.sfx` has a coin-like or power-up sound name, call it in `onStreak` too; otherwise skip.

No visual check required.

---

## Slice 6 — Fix washed-out sky and distant haze

Files: `src/gfx/post.ts`, `src/gfx/world.ts`, `src/gfx/skyDome.ts`
Commit: `fix(web): keep sky and skyline saturated - highlight-only tone curve, farther fog, gentler sky drift`

Root cause: full ACES (`c = aces(max(c, 0.0) * 1.2)`) compresses and desaturates every bright pixel, and the sky and
fogged skyline are all bright, so they go grey. The sky drift (55 %) and cloud mix add even more grey-white.

1. `src/gfx/post.ts` COMPOSITE, inside `if (hd > 0.5) { … }`: replace the line `c = aces(max(c, 0.0) * 1.2);` with
   ```glsl
   // highlight-only shoulder: below 0.8 untouched, above it rolls off smoothly to 1.0; hue kept (scale by max channel)
   float m = max(max(c.r, c.g), c.b);
   if (m > 0.8) { float mm = 0.8 + 0.2 * (1.0 - exp(-(m - 0.8) / 0.2)); c *= mm / m; }
   c = clamp(c, 0.0, 1.0);
   ```
   Delete the now-unused `aces` function. Keep the sharpen and vignette lines as they are.
2. `src/gfx/world.ts` `apply()`: change the fog line to
   `this.scene.fog = new THREE.Fog(t.fog.color, t.fog.near * 1.25, t.fog.far * 1.2);`
3. `src/gfx/skyDome.ts`: in FRAG change `k * 0.55` to `k * 0.35` and `m * 0.75` to `m * 0.55`; in `update()` change the
   returned `* 0.55` to `* 0.35`.

Verify: `npx tsc --noEmit` and `npx vitest run tests/streak.test.ts` (no logic changed; the full suite takes 6 min — skip it).
Visual check: POSES=run, screenshots to `/tmp/sr-shots-s6`, compare against `/tmp/sr-shots-s4-before/characters-adventurer-run.png`
(the pre-HD shot). Expected: sky blue as saturated as or more than the before shot; distant buildings coloured, not grey;
edges still crisp. If the sky is still clearly greyer than before, stop and report (do not try further changes).

---

## Slice 7 — Clear blue sky band on day themes

Files: `src/gfx/envTextures.ts`, `src/gfx/themes.ts`
Commit: `feat(web): clear blue visible sky on day themes - bluer horizon/mid colours, gradient mid stop lowered`

Root cause: the gameplay camera only sees the sky just above the horizon (texture rows ~0.35–0.5), where day themes
are near-white (`horizon` ≈ 0xd9f0fb), and `mid` sits high at stop 0.28.

1. `src/gfx/envTextures.ts` `skyTexture`: change `g.addColorStop(0.28, hex(t.sky.mid));` to `g.addColorStop(0.4, hex(t.sky.mid));`.
2. `src/gfx/themes.ts` — change ONLY these values (exact replacements; leave every other field and theme alone):
   | theme id | `sky.mid` | `sky.horizon` | `sky.below` | `fog.color` |
   |---|---|---|---|---|
   | `sunny-city` | `0x4fb0f5` | `0xa8dcf7` | `0xa8dcf7` | `0xb8e2f8` |
   | `snow-village` | `0x8fbdf0` | `0xcfe5f8` | `0xcfe5f8` | `0xd6e8f8` |
   | `harbour-bay` | `0x4aaaf0` | `0xa6d8f5` | `0xa6d8f5` | `0xb4dcf4` |
   | `autumn-park` | `0x7fbcf0` | unchanged | unchanged | unchanged |
   | `desert-canyon` | `0x6cc0ec` | unchanged | unchanged | unchanged |

Verify: `npx tsc --noEmit` and `npx vitest run tests/streak.test.ts` (if any test file asserts theme colours —
`grep -rn "0xd9f0fb\|0xeef6fd\|0xe0f1fa" tests/` — update those numbers to the new values and also run that test file).
Visual check: POSES=run, screenshots to `/tmp/sr-shots-s7`. Expected: the sky band above the street (level 1-1, sunny city)
is a clearly visible blue, the horizon light blue, distant buildings blend into it without a white band.
If the sky is still mostly grey/white, stop and report.
