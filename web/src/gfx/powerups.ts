// Visuals for power-ups: floating pickups, the board under the feet, the magnet ring, the jetpack and the chaser.
// Pure drawing; the rules live in core/runner.ts. Shared geometry and materials, so nothing here needs disposing per pickup.
import * as THREE from 'three';
import { laneX, type Pickup, type PickupKind } from '../core/track';
import type { RunnerState } from '../core/runner';
import type { ParticlePool } from './effects';
import { dotTexture } from './textures';

const lambert = (color: number, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
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
    case 'jetpack':
      for (const x of [-0.2, 0.2]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), lambert(col)); c.position.x = x; g.add(c); const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 10), lambert(0xfb923c, 0xea580c)); f.position.set(x, -0.5, 0); f.rotation.x = Math.PI; g.add(f); }
      break;
  }
  return g;
}

export class PowerVisuals {
  readonly group = new THREE.Group();
  readonly board = new BoardVisual();
  /** Attach `jetpack.group` to the runner's pivot (see Game). */
  readonly jetpack = new JetpackVisual();
  private nodes = new Map<number, THREE.Group>();
  private ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7 }));
  private chaser = new ChaserBlob();
  private lastBreaks = 0;

  constructor() {
    this.ring.visible = false;
    this.ring.rotation.x = Math.PI / 2;
    this.group.add(this.board.group, this.board.fx, this.ring, this.chaser.group);
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
    this.ring.visible = s.magnet > 0;
    this.ring.position.set(s.x, s.y + 1.0, -s.z);
    this.ring.scale.setScalar(1 + 0.08 * Math.sin(time * 8));
    // the chaser runs 3 m behind and drops back as the timer runs out
    const behind = 3 + (1 - Math.min(1, s.chaser / 240)) * 9;
    this.chaser.update(s.chaser > 0 && !s.crashed, dt, s.x, -s.z, behind);
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
    const deckGeo = new THREE.ExtrudeGeometry(stadium(1.55, 0.58), { depth: 0.07, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 12 });
    deckGeo.rotateX(Math.PI / 2); // shape plane -> XZ, extrusion goes down
    deckGeo.translate(0, 0.14, 0);
    const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.35, roughness: 0.28, emissive: 0x0e7490, emissiveIntensity: 0.5 }));
    deck.castShadow = true;
    // dark grip pad where the feet are
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.015, 0.8), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }));
    pad.position.set(0, 0.176, 0.05);
    // glowing side rails and nose light
    const railMat = additive(0xa5f3fc);
    for (const x of [-0.27, 0.27]) {
      const rail = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.9, 3, 6), railMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 0.168, 0.1);
      this.body.add(rail);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), additive(0xffffff));
    nose.position.set(0, 0.15, -0.74);
    // twin thruster rings at the tail
    for (const x of [-0.14, 0.14]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 16), additive(0xf0abfc));
      ring.position.set(x, 0.1, 0.8);
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

export class JetpackVisual {
  /** Attach to the pitched pivot of the runner. */
  readonly group = new THREE.Group();
  private flames: THREE.Mesh[] = [];
  private cores: THREE.Mesh[] = [];
  private t = 0;
  private emit = 0;
  private tmp = new THREE.Vector3();

  constructor() {
    const tank = new THREE.CapsuleGeometry(0.1, 0.34, 4, 12);
    const body = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.4, roughness: 0.35 });
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

/** A friendly blob that bounds along behind the runner. */
export class ChaserBlob {
  readonly group = new THREE.Group();
  private blob: THREE.Group = new THREE.Group();
  private t = 0;

  constructor() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.45, metalness: 0 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 18), skin);
    body.scale.set(1, 0.9, 0.95);
    body.position.y = 0.58;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshStandardMaterial({ color: 0xddd6fe, roughness: 0.6 }));
    belly.position.set(0, 0.45, -0.34);
    belly.scale.set(1, 0.9, 0.5);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), black = new THREE.MeshBasicMaterial({ color: 0x111827 });
    for (const x of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), white);
      eye.position.set(x, 0.82, -0.5);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), black);
      pupil.position.set(x * 0.9, 0.8, -0.63);
      this.blob.add(eye, pupil);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 10), skin);
      ear.position.set(x * 1.5, 1.18, 0);
      ear.rotation.z = -x * 1.6;
      this.blob.add(ear);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 14, Math.PI), black);
    smile.position.set(0, 0.62, -0.58);
    smile.rotation.z = Math.PI;
    this.blob.add(body, belly, smile);
    this.blob.traverse((o) => { o.castShadow = true; });
    this.group.add(this.blob);
    this.group.visible = false;
  }

  /** `gap` = metres behind the runner (+z). */
  update(on: boolean, dt: number, x: number, z: number, gap: number): void {
    this.group.visible = on;
    if (!on) return;
    this.t += dt;
    const hop = Math.abs(Math.sin(this.t * 9));
    this.group.position.set(x, hop * 0.35, z + gap);
    this.blob.scale.set(1 + (1 - hop) * 0.1, 1 - (1 - hop) * 0.12, 1 + (1 - hop) * 0.1);
  }
}
