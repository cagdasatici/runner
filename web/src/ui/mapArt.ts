// Journey-map scenery: one richly illustrated 820 × h SVG landscape per world (sky, sun/moon, distant ranges,
// textured ground, hundreds of seeded props, ambient sparkle) plus the winding road the level buttons sit on.
// Everything is generated once and never changes, so it is drawn as static vector art (no images, no animation cost).

type Rng = () => number;
type Prop = (x: number, y: number, s: number, r: Rng, id: string) => string;
type Pt = [number, number];

const f = (v: number) => Math.round(v * 10) / 10;
const pick = <T,>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)];

/** Mixes two #rrggbb colours (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}
const lit = (c: string, t = 0.3) => mix(c, '#ffffff', t);
const dim = (c: string, t = 0.3) => mix(c, '#000000', t);

const shadow = (x: number, y: number, rx: number, o = 0.28) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx * 0.32)}" fill="#000" opacity="${o}"/>`;
const blob = (x: number, y: number, rx: number, ry: number, c: string, o = 1) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}" opacity="${o}"/>`;
const circ = (x: number, y: number, rr: number, c: string, o = 1) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="${c}" opacity="${o}"/>`;
const rect = (x: number, y: number, w: number, h: number, c: string, rx = 0, o = 1) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${c}" opacity="${o}"/>`;
const poly = (pts: Pt[], c: string, o = 1) => `<polygon points="${pts.map(([a, b]) => `${f(a)},${f(b)}`).join(' ')}" fill="${c}" opacity="${o}"/>`;

// ───────────────────────────── props ─────────────────────────────
const oak = (hue: string): Prop => (x, y, s) =>
  shadow(x, y, 30 * s) + rect(x - 4 * s, y - 34 * s, 8 * s, 36 * s, '#7c4a1d', 2) + rect(x - 1 * s, y - 34 * s, 3 * s, 36 * s, '#a16207', 1) +
  circ(x, y - 58 * s, 30 * s, dim(hue, 0.25)) + circ(x - 20 * s, y - 46 * s, 22 * s, dim(hue, 0.18)) + circ(x + 20 * s, y - 46 * s, 22 * s, dim(hue, 0.18)) +
  circ(x - 4 * s, y - 64 * s, 26 * s, hue) + circ(x + 14 * s, y - 52 * s, 18 * s, hue) + circ(x - 14 * s, y - 72 * s, 12 * s, lit(hue, 0.28), 0.8) + circ(x - 6 * s, y - 70 * s, 5 * s, lit(hue, 0.5), 0.7);

const pine = (hue: string, snow = false): Prop => (x, y, s) => {
  let o = shadow(x, y, 24 * s) + rect(x - 3 * s, y - 14 * s, 6 * s, 16 * s, '#5b3a1a');
  for (let k = 0; k < 4; k++) {
    const w = (30 - k * 6) * s, top = y - (22 + k * 18) * s - 22 * s, base = y - (14 + k * 18) * s;
    o += poly([[x, top], [x + w, base], [x - w, base]], k % 2 ? hue : dim(hue, 0.12)) + poly([[x, top], [x + w * 0.1, base], [x - w, base]], lit(hue, 0.18), 0.5);
    if (snow) o += poly([[x, top], [x + w * 0.55, top + (base - top) * 0.55], [x + w * 0.2, top + (base - top) * 0.45], [x - w * 0.2, top + (base - top) * 0.62], [x - w * 0.55, top + (base - top) * 0.55]], '#fff', 0.95);
  }
  return o;
};

const palm: Prop = (x, y, s) => {
  let o = shadow(x + 10 * s, y, 34 * s) + `<path d="M${f(x)} ${f(y)}q${f(10 * s)} ${f(-40 * s)} ${f(4 * s)} ${f(-82 * s)}" stroke="#a16207" stroke-width="${f(8 * s)}" fill="none" stroke-linecap="round"/><path d="M${f(x)} ${f(y)}q${f(10 * s)} ${f(-40 * s)} ${f(4 * s)} ${f(-82 * s)}" stroke="#d6a04a" stroke-width="${f(3 * s)}" fill="none" stroke-linecap="round" stroke-dasharray="${f(4 * s)} ${f(6 * s)}"/>`;
  const tx = x + 4 * s, ty = y - 82 * s;
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI + (k / 6) * Math.PI, dx = Math.cos(a) * 44 * s, dy = Math.sin(a) * 26 * s;
    o += `<path d="M${f(tx)} ${f(ty)}q${f(dx * 0.5)} ${f(dy - 14 * s)} ${f(dx)} ${f(dy + 14 * s)}q${f(-dx * 0.45)} ${f(-6 * s)} ${f(-dx)} ${f(-14 * s)}z" fill="${k % 2 ? '#16a34a' : '#22c55e'}"/>`;
  }
  return o + circ(tx - 3 * s, ty + 4 * s, 4.5 * s, '#78350f') + circ(tx + 4 * s, ty + 5 * s, 4.5 * s, '#92400e');
};

const cloud = (c = '#ffffff', sh = '#dbeafe'): Prop => (x, y, s) =>
  blob(x, y + 12 * s, 56 * s, 14 * s, sh, 0.7) + circ(x - 28 * s, y, 20 * s, c) + circ(x, y - 12 * s, 28 * s, c) + circ(x + 30 * s, y - 2 * s, 22 * s, c) + rect(x - 48 * s, y - 2 * s, 96 * s, 22 * s, c, 11) +
  circ(x - 6 * s, y - 20 * s, 10 * s, '#fff', 0.9);

const rock = (c: string): Prop => (x, y, s) =>
  shadow(x, y + 2 * s, 24 * s) + poly([[x - 22 * s, y], [x - 16 * s, y - 20 * s], [x - 2 * s, y - 28 * s], [x + 16 * s, y - 20 * s], [x + 24 * s, y]], c) +
  poly([[x - 16 * s, y - 20 * s], [x - 2 * s, y - 28 * s], [x + 4 * s, y - 10 * s], [x - 8 * s, y - 6 * s]], lit(c, 0.28), 0.8) + poly([[x + 4 * s, y - 10 * s], [x + 16 * s, y - 20 * s], [x + 24 * s, y], [x + 8 * s, y]], dim(c, 0.28), 0.7);

const flowers = (cols: readonly string[]): Prop => (x, y, s, r) => {
  let o = '';
  for (let k = 0; k < 6; k++) { const a = x + (r() - 0.5) * 36 * s, b = y + (r() - 0.5) * 12 * s, c = pick(r, cols);
    o += rect(a - 0.8, b - 9 * s, 1.6, 9 * s, '#15803d') + circ(a, b - 10 * s, 4 * s, c) + circ(a, b - 10 * s, 1.6 * s, '#fde047'); }
  return o;
};
const tuft = (c: string): Prop => (x, y, s) => [-8, -3, 2, 8].map((d, k) => `<path d="M${f(x + d * s)} ${f(y)}q${f((k - 1.5) * 3 * s)} ${f(-12 * s)} ${f((k - 1.5) * 5 * s)} ${f(-(14 + k * 2) * s)}" stroke="${k % 2 ? c : lit(c, 0.25)}" stroke-width="${f(2.2 * s)}" fill="none" stroke-linecap="round"/>`).join('');

const house = (wall: string, roof: string): Prop => (x, y, s) =>
  shadow(x + 4 * s, y, 40 * s) + rect(x - 30 * s, y - 40 * s, 60 * s, 40 * s, wall, 2) + rect(x + 14 * s, y - 40 * s, 16 * s, 40 * s, dim(wall, 0.12), 0) +
  poly([[x - 38 * s, y - 38 * s], [x, y - 70 * s], [x + 38 * s, y - 38 * s]], roof) + poly([[x, y - 70 * s], [x + 38 * s, y - 38 * s], [x + 10 * s, y - 38 * s]], dim(roof, 0.18), 0.8) +
  rect(x - 22 * s, y - 28 * s, 12 * s, 14 * s, '#bae6fd', 2) + rect(x - 22 * s, y - 22 * s, 12 * s, 1.5, '#fff') + rect(x - 4 * s, y - 24 * s, 12 * s, 24 * s, '#7c2d12', 2) + circ(x + 5 * s, y - 12 * s, 1.4 * s, '#fde047') +
  rect(x + 16 * s, y - 62 * s, 8 * s, 18 * s, dim(roof, 0.3));

const tower = (wall: string, glow: string, lights = false): Prop => (x, y, s, r) => {
  const w = (34 + r() * 22) * s, h = (90 + r() * 90) * s;
  let o = shadow(x + w * 0.2, y, w * 0.9) + rect(x - w / 2, y - h, w, h, wall, 2) + rect(x + w * 0.15, y - h, w * 0.35, h, dim(wall, 0.22), 0) + rect(x - w / 2, y - h, w, 5 * s, lit(wall, 0.25), 2);
  const cols = Math.floor(w / (11 * s)), rows = Math.floor(h / (16 * s));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows - 1; j++) if (r() > 0.28)
    o += rect(x - w / 2 + 5 * s + i * 11 * s, y - h + 12 * s + j * 16 * s, 6 * s, 8 * s, lights ? pick(r, [glow, '#fde047', '#67e8f9', '#f0abfc']) : '#bae6fd', 1, lights ? 0.95 : 0.75);
  if (lights) o += rect(x - w / 2 - 2, y - h - 2, w + 4, 3, glow, 1, 0.9) + `<ellipse cx="${f(x)}" cy="${f(y - h * 0.5)}" rx="${f(w * 1.1)}" ry="${f(h * 0.7)}" fill="${glow}" opacity="0.08"/>`;
  return o + rect(x - 1, y - h - 14 * s, 2, 14 * s, '#64748b') + circ(x, y - h - 15 * s, 2.5, lights ? '#f43f5e' : '#94a3b8');
};

const cactus: Prop = (x, y, s) =>
  shadow(x, y, 20 * s) + rect(x - 7 * s, y - 56 * s, 14 * s, 58 * s, '#16a34a', 7 * s) + rect(x + 1 * s, y - 56 * s, 6 * s, 58 * s, '#15803d', 3) +
  `<path d="M${f(x - 7 * s)} ${f(y - 28 * s)}h${f(-10 * s)}v${f(-18 * s)}" stroke="#16a34a" stroke-width="${f(8 * s)}" fill="none" stroke-linecap="round"/><path d="M${f(x + 7 * s)} ${f(y - 20 * s)}h${f(10 * s)}v${f(-22 * s)}" stroke="#16a34a" stroke-width="${f(8 * s)}" fill="none" stroke-linecap="round"/>` +
  circ(x, y - 58 * s, 3 * s, '#f472b6');

const mesa = (c: string): Prop => (x, y, s) =>
  shadow(x, y, 70 * s) + poly([[x - 70 * s, y], [x - 54 * s, y - 70 * s], [x - 40 * s, y - 80 * s], [x + 40 * s, y - 80 * s], [x + 56 * s, y - 66 * s], [x + 72 * s, y]], c) +
  poly([[x + 10 * s, y - 80 * s], [x + 40 * s, y - 80 * s], [x + 56 * s, y - 66 * s], [x + 72 * s, y], [x + 30 * s, y]], dim(c, 0.25), 0.75) +
  [20, 36, 52].map((d, k) => rect(x - 66 * s + k * 3, y - d * s - 4, 132 * s - k * 6, 2.5, lit(c, 0.3), 1, 0.45)).join('') + poly([[x - 40 * s, y - 80 * s], [x + 40 * s, y - 80 * s], [x + 36 * s, y - 86 * s], [x - 36 * s, y - 86 * s]], lit(c, 0.3));

const lolly: Prop = (x, y, s, r) => {
  const c = pick(r, ['#f472b6', '#a855f7', '#22c55e', '#38bdf8', '#fb923c']);
  return shadow(x, y, 20 * s) + rect(x - 2.5 * s, y - 60 * s, 5 * s, 62 * s, '#fff') + circ(x, y - 72 * s, 26 * s, c) + circ(x, y - 72 * s, 18 * s, lit(c, 0.55)) + circ(x, y - 72 * s, 10 * s, c) + circ(x, y - 72 * s, 3.5 * s, '#fff') + circ(x - 10 * s, y - 84 * s, 5 * s, '#fff', 0.7);
};
const cupcake: Prop = (x, y, s, r) => {
  const c = pick(r, ['#f472b6', '#fde047', '#a5f3fc', '#fdba74']);
  let o = shadow(x, y, 26 * s) + poly([[x - 22 * s, y - 30 * s], [x + 22 * s, y - 30 * s], [x + 16 * s, y], [x - 16 * s, y]], '#d97706') + poly([[x - 4 * s, y - 30 * s], [x + 22 * s, y - 30 * s], [x + 16 * s, y], [x - 2 * s, y]], '#b45309', 0.6);
  for (let k = 0; k < 3; k++) o += blob(x, y - (36 + k * 14) * s, (28 - k * 7) * s, 10 * s, k % 2 ? lit(c, 0.25) : c);
  return o + circ(x, y - 82 * s, 6 * s, '#dc2626') + circ(x - 2 * s, y - 84 * s, 2 * s, '#fff', 0.8);
};
const candyCane: Prop = (x, y, s) =>
  shadow(x, y, 16 * s) + `<path d="M${f(x)} ${f(y)}v${f(-60 * s)}a${f(14 * s)} ${f(14 * s)} 0 0 1 ${f(28 * s)} 0" stroke="#fff" stroke-width="${f(10 * s)}" fill="none" stroke-linecap="round"/><path d="M${f(x)} ${f(y)}v${f(-60 * s)}a${f(14 * s)} ${f(14 * s)} 0 0 1 ${f(28 * s)} 0" stroke="#ef4444" stroke-width="${f(10 * s)}" fill="none" stroke-linecap="round" stroke-dasharray="${f(7 * s)} ${f(9 * s)}"/>`;
const gumdrop: Prop = (x, y, s, r) => {
  const c = pick(r, ['#ef4444', '#22c55e', '#facc15', '#a855f7', '#fb923c']);
  return shadow(x, y, 22 * s) + `<path d="M${f(x - 22 * s)} ${f(y)}q${f(2 * s)} ${f(-40 * s)} ${f(22 * s)} ${f(-40 * s)}q${f(20 * s)} 0 ${f(22 * s)} ${f(40 * s)}z" fill="${c}"/>` + circ(x - 8 * s, y - 28 * s, 5 * s, '#fff', 0.55) +
    Array.from({ length: 8 }, (_, k) => circ(x - 18 * s + k * 5 * s, y - 2 * s, 1.4 * s, '#fff', 0.6)).join('');
};
const iceCream: Prop = (x, y, s, r) => {
  const c = pick(r, ['#f9a8d4', '#fde68a', '#a7f3d0', '#c4b5fd']);
  return shadow(x, y, 18 * s) + poly([[x - 14 * s, y - 40 * s], [x + 14 * s, y - 40 * s], [x, y]], '#d97706') + poly([[x, y - 40 * s], [x + 14 * s, y - 40 * s], [x, y]], '#b45309', 0.7) +
    circ(x, y - 48 * s, 18 * s, c) + circ(x - 6 * s, y - 70 * s, 14 * s, lit(c, 0.2)) + circ(x, y - 82 * s, 5 * s, '#dc2626') + circ(x - 8 * s, y - 52 * s, 4 * s, '#fff', 0.6);
};

const snowman: Prop = (x, y, s) =>
  shadow(x, y, 26 * s) + circ(x, y - 14 * s, 22 * s, '#e2e8f0') + circ(x, y - 14 * s, 20 * s, '#fff') + circ(x, y - 44 * s, 16 * s, '#fff') + circ(x + 5 * s, y - 40 * s, 12 * s, '#e2e8f0', 0.5) + circ(x, y - 64 * s, 12 * s, '#fff') +
  circ(x - 4 * s, y - 66 * s, 1.5 * s, '#111') + circ(x + 4 * s, y - 66 * s, 1.5 * s, '#111') + poly([[x, y - 63 * s], [x + 12 * s, y - 61 * s], [x, y - 60 * s]], '#f97316') +
  rect(x - 10 * s, y - 80 * s, 20 * s, 10 * s, '#1e293b', 1) + rect(x - 14 * s, y - 72 * s, 28 * s, 3 * s, '#1e293b') + rect(x - 14 * s, y - 56 * s, 28 * s, 4 * s, '#dc2626', 2) + circ(x, y - 44 * s, 1.8 * s, '#111') + circ(x, y - 36 * s, 1.8 * s, '#111');
const igloo: Prop = (x, y, s) =>
  shadow(x, y, 44 * s) + `<path d="M${f(x - 40 * s)} ${f(y)}a${f(40 * s)} ${f(40 * s)} 0 0 1 ${f(80 * s)} 0z" fill="#f1f5f9"/><path d="M${f(x + 6 * s)} ${f(y)}a${f(34 * s)} ${f(34 * s)} 0 0 0 ${f(-6 * s)} ${f(-40 * s)}a${f(40 * s)} ${f(40 * s)} 0 0 1 ${f(40 * s)} ${f(40 * s)}z" fill="#cbd5e1" opacity=".7"/>` +
  [-24, -8, 10, 26].map((d, k) => rect(x + d * s, y - 22 * s - (k % 2) * 14 * s, 12 * s, 1.5, '#94a3b8', 1, 0.6)).join('') + `<path d="M${f(x - 10 * s)} ${f(y)}v${f(-12 * s)}a${f(10 * s)} ${f(10 * s)} 0 0 1 ${f(20 * s)} 0v${f(12 * s)}z" fill="#0f172a"/>`;
const iceSpike: Prop = (x, y, s, r) => {
  let o = shadow(x, y, 26 * s, 0.2);
  for (let k = 0; k < 4; k++) { const h = (36 + r() * 40) * s, a = x + (k - 1.5) * 12 * s; o += poly([[a - 7 * s, y], [a, y - h], [a + 7 * s, y]], '#7dd3fc', 0.9) + poly([[a, y - h], [a + 7 * s, y], [a + 1 * s, y]], '#0ea5e9', 0.6); }
  return o;
};

const jungleTree: Prop = (x, y, s) =>
  shadow(x, y, 34 * s) + rect(x - 7 * s, y - 70 * s, 14 * s, 72 * s, '#5b3a1a', 3) + rect(x - 7 * s, y - 70 * s, 5 * s, 72 * s, '#7c4a1d', 3) +
  [[-34, -78, 30], [32, -82, 28], [0, -104, 34], [-14, -66, 24], [18, -64, 22]].map(([a, b, rr], k) => blob(x + a * s, y + b * s, rr * s * 1.15, rr * s * 0.8, k % 2 ? '#15803d' : '#166534')).join('') +
  blob(x - 4 * s, y - 110 * s, 22 * s, 12 * s, '#4ade80', 0.8) + `<path d="M${f(x + 20 * s)} ${f(y - 60 * s)}q${f(8 * s)} ${f(20 * s)} 0 ${f(40 * s)}" stroke="#22c55e" stroke-width="${f(2.5 * s)}" fill="none"/>`;
const bigLeaf: Prop = (x, y, s, r) => {
  let o = '';
  for (let k = 0; k < 5; k++) { const a = -Math.PI * 0.95 + k * 0.5 + r() * 0.2, l = (32 + r() * 18) * s; const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
    o += `<path d="M${f(x)} ${f(y)}Q${f(x + Math.cos(a - 0.5) * l * 0.6)} ${f(y + Math.sin(a - 0.5) * l * 0.6)} ${f(ex)} ${f(ey)}Q${f(x + Math.cos(a + 0.5) * l * 0.6)} ${f(y + Math.sin(a + 0.5) * l * 0.6)} ${f(x)} ${f(y)}z" fill="${k % 2 ? '#16a34a' : '#22c55e'}"/><path d="M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}" stroke="#bbf7d0" stroke-width="1.2" opacity=".7"/>`; }
  return o;
};
const ziggurat: Prop = (x, y, s) => {
  let o = shadow(x, y, 70 * s, 0.3);
  for (let k = 0; k < 4; k++) { const w = (60 - k * 13) * s, h = 18 * s, yy = y - k * h; o += rect(x - w, yy - h, w * 2, h, k % 2 ? '#a8a29e' : '#78716c', 1) + rect(x + w * 0.2, yy - h, w * 0.8, h, '#57534e', 0, 0.55) + rect(x - w, yy - h, w * 2, 3, '#d6d3d1', 1, 0.7); }
  return o + rect(x - 9 * s, y - 4 * 18 * s - 18 * s, 18 * s, 18 * s, '#a8a29e', 2) + rect(x - 4 * s, y - 4 * 18 * s - 12 * s, 8 * s, 12 * s, '#1c1917', 3) + circ(x, y - 4 * 18 * s - 24 * s, 4 * s, '#fbbf24');
};
const idol: Prop = (x, y, s) =>
  shadow(x, y, 20 * s) + rect(x - 14 * s, y - 56 * s, 28 * s, 56 * s, '#78716c', 4) + rect(x + 4 * s, y - 56 * s, 10 * s, 56 * s, '#57534e', 3) + rect(x - 10 * s, y - 44 * s, 8 * s, 6 * s, '#1c1917', 2) + rect(x + 2 * s, y - 44 * s, 8 * s, 6 * s, '#1c1917', 2) + rect(x - 8 * s, y - 28 * s, 16 * s, 5 * s, '#1c1917', 2) + rect(x - 16 * s, y - 60 * s, 32 * s, 6 * s, '#a8a29e', 3) + `<path d="M${f(x - 14 * s)} ${f(y - 20 * s)}q${f(6 * s)} ${f(-8 * s)} ${f(10 * s)} 0" stroke="#22c55e" stroke-width="2.5" fill="none"/>`;

const neonSign = (c: string): Prop => (x, y, s, r) => {
  const w = (40 + r() * 30) * s;
  return rect(x - 2, y - 36 * s, 4, 36 * s, '#475569') + rect(x - w / 2, y - 60 * s, w, 24 * s, '#1e1b4b', 4) + rect(x - w / 2, y - 60 * s, w, 24 * s, 'none', 4).replace('fill="none"', `fill="none" stroke="${c}" stroke-width="2.5"`) +
    rect(x - w / 2 + 6 * s, y - 50 * s, w - 12 * s, 3, c, 2) + rect(x - w / 2 + 6 * s, y - 44 * s, (w - 12 * s) * 0.6, 3, '#67e8f9', 2) + blob(x, y - 48 * s, w * 0.8, 22 * s, c, 0.16);
};
const lamp = (c: string): Prop => (x, y, s) =>
  rect(x - 2 * s, y - 70 * s, 4 * s, 72 * s, '#334155') + `<path d="M${f(x)} ${f(y - 70 * s)}h${f(14 * s)}" stroke="#334155" stroke-width="${f(4 * s)}"/>` + circ(x + 14 * s, y - 68 * s, 6 * s, c) + circ(x + 14 * s, y - 68 * s, 22 * s, c, 0.16) + blob(x + 14 * s, y - 2, 28 * s, 8 * s, c, 0.16);

const gear = (c: string): Prop => (x, y, s, r) => {
  const R = (24 + r() * 14) * s;
  let o = '';
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; o += `<rect x="${f(x + Math.cos(a) * R - 5 * s)}" y="${f(y + Math.sin(a) * R - 5 * s)}" width="${f(10 * s)}" height="${f(10 * s)}" fill="${c}" transform="rotate(${f((a * 180) / Math.PI)} ${f(x + Math.cos(a) * R)} ${f(y + Math.sin(a) * R)})"/>`; }
  return shadow(x, y + R * 0.9, R) + o + circ(x, y, R, c) + circ(x, y, R * 0.7, lit(c, 0.18)) + circ(x, y, R * 0.28, dim(c, 0.45)) + circ(x - R * 0.3, y - R * 0.3, R * 0.14, '#fff', 0.5);
};
const toyBlock: Prop = (x, y, s, r) => {
  const c = pick(r, ['#ef4444', '#2563eb', '#facc15', '#22c55e']), k = 22 * s;
  return shadow(x + 6 * s, y, 32 * s) + poly([[x - k, y - k * 1.3], [x, y - k * 1.9], [x + k, y - k * 1.3], [x, y - k * 0.7]], lit(c, 0.4)) + poly([[x - k, y - k * 1.3], [x, y - k * 0.7], [x, y + k * 0.3], [x - k, y - k * 0.3]], c) + poly([[x + k, y - k * 1.3], [x, y - k * 0.7], [x, y + k * 0.3], [x + k, y - k * 0.3]], dim(c, 0.3)) +
    circ(x, y - k * 1.3, 3 * s, '#fff', 0.55);
};
const smokestack: Prop = (x, y, s) =>
  shadow(x, y, 30 * s) + rect(x - 14 * s, y - 90 * s, 28 * s, 90 * s, '#b91c1c', 2) + rect(x + 2 * s, y - 90 * s, 12 * s, 90 * s, '#7f1d1d', 0, 0.6) + [20, 44, 68].map((d) => rect(x - 14 * s, y - d * s, 28 * s, 5 * s, '#fef2f2', 0, 0.85)).join('') +
  circ(x + 4 * s, y - 106 * s, 14 * s, '#e2e8f0', 0.9) + circ(x + 18 * s, y - 126 * s, 18 * s, '#e2e8f0', 0.7) + circ(x + 8 * s, y - 154 * s, 22 * s, '#e2e8f0', 0.5);

const volcano: Prop = (x, y, s) =>
  shadow(x, y, 100 * s) + poly([[x - 100 * s, y], [x - 24 * s, y - 120 * s], [x + 24 * s, y - 120 * s], [x + 100 * s, y]], '#44403c') + poly([[x + 6 * s, y - 120 * s], [x + 24 * s, y - 120 * s], [x + 100 * s, y], [x + 30 * s, y]], '#292524', 0.8) +
  `<path d="M${f(x - 24 * s)} ${f(y - 120 * s)}q${f(24 * s)} ${f(12 * s)} ${f(48 * s)} 0q${f(-6 * s)} ${f(-8 * s)} ${f(-24 * s)} ${f(-8 * s)}q${f(-18 * s)} 0 ${f(-24 * s)} ${f(8 * s)}z" fill="#fb923c"/><path d="M${f(x - 6 * s)} ${f(y - 112 * s)}q${f(-18 * s)} ${f(40 * s)} ${f(-8 * s)} ${f(80 * s)}q${f(8 * s)} ${f(14 * s)} ${f(2 * s)} ${f(32 * s)}" stroke="#f97316" stroke-width="${f(6 * s)}" fill="none" stroke-linecap="round"/><path d="M${f(x + 10 * s)} ${f(y - 112 * s)}q${f(14 * s)} ${f(30 * s)} ${f(26 * s)} ${f(54 * s)}" stroke="#fbbf24" stroke-width="${f(4 * s)}" fill="none" stroke-linecap="round"/>` +
  circ(x - 10 * s, y - 140 * s, 16 * s, '#57534e', 0.7) + circ(x + 10 * s, y - 166 * s, 22 * s, '#57534e', 0.5) + circ(x + 26 * s, y - 196 * s, 26 * s, '#57534e', 0.32);
const lavaPool: Prop = (x, y, s) => blob(x, y, 46 * s, 14 * s, '#7c2d12') + blob(x, y, 40 * s, 11 * s, '#ea580c') + blob(x - 4 * s, y - 1, 28 * s, 7 * s, '#fbbf24') + circ(x + 8 * s, y - 3 * s, 3 * s, '#fef08a');
const charTree: Prop = (x, y, s) => shadow(x, y, 20 * s) + `<path d="M${f(x)} ${f(y)}v${f(-50 * s)}m0 ${f(26 * s)}l${f(-16 * s)} ${f(-22 * s)}m16 ${f(10 * s)}l${f(14 * s)} ${f(-24 * s)}" stroke="#1c1917" stroke-width="${f(5 * s)}" fill="none" stroke-linecap="round"/>` + circ(x - 16 * s, y - 50 * s, 2.5 * s, '#f97316') + circ(x + 14 * s, y - 56 * s, 2.5 * s, '#fb923c');

const castle: Prop = (x, y, s) => {
  let o = blob(x, y + 8 * s, 90 * s, 22 * s, '#fff') + blob(x - 60 * s, y + 2 * s, 40 * s, 20 * s, '#fff') + blob(x + 60 * s, y + 2 * s, 40 * s, 20 * s, '#fff') + blob(x, y + 14 * s, 80 * s, 12 * s, '#c7d2fe', 0.7);
  const tw = (cx: number, h: number, w: number, c: string) => rect(cx - w / 2, y - h, w, h, c, 2) + poly([[cx - w / 2 - 4 * s, y - h], [cx, y - h - 30 * s], [cx + w / 2 + 4 * s, y - h]], '#a78bfa') + rect(cx - 3 * s, y - h + 14 * s, 6 * s, 12 * s, '#1e1b4b', 3) + `<path d="M${f(cx)} ${f(y - h - 30 * s)}v${f(-14 * s)}l${f(12 * s)} ${f(4 * s)}l${f(-12 * s)} ${f(4 * s)}" fill="#f43f5e" stroke="#334155" stroke-width="1.4"/>`;
  return o + tw(x - 38 * s, 60 * s, 26 * s, '#fef3c7') + tw(x + 38 * s, 60 * s, 26 * s, '#fef3c7') + rect(x - 28 * s, y - 50 * s, 56 * s, 50 * s, '#fffbeb', 2) + tw(x, 92 * s, 34 * s, '#fde68a') + `<path d="M${f(x - 10 * s)} ${f(y)}v${f(-18 * s)}a${f(10 * s)} ${f(10 * s)} 0 0 1 ${f(20 * s)} 0v${f(18 * s)}z" fill="#4c1d95"/>`;
};
const rainbow: Prop = (x, y, s) => ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#8b5cf6'].map((c, k) => `<path d="M${f(x - (90 - k * 8) * s)} ${f(y)}a${f((90 - k * 8) * s)} ${f((80 - k * 7) * s)} 0 0 1 ${f((180 - k * 16) * s)} 0" stroke="${c}" stroke-width="${f(8 * s)}" fill="none" opacity=".75"/>`).join('');
const star: Prop = (x, y, s, r) => {
  const c = pick(r, ['#fef9c3', '#a5f3fc', '#fbcfe8']);
  return circ(x, y, 7 * s, c, 0.15) + `<path d="M${f(x)} ${f(y - 6 * s)}l${f(1.5 * s)} ${f(4.5 * s)}l${f(4.5 * s)} ${f(1.5 * s)}l${f(-4.5 * s)} ${f(1.5 * s)}l${f(-1.5 * s)} ${f(4.5 * s)}l${f(-1.5 * s)} ${f(-4.5 * s)}l${f(-4.5 * s)} ${f(-1.5 * s)}l${f(4.5 * s)} ${f(-1.5 * s)}z" fill="${c}"/>`;
};
const planet = (a: string, b: string, ring: boolean): Prop => (x, y, s, r) => {
  const R = (22 + r() * 22) * s;
  return circ(x, y, R * 1.6, a, 0.1) + (ring ? `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(R * 1.8)}" ry="${f(R * 0.45)}" fill="none" stroke="${lit(b, 0.3)}" stroke-width="${f(R * 0.18)}" opacity=".6" transform="rotate(-18 ${f(x)} ${f(y)})"/>` : '') + circ(x, y, R, a) + circ(x + R * 0.28, y + R * 0.2, R * 0.78, b, 0.55) + circ(x - R * 0.34, y - R * 0.34, R * 0.3, '#fff', 0.35) +
    (ring ? `<path d="M${f(x - R * 1.8)} ${f(y + R * 0.1)}A${f(R * 1.8)} ${f(R * 0.45)} -18 0 0 ${f(x + R * 1.8)} ${f(y - R * 0.1)}" stroke="${lit(b, 0.3)}" stroke-width="${f(R * 0.18)}" fill="none" opacity=".85"/>` : '');
};
const station: Prop = (x, y, s) =>
  rect(x - 56 * s, y - 4 * s, 112 * s, 8 * s, '#94a3b8', 3) + rect(x - 22 * s, y - 18 * s, 44 * s, 36 * s, '#cbd5e1', 8 * s) + rect(x - 22 * s, y - 18 * s, 44 * s, 10 * s, '#e2e8f0', 6 * s) + circ(x, y, 9 * s, '#22d3ee') + circ(x - 3 * s, y - 3 * s, 3 * s, '#fff', 0.7) +
  rect(x - 78 * s, y - 16 * s, 20 * s, 32 * s, '#1d4ed8', 1) + rect(x + 58 * s, y - 16 * s, 20 * s, 32 * s, '#1d4ed8', 1) + [0, 1, 2].map((k) => rect(x - 78 * s, y - 16 * s + k * 10.6 * s, 20 * s, 1, '#93c5fd') + rect(x + 58 * s, y - 16 * s + k * 10.6 * s, 20 * s, 1, '#93c5fd')).join('') +
  circ(x + 28 * s, y - 22 * s, 3 * s, '#f43f5e') + rect(x - 1, y - 34 * s, 2, 16 * s, '#cbd5e1');
const asteroid: Prop = (x, y, s) => poly([[x - 16 * s, y - 4 * s], [x - 8 * s, y - 14 * s], [x + 8 * s, y - 12 * s], [x + 18 * s, y], [x + 6 * s, y + 12 * s], [x - 10 * s, y + 10 * s]], '#64748b') + circ(x - 3 * s, y - 2 * s, 3 * s, '#475569') + circ(x + 8 * s, y + 3 * s, 2 * s, '#475569') + poly([[x - 8 * s, y - 14 * s], [x + 8 * s, y - 12 * s], [x, y - 4 * s]], '#94a3b8', 0.7);

const shell: Prop = (x, y, s, r) => { const c = pick(r, ['#fda4af', '#fde68a', '#e9d5ff']); return `<path d="M${f(x - 10 * s)} ${f(y)}a${f(10 * s)} ${f(12 * s)} 0 0 1 ${f(20 * s)} 0z" fill="${c}"/>` + [-5, 0, 5].map((d) => `<path d="M${f(x + d * s)} ${f(y)}L${f(x + d * 1.6 * s)} ${f(y - 11 * s)}" stroke="${dim(c, 0.2)}" stroke-width="1"/>`).join(''); };
const umbrella: Prop = (x, y, s, r) => { const c = pick(r, ['#ef4444', '#3b82f6', '#f59e0b']); return shadow(x + 8 * s, y, 34 * s, 0.18) + rect(x - 1.2 * s, y - 52 * s, 2.4 * s, 54 * s, '#78350f') + `<path d="M${f(x - 38 * s)} ${f(y - 48 * s)}a${f(38 * s)} ${f(28 * s)} 0 0 1 ${f(76 * s)} 0z" fill="${c}"/>` + [-19, 0, 19].map((d) => `<path d="M${f(x + d * s)} ${f(y - 48 * s)}q${f(-6 * s)} ${f(-20 * s)} ${f(-d * 0.3 * s)} ${f(-27 * s)}" stroke="#fff" stroke-width="${f(5 * s)}" fill="none" opacity=".8"/>`).join(''); };
const sandcastle: Prop = (x, y, s) => shadow(x, y, 34 * s, 0.2) + rect(x - 26 * s, y - 20 * s, 52 * s, 20 * s, '#e8b86d', 2) + [-22, -8, 6, 20].map((d) => rect(x + d * s, y - 28 * s, 8 * s, 10 * s, '#e8b86d', 1)).join('') + rect(x - 8 * s, y - 38 * s, 16 * s, 28 * s, '#f0c987', 2) + poly([[x - 10 * s, y - 38 * s], [x, y - 54 * s], [x + 10 * s, y - 38 * s]], '#ef4444') + rect(x + 2 * s, y - 20 * s, 24 * s, 20 * s, '#c99a4f', 2, 0.5);
const wave: Prop = (x, y, s) => `<path d="M${f(x - 50 * s)} ${f(y)}q${f(12 * s)} ${f(-12 * s)} ${f(25 * s)} 0t${f(25 * s)} 0t${f(25 * s)} 0t${f(25 * s)} 0" stroke="#fff" stroke-width="${f(3 * s)}" fill="none" opacity=".75" stroke-linecap="round"/>`;
const boat: Prop = (x, y, s) => blob(x, y + 6 * s, 40 * s, 8 * s, '#fff', 0.35) + poly([[x - 30 * s, y - 6 * s], [x + 30 * s, y - 6 * s], [x + 20 * s, y + 8 * s], [x - 20 * s, y + 8 * s]], '#b91c1c') + rect(x - 1.5, y - 50 * s, 3, 44 * s, '#78350f') + poly([[x + 2, y - 48 * s], [x + 26 * s, y - 14 * s], [x + 2, y - 14 * s]], '#fff') + poly([[x - 2, y - 40 * s], [x - 18 * s, y - 14 * s], [x - 2, y - 14 * s]], '#fde68a');

const skyscraper = tower;
const hill = (c: string): Prop => (x, y, s) => `<path d="M${f(x - 90 * s)} ${f(y)}q${f(90 * s)} ${f(-110 * s)} ${f(180 * s)} 0z" fill="${c}"/><path d="M${f(x + 6 * s)} ${f(y)}q${f(40 * s)} ${f(-66 * s)} ${f(84 * s)} 0z" fill="${dim(c, 0.18)}" opacity=".5"/>`;
const bush = (c: string): Prop => (x, y, s) => shadow(x, y, 22 * s, 0.2) + circ(x - 10 * s, y - 8 * s, 11 * s, dim(c, 0.15)) + circ(x + 10 * s, y - 8 * s, 11 * s, dim(c, 0.15)) + circ(x, y - 14 * s, 14 * s, c) + circ(x - 4 * s, y - 18 * s, 5 * s, lit(c, 0.4), 0.8);
const bench: Prop = (x, y, s) => shadow(x, y + 2, 24 * s, 0.2) + rect(x - 20 * s, y - 14 * s, 40 * s, 5 * s, '#a16207', 1) + rect(x - 20 * s, y - 22 * s, 40 * s, 4 * s, '#ca8a04', 1) + rect(x - 18 * s, y - 9 * s, 3 * s, 10 * s, '#44403c') + rect(x + 15 * s, y - 9 * s, 3 * s, 10 * s, '#44403c');
const pond: Prop = (x, y, s) => blob(x, y, 58 * s, 22 * s, '#15803d', 0.5) + blob(x, y, 54 * s, 19 * s, '#38bdf8') + blob(x - 8 * s, y - 3 * s, 38 * s, 10 * s, '#7dd3fc') + blob(x - 18 * s, y - 6 * s, 14 * s, 3 * s, '#fff', 0.7) + circ(x + 24 * s, y + 3 * s, 6 * s, '#16a34a') + circ(x + 24 * s, y + 3 * s, 2 * s, '#f9a8d4');
const crystal = (c: string): Prop => (x, y, s, r) => { let o = shadow(x, y, 26 * s, 0.2); for (let k = 0; k < 3; k++) { const h = (30 + r() * 38) * s, a = x + (k - 1) * 12 * s; o += poly([[a - 6 * s, y], [a, y - h], [a + 6 * s, y]], c, 0.92) + poly([[a, y - h], [a + 6 * s, y], [a + 1 * s, y]], dim(c, 0.3), 0.7) + poly([[a - 6 * s, y], [a, y - h], [a - 1 * s, y - h * 0.4]], '#fff', 0.35); } return o; };
const dune = (c: string): Prop => (x, y, s) => `<path d="M${f(x - 110 * s)} ${f(y)}q${f(60 * s)} ${f(-54 * s)} ${f(140 * s)} ${f(-14 * s)}q${f(50 * s)} ${f(24 * s)} ${f(80 * s)} ${f(14 * s)}z" fill="${c}" opacity=".85"/><path d="M${f(x - 110 * s)} ${f(y)}q${f(60 * s)} ${f(-54 * s)} ${f(140 * s)} ${f(-14 * s)}" stroke="${lit(c, 0.5)}" stroke-width="2" fill="none" opacity=".7"/>`;
const bird: Prop = (x, y, s) => `<path d="M${f(x - 9 * s)} ${f(y)}q${f(4.5 * s)} ${f(-7 * s)} ${f(9 * s)} 0q${f(4.5 * s)} ${f(-7 * s)} ${f(9 * s)} 0" stroke="#334155" stroke-width="${f(1.8 * s)}" fill="none" stroke-linecap="round" opacity=".7"/>`;
const balloon: Prop = (x, y, s, r) => { const c = pick(r, ['#ef4444', '#facc15', '#38bdf8', '#a855f7']); return `<ellipse cx="${f(x)}" cy="${f(y - 32 * s)}" rx="${f(18 * s)}" ry="${f(22 * s)}" fill="${c}"/><path d="M${f(x - 18 * s)} ${f(y - 32 * s)}q${f(18 * s)} ${f(-6 * s)} ${f(36 * s)} 0" stroke="${lit(c, 0.5)}" stroke-width="2" fill="none"/><ellipse cx="${f(x - 6 * s)}" cy="${f(y - 42 * s)}" rx="${f(5 * s)}" ry="${f(8 * s)}" fill="#fff" opacity=".45"/><path d="M${f(x - 10 * s)} ${f(y - 14 * s)}L${f(x - 6 * s)} ${f(y)}M${f(x + 10 * s)} ${f(y - 14 * s)}L${f(x + 6 * s)} ${f(y)}" stroke="#78350f" stroke-width="1.2"/>` + rect(x - 7 * s, y, 14 * s, 9 * s, '#a16207', 1); };

// ───────────────────────────── world scenes ─────────────────────────────
interface Layer { fn: Prop; n: number; y: [number, number]; s: [number, number]; edge?: boolean }
interface Scene {
  sky: [string, string, string];   // top, mid, horizon
  ground: [string, string];        // far (top of the ground), near (bottom)
  horizon: number;                 // y where the ground starts
  accent: string;                  // texture speckle / path edge
  path: { edge: string; fill: string; mark: string; dash?: string; wide?: number };
  sun?: { x: number; y: number; r: number; c: string; moon?: boolean };
  far: { fn: Prop; n: number; s: [number, number]; y: number; jitter: number }[];
  props: Layer[];
  speck: string[];
  stars?: boolean;
  fog?: string;
}

const SCENES: Scene[] = [
  { // 0 Sunny City
    sky: ['#38bdf8', '#7dd3fc', '#e0f2fe'], ground: ['#86efac', '#4ade80'], horizon: 250, accent: '#bbf7d0',
    path: { edge: '#a16207', fill: '#fde68a', mark: '#fff7d6', dash: '2 14' }, sun: { x: 690, y: 90, r: 46, c: '#fde047' },
    far: [{ fn: skyscraper('#94a3b8', '#fde68a'), n: 9, s: [0.8, 1.2], y: 258, jitter: 6 }, { fn: hill('#86efac'), n: 4, s: [1, 1.5], y: 262, jitter: 4 }],
    props: [{ fn: house('#fef3c7', '#ef4444'), n: 7, y: [300, 980], s: [0.8, 1.2], edge: true }, { fn: house('#e0f2fe', '#2563eb'), n: 5, y: [320, 960], s: [0.8, 1.15], edge: true },
      { fn: oak('#22c55e'), n: 14, y: [290, 1000], s: [0.7, 1.15] }, { fn: bush('#16a34a'), n: 14, y: [280, 1030], s: [0.8, 1.3] }, { fn: flowers(['#f472b6', '#fde047', '#fff', '#60a5fa']), n: 20, y: [290, 1040], s: [0.8, 1.3] },
      { fn: lamp('#fde68a'), n: 6, y: [330, 980], s: [0.8, 1], edge: true }, { fn: bench, n: 4, y: [380, 960], s: [0.9, 1.1], edge: true }, { fn: pond, n: 2, y: [420, 900], s: [0.8, 1.1], edge: true }, { fn: tuft('#16a34a'), n: 30, y: [270, 1050], s: [0.8, 1.4] }],
    speck: ['#fff', '#bbf7d0'] },
  { // 1 Leafy Park
    sky: ['#7dd3fc', '#bbf7d0', '#ecfccb'], ground: ['#4ade80', '#16a34a'], horizon: 230, accent: '#86efac',
    path: { edge: '#78350f', fill: '#d6a56a', mark: '#f5deb3', dash: '1 12' }, sun: { x: 130, y: 80, r: 38, c: '#fef08a' },
    far: [{ fn: hill('#4ade80'), n: 5, s: [1.2, 1.8], y: 240, jitter: 6 }, { fn: pine('#15803d'), n: 14, s: [0.6, 0.9], y: 248, jitter: 8 }],
    props: [{ fn: oak('#22c55e'), n: 16, y: [270, 1020], s: [0.9, 1.4] }, { fn: oak('#65a30d'), n: 9, y: [270, 1020], s: [0.8, 1.2] }, { fn: pine('#166534'), n: 8, y: [270, 1020], s: [0.9, 1.3] }, { fn: pond, n: 3, y: [380, 900], s: [0.9, 1.4], edge: true },
      { fn: flowers(['#f472b6', '#fde047', '#c084fc', '#fb923c']), n: 30, y: [270, 1050], s: [0.9, 1.5] }, { fn: bush('#15803d'), n: 14, y: [270, 1040], s: [0.9, 1.4] }, { fn: bench, n: 4, y: [380, 960], s: [1, 1.2], edge: true }, { fn: rock('#a8a29e'), n: 6, y: [300, 1000], s: [0.7, 1.1] }, { fn: tuft('#15803d'), n: 40, y: [250, 1050], s: [0.9, 1.5] }],
    speck: ['#bbf7d0', '#fef08a'] },
  { // 2 Sandy Beach
    sky: ['#0ea5e9', '#7dd3fc', '#fef3c7'], ground: ['#fde68a', '#f5c97a'], horizon: 330, accent: '#fff7d6',
    path: { edge: '#b45309', fill: '#fff1c2', mark: '#fffbe8', dash: '1 10' }, sun: { x: 690, y: 80, r: 42, c: '#fde047' },
    far: [{ fn: boat, n: 3, s: [0.8, 1.1], y: 300, jitter: 14 }, { fn: wave, n: 18, s: [0.9, 1.5], y: 300, jitter: 28 }],
    props: [{ fn: palm, n: 13, y: [370, 1000], s: [0.9, 1.4] }, { fn: umbrella, n: 6, y: [420, 980], s: [0.9, 1.2], edge: true }, { fn: sandcastle, n: 4, y: [440, 980], s: [0.9, 1.2], edge: true }, { fn: shell, n: 26, y: [360, 1050], s: [0.8, 1.5] },
      { fn: rock('#d6b98a'), n: 6, y: [360, 1000], s: [0.6, 1] }, { fn: tuft('#65a30d'), n: 14, y: [360, 1050], s: [0.9, 1.3] }],
    speck: ['#fff', '#fcd34d'] },
  { // 3 Candy Land
    sky: ['#f9a8d4', '#fbcfe8', '#fff1f2'], ground: ['#fbcfe8', '#f9a8d4'], horizon: 240, accent: '#fff', fog: '#fce7f3',
    path: { edge: '#be185d', fill: '#fff', mark: '#f472b6', dash: '14 14', wide: 1.1 }, sun: { x: 120, y: 90, r: 40, c: '#fde68a' },
    far: [{ fn: hill('#f0abfc'), n: 5, s: [1.2, 1.8], y: 250, jitter: 6 }, { fn: lolly, n: 8, s: [0.7, 1], y: 252, jitter: 6 }],
    props: [{ fn: lolly, n: 10, y: [280, 1000], s: [0.9, 1.4] }, { fn: cupcake, n: 7, y: [290, 990], s: [0.9, 1.3] }, { fn: candyCane, n: 12, y: [280, 1000], s: [0.9, 1.4] }, { fn: gumdrop, n: 18, y: [270, 1040], s: [0.9, 1.5] }, { fn: iceCream, n: 6, y: [300, 980], s: [0.9, 1.3] }, { fn: cloud('#fff', '#fbcfe8'), n: 3, y: [60, 190], s: [1, 1.5] }],
    speck: ['#fff', '#fde047', '#a5f3fc'] },
  { // 4 Desert Canyon
    sky: ['#f97316', '#fdba74', '#fef3c7'], ground: ['#f0b27a', '#d4813f'], horizon: 260, accent: '#fcd9a8',
    path: { edge: '#7c2d12', fill: '#f8d9a8', mark: '#fff0d4', dash: '2 12' }, sun: { x: 120, y: 110, r: 54, c: '#fef08a' },
    far: [{ fn: mesa('#b45309'), n: 6, s: [1, 1.7], y: 270, jitter: 6 }, { fn: mesa('#c2410c'), n: 4, s: [0.7, 1.1], y: 262, jitter: 6 }],
    props: [{ fn: mesa('#c2410c'), n: 3, y: [320, 880], s: [0.7, 0.95], edge: true }, { fn: cactus, n: 18, y: [290, 1030], s: [0.8, 1.4] }, { fn: rock('#b45309'), n: 14, y: [290, 1030], s: [0.8, 1.5] }, { fn: dune('#e8a560'), n: 8, y: [300, 1040], s: [1, 1.5] },
      { fn: tuft('#a16207'), n: 26, y: [290, 1050], s: [0.9, 1.4] }, { fn: bird, n: 5, y: [80, 220], s: [1.2, 1.8] }],
    speck: ['#fde68a', '#fb923c'] },
  { // 5 Snowy Peaks
    sky: ['#60a5fa', '#bfdbfe', '#f0f9ff'], ground: ['#f8fafc', '#dbeafe'], horizon: 250, accent: '#fff',
    path: { edge: '#64748b', fill: '#e2e8f0', mark: '#fff', dash: '2 10' }, sun: { x: 690, y: 90, r: 36, c: '#fefce8' },
    far: [{ fn: (x, y, s) => poly([[x - 90 * s, y], [x, y - 150 * s], [x + 90 * s, y]], '#64748b') + poly([[x, y - 150 * s], [x + 90 * s, y], [x + 24 * s, y]], '#475569', 0.7) + poly([[x - 28 * s, y - 100 * s], [x, y - 150 * s], [x + 28 * s, y - 100 * s], [x + 12 * s, y - 92 * s], [x, y - 104 * s], [x - 14 * s, y - 90 * s]], '#fff'), n: 5, s: [1.1, 1.8], y: 262, jitter: 4 }, { fn: pine('#14532d', true), n: 12, s: [0.5, 0.8], y: 262, jitter: 8 }],
    props: [{ fn: pine('#166534', true), n: 18, y: [280, 1020], s: [0.9, 1.5] }, { fn: snowman, n: 5, y: [320, 980], s: [0.9, 1.2], edge: true }, { fn: igloo, n: 3, y: [360, 940], s: [0.9, 1.2], edge: true }, { fn: iceSpike, n: 10, y: [290, 1030], s: [0.8, 1.3] }, { fn: rock('#94a3b8'), n: 8, y: [290, 1030], s: [0.7, 1.1] }, { fn: crystal('#7dd3fc'), n: 8, y: [300, 1030], s: [0.8, 1.2] }],
    speck: ['#fff', '#bae6fd'] },
  { // 6 Jungle Ruins
    sky: ['#14532d', '#4ade80', '#d9f99d'], ground: ['#22c55e', '#166534'], horizon: 230, accent: '#4ade80', fog: '#bbf7d0',
    path: { edge: '#422006', fill: '#a8825a', mark: '#d9bf99', dash: '1 11' }, sun: { x: 680, y: 80, r: 30, c: '#fef9c3' },
    far: [{ fn: jungleTree, n: 14, s: [0.7, 1.1], y: 245, jitter: 8 }, { fn: hill('#166534'), n: 5, s: [1.2, 1.8], y: 250, jitter: 4 }],
    props: [{ fn: ziggurat, n: 3, y: [360, 900], s: [0.9, 1.25], edge: true }, { fn: jungleTree, n: 14, y: [280, 1030], s: [0.9, 1.5] }, { fn: idol, n: 6, y: [300, 1000], s: [0.9, 1.3], edge: true }, { fn: bigLeaf, n: 26, y: [280, 1050], s: [0.9, 1.5] },
      { fn: flowers(['#f43f5e', '#fb923c', '#fde047']), n: 14, y: [280, 1050], s: [0.9, 1.3] }, { fn: rock('#6b7280'), n: 8, y: [290, 1030], s: [0.7, 1.2] }, { fn: pond, n: 2, y: [420, 880], s: [0.8, 1.2], edge: true }],
    speck: ['#bbf7d0', '#fef08a'] },
  { // 7 Neon Night
    sky: ['#0b0630', '#312e81', '#6d28d9'], ground: ['#1e1b4b', '#0f0a30'], horizon: 280, accent: '#a78bfa', stars: true,
    path: { edge: '#f0abfc', fill: '#1e1b4b', mark: '#67e8f9', dash: '10 12' }, sun: { x: 690, y: 110, r: 52, c: '#f0abfc', moon: true },
    far: [{ fn: skyscraper('#1e1b4b', '#f0abfc', true), n: 12, s: [1, 1.6], y: 290, jitter: 4 }, { fn: skyscraper('#312e81', '#67e8f9', true), n: 10, s: [0.7, 1.1], y: 284, jitter: 4 }],
    props: [{ fn: skyscraper('#1e1b4b', '#f0abfc', true), n: 8, y: [340, 1000], s: [0.9, 1.3], edge: true }, { fn: neonSign('#f0abfc'), n: 7, y: [320, 1000], s: [0.9, 1.3], edge: true }, { fn: neonSign('#67e8f9'), n: 6, y: [320, 1000], s: [0.9, 1.3], edge: true },
      { fn: lamp('#67e8f9'), n: 10, y: [320, 1030], s: [0.9, 1.2] }, { fn: crystal('#a78bfa'), n: 8, y: [320, 1030], s: [0.8, 1.2] }, { fn: rock('#3730a3'), n: 6, y: [320, 1030], s: [0.7, 1.1] }],
    speck: ['#f0abfc', '#67e8f9', '#fde047'] },
  { // 8 Toy Factory
    sky: ['#fecaca', '#fef2f2', '#fff7ed'], ground: ['#cbd5e1', '#94a3b8'], horizon: 250, accent: '#fff',
    path: { edge: '#1e3a8a', fill: '#475569', mark: '#facc15', dash: '14 12' }, sun: { x: 130, y: 90, r: 34, c: '#fef9c3' },
    far: [{ fn: smokestack, n: 7, s: [0.7, 1.1], y: 262, jitter: 6 }, { fn: tower('#e2e8f0', '#fff'), n: 7, s: [0.8, 1.2], y: 262, jitter: 6 }],
    props: [{ fn: gear('#ef4444'), n: 8, y: [300, 1000], s: [0.9, 1.3] }, { fn: gear('#2563eb'), n: 8, y: [300, 1000], s: [0.8, 1.2] }, { fn: gear('#facc15'), n: 6, y: [300, 1000], s: [0.8, 1.1] }, { fn: toyBlock, n: 16, y: [300, 1040], s: [0.9, 1.4] },
      { fn: smokestack, n: 4, y: [360, 960], s: [0.9, 1.2], edge: true }, { fn: balloon, n: 6, y: [90, 230], s: [1, 1.5] }, { fn: rock('#64748b'), n: 5, y: [300, 1040], s: [0.6, 0.9] }],
    speck: ['#fff', '#fde047', '#fca5a5'] },
  { // 9 Volcano Valley
    sky: ['#450a0a', '#b91c1c', '#fb923c'], ground: ['#44403c', '#1c1917'], horizon: 270, accent: '#78350f', fog: '#7f1d1d',
    path: { edge: '#1c1917', fill: '#57534e', mark: '#fb923c', dash: '3 12' }, sun: { x: 130, y: 100, r: 50, c: '#fdba74' },
    far: [{ fn: volcano, n: 3, s: [1, 1.5], y: 280, jitter: 6 }, { fn: hill('#292524'), n: 6, s: [1, 1.6], y: 284, jitter: 4 }],
    props: [{ fn: volcano, n: 2, y: [340, 780], s: [0.7, 0.9], edge: true }, { fn: lavaPool, n: 12, y: [300, 1030], s: [0.8, 1.5] }, { fn: rock('#57534e'), n: 18, y: [300, 1030], s: [0.8, 1.6] }, { fn: charTree, n: 12, y: [300, 1030], s: [0.9, 1.4] }, { fn: crystal('#ef4444'), n: 7, y: [300, 1030], s: [0.8, 1.2] }],
    speck: ['#fb923c', '#fde047'] },
  { // 10 Cloud Kingdom
    sky: ['#818cf8', '#c7d2fe', '#fef3c7'], ground: ['#f8fafc', '#e0e7ff'], horizon: 240, accent: '#fff', fog: '#fff',
    path: { edge: '#f59e0b', fill: '#fef3c7', mark: '#fff', dash: '2 12' }, sun: { x: 690, y: 90, r: 50, c: '#fde68a' },
    far: [{ fn: cloud('#fff', '#c7d2fe'), n: 9, s: [1, 1.8], y: 258, jitter: 8 }, { fn: rainbow, n: 1, s: [1.5, 1.8], y: 262, jitter: 0 }],
    props: [{ fn: castle, n: 2, y: [360, 800], s: [1, 1.3], edge: true }, { fn: cloud('#fff', '#c7d2fe'), n: 18, y: [280, 1040], s: [0.9, 1.6] }, { fn: balloon, n: 7, y: [120, 1000], s: [0.9, 1.4] }, { fn: star, n: 18, y: [270, 1040], s: [1, 1.8] }, { fn: bird, n: 8, y: [90, 960], s: [1.2, 2] }, { fn: crystal('#c4b5fd'), n: 7, y: [300, 1030], s: [0.8, 1.2] }],
    speck: ['#fff', '#fde047'] },
  { // 11 Space Station
    sky: ['#020617', '#0f172a', '#1e1b4b'], ground: ['#0f172a', '#020617'], horizon: 120, accent: '#334155', stars: true,
    path: { edge: '#22d3ee', fill: '#1e293b', mark: '#22d3ee', dash: '8 12' }, sun: { x: 130, y: 70, r: 40, c: '#e2e8f0', moon: true },
    far: [{ fn: planet('#7c3aed', '#c4b5fd', true), n: 2, s: [1.4, 2.2], y: 130, jitter: 30 }],
    props: [{ fn: planet('#f472b6', '#fbcfe8', false), n: 4, y: [160, 1000], s: [0.8, 1.6], edge: true }, { fn: planet('#22d3ee', '#a5f3fc', true), n: 3, y: [160, 1000], s: [0.8, 1.4], edge: true }, { fn: planet('#fbbf24', '#fde68a', false), n: 3, y: [160, 1000], s: [0.8, 1.4], edge: true },
      { fn: station, n: 5, y: [200, 1000], s: [0.9, 1.3], edge: true }, { fn: asteroid, n: 22, y: [140, 1040], s: [0.8, 1.8] }, { fn: star, n: 70, y: [10, 1050], s: [0.6, 1.6] }, { fn: crystal('#22d3ee'), n: 7, y: [200, 1030], s: [0.7, 1.1] }],
    speck: ['#fff', '#67e8f9'] },
];

/** x (0…820) of the road centre at height y, interpolated between the level buttons. */
function roadX(pts: Pt[], y: number): number {
  const a = pts.slice().sort((p, q) => p[1] - q[1]);
  if (y <= a[0][1]) return a[0][0]; if (y >= a[a.length - 1][1]) return a[a.length - 1][0];
  for (let i = 0; i < a.length - 1; i++) if (y <= a[i + 1][1]) { const t = (y - a[i][1]) / (a[i + 1][1] - a[i][1]); return a[i][0] + (a[i + 1][0] - a[i][0]) * t; }
  return 410;
}

/** Smooth Catmull-Rom path through the points (so the road curves instead of zig-zagging). */
export function smoothPath(pts: Pt[]): string {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** The full scene for world w (0…11) in an 820 × h box, plus its road through `pts` (already in 820-wide px). */
export function worldScene(w: number, h: number, pts: Pt[]): string {
  const sc = SCENES[w], id = `w${w}`;
  let seed = 7 + w * 7919;
  const r: Rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) >>> 8) / 16777216;
  const hz = sc.horizon;
  const out: string[] = [];
  out.push(`<defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.sky[0]}"/><stop offset=".55" stop-color="${sc.sky[1]}"/><stop offset="1" stop-color="${sc.sky[2]}"/></linearGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.ground[0]}"/><stop offset="1" stop-color="${sc.ground[1]}"/></linearGradient>
    <radialGradient id="${id}sun"><stop offset="0" stop-color="${sc.sun?.c ?? '#fff'}" stop-opacity=".95"/><stop offset=".45" stop-color="${sc.sun?.c ?? '#fff'}" stop-opacity=".35"/><stop offset="1" stop-color="${sc.sun?.c ?? '#fff'}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}v" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>
    <linearGradient id="${id}hz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.fog ?? sc.sky[2]}" stop-opacity=".85"/><stop offset="1" stop-color="${sc.fog ?? sc.sky[2]}" stop-opacity="0"/></linearGradient>
    <pattern id="${id}p" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(${20 + w * 9})"><circle cx="5" cy="6" r="1.6" fill="${sc.accent}" opacity=".35"/><circle cx="17" cy="19" r="1.2" fill="${sc.accent}" opacity=".3"/><path d="M22 4l2 -3" stroke="${sc.accent}" stroke-width="1" opacity=".3"/></pattern>
  </defs>`);
  out.push(rect(0, 0, 820, h, `url(#${id}s)`));
  // sky: stars, sun/moon, high clouds
  if (sc.stars) for (let i = 0; i < 90; i++) out.push(circ(r() * 820, r() * (hz + 40), 0.6 + r() * 1.3, '#fff', 0.35 + r() * 0.65));
  if (sc.sun) {
    const { x, y, r: rr, c, moon } = sc.sun;
    out.push(circ(x, y, rr * 3.2, `url(#${id}sun)`));
    out.push(circ(x, y, rr, c));
    if (moon) out.push(circ(x - rr * 0.3, y - rr * 0.2, rr * 0.2, dim(c, 0.12), 0.7), circ(x + rr * 0.35, y + rr * 0.25, rr * 0.28, dim(c, 0.1), 0.6), circ(x + rr * 0.1, y - rr * 0.5, rr * 0.12, dim(c, 0.12), 0.7));
    else out.push(circ(x - rr * 0.25, y - rr * 0.25, rr * 0.7, '#fff', 0.35));
  }
  if (w !== 11 && w !== 7) for (let i = 0; i < 6; i++) out.push(`<g opacity=".6">${cloud('#ffffff', lit(sc.sky[1], 0.6))(r() * 820, 30 + r() * (hz - 90), 0.6 + r() * 0.8, r, id)}</g>`);
  // distant layers (back to front), each one hazier than the next
  sc.far.forEach((L, li) => {
    const row: string[] = [];
    for (let i = 0; i < L.n; i++) {
      const s = L.s[0] + r() * (L.s[1] - L.s[0]), x = ((i + 0.5) / L.n) * 880 - 30 + (r() - 0.5) * 40;
      row.push(L.fn(x, L.y + (r() - 0.5) * L.jitter, s, r, id));
    }
    out.push(`<g opacity="${li === 0 ? 0.88 : 0.97}">${row.join('')}</g>`);
  });
  out.push(rect(0, hz - 70, 820, 90, `url(#${id}hz)`));
  // ground
  out.push(`<path d="M0 ${hz}q205 -18 410 -4t410 4V${h}H0z" fill="url(#${id}g)"/>`);
  out.push(`<path d="M0 ${hz}q205 -18 410 -4t410 4V${h}H0z" fill="url(#${id}p)"/>`);
  // soft mottled ground patches for depth
  for (let i = 0; i < 26; i++) out.push(blob(r() * 820, hz + 30 + r() * (h - hz - 40), 50 + r() * 110, 14 + r() * 34, r() > 0.5 ? lit(sc.ground[0], 0.25) : dim(sc.ground[1], 0.2), 0.16));
  // the road
  const wide = sc.path.wide ?? 1, d = smoothPath(pts);
  out.push(`<path d="${d}" stroke="#000" stroke-opacity=".28" stroke-width="${60 * wide}" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 9)"/>`);
  out.push(`<path d="${d}" stroke="${sc.path.edge}" stroke-width="${58 * wide}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  out.push(`<path d="${d}" stroke="${sc.path.fill}" stroke-width="${48 * wide}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  out.push(`<path d="${d}" stroke="${lit(sc.path.fill, 0.5)}" stroke-width="${22 * wide}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".45" transform="translate(-4 -2)"/>`);
  out.push(`<path d="${d}" stroke="${sc.path.mark}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${sc.path.dash ?? '2 14'}" opacity=".95"/>`);
  // props, depth-sorted by y so lower ones overlap higher ones
  const items: { y: number; svg: string }[] = [];
  for (const L of sc.props) {
    let placed = 0, tries = 0;
    while (placed < L.n && tries++ < L.n * 30) {
      const y = L.y[0] + r() * (L.y[1] - L.y[0]), x = 20 + r() * 780, rx = roadX(pts, y), gap = Math.abs(x - rx);
      if (gap < (L.edge ? 120 : 82) * wide || (L.edge && gap > 260)) continue;
      if (x < 8 || x > 812) continue;
      const s = L.s[0] + r() * (L.s[1] - L.s[0]);
      items.push({ y, svg: L.fn(x, y, s, r, id) });
      placed++;
    }
  }
  items.sort((a, b) => a.y - b.y).forEach((it) => out.push(it.svg));
  // ambient sparkle / pollen / embers
  for (let i = 0; i < 46; i++) {
    const x = r() * 820, y = hz - 40 + r() * (h - hz), c = pick(r, sc.speck);
    out.push(circ(x, y, 0.8 + r() * 2.2, c, 0.35 + r() * 0.5));
    if (i % 5 === 0) out.push(circ(x, y, 5 + r() * 5, c, 0.12));
  }
  out.push(rect(0, 0, 820, h, `url(#${id}v)`));
  return out.join('');
}
