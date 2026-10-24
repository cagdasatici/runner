// Obstacles: stylised metro trains (cab, windows, doors, livery, bogies), ramps with hazard rails, hurdles and bars.
// Geometry is built once per (kind, livery, length) and shared by every instance (no per-spawn hitch, no per-frame cost).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { laneX, obstacleLength, RAMP_LENGTH, ROOF_Y, type Obstacle } from '../core/track';
import type { EnvMaterials } from './envMaterials';
import { atlasUV } from './envTextures';
import { Merger } from './merge';
import type { Theme } from './themes';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const ICO = new THREE.IcosahedronGeometry(1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);
const WHITE = atlasUV('white', 4);
const DARK = atlasUV('dark', 4);

const cache = new Map<string, Map<'atlas' | 'glow', THREE.BufferGeometry>>();

interface Parts { atlas: THREE.BufferGeometry; glow: THREE.BufferGeometry | null }

function cars(L: number): { n: number; len: number } {
  const n = Math.max(1, Math.round(L / 10));
  return { n, len: L / n };
}

function buildTrain(L: number, body: number, accent: number, mg: Merger, m: EnvMaterials): void {
  const { n, len } = cars(L);
  const H = ROOF_Y - 0.45;
  const bodyGeo = new RoundedBoxGeometry(2.3, H, len - 0.06, 3, 0.2);
  for (let i = 0; i < n; i++) {
    const zc = -L / 2 + len * (i + 0.5);
    mg.add(bodyGeo, m.atlas, 0, 0.45 + H / 2, zc, { color: body, uv: WHITE, ao: 0.28, top: 0.1 });
    for (const sx of [1, -1]) {
      // side panel with windows and doors
      mg.add(PLANE, m.atlas, sx * 1.158, 1.95, zc, { scale: [len - 0.34, 2.6, 1], rot: [0, sx * Math.PI / 2, 0], uv: atlasUV('side') });
      mg.add(BOX, m.atlas, sx * 1.163, 1.5, zc, { scale: [0.02, 0.15, len - 0.34], color: accent, uv: WHITE });
      mg.add(BOX, m.atlas, sx * 1.163, 1.27, zc, { scale: [0.02, 0.05, len - 0.34], color: 0xffffff, uv: WHITE });
    }
    // roof running surface (flat, exactly at ROOF_Y so it reads as a platform)
    mg.add(PLANE, m.atlas, 0, ROOF_Y + 0.004, zc, { scale: [2.0, len - 0.3, 1], rot: [-Math.PI / 2, 0, 0], uv: atlasUV('roof') });
    // bogies
    for (const bz of [-(len / 2 - 1.9), len / 2 - 1.9]) {
      mg.add(BOX, m.atlas, 0, 0.36, zc + bz, { scale: [1.7, 0.26, 2.3], color: 0x2a303b, uv: DARK });
      for (const wz of [-0.8, 0.8]) for (const wx of [-0.9, 0.9]) {
        mg.add(CYL, m.atlas, wx, 0.29, zc + bz + wz, { scale: [0.29, 0.16, 0.29], rot: [0, 0, Math.PI / 2], color: 0x161a22, uv: DARK });
      }
    }
    if (i > 0) mg.add(BOX, m.atlas, 0, 1.9, zc - len / 2, { scale: [2.1, 2.7, 0.3], color: 0x1c212b, uv: DARK });
  }
  // cabs at both ends: windscreen/sign texture, cow-catcher, lamps
  for (const end of [1, -1]) {
    const z = end * (L / 2 - 0.024);
    mg.add(PLANE, m.atlas, 0, 1.95, z + end * 0.006, { scale: [2.05, 2.6, 1], rot: [0, end > 0 ? 0 : Math.PI, 0], uv: atlasUV('front') });
    mg.add(BOX, m.atlas, 0, 0.62, z + end * 0.1, { scale: [2.0, 0.26, 0.34], uv: atlasUV('hazardYB', 2) });
    mg.add(BOX, m.atlas, 0, 3.0, z + end * 0.35, { scale: [1.9, 0.12, 0.7], color: body, uv: WHITE, ao: 0.4 });
    for (const hx of [-0.72, 0.72]) {
      mg.add(ICO, m.glow, hx, 0.98, z + end * 0.06, { scale: [0.13, 0.13, 0.08], color: end > 0 ? 0xfff3c4 : 0xff3030, glow: 3 });
    }
  }
  mg.add(BOX, m.glow, 0, 3.07, L / 2 + 0.01, { scale: [0.85, 0.12, 0.02], color: 0xffb347, glow: 2.4 });
}

function buildRamp(mg: Merger, m: EnvMaterials): void {
  const R = RAMP_LENGTH, H = ROOF_Y, ang = Math.atan2(H, R), slope = Math.hypot(R, H);
  const W = 2.2;
  // deck
  mg.add(PLANE, m.atlas, 0, H / 2, -R / 2, { scale: [W - 0.2, slope, 1], rot: [ang - Math.PI / 2, 0, 0], uv: atlasUV('deck') });
  // triangular side walls
  const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(R, 0), new THREE.Vector2(R, H)]);
  const wall = new THREE.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false });
  wall.translate(0, 0, -0.5);
  for (const sx of [-1, 1]) {
    mg.add(wall, m.atlas, sx * (W / 2 - 0.1), 0, 0, { scale: [1, 1, 0.2], rot: [0, Math.PI / 2, 0], color: 0x5a6578, uv: DARK, ao: 0.35 });
    // hazard rail along the slope
    mg.add(BOX, m.atlas, sx * (W / 2 - 0.1), H / 2 + 0.06, -R / 2, { scale: [0.26, 0.14, slope], rot: [ang, 0, 0], uv: atlasUV('hazardYB', 2) });
    // guide lights
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4;
      mg.add(ICO, m.glow, sx * (W / 2 - 0.1), t * H + 0.2, -t * R, { scale: [0.09, 0.09, 0.09], color: 0xfacc15, glow: 2.6 });
    }
  }
  // low yellow kerb at the foot
  mg.add(BOX, m.atlas, 0, 0.04, 0.04, { scale: [W, 0.08, 0.2], uv: atlasUV('hazardYB', 2) });
}

function buildHurdle(mg: Merger, m: EnvMaterials): void {
  for (const sx of [-0.92, 0.92]) {
    mg.add(CYL, m.atlas, sx, 0.5, 0, { scale: [0.06, 1.0, 0.06], color: 0x3a4250, uv: DARK });
    mg.add(BOX, m.atlas, sx, 0.03, 0, { scale: [0.2, 0.06, 0.55], color: 0x2a303b, uv: DARK });
    mg.add(ICO, m.glow, sx, 1.06, 0, { scale: [0.09, 0.09, 0.09], color: 0xff4040, glow: 2.4 });
  }
  mg.add(new RoundedBoxGeometry(2.0, 0.42, 0.09, 2, 0.04), m.atlas, 0, 0.76, 0, { uv: atlasUV('hazardRW', 2) });
  mg.add(new RoundedBoxGeometry(2.0, 0.2, 0.07, 2, 0.03), m.atlas, 0, 0.34, 0, { uv: atlasUV('hazardRW', 2) });
}

function buildBar(mg: Merger, m: EnvMaterials): void {
  for (const sx of [-1.12, 1.12]) {
    mg.add(CYL, m.atlas, sx, 1.15, 0, { scale: [0.09, 2.3, 0.09], color: 0x3a4250, uv: DARK });
    mg.add(BOX, m.atlas, sx, 0.03, 0, { scale: [0.3, 0.06, 0.5], color: 0x2a303b, uv: DARK });
  }
  mg.add(new RoundedBoxGeometry(2.4, 0.95, 0.24, 2, 0.06), m.atlas, 0, 1.7, 0, { uv: atlasUV('hazardYB', 2) });
  for (const lx of [-0.8, 0, 0.8]) mg.add(ICO, m.glow, lx, 2.25, 0, { scale: [0.1, 0.1, 0.1], color: 0xff4040, glow: 2.6 });
}

function partsFor(o: Obstacle, theme: Theme, m: EnvMaterials): Parts {
  const idx = o.id % theme.trains.length;
  const L = o.kind === 'train' ? obstacleLength(o) : 0;
  const key = `${theme.id}:${o.kind}:${o.kind === 'train' ? idx : 0}:${L}`;
  let hit = cache.get(key);
  if (!hit) {
    const mg = new Merger();
    if (o.kind === 'train') buildTrain(L, theme.trains[idx].body, theme.trains[idx].accent, mg, m);
    else if (o.kind === 'ramp') buildRamp(mg, m);
    else if (o.kind === 'hurdle') buildHurdle(mg, m);
    else buildBar(mg, m);
    hit = new Map();
    for (const [mat, geo] of mg.geometries()) {
      geo.userData.shared = true;
      hit.set(mat === m.glow ? 'glow' : 'atlas', geo);
    }
    cache.set(key, hit);
  }
  return { atlas: hit.get('atlas')!, glow: hit.get('glow') ?? null };
}

/** Forget cached obstacle geometry (materials were recreated, or the cache grew large). */
export function clearVehicleCache(): void {
  for (const parts of cache.values()) for (const g of parts.values()) g.dispose();
  cache.clear();
}

export function makeObstacle(o: Obstacle, m: EnvMaterials, theme: Theme): THREE.Group {
  const g = new THREE.Group();
  const p = partsFor(o, theme, m);
  const a = new THREE.Mesh(p.atlas, m.atlas);
  a.castShadow = true;
  g.add(a);
  if (p.glow) g.add(new THREE.Mesh(p.glow, m.glow));
  // trains are centred on their middle, thin obstacles and ramps sit at their near edge
  const zCenter = o.kind === 'train' ? o.z + obstacleLength(o) / 2 : o.kind === 'ramp' ? o.z : o.z + 0.25;
  g.position.set(laneX(o.lane), 0, -zCenter);
  return g;
}
