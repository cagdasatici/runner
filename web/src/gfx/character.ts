// The runner: a CC0 rigged glTF character (see docs/ASSETS.md) driven by the deterministic RunnerState.
// Animation clips are chosen by the pure animFor() (characters.ts) and cross-faded with THREE.AnimationMixer.
// Faces -z (the running direction); feet at state.y. Until a model has loaded (or if loading fails) a primitive figure is shown.
import { addFace } from './face';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Runner, startState, type RunnerState } from '../core/runner';
import { laneX } from '../core/track';
import { animFor, characterById, CHARACTERS, type AnimKey, type CharacterDef } from './characters';
import type { Materials } from './materials';
import { PrimitiveFigure } from './primitiveFigure';
import { dotTexture } from './textures';
import { fitClearance } from './clearance';
import { MalteseFigure, type ProceduralRig, type ProcKey } from './maltese';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FADE = 0.14; // seconds of cross-fade between clips
const AIR_TIME = 0.6; // jump airtime: 2 * jumpVelocity / gravity
const BOARD_LIFT = 0.17; // the runner stands on the hoverboard deck
const STUMBLE_TIME = 0.55;
const SLIDE_PHASE = 0.3; // fraction of the Run clip frozen during a slide: one leg forward, one back
const SLIDE_LEAN = 1.15; // rad the humanoid leans back during a slide (feet first, head behind)

/** Run state plus the power-up fields the core may carry (all optional). */
type FigureState = RunnerState & { board?: number; fly?: number; stumbles?: number };

interface Entry {
  def: CharacterDef;
  model: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  footprint: number; // half-length of the shadow blob
  proc?: ProceduralRig; // code-animated character (no clips)
  bones: { head?: THREE.Object3D; tails: THREE.Object3D[]; arms: THREE.Object3D[] };
}

const CELEBRATE_HOP = 2.2; // hops per second
const ARM_AXIS = 'x'; // UpperArm.L/R bones of the adventurer rig: local x swings the arm forward and up
const ARM_UP = -3.5; // tuned from screenshots: arms overhead
const _box = new THREE.Box3();

const ONCE: ReadonlySet<AnimKey> = new Set(['jump', 'slide', 'crash', 'stumble']);
const loader = new GLTFLoader();
const gltfCache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>();

function loadGltf(url: string) {
  let p = gltfCache.get(url);
  if (!p) {
    p = loader.loadAsync(url);
    p.catch(() => gltfCache.delete(url)); // allow a retry after a failed load
    gltfCache.set(url, p);
  }
  return p;
}

export class RunnerFigure {
  /** Add this to the scene. Identity transform; contains the posed rig, the shadow blob and the fallback. */
  readonly root = new THREE.Group();
  /** Positioned at the feet (state.x, y, -z) with lane lean. Power-up visuals (board) attach here. */
  readonly rig = new THREE.Group();
  /** Pitched/squashed procedurally on top of the clip. The jetpack attaches here. */
  readonly pivot = new THREE.Group();
  private fallback: PrimitiveFigure;
  private shadow: THREE.Mesh;
  private entries = new Map<string, Entry>();
  private current: Entry | null = null;
  private wanted: CharacterDef;
  private key: AnimKey | null = null;
  private action: THREE.AnimationAction | null = null;
  private stumbleT = 0;
  private lastStumbles = 0;
  private lastSlide = 0;
  private pop = 1; // 0 → 1 scale-in after switching character
  private pitch = 0;
  private squash = 1;
  private t = 0;
  /** Called after a character swap finished loading (UI may want to react). */
  onReady: (() => void) | null = null;

  constructor(m: Materials, id: string) {
    this.wanted = characterById(id);
    this.fallback = new PrimitiveFigure(m);
    const mat = new THREE.MeshBasicMaterial({ map: dotTexture(), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.rig.add(this.pivot);
    this.root.add(this.rig, this.shadow, this.fallback.root);
    this.setCharacter(id);
  }

  get characterId(): string { return this.wanted.id; }

  /** Switches the character (loads the model on first use; the old one stays until the new one is ready). */
  setCharacter(id: string): void {
    const def = characterById(id);
    this.wanted = def;
    const cached = this.entries.get(def.id);
    if (cached) { this.swapTo(cached); return; }
    void this.load(def).then((e) => { if (e && this.wanted.id === def.id) this.swapTo(e); });
  }

  /** Fetches every model in the background so switching is instant. */
  preloadAll(): void { for (const c of CHARACTERS) void this.load(c); }

  /** Forget animation state at the start of a run. */
  reset(): void { this.key = null; this.stumbleT = 0; this.lastStumbles = 0; this.pitch = 0; this.squash = 1; }

  private async load(def: CharacterDef): Promise<Entry | null> {
    const have = this.entries.get(def.id);
    if (have) return have;
    if (def.procedural) {
      const fig = new MalteseFigure({ senior: def.procedural === 'maltese-senior' });
      const wrap = new THREE.Group();
      wrap.add(fig.root);
      fig.animate('idle', 0, 0, 0);
      const box = new THREE.Box3().setFromObject(fig.root);
      wrap.scale.setScalar(def.height / Math.max(0.01, box.max.y - box.min.y));
      const entry: Entry = { def, model: wrap, mixer: new THREE.AnimationMixer(wrap), actions: new Map(), footprint: 0.6, proc: fig, bones: { tails: [], arms: [] } };
      this.entries.set(def.id, entry);
      return entry;
    }
    try {
      const gltf = await loadGltf(import.meta.env.BASE_URL + def.model);
      const again = this.entries.get(def.id);
      if (again) return again;
      const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      model.rotation.y = def.yaw;
      for (const name of def.hide ?? []) model.getObjectByName(name)?.removeFromParent();
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.frustumCulled = false; // skinned bounds are unreliable
        mesh.geometry = smoothGeometry(mesh.geometry);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.material = Array.isArray(mesh.material) ? mats.map((x) => this.prepMaterial(x, def)) : this.prepMaterial(mats[0], def);
      });
      // scale to the target height and stand the feet on y = 0 (measured on the bind pose)
      const wrap = new THREE.Group();
      wrap.add(model);
      wrap.updateMatrixWorld(true);
      model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update(); });
      const box = new THREE.Box3().setFromObject(model, true);
      const k = def.height / Math.max(0.01, box.max.y - box.min.y);
      wrap.scale.setScalar(k);
      model.position.y = -box.min.y;
      if (def.beardless) removeBeard(model, wrap);
      if (def.extras?.length) addHeadExtras(model, wrap, def.extras);
      if (def.face) void addFace(model, wrap, def.face)?.upgrade().catch((e) => { console.warn('face photo failed', e); /* keep the hand-built face */ });
      if (def.bigHead) model.traverse((o) => { if ((o as THREE.Bone).isBone && o.name === 'Head') o.scale.multiplyScalar(def.bigHead!); });
      const mixer = new THREE.AnimationMixer(model);
      const actions = new Map<string, THREE.AnimationAction>();
      for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
      const bones: Entry['bones'] = { tails: [], arms: [] };
      model.traverse((o) => {
        if (!(o as THREE.Bone).isBone) return;
        if (o.name === 'Head') bones.head = o;
        else if (/^Tail\d*$/.test(o.name)) bones.tails.push(o);
        else if (/^UpperArm\.?[LR]$/.test(o.name) /* GLTFLoader strips the dot: UpperArmL */) bones.arms.push(o);
      });
      const entry: Entry = { def, model: wrap, mixer, actions, footprint: Math.max(0.5, (box.max.z - box.min.z) * k * 0.55), bones };
      this.entries.set(def.id, entry);
      return entry;
    } catch (err) {
      console.warn('model failed to load', def.id, err);
      return null;
    }
  }

  private prepMaterial(src: THREE.Material, def: CharacterDef): THREE.Material {
    const mat = src.clone() as THREE.MeshStandardMaterial;
    if ('metalness' in mat) { mat.metalness = 0; mat.roughness = Math.max(0.65, mat.roughness); }
    if (def.tint !== undefined && mat.color) mat.color.multiply(new THREE.Color(def.tint));
    const re = def.recolor?.[src.name];
    if (re !== undefined && mat.color) mat.color.set(re);
    return mat;
  }

  private swapTo(e: Entry): void {
    if (this.current === e) return;
    if (this.current) this.pivot.remove(this.current.model);
    this.current = e;
    this.pivot.add(e.model);
    this.fallback.root.visible = false;
    this.key = null; // restart the clip choice for the new rig
    this.action = null;
    this.pop = 0;
    this.onReady?.();
  }

  /** Poses the figure for this frame from the game state. `dt` advances the animation; `speed` is the run speed in m/s. */
  pose(state: RunnerState, dt = 0, speed: number = Runner.startSpeed): void {
    const s = state as FigureState;
    const e = this.current;
    if (!e) {
      this.fallback.root.visible = true;
      this.fallback.pose(s);
      this.setShadow(s.x, s.y, -s.z, 0.8);
      return;
    }
    // stumble: the core counts them; show a short reaction each time the count goes up
    const st = s.stumbles ?? 0;
    if (st > this.lastStumbles) this.stumbleT = STUMBLE_TIME;
    this.lastStumbles = st;
    this.stumbleT = Math.max(0, this.stumbleT - dt);
    const key = s.crashed ? 'crash' : animFor(s, this.stumbleT > 0);
    this.t += dt;

    const board = (s.board ?? 0) > 0 && key !== 'crash' && (s.fly ?? 0) <= 0 && ((s as { descend?: number }).descend ?? 0) <= 0;
    this.rig.position.set(s.x, s.y + (board ? BOARD_LIFT : 0), -s.z);
    this.rig.rotation.z = Math.max(-0.35, Math.min(0.35, -(laneX(s.lane) - s.x) * 0.18));
    this.lastSlide = s.slideTicks;
    this.unnudge();
    this.play(e, key, s, speed);
    e.mixer.update(dt);
    const phase = (s.z / 2.4) * 2 * Math.PI;
    e.proc?.animate(key, this.t, phase, s.vy);
    this.secondary(e, key, phase);

    // procedural layer: pitch and squash ease toward the target of the current animation
    let pitch = 0, squash = 1, roll = 0;
    const tuck = e.def.slide === 'tuck';
    const humanoid = e.def.id === 'adventurer';
    // crouch: squash toward the feet and lean slightly forward; no big pitch, which tipped animals nose-down about their feet
    if (key === 'slide' && e.proc) { pitch = 0; squash = 1; } // the rig has its own belly-down crawl
    else if (key === 'slide' && tuck && humanoid) { pitch = SLIDE_LEAN; squash = 1; }
    else if (key === 'slide' && tuck) { pitch = -0.08; squash = 0.6; }
    else if (key === 'fly') { pitch = -0.95 + Math.sin(this.t * 6) * 0.05; }
    else if (key === 'board') { pitch = -0.1; squash = 0.94; }
    else if (key === 'jump') { squash = s.vy > 0 ? 1.04 : 0.97; }
    if (key === 'stumble' && !e.def.clips.stumble) roll = Math.sin(this.t * 38) * 0.18;
    const a = dt > 0 ? 1 - Math.exp(-dt * (key === 'slide' || this.pitch > 0.3 ? 11 : 16)) : 1;
    this.pitch += (pitch - this.pitch) * a;
    this.squash += (squash - this.squash) * a;
    this.pop = Math.min(1, this.pop + dt * 5);
    const pop = this.pop < 1 ? 1 + Math.sin(this.pop * Math.PI) * 0.12 - (1 - this.pop) * 0.5 : 1;
    this.pivot.rotation.set(this.pitch, 0, roll);
    this.pivot.scale.set(pop, pop * this.squash, pop);
    this.pivot.position.y = 0;
    if (key === 'slide') this.fitUnderBar(e);
    this.setShadow(s.x, s.y, -s.z, e.footprint);
  }

  /**
   * Crawl fix shared by every character: measures the posed mesh and squashes/lifts the pivot so nothing sinks
   * below the track and the top stays under the slide hitbox (see clearance.ts). Runs only while sliding.
   */
  private fitUnderBar(e: Entry): void {
    for (let i = 0; i < 2; i++) { // second pass: a pitched pivot scales along its own axis, so re-measure once
      this.measure(e);
      const base = this.rig.position.y + this.pivot.position.y;
      const { f } = fitClearance(_box.min.y - base, _box.max.y - base);
      this.pivot.scale.y *= f;
    }
    this.measure(e);
    const lo = _box.min.y - this.rig.position.y;
    this.pivot.position.y = Math.max(0, -lo);
  }

  private measure(e: Entry): void {
    this.root.updateMatrixWorld(true);
    e.model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update(); });
    _box.setFromObject(e.model, true);
  }

  /** Secondary motion on top of the clips: tail wag, head bob. Deltas are undone before the next mixer update. */
  private secondary(e: Entry, key: ProcKey, phase: number): void {
    if (e.proc) return;
    const wagSpeed = key === 'celebrate' ? 26 : key === 'run' ? 14 : 6;
    const wagAmp = key === 'crash' ? 0 : key === 'celebrate' ? 0.5 : 0.25;
    e.bones.tails.forEach((b, i) => this.nudge(b, 'y', Math.sin(this.t * wagSpeed - i * 0.6) * wagAmp / (1 + i * 0.3)));
    if (e.bones.head && key === 'run') this.nudge(e.bones.head, 'x', Math.sin(phase * 2) * 0.06);
  }

  private nudges: Array<[THREE.Object3D, 'x' | 'y' | 'z', number]> = [];
  private nudge(o: THREE.Object3D, axis: 'x' | 'y' | 'z', v: number): void {
    o.rotation[axis] += v;
    this.nudges.push([o, axis, v]);
  }
  /** Undo last frame's additive bone rotations (bones without an animation track would otherwise accumulate). */
  private unnudge(): void {
    for (const [o, axis, v] of this.nudges) o.rotation[axis] -= v;
    this.nudges.length = 0;
  }

  /**
   * Finish-line celebration. `t` = seconds since the finish line was crossed; call every frame instead of pose().
   * Humanoids throw both arms up, hop and spin once; animals hop and wag; the Maltese hops, rears up and wags.
   * Pass the run state to keep the figure where the runner is (otherwise it stays where it was last posed).
   */
  celebrate(t: number, dt = 0, state?: RunnerState): void {
    const e = this.current;
    if (state) { this.rig.position.set(state.x, state.y, -state.z); this.setShadow(state.x, state.y, -state.z, e?.footprint ?? 0.8); }
    this.rig.rotation.set(0, 0, 0);
    if (!e) return;
    this.t += dt;
    this.unnudge();
    if (this.key !== 'idle') {
      const idle = e.actions.get(e.def.clips.idle ?? '');
      if (idle) {
        this.action?.fadeOut(FADE);
        idle.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveTimeScale(1.4).fadeIn(FADE).play();
        this.action = idle;
      }
      this.key = 'idle';
    }
    e.mixer.update(dt);
    e.proc?.animate('celebrate', t, 0, 0);
    this.secondary(e, 'celebrate', 0);
    const up = Math.min(1, t / 0.25); // ease the arms up
    e.bones.arms.forEach((b) => this.nudge(b, ARM_AXIS, ARM_UP * up));
    const hop = e.proc ? 0 : Math.abs(Math.sin(t * Math.PI * CELEBRATE_HOP)) * 0.35;
    const spinT = Math.min(1, t / 0.9);
    const spin = spinT * spinT * (3 - 2 * spinT) * Math.PI * 2; // one smooth full turn
    this.pitch = 0; this.squash = 1;
    this.pivot.rotation.set(0, spin, 0);
    this.pivot.scale.setScalar(1);
    this.pivot.position.y = hop;
  }

  /** Menu preview: the selected character idling at the origin, turning gently towards the camera. */
  menuPose(time: number, dt: number): void {
    const s = startState();
    const e = this.current;
    if (!e) { this.pose(s, dt); return; }
    this.rig.position.set(0, 0, 0);
    this.rig.rotation.set(0, Math.sin(time * 0.8) * 0.45, 0); // the model faces -z, i.e. the menu camera
    this.pivot.position.y = 0;
    this.key = null;
    const idle = e.actions.get(e.def.clips.idle ?? '');
    if (idle && this.action !== idle) {
      this.action?.fadeOut(FADE);
      idle.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveTimeScale(1).fadeIn(FADE).play();
      this.action = idle;
    }
    this.pop = Math.min(1, this.pop + dt * 5);
    const pop = this.pop < 1 ? 1 + Math.sin(this.pop * Math.PI) * 0.12 - (1 - this.pop) * 0.5 : 1;
    this.pitch = 0; this.squash = 1;
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.scale.setScalar(pop);
    e.mixer.update(dt);
    this.setShadow(0, 0, 0, e.footprint);
  }

  private play(e: Entry, key: AnimKey, s: FigureState, speed: number): void {
    const clips = e.def.clips;
    // keys without their own clip borrow another one
    const name = clips[key] ?? (key === 'slide' ? clips.run : key === 'stumble' ? clips.run : clips.run);
    const next = name ? e.actions.get(name) : undefined;
    if (!next) return;
    if (key !== this.key) {
      const prev = this.action;
      next.reset();
      const once = ONCE.has(key) && !!clips[key];
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = once;
      if (prev && prev !== next) { prev.fadeOut(FADE); next.fadeIn(FADE); } else next.fadeIn(0.05);
      next.play();
      if (key === 'slide' && !clips.slide && e.def.id === 'adventurer') next.time = next.getClip().duration * SLIDE_PHASE;
      this.key = key;
      this.action = next;
    }
    const dur = next.getClip().duration;
    let rate = 1;
    switch (key) {
      case 'run': rate = e.def.runSpeed * (speed / Runner.startSpeed); break;
      case 'jump': rate = clips.jump === clips.run ? 0.3 : dur / AIR_TIME; break;
      case 'slide': rate = clips.slide ? dur / (Runner.slideDuration * Runner.dt) : e.def.id === 'adventurer' ? 0 : e.def.runSpeed * 1.4; break;
      case 'crash': rate = Math.max(1, dur / 0.6); break;
      case 'stumble': rate = clips.stumble ? dur / STUMBLE_TIME : e.def.runSpeed; break;
      case 'fly': rate = clips.fly === clips.run ? 0.2 : 0.8; break;
      case 'board': rate = 0.9; break;
      default: break;
    }
    next.setEffectiveTimeScale(rate);
    void s;
  }

  private setShadow(x: number, y: number, z: number, size: number): void {
    const k = 1 / (1 + y * 0.9);
    this.shadow.position.set(x, 0.03, z);
    this.shadow.scale.set(size * 1.1 * k, size * 1.6 * k, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.4 * k;
  }
}

/** Welds the low-poly faces (glTF exports split vertices per face) and recomputes normals: smooth shading. */
function smoothGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  try {
    const src = g.clone();
    src.deleteAttribute('normal');
    const merged = mergeVertices(src, 1e-4);
    merged.computeVertexNormals();
    return merged;
  } catch {
    return g; // unexpected attribute layout: keep the original faceted mesh
  }
}

/** Builds glasses / long hair in world space around the bind-pose head mesh, then parents them to the Head bone. */
function addHeadExtras(model: THREE.Group, wrap: THREE.Group, extras: NonNullable<CharacterDef['extras']>): void {
  const headMesh = model.getObjectByName('Adventurer_Head');
  let bone: THREE.Object3D | undefined;
  model.traverse((o) => { if ((o as THREE.Bone).isBone && o.name === 'Head') bone = o; });
  if (!headMesh || !bone) return;
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(headMesh, true);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const w = size.x, h = size.y, front = box.min.z; // the model faces -z
  // built in world units on an unscaled scratch parent, then attach() keeps that world transform under the bone
  const place = (m: THREE.Object3D, x: number, y: number, z: number, to: THREE.Object3D = bone!) => { m.position.set(x, y, z); new THREE.Group().add(m); m.updateMatrixWorld(true); to.attach(m); };
  if (extras.includes('dress')) {
    const legs = model.getObjectByName('Adventurer_Legs');
    let hips: THREE.Object3D | undefined;
    model.traverse((o) => { if ((o as THREE.Bone).isBone && o.name === 'Hips') hips = o; });
    if (legs && hips) {
      const lb = new THREE.Box3().setFromObject(legs, true), lh = lb.max.y - lb.min.y, r = (lb.max.x - lb.min.x) * 0.5;
      const top = lb.max.y + lh * 0.02, bottom = lb.max.y - lh * 0.5;
      // flared A-line skirt: waist -> knee
      const pts = [[r * 0.8, top], [r * 1.0, top - (top - bottom) * 0.25], [r * 1.5, top - (top - bottom) * 0.65], [r * 1.85, bottom]].map(([x, y]) => new THREE.Vector2(x, y));
      const skirt = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ color: 0x5b7db1, roughness: 0.7, side: THREE.DoubleSide }));
      skirt.castShadow = true;
      const hem = new THREE.Mesh(new THREE.TorusGeometry(r * 1.85, r * 0.07, 6, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
      hem.rotation.x = Math.PI / 2;
      hem.position.y = bottom;
      skirt.add(hem);
      place(skirt, (lb.max.x + lb.min.x) / 2, 0, (lb.max.z + lb.min.z) / 2, hips);
    }
  }
}

/** Drops the Hair triangles on the lower front of the face (the beard), measured on the bind pose in world space. */
function removeBeard(model: THREE.Group, wrap: THREE.Group): void {
  const head = model.getObjectByName('Adventurer_Head');
  if (!head) return;
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(head, true);
  const cutY = box.min.y + (box.max.y - box.min.y) * 0.5, midZ = (box.min.z + box.max.z) / 2;
  head.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh || (mesh.material as THREE.Material).name !== 'Hair') return;
    const g = mesh.geometry, pos = g.attributes.position as THREE.BufferAttribute;
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const v = new THREE.Vector3(), keep: number[] = [];
    for (let t = 0; t < idx.length; t += 3) {
      let y = 0, z = 0;
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, idx[t + k]); mesh.applyBoneTransform?.(idx[t + k], v); v.applyMatrix4(mesh.matrixWorld); y += v.y / 3; z += v.z / 3; }
      if (!(y < cutY && z < midZ)) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    g.setIndex(keep);
  });
}
