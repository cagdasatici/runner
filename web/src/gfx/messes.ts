// Dog messes on the track: a cartoon poop (with eyes and stink lines) and a flat shiny puddle.
// Geometries and materials are shared by all instances; only the per-id puddle outline is built (and disposed) per mess.
import * as THREE from 'three';
import { laneX, type Mess } from '../core/track';

const brown = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.55 });
const brownHi = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.55 });
const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pupil = new THREE.MeshBasicMaterial({ color: 0x000000 });
const stinkMat = new THREE.MeshBasicMaterial({ color: 0x9acd32, transparent: true, opacity: 0.7, depthWrite: false });
const puddleMat = new THREE.MeshStandardMaterial({ color: 0xf2d43a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 });
const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });

const sph = (r: number) => new THREE.SphereGeometry(r, 20, 14);
const gSphere = [sph(0.22), sph(0.16), sph(0.1)];
const gTip = new THREE.ConeGeometry(0.06, 0.12, 12);
const gEye = sph(0.035), gPupil = sph(0.018);
const gStink = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector3(Math.sin(k * Math.PI * 3) * 0.05, k * 0.5, 0)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 5, false);
})();
const gShine = new THREE.RingGeometry(0.25, 0.3, 24).rotateX(-Math.PI / 2);

/** The cartoon poop (without stink lines), feet on y = 0. Shared by the track and the dog's head (`scale` 0.45). */
export function makePoop(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const ys = [0.08, 0.2, 0.3];
  gSphere.forEach((geo, i) => {
    const m = new THREE.Mesh(geo, i === 1 ? brownHi : brown);
    m.position.y = ys[i];
    m.scale.y = 0.6;
    m.castShadow = true;
    g.add(m);
  });
  const tip = new THREE.Mesh(gTip, brown);
  tip.position.set(0, 0.37, 0);
  tip.rotation.z = 0.3;
  g.add(tip);
  for (const x of [-0.06, 0.06]) { // eyes on the middle sphere's front (-z side)
    const e = new THREE.Mesh(gEye, eyeWhite);
    e.position.set(x, 0.22, -0.145);
    const p = new THREE.Mesh(gPupil, pupil);
    p.position.set(x, 0.22, -0.172);
    g.add(e, p);
  }
  g.scale.setScalar(scale);
  return g;
}

/** A flat shiny puddle (its outline geometry is per id and must be disposed by the owner). */
export function makePuddle(id: number): THREE.Group {
  const geo = new THREE.CircleGeometry(0.75, 24).rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const a = Math.atan2(z, x);
    const k = 1 + 0.18 * Math.sin(id * 12.9898 + a * 3);
    p.setXYZ(i, x * k, 0, z * k);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, puddleMat);
  m.position.y = 0.02;
  m.receiveShadow = true;
  const s = new THREE.Mesh(gShine, shineMat);
  s.position.set(0.15, 0.025, -0.1);
  g.add(m, s);
  return g;
}

export class MessRenderer {
  readonly group = new THREE.Group();
  private nodes = new Map<number, THREE.Object3D>();
  private stinks = new Map<number, THREE.Mesh[]>();

  update(visible: Mess[], time: number): void {
    const live = new Set<number>();
    for (const m of visible) {
      live.add(m.id);
      if (this.nodes.has(m.id)) continue;
      let node: THREE.Group;
      if (m.kind === 'poop') {
        node = makePoop();
        const lines: THREE.Mesh[] = [];
        for (let i = 0; i < 3; i++) {
          const s = new THREE.Mesh(gStink, stinkMat.clone()); // own material: opacity animates per line
          s.position.set((i - 1) * 0.16, 0.4, 0);
          node.add(s);
          lines.push(s);
        }
        this.stinks.set(m.id, lines);
      } else node = makePuddle(m.id);
      node.position.set(laneX(m.lane), 0, -m.z);
      this.group.add(node);
      this.nodes.set(m.id, node);
    }
    for (const [id, n] of this.nodes) if (!live.has(id)) this.remove(id, n);
    for (const lines of this.stinks.values()) {
      lines.forEach((s, i) => {
        s.position.y = 0.4 + 0.05 * Math.sin(time * 3 + i);
        (s.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.3 * Math.sin(time * 2 + i);
      });
    }
  }

  private remove(id: number, n: THREE.Object3D): void {
    this.group.remove(n);
    for (const s of this.stinks.get(id) ?? []) (s.material as THREE.Material).dispose();
    this.stinks.delete(id);
    n.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.type === 'CircleGeometry') m.geometry.dispose(); }); // only the per-id puddle outline is not shared
    this.nodes.delete(id);
  }

  clear(): void { for (const [id, n] of [...this.nodes]) this.remove(id, n); }
}
