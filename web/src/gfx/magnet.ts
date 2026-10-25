// Magnet power-up visuals (replaces the old flat red circle): inward-flowing field ripples, curved field
// lines that pulse toward the runner, a soft aura on the character, and the curve that pulled coins follow.
// Coins themselves are drawn by CoinRenderer using `magnetPull` below; sparkle trails go to the glow pool.
import * as THREE from 'three';
import { dotTexture } from './textures';

export const MAGNET_RANGE = 14; // metres from the runner that coins start streaming in

/**
 * Where a coin at (cx, cy, cz) is drawn while the magnet pulls it toward the runner at (rx, ry, rz).
 * Follows a quadratic curve that bows up and sideways; returns the eased progress `t` (0 = untouched, 1 = arrived)
 * so the caller can stretch/fade the coin. Pure math, safe to unit-test.
 */
export function magnetPull(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, id: number,
  out: { x: number; y: number; z: number }, arrive = 0): number {
  // `arrive`: distance at which the core rules collect the coin, so the drawn coin reaches the runner exactly then
  const d = Math.hypot(cx - rx, cz - rz);
  const k = Math.max(0, Math.min(1, (MAGNET_RANGE - d) / (MAGNET_RANGE - arrive)));
  const t = k * k * (3 - 2 * k); // smoothstep: slow start, fast finish
  const side = (id % 2 ? 1 : -1) * 1.2;
  const mx = (cx + rx) / 2 + side, my = Math.max(cy, ry) + 1.4, mz = (cz + rz) / 2;
  const u = 1 - t;
  out.x = u * u * cx + 2 * u * t * mx + t * t * rx;
  out.y = u * u * cy + 2 * u * t * my + t * t * ry;
  out.z = u * u * cz + 2 * u * t * mz + t * t * rz;
  return t;
}

const RIPPLES = 4;
const LINES = 6;
const LINE_PTS = 24;
const FIELD = 0x7dd3fc; // cool blue: reads as "magnetic", not as a warning

export class MagnetEffect {
  readonly group = new THREE.Group();
  private ripples: THREE.Mesh[] = [];
  private lines: THREE.Line[] = [];
  private aura: THREE.Sprite;
  private strength = 0; // fades in/out over ~0.3 s

  constructor() {
    this.group.visible = false;
    const ringGeo = new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2);
    for (let i = 0; i < RIPPLES; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: FIELD, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      this.ripples.push(m);
      this.group.add(m);
    }
    for (let i = 0; i < LINES; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
      const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      l.frustumCulled = false;
      this.lines.push(l);
      this.group.add(l);
    }
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0x93c5fd, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.aura);
  }

  get level(): number { return this.strength; }

  /** Call every frame with the runner's world position. */
  update(active: boolean, x: number, y: number, z: number, time: number, dt: number): void {
    this.strength = Math.max(0, Math.min(1, this.strength + (active ? dt : -dt) / 0.3));
    const s = this.strength;
    this.group.visible = s > 0;
    if (!this.group.visible) return;

    // ripples: rings that shrink from 5 m to the runner's feet, brightening as they arrive
    this.ripples.forEach((m, i) => {
      const p = (time * 0.7 + i / RIPPLES) % 1;
      const r = 5 * (1 - p) + 0.5;
      m.position.set(x, 0.06, z);
      m.scale.setScalar(r);
      (m.material as THREE.MeshBasicMaterial).opacity = s * 0.45 * Math.sin(p * Math.PI);
    });

    // field lines: arcs from points ahead to the runner, a bright pulse travelling inward along each
    this.lines.forEach((l, i) => {
      const a = (i / LINES) * Math.PI * 2 + time * 0.25;
      const sx = x + Math.cos(a) * 4.5, sy = y + 1 + Math.sin(a * 2) * 0.8, sz = z - 6 - Math.sin(a) * 3;
      const mx = (sx + x) / 2 + Math.sin(a) * 1.5, my = sy + 1.2, mz = (sz + z) / 2;
      const pos = l.geometry.getAttribute('position') as THREE.BufferAttribute;
      const col = l.geometry.getAttribute('color') as THREE.BufferAttribute;
      const pulse = (time * 1.4 + i * 0.37) % 1;
      for (let j = 0; j < LINE_PTS; j++) {
        const t = j / (LINE_PTS - 1), u = 1 - t;
        pos.setXYZ(j, u * u * sx + 2 * u * t * mx + t * t * x, u * u * sy + 2 * u * t * my + t * t * (y + 1), u * u * sz + 2 * u * t * mz + t * t * z);
        const glow = Math.exp(-((t - pulse) ** 2) / 0.008);
        const b = s * (0.12 + 0.88 * glow) * t; // faint at the far end
        col.setXYZ(j, 0.49 * b, 0.83 * b, 0.99 * b);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
    });

    // aura on the character: soft pulsing glow around the torso
    this.aura.position.set(x, y + 1.1, z);
    this.aura.scale.setScalar(2.6 + 0.25 * Math.sin(time * 6));
    (this.aura.material as THREE.SpriteMaterial).opacity = s * 0.5;
  }
}
