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
