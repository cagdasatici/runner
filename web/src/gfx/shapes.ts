// Port of the SCNNode helpers in App/Materials.swift. Sizes use SceneKit's meaning:
// box(w, h, l), capsule(radius, TOTAL height), sphere(r), cylinder(r, h).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function boxGeo(w: number, h: number, l: number, chamfer = 0): THREE.BufferGeometry {
  return chamfer > 0 ? new RoundedBoxGeometry(w, h, l, 2, chamfer) : new THREE.BoxGeometry(w, h, l);
}
export const capsuleGeo = (r: number, h: number) => new THREE.CapsuleGeometry(r, Math.max(0, h - 2 * r), 4, 12);
export const sphereGeo = (r: number) => new THREE.SphereGeometry(r, 20, 14);
export const cylinderGeo = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 24);

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
