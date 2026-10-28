// The themed world: sky + lights + fog + skyline backdrop (Environment), 18 m track/city segments, the finish arch.
// World → scene mapping: scene position = (x, y, -z). Pure visuals: never reads or changes game rules.
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { SplitMix64 } from '../core/rng';
import { laneX } from '../core/track';
import { applyThemeToMaterials, type EnvMaterials } from './envMaterials';
import { backdropTexture, mix, skyTexture } from './envTextures';
import { Merger } from './merge';
import { VENT_Z, ventAt } from './life';
import { SkyDome } from './skyDome';
import { BOX, box, CONE, CYL, ICO, placeProp, placeShrub, type Ctx } from './props';
import { clearVehicleCache } from './vehicles';
import type { Theme } from './themes';

export { makeObstacle } from './vehicles';
export const SEGMENT_LENGTH = 18.0;

/** Real sky lighting (Poly Haven, CC0) for the worlds that look like our own; the made-up ones (candy, space) keep their painted sky. */
const NO_HDRI = new Set(['candy-land', 'space-station', 'crystal-dreams']);
function hdriFor(t: Theme): string | null {
  if (NO_HDRI.has(t.id)) return null;
  return t.stars > 0.5 ? 'dikhololo_night' : t.sky.mid === 0xf2788a ? 'venice_sunset' : 'kloppenheim_06_puresky';
}
const SHADOW_BOX = 14;

/** Sky, image lighting for shiny materials, sun with shadows, fog and the distant skyline. Call `apply` to (re)theme. */
export class Environment {
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.5);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.5);
  /** < 1 pulls the fog in (tablets draw a shorter distance, the fog hides where the world ends). */
  fogScale = 1;
  readonly rim = new THREE.DirectionalLight(0xbfe3ff, 0.55); // cool back light so silhouettes pop; no shadows
  private backdrop: THREE.Mesh;
  private backdropMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false });
  private skyTex: THREE.Texture | null = null;
  readonly dome = new SkyDome();
  private fogBase = new THREE.Color();
  private fogTint = new THREE.Color();
  private envTex: THREE.Texture | null = null;
  private hdri = new Map<string, THREE.Texture>();
  private pmrem: THREE.PMREMGenerator;
  theme: Theme | null = null;

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer, private mats: EnvMaterials, shadowSize: number) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.add(this.hemi);
    this.sun.castShadow = true;
    this.setShadowSize(shadowSize);
    const cam = this.sun.shadow.camera;
    cam.left = -SHADOW_BOX; cam.right = SHADOW_BOX; cam.top = SHADOW_BOX; cam.bottom = -SHADOW_BOX; cam.near = 1; cam.far = 60;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);
    this.rim.castShadow = false;
    scene.add(this.rim);
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(460, 78), this.backdropMat);
    this.backdrop.renderOrder = -1;
    this.backdrop.frustumCulled = false;
    scene.add(this.backdrop);
    scene.add(this.dome.mesh);
  }

  setShadowSize(px: number): void {
    this.sun.shadow.mapSize.set(px, px);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
  }

  /** Per frame: sky drift and fog colour follow the same slow cycle. */
  tick(time: number, camera: THREE.Camera): void {
    const k = this.dome.update(time, camera);
    (this.scene.fog as THREE.Fog | null)?.color.copy(this.fogBase).lerp(this.fogBase.clone().multiply(this.fogTint).multiplyScalar(1.15), k);
  }

  apply(t: Theme): void {
    if (this.theme === t) return;
    this.theme = t;
    this.skyTex?.dispose();
    this.envTex?.dispose();
    this.skyTex = skyTexture(t);
    this.scene.background = null;
    this.envTex = this.pmrem.fromEquirectangular(this.skyTex).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 1;
    this.useHdri(t);
    this.scene.fog = new THREE.Fog(t.fog.color, t.fog.near * 1.25 * this.fogScale, t.fog.far * 1.2 * this.fogScale);
    const tint = t.stars > 0.5 ? 0x8fa8ff : t.sky.mid === 0xf2788a ? 0xffb38a : 0xffd9a8; // night: cooler, sunset: warmer, day: golden hour
    this.dome.set(this.skyTex, tint, t.stars > 0.5 ? 0.35 : 1);
    this.fogBase.setHex(t.fog.color); this.fogTint.setHex(tint);
    this.hemi.color.setHex(t.hemi.sky);
    this.hemi.groundColor.setHex(t.hemi.ground);
    this.hemi.intensity = t.hemi.intensity;
    this.rim.intensity = 0.55 * (t.hemi.intensity / 1.5);
    this.sun.color.setHex(t.sun.color);
    this.sun.intensity = t.sun.intensity;
    this.backdropMat.map?.dispose();
    this.backdropMat.map = backdropTexture(t);
    this.backdropMat.needsUpdate = true;
    applyThemeToMaterials(this.mats, t);
    clearVehicleCache();
  }

  /** Swaps the painted-sky lighting for the real HDRI once it has loaded (cached per map), if this world has one. */
  private useHdri(t: Theme): void {
    const key = hdriFor(t);
    if (!key) return;
    const show = (env: THREE.Texture) => {
      if (this.theme !== t) return; // the world changed while it loaded
      this.scene.environment = env;
      this.scene.environmentIntensity = 0.75;
    };
    const hit = this.hdri.get(key);
    if (hit) { show(hit); return; }
    new RGBELoader().load(`${import.meta.env.BASE_URL}hdri/${key}.hdr`, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const env = this.pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      this.hdri.set(key, env);
      show(env);
    }, undefined, () => { /* offline and not cached: the painted sky lighting stays */ });
  }

  /** Keeps the sun's shadow box centred just ahead of the runner (snapped to shadow texels so edges don't shimmer). */
  follow(x: number, sceneZ: number): void {
    const texel = (SHADOW_BOX * 2) / this.sun.shadow.mapSize.x;
    const tx = Math.round(x / texel) * texel, tz = Math.round((sceneZ - 6) / texel) * texel;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx + 6.1, 16.3, tz + 9.9);
    this.rim.position.set(tx - 4, 6, tz + 10);
    this.rim.target.position.set(tx, 0, tz);
    this.rim.target.updateMatrixWorld();
  }

  /** The skyline plane stays far in front of the camera (behind it for the menu camera, which looks back along +z). */
  placeBackdrop(camera: THREE.Camera, lookingBack: boolean): void {
    const dir = lookingBack ? 1 : -1;
    this.backdrop.position.set(camera.position.x * 0.9, 26, camera.position.z + dir * 175);
    this.backdrop.rotation.y = lookingBack ? Math.PI : 0;
  }
}

/** One 18 m piece of track and city. Same k and theme always give the same piece (seeded by k, like iOS). */
export function makeSegment(k: number, m: EnvMaterials, t: Theme): THREE.Group {
  const len = SEGMENT_LENGTH;
  const rng = new SplitMix64(BigInt.asUintN(64, BigInt(k)) + 1000n);
  const mg = new Merger();
  const c: Ctx = { mg, m, t, rng };
  const fogMix = (col: number, f: number) => mix(col, t.fog.color, f);

  // ---- track: ballast, sleepers, rails
  mg.add(BOX, m.gravel, 0, -0.15, -len / 2, { scale: [8.6, 0.3, len], uvScale: [3.4, len / 2.6], color: 0xffffff });
  for (let lane = 0; lane < 3; lane++) {
    const x = laneX(lane);
    for (let z = 0.6; z < len; z += 1.2) box(c, m.vc, x, 0.05, -z, 2.3, 0.1, 0.3, 0x7b5230, { ao: 0.35, top: 0.1 });
    for (const side of [-0.72, 0.72]) {
      box(c, m.vc, x + side, 0.12, -len / 2, 0.2, 0.06, len, 0x4a4f5a);
      box(c, m.vc, x + side, 0.2, -len / 2, 0.1, 0.1, len, 0xd4dbe4, { top: 0.3 });
    }
  }
  box(c, m.vc, -LANE_EDGE, 0.02, -len / 2, 0.14, 0.02, len, 0xf4d03f); // painted lane edges on the ballast
  box(c, m.vc, LANE_EDGE, 0.02, -len / 2, 0.14, 0.02, len, 0xf4d03f);

  for (const side of [-1, 1]) {
    // ---- pavement, kerb stripe, and the wide verge that fills the view to the sides
    mg.add(BOX, m.paving, side * 5.0, 0.3, -len / 2, { scale: [1.4, 0.6, len], color: t.ground.path, glow: 1.5, ao: 0.25, top: 0.12, uvScale: [0.9, len / 1.6] });
    box(c, m.vc, side * 4.42, 0.61, -len / 2, 0.18, 0.02, len, 0xfacc15);
    if (ventAt(k, side as -1 | 1)) { // street grate (the steam comes from life.ts)
      box(c, m.vc, side * 5.0, 0.62, VENT_Z, 0.9, 0.04, 0.9, 0x262a33);
      for (let i = -1; i <= 1; i++) box(c, m.vc, side * 5.0, 0.645, VENT_Z + i * 0.26, 0.74, 0.02, 0.06, 0x555c68);
    }
    box(c, m.vc, side * 25.7, 0.2, -len / 2, 40, 0.4, len, t.ground.side, { top: 0.1 });

    for (let lot = 0; lot < 2; lot++) {
      const zc = -(lot * 9 + 4.5);
      const parkOdds = t.prop === 'container' || t.prop === 'cactus' ? 3 : 4;
      if (rng.int(parkOdds) === 0) {
        const n = 2 + rng.int(2);
        for (let i = 0; i < n; i++) {
          const pz = zc + (i - (n - 1) / 2) * (7 / n) + (rng.int(10) - 5) / 10;
          placeProp(c, t.prop, side * (7.2 + rng.int(40) / 10), pz, 0.9 + rng.int(40) / 100, rng);
        }
      } else {
        building(c, side, zc, 6 + rng.int(9), t);
      }
      placeShrub(c, side * (6.0 + rng.int(8) / 10), zc + (rng.int(60) - 30) / 10, rng);
      if (rng.int(2) === 0) placeShrub(c, side * (6.3 + rng.int(8) / 10), zc + (rng.int(60) - 30) / 10, rng);
    }
    // ---- far skyline blocks: bigger, hazier buildings behind the lots
    for (let lot = 0; lot < 2; lot++) {
      if (rng.int(10) < 3) continue;
      const h = 14 + rng.int(26), w = 7 + rng.int(5), x = side * (19 + rng.int(14));
      const wall = fogMix(t.buildings[rng.int(t.buildings.length)], 0.28);
      mg.add(BOX, m.facade, x, h / 2, -(lot * 9 + 4.5), { scale: [w, h, 8.4], color: wall, ao: 0.4, top: 0.15, uvScale: [w / 12, h / 12], uvOffset: [rng.int(8) / 8, 0] });
      mg.add(BOX, m.vc, x, h + 0.2, -(lot * 9 + 4.5), { scale: [w + 0.4, 0.4, 8.8], color: fogMix(t.roof, 0.3) });
    }
    // ---- street lamp
    if (k % 2 === 0) lamp(c, side, -9);
  }
  if (((k % 3) + 3) % 3 === 0) gantry(c);

  const ground = new Set<THREE.Material>([m.gravel, m.paving, m.vc, m.facade]);
  const g = mg.build(() => false, (mat) => ground.has(mat));
  g.position.z = -k * len;
  return g;
}

const LANE_EDGE = 3.77; // outer edge of the side lanes

function building(c: Ctx, side: number, zc: number, h: number, t: Theme): void {
  const { mg, m, rng } = c;
  const wall = t.buildings[rng.int(t.buildings.length)];
  const w = 6 + rng.int(14) / 10, d = 8.3, cx = side * 9.6;
  const tiers = h > 10 && rng.int(2) === 0 ? 2 : 1;
  const h1 = tiers === 2 ? h * 0.65 : h;
  const uvo: [number, number] = [rng.int(8) / 8, 0];
  mg.add(BOX, m.facade, cx, h1 / 2, zc, { scale: [w, h1, d], color: wall, ao: 0.42, top: 0.12, uvScale: [w / 12, h1 / 12], uvOffset: uvo });
  box(c, m.vc, cx, h1 + 0.2, zc, w + 0.5, 0.4, d + 0.5, mix(wall, 0x000000, 0.25), { top: 0.15 }); // cornice
  let top = h1 + 0.4;
  if (tiers === 2) {
    const h2 = h - h1, w2 = w - 1.6;
    mg.add(BOX, m.facade, cx + side * 0.4, top + h2 / 2, zc, { scale: [w2, h2, d - 1.4], color: mix(wall, 0xffffff, 0.12), ao: 0.4, uvScale: [w2 / 12, h2 / 12], uvOffset: uvo });
    box(c, m.vc, cx + side * 0.4, top + h2 + 0.2, zc, w2 + 0.5, 0.4, d - 0.9, mix(wall, 0x000000, 0.25), { top: 0.15 });
    top += h2 + 0.4;
  }
  if (t.snow) box(c, m.vc, cx, top + 0.12, zc, w + 0.4, 0.26, d + 0.4, 0xffffff);
  // shopfront at the street side: dark glass, glowing when it's dusk, with a striped awning
  const fx = cx - side * (w / 2 + 0.06);
  const neon = t.neon[rng.int(t.neon.length)];
  box(c, m.vc, fx, 1.35, zc, 0.16, 2.1, d - 1.2, 0x2a3550, { ao: 0.2 });
  if (t.windowGlow > 0.3) box(c, m.glow, fx - side * 0.09, 1.3, zc, 0.04, 1.4, d - 2.2, 0xffd9a0, { glow: 0.55 + t.windowGlow * 0.25 });
  const nA = 4;
  for (let i = 0; i < nA; i++) {
    box(c, m.vc, fx - side * 0.5, 2.55, zc - (d - 1.2) / 2 + (i + 0.5) * (d - 1.2) / nA, 1.2, 0.18, (d - 1.2) / nA, i % 2 ? 0xffffff : neon, { top: 0.1 });
  }
  // corner pilasters
  for (const dz of [-1, 1]) box(c, m.vc, fx, h1 / 2, zc + dz * (d / 2 - 0.1), 0.3, h1, 0.3, mix(wall, 0xffffff, 0.3));
  // roof furniture
  switch (rng.int(4)) {
    case 0: // AC box + vent
      box(c, m.vc, cx, top + 0.5, zc + 1.2, 1.6, 1.0, 1.4, 0xcfd6de, { ao: 0.3, top: 0.1 });
      c.mg.add(CYL, m.vc, cx + 1.2, top + 0.4, zc - 1.2, { scale: [0.45, 0.8, 0.45], color: 0x9aa5b1, ao: 0.3 });
      break;
    case 1: // water tower
      for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) c.mg.add(CYL, m.vc, cx + dx, top + 0.7, zc + dz, { scale: [0.05, 1.4, 0.05], color: 0x4a4f5a });
      c.mg.add(CYL, m.vc, cx, top + 1.9, zc, { scale: [0.95, 1.2, 0.95], color: 0x9a6b3f, ao: 0.3, top: 0.1 });
      c.mg.add(CONE, m.vc, cx, top + 2.8, zc, { scale: [1.05, 0.6, 1.05], color: 0x6f4a2a });
      break;
    case 2: // billboard / neon sign facing the track
      box(c, m.vc, cx - side * 1.4, top + 0.9, zc, 0.15, 1.8, 0.15, 0x4a4f5a);
      box(c, m.vc, cx - side * 1.4, top + 2.2, zc, 0.22, 1.6, 4.2, 0x2a2f3a);
      box(c, m.glow, cx - side * 1.52, top + 2.2, zc, 0.06, 1.3, 3.9, neon, { glow: 1.2 + t.windowGlow });
      break;
    default: // antenna
      c.mg.add(CYL, m.vc, cx, top + 1.6, zc, { scale: [0.06, 3.2, 0.06], color: 0x4a4f5a });
      c.mg.add(ICO, m.glow, cx, top + 3.3, zc, { scale: [0.12, 0.12, 0.12], color: 0xff4040, glow: 2.4 });
  }
  // neon trim on night worlds
  if (t.windowGlow > 0.8) box(c, m.glow, fx - side * 0.1, h1 * 0.55, zc, 0.06, 0.12, d - 0.6, neon, { glow: 1.8 });
}

function lamp(c: Ctx, side: number, z: number): void {
  const { m, t } = c;
  c.mg.add(CYL, m.vc, side * 4.9, 2.2, z, { scale: [0.07, 4.4, 0.07], color: 0x3a4250, ao: 0.4 });
  c.mg.add(CYL, m.vc, side * 4.9, 0.25, z, { scale: [0.22, 0.5, 0.22], color: 0x2a303b });
  box(c, m.vc, side * 4.55, 4.42, z, 0.95, 0.07, 0.1, 0x3a4250);
  box(c, m.vc, side * 4.12, 4.34, z, 0.5, 0.1, 0.28, 0x2a303b);
  box(c, m.glow, side * 4.12, 4.27, z, 0.42, 0.05, 0.2, 0xfff1c4, { glow: 1.6 + t.windowGlow });
}

function gantry(c: Ctx): void {
  const { m, t, rng } = c;
  for (const side of [-1, 1]) {
    box(c, m.vc, side * 4.6, 3.75, -2, 0.25, 7.5, 0.25, 0x4a5262, { ao: 0.3 });
    box(c, m.vc, side * 4.6, 0.15, -2, 0.7, 0.3, 0.7, 0x2a303b);
  }
  box(c, m.vc, 0, 7.5, -2, 9.6, 0.3, 0.3, 0x4a5262, { top: 0.2 });
  box(c, m.vc, 0, 6.5, -2, 9.0, 0.06, 0.06, 0x2a303b);
  for (let lane = 0; lane < 3; lane++) { // signal heads, one per lane
    const x = laneX(lane);
    box(c, m.vc, x, 6.9, -2, 0.7, 1.3, 0.35, 0x232833);
    box(c, m.glow, x, 7.2, -1.8, 0.28, 0.28, 0.06, rng.int(3) === 0 ? 0xff4040 : 0x40ff7a, { glow: 2.4 });
    box(c, m.glow, x, 6.75, -1.8, 0.28, 0.28, 0.06, 0xffc83a, { glow: 0.5 });
  }
  void t;
}

/** Finish arch over all three lanes: striped posts, banner, bunting, checkered ground line. `z` is the finish distance. */
export function makeFinishArch(z: number, m: EnvMaterials): THREE.Group {
  const g = new THREE.Group();
  const mg = new Merger();
  const c = { mg, m } as unknown as Ctx;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) box(c, m.vc, side * 4.3, 0.5 + i, 0, 0.5, 1.0, 0.5, i % 2 ? 0x111827 : 0xffffff, { ao: 0.2 });
    mg.add(ICO, m.glow, side * 4.3, 6.4, 0, { scale: [0.45, 0.45, 0.45], color: 0xfde047, glow: 1.8 });
  }
  for (let i = 0; i < 9; i++) { // bunting flags
    const x = -3.8 + i * 0.95;
    mg.add(CONE, m.vc, x, 4.3 - Math.sin((i / 8) * Math.PI) * -0.0 - 0.0, 0.12, { scale: [0.3, 0.6, 0.3], rot: [Math.PI, 0, 0], color: [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xec4899][i % 5] });
  }
  const parts = mg.build(() => true, () => false);
  g.add(parts);
  const banner = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 0.2), [m.vc, m.vc, m.vc, m.vc, m.finishBanner, m.vc]);
  banner.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(banner.geometry.getAttribute('position').count * 3).fill(1), 3));
  banner.position.y = 5.4;
  banner.castShadow = true;
  g.add(banner);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.55), m.checker);
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.2;
  g.add(line);
  g.position.z = -z;
  return g;
}

/** Frees a built group's geometry (materials are shared and stay). Cached obstacle geometry is shared and stays too. */
export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => { if (o instanceof THREE.Mesh && !o.geometry.userData.shared) o.geometry.dispose(); });
}
