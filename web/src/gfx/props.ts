// Themed scenery pieces. Each one adds a few cheap low-poly parts (vertex-coloured, bottom-darkened) to a Merger.
import * as THREE from 'three';
import type { SplitMix64 } from '../core/rng';
import type { EnvMaterials } from './envMaterials';
import { Merger } from './merge';
import type { PropKind, Theme } from './themes';

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
export const CONE = new THREE.CylinderGeometry(0, 1, 1, 8);
export const ICO = new THREE.IcosahedronGeometry(1, 1);
export const ICO0 = new THREE.IcosahedronGeometry(1, 0);
export const OCT = new THREE.OctahedronGeometry(1, 0);

export interface Ctx { mg: Merger; m: EnvMaterials; t: Theme; rng: SplitMix64 }

export const box = (c: Ctx, mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number,
  color: number, o: { ao?: number; top?: number; glow?: number } = {}): void =>
  c.mg.add(BOX, mat, x, y, z, { scale: [w, h, d], color, ...o });

const tint = (a: number, b: number, t: number): number => {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
};

function tree(c: Ctx, x: number, z: number, s: number): void {
  const { a, b, trunk } = c.t.propColors;
  c.mg.add(CYL, c.m.vc, x, 0.9 * s, z, { scale: [0.2 * s, 1.8 * s, 0.2 * s], color: trunk, ao: 0.4 });
  const blobs: [number, number, number, number, number][] = [[0, 2.5, 0, 1.4, a], [0.55, 3.4, 0.2, 1.0, b], [-0.5, 3.0, -0.25, 0.85, b]];
  for (const [dx, dy, dz, r, col] of blobs) c.mg.add(ICO, c.m.vc, x + dx * s, dy * s, z + dz * s, { scale: [r * s, r * s * 0.92, r * s], color: col, ao: 0.5, top: 0.18 });
}

function pine(c: Ctx, x: number, z: number, s: number): void {
  const { a, b, trunk } = c.t.propColors;
  c.mg.add(CYL, c.m.vc, x, 0.5 * s, z, { scale: [0.18 * s, 1.0 * s, 0.18 * s], color: trunk, ao: 0.4 });
  for (let i = 0; i < 4; i++) {
    const r = (1.5 - i * 0.28) * s, y = (1.3 + i * 0.95) * s;
    c.mg.add(CONE, c.m.vc, x, y + 0.55 * s, z, { scale: [r, 1.5 * s, r], color: i % 2 ? b : a, ao: 0.5 });
    if (c.t.snow) c.mg.add(CONE, c.m.vc, x, y + 0.8 * s, z, { scale: [r * 0.78, 1.0 * s, r * 0.78], color: 0xffffff, top: 0.0 });
  }
}

function palm(c: Ctx, x: number, z: number, s: number, rng: SplitMix64): void {
  const { a, b, trunk } = c.t.propColors;
  const lean = (rng.int(100) / 100 - 0.5) * 0.5;
  let px = x, py = 0;
  for (let i = 0; i < 4; i++) {
    c.mg.add(CYL, c.m.vc, px + lean * 0.5 * s, py + 0.65 * s, z, { scale: [(0.2 - i * 0.02) * s, 1.3 * s, (0.2 - i * 0.02) * s], rot: [0, 0, -lean * 0.9], color: i % 2 ? tint(trunk, 0xffffff, 0.15) : trunk, ao: 0.2 });
    px += Math.sin(lean * 0.9) * 1.3 * s; py += Math.cos(lean * 0.9) * 1.3 * s;
  }
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    c.mg.add(ICO0, c.m.vc, px + Math.cos(ang) * 0.9 * s, py + 0.05 * s, z + Math.sin(ang) * 0.9 * s, { scale: [1.2 * s, 0.07 * s, 0.34 * s], rot: [0, -ang, Math.cos(0) * -0.35], color: i % 2 ? a : b, top: 0.15 });
  }
  c.mg.add(ICO, c.m.vc, px, py, z, { scale: [0.25 * s, 0.25 * s, 0.25 * s], color: 0x6b3f1d });
}

function cactus(c: Ctx, x: number, z: number, s: number): void {
  const { a, b } = c.t.propColors;
  c.mg.add(CYL, c.m.vc, x, 1.1 * s, z, { scale: [0.38 * s, 2.2 * s, 0.38 * s], color: a, ao: 0.4 });
  c.mg.add(ICO, c.m.vc, x, 2.2 * s, z, { scale: [0.38 * s, 0.34 * s, 0.38 * s], color: a });
  for (const side of [-1, 1]) {
    const h = (0.7 + 0.25 * (side > 0 ? 1 : 0)) * s;
    c.mg.add(CYL, c.m.vc, x + side * 0.55 * s, (1.2 + h / 2) * s * 0.9, z, { scale: [0.22 * s, h, 0.22 * s], color: b, ao: 0.3 });
    c.mg.add(CYL, c.m.vc, x + side * 0.3 * s, 1.2 * s, z, { scale: [0.22 * s, 0.5 * s, 0.22 * s], rot: [0, 0, side * Math.PI / 2], color: b });
  }
}

function crystal(c: Ctx, x: number, z: number, s: number, rng: SplitMix64): void {
  const { a, b } = c.t.propColors;
  const n = 3 + rng.int(3);
  for (let i = 0; i < n; i++) {
    const h = (1.2 + rng.int(18) / 10) * s, r = (0.28 + rng.int(20) / 100) * s;
    const dx = (rng.int(100) / 100 - 0.5) * 1.1 * s, dz = (rng.int(100) / 100 - 0.5) * 1.1 * s;
    c.mg.add(OCT, c.m.glow, x + dx, h * 0.9, z + dz, { scale: [r, h, r], rot: [(rng.int(20) - 10) / 40, rng.int(6), (rng.int(20) - 10) / 40], color: i % 2 ? a : b, glow: 1.5, ao: 0.55, top: 0.25 });
  }
  c.mg.add(ICO0, c.m.vc, x, 0.15 * s, z, { scale: [0.9 * s, 0.3 * s, 0.9 * s], color: c.t.propColors.trunk, ao: 0.3 });
}

function lolly(c: Ctx, x: number, z: number, s: number, rng: SplitMix64): void {
  const { a, b } = c.t.propColors;
  c.mg.add(CYL, c.m.vc, x, 1.3 * s, z, { scale: [0.07 * s, 2.6 * s, 0.07 * s], color: 0xffffff });
  const cx = rng.int(2) ? a : b, cy = cx === a ? b : a;
  c.mg.add(CYL, c.m.vc, x, 3.1 * s, z, { scale: [1.1 * s, 0.22 * s, 1.1 * s], rot: [Math.PI / 2, 0, 0], color: cx, top: 0.15 });
  c.mg.add(CYL, c.m.vc, x, 3.1 * s, z + 0.03 * s, { scale: [0.78 * s, 0.24 * s, 0.78 * s], rot: [Math.PI / 2, 0, 0], color: 0xffffff });
  c.mg.add(CYL, c.m.vc, x, 3.1 * s, z + 0.05 * s, { scale: [0.48 * s, 0.26 * s, 0.48 * s], rot: [Math.PI / 2, 0, 0], color: cy });
}

function container(c: Ctx, x: number, z: number, s: number, rng: SplitMix64): void {
  const cols = [c.t.propColors.a, c.t.propColors.b, c.t.propColors.trunk, 0xf1f5f9];
  const stack = 1 + rng.int(3);
  for (let i = 0; i < stack; i++) {
    const col = cols[rng.int(cols.length)];
    box(c, c.m.vc, x, (1.3 + i * 2.6) * s, z, 2.4 * s, 2.55 * s, 5.4 * s, col, { ao: 0.35, top: 0.12 });
    for (let r = -2; r <= 2; r++) box(c, c.m.vc, x, (1.3 + i * 2.6) * s, z + r * 0.9 * s, 2.46 * s, 2.3 * s, 0.07 * s, tint(col, 0x000000, 0.25));
  }
}

function rock(c: Ctx, x: number, z: number, s: number, rng: SplitMix64): void {
  const { a, b } = c.t.propColors;
  c.mg.add(ICO0, c.m.vc, x, 0.7 * s, z, { scale: [(1.0 + rng.int(8) / 10) * s, (0.9 + rng.int(8) / 10) * s, (0.9 + rng.int(6) / 10) * s], rot: [rng.int(6), rng.int(6), 0], color: a, ao: 0.5, top: 0.2 });
  if (c.t.id === 'volcano-ridge') {
    c.mg.add(OCT, c.m.glow, x + 1.2 * s, 0.25 * s, z + 0.6 * s, { scale: [0.3 * s, 0.7 * s, 0.3 * s], color: b, glow: 1.8, ao: 0.5 });
    c.mg.add(BOX, c.m.glow, x, 0.03, z + 1.6 * s, { scale: [2.4 * s, 0.04, 0.5 * s], color: b, glow: 1.6 });
  }
}

function pylon(c: Ctx, x: number, z: number, s: number): void {
  const { a, b, trunk } = c.t.propColors;
  c.mg.add(CYL, c.m.vc, x, 0.4 * s, z, { scale: [0.7 * s, 0.8 * s, 0.7 * s], color: trunk, ao: 0.4 });
  c.mg.add(new THREE.CylinderGeometry(0.25, 0.45, 1, 8), c.m.vc, x, 3.2 * s, z, { scale: [s, 5 * s, s], color: tint(trunk, 0xffffff, 0.2), ao: 0.4 });
  for (const y of [1.6, 3.2, 4.8]) c.mg.add(CYL, c.m.glow, x, y * s, z, { scale: [0.46 * s, 0.07 * s, 0.46 * s], color: y > 3 ? a : b, glow: 2.2 });
  c.mg.add(ICO, c.m.glow, x, 5.9 * s, z, { scale: [0.3 * s, 0.3 * s, 0.3 * s], color: a, glow: 2.6 });
}

export function placeProp(c: Ctx, kind: PropKind, x: number, z: number, s: number, rng: SplitMix64): void {
  switch (kind) {
    case 'tree': return tree(c, x, z, s);
    case 'pine': return pine(c, x, z, s);
    case 'palm': return palm(c, x, z, s, rng);
    case 'cactus': return cactus(c, x, z, s);
    case 'crystal': return crystal(c, x, z, s, rng);
    case 'lolly': return lolly(c, x, z, s, rng);
    case 'container': return container(c, x, z, s, rng);
    case 'rock': return rock(c, x, z, s, rng);
    case 'pylon': return pylon(c, x, z, s);
  }
}

/** Small bush / rock / flower clump hugging the pavement edge: gives the base of the scene depth. */
export function placeShrub(c: Ctx, x: number, z: number, rng: SplitMix64): void {
  const { a, b } = c.t.propColors;
  const r = 0.35 + rng.int(30) / 100;
  const k = c.t.prop;
  if (k === 'rock' || k === 'cactus' || k === 'container') {
    c.mg.add(ICO0, c.m.vc, x, r * 0.5, z, { scale: [r * 1.1, r * 0.7, r], rot: [0, rng.int(6), 0], color: k === 'rock' ? a : tint(c.t.ground.side, 0x000000, 0.2), ao: 0.4, top: 0.2 });
  } else {
    c.mg.add(ICO, c.m.vc, x, r * 0.7, z, { scale: [r, r * 0.8, r], color: rng.int(2) ? a : b, ao: 0.5, top: 0.2 });
    if (c.t.id === 'candy-land' || c.t.id === 'sunny-city' || c.t.id === 'autumn-park') c.mg.add(ICO0, c.m.vc, x + r * 0.5, r * 1.4, z, { scale: [0.1, 0.1, 0.1], color: 0xfff0a0, glow: 1 });
  }
}
