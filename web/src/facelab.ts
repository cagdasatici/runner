// Dev-only close-up of a character's head (not part of the build): /facelab.html?char=arel&yaw=0
import * as THREE from 'three';
import { RunnerFigure } from './gfx/character';
import { createMaterials } from './gfx/materials';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8899aa);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(2, 4, -5); scene.add(sun);
const fig = new RunnerFigure(createMaterials(), q.get('char') ?? 'arel');
scene.add(fig.root);
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') ?? 18), innerWidth / innerHeight, 0.05, 50);
const yaw = Number(q.get('yaw') ?? 0), dist = Number(q.get('dist') ?? 2.2), h = Number(q.get('h') ?? 1.15);
void h;
const head = new THREE.Vector3();
let last = performance.now();
renderer.setAnimationLoop((now) => { const dt = (now - last) / 1000; last = now; fig.menuPose(now / 1000, q.has('anim') ? dt : 0);
  let hb: THREE.Object3D | undefined; fig.root.traverse((o) => { if (o.name === 'Head' && (o as THREE.Bone).isBone) hb = o; });
  if (hb) { scene.updateMatrixWorld(true); hb.getWorldPosition(head); head.y += Number(q.get('dy') ?? 0.06); cam.position.set(head.x + Math.sin(yaw) * dist, head.y, head.z - Math.cos(yaw) * dist); cam.lookAt(head); } renderer.render(scene, cam); });
