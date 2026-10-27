// 3D scenery for the journey map: each prop is a small THREE.Group standing at the origin (y = 0 is the ground).
// Heights are in map pixels (a tree is ~100 tall). Built from shared shaded geometry and cached materials (map3dKit.ts).
import * as THREE from 'three';
import { G, lumpy, mat, mixc, noise2, paint, pick, put, range, shaded, css, type Rng } from './map3dKit';

export type Prop = (r: Rng) => THREE.Group;
const grp = (): THREE.Group => new THREE.Group();
const TAU = Math.PI * 2;
const tone = (c: number | string, t: number) => (t >= 0 ? mixc(c, 0xffffff, t) : mixc(c, 0x000000, -t)).getHex();

const leafy = (g: THREE.Group, c: number | string, x: number, y: number, z: number, rx: number, ry: number, rz: number, r: Rng, rough = 0.62): void => {
  put(g, lumpy(Math.floor(r() * 6)), mat(c, { r: rough }), x, y, z, { s: [rx, ry, rz], r: [0, r() * TAU, 0] });
};

// ───────────── nature ─────────────
export const oak = (hue: number | string): Prop => (r) => {
  const g = grp(), h = r(), top = tone(hue, 0.16);
  put(g, G.cyl(), mat(0x7c4a1d, { r: 0.9 }), 0, 24, 0, { s: [6, 48, 6], r: [0, 0, (r() - 0.5) * 0.08] });
  put(g, G.cone(), mat(0x7c4a1d, { r: 0.9 }), 0, 4, 0, { s: [11, 12, 11] });
  put(g, G.cyl(), mat(0x6b3f19, { r: 0.9 }), 7, 38, 0, { s: [3, 22, 3], r: [0, 0, -0.9] });
  leafy(g, tone(hue, -0.12), 0, 62, 0, 34, 28, 34, r);
  leafy(g, hue, -20, 56, 8, 24, 21, 24, r); leafy(g, hue, 22, 58, -4, 25, 22, 25, r);
  leafy(g, tone(hue, -0.05), 2, 82, 4, 25, 22, 25, r);
  leafy(g, top, -8, 92, 10, 15, 13, 15, r); leafy(g, top, 18, 78, 14, 12, 11, 12, r);
  g.scale.setScalar(0.92 + h * 0.2);
  return g;
};

export const pine = (hue: number | string, snow = false): Prop => (r) => {
  const g = grp();
  put(g, G.cyl(), mat(0x5b3a1a, { r: 0.95 }), 0, 9, 0, { s: [5, 18, 5] });
  for (let k = 0; k < 5; k++) {
    const w = 32 - k * 5.4, y = 18 + k * 20, c = k % 2 ? tone(hue, 0.08) : tone(hue, -0.1);
    put(g, G.cone8(), mat(c, { r: 0.7 }), 0, y + 16, 0, { s: [w, 38, w], r: [0, r() * 3, 0] });
    if (snow) put(g, G.cone8(), mat(0xffffff, { r: 0.5 }), 0, y + 22, 0, { s: [w * 0.78, 28, w * 0.78], r: [0, r() * 3, 0] });
  }
  put(g, G.cone8(), mat(snow ? 0xffffff : tone(hue, 0.2), { r: 0.6 }), 0, 124, 0, { s: [6, 18, 6] });
  g.scale.setScalar(0.85 + r() * 0.25);
  return g;
};

export const palm: Prop = (r) => {
  const g = grp(), lean = (r() - 0.5) * 0.5;
  const trunk = mat(0xa8772f, { r: 0.85 });
  let px = 0, py = 0;
  for (let k = 0; k < 6; k++) {
    put(g, G.cyl(), k % 2 ? mat(0xc08a3e, { r: 0.85 }) : trunk, px + Math.sin(lean) * 7, py + 8, 0, { s: [6.5 - k * 0.45, 17, 6.5 - k * 0.45], r: [0, 0, -lean] });
    px += Math.sin(lean) * 15.5; py += Math.cos(lean) * 15.5;
  }
  const fm = (c: number) => mat(c, { r: 0.5, side: THREE.DoubleSide });
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + r() * 0.3, len = 52 + r() * 14, geo = frondGeo(len);
    const f = put(g, geo, fm(k % 2 ? 0x23a455 : 0x38c46a), px, py + 4, 0, { s: 1, r: [0, -a, 0] });
    f.rotation.z = 0; f.castShadow = true;
  }
  put(g, G.sphereLow(), mat(0x6b3f1d, { r: 0.7 }), px - 3, py + 1, 3, { s: 5 }); put(g, G.sphereLow(), mat(0x7c4a1d, { r: 0.7 }), px + 4, py + 1, -2, { s: 5 });
  g.scale.setScalar(0.95 + r() * 0.3);
  return g;
};
const fronds = new Map<number, THREE.BufferGeometry>();
function frondGeo(len: number): THREE.BufferGeometry {
  const k = Math.round(len / 4);
  let g = fronds.get(k);
  if (!g) {
    g = new THREE.PlaneGeometry(1, 1, 10, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) + 0.5, w = (1 - t * t * 0.9) * Math.sin(Math.min(1, t * 6) * 1.57), side = p.getY(i); // taper to a tip
      p.setXYZ(i, t * k * 4, -t * t * 26 + (1 - t) * 6, side * 15 * w);
    }
    g.computeVertexNormals(); shaded(g, 0.6, 1, 1); fronds.set(k, g);
  }
  return g;
}

export const cactus: Prop = (r) => {
  const g = grp(), m = mat(0x2f9e4f, { r: 0.65 }), m2 = mat(0x3ab45f, { r: 0.65 });
  const H = 62 + r() * 20;
  put(g, G.capsule(), m, 0, H / 2, 0, { s: [9, H / 2 - 4, 9] });
  for (const side of [-1, 1]) {
    const hh = 22 + r() * 16, y = 26 + r() * 14;
    put(g, G.capsule(), m2, side * 17, y + hh / 2 + 6, 0, { s: [5.5, hh / 2 - 2, 5.5] });
    put(g, G.capsule(), m2, side * 10, y + 2, 0, { s: [4.6, 6, 4.6], r: [0, 0, Math.PI / 2] });
  }
  put(g, G.sphereLow(), mat(0xf472b6, { r: 0.5 }), 0, H + 5, 0, { s: 4 });
  for (let i = 0; i < 14; i++) { const a = r() * TAU, y = 6 + r() * (H - 10); put(g, G.sphereLow(), mat(0xfff7c2, { r: 0.8 }), Math.cos(a) * 8.6, y, Math.sin(a) * 8.6, { s: 0.9, cast: false }); }
  return g;
};

export const rock = (c: number | string): Prop => (r) => {
  const g = grp(), s = 12 + r() * 14;
  put(g, lumpy(Math.floor(r() * 6) + 10, 2, 0.28), mat(c, { r: 0.92, flat: false }), 0, s * 0.45, 0, { s: [s * 1.2, s * 0.8, s], r: [0, r() * TAU, 0] });
  if (r() > 0.5) put(g, lumpy(Math.floor(r() * 6) + 10, 2, 0.28), mat(tone(c, 0.12), { r: 0.92 }), s * 1.1, s * 0.25, s * 0.3, { s: [s * 0.5, s * 0.4, s * 0.45] });
  return g;
};

export const bush = (c: number | string): Prop => (r) => {
  const g = grp();
  leafy(g, tone(c, -0.1), -9, 9, 0, 12, 10, 12, r); leafy(g, tone(c, -0.1), 9, 9, 2, 12, 10, 12, r); leafy(g, c, 0, 15, 0, 14, 12, 14, r);
  if (r() > 0.55) for (let i = 0; i < 5; i++) put(g, G.sphereLow(), mat(pick(r, [0xff6b81, 0xfff,  0xfbbf24]), { r: 0.5 }), (r() - 0.5) * 22, 10 + r() * 12, 10 + r() * 4, { s: 1.6, cast: false });
  return g;
};

export const flowers = (cols: readonly number[]): Prop => (r) => {
  const g = grp();
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.5) * 38, z = (r() - 0.5) * 18, h = 7 + r() * 7, c = pick(r, cols);
    put(g, G.cyl(), mat(0x2f8f3f, { r: 0.8 }), x, h / 2, z, { s: [0.7, h, 0.7], cast: false });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; put(g, G.sphereLow(), mat(c, { r: 0.5 }), x + Math.cos(a) * 2.3, h + 0.4, z + Math.sin(a) * 2.3, { s: [1.9, 1.1, 1.9], cast: false }); }
    put(g, G.sphereLow(), mat(0xffd84a, { r: 0.5 }), x, h + 1, z, { s: 1.4, cast: false });
  }
  return g;
};

export const tuft = (c: number | string): Prop => (r) => {
  const g = grp(), m = mat(c, { r: 0.8 }), m2 = mat(tone(c, 0.25), { r: 0.8 });
  for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + r(), h = 9 + r() * 9; put(g, G.cone8(), k % 2 ? m : m2, Math.cos(a) * 3, h / 2, Math.sin(a) * 3, { s: [1.3, h, 1.3], r: [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], cast: false }); }
  return g;
};

// ───────────── buildings ─────────────
export const house = (wall: number, roof: number): Prop => (r) => {
  const g = grp(), W = 54 + r() * 10, D = 42 + r() * 8, H = 36 + r() * 6;
  put(g, G.box(), mat(wall, { r: 0.85 }), 0, H / 2, 0, { s: [W, H, D] });
  put(g, G.box(), mat(0x9ca3af, { r: 0.9 }), 0, 2, 0, { s: [W + 3, 4, D + 3] });
  put(g, G.prism(), mat(roof, { r: 0.6 }), 0, H + 11, 0, { s: [W + 12, 23, (D + 12) / 1.74] });
  put(g, G.box(), mat(0x6b3f1d, { r: 0.8 }), -W * 0.2, 12, D / 2 + 0.6, { s: [10, 24, 1.4] });
  put(g, G.sphereLow(), mat(0xffd84a, { m: 0.8, r: 0.3 }), -W * 0.2 + 3, 12, D / 2 + 1.5, { s: 1.1 });
  for (const x of [W * 0.2, W * 0.36]) { put(g, G.box(), mat(0xdbeafe, { r: 0.2, m: 0.1, e: 0.3, ec: 0xbfdbfe }), x, H * 0.55, D / 2 + 0.6, { s: [9, 11, 1.2] }); put(g, G.box(), mat(0xffffff, { r: 0.6 }), x, H * 0.55, D / 2 + 1.1, { s: [11, 1.5, 1.2] }); }
  put(g, G.box(), mat(tone(roof, -0.3), { r: 0.8 }), W * 0.25, H + 24, -D * 0.15, { s: [8, 20, 8] });
  g.rotation.y = (r() - 0.5) * 0.3;
  return g;
};

const windowTex = (lit: string[], dark: string): THREE.CanvasTexture => paint(64, 128, (c, w, h) => {
  c.fillStyle = dark; c.fillRect(0, 0, w, h);
  for (let y = 6; y < h - 6; y += 16) for (let x = 6; x < w - 6; x += 14) { c.fillStyle = Math.random() > 0.3 ? lit[Math.floor(Math.random() * lit.length)] : dark; c.fillRect(x, y, 8, 10); }
}, { repeat: true });
const towerTexCache = new Map<string, THREE.CanvasTexture>();
export const tower = (wall: number, glow: number, night = false): Prop => (r) => {
  const g = grp(), W = 38 + r() * 24, D = 34 + r() * 16, H = 100 + r() * 100;
  const key = `${wall}|${night}`;
  let tex = towerTexCache.get(key);
  if (!tex) { tex = night ? windowTex(['#fde047', '#67e8f9', '#f0abfc', '#fff'], css(tone(wall, -0.15))) : windowTex(['#bfe3ff', '#e0f2fe', '#9ccdf5'], css(tone(wall, -0.05))); towerTexCache.set(key, tex); }
  const t = tex.clone(); t.repeat.set(Math.max(1, Math.round(W / 36)), Math.max(1, Math.round(H / 64))); t.needsUpdate = true;
  put(g, G.box(), mat(night ? 0xffffff : 0xffffff, { r: night ? 0.55 : 0.3, m: night ? 0.2 : 0.35, map: t, vc: true, e: night ? 0.9 : 0, ec: 0xffffff, emissiveMap: night ? t : null }), 0, H / 2, 0, { s: [W, H, D] });
  put(g, G.box(), mat(tone(wall, 0.15), { r: 0.6 }), 0, H + 2, 0, { s: [W + 4, 5, D + 4] });
  if (r() > 0.4) put(g, G.box(), mat(tone(wall, -0.1), { r: 0.6 }), 0, H + 10, 0, { s: [W * 0.55, 14, D * 0.55] });
  put(g, G.cyl(), mat(0x94a3b8, { m: 0.6, r: 0.4 }), 0, H + 26, 0, { s: [1, 26, 1] });
  put(g, G.sphereLow(), mat(night ? glow : 0xef4444, { e: 2, ec: night ? glow : 0xef4444, vc: false }), 0, H + 40, 0, { s: 2.4, cast: false });
  return g;
};

export const lamp = (c: number | string): Prop => () => {
  const g = grp();
  put(g, G.cyl(), mat(0x334155, { m: 0.6, r: 0.4 }), 0, 38, 0, { s: [2.4, 76, 2.4] });
  put(g, G.cyl(), mat(0x334155, { m: 0.6, r: 0.4 }), 0, 2, 0, { s: [7, 4, 7] });
  put(g, G.box(), mat(0x334155, { m: 0.6, r: 0.4 }), 8, 75, 0, { s: [16, 2.4, 2.4] });
  put(g, G.sphereLow(), mat(c, { e: 2.4, ec: c, vc: false }), 15, 72, 0, { s: 5.5, cast: false });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: new THREE.Color(c as never), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(70, 70, 1); glow.position.set(15, 72, 0); g.add(glow);
  return g;
};
let glowTex: THREE.CanvasTexture | null = null;
export const GLOW = (): THREE.CanvasTexture => glowTex ??= paint(128, 128, (c) => { const r = c.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, 128, 128); });
export const releaseProps = (): void => { glowTex?.dispose(); glowTex = null; towerTexCache.forEach((t) => t.dispose()); towerTexCache.clear(); fronds.forEach((g) => g.dispose()); fronds.clear(); stripeTex.forEach((t) => t.dispose()); stripeTex.clear(); };

export const bench: Prop = () => {
  const g = grp(), wood = mat(0xb8792e, { r: 0.7 }), iron = mat(0x374151, { m: 0.6, r: 0.4 });
  put(g, G.box(), wood, 0, 15, 0, { s: [40, 4, 11] }); put(g, G.box(), wood, 0, 26, -6, { s: [40, 4, 3], r: [-0.15, 0, 0] }); put(g, G.box(), wood, 0, 21, -5, { s: [40, 4, 3], r: [-0.15, 0, 0] });
  for (const x of [-17, 17]) put(g, G.box(), iron, x, 7, 0, { s: [3, 14, 10] });
  return g;
};

export const pond: Prop = (r) => {
  const g = grp(), w = 52 + r() * 18;
  put(g, G.disc(), mat(0x6b7280, { r: 0.9, vc: false }), 0, 0.6, 0, { s: [w + 6, 1, (w + 6) * 0.62], recv: true, cast: false });
  put(g, G.disc(), mat(0x2aa4e8, { r: 0.08, m: 0.1, vc: false, env: 1.6 }), 0, 1.6, 0, { s: [w, 1, w * 0.62], cast: false });
  put(g, G.disc(), mat(0x9bdcf8, { r: 0.1, vc: false, opacity: 0.55 }), -w * 0.12, 1.9, -w * 0.06, { s: [w * 0.55, 1, w * 0.28], cast: false });
  for (let i = 0; i < 3; i++) put(g, G.disc(), mat(0x2f9e4f, { r: 0.6, vc: false }), (r() - 0.5) * w * 0.8, 2.2, (r() - 0.5) * w * 0.4, { s: [5, 1, 5], cast: false });
  put(g, G.sphereLow(), mat(0xf9a8d4, { r: 0.5 }), w * 0.18, 3.4, w * 0.05, { s: 2.4 });
  return g;
};

// ───────────── beach ─────────────
const stripeTex = new Map<string, THREE.CanvasTexture>();
const stripes = (a: string, b: string, n = 8): THREE.CanvasTexture => {
  const k = `${a}${b}${n}`; let t = stripeTex.get(k);
  if (!t) { t = paint(256, 8, (c, w, h) => { for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect((i * w) / n, 0, w / n + 1, h); } }, { repeat: true }); stripeTex.set(k, t); }
  return t;
};
export const umbrella: Prop = (r) => {
  const g = grp(), c = pick(r, [['#ef4444', '#ffffff'], ['#2563eb', '#ffffff'], ['#f59e0b', '#ffffff']]);
  g.add(Object.assign(new THREE.Group(), {}));
  put(g, G.cyl(), mat(0xfff7ed, { r: 0.6 }), 0, 28, 0, { s: [1.5, 58, 1.5], r: [0, 0, 0.1] });
  const cone = put(g, G.cone(), mat(0xffffff, { r: 0.55, map: stripes(c[0], c[1], 8), vc: false, side: THREE.DoubleSide }), 4, 58, 0, { s: [38, 16, 38] });
  cone.rotation.y = r() * 3;
  put(g, G.sphereLow(), mat(0xfff7ed, { r: 0.5 }), 4, 67, 0, { s: 2.5 });
  put(g, G.disc(), mat(0xfde68a, { r: 0.9, vc: false }), 12, 0.8, 18, { s: [34, 1, 12], cast: false });
  return g;
};
export const sandcastle: Prop = () => {
  const g = grp(), m = mat(0xe9be72, { r: 0.95 }), m2 = mat(0xdaa95a, { r: 0.95 });
  put(g, G.box(), m, 0, 11, 0, { s: [50, 22, 36] });
  for (const x of [-26, 26]) { put(g, G.cyl(), m2, x, 18, 0, { s: [10, 36, 10] }); put(g, G.cone(), mat(0xef4444, { r: 0.5 }), x, 42, 0, { s: [12, 14, 12] }); }
  for (const x of [-14, -5, 5, 14]) put(g, G.box(), m, x, 25, 15, { s: [6, 7, 5] });
  put(g, G.cyl(), m2, 0, 30, 0, { s: [10, 26, 10] }); put(g, G.cone(), mat(0xfacc15, { r: 0.5 }), 0, 50, 0, { s: [12, 14, 12] });
  put(g, G.box(), mat(0x6b4a2a, { r: 0.9 }), 0, 8, 18.5, { s: [10, 16, 1.5] });
  return g;
};
export const shell: Prop = (r) => {
  const g = grp(), c = pick(r, [0xfda4af, 0xfde68a, 0xe9d5ff, 0xffffff]);
  put(g, G.sphereLow(), mat(c, { r: 0.35, m: 0.1 }), 0, 2.5, 0, { s: [6, 3.5, 5], r: [0, r() * 3, 0] });
  return g;
};
export const boat: Prop = () => {
  const g = grp();
  put(g, G.box(), mat(0xb91c1c, { r: 0.5 }), 0, 5, 0, { s: [54, 11, 18], r: [0, 0, 0] });
  put(g, G.box(), mat(0xffffff, { r: 0.5 }), 0, 11, 0, { s: [50, 2.5, 19] });
  put(g, G.cyl(), mat(0x78350f, { r: 0.8 }), 0, 36, 0, { s: [1.8, 56, 1.8] });
  put(g, G.prism(), mat(0xffffff, { r: 0.6, side: THREE.DoubleSide }), 7, 38, 0, { s: [1, 22, 16], r: [0, Math.PI / 2, 0] });
  return g;
};

// ───────────── candy land ─────────────
const swirl = (a: string, b: string): THREE.CanvasTexture => paint(256, 256, (c, w, h) => { c.fillStyle = b; c.fillRect(0, 0, w, h); c.translate(w / 2, h / 2); c.fillStyle = a; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(0, 0); for (let t = 0; t <= 1; t += 0.05) { const ang = k * (TAU / 6) + t * 5, rr = t * w * 0.56; c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } for (let t = 1; t >= 0; t -= 0.05) { const ang = k * (TAU / 6) + t * 5 + 0.5, rr = t * w * 0.56; c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } c.fill(); } });
export const lolly: Prop = (r) => {
  const g = grp(), c = pick(r, ['#f472b6', '#a855f7', '#22c55e', '#38bdf8', '#fb923c']);
  put(g, G.cyl(), mat(0xffffff, { r: 0.3 }), 0, 38, 0, { s: [3, 76, 3] });
  const t = swirl(c, '#ffffff');
  const d = put(g, G.cyl(), mat(0xffffff, { r: 0.18, map: t, vc: false, env: 1.4 }), 0, 90, 0, { s: [30, 7, 30], r: [Math.PI / 2, 0, 0] });
  d.rotation.set(Math.PI / 2, 0, 0); d.rotation.z = 0; d.rotation.y = 0;
  d.scale.set(30, 8, 30); d.position.z = 0; d.rotateX(0); d.rotation.x = Math.PI / 2 + 0.25;
  put(g, G.torus(), mat(0xffffff, { r: 0.2 }), 0, 90, 0.2, { s: [29, 29, 20], r: [0.25, 0, 0] }).visible = false;
  return g;
};
export const cupcake: Prop = (r) => {
  const g = grp(), c = pick(r, [0xf472b6, 0xfde047, 0x67e8f9, 0xfdba74]);
  put(g, G.cone(), mat(0xd18b3a, { r: 0.7 }), 0, 17, 0, { s: [24, 34, 24], r: [Math.PI, 0, 0] });
  for (const [y, rr] of [[38, 25], [52, 19], [64, 13]] as [number, number][]) put(g, G.sphere(), mat(c, { r: 0.28, env: 1.3 }), 0, y, 0, { s: [rr, 9, rr] });
  put(g, G.sphere(), mat(0xdc2626, { r: 0.18, env: 1.5 }), 0, 77, 0, { s: 6.5 });
  for (let i = 0; i < 10; i++) { const a = r() * TAU, rr = 10 + r() * 14; put(g, G.sphereLow(), mat(pick(r, [0xffffff, 0xfde047, 0x38bdf8, 0xa855f7]), { r: 0.5 }), Math.cos(a) * rr, 44 + r() * 8, Math.sin(a) * rr, { s: 1.4, cast: false }); }
  return g;
};
export const candyCane: Prop = () => {
  const g = grp();
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 52, 0)];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push(new THREE.Vector3(Math.sin(a) * 15 - 0 + 0, 52 + Math.sin(a * 1 + 0) * 0 + 0, 0)); }
  const arc: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 56, 0)];
  for (let i = 1; i <= 14; i++) { const a = (i / 14) * Math.PI; arc.push(new THREE.Vector3(15 - Math.cos(a) * 15, 56 + Math.sin(a) * 15, 0)); }
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 80, 5, 14, false);
  shaded(tube, 0.8, 1, 1);
  const t = stripes('#ef4444', '#ffffff', 10).clone(); t.repeat.set(1, 1); t.rotation = Math.PI / 2; t.needsUpdate = true;
  const m = mat(0xffffff, { r: 0.22, map: stripes('#ef4444', '#ffffff', 14), vc: false, env: 1.3 });
  void pts;
  const me = new THREE.Mesh(tube, m); me.castShadow = true; me.receiveShadow = true; g.add(me);
  g.userData.own = [tube];
  return g;
};
export const gumdrop: Prop = (r) => {
  const g = grp(), c = pick(r, [0xef4444, 0x22c55e, 0xfacc15, 0xa855f7, 0xfb923c, 0x38bdf8]);
  const pts: THREE.Vector2[] = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(Math.sin(t * 1.5707) * 17 * (1 - 0.05 * t) + (i === 0 ? 0 : 0), Math.cos(t * 1.5707) * 30)); }
  const lathe = shaded(new THREE.LatheGeometry(pts.reverse(), 28), 0.7, 1, 1);
  const me = new THREE.Mesh(lathe, mat(c, { r: 0.12, env: 1.6 })); me.castShadow = true; me.receiveShadow = true; g.add(me); g.userData.own = [lathe];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; put(g, G.sphereLow(), mat(0xffffff, { r: 0.6 }), Math.cos(a) * 16.2, 2, Math.sin(a) * 16.2, { s: 1.1, cast: false }); }
  put(g, G.sphereLow(), mat(0xffffff, { r: 0.1, opacity: 0.7, e: 0.3, ec: 0xffffff, vc: false }), -6, 22, 9, { s: [3.5, 6, 2], cast: false });
  g.scale.setScalar(0.85 + r() * 0.4);
  return g;
};
export const iceCream: Prop = (r) => {
  const g = grp(), c = pick(r, [0xf9a8d4, 0xfde68a, 0xa7f3d0, 0xc4b5fd]);
  put(g, G.cone(), mat(0xd9a05b, { r: 0.8 }), 0, 24, 0, { s: [14, 48, 14], r: [Math.PI, 0, 0] });
  put(g, G.sphere(), mat(c, { r: 0.35, env: 1.2 }), 0, 54, 0, { s: 19 }); put(g, G.sphere(), mat(tone(c, 0.2), { r: 0.35 }), 0, 74, 0, { s: 15 });
  put(g, G.sphere(), mat(0xdc2626, { r: 0.18, env: 1.5 }), 0, 91, 0, { s: 5 });
  put(g, G.torus(), mat(c, { r: 0.35 }), 0, 44, 0, { s: [19, 19, 14], r: [Math.PI / 2, 0, 0] });
  return g;
};

// ───────────── snow ─────────────
export const snowman: Prop = () => {
  const g = grp(), w = mat(0xffffff, { r: 0.55 });
  put(g, G.sphere(), w, 0, 20, 0, { s: 22 }); put(g, G.sphere(), w, 0, 54, 0, { s: 16 }); put(g, G.sphere(), w, 0, 79, 0, { s: 12 });
  put(g, G.cone8(), mat(0xf97316, { r: 0.5 }), 0, 78, 14, { s: [2.6, 14, 2.6], r: [Math.PI / 2, 0, 0] });
  for (const x of [-4, 4]) put(g, G.sphereLow(), mat(0x111111, { r: 0.4 }), x, 83, 10.5, { s: 1.4 });
  for (const y of [48, 58, 36]) put(g, G.sphereLow(), mat(0x111111, { r: 0.4 }), 0, y, y === 36 ? 21 : 15, { s: 1.8 });
  put(g, G.cyl(), mat(0x1e293b, { r: 0.6 }), 0, 98, 0, { s: [9, 13, 9] }); put(g, G.cyl(), mat(0x1e293b, { r: 0.6 }), 0, 91.5, 0, { s: [14, 2, 14] });
  put(g, G.torus(), mat(0xdc2626, { r: 0.7 }), 0, 68, 0, { s: [12, 12, 8], r: [Math.PI / 2, 0, 0] });
  put(g, G.cyl(), mat(0x6b3f1d, { r: 0.9 }), -26, 56, 0, { s: [1.5, 36, 1.5], r: [0, 0, 1.0] }); put(g, G.cyl(), mat(0x6b3f1d, { r: 0.9 }), 26, 56, 0, { s: [1.5, 36, 1.5], r: [0, 0, -1.0] });
  return g;
};
export const igloo: Prop = () => {
  const g = grp();
  const t = paint(256, 128, (c, w, h) => { c.fillStyle = '#f8fafc'; c.fillRect(0, 0, w, h); c.strokeStyle = '#cbd5e1'; c.lineWidth = 3; for (let y = 0; y < h; y += 22) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = (y / 22) % 2 ? 0 : 20; x < w; x += 40) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 22); c.stroke(); } } }, { repeat: true });
  const dome = new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2); shaded(dome, 0.8, 1, 1);
  const me = new THREE.Mesh(dome, mat(0xffffff, { r: 0.45, map: t, vc: true })); me.scale.set(46, 42, 46); me.castShadow = me.receiveShadow = true; g.add(me); g.userData.own = [dome];
  put(g, G.cyl(), mat(0xffffff, { r: 0.5, map: t }), 0, 11, 40, { s: [14, 22, 22], r: [Math.PI / 2, 0, 0] });
  put(g, G.cyl(), mat(0x0b1226, { r: 0.9, vc: false }), 0, 11, 51.4, { s: [9.5, 1, 9.5], r: [Math.PI / 2, 0, 0], cast: false });
  return g;
};
export const iceSpike: Prop = (r) => {
  const g = grp();
  for (let k = 0; k < 5; k++) { const h = 30 + r() * 50, a = (k - 2) * 11 + (r() - 0.5) * 6, w = 6 + r() * 4; put(g, G.cone8(), mat(0x8fdcff, { r: 0.08, m: 0.1, env: 1.8, e: 0.12, ec: 0x38bdf8 }), a, h / 2, (r() - 0.5) * 12, { s: [w, h, w], r: [(r() - 0.5) * 0.2, r() * 3, (r() - 0.5) * 0.25] }); }
  return g;
};
export const snowPeak: Prop = (r) => {
  const g = grp(), h = 130 + r() * 70, w = h * 0.85;
  put(g, G.cone8(), mat(0x64748b, { r: 0.95, flat: true }), 0, h / 2, 0, { s: [w, h, w * 0.8], r: [0, r() * 3, 0] });
  put(g, G.cone8(), mat(0xffffff, { r: 0.5 }), 0, h * 0.78, 0, { s: [w * 0.43, h * 0.46, w * 0.35], r: [0, r() * 3, 0] });
  return g;
};

// ───────────── jungle ─────────────
export const jungleTree: Prop = (r) => {
  const g = grp();
  put(g, G.cyl(), mat(0x5b3a1a, { r: 0.95 }), 0, 38, 0, { s: [9, 76, 9] }); put(g, G.cone(), mat(0x5b3a1a, { r: 0.95 }), 0, 8, 0, { s: [18, 18, 18] });
  for (const [x, y, z, rr] of [[-30, 82, 0, 30], [32, 84, 4, 28], [0, 104, -4, 34], [-14, 70, 16, 24], [18, 68, -16, 24], [-4, 120, 6, 20]] as number[][]) leafy(g, pick(r, [0x15803d, 0x166534, 0x1c7f3f]), x, y, z, rr * 1.15, rr * 0.8, rr, r);
  for (let i = 0; i < 3; i++) put(g, G.cyl(), mat(0x22c55e, { r: 0.8 }), -20 + i * 18, 62, 24, { s: [1.1, 34, 1.1] });
  return g;
};
export const bigLeaf: Prop = (r) => {
  const g = grp();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + r() * 0.3, len = 30 + r() * 20, geo = frondGeo(len * 1.4); put(g, geo, mat(k % 2 ? 0x16a34a : 0x22c55e, { r: 0.55, side: THREE.DoubleSide }), 0, 5, 0, { s: 0.6, r: [0, -a, 0] }); }
  return g;
};
export const ziggurat: Prop = (r) => {
  const g = grp(); void r;
  for (let k = 0; k < 5; k++) { const w = 100 - k * 19, h = 22; put(g, G.box(), mat(k % 2 ? 0xa8a29e : 0x8d8780, { r: 0.95 }), 0, k * h + h / 2, 0, { s: [w, h, w] }); put(g, G.box(), mat(0xd6d3d1, { r: 0.95 }), 0, k * h + h - 1.5, 0, { s: [w + 2, 3, w + 2] }); }
  put(g, G.box(), mat(0x78716c, { r: 0.95 }), 0, 5 * 22 + 11, 0, { s: [26, 22, 26] }); put(g, G.box(), mat(0x0c0a09, { r: 0.95 }), 0, 5 * 22 + 8, 13.3, { s: [10, 14, 1] });
  put(g, G.cone8(), mat(0x78716c, { r: 0.95 }), 0, 5 * 22 + 30, 0, { s: [18, 18, 18] }); put(g, G.sphereLow(), mat(0xfbbf24, { e: 1.6, ec: 0xfbbf24, vc: false }), 0, 5 * 22 + 44, 0, { s: 4 });
  put(g, G.box(), mat(0x8d8780, { r: 0.95 }), 0, 5, 56, { s: [18, 10, 30], r: [0.0, 0, 0] });
  return g;
};
export const idol: Prop = () => {
  const g = grp(), m = mat(0x8d8780, { r: 0.95 });
  put(g, G.box(), m, 0, 32, 0, { s: [30, 64, 24] }); put(g, G.box(), mat(0x6e6a66, { r: 0.95 }), 0, 66, 0, { s: [34, 6, 28] });
  for (const x of [-7, 7]) put(g, G.box(), mat(0x0c0a09, { r: 0.9 }), x, 46, 12.2, { s: [8, 6, 1] });
  put(g, G.box(), mat(0x0c0a09, { r: 0.9 }), 0, 30, 12.2, { s: [14, 4, 1] });
  put(g, G.sphereLow(), mat(0x22c55e, { r: 0.8 }), -10, 66, 4, { s: [9, 4, 7], cast: false });
  return g;
};

// ───────────── desert / volcano ─────────────
const stratTex = (cols: number[]) => paint(8, 256, (c, w, h) => { let y = 0; for (let i = 0; y < h; i++) { const hh = 10 + Math.random() * 22; c.fillStyle = css(cols[i % cols.length]); c.fillRect(0, y, w, hh + 1); y += hh; } }, { repeat: true });
const stratCache = new Map<string, THREE.CanvasTexture>();
export const mesa = (c: number): Prop => (r) => {
  const g = grp(), h = 70 + r() * 70, w = 60 + r() * 50;
  const key = String(c); let t = stratCache.get(key); if (!t) { t = stratTex([c, tone(c, 0.18), tone(c, -0.18), tone(c, 0.08)]); stratCache.set(key, t); }
  const tt = t.clone(); tt.repeat.set(1, h / 120); tt.needsUpdate = true;
  put(g, G.cyl6(), mat(0xffffff, { r: 0.95, map: tt, flat: true }), 0, h / 2, 0, { s: [w, h, w * 0.8], r: [0, r() * 3, 0] }).scale.set(w, h, w * 0.8);
  put(g, G.cyl6(), mat(c, { r: 0.95, flat: true }), 0, h * 0.5, 0, { s: [w * 1.12, h * 0.26, w * 0.9], r: [0, r() * 3, 0], cast: false }).visible = false;
  put(g, G.cyl6(), mat(tone(c, 0.3), { r: 0.95, flat: true }), 0, h + 1, 0, { s: [w * 0.98, 3, w * 0.78], cast: false });
  return g;
};
export const dune = (c: number): Prop => (r) => {
  const g = grp(), w = 60 + r() * 40;
  put(g, lumpy(Math.floor(r() * 6), 3, 0.06), mat(c, { r: 1 }), 0, 0, 0, { s: [w, 14 + r() * 10, w * 0.5], r: [0, r() * 0.3, 0], cast: false });
  return g;
};
export const volcano: Prop = (r) => {
  const g = grp(); void r;
  const cone = put(g, G.cone(), mat(0x8a766a, { r: 0.95, flat: true }), 0, 70, 0, { s: [120, 140, 120] });
  cone.geometry = G.cone();
  put(g, G.cyl(), mat(0x4a3d36, { r: 0.95 }), 0, 140, 0, { s: [30, 6, 30] });
  put(g, G.disc(), mat(0xff7a18, { e: 2.4, ec: 0xff6a00, vc: false }), 0, 143.5, 0, { s: [26, 1, 26], cast: false });
  for (const [x, z, w] of [[-14, 30, 7], [12, 36, 5], [0, 46, 4.5]] as number[][]) put(g, G.cyl(), mat(0xff6a00, { e: 1.8, ec: 0xff5a00, vc: false }), x, 60 + z * 0.2, z, { s: [w, 90, w], r: [0.5, 0, 0], cast: false });
  for (let i = 0; i < 6; i++) put(g, lumpy(i, 2, 0.1), mat(0x9a8a82, { r: 1, opacity: 0.5 - i * 0.05 }), (r() - 0.5) * 14 + i * 5, 158 + i * 20, (r() - 0.5) * 10, { s: 14 + i * 4, cast: false });
  return g;
};
export const lavaPool: Prop = (r) => {
  const g = grp(), w = 40 + r() * 24;
  put(g, G.disc(), mat(0x2a2522, { r: 0.95, vc: false }), 0, 0.6, 0, { s: [w + 6, 1, (w + 6) * 0.6], cast: false });
  put(g, G.disc(), mat(0xff6a00, { e: 1.7, ec: 0xff5200, vc: false }), 0, 1.4, 0, { s: [w, 1, w * 0.6], cast: false });
  put(g, G.disc(), mat(0xffc533, { e: 2.2, ec: 0xffb400, vc: false }), -w * 0.1, 1.8, 0, { s: [w * 0.5, 1, w * 0.26], cast: false });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: 0xff7a18, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(w * 2.4, w * 1.6, 1); glow.position.y = 10; g.add(glow);
  return g;
};
export const charTree: Prop = (r) => {
  const g = grp(), m = mat(0x1c1917, { r: 0.95 });
  put(g, G.cyl(), m, 0, 28, 0, { s: [4.5, 56, 4.5], r: [0, 0, (r() - 0.5) * 0.1] });
  for (const s of [-1, 1]) put(g, G.cyl(), m, s * 11, 44 + s * 4, 0, { s: [2.6, 30, 2.6], r: [0, 0, -s * 0.8] });
  put(g, G.sphereLow(), mat(0xff5a00, { e: 1.6, ec: 0xff5a00, vc: false }), 15, 62, 0, { s: 2.2, cast: false });
  return g;
};

// ───────────── toy factory ─────────────
export const gear = (c: number): Prop => (r) => {
  const g = grp(), R = 22 + r() * 14, n = 10 + Math.floor(r() * 3);
  const sh = new THREE.Shape();
  for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = a0 + TAU / n * 0.5, o = 1.28, d = TAU / n * 0.07; sh.lineTo(Math.cos(a0 - d) * R, Math.sin(a0 - d) * R); sh.lineTo(Math.cos(a0 + d) * R * o, Math.sin(a0 + d) * R * o); sh.lineTo(Math.cos(a1 - d) * R * o, Math.sin(a1 - d) * R * o); sh.lineTo(Math.cos(a1 + d) * R, Math.sin(a1 + d) * R); }
  sh.closePath(); const hole = new THREE.Path(); hole.absarc(0, 0, R * 0.32, 0, TAU, true); sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 9, bevelEnabled: true, bevelSize: 1.6, bevelThickness: 1.6, bevelSegments: 2, curveSegments: 18 });
  shaded(geo, 0.8, 1, 1);
  const me = new THREE.Mesh(geo, mat(c, { r: 0.28, m: 0.25, env: 1.4 })); me.rotation.x = -Math.PI / 2 + 0.55; me.position.y = R * 0.9; me.castShadow = me.receiveShadow = true; g.add(me); g.userData.own = [geo];
  return g;
};
export const toyBlock: Prop = (r) => {
  const g = grp(), c = pick(r, [0xef4444, 0x2563eb, 0xfacc15, 0x22c55e, 0xf97316]), w = 2 + Math.floor(r() * 2), d = 2, m = mat(c, { r: 0.25, env: 1.2 });
  put(g, G.box(), m, 0, 11, 0, { s: [w * 17, 22, d * 17] });
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) put(g, G.cyl(), m, (i - (w - 1) / 2) * 17, 25, (j - (d - 1) / 2) * 17, { s: [5.2, 6, 5.2] });
  g.rotation.y = r() * 1.2 - 0.6;
  return g;
};
export const smokestack: Prop = () => {
  const g = grp();
  put(g, G.cyl(), mat(0xb91c1c, { r: 0.55 }), 0, 46, 0, { s: [14, 92, 14] });
  for (const y of [22, 46, 70]) put(g, G.cyl(), mat(0xffffff, { r: 0.55 }), 0, y, 0, { s: [14.6, 7, 14.6] });
  put(g, G.cyl(), mat(0x1f2937, { r: 0.7 }), 0, 93, 0, { s: [15, 3, 15] });
  for (let i = 0; i < 4; i++) put(g, lumpy(i, 2, 0.2), mat(0xe5e7eb, { r: 1, opacity: 0.85 - i * 0.15 }), 6 + i * 10, 110 + i * 24, i * 3, { s: 14 + i * 7, cast: false });
  return g;
};
export const balloon: Prop = (r) => {
  const g = grp(), c = pick(r, [0xef4444, 0xfacc15, 0x38bdf8, 0xa855f7, 0x22c55e]);
  put(g, G.sphere(), mat(c, { r: 0.18, env: 1.5 }), 0, 60, 0, { s: [17, 21, 17] });
  put(g, G.cone(), mat(c, { r: 0.18 }), 0, 36, 0, { s: [5, 7, 5], r: [Math.PI, 0, 0] });
  put(g, G.box(), mat(0x8b5a2b, { r: 0.8 }), 0, 16, 0, { s: [9, 7, 9] });
  for (const x of [-3, 3]) put(g, G.cyl(), mat(0x6b4a2a, { r: 0.8 }), x, 27, 0, { s: [0.4, 22, 0.4], cast: false });
  return g;
};

// ───────────── sky & space ─────────────
export const cloud = (c = 0xffffff): Prop => (r) => {
  const g = grp(), m = mat(c, { r: 1, e: 0.08, ec: 0xdbe3ff });
  for (const [x, y, z, s] of [[-26, 14, 0, 20], [0, 26, 2, 28], [28, 16, 0, 22], [8, 12, 12, 20], [-10, 10, -10, 18]] as number[][]) put(g, lumpy(Math.floor(r() * 6), 3, 0.1), m, x, y, z, { s: [s, s * 0.85, s], cast: true });
  put(g, G.disc(), mat(0xdbe3ff, { r: 1, vc: false, opacity: 0.0 }), 0, 0, 0, { s: 0.01 }).visible = false;
  return g;
};
export const castle: Prop = () => {
  const g = grp();
  const tw = (x: number, z: number, h: number, w: number, roof: number) => { put(g, G.cyl(), mat(0xfff3d6, { r: 0.7 }), x, h / 2, z, { s: [w, h, w] }); put(g, G.cone(), mat(roof, { r: 0.35, env: 1.2 }), x, h + w * 0.9, z, { s: [w * 1.25, w * 1.9, w * 1.25] }); put(g, G.sphereLow(), mat(0xfbbf24, { m: 0.8, r: 0.25 }), x, h + w * 1.9 + 3, z, { s: 2.2 }); put(g, G.box(), mat(0x3b2f7e, { r: 0.6 }), x, h * 0.62, z + w * 0.92, { s: [w * 0.28, w * 0.5, 1] }); };
  put(g, G.box(), mat(0xfffaf0, { r: 0.7 }), 0, 28, 0, { s: [78, 56, 40] });
  for (let i = -3; i <= 3; i++) put(g, G.box(), mat(0xfffaf0, { r: 0.7 }), i * 11, 60, 18, { s: [6, 9, 5] });
  tw(-48, 6, 70, 22, 0x7c5cf0); tw(48, 6, 70, 22, 0x7c5cf0); tw(0, -6, 104, 30, 0xf472b6); tw(-26, 14, 50, 14, 0x38bdf8); tw(26, 14, 50, 14, 0x38bdf8);
  put(g, G.box(), mat(0x6d28d9, { r: 0.6 }), 0, 12, 20.5, { s: [18, 24, 1.5] });
  const flag = put(g, G.box(), mat(0xef4444, { r: 0.6 }), 8, 160, -6, { s: [16, 9, 0.8], cast: false }); void flag;
  put(g, G.cyl(), mat(0xcbd5e1, { m: 0.5, r: 0.4 }), 0, 148, -6, { s: [0.9, 26, 0.9] });
  return g;
};
export const rainbow: Prop = () => {
  const g = grp();
  ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#8b5cf6'].forEach((c, k) => { const t = new THREE.TorusGeometry(110 - k * 9, 4.6, 10, 60, Math.PI); shaded(t, 0.9, 1, 1); const me = new THREE.Mesh(t, mat(c, { r: 0.4, e: 0.25, ec: c })); me.castShadow = false; g.add(me); g.userData.own = [...(g.userData.own ?? []), t]; });
  return g;
};
export const starProp: Prop = (r) => {
  const g = grp(), c = pick(r, [0xfde68a, 0xa5f3fc, 0xfbcfe8]);
  put(g, G.oct(), mat(c, { e: 1.4, ec: c, vc: false }), 0, 24, 0, { s: [8, 12, 8], r: [0, r() * 3, 0.0] });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(40, 40, 1); glow.position.y = 24; g.add(glow);
  return g;
};
export const planet = (a: number, b: number, ring: boolean): Prop => (r) => {
  const g = grp(), R = 16 + r() * 16;
  const t = paint(256, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, css(tone(a, 0.2))); gr.addColorStop(0.5, css(a)); gr.addColorStop(1, css(tone(a, -0.3))); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { c.fillStyle = css(tone(b, (r() - 0.5) * 0.5)); c.globalAlpha = 0.25 + r() * 0.3; c.fillRect(0, r() * h, w, 3 + r() * 10); } });
  put(g, G.sphere(), mat(0xffffff, { r: 0.7, map: t, vc: false }), 0, R + 24, 0, { s: R });
  if (ring) put(g, G.torus(), mat(tone(b, 0.2), { r: 0.6, opacity: 0.85 }), 0, R + 24, 0, { s: [R * 1.7, R * 1.7, 0.7], r: [Math.PI / 2 - 0.35, 0, -0.3] });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(R * 4, R * 4, 1); glow.position.y = R + 24; g.add(glow);
  return g;
};
export const station: Prop = () => {
  const g = grp(), hull = mat(0xdbe4ee, { r: 0.35, m: 0.5, env: 1.3 });
  put(g, G.capsule(), hull, 0, 40, 0, { s: [15, 12, 15], r: [0, 0, Math.PI / 2] }); put(g, G.sphere(), mat(0x22d3ee, { e: 1.2, ec: 0x22d3ee, vc: false }), 0, 40, 14, { s: 6, cast: false });
  for (const s of [-1, 1]) { put(g, G.cyl(), hull, s * 30, 40, 0, { s: [1.5, 20, 1.5], r: [0, 0, Math.PI / 2] }); for (let k = 0; k < 2; k++) put(g, G.box(), mat(0x1d4ed8, { r: 0.25, m: 0.6, env: 1.5 }), s * (50 + k * 24), 40, 0, { s: [22, 1.4, 34], r: [0.2, 0, 0] }); }
  put(g, G.cyl(), hull, 0, 14, 0, { s: [3, 28, 3] });
  return g;
};
export const asteroid: Prop = (r) => {
  const g = grp(), s = 9 + r() * 12;
  put(g, lumpy(Math.floor(r() * 6) + 20, 2, 0.35), mat(0x6b7686, { r: 0.95 }), 0, s + 18 + r() * 20, 0, { s: [s, s * 0.8, s], r: [r(), r() * 3, r()] });
  return g;
};
export const crystal = (c: number): Prop => (r) => {
  const g = grp();
  for (let k = 0; k < 4; k++) { const h = 26 + r() * 40, w = 6 + r() * 4; put(g, G.oct(), mat(c, { r: 0.12, m: 0.2, e: 0.9, ec: c, env: 1.8, vc: false }), (k - 1.5) * 11, h * 0.5, (r() - 0.5) * 10, { s: [w, h * 0.52, w], r: [(r() - 0.5) * 0.3, r() * 3, (r() - 0.5) * 0.3] }); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: c, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(90, 90, 1); glow.position.y = 24; g.add(glow);
  return g;
};
export const neonSign = (c: number): Prop => (r) => {
  const g = grp(), w = 46 + r() * 28;
  put(g, G.cyl(), mat(0x475569, { m: 0.6, r: 0.4 }), 0, 24, 0, { s: [2, 48, 2] });
  put(g, G.box(), mat(0x1e1b4b, { r: 0.4 }), 0, 62, 0, { s: [w, 28, 4] });
  put(g, G.box(), mat(c, { e: 2.2, ec: c, vc: false }), 0, 70, 2.4, { s: [w - 12, 3, 1.2], cast: false }); put(g, G.box(), mat(0x67e8f9, { e: 2, ec: 0x67e8f9, vc: false }), -6, 60, 2.4, { s: [(w - 12) * 0.6, 3, 1.2], cast: false }); put(g, G.box(), mat(c, { e: 2.2, ec: c, vc: false }), 0, 52, 2.4, { s: [w - 18, 3, 1.2], cast: false });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: c, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(w * 2.4, 90, 1); glow.position.set(0, 62, 6); g.add(glow);
  return g;
};
