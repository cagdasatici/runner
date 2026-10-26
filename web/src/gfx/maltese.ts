// "Bella" (and senior "Toby"), a Maltese dog built procedurally (no model file): white long fluffy coat, black button nose and eyes,
// a topknot with a pink bow. Faces -z, paws on y = 0, ~1.1 m tall at the topknot (game scale, like the other animals).
// Animated entirely in code: gallop, jump, crawl (belly down), crash, idle, celebrate (hop + tail wag).
import * as THREE from 'three';
import type { MessKind } from '../core/track';
import type { AnimKey } from './characters';
import { makePoop } from './messes';

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
  private fur: THREE.MeshPhysicalMaterial;
  private furShade: THREE.MeshPhysicalMaterial;
  private furOrig: [THREE.Color, THREE.Color];
  private poopGroup: THREE.Group | null = null;
  private flies: { g: THREE.Group; wings: THREE.Mesh[]; w: number }[] = [];
  private peeGroup: THREE.Group | null = null;
  private drips: THREE.Mesh[] = [];
  private bath: THREE.Group | null = null;
  private bubbles: THREE.Mesh[] = [];

  /** senior: "Toby", a 13-year-old male: creamier coat, no bow, a blue collar with a tag. */
  constructor(opts: { senior?: boolean } = {}) {
    const senior = opts.senior ?? false;
    const fur = this.fur = new THREE.MeshPhysicalMaterial({ color: senior ? 0xf6f0e4 : 0xfbf8f1, roughness: 0.92, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xfff4e0) });
    const furShade = this.furShade = new THREE.MeshPhysicalMaterial({ color: 0xefe8da, roughness: 0.95, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) });
    this.furOrig = [fur.color.clone(), furShade.color.clone()];
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
    if (senior) {
      // blue collar with a gold tag around the neck ruff
      const blue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.3 });
      const collar = mk(new THREE.TorusGeometry(0.2, 0.03, 10, 32), blue, 0, 0.2, -0.38);
      collar.rotation.x = Math.PI / 2 - 0.5;
      this.body.add(collar);
      this.body.add(mk(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16), gold, 0, 0.06, -0.55, 1, 1, 1).rotateX(Math.PI / 2));
    } else {
      // topknot with a pink bow
      h.add(mk(fluffGeo(0.08, 7, 0.3, 20, 14), fur, 0, 0.27, 0.0, 1, 1.4, 1));
      for (const x of [-1, 1]) {
        const loop = mk(new THREE.ConeGeometry(0.06, 0.12, 16), pink, 0.065 * x, 0.25, -0.02);
        loop.rotation.z = (Math.PI / 2) * x;
        h.add(loop);
      }
      h.add(mk(new THREE.SphereGeometry(0.03, 12, 8), pink, 0, 0.25, -0.03));
    }

    // plumed tail curled up over the back
    this.tail.position.set(0, 0.2, 0.48);
    this.body.add(this.tail);
    [[0, 0.06, 0.04, 0.09], [0, 0.16, 0.0, 0.1], [0, 0.22, -0.1, 0.1]].forEach(([x, y, z, r], i) =>
      this.tail.add(mk(fluffGeo(r, 30 + i, 0.3, 20, 14), fur, x, y, z, 1, 1, 1.2)));
  }

  /** The head group, for the reaction close-up camera. */
  get headObject(): THREE.Object3D { return this.head; }

  /** Shows the mess on the dog (poop on the head, or yellow fur and drips); null cleans it all up and restores the fur. */
  setMess(kind: MessKind | null): void {
    if (kind === 'poop' && !this.poopGroup) this.poopGroup = this.buildPoop();
    if (kind === 'pee' && !this.peeGroup) this.peeGroup = this.buildPee();
    if (this.poopGroup) this.poopGroup.visible = kind === 'poop';
    if (this.peeGroup) this.peeGroup.visible = kind === 'pee';
    if (kind === 'pee') {
      const yellow = new THREE.Color(0xf2df74);
      this.fur.color.lerpColors(this.furOrig[0], yellow, 0.55);
      this.furShade.color.lerpColors(this.furOrig[1], yellow, 0.55);
    } else {
      this.fur.color.copy(this.furOrig[0]);
      this.furShade.color.copy(this.furOrig[1]);
    }
    if (kind === null && this.bath) this.bath.visible = false;
  }

  private buildPoop(): THREE.Group {
    const g = new THREE.Group();
    const top = makePoop(0.45);
    top.position.set(0, 0.2, 0);
    top.rotation.z = 0.25;
    g.add(top);
    const m = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.55 });
    ([[-0.09, -0.04, -0.3, 0.05], [0.1, -0.1, -0.26, 0.04], [0.0, 0.0, -0.215, 0.06]] as const).forEach(([x, y, z, r]) => {
      const sp = mk(new THREE.SphereGeometry(r, 12, 8), m, x, y, z, 1, 1, 0.4);
      g.add(sp);
    });
    const fly = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const wing = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Group();
      f.add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), fly));
      const wings = [-1, 1].map((x) => {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.02), wing);
        w.position.set(0.015 * x, 0.012, 0);
        w.rotation.x = -Math.PI / 2;
        f.add(w);
        return w;
      });
      g.add(f);
      this.flies.push({ g: f, wings, w: [7, -9, 11][i] });
    }
    this.head.add(g);
    return g;
  }

  private buildPee(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2d43a, roughness: 0.1, transparent: true, opacity: 0.9 });
    const geo = new THREE.SphereGeometry(0.03, 10, 8);
    ([[-0.14, -0.3, -0.3], [0.14, -0.3, -0.3], [-0.12, -0.32, 0.3], [0.12, -0.32, 0.3]] as const).forEach(([x, y, z]) => {
      const d = new THREE.Mesh(geo, mat);
      d.position.set(x, y, z);
      d.userData.base = y;
      g.add(d);
      this.drips.push(d);
    });
    this.body.add(g);
    return g;
  }

  private buildBath(): THREE.Group {
    const g = new THREE.Group();
    const tubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, side: THREE.DoubleSide });
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.52, 0.36, 28, 1, true), tubMat);
    tub.position.y = 0.18;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.52, 28).rotateX(-Math.PI / 2), tubMat);
    floor.position.y = 0.01;
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.58, 28).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.1, transparent: true, opacity: 0.7 }));
    water.position.y = 0.3;
    g.add(tub, floor, water);
    const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 + (i % 3) * 0.025, 12, 8), bm);
      const a = i * 2.4;
      b.userData = { x: Math.cos(a) * 0.4 * ((i % 4) / 4 + 0.4), z: Math.sin(a) * 0.4 * ((i % 4) / 4 + 0.4), off: i / 8 };
      g.add(b);
      this.bubbles.push(b);
    }
    this.root.add(g);
    return g;
  }

  /** Per-frame life of the mess: flies orbit, drips slide, and in the last 15 % of the time the dog sits in a bubble bath. */
  updateMess(t: number, left01: number): void {
    if (this.poopGroup?.visible) {
      this.flies.forEach((f, i) => {
        const a = t * f.w + i * 2.1;
        f.g.position.set(Math.cos(a) * 0.28, 0.05 + 0.06 * Math.sin(t * 5 + i), Math.sin(a) * 0.28);
        const flap = 0.5 + 0.5 * Math.abs(Math.sin(t * 60));
        f.wings.forEach((w) => { w.scale.y = flap; });
      });
    }
    if (this.peeGroup?.visible) {
      for (const d of this.drips) {
        const k = ((t + (d.position.x > 0 ? 0.3 : 0)) % 0.6) / 0.6;
        d.position.y = (d.userData.base as number) - 0.15 * k;
        d.scale.setScalar(1 - 0.5 * k);
      }
    }
    const bathing = left01 < 0.15 && left01 > 0;
    if (bathing && !this.bath) this.bath = this.buildBath();
    if (this.bath) {
      this.bath.visible = bathing;
      if (bathing) {
        for (const b of this.bubbles) {
          const k = (t * 0.8 + (b.userData.off as number)) % 1;
          b.position.set(b.userData.x as number, 0.3 + k * 0.55, b.userData.z as number);
          b.scale.setScalar(k > 0.85 ? 0 : 1);
        }
      }
    }
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
