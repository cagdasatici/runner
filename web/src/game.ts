// Port of App/GameController.swift + the menu backdrop: one WebGL canvas, two modes (menu, playing).
// A run is either endless (RunSession) or a journey level (LevelRun, finite with a finish line and golden stars).
// Fixed-step loop: one tick per Runner.dt, at most 8 ticks per frame (extra time dropped).
import * as THREE from 'three';
import { autopilotMove, Solver } from './core/autopilot';
import { LevelRun } from './core/level';
import { ENDLESS_PACE, isGrounded, Power, Runner, RunSession, score, speedOf, type Move, type Pace, type RunnerState, type StartOptions } from './core/runner';
import { coinY, laneX, obstacleLength, type Coin, type Track } from './core/track';
import { RunnerFigure } from './gfx/character';
import { CoinRenderer } from './gfx/coins';
import { PowerVisuals } from './gfx/powerups';
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
  onSpeed?(mps: number): void; // runner speed every frame (drives the adaptive music)
  onPower(p: PowerHud): void;
  onToast(text: string): void;
}

/** What the HUD needs to draw the power-up rings (fractions 0…1 of the time left) and the landing warning. */
export interface PowerHud { board: number; magnet: number; sneakers: number; double: number; fly: number; landing: number; chaser: boolean }

/** What the loop needs from either kind of run. */
interface Play {
  state: RunnerState;
  track: Track;
  pace: Pace;
  level: LevelRun | null;
  tick(move: Move): void;
  readonly over: boolean;
}

function endlessPlay(seed: bigint, opts: StartOptions): Play {
  const s = new RunSession(seed, opts);
  return {
    get state() { return s.state; },
    get track() { return s.track; },
    pace: ENDLESS_PACE,
    level: null,
    tick: (m) => s.tick(m),
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
  private power = new PowerVisuals();
  private lastHud = '';
  private lastCounters = [0, 0, 0, 0];
  private stars = new GoldenStarRenderer();
  private finishArch: THREE.Group | null = null;
  private dust = new ParticlePool(160, false);
  private glow = new ParticlePool(400, true);
  private segments = new Map<number, THREE.Group>();
  private obstacleNodes = new Map<number, THREE.Group>();
  private play: Play | null = null;
  private mode: 'menu' | 'playing' = 'menu';
  private autoplay = false;
  private solver = new Solver(true);
  private idle = false;
  private pending: Move[] = [];
  private last: number | null = null;
  private acc = 0;
  private time = 0;
  private shake = 0;
  private camY = 0;
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
    this.scene.add(this.power.group, this.figure.root, this.coins.group, this.stars.group, this.dust.points, this.glow.points);
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
    this.pending = [];
    this.acc = 0;
    this.shake = 0;
    this.crashHandled = false;
    this.finishT = -1;
    this.lastScore = this.lastCoins = this.lastProgress = -1;
    this.lastStars = 0;
    this.lastJumpTick = -100;
    this.lastHud = '';
    this.lastCounters = [0, 0, 0, 0];
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
      return p.level ? this.solver.next(p.state, p.track, p.pace, p.level.level.stars, p.level.starsTaken) : autopilotMove(p.state, p.track);
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
    const hud: PowerHud = {
      board: s.board / Power.boardTicks, magnet: s.magnet / Power.magnetTicks, sneakers: s.sneakers / Power.sneakersTicks,
      double: s.double / Power.doubleTicks, fly: s.fly / Power.flyTicks, chaser: s.chaser > 0,
      landing: s.fly > 0 && s.fly <= Power.flyWarnTicks ? Math.ceil(s.fly / 120) : s.descend > 0 ? 1 : 0,
    };
    const key = [hud.board, hud.magnet, hud.sneakers, hud.double, hud.fly].map((v) => Math.round(v * 60)).join(',') + `${hud.landing}${hud.chaser}`;
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
          this.glow.burst(laneX(c.lane), coinY(c), -c.z, 16, { color: 0xfde047, speed: 3.5, life: 0.35, size: 0.16 });
        }
      } else visible.push(c);
    }
    this.coins.update(visible, this.time, this.frameDt);
    if (p.level) this.stars.update(p.level.starsTaken, this.time, this.frameDt);

    this.power.update(s, track.pickups, this.time, VIEW_AHEAD);
    this.figure.pose(s);
    this.events.onSpeed?.(speedOf(s, p.pace));
    this.camera.fov = 66 + (speedOf(s, p.pace) - Runner.startSpeed); // 66° → 76° as it speeds up
    this.camera.updateProjectionMatrix();
    this.camY += (s.floor * 0.7 - this.camY) * Math.min(1, this.frameDt * 5); // glide up with the roof
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - this.frameDt);
      const k = this.shake / 0.28;
      sx = Math.sin(this.time * 90) * 0.22 * k;
      sy = -sx * 0.6;
    }
    this.camera.position.set(s.x * 0.6 + sx, 4.0 + this.camY + sy, -s.z + 7.2);
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
    this.power.clear();
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
