// Living scenery: a cloud of slow particles around the camera that suits each world (pollen, fireflies, falling leaves,
// embers, snowflakes, sprinkles, star dust...). One Points draw call; spawns ahead of the camera, so it costs nothing at rest.
import * as THREE from 'three';
import { ParticlePool } from './effects';
import type { Theme } from './themes';

interface Kind { rate: number; colors: number[]; size: number; life: number; vel: [number, number, number]; gravity: number; additive: boolean; y: [number, number]; jitter: number }

const KINDS: Record<string, Kind> = {
  pollen: { rate: 7, colors: [0xfff6b0, 0xffffff, 0xfde68a], size: 0.1, life: 6, vel: [0.3, 0.15, 0.1], gravity: -0.02, additive: true, y: [0.5, 7], jitter: 0.3 },
  fireflies: { rate: 8, colors: [0xfde68a, 0xfef08a, 0xfff3b0], size: 0.16, life: 5, vel: [0.2, 0.25, 0.2], gravity: -0.05, additive: true, y: [0.5, 6], jitter: 0.8 },
  neon: { rate: 12, colors: [0xff2fa8, 0x22e6ff, 0xb6ff3a, 0xffd23f], size: 0.14, life: 4.5, vel: [0.2, 1.1, 0.2], gravity: -0.1, additive: true, y: [0, 4], jitter: 0.6 },
  snow: { rate: 40, colors: [0xffffff, 0xe0f2fe], size: 0.13, life: 6, vel: [0.5, -1.4, 0.2], gravity: 0, additive: false, y: [6, 12], jitter: 0.5 },
  dust: { rate: 18, colors: [0xf3d9a8, 0xe8c48a], size: 0.12, life: 3.5, vel: [-2.6, 0.1, 0.6], gravity: 0, additive: false, y: [0.2, 4], jitter: 0.4 },
  leaves: { rate: 14, colors: [0xf08a2a, 0xe0442f, 0xf5b82e, 0xb45309], size: 0.2, life: 6, vel: [-0.8, -1.1, 0.3], gravity: 0, additive: false, y: [4, 10], jitter: 1.2 },
  greenleaves: { rate: 9, colors: [0x4cc45a, 0x1f9a4a, 0x86efac], size: 0.18, life: 6, vel: [-0.5, -0.9, 0.3], gravity: 0, additive: false, y: [4, 10], jitter: 1 },
  mist: { rate: 5, colors: [0xffffff, 0xdbeafe], size: 0.7, life: 7, vel: [0.4, 0.05, 0.1], gravity: 0, additive: false, y: [0.2, 1.8], jitter: 0.1 },
  starsdust: { rate: 22, colors: [0xffffff, 0x9ae6ff, 0xf0abfc], size: 0.1, life: 3, vel: [0, 0, 7], gravity: 0, additive: true, y: [0.3, 8], jitter: 0.3 },
  sprinkles: { rate: 16, colors: [0xff5fa8, 0x5fd0ff, 0xfde047, 0x86efac, 0xc084fc], size: 0.14, life: 5, vel: [0.2, -1.2, 0.1], gravity: 0, additive: false, y: [4, 10], jitter: 0.8 },
  embers: { rate: 22, colors: [0xff7a1a, 0xfbbf24, 0xff4d1a], size: 0.12, life: 3.5, vel: [-0.4, 1.8, 0.2], gravity: -0.4, additive: true, y: [0, 3], jitter: 0.6 },
  sparkle: { rate: 12, colors: [0x5affd8, 0xc07aff, 0xffffff], size: 0.16, life: 3.5, vel: [0.1, 0.4, 0.1], gravity: 0, additive: true, y: [0.5, 6], jitter: 0.5 },
};

const BY_THEME: Record<string, string> = {
  'sunny-city': 'pollen', 'golden-sunset': 'fireflies', 'neon-night': 'neon', 'snow-village': 'snow', 'desert-canyon': 'dust', 'jungle-rush': 'greenleaves',
  'harbour-bay': 'mist', 'space-station': 'starsdust', 'candy-land': 'sprinkles', 'volcano-ridge': 'embers', 'autumn-park': 'leaves', 'crystal-dreams': 'sparkle',
  menu: 'pollen', endless: 'pollen',
};

export class Ambient {
  readonly additive = new ParticlePool(700, true);
  readonly normal = new ParticlePool(700, false);
  private kind: Kind | null = null;
  private acc = 0;
  /** 0…1 scale of the spawn rate (low quality tier uses less). */
  density = 1;

  setScale(px: number): void { this.additive.setScale(px); this.normal.setScale(px); }
  set(t: Theme): void {
    this.kind = KINDS[BY_THEME[t.id] ?? 'pollen'] ?? null;
    this.additive.clear(); this.normal.clear();
  }
  update(dt: number, cam: THREE.Vector3): void {
    const k = this.kind;
    if (k) {
      this.acc += k.rate * this.density * dt;
      const pool = k.additive ? this.additive : this.normal;
      while (this.acc >= 1) {
        this.acc -= 1;
        pool.burst(cam.x + (Math.random() - 0.5) * 26, k.y[0] + Math.random() * (k.y[1] - k.y[0]), cam.z - 4 - Math.random() * 42, 1, {
          color: k.colors[Math.floor(Math.random() * k.colors.length)], speed: 1, life: k.life, size: k.size, gravity: k.gravity, dir: k.vel, spread: k.jitter, colorJitter: 0.08,
        });
      }
    }
    this.additive.update(dt); this.normal.update(dt);
  }
}
