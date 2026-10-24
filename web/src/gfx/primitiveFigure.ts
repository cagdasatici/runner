// Fallback figure (port of App/Character.swift): shown only while a glTF model loads or if loading fails.
// Faces -z (the running direction). Feet touch y = 0 when standing.
// Rotation sign guide: a positive x-rotation swings a hanging limb forward (-z); knees bend with negative values.
import * as THREE from 'three';
import { isGrounded, isSliding, Runner, startState, type RunnerState } from '../core/runner';
import { laneX } from '../core/track';
import type { Materials } from './materials';
import { boxGeo, capsuleGeo, cylinderGeo, mesh, sphereGeo } from './shapes';

const SPIN_HEIGHT = 0.55;
const HIP_HEIGHT = 0.88;

type Pair = [number, number];

export class PrimitiveFigure {
  readonly root = new THREE.Group();
  private spin = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private shoulder = [new THREE.Group(), new THREE.Group()];
  private elbow = [new THREE.Group(), new THREE.Group()];
  private hip = [new THREE.Group(), new THREE.Group()];
  private knee = [new THREE.Group(), new THREE.Group()];

  constructor(m: Materials) {
    this.root.add(this.spin);
    this.spin.position.y = SPIN_HEIGHT;
    this.spin.add(this.hips);
    this.hips.position.y = HIP_HEIGHT - SPIN_HEIGHT;

    // legs: hip → thigh → knee → shin → shoe
    [-0.15, 0.15].forEach((x, i) => {
      const hip = this.hip[i], knee = this.knee[i];
      hip.position.set(x, -0.02, 0);
      this.hips.add(hip);
      hip.add(mesh(capsuleGeo(0.12, 0.46), m.pants, 0, -0.2, 0));
      knee.position.y = -0.4;
      hip.add(knee);
      knee.add(mesh(capsuleGeo(0.105, 0.42), m.pants, 0, -0.18, 0));
      knee.add(mesh(boxGeo(0.22, 0.12, 0.36, 0.05), m.shoe, 0, -0.4, -0.06));
      knee.add(mesh(boxGeo(0.23, 0.04, 0.37), m.sole, 0, -0.46, -0.06));
    });

    // torso (hoodie) with backpack on the back (+z)
    this.hips.add(this.torso);
    this.torso.add(mesh(boxGeo(0.62, 0.64, 0.4, 0.16), m.hoodie, 0, 0.32, 0));
    this.torso.add(mesh(boxGeo(0.5, 0.52, 0.22, 0.09), m.backpack, 0, 0.36, 0.28));
    this.torso.add(mesh(boxGeo(0.36, 0.14, 0.06), m.sole, 0, 0.24, 0.4));
    this.torso.add(mesh(capsuleGeo(0.05, 0.6), m.sole, -0.18, 0.4, 0.18));
    this.torso.add(mesh(capsuleGeo(0.05, 0.6), m.sole, 0.18, 0.4, 0.18));

    // head: face, hair, cap, eyes, cheeks, nose, smile
    const h = this.head;
    h.position.y = 0.86;
    this.torso.add(h);
    h.add(mesh(sphereGeo(0.33), m.skin));
    const hair = mesh(sphereGeo(0.345), m.hair, 0, 0.03, 0.04);
    hair.scale.y = 0.8;
    h.add(hair);
    const capTop = mesh(sphereGeo(0.355), m.cap, 0, 0.1, 0);
    capTop.scale.y = 0.62;
    h.add(capTop);
    const brim = mesh(cylinderGeo(0.24, 0.04), m.cap, 0, 0.1, -0.3);
    brim.scale.z = 0.75;
    h.add(brim);
    for (const x of [-0.12, 0.12]) {
      h.add(mesh(sphereGeo(0.085), m.eyeWhite, x, 0.05, -0.27));
      h.add(mesh(sphereGeo(0.045), m.pupil, x, 0.05, -0.345));
      h.add(mesh(sphereGeo(0.06), m.cheek, x * 1.7, -0.08, -0.25));
    }
    h.add(mesh(sphereGeo(0.05), m.skin, 0, -0.04, -0.33));
    const mouth = mesh(capsuleGeo(0.022, 0.14), m.pupil, 0, -0.15, -0.3);
    mouth.rotation.z = Math.PI / 2;
    h.add(mouth);
    for (const x of [-0.075, 0.075]) {
      const corner = mesh(capsuleGeo(0.02, 0.07), m.pupil, x, -0.13, -0.295);
      corner.rotation.z = x > 0 ? 0.9 : -0.9;
      h.add(corner);
    }

    // arms: shoulder → upper arm → elbow → forearm → hand
    [-0.42, 0.42].forEach((x, i) => {
      const sh = this.shoulder[i], el = this.elbow[i];
      sh.position.set(x, 0.56, 0);
      this.torso.add(sh);
      sh.add(mesh(capsuleGeo(0.095, 0.38), m.hoodie, 0, -0.16, 0));
      el.position.y = -0.33;
      sh.add(el);
      el.add(mesh(capsuleGeo(0.085, 0.32), m.hoodie, 0, -0.13, 0));
      el.add(mesh(sphereGeo(0.1), m.skin, 0, -0.32, 0));
    });
    this.root.traverse((o) => { o.castShadow = true; });
  }

  /** Poses the figure for this frame from the game state. */
  pose(s: RunnerState): void {
    this.root.position.set(s.x, s.y, -s.z);
    this.root.rotation.z = Math.max(-0.35, Math.min(0.35, -(laneX(s.lane) - s.x) * 0.18));

    if (s.crashed) {
      this.spin.rotation.set(1.35, 0, 0.2); // falls backwards
      this.spin.position.y = SPIN_HEIGHT * 0.5;
      this.limbs([0.9, 0.4], [-0.6, -0.9], [2.6, 2.4], [0.3, 0.3], 0);
      return;
    }
    this.spin.position.y = SPIN_HEIGHT;
    this.spin.rotation.z = 0;

    if (isSliding(s)) {
      // roll: tuck into a ball and spin forward
      this.spin.rotation.x = -s.slideTicks * Runner.dt * 18;
      this.limbs([2.1, 2.1], [-2.3, -2.3], [1.6, 1.6], [1.6, 1.6], -0.5);
      return;
    }
    this.spin.rotation.x = 0;

    if (!isGrounded(s)) {
      const up = s.vy > 0; // jump: knees tucked, arms thrown up
      this.limbs([up ? 1.3 : 0.7, up ? 0.5 : 0.9], [-1.6, -1.2], [up ? 2.7 : 2.0, up ? 2.4 : 2.2], [0.4, 0.4], -0.1);
      return;
    }

    // run cycle: one stride every 2.6 m
    const p = (s.z / 2.6) * 2 * Math.PI;
    const swing = Math.sin(p);
    this.hips.position.y = HIP_HEIGHT - SPIN_HEIGHT + Math.abs(Math.cos(p)) * 0.07;
    this.limbs(
      [0.9 * swing, -0.9 * swing],
      [-0.2 - 1.1 * Math.max(0, -Math.cos(p)), -0.2 - 1.1 * Math.max(0, Math.cos(p))],
      [-0.8 * swing, 0.8 * swing],
      [1.3, 1.3],
      -0.18,
    );
  }

  /** Menu: jogging in place at the origin. */
  menuPose(time: number): void {
    const s = startState();
    s.z = time * 6;
    this.pose(s);
    this.root.position.set(0, 0, 0);
  }

  private limbs(hip: Pair, knee: Pair, shoulder: Pair, elbow: Pair, lean: number): void {
    for (let i = 0; i < 2; i++) {
      this.hip[i].rotation.x = hip[i];
      this.knee[i].rotation.x = knee[i];
      this.shoulder[i].rotation.x = shoulder[i];
      this.elbow[i].rotation.x = elbow[i];
    }
    this.torso.rotation.x = lean;
  }
}
