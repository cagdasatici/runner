// Coins drawn with two InstancedMeshes (outer disc + inner disc): 2 draw calls for every coin on screen.
import * as THREE from 'three';
import type { Coin } from '../core/track';
import { coinY, laneX } from '../core/track';
import type { Materials } from './materials';

const MAX = 96;
const POP_TIME = 0.18;

export class CoinRenderer {
  readonly group = new THREE.Group();
  private outer: THREE.InstancedMesh;
  private inner: THREE.InstancedMesh;
  private pops: { x: number; y: number; z: number; id: number; t: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(mats: Materials) {
    const outerGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 28).rotateX(Math.PI / 2);
    const innerGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 24).rotateX(Math.PI / 2);
    this.outer = new THREE.InstancedMesh(outerGeo, mats.gold, MAX);
    this.inner = new THREE.InstancedMesh(innerGeo, mats.goldDark, MAX);
    for (const im of [this.outer, this.inner]) {
      im.castShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    }
  }

  /** A collected coin pops up, grows and vanishes over 0.18 s. */
  pop(c: Coin): void { this.pops.push({ x: laneX(c.lane), y: coinY(c), z: c.z, id: c.id, t: 0 }); }

  clearPops(): void { this.pops = []; }

  /** Draws `coins` (already filtered to visible, uncollected ones) spinning once per 1.2 s. */
  update(coins: Coin[], time: number, dt: number): void {
    let n = 0;
    const put = (x: number, y: number, z: number, id: number, scale: number) => {
      if (n >= MAX) return;
      this.e.set(0, (time / 1.2) * Math.PI * 2 + (id % 8) * 0.4, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(this.v.set(x, y, z), this.q, this.s.set(scale, scale, scale));
      this.outer.setMatrixAt(n, this.m);
      this.inner.setMatrixAt(n, this.m);
      n++;
    };
    for (const c of coins) put(laneX(c.lane), coinY(c), -c.z, c.id, 1);
    this.pops = this.pops.filter((p) => (p.t += dt) < POP_TIME);
    for (const p of this.pops) {
      const k = p.t / POP_TIME;
      put(p.x, p.y + 0.9 * k, -p.z - 1.5 * k, p.id, (1 + 0.7 * k) * (1 - k * k));
    }
    for (const im of [this.outer, this.inner]) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
