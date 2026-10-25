// Hand-built faces and hair for the kid characters (Arel, Nora), added on top of the adventurer head mesh.
// Everything is positioned from measurements of the bind-pose head (eye line, skin extents, a ray onto the face surface),
// so it stays right whatever the model is scaled to, then parented to the Head bone so it follows the animation.
import * as THREE from 'three';

export interface FaceDef {
  /** Iris colour. */
  iris: number;
  lip: number;
  /** 'closed' = lips pressed into a smile, 'open' = a smile with teeth. */
  smile: 'closed' | 'open';
  /** Hair colours: base, light streaks. */
  hair: [number, number];
  style: 'messy' | 'long';
  glasses?: boolean;
  /** Rosy cheeks (0 = none). */
  blush?: number;
  lashes?: boolean;
  /** Eyebrow colour and thickness (fraction of head width). */
  brow: number;
  browThick: number;
}

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

/** A tube along `pts` whose radius shrinks from r0 to r1: one strand/lock of hair. */
function lock(pts: THREE.Vector3[], r0: number, r1: number, m: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts);
  const N = 28, R = 8;
  const g = new THREE.TubeGeometry(curve, N, 1, R, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i <= N; i++) {
    const c = curve.getPointAt(i / N), r = r0 + (r1 - r0) * (i / N);
    for (let j = 0; j <= R; j++) {
      const k = i * (R + 1) + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

/** A cylinder between two points (glasses arms). */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material): THREE.Mesh {
  const d = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), m);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return mesh;
}

export function addFace(model: THREE.Group, wrap: THREE.Group, face: FaceDef): void {
  const headMesh = model.getObjectByName('Adventurer_Head');
  let bone: THREE.Object3D | undefined;
  model.traverse((o) => { if ((o as THREE.Bone).isBone && o.name === 'Head') bone = o; });
  if (!headMesh || !bone) return;
  wrap.updateMatrixWorld(true);
  model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update(); });

  const meshesOf = (name: string) => { const out: THREE.Mesh[] = []; headMesh.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === name) out.push(m); }); return out; };
  const boxOf = (name: string) => { const b = new THREE.Box3(); for (const m of meshesOf(name)) b.union(new THREE.Box3().setFromObject(m, true)); return b; };
  const skin = boxOf('Skin'), eye = boxOf('Eye'), hair = boxOf('Hair');
  const W = skin.max.x - skin.min.x; // head width: every size below is a fraction of it
  const eyeY = (eye.min.y + eye.max.y) / 2, cx0 = (skin.min.x + skin.max.x) / 2, zc = (skin.min.z + skin.max.z) / 2;
  const top = hair.max.y, cx = (eye.max.x - eye.min.x) / 2 * 0.8;

  // z of the face surface at (x, y): a ray from in front, against the skin
  const ray = new THREE.Raycaster();
  const skinMeshes = meshesOf('Skin');
  const surf = (x: number, y: number): number => {
    ray.set(new THREE.Vector3(x, y, skin.min.z - 1), new THREE.Vector3(0, 0, 1));
    const hit = ray.intersectObjects(skinMeshes, false)[0];
    return hit ? hit.point.z : skin.min.z + W * 0.04;
  };
  const add = (m: THREE.Object3D) => { m.updateMatrixWorld(true); bone!.attach(m); };
  const put = (m: THREE.Object3D, x: number, y: number, z: number) => { m.position.set(x, y, z); new THREE.Group().add(m); add(m); return m; };
  const ellipsoid = (rx: number, ry: number, rz: number, m: THREE.Material) => { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m); e.scale.set(rx, ry, rz); return e; };

  // the model's own eyes and brows are plain dots/bars: replace them, and clear the hair off the face (forehead, front of the ears)
  for (const m of [...meshesOf('Eye'), ...meshesOf('Eyebrows')]) m.removeFromParent();
  for (const m of meshesOf('Hair')) {
    const sm = m as THREE.SkinnedMesh, g = m.geometry, pos = g.attributes.position as THREE.BufferAttribute;
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const p = new THREE.Vector3(), keep: number[] = [];
    for (let t = 0; t < idx.length; t += 3) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) { p.fromBufferAttribute(pos, idx[t + k]); sm.applyBoneTransform?.(idx[t + k], p); p.applyMatrix4(m.matrixWorld); x += p.x / 3; y += p.y / 3; z += p.z / 3; }
      if (!(y < eyeY + W * 0.3 && z < zc - W * 0.1 && Math.abs(x - cx0) < W * 0.42)) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    g.setIndex(keep);
  }

  // --- eyes: white, iris, pupil, glint, upper lid line (+ lashes) ---
  const white = mat(0xfbf8f4, { roughness: 0.35 }), iris = mat(face.iris, { roughness: 0.3 }), dark = mat(0x16100c, { roughness: 0.3 });
  for (const sx of [-1, 1]) {
    const x = cx0 + sx * cx, z = surf(x, eyeY);
    put(ellipsoid(W * 0.085, W * 0.07, W * 0.035, white), x, eyeY, z + W * 0.004);
    put(ellipsoid(W * 0.052, W * 0.052, W * 0.014, iris), x, eyeY - W * 0.004, z - W * 0.026);
    put(ellipsoid(W * 0.026, W * 0.026, W * 0.012, dark), x, eyeY - W * 0.004, z - W * 0.033);
    put(ellipsoid(W * 0.013, W * 0.013, W * 0.008, white), x + sx * W * -0.018, eyeY + W * 0.014, z - W * 0.04);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(W * 0.088, W * (face.lashes ? 0.011 : 0.008), 6, 20, Math.PI), dark);
    put(lid, x, eyeY + W * 0.004, z - W * 0.01);
    if (face.lashes) { // two little lash flicks on the outer corner
      for (const a of [0.15, 0.5]) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.005, W * 0.002, W * 0.05, 5), dark);
        f.rotation.z = -sx * (Math.PI / 2 - 0.6 - a);
        put(f, x + sx * W * 0.1, eyeY + W * (0.025 + a * 0.05), z - W * 0.012);
      }
    }
  }

  // --- eyebrows: a soft arch above each eye ---
  const browMat = mat(face.brow, { roughness: 0.8 });
  for (const sx of [-1, 1]) {
    const x = cx0 + sx * cx, by = eyeY + W * 0.15;
    const b = new THREE.Mesh(new THREE.TorusGeometry(W * 0.1, W * face.browThick, 6, 14, Math.PI * 0.62), browMat);
    b.rotation.z = Math.PI / 2 - Math.PI * 0.31 + sx * 0.12; // arch centred, outer end dips
    put(b, x, by - W * 0.05, surf(x, by) - W * 0.012);
  }

  // --- nose, mouth, cheeks ---
  const skinTone = (skinMeshes[0].material as THREE.MeshStandardMaterial).color;
  const noseMat = mat(skinTone.clone().multiplyScalar(0.93).getHex());
  const noseY = eyeY - W * 0.2, mouthY = eyeY - W * 0.43;
  put(ellipsoid(W * 0.045, W * 0.05, W * 0.045, noseMat), cx0, noseY, surf(cx0, noseY) - W * 0.01);
  for (const sx of [-1, 1]) put(ellipsoid(W * 0.022, W * 0.02, W * 0.02, mat(skinTone.clone().multiplyScalar(0.8).getHex())), cx0 + sx * W * 0.032, noseY - W * 0.035, surf(cx0, noseY) + W * 0.002);
  const mz = surf(cx0, mouthY) - W * 0.004, R = W * 0.12, lipMat = mat(face.lip, { roughness: 0.4 });
  if (face.smile === 'open') {
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(R, 20, Math.PI, Math.PI), mat(0x6e2424, { side: THREE.DoubleSide }));
    mouth.scale.y = 0.75; mouth.rotation.y = Math.PI;
    put(mouth, cx0, mouthY + W * 0.045, mz - W * 0.004);
    const teeth = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.55, W * 0.03), white);
    teeth.rotation.y = Math.PI;
    put(teeth, cx0, mouthY + W * 0.039, mz - W * 0.007);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(R, W * 0.012, 6, 20, Math.PI), lipMat);
  smile.rotation.z = Math.PI;
  put(smile, cx0, mouthY + R * (face.smile === 'open' ? 0.48 : 0.38), mz - W * 0.006);
  for (const sx of [-1, 1]) { // mouth corners
    put(ellipsoid(W * 0.013, W * 0.013, W * 0.01, lipMat), cx0 + sx * R, mouthY + R * (face.smile === 'open' ? 0.48 : 0.38) + W * 0.002, mz - W * 0.006);
  }
  if (face.blush) {
    const blush = new THREE.MeshBasicMaterial({ color: 0xff7f8a, transparent: true, opacity: face.blush, depthWrite: false });
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(W * 0.1, 16), blush);
      c.rotation.y = Math.PI;
      put(c, cx0 + sx * W * 0.3, eyeY - W * 0.2, surf(cx0 + sx * W * 0.3, eyeY - W * 0.2) - W * 0.004);
    }
  }

  // --- hair ---
  const hm = mat(face.hair[0], { roughness: 0.8 }), hl = mat(face.hair[1], { roughness: 0.8 });
  const v = (x: number, y: number, z: number) => new THREE.Vector3(cx0 + x * W, eyeY + y * W, zc + z * W);
  if (face.style === 'messy') {
    // swept fringe: a row of flat tufts along the hairline, all combed to the same side
    const hairline = eyeY + W * 0.33;
    for (let i = 0; i < 11; i++) {
      const t = i / 10, x = (t - 0.5) * 0.8;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(W * 0.075, W * (0.26 + 0.07 * Math.sin(i * 2.1)), 6), i % 3 === 0 ? hl : hm);
      tuft.scale.z = 0.45;
      tuft.rotation.z = Math.PI + 0.45 - t * 0.2 + 0.1 * Math.sin(i * 1.7);
      tuft.castShadow = true;
      put(tuft, cx0 + x * W, hairline - W * 0.03, surf(cx0 + x * W, hairline) - W * 0.035);
    }
    // spiky crown: tufts standing up and out, a little different each
    const spikes: [number, number, number, number][] = [[0, -0.1, 0.0, 1], [-0.22, -0.05, 0.4, 0.9], [0.24, -0.05, -0.4, 1.05], [-0.3, 0.12, 0.7, 0.8], [0.32, 0.1, -0.7, 0.85], [0.05, 0.2, 0, 0.9], [-0.1, -0.25, 0.1, 0.8], [0.15, -0.28, -0.2, 0.75]];
    spikes.forEach(([x, z, lean, len], i) => {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(W * 0.09, W * 0.24 * len, 6), i % 2 ? hl : hm);
      sp.rotation.z = -lean * 0.8; sp.rotation.x = z * 1.2;
      sp.castShadow = true;
      put(sp, cx0 + x * W, top - W * 0.1, zc + z * W);
    });
  } else {
    // long, wavy, light-brown hair: a centre-parted fringe sweeping down both cheeks, locks over the shoulders and down the back
    for (const sx of [-1, 1]) {
      const wave = (k: number) => Math.sin(k * 1.7) * 0.11;
      add(lock([v(sx * 0.03, 0.78, -0.32), v(sx * 0.3, 0.62, -0.5), v(sx * 0.5, 0.25, -0.46), v(sx * 0.55, -0.3, -0.34), v(sx * 0.62 + wave(1), -1.0, -0.3), v(sx * 0.64 + wave(2), -1.9, -0.3), v(sx * 0.58 + wave(3), -2.7, -0.27), v(sx * 0.62 + wave(4), -3.4, -0.24)], W * 0.075, W * 0.03, hm));
      // a lighter lock laid over it, falling in front of the shoulder
      add(lock([v(sx * 0.5, 0.3, -0.35), v(sx * 0.62, -0.6, -0.33), v(sx * 0.74, -1.4, -0.31), v(sx * 0.68, -2.2, -0.28), v(sx * 0.74, -3.0, -0.25)], W * 0.05, W * 0.02, hl));
    }
    // back: a crown cap plus wavy locks to the middle of the back
    for (let i = 0; i < 7; i++) {
      const x = (i / 6 - 0.5) * 0.9, d = 0.46 + 0.1 * (1 - Math.abs(x) * 1.6), depth = 3.0 + (i % 2) * 0.5 - Math.abs(x) * 1.2;
      const m = lock([v(x, 0.4, d - 0.2), v(x * 1.15, -0.5, d), v(x * 1.2 + 0.06, -1.4, d + 0.04), v(x * 1.1 - 0.06, -2.2, d + 0.03), v(x * 1.15 + 0.05, -depth * 0.95, d + 0.02), v(x * 1.1, -depth - 0.2, d)], W * 0.1, W * 0.03, i % 3 === 1 ? hl : hm);
      add(m);
    }
  }

  // --- glasses: thin round frames on the eye line, arms back to the ears ---
  if (face.glasses) {
    const frame = mat(0xc9ccd4, { roughness: 0.25, metalness: 0.4 });
    const lens = new THREE.MeshStandardMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
    const r = W * 0.165, gz = (x: number) => surf(x, eyeY) - W * 0.075;
    for (const sx of [-1, 1]) {
      const x = cx0 + sx * cx;
      put(new THREE.Mesh(new THREE.TorusGeometry(r, W * 0.012, 8, 32), frame), x, eyeY, gz(x));
      const l = new THREE.Mesh(new THREE.CircleGeometry(r, 24), lens);
      l.rotation.y = Math.PI;
      put(l, x, eyeY, gz(x) + W * 0.004);
      // arm from the outer edge of the rim back to the ear
      const a = new THREE.Vector3(x + sx * r, eyeY + W * 0.01, gz(x)), b = new THREE.Vector3(cx0 + sx * W * 0.5, eyeY + W * 0.03, zc + W * 0.0);
      add(rod(a, b, W * 0.009, frame));
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(W * 0.05, W * 0.009, 6, 12, Math.PI), frame);
    put(bridge, cx0, eyeY + W * 0.035, gz(cx0));
  }
}
