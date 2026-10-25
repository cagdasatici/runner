// Coins drawn with two InstancedMeshes (outer disc + inner disc): 2 draw calls for every coin on screen.
import * as THREE from 'three';
import type { Coin } from '../core/track';
import { COIN_Y, laneX } from '../core/track';
import { magnetPull } from './magnet';
import type { Materials } from './materials';

const MAX = 192; // room for magnet trail ghosts
const POP_TIME = 0.18;

export class CoinRenderer {
  readonly group = new THREE.Group();
  private outer: THREE.InstancedMesh;
  private inner: THREE.InstancedMesh;
  private pops: { x: number; z: number; id: number; t: number }[] = [];
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
  pop(c: Coin): void { this.pops.push({ x: laneX(c.lane), z: c.z, id: c.id, t: 0 }); }

  clearPops(): void { this.pops = []; }

  /** Draws `coins` (already filtered to visible, uncollected ones) spinning once per 1.2 s. */
  /** `pull` (magnet on): coins near the runner stream toward it along curves, stretched, with trail ghosts.
   *  `onStream` is called per pulled coin with its drawn position so the caller can drop sparkles. */
  update(coins: Coin[], time: number, dt: number,
    pull?: { x: number; y: number; z: number; strength: number; onStream?: (x: number, y: number, z: number, t: number) => void }): void {
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
    const o = { x: 0, y: 0, z: 0 };
    for (const c of coins) {
      const cx = laneX(c.lane), cz = -c.z;
      if (!pull || pull.strength <= 0) { put(cx, COIN_Y, cz, c.id, 1); continue; }
      const t = magnetPull(cx, COIN_Y, cz, pull.x, pull.y, pull.z, c.id, o) * pull.strength;
      if (t <= 0) { put(cx, COIN_Y, cz, c.id, 1); continue; }
      const px = cx + (o.x - cx) * pull.strength, py = COIN_Y + (o.y - COIN_Y) * pull.strength, pz = cz + (o.z - cz) * pull.strength;
      put(px, py, pz, c.id, 1 - 0.55 * t * t); // shrinks as it arrives
      // trail ghosts: two smaller copies lagging behind along the curve read as a stretched streak
      for (let g = 1; g <= 2; g++) {
        const lag = { x: 0, y: 0, z: 0 };
        magnetPull(cx, COIN_Y, cz + 0.9 * g, pull.x, pull.y, pull.z, c.id, lag);
        put(cx + (lag.x - cx) * pull.strength, COIN_Y + (lag.y - COIN_Y) * pull.strength, cz + (lag.z - cz) * pull.strength, c.id, (0.7 - 0.22 * g) * t);
      }
      pull.onStream?.(px, py, pz, t);
    }
    this.pops = this.pops.filter((p) => (p.t += dt) < POP_TIME);
    for (const p of this.pops) {
      const k = p.t / POP_TIME;
      put(p.x, COIN_Y + 0.9 * k, -p.z - 1.5 * k, p.id, (1 + 0.7 * k) * (1 - k * k));
    }
    for (const im of [this.outer, this.inner]) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
