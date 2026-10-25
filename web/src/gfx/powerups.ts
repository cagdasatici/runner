// Visuals for power-ups: floating pickups, the board under the feet, the magnet ring, the jetpack and the chaser.
// Pure drawing; the rules live in core/runner.ts. Shared geometry and materials, so nothing here needs disposing per pickup.
import * as THREE from 'three';
import { laneX, type Pickup, type PickupKind } from '../core/track';
import type { RunnerState } from '../core/runner';
import type { ParticlePool } from './effects';
import { dotTexture } from './textures';

const lambert = (color: number, emissive = 0x000000) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.35 });
const glyph = (text: string, bg: string): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; g.font = 'bold 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const COLORS: Record<PickupKind, number> = { board: 0x14b8a6, magnet: 0xef4444, sneakers: 0xf97316, double: 0xfacc15, jetpack: 0x64748b, mystery: 0xa855f7 };

function makePickup(kind: PickupKind): THREE.Group {
  const g = new THREE.Group();
  const col = COLORS[kind];
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false }));
  g.add(glow);
  switch (kind) {
    case 'board': {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.1), lambert(col, 0x0a6b60));
      b.rotation.x = 0.25;
      g.add(b);
      break;
    }
    case 'magnet': {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.11, 10, 20, Math.PI), lambert(col, 0x7f1d1d));
      m.rotation.z = Math.PI;
      g.add(m);
      for (const x of [-0.34, 0.34]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.18, 0.23), lambert(0xf8fafc)); tip.position.set(x, 0.0, 0); g.add(tip); }
      break;
    }
    case 'sneakers': {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.9), lambert(col, 0x7c2d12)));
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.94), lambert(0xf8fafc)); sole.position.y = -0.2; g.add(sole);
      break;
    }
    case 'double':
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ map: glyph('2×', '#ca8a04') })));
      break;
    case 'mystery':
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ map: glyph('?', '#7e22ce') })));
      break;
    case 'jetpack': {
      g.scale.setScalar(1.3);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.75, roughness: 0.22, emissive: 0x7f1d1d, emissiveIntensity: 0.6 });
      for (const x of [-0.19, 0.19]) {
        const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.45, 4, 12), tankMat); c.position.x = x; g.add(c);
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 10), new THREE.MeshBasicMaterial({ color: 0xfde047 })); f.position.set(x, -0.5, 0); f.rotation.x = Math.PI; g.add(f);
      }
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.14), lambert(0xe2e8f0)));
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.32, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beacon.position.y = 3.2;
      g.add(beacon);
      break;
    }
  }
  return g;
}

export class PowerVisuals {
  readonly group = new THREE.Group();
  readonly board = new BoardVisual();
  /** Attach `jetpack.group` to the runner's pivot (see Game). */
  readonly jetpack = new JetpackVisual();
  private nodes = new Map<number, THREE.Group>();
  private chaser = new ChaserBlob();
  private lastBreaks = 0;

  constructor() {
    this.group.add(this.board.group, this.board.fx, this.chaser.group, this.jetpack.trail.points);
  }

  /** Keeps the pickups in the scene in step with the track, and poses the extras around the runner. */
  update(s: RunnerState, pickups: Pickup[], time: number, viewAhead: number, dt = 0, glow?: ParticlePool): void {
    const live = new Set<number>();
    for (const p of pickups) {
      if (s.collected.has(p.id) || p.z > s.z + viewAhead || p.z < s.z - 5) continue;
      live.add(p.id);
      let n = this.nodes.get(p.id);
      if (!n) { n = makePickup(p.kind); this.nodes.set(p.id, n); this.group.add(n); }
      n.position.set(laneX(p.lane), 1.25 + Math.sin(time * 3 + p.id) * 0.12, -p.z);
      n.rotation.y = time * 2.2;
    }
    for (const [id, n] of this.nodes) if (!live.has(id)) { this.group.remove(n); this.nodes.delete(id); }

    const flying = s.fly > 0 || s.descend > 0;
    if (glow) {
      const broke = s.boardBreaks !== this.lastBreaks;
      this.lastBreaks = s.boardBreaks;
      // the board blinks in its last 3 s
      const blink = s.board > 0 && s.board < 360 && Math.floor(time * 12) % 2 === 0;
      const ridden = s.board > 0 && !s.crashed && !flying;
      this.board.update(ridden ? s.board : 0, broke, dt, s.x, s.y, -s.z, glow);
      this.board.group.position.set(s.x, s.y, -s.z);
      this.board.group.rotation.z = -(laneX(s.lane) - s.x) * 0.15;
      this.board.group.visible = ridden && !blink;
      this.jetpack.update(flying && !s.crashed, dt, glow);
    }
    // the magnet's look (field ripples, pulled coins) lives in gfx/magnet.ts, driven from game.ts
    // the chaser runs 3 m behind and drops back as the timer runs out
    const behind = 3 + (1 - Math.min(1, s.chaser / 240)) * 9;
    this.chaser.update(s.chaser > 0 && !s.crashed, dt, s.x, -s.z, behind, s.slow > 0);
  }

  clear(): void {
    for (const n of this.nodes.values()) this.group.remove(n);
    this.nodes.clear();
    this.board.reset();
    this.lastBreaks = 0;
  }
}

const additive = (color: number, opacity = 1, map?: THREE.Texture) =>
  new THREE.MeshBasicMaterial({ color, ...(map ? { map } : {}), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

function stadium(len: number, wid: number): THREE.Shape {
  // pointed nose at -z (shape y axis = board length axis), rounded tail
  const s = new THREE.Shape();
  const hw = wid / 2, hl = len / 2;
  s.moveTo(0, -hl);
  s.bezierCurveTo(hw * 0.9, -hl * 0.7, hw, -hl * 0.25, hw, 0);
  s.lineTo(hw, hl - hw * 0.8);
  s.quadraticCurveTo(hw, hl, hw * 0.35, hl);
  s.lineTo(-hw * 0.35, hl);
  s.quadraticCurveTo(-hw, hl, -hw, hl - hw * 0.8);
  s.lineTo(-hw, 0);
  s.bezierCurveTo(-hw, -hl * 0.25, -hw * 0.9, -hl * 0.7, 0, -hl);
  return s;
}

const SHARDS = 9;

export class BoardVisual {
  /** Child of the runner rig: origin at the feet-on-board level (deck top is at y = 0.17). */
  readonly group = new THREE.Group();
  /** Add to the scene: flying pieces while the board breaks (world space). */
  readonly fx = new THREE.Group();
  private body = new THREE.Group();
  private underGlow: THREE.Mesh;
  private groundGlow: THREE.Mesh;
  private rings: THREE.Mesh[] = [];
  private shards: { m: THREE.Mesh; vx: number; vy: number; vz: number; sx: number; sy: number }[] = [];
  private shardT = -1;
  private wasOn = false;
  private lastValue = 0;
  private appear = 1;
  private trail = 0;
  private t = 0;

  constructor() {
    const deckGeo = new THREE.ExtrudeGeometry(stadium(1.7, 0.5), { depth: 0.07, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 12 });
    deckGeo.rotateX(Math.PI / 2); // shape plane -> XZ, extrusion goes down
    deckGeo.translate(0, 0.14, 0);
    const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.35, roughness: 0.28, emissive: 0x0e7490, emissiveIntensity: 0.5 }));
    deck.castShadow = true;
    // dark grip pad where the feet are
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.5), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.9 }));
    pad.position.set(0, 0.176, 0.05);
    // glowing side rails and nose light
    const railMat = additive(0xa5f3fc);
    for (const x of [-0.25, 0.25]) {
      const rail = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.9, 3, 6), railMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x * 0.85, 0.168, 0.1);
      this.body.add(rail);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), additive(0xffffff));
    nose.position.set(0, 0.15, -0.82);
    // twin thruster rings at the tail
    for (const x of [-0.14, 0.14]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 16), additive(0xf0abfc));
      ring.position.set(x, 0.1, 0.88);
      this.rings.push(ring);
      this.body.add(ring);
    }
    this.underGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.9), additive(0x22d3ee, 0.85, dotTexture()));
    this.underGlow.rotation.x = -Math.PI / 2;
    this.underGlow.position.y = 0.05;
    this.groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), additive(0x22d3ee, 0.5, dotTexture()));
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.body.add(deck, pad, nose);
    this.group.add(this.body, this.underGlow, this.groundGlow);
    this.group.visible = false;

    const shardGeo = new THREE.BoxGeometry(0.2, 0.05, 0.3);
    const shardMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.4 });
    for (let i = 0; i < SHARDS; i++) {
      const m = new THREE.Mesh(shardGeo, shardMat);
      m.visible = false;
      this.fx.add(m);
      this.shards.push({ m, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0 });
    }
  }

  /**
   * Call every frame. `value` = remaining board time (> 0 while riding). (x, y, z) = the rig position in world space.
   * A board that disappears while it still had lots of time left absorbed a crash, so it breaks apart.
   */
  update(value: number, broke: boolean, dt: number, x: number, y: number, z: number, glow: ParticlePool): void {
    const on = value > 0;
    this.t += dt;
    if (on && !this.wasOn) { this.appear = 0; this.group.visible = true; }
    if (!on && this.wasOn) {
      if (broke) this.breakApart(x, y, z, glow);
      else { this.group.visible = false; glow.burst(x, y + 0.1, z, 14, { color: 0x67e8f9, speed: 2, life: 0.4, size: 0.18 }); }
    }
    this.wasOn = on;
    this.lastValue = value;

    if (on) {
      this.appear = Math.min(1, this.appear + dt * 5);
      const pop = this.appear < 1 ? 1 + Math.sin(this.appear * Math.PI) * 0.15 - (1 - this.appear) * 0.6 : 1;
      this.group.scale.setScalar(pop);
      // gentle hover bob and sway; slower flicker on the underside glow
      this.body.position.y = Math.sin(this.t * 7) * 0.025;
      this.body.rotation.z = Math.sin(this.t * 3.1) * 0.025;
      this.body.rotation.x = Math.sin(this.t * 4.3) * 0.015;
      const flick = 0.8 + Math.sin(this.t * 31) * 0.1 + Math.sin(this.t * 13) * 0.1;
      (this.underGlow.material as THREE.MeshBasicMaterial).opacity = 0.85 * flick;
      for (const r of this.rings) r.scale.setScalar(0.9 + (flick - 0.8) * 1.5);
      // ground glow stays on the track below the rig, shrinking as the board rises
      this.groundGlow.position.y = 0.04 - y;
      const k = 1 / (1 + y * 0.7);
      this.groundGlow.scale.set(k, k, 1);
      (this.groundGlow.material as THREE.MeshBasicMaterial).opacity = 0.5 * k;
      // trail: soft cyan/magenta sparks out of the thrusters
      this.trail += dt * 55;
      while (this.trail >= 1) {
        this.trail -= 1;
        const left = Math.random() < 0.5 ? -0.14 : 0.14;
        glow.burst(x + left, y + 0.08, z + 0.85, 1, { color: Math.random() < 0.7 ? 0x22d3ee : 0xe879f9, speed: 1.2, life: 0.42, size: 0.2, dir: [0, 0.05, 1], spread: 0.35 });
      }
    }
    this.updateShards(dt);
  }

  /** Instantly hide and drop everything (new run / menu). */
  reset(): void {
    this.wasOn = false;
    this.lastValue = 0;
    this.group.visible = false;
    this.shardT = -1;
    for (const s of this.shards) s.m.visible = false;
  }

  private breakApart(x: number, y: number, z: number, glow: ParticlePool): void {
    this.group.visible = false;
    this.shardT = 0;
    for (const s of this.shards) {
      s.m.visible = true;
      s.m.position.set(x + (Math.random() - 0.5) * 0.5, y + 0.12, z + (Math.random() - 0.5) * 1.2);
      s.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      s.m.scale.setScalar(0.7 + Math.random() * 0.8);
      s.vx = (Math.random() - 0.5) * 6;
      s.vy = 2.5 + Math.random() * 3.5;
      s.vz = (Math.random() - 0.3) * 5;
      s.sx = (Math.random() - 0.5) * 14;
      s.sy = (Math.random() - 0.5) * 14;
    }
    glow.burst(x, y + 0.2, z, 60, { color: 0x67e8f9, speed: 5, life: 0.6, size: 0.26, gravity: 3, colorJitter: 0.5 });
    glow.burst(x, y + 0.2, z, 25, { color: 0xf0abfc, speed: 4, life: 0.5, size: 0.22, gravity: 3 });
  }

  private updateShards(dt: number): void {
    if (this.shardT < 0) return;
    this.shardT += dt;
    for (const s of this.shards) {
      s.vy -= 14 * dt;
      s.m.position.x += s.vx * dt;
      s.m.position.y = Math.max(0.03, s.m.position.y + s.vy * dt);
      s.m.position.z += s.vz * dt;
      s.m.rotation.x += s.sx * dt;
      s.m.rotation.y += s.sy * dt;
      s.m.scale.multiplyScalar(this.shardT > 0.5 ? 1 - dt * 3 : 1);
    }
    if (this.shardT > 1.1) { this.shardT = -1; for (const s of this.shards) s.m.visible = false; }
  }
}

/** Soft smoke puffs left behind the jetpack: a ring buffer of points in world space (hot orange at the nozzle, grey-white later). */
export class SmokeTrail {
  readonly points: THREE.Points;
  private static readonly N = 220;
  private static readonly LIFE = 1.2;
  private pos = new Float32Array(SmokeTrail.N * 3);
  private lifeA = new Float32Array(SmokeTrail.N);
  private sizeA = new Float32Array(SmokeTrail.N);
  private vel = new Float32Array(SmokeTrail.N * 3);
  private age = new Float32Array(SmokeTrail.N).fill(SmokeTrail.LIFE);
  private next = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.lifeA, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizeA, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute float aLife; attribute float aSize; varying float vLife;
        void main() { vLife = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vLife;
        void main() {
          float vAlpha = vLife * 0.55;
          float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r) * vAlpha;
          vec3 c = mix(vec3(1.0, 0.75, 0.35), vec3(0.85, 0.88, 0.92), smoothstep(0.0, 0.25, 1.0 - vLife));
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number): void {
    const i = this.next;
    this.next = (this.next + 1) % SmokeTrail.N;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = (Math.random() - 0.5) * 0.6;
    this.vel[i * 3 + 1] = -0.6 - Math.random() * 0.6;
    this.vel[i * 3 + 2] = 0.8 + Math.random() * 0.8;
    this.age[i] = 0;
    this.sizeA[i] = 0.35;
    this.lifeA[i] = 1;
  }

  update(dt: number): void {
    const damp = Math.exp(-dt * 1.5);
    for (let i = 0; i < SmokeTrail.N; i++) {
      if (this.age[i] >= SmokeTrail.LIFE) { this.lifeA[i] = 0; continue; }
      this.age[i] += dt;
      for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt; this.vel[i * 3 + k] *= damp; }
      this.sizeA[i] += dt * 1.4;
      this.lifeA[i] = Math.max(0, 1 - this.age[i] / SmokeTrail.LIFE);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aLife.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }
}

export class JetpackVisual {
  /** Attach to the pitched pivot of the runner. */
  readonly group = new THREE.Group();
  private flames: THREE.Mesh[] = [];
  private cores: THREE.Mesh[] = [];
  private t = 0;
  private emit = 0;
  private tmp = new THREE.Vector3();
  readonly trail = new SmokeTrail();
  private trailAcc = 0;

  constructor() {
    const tank = new THREE.CapsuleGeometry(0.1, 0.34, 4, 12);
    const body = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.75, roughness: 0.22 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.1), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 }));
    strap.position.set(0, 0.05, 0);
    this.group.add(strap);
    const flameGeo = new THREE.ConeGeometry(0.1, 0.62, 12, 1, true);
    flameGeo.translate(0, -0.31, 0);
    const coreGeo = new THREE.ConeGeometry(0.055, 0.4, 10, 1, true);
    coreGeo.translate(0, -0.2, 0);
    for (const x of [-0.14, 0.14]) {
      const t = new THREE.Mesh(tank, body);
      t.position.set(x, 0.1, 0);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), metal);
      cap.position.set(x, 0.33, 0);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.1, 12), metal);
      nozzle.position.set(x, -0.19, 0);
      const flame = new THREE.Mesh(flameGeo, additive(0xfb923c, 0.85));
      flame.position.set(x, -0.24, 0);
      const core = new THREE.Mesh(coreGeo, additive(0xfef08a, 0.95));
      core.position.set(x, -0.24, 0);
      t.castShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, -0.24, 0);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.12), metal);
      fin.position.set(x + Math.sign(x) * 0.11, 0.0, 0);
      this.group.add(ring, fin);
      this.flames.push(flame);
      this.cores.push(core);
      this.group.add(t, cap, nozzle, flame, core);
    }
    this.group.visible = false;
  }

  /** Where the pack sits: `height` is the character's standing height, `onBack` offsets it behind a humanoid. */
  place(height: number, humanoid: boolean): void {
    this.group.position.set(0, height * (humanoid ? 0.62 : 0.72), humanoid ? 0.26 : 0.05);
  }

  update(on: boolean, dt: number, glow: ParticlePool): void {
    this.group.visible = on;
    if (on) {
      this.trailAcc += dt * 30; // 30 per nozzle = 60 particles/s
      while (this.trailAcc >= 1) {
        this.trailAcc -= 1;
        for (const x of [-0.14, 0.14]) { this.group.localToWorld(this.tmp.set(x, -0.3, 0)); this.trail.emit(this.tmp.x, this.tmp.y, this.tmp.z); }
      }
    } else this.trailAcc = 0;
    this.trail.update(dt);
    if (!on) return;
    this.t += dt;
    for (let i = 0; i < 2; i++) {
      const f = 0.85 + Math.sin(this.t * 40 + i * 2) * 0.15 + Math.sin(this.t * 23 + i) * 0.1;
      this.flames[i].scale.set(1 + (f - 1) * 0.5, f * 1.2, 1 + (f - 1) * 0.5);
      this.cores[i].scale.set(1, f * 1.3, 1);
    }
    this.emit += dt * 50;
    if (this.emit >= 1) {
      this.group.getWorldPosition(this.tmp);
      while (this.emit >= 1) {
        this.emit -= 1;
        glow.burst(this.tmp.x + (Math.random() < 0.5 ? -0.14 : 0.14), this.tmp.y - 0.5, this.tmp.z + 0.05, 1,
          { color: Math.random() < 0.5 ? 0xfb923c : 0xfde047, speed: 1.5, life: 0.4, size: 0.2, dir: [0, -1, 0.4], spread: 0.3 });
      }
    }
  }
}

/**
 * The chaser: a shadow-smoke wraith. Hooded void with ember eyes, a tapering cloak, ragged tendrils streaming behind it,
 * a violet aura and a handful of rising embers. One group, shared geometry/materials, preallocated ember buffer.
 * Faces -z (towards the runner). Closer than ~5 m it lunges (leans in, eyes flare); a stumble makes it rear up.
 */
export class ChaserBlob {
  readonly group = new THREE.Group();
  private wraith = new THREE.Group();
  private tendrils: THREE.Mesh[] = [];
  private eyes: THREE.Mesh[] = [];
  private aura: THREE.Sprite;
  private embers: THREE.Points;
  private emberData: Float32Array;
  private emberAge: Float32Array;
  private eyeMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private t = 0;
  private lunge = 0;
  private lastGap = 12;

  constructor() {
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x07030f, emissive: 0x1e0a40, emissiveIntensity: 0.55, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x4c1d95, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    // cloak: a flared lathe silhouette
    const prof = [[0, 0], [0.7, 0.05], [0.62, 0.45], [0.44, 0.95], [0.3, 1.35], [0.2, 1.62], [0, 1.7]].map(([x, y]) => new THREE.Vector2(x, y));
    const cloak = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), cloakMat);
    cloak.position.y = 0.2;
    // hood: hunched sphere with a hollow void face
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), cloakMat);
    hood.scale.set(1, 1.05, 1.15);
    hood.position.set(0, 1.85, 0.02);
    const brow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), cloakMat);
    brow.position.set(0, 2.28, 0.05);
    brow.rotation.x = -0.35;
    const voidFace = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: 0x020005 }));
    voidFace.scale.set(0.95, 1, 0.5);
    voidFace.position.set(0, 1.84, -0.34);
    this.wraith.add(cloak, hood, brow, voidFace);
    // glowing ember rifts down the back of the cloak (seen when it trails the runner)
    const rift = new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    for (const [x, y, r, h] of [[0, 0.95, 0, 0.8], [-0.22, 0.75, 0.25, 0.5], [0.24, 0.8, -0.3, 0.55]]) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.05, h), rift);
      c.position.set(x, y, 0.5 - y * 0.18);
      c.rotation.set(0.28, 0, r);
      this.wraith.add(c);
    }
    // slanted ember eyes
    const eyeGeo = new THREE.CircleGeometry(0.11, 12);
    for (const x of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, this.eyeMat);
      e.scale.set(1.5, 0.55, 1);
      e.position.set(x * 0.15, 1.88, -0.5);
      e.rotation.z = -x * 0.45;
      e.rotation.y = Math.PI;
      this.eyes.push(e);
      this.wraith.add(e);
    }
    // arms: two long claws reaching forward
    const claw = new THREE.ConeGeometry(0.09, 0.9, 6);
    for (const x of [-1, 1]) {
      const c = new THREE.Mesh(claw, cloakMat);
      c.position.set(x * 0.5, 1.2, -0.45);
      c.rotation.set(-1.25, 0, x * 0.25);
      this.wraith.add(c);
    }
    // ragged smoke tendrils streaming back (+z)
    const tGeo = new THREE.ConeGeometry(0.1, 1.1, 5, 1, true);
    tGeo.translate(0, -0.55, 0);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(tGeo, i % 2 ? smokeMat : cloakMat);
      const a = (i / 7) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.5, 0.45 + (i % 3) * 0.12, 0.2 + Math.sin(a) * 0.3);
      m.userData.phase = i * 1.7;
      m.userData.base = 0.35 + (i % 3) * 0.12;
      this.tendrils.push(m);
      this.wraith.add(m);
    }
    // aura glow
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0x8b5cf6, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true }));
    this.aura.scale.set(3.4, 3.4, 1);
    this.aura.position.set(0, 1.3, 0.2);
    // embers
    const N = 14;
    this.emberData = new Float32Array(N * 3);
    this.emberAge = new Float32Array(N);
    for (let i = 0; i < N; i++) this.emberAge[i] = i / N;
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(this.emberData, 3));
    this.embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xff8a3d, size: 0.14, map: dotTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.embers.frustumCulled = false;
    this.wraith.traverse((o) => { o.castShadow = false; });
    this.group.add(this.wraith, this.aura, this.embers);
    this.group.visible = false;
  }

  /** `gap` = metres behind the runner (+z); `stumbled` = the runner is in the stumble slow-down. */
  update(on: boolean, dt: number, x: number, z: number, gap: number, stumbled = false): void {
    this.group.visible = on;
    if (!on) return;
    this.t += dt;
    const t = this.t;
    // lunge builds as the gap closes below 5 m; a stumble snaps it forward
    const want = Math.min(1, Math.max(0, (6 - gap) / 3)) + (stumbled ? 0.4 : 0);
    this.lunge += (want - this.lunge) * Math.min(1, dt * 6);
    this.lastGap = gap;
    const L = this.lunge;
    const bob = Math.sin(t * 3.2) * 0.18;
    this.group.position.set(x + Math.sin(t * 1.7) * 0.15, 0.35 + bob + Math.max(0, Math.sin(t * 7)) * 0.05, z + gap - L * 0.8);
    this.wraith.rotation.x = -L * 0.5;            // lean toward the runner
    this.wraith.rotation.z = Math.sin(t * 2.1) * 0.06;
    this.wraith.scale.set(1 - L * 0.08, 1 + L * 0.1, 1 + L * 0.25);
    const flare = 1 + L * 0.9 + (Math.sin(t * 13) > 0.92 ? 0.5 : 0);
    this.eyeMat.opacity = Math.min(1, 0.75 + L * 0.5);
    for (const e of this.eyes) e.scale.set(1.5 * flare, 0.55 * (1 + L * 0.4), 1);
    this.aura.scale.setScalar(3.2 + Math.sin(t * 4) * 0.25 + L * 1.2);
    for (const m of this.tendrils) {
      const ph = m.userData.phase as number, base = m.userData.base as number;
      m.rotation.x = -(base + Math.sin(t * 4 + ph) * 0.2 + L * 0.5); // streams backward, flutters
      m.rotation.z = Math.sin(t * 3 + ph * 1.3) * 0.3;
    }
    // embers rise and drift back from the cloak
    const d = this.emberData, a = this.emberAge;
    for (let i = 0; i < a.length; i++) {
      a[i] += dt * 0.7;
      if (a[i] >= 1) { a[i] -= 1; d[i * 3] = (Math.sin(i * 12.9 + t) ) * 0.5; d[i * 3 + 1] = 0.6 + (i % 4) * 0.2; d[i * 3 + 2] = 0.2; }
      d[i * 3] += Math.sin(t * 3 + i) * dt * 0.3;
      d[i * 3 + 1] += dt * 1.1;
      d[i * 3 + 2] += dt * 1.8;
    }
    this.embers.geometry.attributes.position.needsUpdate = true;
  }
}
