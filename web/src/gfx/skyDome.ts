// Background sky: the theme's equirect sky texture, slowly tinted over a 120 s cycle, with procedural clouds drifting
// across it. A big inverted sphere that follows the camera; fog off, drawn first.
import * as THREE from 'three';

const VERT = `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const FRAG = `
uniform sampler2D sky; uniform float time; uniform vec3 tint; uniform float clouds; varying vec3 vDir;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
  vec3 c = texture2D(sky, uv).rgb;
  float k = 0.5 + 0.5 * sin(time * 6.2831853 / 120.0);
  c = mix(c, c * tint * 1.15, k * 0.55);
  if (d.y > 0.02) {
    vec2 q = d.xz / (d.y + 0.25) * 1.6 + vec2(time * 0.012, time * 0.004);
    float m = smoothstep(0.52, 0.78, fbm(q)) * smoothstep(0.02, 0.25, d.y) * clouds;
    c = mix(c, mix(vec3(1.0), tint, 0.25), m * 0.75);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export class SkyDome {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { sky: { value: null }, time: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, clouds: { value: 1 } },
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(140, 48, 24), this.mat);
    this.mesh.renderOrder = -2;
    this.mesh.frustumCulled = false;
  }
  /** `tint` is the colour the sky drifts toward; `clouds` 0…1 (0 for night themes with many stars is fine too). */
  set(sky: THREE.Texture, tint: number, clouds: number): void {
    this.mat.uniforms.sky.value = sky;
    (this.mat.uniforms.tint.value as THREE.Color).setHex(tint);
    this.mat.uniforms.clouds.value = clouds;
  }
  /** Returns 0…1, the current drift amount, so fog can follow it. */
  update(time: number, camera: THREE.Camera): number {
    this.mat.uniforms.time.value = time;
    this.mesh.position.copy(camera.position);
    return (0.5 + 0.5 * Math.sin(time * Math.PI * 2 / 120)) * 0.55;
  }
}
