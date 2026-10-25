// Port of App/Effects.swift: CPU particles drawn as one Points object per pool (1 draw call each).
import * as THREE from 'three';
import { dotTexture } from './textures';
import type { Texture } from 'three';

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; age: number;
  size: number; r: number; g: number; b: number; gravity: number; }

/** A fixed-size pool of soft round particles. `additive` = glowing (sparkle, crash); otherwise normal (dust). */
export class ParticlePool {
  readonly points: THREE.Points;
  private ps: P[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;

  constructor(private max: number, additive: boolean, sprite?: Texture) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: sprite ?? dotTexture() }, scale: { value: 600 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform float scale; varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor, t.a * vAlpha); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** Viewport height in device pixels: keeps particle size right on any screen. */
  setScale(viewportHeightPx: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = viewportHeightPx * 0.75;
  }

  burst(x: number, y: number, z: number, count: number, o: { color: number; speed: number; life: number;
    size: number; gravity?: number; spread?: number; dir?: [number, number, number]; colorJitter?: number; palette?: number[] }): void {
    const c = new THREE.Color(o.color);
    const pal = o.palette?.map((h) => new THREE.Color(h));
    for (let i = 0; i < count && this.ps.length < this.max; i++) {
      let vx = Math.random() * 2 - 1, vy = Math.random() * 2 - 1, vz = Math.random() * 2 - 1;
      const l = Math.hypot(vx, vy, vz) || 1;
      vx /= l; vy /= l; vz /= l;
      if (o.dir) { const s = o.spread ?? 0.4; vx = o.dir[0] + vx * s; vy = o.dir[1] + vy * s; vz = o.dir[2] + vz * s; }
      const sp = o.speed * (0.6 + Math.random() * 0.8);
      const j = o.colorJitter ?? 0;
      const pc = pal ? pal[Math.floor(Math.random() * pal.length)] : c;
      this.ps.push({ x, y, z, vx: vx * sp, vy: vy * sp, vz: vz * sp, life: o.life, age: 0,
        size: o.size * (0.7 + Math.random() * 0.6), gravity: o.gravity ?? 0,
        r: Math.min(1, pc.r + (Math.random() - 0.5) * j), g: Math.min(1, pc.g + (Math.random() - 0.5) * j), b: pc.b });
    }
  }

  update(dt: number): void {
    this.ps = this.ps.filter((p) => (p.age += dt) < p.life);
    this.ps.forEach((p, i) => {
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      this.pos.set([p.x, p.y, p.z], i * 3);
      this.col.set([p.r, p.g, p.b], i * 3);
      this.size[i] = p.size;
      this.alpha[i] = 1 - p.age / p.life;
    });
    for (let i = this.ps.length; i < this.max; i++) this.alpha[i] = 0;
    const geo = this.points.geometry;
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) geo.getAttribute(name).needsUpdate = true;
    geo.setDrawRange(0, Math.max(1, this.ps.length));
  }

  clear(): void { this.ps = []; this.update(0); }
}
