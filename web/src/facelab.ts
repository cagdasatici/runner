// Dev-only close-up of a character's head (not part of the build): /facelab.html?char=arel&yaw=0
import * as THREE from 'three';
import { RunnerFigure } from './gfx/character';
import { createMaterials } from './gfx/materials';
import { characterById } from './gfx/characters';

// ?photo=arel2 tries another picture from public/faces (landmarks measured by hand, in picture px)
const CANDIDATES: Record<string, { eyes: [[number, number], [number, number]]; mouth: [number, number] }> = {
  arel: { eyes: [[149, 164], [210, 168]], mouth: [171, 236] },
  arel1: { eyes: [[84, 132], [144, 138]], mouth: [108, 199] },
  arel2: { eyes: [[112, 126], [166, 125]], mouth: [140, 184] },
  arel3: { eyes: [[121, 132], [170, 133]], mouth: [144, 187] },
  nora: { eyes: [[99, 82], [127, 82]], mouth: [114, 115] },
  nora1: { eyes: [[84, 105], [118, 104]], mouth: [101, 143] },
  nora2: { eyes: [[103, 95], [137, 93]], mouth: [122, 130] },
  nora3: { eyes: [[174, 238], [265, 240]], mouth: [221, 326] },
};

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8899aa);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(2, 4, -5); scene.add(sun);
const pick = q.get('photo'), def = characterById(q.get('char') ?? 'arel');
if (pick && def.face?.photo) Object.assign(def.face.photo, CANDIDATES[pick], { url: `/faces/${pick}.${pick.match(/\d$/) ? 'png' : 'jpg'}` }, q.has('drop') ? { mouthDrop: Number(q.get('drop')) } : {});
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
