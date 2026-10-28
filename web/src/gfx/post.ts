// Cheap post-processing: scene → MSAA target, bright-pass + blur at 1/2 resolution, then ONE full-screen composite
// (bloom add, colour grading per theme). Costs ~3 tiny passes + 1 full-screen pass; the quality tier can switch it off.
import * as THREE from 'three';
import type { Theme } from './themes';

const VERT = `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = `
uniform sampler2D src; uniform vec2 texel; uniform float threshold; varying vec2 vUv;
void main() {
  vec3 c = texture2D(src, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, -1.0)).rgb
         + texture2D(src, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float b = max(max(c.r, c.g), c.b);
  gl_FragColor = vec4(c * smoothstep(threshold, threshold + 0.3, b), 1.0);
}`;

const BLUR = `
uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec3 c = texture2D(src, vUv).rgb * 0.2270270270;
  c += (texture2D(src, vUv + dir * 1.3846153846).rgb + texture2D(src, vUv - dir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(src, vUv + dir * 3.2307692308).rgb + texture2D(src, vUv - dir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE = `
uniform sampler2D scene; uniform sampler2D bloom; uniform float strength; uniform vec3 tint; uniform float sat; uniform float contrast; uniform float hd; uniform float rush; uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 base = texture2D(scene, vUv).rgb;
  if (rush > 0.01) { // boost: radial speed blur that grows towards the screen edge (centre stays sharp)
    vec2 dir = (vUv - 0.5) * rush * 0.05;
    vec3 acc = base;
    for (int i = 1; i <= 4; i++) acc += texture2D(scene, vUv - dir * float(i)).rgb;
    base = mix(base, acc * 0.2, smoothstep(0.12, 0.65, length(vUv - 0.5)));
  }
  vec3 c = base + texture2D(bloom, vUv).rgb * strength;
  c *= tint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, sat);
  c = (c - 0.5) * contrast + 0.5;
  vec2 d = vUv - 0.5;
  c *= 1.0 - 0.32 * dot(d, d) * 2.0;
  if (hd > 0.5) {
    vec3 blurN = (texture2D(scene, vUv + vec2(texel.x, 0.0)).rgb + texture2D(scene, vUv - vec2(texel.x, 0.0)).rgb
               + texture2D(scene, vUv + vec2(0.0, texel.y)).rgb + texture2D(scene, vUv - vec2(0.0, texel.y)).rgb) * 0.25;
    c += (c - blurN) * 0.35;
    // highlight-only shoulder: below 0.8 untouched, above it rolls off smoothly to 1.0; hue kept (scale by max channel)
    float m = max(max(c.r, c.g), c.b);
    if (m > 0.8) { float mm = 0.8 + 0.2 * (1.0 - exp(-(m - 0.8) / 0.2)); c *= mm / m; }
    c = clamp(c, 0.0, 1.0);
    float vig = smoothstep(1.15, 0.35, length(vUv - 0.5) * 1.4); c *= mix(0.82, 1.0, vig);
  }
  gl_FragColor = vec4(max(c, 0.0), 1.0);
  #include <colorspace_fragment>
}`;

export class PostFx {
  enabled = true;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private rt: THREE.WebGLRenderTarget;
  private small: THREE.WebGLRenderTarget[];
  private bright: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private comp: THREE.ShaderMaterial;

  constructor(private renderer: THREE.WebGLRenderer) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mk = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    this.bright = mk(BRIGHT, { src: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 0.8 } });
    this.blur = mk(BLUR, { src: { value: null }, dir: { value: new THREE.Vector2() } });
    this.comp = mk(COMPOSITE, {
      scene: { value: null }, bloom: { value: null }, strength: { value: 0.3 }, tint: { value: new THREE.Vector3(1, 1, 1) },
      sat: { value: 1 }, contrast: { value: 1 }, hd: { value: 1 }, rush: { value: 0 }, texel: { value: new THREE.Vector2() },
    });
    this.quad = new THREE.Mesh(tri, this.bright);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, colorSpace: THREE.SRGBColorSpace, depthBuffer: true });
    const opts = { type: THREE.HalfFloatType, depthBuffer: false } as const;
    this.small = [new THREE.WebGLRenderTarget(4, 4, opts), new THREE.WebGLRenderTarget(4, 4, opts)];
  }

  /** Call after every renderer.setSize / setPixelRatio. */
  resize(): void {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt.setSize(s.x, s.y);
    (this.comp.uniforms.texel.value as THREE.Vector2).set(1 / s.x, 1 / s.y);
    const w = Math.max(2, s.x >> 1), h = Math.max(2, s.y >> 1); // half-res bloom (post only runs on the high tier)
    for (const t of this.small) t.setSize(w, h);
  }

  setTheme(t: Theme): void {
    const u = this.comp.uniforms;
    u.strength.value = t.bloom.strength;
    (u.tint.value as THREE.Vector3).set(...t.grade.tint);
    u.sat.value = t.grade.saturation;
    u.contrast.value = t.grade.contrast;
    this.bright.uniforms.threshold.value = t.bloom.threshold;
  }

  /** 0…1 boost speed blur (eased by the game). */
  setRush(v: number): void { this.comp.uniforms.rush.value = v; }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    const [a, b] = this.small;
    const sw = a.width, sh = a.height;
    this.bright.uniforms.src.value = this.rt.texture;
    (this.bright.uniforms.texel.value as THREE.Vector2).set(1 / this.rt.width, 1 / this.rt.height);
    this.pass(this.bright, a);
    this.blur.uniforms.src.value = a.texture;
    (this.blur.uniforms.dir.value as THREE.Vector2).set(1 / sw, 0);
    this.pass(this.blur, b);
    this.blur.uniforms.src.value = b.texture;
    (this.blur.uniforms.dir.value as THREE.Vector2).set(0, 1 / sh);
    this.pass(this.blur, a);
    this.comp.uniforms.scene.value = this.rt.texture;
    this.comp.uniforms.bloom.value = a.texture;
    this.pass(this.comp, null);
  }
}
