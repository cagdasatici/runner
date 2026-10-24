// The 3 golden stars of a level: chunky spinning 5-point stars with a soft glow. Taken stars pop and vanish.
import * as THREE from 'three';
import type { GoldenStar } from '../core/level';
import { laneX } from '../core/track';
import { dotTexture } from './textures';

const STAR_Y = 1.25;
const POP_TIME = 0.3;

function starGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.26 : 0.6, a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3 });
  geo.center();
  return geo;
}

export class GoldenStarRenderer {
  readonly group = new THREE.Group();
  private geo = starGeometry();
  private mat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.25, metalness: 0.55, emissive: 0xc98a00, emissiveIntensity: 0.9 });
  private glow = new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffd75e, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75 });
  private nodes = new Map<number, { g: THREE.Group; star: GoldenStar; popT: number }>();

  /** Shows the stars of a new level (removes the old ones). */
  set(stars: GoldenStar[]): void {
    for (const n of this.nodes.values()) this.group.remove(n.g);
    this.nodes.clear();
    for (const star of stars) {
      const g = new THREE.Group();
      const halo = new THREE.Sprite(this.glow);
      halo.scale.setScalar(2.2);
      const mesh = new THREE.Mesh(this.geo, this.mat);
      mesh.castShadow = true;
      g.add(halo, mesh);
      g.position.set(laneX(star.lane), STAR_Y, -star.z);
      this.group.add(g);
      this.nodes.set(star.id, { g, star, popT: -1 });
    }
  }

  /** Spins and bobs the stars; a newly taken star pops (grows, rises, shrinks away). */
  update(taken: Set<number>, time: number, dt: number): void {
    for (const n of this.nodes.values()) {
      if (taken.has(n.star.id) && n.popT < 0) n.popT = 0;
      const spin = n.g.children[1];
      spin.rotation.y = time * 2.6 + n.star.id;
      if (n.popT >= 0) {
        n.popT += dt;
        const k = Math.min(1, n.popT / POP_TIME);
        n.g.visible = k < 1;
        n.g.scale.setScalar((1 + 0.8 * k) * (1 - k * k));
        n.g.position.y = STAR_Y + 1.2 * k;
      } else {
        n.g.position.y = STAR_Y + Math.sin(time * 3 + n.star.id) * 0.12;
      }
    }
  }
}
