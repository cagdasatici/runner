// "Game feel": small visual reactions to what the runner does. Pure drawing (particles + two camera nudges); the rules never see it.
// takeoff and landing dust rings, a camera dip on landing, sparks while rolling, a swoosh on lane changes, a punch on near misses,
// a sparkle ring on combos, and rushing speed dots when it is fast or boosted.
import type { RunnerState } from '../core/runner';
import { isGrounded } from '../core/runner';
import type { ParticlePool } from './effects';

export interface JuicePools { dust: ParticlePool; glow: ParticlePool; sparkles: ParticlePool }

const TAU = Math.PI * 2;

export class Juice {
  /** Camera dip (m) after a landing; decays by itself. Subtract from the camera height. */
  landKick = 0;
  /** Field-of-view punch (degrees) after a near miss; decays by itself. Add to the camera fov. */
  punch = 0;
  private grounded = true;
  private air = 0;
  private lane = 1;
  private near = 0;
  private combos = 0;
  private slideAcc = 0;
  private lineAcc = 0;

  reset(s?: RunnerState): void {
    this.landKick = 0; this.punch = 0; this.grounded = true; this.air = 0;
    this.lane = s?.lane ?? 1; this.near = s?.nearMisses ?? 0; this.combos = s?.combos ?? 0;
    this.slideAcc = 0; this.lineAcc = 0;
  }

  /** A flat ring of dust racing outwards from the feet. */
  private ring(p: JuicePools, x: number, y: number, z: number, n: number, speed: number, size: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.3;
      p.dust.burst(x, y + 0.06, z, 1, { color: 0xd6cfc4, speed, life: 0.5, size, dir: [Math.cos(a), 0.12, Math.sin(a)], spread: 0.12, colorJitter: 0.06 });
    }
  }

  update(s: RunnerState, speed: number, boost: boolean, dt: number, p: JuicePools): void {
    if (s.crashed) return;
    const flying = s.fly > 0 || s.descend > 0;
    const g = isGrounded(s), x = s.x, z = -s.z;
    if (g && !this.grounded && !flying) {
      if (this.air > 0.18) { // a real landing (not a stair or a hop)
        this.ring(p, x, s.floor, z, 16, 3.4 + Math.min(2, this.air * 3), 0.42);
        p.sparkles.burst(x, s.floor + 0.2, z, 8, { color: 0xffffff, speed: 2.2, life: 0.4, size: 0.26 });
        this.landKick = Math.min(0.24, 0.06 + this.air * 0.2);
      }
    } else if (!g && this.grounded && !flying && s.vy > 0) {
      this.ring(p, x, s.floor, z, 10, 2.2, 0.32); // takeoff puff
    }
    this.air = g ? 0 : this.air + dt;
    this.grounded = g;

    if (s.lane !== this.lane) { // swoosh at the feet, opposite to the move
      const dir = Math.sign(this.lane - s.lane) || 1;
      p.glow.burst(x, s.y + 0.25, z + 0.2, 8, { color: 0xbfe3ff, speed: 3, life: 0.22, size: 0.14, dir: [dir, 0.1, 0.6], spread: 0.3 });
      this.lane = s.lane;
    }
    if (s.nearMisses > this.near) { // a close shave: the camera punches in, a ring flashes round the runner
      this.punch = 5;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        p.glow.burst(x, s.y + 0.9, z, 1, { color: 0xfde047, speed: 3.2, life: 0.35, size: 0.18, dir: [Math.cos(a), Math.sin(a), 0], spread: 0.05 });
      }
    }
    this.near = s.nearMisses;
    if (s.combos > this.combos) p.sparkles.burst(x, s.y + 1, z, 22, { color: 0xffffff, speed: 3.5, life: 0.7, size: 0.34 });
    this.combos = s.combos;

    if (s.slideTicks > 0 && g) { // sparks scrape off the ground while rolling
      this.slideAcc += dt * 40;
      while (this.slideAcc >= 1) {
        this.slideAcc -= 1;
        p.glow.burst(x, s.floor + 0.08, z + 0.3, 1, { color: 0xffa63d, speed: 2.6, life: 0.28, size: 0.1, gravity: 9, dir: [0, 0.8, 0.7], spread: 0.5, colorJitter: 0.2 });
      }
    }

    // speed dots rushing past the camera when fast or boosted
    const rate = (boost ? 42 : 0) + Math.max(0, speed - 16) * 6;
    if (rate > 0 && !flying) {
      this.lineAcc += dt * rate;
      while (this.lineAcc >= 1) {
        this.lineAcc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        p.glow.burst(x + side * (2 + Math.random() * 3.5), 0.4 + Math.random() * 3, z - 4 + Math.random() * 10, 1, { color: 0xeaf6ff, speed: 26, life: 0.22, size: 0.08, dir: [0, 0, 1], spread: 0.03 });
      }
    }
    this.landKick *= Math.exp(-dt * 9);
    this.punch *= Math.exp(-dt * 7);
  }
}
