// Port of App/GameController.swift + the menu backdrop: one WebGL canvas, two modes (menu, playing).
// A run is either endless (RunSession) or a journey level (LevelRun, finite with a finish line and golden stars).
// Fixed-step loop: one tick per Runner.dt, at most 8 ticks per frame (extra time dropped).
import { setMaxAnisotropy } from './gfx/textures';
import * as THREE from 'three';
import { autopilotMove, Solver } from './core/autopilot';
import { LevelRun } from './core/level';
import { addCoins, newStreak } from './core/streak';
import { ENDLESS_PACE, isGrounded, Power, Runner, RunSession, score, speedOf, type Move, type Pace, type RunnerState, type StartOptions } from './core/runner';
import { coinY, laneX, obstacleLength, type Coin, type Track } from './core/track';
import { RunnerFigure } from './gfx/character';
import { characterById, loadCharacter } from './gfx/characters';
import { CoinRenderer } from './gfx/coins';
import { PowerVisuals } from './gfx/powerups';
import { MagnetEffect } from './gfx/magnet';
import { ParticlePool } from './gfx/effects';
import { GoldenStarRenderer } from './gfx/goldStars';
import { createMaterials, type Materials } from './gfx/materials';
import { createEnvMaterials, type EnvMaterials } from './gfx/envMaterials';
import { confettiTexture, sparkleTexture } from './gfx/envTextures';
import { PostFx } from './gfx/post';
import { ENDLESS_THEME, MENU_THEME, themeForWorld, type Theme } from './gfx/themes';
import { disposeGroup, Environment, makeFinishArch, makeObstacle, makeSegment, SEGMENT_LENGTH } from './gfx/world';

export type Quality = 'low' | 'high';
const HIGH_DPR = 2, LOW_DPR = 1.25, HIGH_SHADOW = 2048, LOW_SHADOW = 512;

const VIEW_AHEAD = 115;
const CELEBRATE_SECONDS = 2.8; // fireworks + celebration after the finish line, then the results card
const COAST_SECONDS = 1.0;      // the runner jogs on past the line, then stops to celebrate
const FIREWORK_COLORS = [0xf472b6, 0x60a5fa, 0xfde047, 0x4ade80, 0xfb923c, 0xc084fc];

export interface GameEvents {
  onScore(score: number, coins: number): void;
  onCrash(score: number, coins: number): void;
  onJump(): void;
  onCoin(): void;
  onStar(taken: number): void;
  onProgress(fraction: number): void;
  onBoost?(on: boolean): void;
  onStreak?: (n: number) => void;
  onCoinFly?(px: number, py: number): void; // screen position (CSS px) of a coin just collected
  onFinish(run: LevelRun): void;
  /** The runner just crossed the finish line (start the finish fanfare here). */
  onFinishLine?(run: LevelRun): void;
  onSpeed?(mps: number): void; // runner speed every frame (drives the adaptive music)
  onPower(p: PowerHud): void;
  onToast(text: string): void;
}

/** What the HUD needs to draw the power-up rings (fractions 0…1 of the time left) and the landing warning. */
export interface PowerHud { board: number; magnet: number; sneakers: number; double: number; fly: number; landing: number; chaser: boolean; lightning: boolean }

/** What the loop needs from either kind of run. */
interface Play {
  state: RunnerState;
  track: Track;
  pace: Pace;
  level: LevelRun | null;
  tick(move: Move, boost?: boolean): void;
  readonly over: boolean;
}

function endlessPlay(seed: bigint, opts: StartOptions): Play {
  const s = new RunSession(seed, opts);
  return {
    get state() { return s.state; },
    get track() { return s.track; },
    pace: ENDLESS_PACE,
    level: null,
    tick: (m, b) => s.tick(m, b),
    get over() { return s.state.crashed; },
  };
}

function levelPlay(n: number, opts: StartOptions): Play {
  const r = new LevelRun(n, opts);
  return {
    get state() { return r.state; },
    track: r.level.track,
    pace: r.level.spec.pace,
    level: r,
    tick: (m, b) => r.tick(m, b),
    get over() { return r.over; },
  };
}

/** Copy of the state with a forced pose (debug screenshots only). */
function forcePose(s: RunnerState, pose: string): RunnerState {
  const v = { ...s };
  switch (pose) {
    case 'slide': v.slideTicks = 72 - Math.floor((performance.now() / 8.33) % 72); break; // repeating roll
    case 'jump': v.y = 0.9; v.vy = 2; break;
    case 'crash': v.crashed = true; break;
    case 'fly': v.fly = 500; v.y = 4.4; v.flyUp = 108; break;
    case 'board': v.board = 3000; break;
    case 'stumble': v.stumbles += 1; break;
    case 'chaser': v.chaser = 240; break;
    case 'chaser-close': v.chaser = 240; v.slow = 30; break;
  }
  return v;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(66, 1, 0.1, 160);
  private mats: Materials;
  private envMats: EnvMaterials;
  private env: Environment;
  private post: PostFx;
  private theme: Theme = MENU_THEME;
  quality: Quality = 'high';
  private qualityLocked = false;
  private frameTime = 0;
  private lean = 0;
  private camX = 0;
  private sparkles = new ParticlePool(120, true, sparkleTexture());
  private confetti = new ParticlePool(260, false, confettiTexture());
  private figure: RunnerFigure;
  private coins: CoinRenderer;
  private power = new PowerVisuals();
  private lastHud = '';
  private lastCounters = [0, 0, 0, 0];
  private stars = new GoldenStarRenderer();
  private finishArch: THREE.Group | null = null;
  private dust = new ParticlePool(160, false);
  private glow = new ParticlePool(900, true);
  private magnet = new MagnetEffect();
  private fireworkTimer = 0;
  private segments = new Map<number, THREE.Group>();
  private obstacleNodes = new Map<number, THREE.Group>();
  private play: Play | null = null;
  private mode: 'menu' | 'playing' = 'menu';
  private autoplay = false;
  private solver = new Solver(true);
  private idle = false;
  private pending: Move[] = [];
  private boost = false; // held: SPACE or a still finger
  private boostFov = 0; // 0…1 eased FOV widening
  private last: number | null = null;
  private acc = 0;
  private time = 0;
  private shake = 0;
  private camY = 0;
  private crashHandled = false;
  private finishT = -1; // seconds since the finish line (-1 = not finished)
  private lastScore = -1;
  private lastCoins = -1;
  private streak = newStreak();
  private lastStars = 0;
  private lastProgress = -1;
  private lastJumpTick = -100;
  private dustTimer = 0;
  private frameDt = 0;
  private popped = new Set<number>(); // coin ids already shown popping
  private pixelRatio: number;
  private frames = 0;

  constructor(canvas: HTMLCanvasElement, private events: GameEvents, forced?: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.info.autoReset = false; // post passes add up: reset once per frame
    if (forced) { this.quality = forced; this.qualityLocked = true; }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? HIGH_DPR : LOW_DPR);
    setMaxAnisotropy(Math.min(this.renderer.capabilities.getMaxAnisotropy(), this.quality === 'high' ? 8 : 2));
    this.renderer.setPixelRatio(this.pixelRatio);
    this.mats = createMaterials();
    this.envMats = createEnvMaterials();
    this.env = new Environment(this.scene, this.renderer, this.envMats, this.quality === 'high' ? HIGH_SHADOW : LOW_SHADOW);
    this.post = new PostFx(this.renderer);
    this.post.enabled = this.quality === 'high';
    this.applyTheme(MENU_THEME);
    this.figure = new RunnerFigure(this.mats, loadCharacter());
    this.figure.pivot.add(this.power.jetpack.group);
    this.figure.onReady = () => { const d = characterById(this.figure.characterId); this.power.jetpack.place(d.height, d.slide === 'clip'); };
    this.figure.preloadAll();
    this.coins = new CoinRenderer(this.mats);
    this.scene.add(this.power.group, this.figure.root, this.coins.group, this.stars.group, this.dust.points, this.glow.points, this.sparkles.points, this.confetti.points, this.magnet.group);
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
    this.sparkles.setScale(px);
    this.confetti.setScale(px);
    this.post.resize();
  }

  private applyTheme(t: Theme): void {
    this.theme = t;
    this.env.apply(t);
    this.post.setTheme(t);
  }

  /** Swipes and keys queue moves; one is applied per tick (like the iOS NSLock queue). */
  queue(move: Move): void {
    if (this.mode === 'playing' && !this.autoplay) this.pending.push(move);
  }

  /** Hold-to-speed-up (see Boost in core/runner.ts). Only has an effect while a run is in progress. */
  setBoost(on: boolean): void {
    if (on && (this.mode !== 'playing' || this.autoplay)) return;
    if (this.boost === on) return;
    this.boost = on;
    this.events.onBoost?.(on);
  }

  /** Debug/test only (?pose=slide|jump|crash|fly|board|stumble): forces the runner's pose while playing. */
  debugPose: string | null = null;

  get character(): string { return this.figure.characterId; }
  setCharacter(id: string): void { this.figure.setCharacter(id); }

  showMenu(): void {
    this.setBoost(false);
    this.mode = 'menu';
    this.play = null;
    this.clearDynamic();
    this.clearSegments();
    this.applyTheme(MENU_THEME);
    for (let k = -7; k <= 1; k++) this.addSegment(k); // the menu camera looks back along +z
    this.env.follow(0, 0);
  }

  /** Endless run. `skipSeconds` fast-forwards the simulation before the first frame (screenshots/tests; 0 in normal play). */
  startRun(seed: bigint, autoplay: boolean, idle: boolean, skipSeconds = 0, opts: StartOptions = {}): void {
    this.begin(endlessPlay(seed, opts), autoplay, idle, skipSeconds);
  }

  /** Journey level n (1…120). */
  startLevel(n: number, autoplay: boolean, idle: boolean, skipSeconds = 0, opts: StartOptions = {}): void {
    this.begin(levelPlay(n, opts), autoplay, idle, skipSeconds);
  }

  private begin(play: Play, autoplay: boolean, idle: boolean, skipSeconds: number): void {
    this.mode = 'playing';
    this.autoplay = autoplay;
    this.idle = idle;
    this.play = play;
    this.solver.reset();
    this.figure.reset();
    this.pending = [];
    this.setBoost(false);
    this.acc = 0;
    this.shake = 0;
    this.crashHandled = false;
    this.finishT = -1;
    this.lastScore = this.lastCoins = this.lastProgress = -1;
    this.lastStars = 0;
    this.streak = newStreak();
    this.lastJumpTick = -100;
    this.lastHud = '';
    this.lastCounters = [0, 0, 0, 0];
    this.clearDynamic();
    this.clearSegments();
    const level = play.level;
    this.applyTheme(level ? themeForWorld(level.level.spec.world) : ENDLESS_THEME);
    this.stars.set(level ? level.level.stars : []);
    if (level) {
      this.finishArch = makeFinishArch(level.level.finishZ, this.envMats);
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
      this.figure.menuPose(this.time, dt);
      const a = 0.35 * Math.sin(this.time * 0.3);
      this.camera.position.set(4.4 * Math.sin(a), 1.7, -6.0 * Math.cos(a));
      this.camera.fov = 52;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(0, 0.7, 0);
    } else if (this.play) {
      const play = this.play;
      if (!play.over) {
        this.acc += dt;
        let ticks = 0;
        while (this.acc >= Runner.dt && ticks < 8) {
          this.acc -= Runner.dt;
          ticks++;
          play.tick(this.nextMove(), this.boost);
          if (play.over) { this.setBoost(false); break; }
        }
        if (ticks === 8) this.acc = 0;
      } else if (play.level?.finished && this.finishT < COAST_SECONDS) {
        for (let i = 0; i < Math.round(dt / Runner.dt); i++) play.level.coast();
      }
      this.sync();
      this.report(dt);
    }
    this.dust.update(dt);
    this.glow.update(dt);
    this.sparkles.update(dt);
    this.confetti.update(dt);
    this.env.placeBackdrop(this.camera, this.mode === 'menu');
    this.env.tick(this.time, this.camera);
    this.renderer.info.reset();
    this.post.render(this.scene, this.camera);
    this.adaptQuality(dt);
  }

  /** Forget the frame clock (after the tab was hidden) so the next frame doesn't jump. */
  resetClock(): void { this.last = null; }

  drawCalls(): number { return this.renderer.info.render.calls; }
  triangles(): number { return this.renderer.info.render.triangles; }

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
      return p.level ? this.solver.next(p.state, p.track, p.pace, p.level.level.stars, p.level.starsTaken) : autopilotMove(p.state, p.track);
    }
    return this.pending.shift() ?? 'none';
  }

  private report(dt: number): void {
    const p = this.play!, s = p.state, level = p.level;
    if (s.vy > 0 && s.tick - this.lastJumpTick > 30) { this.lastJumpTick = s.tick; this.events.onJump(); }
    if (this.lastCoins >= 0 && s.coins !== this.lastCoins) {
      this.events.onCoin();
      const m = addCoins(this.streak, s.coins - this.lastCoins, this.time);
      if (m > 0) this.events.onStreak?.(m);
    }
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
          this.confetti.burst(0, 6, -level.level.finishZ, 220, { color: 0xffffff, palette: [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xec4899, 0xffffff], speed: 7, life: 1.8, size: 0.34, gravity: 5, dir: [0, 0.7, 0.3], spread: 1.2 });
          this.events.onFinishLine?.(level);
        }
        const before = this.finishT;
        this.finishT += dt;
        this.fireworks(s.x, -s.z, dt);
        if (before < CELEBRATE_SECONDS && this.finishT >= CELEBRATE_SECONDS) this.events.onFinish(level);
      }
    }
    const hud: PowerHud = {
      board: s.board / Power.boardTicks, magnet: s.magnet / Power.magnetTicks, sneakers: s.sneakers / Power.sneakersTicks,
      double: s.double / Power.doubleTicks, fly: s.fly / Power.flyTicks, chaser: s.chaser > 0, lightning: s.fly > 0 && this.boost,
      landing: s.fly > 0 && s.fly <= Power.flyWarnTicks ? Math.ceil(s.fly / 120) : s.descend > 0 ? 1 : 0,
    };
    const key = [hud.board, hud.magnet, hud.sneakers, hud.double, hud.fly].map((v) => Math.round(v * 60)).join(',') + `${hud.landing}${hud.chaser}${hud.lightning}`;
    if (key !== this.lastHud) { this.lastHud = key; this.events.onPower(hud); }
    const [nm, cb, bb, sb] = this.lastCounters;
    if (s.nearMisses !== nm) this.events.onToast('Close! +25');
    else if (s.combos !== cb) this.events.onToast('Combo! +50');
    else if (s.boardBreaks !== bb) { this.events.onToast('Board saved you!'); this.glow.burst(s.x, s.y + 0.5, -s.z, 70, { color: 0x5eead4, speed: 5, life: 0.6, size: 0.28, gravity: 4, colorJitter: 0.5 }); this.shake = 0.2; }
    else if (s.stumbles !== sb) { this.events.onToast('Oof! Keep going!'); this.shake = 0.25; }
    this.lastCounters = [s.nearMisses, s.combos, s.boardBreaks, s.stumbles];
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
        this.dust.burst(s.x, s.y + 0.05, -s.z + 0.25, 1, { color: 0xd6cfc4, speed: 1.4, life: 0.45, size: 0.25, dir: [0, 0.7, 0.7], spread: 0.5 });
      }
    }
  }

  /** Fireworks bursting in the sky behind the runner (as the camera sees it) while it celebrates. */
  private fireworks(x: number, z: number, dt: number): void {
    if (this.finishT > CELEBRATE_SECONDS) return;
    this.fireworkTimer -= dt;
    while (this.fireworkTimer <= 0) {
      this.fireworkTimer += 0.22 + Math.random() * 0.2;
      const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      // ahead of the runner while the camera is behind it, behind the runner once the camera has swung to the front
      const bz = this.finishT < COAST_SECONDS ? z - 8 - Math.random() * 10 : z + 6 + Math.random() * 10;
      const bx = x + (Math.random() * 2 - 1) * 6, by = 5 + Math.random() * 4;
      this.glow.burst(bx, by, bz, 70, { color, speed: 5.5, life: 1.1, size: 0.34, gravity: 2.5, colorJitter: 0.25 });
      this.glow.burst(bx, by, bz, 14, { color: 0xffffff, speed: 1.5, life: 0.35, size: 0.5 }); // bright core flash
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
      if (o.z >= s.z + VIEW_AHEAD || o.z + obstacleLength(o) < s.z - 10) continue;
      live.add(o.id);
      if (!this.obstacleNodes.has(o.id)) { const g = makeObstacle(o, this.envMats, this.theme); this.obstacleNodes.set(o.id, g); this.scene.add(g); }
    }
    for (const [id, g] of this.obstacleNodes) if (!live.has(id)) { this.scene.remove(g); disposeGroup(g); this.obstacleNodes.delete(id); }

    const visible: Coin[] = [];
    for (const c of track.coins) {
      if (c.z >= s.z + VIEW_AHEAD || c.z < s.z - 5) continue;
      if (s.collected.has(c.id)) {
        if (!this.popped.has(c.id)) {
          this.popped.add(c.id);
          if (this.events.onCoinFly) {
            const v = new THREE.Vector3(laneX(c.lane), coinY(c), -c.z).project(this.camera);
            this.events.onCoinFly((v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight);
          }
          // a magnet-pulled coin is drawn at the runner when the core collects it: pop it there
          const far = this.magnet.level > 0 && Math.abs(laneX(c.lane) - s.x) > 0.6;
          const px = far ? s.x : laneX(c.lane), py = far ? s.y + 1 : coinY(c);
          if (far) this.coins.popAt(px, py, -c.z, c.id); else this.coins.pop(c);
          this.glow.burst(px, py, -c.z, 16, { color: 0xfde047, speed: 3.5, life: 0.35, size: 0.16 });
          this.sparkles.burst(px, py, -c.z, 6, { color: 0xffffff, speed: 2.5, life: 0.5, size: 0.34 });
        }
      } else visible.push(c);
    }
    this.magnet.update(s.magnet > 0 && !s.crashed, s.x, s.y, -s.z, this.time, this.frameDt);
    const ms = this.magnet.level;
    this.coins.update(visible, this.time, this.frameDt, ms > 0 ? {
      x: s.x, y: s.y + 1, z: -s.z, strength: ms, arrive: Power.magnetRadius,
      onStream: (x, y, z, t) => {
        if (Math.random() < 0.35 * t) this.glow.burst(x, y, z, 1, { color: 0xfde68a, speed: 0.6, life: 0.4, size: 0.14, colorJitter: 0.3 });
      },
    } : undefined);
    if (p.level) this.stars.update(p.level.starsTaken, this.time, this.frameDt);

    const vs = this.debugPose ? forcePose(s, this.debugPose) : s;
    this.power.update(vs, track.pickups, this.time, VIEW_AHEAD, this.frameDt, this.glow);
    const celebrating = !!p.level?.finished && this.finishT >= COAST_SECONDS;
    if (this.debugPose === 'celebrate') this.figure.celebrate(this.time % 3, this.frameDt, vs);
    else if (celebrating) this.figure.celebrate(this.finishT - COAST_SECONDS, this.frameDt, vs);
    else this.figure.pose(vs, this.frameDt, speedOf(s, p.pace));
    // crash-proof for a moment after landing (or a stumble): the runner blinks
    this.figure.root.visible = !(s.iframes > 0 && !s.crashed && s.fly === 0 && Math.floor(this.time * 14) % 2 === 0);
    if (s.fly > 0 && this.boost && !s.crashed) { // lightning: streaks of light rushing past
      for (let k = 0; k < 2; k++) this.glow.burst(s.x + (Math.random() - 0.5) * 7, s.y + Math.random() * 4, -s.z - 14 - Math.random() * 8, 1, { color: k ? 0xfde047 : 0x67e8f9, speed: 1, life: 0.25, size: 0.22, dir: [0, 0, 1], spread: 0.1 });
    }
    this.events.onSpeed?.(speedOf(s, p.pace));
    this.boostFov += ((this.boost ? 1 : 0) - this.boostFov) * Math.min(1, this.frameDt * 8);
    this.camera.fov = 66 + (speedOf(s, p.pace) - Runner.startSpeed) + (s.fly > 0 ? 16 : 12) * this.boostFov; // 66° → 76° as it speeds up, +12° boosted
    this.camera.updateProjectionMatrix();
    const flyingNow = s.fly > 0 || s.descend > 0;
    const camTarget = flyingNow ? s.y * 0.72 : s.floor * 0.7;
    this.camY += (camTarget - this.camY) * Math.min(1, this.frameDt * (flyingNow ? 2.6 : 5)); // flight: slow, floaty follow
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - this.frameDt);
      const k = this.shake / 0.28;
      sx = Math.sin(this.time * 90) * 0.22 * k;
      sy = -sx * 0.6;
    }
    this.camera.position.set(s.x * 0.6 + sx, 4.0 + this.camY + sy, -s.z + 7.2);
    this.lean += ((s.x - this.camX) * -0.35 - this.lean) * Math.min(1, this.frameDt * 10);
    this.lean = Math.max(-0.05, Math.min(0.05, this.lean));
    this.camX = s.x;
    this.camera.rotation.set(-0.2, 0, this.lean);
    if (celebrating) {
      // swing round to the runner's front, close and low, so the celebration fills the frame
      const k = Math.min(1, (this.finishT - COAST_SECONDS) / 1.0), e = k * k * (3 - 2 * k), a = e * Math.PI;
      const r = 7.2 - 2.4 * e;
      this.camera.position.set(s.x + Math.sin(a) * r * 0.6, s.y + 4.0 - 1.8 * e, -s.z + Math.cos(a) * r);
      this.camera.lookAt(s.x, s.y + 1.0, -s.z);
    }
    this.env.follow(s.x, -s.z);
  }

  private addSegment(k: number): void {
    const g = makeSegment(k, this.envMats, this.theme);
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
    this.power.clear();
    this.popped.clear();
    this.coins.clearPops();
    this.coins.update([], 0, 0);
    this.dust.clear();
    this.glow.clear();
    this.fireworkTimer = 0;
  }

  /** If frames are slow (iPad struggling): first drop bloom/grading and shadow resolution, then render fewer pixels. */
  private adaptQuality(dt: number): void {
    if (dt <= 0 || dt > 0.5 || this.qualityLocked) return; // ignore tab-switch hitches
    this.frames++;
    this.frameTime += dt;
    if (this.frameTime < 2) return; // evaluate over ~2 s windows
    const avg = this.frameTime / this.frames;
    this.frames = 0;
    this.frameTime = 0;
    if (avg <= 0.02) return; // > 20 ms average: step down one notch (dynamic resolution, then low tier)
    if (this.pixelRatio > 1.01) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    } else if (this.quality === 'high') this.setQuality('low');
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.post.enabled = q === 'high';
    this.env.setShadowSize(q === 'high' ? HIGH_SHADOW : LOW_SHADOW);
    this.pixelRatio = Math.min(this.pixelRatio, q === 'high' ? HIGH_DPR : LOW_DPR);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
  }
}
