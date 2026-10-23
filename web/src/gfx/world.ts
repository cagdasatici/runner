// Port of App/World.swift. Pure visuals: never reads or changes game rules beyond positions.
// World → scene mapping: scene position = (x, y, -z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SplitMix64 } from '../core/rng';
import { laneX, TRAIN_LENGTH, type Obstacle } from '../core/track';
import type { Materials } from './materials';
import { boxGeo, cylinderGeo, sphereGeo } from './shapes';
import { skyTexture } from './textures';

export const SEGMENT_LENGTH = 18.0;

/** Collects transformed pieces per material, then merges each material's pieces into one mesh (few draw calls). */
class Merger {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number,
      opts: { rotX?: number; rotZ?: number; uv?: [number, number] } = {}): void {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (opts.uv) {
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * opts.uv[0], uv.getY(i) * opts.uv[1]);
    }
    if (opts.rotX) g.rotateX(opts.rotX);
    if (opts.rotZ) g.rotateZ(opts.rotZ);
    g.translate(x, y, z);
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
    if (g !== geo) geo.dispose();
  }
  build(castShadow: boolean, receiveShadow: (m: THREE.Material) => boolean): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false)!;
      list.forEach((g) => g.dispose());
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow(mat);
      group.add(m);
    }
    return group;
  }
}

/** Sky, image lighting for shiny materials, sun with shadows, soft fill light, fog. Returns the sun. */
export function setupEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): THREE.DirectionalLight {
  const sky = skyTexture();
  scene.background = sky;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(sky).texture;
  pmrem.dispose();
  scene.fog = new THREE.Fog(0xe9eef0, 45, 115);

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x8a8170, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const cam = sun.shadow.camera;
  cam.left = -14; cam.right = 14; cam.top = 14; cam.bottom = -14; cam.near = 1; cam.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  return sun;
}

/** Keeps the sun's shadow box centred just ahead of the runner. Same light direction as the iOS version. */
export function followSun(sun: THREE.DirectionalLight, x: number, sceneZ: number): void {
  sun.target.position.set(x, 0, sceneZ - 6);
  sun.position.set(x + 6.1, 16.3, sceneZ - 6 + 9.9);
}

/** One 18 m piece of track and city. Same k always gives the same piece (seeded by k, like iOS). */
export function makeSegment(k: number, m: Materials): THREE.Group {
  const len = SEGMENT_LENGTH;
  const rng = new SplitMix64(BigInt.asUintN(64, BigInt(k)) + 1000n);
  const mg = new Merger();

  mg.add(boxGeo(8.6, 0.3, len), m.gravel, 0, -0.15, -len / 2, { uv: [4, 8] });
  for (let lane = 0; lane < 3; lane++) {
    const x = laneX(lane);
    for (let z = 0.6; z < len; z += 1.2) mg.add(boxGeo(2.3, 0.1, 0.3), m.wood, x, 0.03, -z);
    for (const side of [-0.72, 0.72]) {
      mg.add(boxGeo(0.18, 0.06, len), m.railBase, x + side, 0.11, -len / 2);
      mg.add(boxGeo(0.1, 0.1, len), m.rail, x + side, 0.19, -len / 2);
    }
  }
  for (const side of [-1, 1]) {
    mg.add(boxGeo(1.4, 0.6, len), m.concrete, side * 5.0, 0.3, -len / 2);
    mg.add(boxGeo(0.18, 0.02, len), m.curbStripe, side * 4.42, 0.61, -len / 2);
    for (let lot = 0; lot < 2; lot++) {
      const zc = -(lot * 9 + 4.5);
      if (rng.int(4) === 0) {
        mg.add(boxGeo(7, 0.5, 9), m.grass, side * 9.2, 0.25, zc);
        for (let t = 0; t < 2; t++) {
          const tz = zc + (t === 0 ? -2.2 : 2.2);
          mg.add(cylinderGeo(0.18, 1.6), m.trunk, side * 7.4, 1.3, tz);
          mg.add(sphereGeo(1.25), m.leaf, side * 7.4, 2.9, tz);
          mg.add(sphereGeo(0.9), m.leaf, side * 7.4 + 0.5, 3.7, tz + 0.3);
        }
      } else {
        const h = 6 + rng.int(9); // 6…14 m
        const facade = m.facades[rng.int(m.facades.length)];
        mg.add(boxGeo(7, h, 8.6), facade, side * 9.6, h / 2, zc, { uv: [1, h / 6] });
        mg.add(boxGeo(7.4, 0.5, 9.0), m.roof, side * 9.6, h + 0.25, zc);
        if (rng.int(2) === 0) mg.add(cylinderGeo(0.9, 1.6), m.roof, side * 10.5, h + 1.3, zc + 2);
      }
    }
    if (k % 2 === 0) {
      mg.add(cylinderGeo(0.08, 4.4), m.pole, side * 4.9, 2.2, -9);
      mg.add(boxGeo(0.9, 0.08, 0.12), m.pole, side * 4.5, 4.4, -9);
      mg.add(boxGeo(0.5, 0.12, 0.3), m.lamp, side * 4.15, 4.32, -9);
    }
  }
  if (((k % 3) + 3) % 3 === 0) {
    for (const side of [-1, 1]) mg.add(boxGeo(0.25, 7.5, 0.25), m.pole, side * 4.6, 3.75, -2);
    mg.add(boxGeo(9.5, 0.2, 0.2), m.pole, 0, 7.5, -2);
  }
  const ground = new Set<THREE.Material>([m.gravel, m.wood, m.railBase, m.rail, m.concrete, m.curbStripe, m.grass]);
  const g = mg.build(false, (mat) => ground.has(mat));
  g.position.z = -k * len;
  return g;
}

export function makeObstacle(o: Obstacle, m: Materials): THREE.Group {
  const mg = new Merger();
  const extra: THREE.Mesh[] = [];
  let zCenter = o.z + 0.25;
  switch (o.kind) {
    case 'hurdle':
      for (const side of [-0.92, 0.92]) {
        mg.add(boxGeo(0.09, 1.0, 0.09), m.darkMetal, side, 0.5, 0);
        mg.add(boxGeo(0.14, 0.06, 0.5), m.darkMetal, side, 0.03, 0);
        mg.add(sphereGeo(0.07), m.warning, side, 1.04, 0);
      }
      mg.add(boxGeo(2.0, 0.42, 0.08, 0.03), m.hurdleStripes, 0, 0.76, 0);
      mg.add(boxGeo(2.0, 0.18, 0.06, 0.02), m.hurdleStripes, 0, 0.34, 0);
      break;
    case 'bar':
      for (const side of [-1.12, 1.12]) mg.add(boxGeo(0.16, 2.3, 0.16), m.darkMetal, side, 1.15, 0);
      mg.add(boxGeo(2.4, 0.95, 0.22, 0.05), m.barStripes, 0, 1.7, 0);
      for (const lx of [-0.7, 0, 0.7]) mg.add(sphereGeo(0.09), m.warning, lx, 2.25, 0);
      break;
    case 'train': {
      const L = TRAIN_LENGTH;
      zCenter = o.z + L / 2;
      // Three's box face order: +x, -x, +y, -y, +z (front, toward the runner), -z
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.0, L),
        [m.trainSide, m.trainSide, m.trainRoof, m.trainBottom, m.trainFront, m.trainFront]);
      body.position.y = 1.95;
      body.castShadow = true;
      extra.push(body);
      mg.add(boxGeo(1.2, 0.25, 3.2, 0.08), m.trainRoof, 0, 3.55, 0);
      for (const bz of [-3.2, 3.2]) {
        mg.add(boxGeo(1.9, 0.35, 2.4), m.trainBottom, 0, 0.3, bz);
        for (const wz of [-0.7, 0.7]) for (const wx of [-0.86, 0.86]) {
          mg.add(cylinderGeo(0.27, 0.12), m.wheel, wx, 0.27, bz + wz, { rotZ: Math.PI / 2 });
        }
      }
      for (const hx of [-0.72, 0.72]) mg.add(sphereGeo(0.13), m.headlight, hx, 1.05, L / 2 + 0.02);
      break;
    }
  }
  const g = mg.build(true, () => false);
  extra.forEach((e) => g.add(e));
  g.position.set(laneX(o.lane), 0, -zCenter);
  return g;
}

/** Frees a built group's geometry (materials are shared and stay). */
export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
}
