// Shared bits for the 3D journey-map renderer: seeded random numbers, cached shaded geometry and materials, small texture painters.
// Units are map pixels. +x is right, +y is up, +z points towards the viewer (down the screen).
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Rng = () => number;
export const rngOf = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
export const range = (r: Rng, a: number, b: number): number => a + r() * (b - a);
export const pick = <T,>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)];
export const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
export const smooth = (a: number, b: number, v: number): number => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Cheap smooth value noise in 2D (deterministic, no state). */
export function noise2(x: number, y: number): number {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
export const fbm = (x: number, y: number): number => noise2(x, y) * 0.55 + noise2(x * 2.1, y * 2.1) * 0.3 + noise2(x * 4.3, y * 4.3) * 0.15;

export const col = (c: number | string): THREE.Color => new THREE.Color(c as never);
export const mixc = (a: number | string, b: number | string, t: number): THREE.Color => col(a).lerp(col(b), t);

// ───────────── geometry: shared, with a grey vertex-colour gradient that darkens the underside (cheap ambient occlusion) ─────────────
function shade(g: THREE.BufferGeometry, lo = 0.62, hi = 1.0, power = 0.9): THREE.BufferGeometry {
  g.computeBoundingBox();
  const p = g.attributes.position, { min, max } = g.boundingBox!;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = clamp((p.getY(i) - min.y) / (max.y - min.y || 1)); const v = lo + (hi - lo) * Math.pow(t, power); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
export const shaded = shade;

const cache = new Map<string, THREE.BufferGeometry>();
const once = (k: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => { let g = cache.get(k); if (!g) { g = make(); cache.set(k, g); } return g; };
export const G = {
  sphere: () => once('sphere', () => shade(new THREE.SphereGeometry(1, 28, 20), 0.6, 1)),
  sphereLow: () => once('sphereLow', () => shade(new THREE.SphereGeometry(1, 14, 10), 0.6, 1)),
  cyl: () => once('cyl', () => shade(new THREE.CylinderGeometry(1, 1, 1, 24), 0.7, 1, 1)),
  cyl6: () => once('cyl6', () => shade(new THREE.CylinderGeometry(1, 1, 1, 6), 0.7, 1, 1)),
  cone: () => once('cone', () => shade(new THREE.ConeGeometry(1, 1, 28), 0.55, 1, 1)),
  cone8: () => once('cone8', () => shade(new THREE.ConeGeometry(1, 1, 8), 0.55, 1, 1)),
  box: () => once('box', () => shade(new THREE.BoxGeometry(1, 1, 1), 0.72, 1, 1)),
  oct: () => once('oct', () => shade(new THREE.OctahedronGeometry(1, 0), 0.6, 1)),
  torus: () => once('torus', () => shade(new THREE.TorusGeometry(1, 0.3, 14, 36), 0.7, 1)),
  disc: () => once('disc', () => shade(new THREE.CylinderGeometry(1, 1, 0.02, 40), 1, 1)),
  prism: () => once('prism', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1); g.rotateZ(Math.PI / 2); return shade(g, 0.8, 1, 1); }), // triangular roof: ridge along x, apex +1, base at -0.5 and z = ±0.87
  capsule: () => once('capsule', () => shade(new THREE.CapsuleGeometry(1, 1, 8, 20), 0.65, 1)),
};

/** Eight lumpy spheres (organic foliage, rocks, clouds); smooth normals, mottled vertex colours. */
export function lumpy(i: number, detail = 3, amp = 0.17): THREE.BufferGeometry {
  return once(`lumpy${i}|${detail}|${amp}`, () => {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    const p = g.attributes.position, o = i * 17.3;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const n = noise2(x * 1.8 + o, y * 1.8 + z * 1.3) * 0.6 + noise2(x * 3.9 + z * 2.2 + o, y * 3.9 - x) * 0.4;
      const d = 1 + (n - 0.5) * 2 * amp;
      p.setXYZ(k, x * d, y * d * 0.93, z * d);
    }
    g = mergeVertices(g, 1e-4);
    g.computeVertexNormals();
    shade(g, 0.5, 1.04, 0.85);
    const c = g.attributes.color, q = g.attributes.position;
    for (let k = 0; k < c.count; k++) { const m = 0.88 + 0.2 * noise2(q.getX(k) * 6 + o, q.getZ(k) * 6 + q.getY(k) * 3); c.setXYZ(k, c.getX(k) * m, c.getY(k) * m, c.getZ(k) * m); }
    return g;
  });
}

// ───────────── materials ─────────────
export interface MatOpts { r?: number; m?: number; e?: number; ec?: number | string; vc?: boolean; side?: THREE.Side; map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null; flat?: boolean; opacity?: number; env?: number }
const mats = new Map<string, THREE.MeshStandardMaterial>();
let texId = 0;
const texKeys = new WeakMap<THREE.Texture, number>();
const tk = (t?: THREE.Texture | null): number => { if (!t) return 0; let k = texKeys.get(t); if (!k) { k = ++texId; texKeys.set(t, k); } return k; };

export function mat(color: number | string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = [col(color).getHexString(), o.r ?? 0.8, o.m ?? 0, o.e ?? 0, o.ec ?? '', o.vc ?? true, o.side ?? 0, tk(o.map), tk(o.emissiveMap), o.flat ?? false, o.opacity ?? 1, o.env ?? 1].join('|');
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: col(color), roughness: o.r ?? 0.8, metalness: o.m ?? 0, vertexColors: o.vc ?? true, side: o.side ?? THREE.FrontSide,
      map: o.map ?? null, flatShading: o.flat ?? false, envMapIntensity: o.env ?? 1,
      transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1,
    });
    if (o.e) { m.emissive = col(o.ec ?? color); m.emissiveIntensity = o.e; if (o.emissiveMap) m.emissiveMap = o.emissiveMap; }
    mats.set(key, m);
  }
  return m;
}
export const disposeMats = (): void => { mats.forEach((m) => { m.map?.dispose(); m.emissiveMap?.dispose(); m.dispose(); }); mats.clear(); };

export interface Place { s?: [number, number, number] | number; r?: [number, number, number]; cast?: boolean; recv?: boolean }
/** Adds a mesh to `parent` at (x, y, z) with scale and Euler rotation; casts and receives shadows by default. */
export function put(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, p: Place = {}): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  const s = p.s ?? 1;
  if (typeof s === 'number') me.scale.set(s, s, s); else me.scale.set(s[0], s[1], s[2]);
  if (p.r) me.rotation.set(p.r[0], p.r[1], p.r[2]);
  me.castShadow = p.cast ?? true; me.receiveShadow = p.recv ?? true;
  parent.add(me);
  return me;
}

// ───────────── textures ─────────────
export function paint(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, opts: { repeat?: boolean; srgb?: boolean } = {}): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
export const css = (c: number | string): string => `#${col(c).getHexString()}`;

/** A soft round dark blob (contact shadow) or a glow, as a texture. */
let blobTex: THREE.CanvasTexture | null = null;
export function softDisc(): THREE.CanvasTexture {
  if (!blobTex) blobTex = paint(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  return blobTex;
}
export const disposeKit = (): void => { blobTex?.dispose(); blobTex = null; cache.forEach((g) => g.dispose()); cache.clear(); disposeMats(); };
