// Collects transformed, vertex-coloured pieces per material and merges each material's pieces into ONE mesh
// (few draw calls). Colours are baked per vertex, with an optional "ambient occlusion" darkening towards the bottom
// of each piece, so flat-shaded scenery gets depth without any extra lights or textures.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface AddOpts {
  color?: number;                          // sRGB hex tint (default white)
  glow?: number;                           // multiplies the colour (>1 = HDR, picked up by the bloom)
  ao?: number;                             // 0…1: darkness at the bottom of the piece
  top?: number;                            // 0…1: brighten the top face area by this much (cheap sky bounce)
  scale?: [number, number, number];
  rot?: [number, number, number];          // Euler XYZ in radians
  uv?: [number, number, number, number];   // maps the piece's 0…1 UVs into this rectangle (u0, v0, u1, v1) of an atlas
  uvScale?: [number, number];              // multiplies UVs (tiling)
  uvOffset?: [number, number];
}

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();

export class Merger {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, o: AddOpts = {}): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (o.scale) g.scale(o.scale[0], o.scale[1], o.scale[2]);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const n = pos.count;
    const col = new Float32Array(n * 3);
    _c.setHex(o.color ?? 0xffffff);
    const k = o.glow ?? 1;
    let y0 = 0, span = 1;
    if (o.ao || o.top) {
      g.computeBoundingBox();
      y0 = g.boundingBox!.min.y;
      span = Math.max(1e-4, g.boundingBox!.max.y - y0);
    }
    const ao = o.ao ?? 0, top = o.top ?? 0;
    for (let i = 0; i < n; i++) {
      let f = k;
      if (ao || top) {
        const t = (pos.getY(i) - y0) / span;
        f *= 1 - ao * (1 - t) * (1 - t) + top * t * t;
      }
      col[i * 3] = _c.r * f; col[i * 3 + 1] = _c.g * f; col[i * 3 + 2] = _c.b * f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    if (o.uvScale) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uvScale[0], uv.getY(i) * o.uvScale[1]);
    if (o.uvOffset) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + o.uvOffset[0], uv.getY(i) + o.uvOffset[1]);
    if (o.uv) {
      const [u0, v0, u1, v1] = o.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    if (o.rot) g.applyMatrix4(_m.makeRotationFromEuler(_e.set(o.rot[0], o.rot[1], o.rot[2])));
    g.translate(x, y, z);
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }

  /** One merged geometry per material, in insertion order. */
  geometries(): Map<THREE.Material, THREE.BufferGeometry> {
    const out = new Map<THREE.Material, THREE.BufferGeometry>();
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false)!;
      list.forEach((g) => g.dispose());
      out.set(mat, merged);
    }
    this.parts.clear();
    return out;
  }

  build(castShadow: (m: THREE.Material) => boolean, receiveShadow: (m: THREE.Material) => boolean): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, geo] of this.geometries()) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = castShadow(mat);
      m.receiveShadow = receiveShadow(mat);
      group.add(m);
    }
    return group;
  }
}
