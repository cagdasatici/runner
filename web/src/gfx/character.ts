// The runner: a CC0 rigged glTF character (see docs/ASSETS.md) driven by the deterministic RunnerState.
// Animation clips are chosen by the pure animFor() (characters.ts) and cross-faded with THREE.AnimationMixer.
// Faces -z (the running direction); feet at state.y. Until a model has loaded (or if loading fails) a primitive figure is shown.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Runner, startState, type RunnerState } from '../core/runner';
import { laneX } from '../core/track';
import { animFor, characterById, CHARACTERS, type AnimKey, type CharacterDef } from './characters';
import type { Materials } from './materials';
import { PrimitiveFigure } from './primitiveFigure';
import { dotTexture } from './textures';

const FADE = 0.14; // seconds of cross-fade between clips
const AIR_TIME = 0.6; // jump airtime: 2 * jumpVelocity / gravity
const BOARD_LIFT = 0.17; // the runner stands on the hoverboard deck
const STUMBLE_TIME = 0.55;

/** Run state plus the power-up fields the core may carry (all optional). */
type FigureState = RunnerState & { board?: number; fly?: number; stumbles?: number };

interface Entry {
  def: CharacterDef;
  model: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  footprint: number; // half-length of the shadow blob
}

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
    try {
      const gltf = await loadGltf(import.meta.env.BASE_URL + def.model);
      const again = this.entries.get(def.id);
      if (again) return again;
      const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      model.rotation.y = def.yaw;
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.frustumCulled = false; // skinned bounds are unreliable
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
      const mixer = new THREE.AnimationMixer(model);
      const actions = new Map<string, THREE.AnimationAction>();
      for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
      const entry: Entry = { def, model: wrap, mixer, actions, footprint: Math.max(0.5, (box.max.z - box.min.z) * k * 0.55) };
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
    if (key === 'slide' && s.slideTicks > this.lastSlide && this.key === 'slide') this.key = null; // a new roll restarts the clip
    this.lastSlide = s.slideTicks;
    this.play(e, key, s, speed);
    e.mixer.update(dt);

    // procedural layer: pitch and squash ease toward the target of the current animation
    let pitch = 0, squash = 1, roll = 0;
    const tuck = e.def.slide === 'tuck';
    if (key === 'slide' && tuck) { pitch = -0.35; squash = 0.55; }
    else if (key === 'fly') { pitch = -0.95 + Math.sin(this.t * 6) * 0.05; }
    else if (key === 'board') { pitch = -0.1; squash = 0.94; }
    else if (key === 'jump') { squash = s.vy > 0 ? 1.04 : 0.97; }
    if (key === 'stumble' && !e.def.clips.stumble) roll = Math.sin(this.t * 38) * 0.18;
    const a = dt > 0 ? 1 - Math.exp(-dt * 16) : 1;
    this.pitch += (pitch - this.pitch) * a;
    this.squash += (squash - this.squash) * a;
    this.pop = Math.min(1, this.pop + dt * 5);
    const pop = this.pop < 1 ? 1 + Math.sin(this.pop * Math.PI) * 0.12 - (1 - this.pop) * 0.5 : 1;
    this.pivot.rotation.set(this.pitch, 0, roll);
    this.pivot.scale.set(pop, pop * this.squash, pop);
    this.pivot.position.y = 0;
    this.setShadow(s.x, s.y, -s.z, e.footprint);
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
      this.key = key;
      this.action = next;
    }
    const dur = next.getClip().duration;
    let rate = 1;
    switch (key) {
      case 'run': rate = e.def.runSpeed * (speed / Runner.startSpeed); break;
      case 'jump': rate = clips.jump === clips.run ? 0.3 : dur / AIR_TIME; break;
      case 'slide': rate = clips.slide ? dur / (Runner.slideDuration * Runner.dt) : e.def.runSpeed * 1.4; break;
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
