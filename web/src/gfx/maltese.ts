// "Bella", a Maltese dog built procedurally (no model file): white long fluffy coat, black button nose and eyes,
// a topknot with a pink bow. Faces -z, paws on y = 0, ~1.1 m tall at the topknot (game scale, like the other animals).
// Animated entirely in code: gallop, jump, crawl (belly down), crash, idle, celebrate (hop + tail wag).
import * as THREE from 'three';
import type { AnimKey } from './characters';

export type ProcKey = AnimKey | 'celebrate';

/** A code-animated character (no glTF clips). RunnerFigure calls animate() every frame after choosing the key. */
export interface ProceduralRig {
  readonly root: THREE.Group;
  /** t: seconds since start; phase: run cycle in radians; vy: vertical speed (jump up/down). */
  animate(key: ProcKey, t: number, phase: number, vy: number): void;
}

/** Deterministic hash noise in [-1, 1] (no Math.random so the dog looks the same every load). */
function noise(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Smooth sphere whose surface is pushed out in soft tufts: reads as long fluffy fur under lighting. */
export function fluffGeo(r: number, seed: number, amount = 0.12, w = 40, h = 28): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, w, h);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    // two octaves of low-frequency tufts plus strands hanging downwards
    const tuft = Math.sin(n.x * 7 + seed) * Math.sin(n.y * 6 + seed * 2) * Math.sin(n.z * 7 - seed) * 0.6
      + noise(Math.round(n.x * 5), Math.round(n.y * 5), Math.round(n.z * 5), seed) * 0.4;
    v.multiplyScalar(1 + amount * (0.5 + 0.5 * tuft));
    if (n.y < 0) v.y += n.y * r * amount * 0.8; // coat hangs down
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
};

export class MalteseFigure implements ProceduralRig {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private ears: THREE.Group[] = [];
  private legs: THREE.Group[] = []; // FL, FR, BL, BR
  private tail = new THREE.Group();
  private tongue: THREE.Mesh;
  private lids: THREE.Mesh[] = [];

  constructor() {
    const fur = new THREE.MeshPhysicalMaterial({ color: 0xfbf8f1, roughness: 0.92, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xfff4e0) });
    const furShade = new THREE.MeshPhysicalMaterial({ color: 0xefe8da, roughness: 0.95, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) });
    const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 0.18, metalness: 0 });
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pink = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.45 });
    const tongueMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.5 });
    const pad = new THREE.MeshStandardMaterial({ color: 0x3f3a3a, roughness: 0.8 });

    this.root.add(this.body);
    this.body.position.y = 0.62;
    // torso + long coat skirt hanging towards (not into) the ground
    this.body.add(mk(fluffGeo(0.3, 1, 0.14), fur, 0, 0, 0, 1.15, 1.0, 1.75));
    this.body.add(mk(fluffGeo(0.3, 2, 0.2, 36, 24), furShade, 0, -0.17, 0.02, 1.25, 0.6, 1.8));
    this.body.add(mk(fluffGeo(0.24, 3, 0.15), fur, 0, 0.1, -0.36, 1.05, 1.0, 1.0)); // chest ruff

    // legs: hip pivot → fluffy leg → paw (paw bottom at y = 0 when straight)
    const legY = -0.24, legLen = 0.38;
    ([[-0.16, -0.34], [0.16, -0.34], [-0.17, 0.34], [0.17, 0.34]] as const).forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.position.set(x, legY, z);
      g.add(mk(new THREE.CapsuleGeometry(0.085, legLen - 0.17, 8, 20), fur, 0, -legLen / 2 + 0.02, 0));
      g.add(mk(fluffGeo(0.1, 10 + i, 0.18, 24, 16), fur, 0, -legLen + 0.06, -0.02, 1, 0.75, 1.15)); // furry paw
      g.add(mk(new THREE.SphereGeometry(0.035, 12, 8), pad, 0, -legLen + 0.0, -0.1, 1, 0.5, 1));
      this.body.add(g);
      this.legs.push(g);
    });

    // head
    const h = this.head;
    h.position.set(0, 0.3, -0.5);
    this.body.add(h);
    h.add(mk(fluffGeo(0.24, 5, 0.12), fur));
    h.add(mk(fluffGeo(0.13, 6, 0.15, 28, 20), fur, 0, -0.07, -0.2, 1.1, 0.85, 1.1)); // muzzle
    h.add(mk(new THREE.SphereGeometry(0.052, 20, 14), black, 0, -0.02, -0.34, 1.2, 0.9, 0.9)); // nose
    h.add(mk(new THREE.SphereGeometry(0.014, 8, 6), shine, -0.015, 0.0, -0.385));
    const smile = mk(new THREE.CapsuleGeometry(0.012, 0.06, 4, 8), black, 0, -0.13, -0.29);
    smile.rotation.z = Math.PI / 2;
    h.add(smile);
    this.tongue = mk(new THREE.SphereGeometry(0.045, 16, 10), tongueMat, 0, -0.16, -0.27, 1, 0.5, 1.3);
    h.add(this.tongue);
    for (const x of [-0.1, 0.1]) {
      h.add(mk(new THREE.SphereGeometry(0.046, 20, 14), black, x, 0.05, -0.2)); // big round eyes
      h.add(mk(new THREE.SphereGeometry(0.015, 8, 6), shine, x - 0.015, 0.07, -0.243));
      const lid = mk(new THREE.SphereGeometry(0.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), fur, x, 0.05, -0.2);
      lid.visible = false; // blinks
      h.add(lid);
      this.lids.push(lid);
    }
    // long silky ears hanging down the sides
    for (const x of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(0.19 * x, 0.08, -0.02);
      e.add(mk(fluffGeo(0.1, 20 + x, 0.25, 24, 18), fur, 0.02 * x, -0.17, 0, 0.8, 2.0, 0.9));
      h.add(e);
      this.ears.push(e);
    }
    // topknot with a pink bow
    h.add(mk(fluffGeo(0.08, 7, 0.3, 20, 14), fur, 0, 0.27, 0.0, 1, 1.4, 1));
    for (const x of [-1, 1]) {
      const loop = mk(new THREE.ConeGeometry(0.06, 0.12, 16), pink, 0.065 * x, 0.25, -0.02);
      loop.rotation.z = (Math.PI / 2) * x;
      h.add(loop);
    }
    h.add(mk(new THREE.SphereGeometry(0.03, 12, 8), pink, 0, 0.25, -0.03));

    // plumed tail curled up over the back
    this.tail.position.set(0, 0.2, 0.48);
    this.body.add(this.tail);
    [[0, 0.06, 0.04, 0.09], [0, 0.16, 0.0, 0.1], [0, 0.22, -0.1, 0.1]].forEach(([x, y, z, r], i) =>
      this.tail.add(mk(fluffGeo(r, 30 + i, 0.3, 20, 14), fur, x, y, z, 1, 1, 1.2)));
  }

  animate(key: ProcKey, t: number, phase: number, vy: number): void {
    const b = this.body, L = this.legs;
    b.position.set(0, 0.62, 0);
    b.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.head.position.set(0, 0.3, -0.5);
    this.tongue.visible = true;
    let legs: [number, number, number, number] = [0, 0, 0, 0];
    let tailPitch = -0.3, wag = Math.sin(t * 9) * 0.35, earLift = 0, earFlap = Math.sin(t * 5) * 0.05;
    const blink = (t % 3.2) < 0.12;

    switch (key) {
      case 'run': case 'stumble': {
        // rotary gallop: fronts lead backs by half a beat; body rocks and bobs, ears flop with a lag
        const f = Math.sin(phase), bk = Math.sin(phase + Math.PI * 0.6);
        legs = [f * 0.9, Math.sin(phase + 0.5) * 0.9, -bk * 0.9, -Math.sin(phase + Math.PI * 0.6 + 0.5) * 0.9];
        b.position.y += Math.abs(Math.cos(phase)) * 0.07;
        b.rotation.x = Math.sin(phase) * 0.08;
        this.head.rotation.x = -Math.sin(phase) * 0.08;
        earLift = Math.max(0, Math.sin(phase - 0.8)) * 0.5;
        wag = Math.sin(t * 14) * 0.45;
        if (key === 'stumble') b.rotation.z = Math.sin(t * 38) * 0.15;
        break;
      }
      case 'jump': case 'fly': {
        const up = vy > 0 || key === 'fly';
        legs = up ? [1.1, 1.0, -1.0, -1.1] : [0.6, 0.5, -0.5, -0.6]; // superman stretch
        b.rotation.x = up ? 0.15 : -0.12;
        earLift = up ? 0.9 : -0.2;
        wag = Math.sin(t * 16) * 0.2;
        break;
      }
      case 'slide': {
        // crawl: belly on the track, front legs reaching forward, back legs out behind, head low and forward
        b.position.y = 0.46;
        legs = [1.35 + Math.sin(t * 22) * 0.12, 1.35 - Math.sin(t * 22) * 0.12, -1.35, -1.35];
        this.head.position.set(0, 0.1, -0.58); // chin low, stretched forward
        this.head.rotation.x = 0.1;
        earLift = 0.6;
        wag = Math.sin(t * 20) * 0.25;
        tailPitch = 1.6; // tail streams out flat behind
        this.tongue.visible = false;
        break;
      }
      case 'crash': {
        b.rotation.z = 1.5; // flopped on the side, paws in the air
        b.position.y = 0.4;
        legs = [-0.4, 0.3, 0.4, -0.3];
        wag = 0;
        this.lids.forEach((l) => { l.visible = true; });
        break;
      }
      case 'celebrate': {
        // happy hops with a spin every other hop, super-fast wag, ears flying
        const hop = Math.abs(Math.sin(t * Math.PI * 2.2));
        b.position.y += hop * 0.35;
        legs = [0.6 * hop, 0.6 * hop, -0.3 * hop, -0.3 * hop];
        b.rotation.x = 0.25 * hop; // rear up a bit: front paws in the air
        this.head.rotation.z = Math.sin(t * 6) * 0.2;
        earLift = hop * 0.8;
        wag = Math.sin(t * 28) * 0.6;
        break;
      }
      default: { // idle / board: breathe, tilt head, wag
        b.position.y += Math.sin(t * 3) * 0.008;
        this.head.rotation.z = Math.sin(t * 0.9) * 0.15;
        break;
      }
    }
    for (let i = 0; i < 4; i++) L[i].rotation.x = legs[i];
    this.tail.rotation.set(tailPitch, wag, wag * 0.3);
    this.ears.forEach((e, i) => { e.rotation.z = (i ? 1 : -1) * (earLift * 0.7 + earFlap); });
    if (key !== 'crash') this.lids.forEach((l) => { l.visible = blink; });
  }
}
