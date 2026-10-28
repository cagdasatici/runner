// Life in the world: a lazy flock of birds in the sky and steam venting from street grates beside the track.
// Drawing only. Birds are ONE instanced mesh (one draw call); steam uses the game's existing dust particles.
import * as THREE from 'three';
import { hash01 } from '../core/messes';
import type { ParticlePool } from './effects';

/** Is there a steam grate on this side of segment k? (world.ts draws the grate, Steam makes the steam: both use this.) */
export function ventAt(k: number, side: -1 | 1): boolean {
  return hash01(k * 2 + (side > 0 ? 1 : 0), 4242) < 0.22;
}
export const VENT_Z = -13; // metres along the segment, scene direction

const N = 7;

export class Birds {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor() {
    // a flat "V": two wing triangles with the tips raised; flapping squashes it up and down
    const v = new Float32Array([
      0, 0, -0.22, -0.7, 0.12, 0.05, 0, 0, 0.16,
      0, 0, -0.22, 0.7, 0.12, 0.05, 0, 0, 0.16,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x2a2f3c, side: THREE.DoubleSide, fog: false }), N);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Per frame; `on` = this world has a daytime sky. The flock circles slowly ahead of the camera. */
  update(time: number, cam: THREE.Vector3, on: boolean): void {
    this.mesh.visible = on;
    if (!on) return;
    for (let i = 0; i < N; i++) {
      const sp = 0.09 + hash01(i, 11) * 0.05, ph = hash01(i, 12) * 6.283, r = 22 + hash01(i, 13) * 26;
      const a = ph + time * sp;
      this.p.set(cam.x + Math.cos(a) * r, 30 + hash01(i, 14) * 14 + Math.sin(time * 0.8 + ph) * 1.6, cam.z - 85 + Math.sin(a) * r * 0.55);
      this.q.setFromAxisAngle(this.up, -a - Math.PI / 2);      // nose along the circle
      const flap = Math.sin(time * 9 + ph * 3);
      this.s.set(2.4, 2.4 * (0.15 + 0.85 * flap), 2.4);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Steam {
  private acc = 0;

  /** `z` = the runner's scene z; vents within view ahead blow white puffs up into the air. */
  update(dt: number, z: number, camX: number, dust: ParticlePool, segLen: number): void {
    const k0 = Math.floor(-(z - 10) / segLen), k1 = Math.floor(-(z + 100) / segLen);
    this.acc += dt;
    if (this.acc < 0.12) return;
    this.acc = 0;
    for (let k = Math.min(k0, k1); k <= Math.max(k0, k1) + 1; k++) for (const side of [-1, 1] as const) {
      if (!ventAt(k, side)) continue;
      const vz = -k * segLen + VENT_Z;
      if (vz > z + 10 || vz < z - 100) continue;
      dust.burst(side * 5.0 + (Math.random() - 0.5) * 0.3, 0.7, vz, 1, { color: 0xeef3f8, colorJitter: 0.05, speed: 0.9, life: 1.5, size: 1.0, dir: [0, 1, 0], spread: 0.35 });
    }
    void camX;
  }
}
