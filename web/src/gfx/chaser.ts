// The chaser: a towering shadow beast. Its cloak is one noise-shaded mesh (ragged burning hem that dissolves into smoke,
// glowing ember cracks down the back, violet rim light), with horns, back spikes and long reaching claws.
// The camera sits behind the runner, so mostly the BACK is seen: that is where the detail is. Its face (slit eyes, jagged
// grin) shows when it lunges past the runner and turns round to roar. Everything here is drawing only; ~17 draw calls,
// no extra lights, no per-frame allocation. The old "wraith" lived in powerups.ts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lock } from './face';
import { BlobShadow } from './cameos';
import type { ParticlePool } from './effects';
import { dotTexture } from './textures';

export type ChaserEvent = 'appear' | 'caught';

const BASE = 0.74;       // overall scale: big enough to loom, small enough that the runner stays visible past its shoulders
const HEIGHT = 2.3;      // cloak height (m), hood and horns rise above it
const MIN_GAP = 4.6;     // closest it ever gets to the runner while chasing (keeps the runner visible past its shoulders)

const NOISE = `
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p){ return (0.5 * noise(p) + 0.25 * noise(p * 2.03) + 0.125 * noise(p * 4.01)) / 0.875; }
float fbm2(vec3 p){ return (0.6 * noise(p) + 0.3 * noise(p * 2.07)) / 0.9; }
`;

const VERT = `
uniform float uTime; uniform float uLunge; uniform float uWave;
varying vec3 vP; varying vec3 vN; varying vec3 vV; varying float vH;
void main() {
  vec3 p = position;
  float h = mix(1.0, clamp(p.y / ${HEIGHT.toFixed(2)}, 0.0, 1.0), uWave);
  float f = pow(1.0 - h, 1.5) * uWave;            // the lower the hem, the more it streams back and flutters
  p.z += f * (0.55 + 0.3 * sin(uTime * 4.0 + p.x * 3.0 + h * 6.0) + uLunge * 0.35);
  p.x += f * sin(uTime * 2.3 + h * 7.0 + p.z * 2.0) * 0.2;
  p.y += f * sin(uTime * 5.0 + p.x * 4.0) * 0.05;
  vP = position; vH = h; vN = normalMatrix * normal;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = `
uniform float uTime; uniform float uFade; uniform float uSolid; uniform float uLunge;
varying vec3 vP; varying vec3 vN; varying vec3 vV; varying float vH;
${NOISE}
void main() {
  float low = 1.0 - vH;
  float n = fbm3(vP * 1.6 + vec3(0.0, -uTime * 1.0, uTime * 0.6));
  float rag = noise(vec3(vP.x * 2.5, vP.y * 0.8 - uTime * 1.6, vP.z * 2.5));
  // dissolve: torn hem (stronger lower down) plus uFade, which eats the whole body when it appears / leaves
  float thr = (1.0 - uSolid) * (low * low * 0.85 + low * low * low * (rag - 0.45) * 0.5) + uFade * 0.95;
  if (n < thr) discard;
  float edge = 1.0 - smoothstep(0.0, 0.07, n - thr);                       // burning rim of every tear
  vec3 N = normalize(vN); vec3 V = normalize(vV);
  float fr = pow(1.0 - abs(dot(N, V)), 2.6);
  float lit = 0.55 + 0.45 * dot(N, normalize(vec3(0.4, 0.8, 0.5)));
  vec3 col = mix(vec3(0.012, 0.005, 0.03), vec3(0.11, 0.04, 0.26), smoothstep(0.58, 0.9, n)) * lit;   // void with violet swirls
  float vn = fbm2(vP * 2.2 + vec3(0.0, -uTime * 0.3, 0.0));
  float vein = 1.0 - smoothstep(0.0, 0.032, abs(vn - 0.5));                  // glowing cracks
  float back = smoothstep(-0.2, 0.8, N.z * (gl_FrontFacing ? 1.0 : -1.0)); // the back (+z) shows most
  col += vec3(0.5, 0.16, 0.85) * fr * 1.3;
  col += vec3(1.0, 0.38, 0.08) * vein * (0.45 + 0.9 * back) * (0.7 + uLunge * 0.9);
  col += vec3(1.0, 0.45, 0.1) * edge * 1.7;
  if (!gl_FrontFacing) col *= 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

interface Shared { uTime: { value: number }; uFade: { value: number }; uLunge: { value: number } }

function smokeMaterial(shared: Shared, wave: number, solid: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms: { ...shared, uWave: { value: wave }, uSolid: { value: solid } }, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
}

/** Cloak radius at height fraction v (0 hem … 1 neck): flared hem, narrow waist, broad hunched shoulders. */
export function radiusAt(v: number): number {
  const k: [number, number][] = [[0, 0.95], [0.25, 0.7], [0.55, 0.56], [0.78, 0.66], [0.92, 0.36], [1, 0.14]];
  for (let i = 1; i < k.length; i++) {
    if (v <= k[i][0]) { const u = (v - k[i - 1][0]) / (k[i][0] - k[i - 1][0]), s = u * u * (3 - 2 * u); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * s; }
  }
  return k[k.length - 1][1];
}
const shoulders = (v: number): number => Math.exp(-(((v - 0.8) / 0.12) ** 2));
const hunch = (v: number): number => v * v * 0.45;

function cloakGeometry(): THREE.BufferGeometry {
  const RS = 32, HS = 22, pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= HS; j++) {
    const v = j / HS, r = radiusAt(v);
    for (let i = 0; i <= RS; i++) {
      const a = (i / RS) * Math.PI * 2;
      pos.push(Math.sin(a) * r * (1 + 0.5 * shoulders(v)), v * HEIGHT, Math.cos(a) * r * 0.8 - hunch(v));
    }
  }
  for (let j = 0; j < HS; j++) for (let i = 0; i < RS; i++) {
    const a = j * (RS + 1) + i, b = a + RS + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const cone = (r: number, h: number): THREE.BufferGeometry => new THREE.ConeGeometry(r, h, 6).translate(0, h / 2, 0);
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A canvas picture on a plane (the browser draws it once; tests that never build the beast never touch `document`). */
function painted(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const eyesTexture = () => painted(256, 96, (g) => {
  for (const s of [-1, 1]) {
    const cx = 128 + s * 62, cy = 48;
    const halo = g.createRadialGradient(cx, cy, 2, cx, cy, 48);
    halo.addColorStop(0, 'rgba(255,170,60,0.85)'); halo.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = halo; g.fillRect(cx - 50, cy - 50, 100, 100);
    g.beginPath(); // angry slanted slit, inner end low
    g.moveTo(cx - s * 34, cy + 14); g.lineTo(cx + s * 30, cy - 8); g.lineTo(cx + s * 26, cy + 8); g.closePath();
    g.fillStyle = '#fff4c8'; g.shadowColor = '#ff7a18'; g.shadowBlur = 16; g.fill();
  }
});

const mouthTexture = () => painted(256, 128, (g) => {
  g.fillStyle = '#220508'; g.beginPath(); g.ellipse(128, 64, 112, 50, 0, 0, Math.PI * 2); g.fill(); // open maw
  g.shadowColor = '#ff6a1a'; g.shadowBlur = 10; g.fillStyle = '#ffe9b8';
  for (let i = 0; i < 9; i++) { // jagged teeth, top row pointing down, bottom row pointing up
    const x = 30 + i * 24.5, h = 24 + (i % 2) * 12, k = Math.abs(i - 4) * 3;
    g.beginPath(); g.moveTo(x - 11, 20 + k); g.lineTo(x + 11, 20 + k); g.lineTo(x, 20 + k + h); g.fill();
    g.beginPath(); g.moveTo(x - 11, 108 - k); g.lineTo(x + 11, 108 - k); g.lineTo(x, 108 - k - h * 0.8); g.fill();
  }
});

const voidTexture = () => painted(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.7, 'rgba(0,0,0,0.95)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});

/** Soft ribbon fading out along its length (eye beams). */
const beamTexture = () => painted(32, 128, (g) => {
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(255,120,30,0)'); v.addColorStop(1, 'rgba(255,150,60,1)');
  g.fillStyle = v; g.fillRect(0, 0, 32, 128);
  const h = g.createLinearGradient(0, 0, 32, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = h; g.fillRect(0, 0, 32, 128);
});

const easeOutBack = (u: number): number => { const c = 1.70158; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

export class ChaserBlob {
  /** Container at the world origin; only `body` follows the beast. */
  readonly group = new THREE.Group();
  /** Called once when it appears and once when it catches the runner. */
  onEvent?: (e: ChaserEvent) => void;
  private body = new THREE.Group();
  private lean = new THREE.Group();
  private arms: { g: THREE.Group; hand: THREE.Group; s: number }[] = [];
  private eyes: THREE.Mesh;
  private mouth: THREE.Mesh;
  private beams: THREE.Mesh[] = [];
  private aura: THREE.Sprite;
  private underglow: THREE.Mesh;
  private shadow = new BlobShadow(2.4);
  private shared: Shared = { uTime: { value: 0 }, uFade: { value: 1 }, uLunge: { value: 0 } };
  private t = 0;
  private lunge = 0;
  private presence = 0;
  private caughtT = -1;
  private prevOn = false;
  private lastGap = 12;
  private smokeAcc = 0;
  private emberAcc = 0;

  constructor() {
    const cloakMat = smokeMaterial(this.shared, 1, 0);
    const solidMat = smokeMaterial(this.shared, 0, 0.9);
    const boneMat = new THREE.MeshStandardMaterial({ color: 0x1b0c16, roughness: 0.45, metalness: 0.2, emissive: 0xff4a14, emissiveIntensity: 0.22 });
    const cloak = new THREE.Mesh(cloakGeometry(), cloakMat);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), solidMat);
    hood.scale.set(1, 1.05, 1.15);
    hood.position.set(0, HEIGHT + 0.12, -0.34);
    this.lean.add(cloak, hood);

    // face on the hood front: dark void, slit eyes, a jagged grin that opens when it lunges
    const front = (tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, additive: boolean) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, ...(additive ? { blending: THREE.AdditiveBlending } : {}) }));
      m.position.set(x, y, z); m.rotation.y = Math.PI;
      this.lean.add(m);
      return m;
    };
    front(voidTexture(), 0.78, 0.66, 0, HEIGHT + 0.1, -0.74, false);
    this.eyes = front(eyesTexture(), 0.62, 0.23, 0, HEIGHT + 0.2, -0.76, true);
    this.mouth = front(mouthTexture(), 0.5, 0.25, 0, HEIGHT - 0.06, -0.755, false);

    // horns sweep back, up and forward; dorsal spikes run down the back
    const horns = mergeGeometries([-1, 1].map((s) => lock([vec(s * 0.26, HEIGHT + 0.3, -0.25), vec(s * 0.52, HEIGHT + 0.55, -0.2), vec(s * 0.6, HEIGHT + 0.95, -0.4), vec(s * 0.42, HEIGHT + 1.25, -0.75)], 0.075, 0.012, boneMat).geometry), false)!;
    const spikes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const v = 0.42 + i * 0.1, g = cone(0.1 - i * 0.008, 0.72 - i * 0.05);
      g.rotateX(0.45); g.translate(0, v * HEIGHT, radiusAt(v) * 0.8 - hunch(v) - 0.02);
      spikes.push(g);
    }
    this.lean.add(new THREE.Mesh(horns, boneMat), new THREE.Mesh(mergeGeometries(spikes, false)!, boneMat));

    // arms: long, hanging forward past the runner; each ends in a clawed hand
    const claws = mergeGeometries([-0.38, 0, 0.38, 1.2].map((a, i) => cone(0.04, i === 3 ? 0.28 : 0.42).rotateX(-Math.PI / 2 - 0.25).rotateY(a)), false)!;
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.74, 1.8, -0.2);
      arm.add(new THREE.Mesh(lock([vec(0, 0, 0), vec(s * 0.05, -0.28, -0.38), vec(s * 0.05, -0.42, -0.9), vec(0, -0.3, -1.45)], 0.13, 0.05, solidMat).geometry, solidMat));
      const hand = new THREE.Group();
      hand.position.set(0, -0.3, -1.45);
      hand.add(new THREE.Mesh(claws, boneMat));
      arm.add(hand);
      this.lean.add(arm);
      this.arms.push({ g: arm, hand, s });
    }

    // eye beams: two light shafts reaching for the runner's back
    const bt = beamTexture();
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 7).translate(0, 3.5, 0).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: bt, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      b.position.set(s * 0.17, HEIGHT + 0.2, -0.8);
      this.beams.push(b);
      this.lean.add(b);
    }

    this.body.add(this.lean);
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0x8b5cf6, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.aura.position.set(0, 1.4, 0.2);
    this.body.add(this.aura);
    this.underglow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: dotTexture(), color: 0x7c3aed, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.underglow.renderOrder = 1;
    this.underglow.frustumCulled = false;
    this.body.traverse((o) => { o.castShadow = false; o.frustumCulled = false; });
    this.group.add(this.body, this.shadow.mesh, this.underglow);
    this.group.visible = false;
  }

  /** 0…1 how threatening it is right now (post-processing darkens the screen edges, the camera rumbles). */
  get dread(): number {
    if (this.caughtT >= 0) return 1;
    return this.presence * Math.min(1, Math.max(0, (9 - this.lastGap) / 5) * 0.7 + this.lunge * 0.5);
  }

  reset(): void {
    this.presence = 0; this.caughtT = -1; this.prevOn = false; this.lunge = 0; this.lastGap = 12;
    this.shared.uFade.value = 1;
    this.group.visible = false;
  }

  /**
   * `gap` = metres behind the runner (+z); `stumbled` = the runner is in the stumble slow-down.
   * `fx.caught`: the runner has crashed into it; it lunges past, turns round and roars.
   */
  update(on: boolean, dt: number, x: number, z: number, gap: number, stumbled = false,
    fx: { glow?: ParticlePool; smoke?: ParticlePool; caught?: boolean; floorY?: number } = {}): void {
    const floorY = fx.floorY ?? 0;
    const caught = !!fx.caught && (this.presence > 0.05 || this.caughtT >= 0);
    if (caught && this.caughtT < 0) { this.caughtT = 0; this.onEvent?.('caught'); }
    if (!caught) this.caughtT = -1;
    if (on && !this.prevOn) { this.onEvent?.('appear'); this.t = 0; }
    this.prevOn = on;
    const want = on || caught ? 1 : 0;
    this.presence += Math.max(-dt / 0.6, Math.min(dt / 0.7, want - this.presence));
    this.group.visible = this.presence > 0.01;
    if (!this.group.visible) return;
    this.t += dt;
    const t = this.t, sh = this.shared;
    sh.uTime.value = t;
    const rise = this.presence * this.presence * (3 - 2 * this.presence);
    sh.uFade.value = 1 - rise;

    // lunge builds as the gap closes; a stumble snaps it forward
    const g = Math.max(MIN_GAP, gap);
    if (!caught) this.lastGap = g;
    const lw = Math.min(1, Math.max(0, (6.5 - g) / 3)) + (stumbled ? 0.4 : 0);
    this.lunge += (lw - this.lunge) * Math.min(1, dt * 6);
    const L = this.lunge;
    sh.uLunge.value = caught ? 1 : L;

    let gz = z + g - L * 0.8, yaw = 0, scale = 0.55 + 0.45 * easeOutBack(Math.min(1, this.presence)), open = 0.12 + L * 0.5;
    if (caught) {
      const ct = (this.caughtT += dt);
      const e = Math.min(1, ct / 0.32);
      gz = z + (this.lastGap - L * 0.8) * (1 - e * e) - 2.6 * e * e;       // charges through the runner and out the far side
      yaw = Math.PI * easeOutBack(Math.min(1, Math.max(0, (ct - 0.45) / 0.4)));
      scale = 1 + 0.3 * Math.min(1, ct / 0.7);
      open = Math.min(1.4, ct * 3);
      if (ct - dt < 0.32 && ct >= 0.32 && fx.glow) fx.glow.burst(x, floorY + 1.2, gz, 70, { color: 0xff7a2a, speed: 6, life: 0.8, size: 0.3, gravity: 3, colorJitter: 0.3 });
    }
    const bob = Math.sin(t * 3.2) * 0.12 + Math.max(0, Math.sin(t * 7)) * 0.04;
    const gx = x + Math.sin(t * 1.7) * 0.15, gy = floorY + 0.25 + bob;
    this.body.position.set(gx, gy, gz);
    this.body.rotation.y = yaw;
    this.body.scale.setScalar(scale * BASE);
    this.lean.rotation.set(caught ? 0.1 : -L * 0.45, 0, Math.sin(t * 2.1) * 0.05);
    this.lean.scale.set(1 - L * 0.06, 1 + L * 0.08, 1 + L * 0.2);

    // eyes flare, mouth opens, beams brighten as it closes in
    const flare = 1 + L * 0.7 + (caught ? 0.6 : 0) + (Math.sin(t * 13) > 0.93 ? 0.4 : 0);
    this.eyes.scale.set(flare, 1 + L * 0.3, 1);
    this.mouth.scale.set(0.8 + open * 0.35, 0.25 + open * 0.9, 1);
    this.mouth.position.y = HEIGHT - 0.06 - open * 0.05;
    for (const b of this.beams) (b.material as THREE.MeshBasicMaterial).opacity = (0.16 + 0.22 * L + (caught ? 0.2 : 0)) * rise;
    // claws: swipe at the runner, harder the closer it is
    this.arms.forEach((a, i) => {
      const ph = i * Math.PI, sw = Math.sin(t * (2.4 + L * 2) + ph);
      a.g.rotation.x = caught ? 0.7 : -0.1 + sw * (0.18 + 0.12 * L) + L * 0.55;
      a.g.rotation.z = a.s * (0.18 + 0.1 * Math.sin(t * 1.9 + ph) - L * 0.12);
      a.hand.rotation.x = Math.sin(t * 6 + ph) * 0.25 + L * 0.4;
    });
    // glow on the ground, dark patch under it, aura
    const pulse = 1 + Math.sin(t * 4) * 0.06;
    this.aura.scale.setScalar((3.6 + L * 1.4 + (caught ? 2 : 0)) * pulse);
    (this.aura.material as THREE.SpriteMaterial).color.setHex(caught ? 0xff5a1a : 0x8b5cf6);
    this.underglow.position.set(gx, floorY + 0.045, gz);
    this.underglow.scale.setScalar((5.2 + L * 1.5) * pulse * scale);
    (this.underglow.material as THREE.MeshBasicMaterial).opacity = 0.42 * rise;
    this.shadow.set(gx, floorY, gz, 0, 2.2 * scale);

    // smoke trails back from the ragged hem, embers spit upwards; both stay where they were dropped
    if (fx.smoke) {
      this.smokeAcc += dt * 30 * rise;
      while (this.smokeAcc >= 1) {
        this.smokeAcc -= 1;
        fx.smoke.burst(gx + (Math.random() - 0.5) * 1.2, gy + 0.3 + Math.random() * 1.7, gz + 0.5 + Math.random() * 0.7, 1,
          { color: 0x24103f, colorJitter: 0.08, speed: 0.5, life: 0.9, size: 1.1, dir: [0, 0.25, 1], spread: 0.6 });
      }
    }
    if (fx.glow) {
      this.emberAcc += dt * (24 + L * 30) * rise;
      while (this.emberAcc >= 1) {
        this.emberAcc -= 1;
        fx.glow.burst(gx + (Math.random() - 0.5) * 1.1, gy + 0.4 + Math.random() * 1.8, gz + 0.3 + Math.random() * 0.5, 1,
          { color: 0xff7a2a, colorJitter: 0.25, speed: 1.6, life: 0.9, size: 0.15, dir: [0, 1, 0.7], spread: 0.7, gravity: -0.6 });
      }
    }
  }
}
