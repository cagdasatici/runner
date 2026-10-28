// Dog cameos: when the player is not Bella or Toby, the two Maltese pop up beside the track, run to a lane, do a poop or a pee
// and wait for the runner. Run into one and it is launched sky-high; the runner is never affected. Purely visual: nothing here
// touches the simulation, the track or the score, and every cameo is placed by a pure hash of (seed, slot), so replays match.
import * as THREE from 'three';
import { hash01 } from '../core/messes';
import { laneX, obstacleLength, type MessKind, type Track } from '../core/track';
import type { ParticlePool } from './effects';
import { MalteseFigure } from './maltese';
import { makePoop, makePuddle } from './messes';

export type CameoWho = 'bella' | 'toby';
export interface CameoEvent { type: 'appear' | 'bonk' | 'dodge'; who: CameoWho }

const SLOT = 54;           // metres between cameo slots (3 obstacle rows of 18 m, so slots keep their phase between rows)
const FIRST = 85;          // first slot, 9 m from the nearest obstacle row
const CHANCE = 0.7;
const SPAWN_DIST = 72;     // a dog starts running in when the runner is this far away
const ARRIVE_S = 1.0, SQUAT_S = 1.0, MESS_AT = 0.55;
const GRAVITY = 22;
export const CAMEO_NAMES: Record<CameoWho, string> = { bella: 'Bella', toby: 'Toby' };

/** A soft dark disc under something: cheap contact shadow that keeps feet visibly on the ground (also on the low shadow tier). */
export class BlobShadow {
  readonly mesh: THREE.Mesh;
  private static tex: THREE.CanvasTexture | null = null;
  constructor(private size = 1) {
    if (!BlobShadow.tex) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.28)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      BlobShadow.tex = new THREE.CanvasTexture(c);
    }
    const mat = new THREE.MeshBasicMaterial({ map: BlobShadow.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  /** `lift`: height above the surface; the disc shrinks and fades as the thing rises. */
  set(x: number, floorY: number, z: number, lift: number, scale = 1): void {
    const k = Math.max(0, 1 - lift / 5);
    this.mesh.visible = k > 0.02;
    this.mesh.position.set(x, floorY + 0.035, z);
    this.mesh.scale.setScalar(this.size * scale * (0.7 + 0.3 * k));
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * k;
  }
  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

type Phase = 'arrive' | 'squat' | 'wait' | 'flee' | 'bonk';
interface Cameo {
  k: number; who: CameoWho; mess: MessKind; lane: number; z: number; side: 1 | -1;
  phase: Phase; t: number; wrap: THREE.Group; fig: MalteseFigure; blob: BlobShadow;
  vel: THREE.Vector3; spin: THREE.Vector3; yaw: number; messed: boolean; hopped: boolean;
}
export interface CameoRunner { x: number; y: number; z: number; speed: number; flying: boolean }

export class Cameos {
  readonly group = new THREE.Group();
  /** Per-slot chance; the ?cameo=1 test flag raises it to 1. */
  chance = CHANCE;
  /** Testing only (?cameo=1): every dog takes this lane (null = hashed). */
  forceLane: number | null = null;
  private seed = 0;
  private on = false;
  private nextSlot = 0;
  private figs = new Map<CameoWho, MalteseFigure>();
  private active: Cameo[] = [];
  private busy = new Set<CameoWho>();
  private messes: { obj: THREE.Object3D; z: number }[] = []; // left behind by the dogs until the runner is well past

  /** Dogs currently on screen (tests). */
  get activeCount(): number { return this.active.length; }

  /** `shadows`: dogs cast real shadows (off on tablets: a dog is ~80 draw calls more in the shadow pass; the blob shadow stays). */
  constructor(private onEvent: (e: CameoEvent) => void, private shadows = true) {}

  /** Call at the start of every run / menu return. `enabled` is false when the player is Bella or Toby. */
  reset(seed: number, enabled: boolean, z0: number): void {
    for (const c of [...this.active]) this.drop(c);
    for (const m of [...this.messes]) this.dropMessObj(m);
    this.seed = seed;
    this.on = enabled;
    this.nextSlot = Math.max(0, Math.ceil((z0 + 20 - FIRST) / SLOT));
  }

  private fig(who: CameoWho): MalteseFigure {
    let f = this.figs.get(who);
    if (!f) {
      f = new MalteseFigure({ senior: who === 'toby' });
      if (!this.shadows) f.root.traverse((o) => { o.castShadow = false; });
      this.figs.set(who, f);
    }
    return f;
  }

  private blocked(track: Track, lane: number, z: number): boolean {
    return track.obstacles.some((o) => o.lane === lane && o.z < z + 3 && o.z + obstacleLength(o) > z - 3) ||
      track.coins.some((c) => c.lane === lane && Math.abs(c.z - z) < 1.5) ||
      track.pickups.some((p) => p.lane === lane && Math.abs(p.z - z) < 3);
  }

  update(r: CameoRunner, track: Track, dt: number, time: number, glow: ParticlePool, ground = 0): void {
    if (this.on) {
      while (FIRST + this.nextSlot * SLOT - SPAWN_DIST <= r.z) {
        const k = this.nextSlot++, z = FIRST + k * SLOT;
        if (z - r.z < 20 || hash01(this.seed, k, 11) >= this.chance) continue;
        const who: CameoWho = hash01(this.seed, k, 13) < 0.5 ? 'bella' : 'toby';
        if (this.busy.has(who)) continue;
        const first = this.forceLane ?? Math.floor(hash01(this.seed, k, 12) * 3);
        const lane = [0, 1, 2].map((i) => (first + i) % 3).find((l) => !this.blocked(track, l, z)); // the hashed lane, else the next free one
        if (lane === undefined) continue;
        this.spawn(k, who, lane, z);
      }
    }
    for (const c of [...this.active]) this.tick(c, r, dt, time, glow, ground);
    for (const m of [...this.messes]) if (r.z > m.z + 25) this.dropMessObj(m);
  }

  private spawn(k: number, who: CameoWho, lane: number, z: number): void {
    const fig = this.fig(who);
    const wrap = new THREE.Group();
    wrap.add(fig.root);
    fig.root.position.set(0, 0, 0); fig.root.rotation.set(0, 0, 0); fig.root.scale.setScalar(1);
    fig.setMess(null);
    const side: 1 | -1 = hash01(this.seed, k, 14) < 0.5 ? -1 : 1;
    const blob = new BlobShadow(1.5);
    this.group.add(wrap, blob.mesh);
    this.busy.add(who);
    this.active.push({
      k, who, lane, z, side, mess: hash01(this.seed, k, 15) < 0.6 ? 'poop' : 'pee', phase: 'arrive', t: 0, wrap, fig, blob,
      vel: new THREE.Vector3(), spin: new THREE.Vector3(), yaw: 0, messed: false, hopped: false,
    });
    this.onEvent({ type: 'appear', who });
  }

  private drop(c: Cameo): void {
    this.group.remove(c.wrap, c.blob.mesh);
    c.wrap.remove(c.fig.root);
    c.blob.dispose();
    this.busy.delete(c.who);
    this.active.splice(this.active.indexOf(c), 1);
  }

  private dropMessObj(m: { obj: THREE.Object3D; z: number }): void {
    this.group.remove(m.obj);
    m.obj.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh && mesh.geometry.type === 'CircleGeometry') mesh.geometry.dispose(); }); // only the puddle outline is per-instance
    this.messes.splice(this.messes.indexOf(m), 1);
  }

  private tick(c: Cameo, r: CameoRunner, dt: number, time: number, glow: ParticlePool, ground: number): void {
    const spotX = laneX(c.lane), sz = -c.z;
    c.t += dt;
    const grounded = !r.flying && r.y - ground < 0.9;
    const near = Math.abs(r.z - c.z) < 0.9 && Math.abs(r.x - spotX) < 0.85;
    let x = spotX, y = 0, pitch = 0;
    let key: 'run' | 'idle' | 'celebrate' | 'jump' = 'idle';
    let run = 0;

    if (c.phase === 'bonk') {
      c.vel.y -= GRAVITY * dt;
      c.wrap.position.addScaledVector(c.vel, dt);
      c.wrap.rotation.x += c.spin.x * dt; c.wrap.rotation.y += c.spin.y * dt; c.wrap.rotation.z += c.spin.z * dt;
      c.fig.animate('jump', time, time * 30, c.vel.y);
      if (Math.floor(time * 30) % 2 === 0) glow.burst(c.wrap.position.x, c.wrap.position.y, c.wrap.position.z, 1, { color: Math.random() < 0.5 ? 0xfde047 : 0xffffff, speed: 1.2, life: 0.45, size: 0.3, colorJitter: 0.3 });
      const fade = Math.max(0, Math.min(1, 1 - (c.t - 0.95) / 0.45));
      c.wrap.scale.setScalar(Math.max(0.001, fade));
      c.blob.set(c.wrap.position.x, 0, c.wrap.position.z, c.wrap.position.y, fade);
      if (c.t > 1.5 || c.wrap.position.y < -1) this.drop(c);
      return;
    }

    if (c.phase !== 'flee' && near && grounded) { this.bonk(c, r, glow); return; }
    if (c.phase !== 'flee' && r.z > c.z + 1.2) { // the runner went past (jumped over, or another lane): off to the side
      c.phase = 'flee'; c.t = 0;
      if (Math.abs(r.x - spotX) < 0.85) this.onEvent({ type: 'dodge', who: c.who }); // hopped right over it
    }

    switch (c.phase) {
      case 'arrive': {
        const u = Math.min(1, c.t / ARRIVE_S), e = 1 - (1 - u) * (1 - u);
        x = spotX + c.side * 9 * (1 - e);
        c.yaw = c.side > 0 ? Math.PI / 2 : -Math.PI / 2; // facing the way it runs
        key = 'run'; run = c.t * 20;
        if (u >= 1) { c.phase = 'squat'; c.t = 0; }
        break;
      }
      case 'squat': {
        const turn = Math.min(1, c.t / 0.3);
        c.yaw = (c.side > 0 ? Math.PI / 2 : -Math.PI / 2) + (Math.PI - (c.side > 0 ? Math.PI / 2 : -Math.PI / 2)) * turn; // turn to face the runner (+z)
        pitch = 0.38 * Math.min(1, c.t / 0.25);
        if (!c.messed && c.t >= MESS_AT) this.dropMess(c, glow);
        if (c.t >= SQUAT_S) { c.phase = 'wait'; c.t = 0; }
        break;
      }
      case 'wait': {
        c.yaw = Math.PI; key = 'celebrate'; // happy hops while it waits for the runner
        break;
      }
      case 'flee': {
        x = spotX + c.side * c.t * 9;
        c.yaw = c.side > 0 ? Math.PI / 2 : -Math.PI / 2;
        key = 'run'; run = c.t * 20;
        c.wrap.scale.setScalar(Math.max(0.001, 1 - Math.max(0, c.t - 0.9) / 0.5));
        if (c.t > 1.4) { this.drop(c); return; }
        break;
      }
    }
    c.wrap.position.set(x, y, sz);
    c.wrap.rotation.set(0, c.yaw, 0);
    c.fig.root.rotation.x = pitch;
    c.fig.root.position.y = -0.1 * (pitch / 0.38);
    c.fig.animate(key, time, run, 0);
    c.blob.set(x, 0, sz, 0, 1);
  }

  private dropMess(c: Cameo, glow: ParticlePool): void {
    c.messed = true;
    const x = laneX(c.lane), sz = -c.z - 0.55; // under the tail: the dog faces +z
    const m = c.mess === 'poop' ? makePoop(0.9) : makePuddle(c.k + 7);
    m.position.set(x, 0, sz);
    this.group.add(m);
    this.messes.push({ obj: m, z: c.z });
    if (c.mess === 'poop') glow.burst(x, 0.35, sz, 10, { color: 0x9acd32, speed: 1.0, life: 0.7, size: 0.2, gravity: -1.5, dir: [0, 1, 0], spread: 0.4 });
    else glow.burst(x, 0.45, sz, 22, { color: 0xf2d43a, speed: 1.4, life: 0.5, size: 0.14, gravity: 9, dir: [0, 0.3, -1], spread: 0.5 });
  }

  private bonk(c: Cameo, r: CameoRunner, glow: ParticlePool): void {
    c.phase = 'bonk'; c.t = 0;
    const dir = Math.sign(laneX(c.lane) - r.x) || c.side;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    c.vel.set(dir * rnd(4, 10), rnd(14, 18), -(r.speed * 0.9 + rnd(12, 20))); // up, to the side and far ahead of the runner
    c.spin.set(rnd(-1, 1) * 22, rnd(-1, 1) * 18, rnd(-1, 1) * 26);
    const p = c.wrap.position;
    c.fig.root.rotation.x = 0; c.fig.root.position.y = 0;
    glow.burst(p.x, 0.7, p.z, 46, { color: 0xfde047, speed: 6, life: 0.55, size: 0.3, gravity: 3, colorJitter: 0.4 });
    glow.burst(p.x, 0.7, p.z, 18, { color: 0xffffff, speed: 3.5, life: 0.35, size: 0.45 });
    this.onEvent({ type: 'bonk', who: c.who });
  }
}
