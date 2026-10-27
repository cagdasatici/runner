// The journey map as real 3D art: every world is a lit, shadowed three.js diorama (rolling terrain, a curbed road, hundreds of
// modelled props, depth haze, sky) rendered once through a tilted orthographic camera and kept as a JPEG behind the level buttons.
// Screen position (x, y in map px) <-> ground position: x = x, z = y / sin(PITCH). Heights lift things up the screen by cos(PITCH).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clamp, col, disposeKit, fbm, G, mat, mixc, paint, pick, put, range, rngOf, smooth, softDisc, css, type Rng } from './map3dKit';
import * as P from './map3dProps';

export const MAP_W = 820;
const PITCH = (52 * Math.PI) / 180, S = Math.sin(PITCH), C = Math.cos(PITCH);
type Pt = [number, number];
type PropFn = P.Prop;
const tone = (c: number, t: number): number => (t >= 0 ? mixc(c, 0xffffff, t) : mixc(c, 0x000000, -t)).getHex();

interface Layer { fn: PropFn; n: number; y: [number, number]; s: [number, number]; edge?: boolean; fp?: number; lift?: [number, number] }
interface Far { fn: PropFn; n: number; s: [number, number]; dz: [number, number]; lift?: number }
interface Cfg {
  sky: [number, number, number, number?];   // top, mid, horizon (+ optional extra low stop)
  fog: number; fogAmt: number;               // haze colour, 0…1 how far down the haze reaches
  ridge: number;                             // screen y of the far ridge / horizon line
  hill: [number, number];                    // ridge height range (px)
  ground: [number, number]; patch: [number, number]; tex: 'grass' | 'sand' | 'snow' | 'candy' | 'rock' | 'plate' | 'cloud' | 'space' | 'neon';
  gloss?: number;
  road: { edge: number; edge2: number; fill: number; mark: number; wide?: number; glow?: boolean; dash?: number };
  plinth: number;
  sun: { color: number; i: number; hemiSky: number; hemiGround: number; hemiI: number; env: number; dir?: [number, number, number] };
  orb?: { x: number; y: number; r: number; c: number; moon?: boolean };
  stars?: number;
  sea?: { shore: number; deep: number; mid: number; shoreY: number };
  far: Far[]; props: Layer[]; sky3d?: { fn: PropFn; n: number; s: [number, number] }[];
  speck: number[]; speckKind?: 'pollen' | 'snow' | 'ember' | 'spark';
}

const L = (fn: PropFn, n: number, y: [number, number], s: [number, number], o: Partial<Layer> = {}): Layer => ({ fn, n, y, s, ...o });
const Fr = (fn: PropFn, n: number, s: [number, number], dz: [number, number], lift = 0): Far => ({ fn, n, s, dz, lift });

const CFGS: Cfg[] = [
  { // 0 Sunny City
    sky: [0x2e8fe8, 0x6bc4f8, 0xd3efff], fog: 0xcfeaff, fogAmt: 0.62, ridge: 175, hill: [14, 40],
    ground: [0x8be060, 0x5fc43c], patch: [0xb8f08a, 0x3fa52c], tex: 'grass',
    road: { edge: 0xb9894a, edge2: 0xe2c48a, fill: 0xf4e3b4, mark: 0xfffbe6 }, plinth: 0xf59e0b,
    sun: { color: 0xfff1d0, i: 2.6, hemiSky: 0xcfeaff, hemiGround: 0x8fa870, hemiI: 1.05, env: 0.5 }, orb: { x: 690, y: 80, r: 44, c: 0xfff3b0 },
    far: [Fr(P.tower(0x9fb4cc, 0xfde68a), 11, [0.9, 1.3], [10, 90]), Fr(P.tower(0xb6c6dc, 0xfde68a), 8, [0.7, 1.0], [60, 130])],
    props: [L(P.house(0xfef3c7, 0xe8453c), 7, [320, 1100], [0.9, 1.25], { edge: true, fp: 36 }), L(P.house(0xe0f2fe, 0x2f6fe0), 5, [340, 1080], [0.9, 1.2], { edge: true, fp: 36 }),
      L(P.oak(0x2fc65a), 14, [300, 1130], [0.75, 1.15], { fp: 28 }), L(P.bush(0x1f9d46), 14, [290, 1160], [0.8, 1.3], { fp: 16 }), L(P.flowers([0xf472b6, 0xfde047, 0xffffff, 0x60a5fa]), 22, [290, 1180], [0.9, 1.4], { fp: 18 }),
      L(P.lamp(0xfde68a), 6, [340, 1100], [0.9, 1.05], { edge: true, fp: 8 }), L(P.bench, 4, [400, 1080], [0.9, 1.1], { edge: true, fp: 24 }), L(P.pond, 2, [440, 1020], [0.9, 1.2], { edge: true, fp: 44 }), L(P.tuft(0x2f9e3f), 36, [280, 1190], [0.9, 1.5], { fp: 6 })],
    speck: [0xffffff, 0xfff3b0], speckKind: 'pollen' },
  { // 1 Leafy Park
    sky: [0x62b8f0, 0xb5e8d4, 0xeafad0], fog: 0xdff5d4, fogAmt: 0.58, ridge: 170, hill: [30, 70],
    ground: [0x74d65a, 0x3fae3a], patch: [0xa6ec7e, 0x2f8f34], tex: 'grass',
    road: { edge: 0x7a4a22, edge2: 0xb98650, fill: 0xdcb27a, mark: 0xf8e3bf }, plinth: 0x16a34a,
    sun: { color: 0xfff0c0, i: 2.4, hemiSky: 0xdff5ff, hemiGround: 0x6f9f50, hemiI: 1.0, env: 0.5 }, orb: { x: 130, y: 70, r: 38, c: 0xfff6b8 },
    far: [Fr(P.pine(0x1b7f3d), 22, [0.9, 1.4], [20, 120]), Fr(P.oak(0x3aa04a), 10, [1.1, 1.6], [50, 120])],
    props: [L(P.oak(0x2fb352), 16, [270, 1140], [0.9, 1.35], { fp: 30 }), L(P.oak(0x6ba818), 9, [270, 1140], [0.8, 1.2], { fp: 28 }), L(P.pine(0x167a3a), 9, [270, 1140], [0.9, 1.3], { fp: 22 }), L(P.pond, 3, [400, 1040], [0.95, 1.4], { edge: true, fp: 50 }),
      L(P.flowers([0xf472b6, 0xfde047, 0xc084fc, 0xfb923c]), 32, [280, 1180], [0.9, 1.5], { fp: 18 }), L(P.bush(0x15803d), 16, [280, 1170], [0.9, 1.4], { fp: 16 }), L(P.bench, 4, [400, 1080], [1, 1.2], { edge: true, fp: 24 }), L(P.rock(0xa8a29e), 7, [300, 1150], [0.7, 1.3], { fp: 16 }), L(P.tuft(0x2f9e3f), 40, [280, 1190], [0.9, 1.5], { fp: 6 })],
    speck: [0xfffbb0, 0xffffff], speckKind: 'pollen' },
  { // 2 Sandy Beach
    sky: [0x1c9ae8, 0x7dd3fc, 0xfef3d0], fog: 0xfdf0d2, fogAmt: 0.5, ridge: 150, hill: [0, 4],
    ground: [0xf3d28a, 0xe9bd6a], patch: [0xfff0c2, 0xd9a950], tex: 'sand',
    road: { edge: 0xb8803c, edge2: 0xf2d79c, fill: 0xfff2c9, mark: 0xffffff }, plinth: 0x0ea5e9,
    sun: { color: 0xfff1c8, i: 2.9, hemiSky: 0xdff3ff, hemiGround: 0xe8c37c, hemiI: 1.1, env: 0.55 }, orb: { x: 690, y: 70, r: 44, c: 0xfff3b0 },
    sea: { shore: 0x7ff0e0, deep: 0x1479c8, mid: 0x1fb4d8, shoreY: 340 },
    far: [], sky3d: [{ fn: P.cloud(), n: 6, s: [0.6, 1.0] }],
    props: [L(P.boat, 3, [190, 290], [0.8, 1.1], { fp: 0, lift: [-4, -4] }), L(P.palm, 14, [370, 1130], [0.9, 1.4], { fp: 18 }), L(P.umbrella, 6, [430, 1110], [0.9, 1.2], { edge: true, fp: 28 }), L(P.sandcastle, 4, [450, 1100], [0.9, 1.2], { edge: true, fp: 36 }),
      L(P.shell, 30, [360, 1180], [0.8, 1.6], { fp: 4 }), L(P.rock(0xd6b98a), 7, [370, 1130], [0.6, 1.1], { fp: 14 }), L(P.tuft(0x6dae28), 16, [380, 1180], [0.9, 1.3], { fp: 6 })],
    speck: [0xffffff, 0xffe9a8], speckKind: 'pollen' },
  { // 3 Candy Land
    sky: [0xe46fb8, 0xf7aadb, 0xffe3f1], fog: 0xfbd3e8, fogAmt: 0.4, ridge: 170, hill: [26, 60],
    ground: [0xf9c0dc, 0xee86bb], patch: [0xffe3f1, 0xd9609f], tex: 'candy', gloss: 0.5,
    road: { edge: 0xd4247e, edge2: 0xffffff, fill: 0xfff4fa, mark: 0xf472b6, dash: 18 }, plinth: 0xec4899,
    sun: { color: 0xfff0d8, i: 2.4, hemiSky: 0xfff0f8, hemiGround: 0xd870aa, hemiI: 0.85, env: 0.8 }, orb: { x: 120, y: 80, r: 40, c: 0xfff0a8 },
    far: [Fr(P.lolly, 12, [0.8, 1.2], [20, 120]), Fr(P.gumdrop, 14, [1.2, 2.0], [30, 130])],
    props: [L(P.lolly, 11, [280, 1120], [0.95, 1.4], { fp: 12 }), L(P.cupcake, 8, [290, 1110], [0.95, 1.3], { fp: 24 }), L(P.candyCane, 13, [280, 1130], [0.95, 1.4], { fp: 10 }), L(P.gumdrop, 20, [270, 1170], [0.9, 1.5], { fp: 18 }), L(P.iceCream, 7, [300, 1110], [0.9, 1.25], { fp: 16 })],
    speck: [0xffffff, 0xfde047, 0xa5f3fc], speckKind: 'spark' },
  { // 4 Desert Canyon
    sky: [0xf06a1a, 0xfcb274, 0xffeccb], fog: 0xfbd8ae, fogAmt: 0.55, ridge: 185, hill: [24, 60],
    ground: [0xf0b985, 0xd9893f], patch: [0xffd9a8, 0xbf6a2a], tex: 'sand',
    road: { edge: 0x84320f, edge2: 0xdba46c, fill: 0xf9ddb0, mark: 0xfff3d9 }, plinth: 0xea580c,
    sun: { color: 0xffd7a0, i: 3.0, hemiSky: 0xffe2bd, hemiGround: 0xc98a52, hemiI: 1.0, env: 0.45 }, orb: { x: 120, y: 105, r: 56, c: 0xfff0a0 },
    far: [Fr(P.mesa(0xb8581e), 9, [1.0, 1.7], [20, 120]), Fr(P.mesa(0xc9682a), 6, [0.7, 1.1], [60, 130])],
    props: [L(P.mesa(0xc2632a), 3, [340, 900], [0.6, 0.85], { edge: true, fp: 60 }), L(P.cactus, 18, [290, 1140], [0.85, 1.4], { fp: 16 }), L(P.rock(0xb45f2a), 14, [290, 1150], [0.8, 1.6], { fp: 18 }), L(P.dune(0xe9a560), 8, [320, 1160], [1, 1.6], { fp: 0 }), L(P.tuft(0xb08a2a), 28, [290, 1190], [0.9, 1.4], { fp: 6 })],
    speck: [0xffe9a8, 0xfb923c], speckKind: 'pollen' },
  { // 5 Snowy Peaks
    sky: [0x4f95ee, 0xb2d6fb, 0xf3faff], fog: 0xe8f3ff, fogAmt: 0.6, ridge: 170, hill: [30, 70],
    ground: [0xf4f9ff, 0xd5e6fa], patch: [0xffffff, 0xaecaee], tex: 'snow',
    road: { edge: 0x5e7592, edge2: 0xd8e4f2, fill: 0xf8fbff, mark: 0xb8d4f0 }, plinth: 0x0ea5e9,
    sun: { color: 0xfff4de, i: 2.5, hemiSky: 0xe3f1ff, hemiGround: 0xa4bddb, hemiI: 1.2, env: 0.6 }, orb: { x: 690, y: 80, r: 36, c: 0xfffbe0 },
    far: [Fr(P.snowPeak, 9, [1.0, 1.7], [0, 110]), Fr(P.pine(0x1c6a46, true), 14, [0.8, 1.2], [60, 140])],
    props: [L(P.pine(0x1c6f48, true), 20, [280, 1140], [0.9, 1.5], { fp: 22 }), L(P.snowman, 5, [330, 1100], [0.9, 1.2], { edge: true, fp: 22 }), L(P.igloo, 3, [370, 1060], [0.9, 1.2], { edge: true, fp: 46 }), L(P.iceSpike, 11, [290, 1150], [0.8, 1.3], { fp: 22 }), L(P.rock(0x8196ad), 8, [300, 1150], [0.7, 1.2], { fp: 14 })],
    speck: [0xffffff, 0xcfe8ff], speckKind: 'snow' },
  { // 6 Jungle Ruins
    sky: [0x1e6f3c, 0x73cf7a, 0xdcf5b4], fog: 0xcdeeb8, fogAmt: 0.62, ridge: 165, hill: [30, 80],
    ground: [0x3fbf4d, 0x1d7a35], patch: [0x7fe07a, 0x125c2a], tex: 'grass',
    road: { edge: 0x4a2a0c, edge2: 0x8c6a42, fill: 0xb89466, mark: 0xdcc59c }, plinth: 0x15803d,
    sun: { color: 0xfff6c4, i: 2.2, hemiSky: 0xd6f5c0, hemiGround: 0x3d7a3a, hemiI: 1.0, env: 0.4 }, orb: { x: 680, y: 80, r: 30, c: 0xfffbd0 },
    far: [Fr(P.jungleTree, 18, [0.9, 1.4], [10, 120]), Fr(P.jungleTree, 10, [1.2, 1.7], [40, 130])],
    props: [L(P.ziggurat, 3, [370, 920], [0.85, 1.1], { edge: true, fp: 60 }), L(P.jungleTree, 14, [280, 1140], [0.9, 1.5], { fp: 26 }), L(P.idol, 6, [310, 1100], [0.9, 1.3], { edge: true, fp: 20 }), L(P.bigLeaf, 28, [280, 1180], [0.9, 1.5], { fp: 14 }),
      L(P.flowers([0xf43f5e, 0xfb923c, 0xfde047]), 14, [280, 1180], [0.9, 1.3], { fp: 16 }), L(P.rock(0x6b7280), 9, [290, 1150], [0.7, 1.2], { fp: 16 }), L(P.pond, 2, [440, 940], [0.9, 1.2], { edge: true, fp: 44 })],
    speck: [0xd9f99d, 0xfef08a], speckKind: 'pollen' },
  { // 7 Neon Night
    sky: [0x070420, 0x2a1b78, 0x8a32b8], fog: 0x3b1c78, fogAmt: 0.6, ridge: 170, hill: [10, 30],
    ground: [0x2c2266, 0x15103a], patch: [0x4a3a96, 0x0b0826], tex: 'neon', gloss: 0.28,
    road: { edge: 0xf0abfc, edge2: 0xe879f9, fill: 0x241c55, mark: 0x67e8f9, glow: true, dash: 22 }, plinth: 0x7c3aed,
    sun: { color: 0xb8c4ff, i: 1.6, hemiSky: 0x6a56d8, hemiGround: 0x2a1458, hemiI: 1.1, env: 0.7 }, orb: { x: 690, y: 90, r: 50, c: 0xf0e8ff, moon: true }, stars: 1,
    far: [Fr(P.tower(0x2b2370, 0xf0abfc, true), 16, [1.0, 1.7], [0, 110]), Fr(P.tower(0x3a2f8a, 0x67e8f9, true), 12, [0.7, 1.1], [60, 140])],
    props: [L(P.tower(0x2b2370, 0xf0abfc, true), 8, [350, 1100], [0.85, 1.2], { edge: true, fp: 40 }), L(P.neonSign(0xf0abfc), 7, [320, 1100], [0.9, 1.3], { edge: true, fp: 12 }), L(P.neonSign(0x67e8f9), 6, [320, 1100], [0.9, 1.3], { edge: true, fp: 12 }),
      L(P.lamp(0x67e8f9), 10, [320, 1150], [0.9, 1.2], { fp: 8 }), L(P.crystal(0xa78bfa), 9, [320, 1150], [0.8, 1.3], { fp: 18 }), L(P.rock(0x3a3398), 6, [320, 1150], [0.7, 1.1], { fp: 14 })],
    speck: [0xf0abfc, 0x67e8f9, 0xfde047], speckKind: 'spark' },
  { // 8 Toy Factory
    sky: [0xf49a9a, 0xfcc8c0, 0xfff0e0], fog: 0xfbe0d4, fogAmt: 0.4, ridge: 170, hill: [10, 26],
    ground: [0xd6dde8, 0xaab6c8], patch: [0xf3f6fb, 0x8a98b0], tex: 'plate', gloss: 0.5,
    road: { edge: 0x1d3fa0, edge2: 0x3b66e0, fill: 0x4a5568, mark: 0xfacc15, dash: 26 }, plinth: 0xef4444,
    sun: { color: 0xfff1de, i: 2.4, hemiSky: 0xfff0e8, hemiGround: 0xa8b4c8, hemiI: 1.1, env: 0.7 }, orb: { x: 130, y: 80, r: 34, c: 0xfff6c8 },
    far: [Fr(P.smokestack, 9, [0.8, 1.2], [20, 120]), Fr(P.tower(0xe5e9f0, 0xffffff), 9, [0.8, 1.2], [40, 130])],
    props: [L(P.gear(0xef4444), 8, [300, 1130], [0.9, 1.3], { fp: 28 }), L(P.gear(0x2563eb), 8, [300, 1130], [0.8, 1.2], { fp: 26 }), L(P.gear(0xfacc15), 6, [300, 1130], [0.8, 1.1], { fp: 24 }), L(P.toyBlock, 18, [300, 1170], [0.9, 1.4], { fp: 24 }),
      L(P.smokestack, 4, [380, 1060], [0.9, 1.2], { edge: true, fp: 16 }), L(P.balloon, 6, [140, 230], [1, 1.5], { fp: 0, lift: [60, 120] }), L(P.rock(0x7a8aa3), 5, [300, 1150], [0.6, 0.9], { fp: 12 })],
    speck: [0xffffff, 0xfde047, 0xfca5a5], speckKind: 'spark' },
  { // 9 Volcano Valley
    sky: [0x3a0808, 0xb3261e, 0xff9a4a], fog: 0x8a2a1c, fogAmt: 0.4, ridge: 175, hill: [20, 50],
    ground: [0x56483f, 0x2a211d], patch: [0x7a6558, 0x151010], tex: 'rock',
    road: { edge: 0x16110f, edge2: 0x3b312c, fill: 0x6a5c54, mark: 0xff8a2a, glow: true, dash: 20 }, plinth: 0xdc2626,
    sun: { color: 0xffc088, i: 2.2, hemiSky: 0xff9a68, hemiGround: 0x4a2a20, hemiI: 1.0, env: 0.35 }, orb: { x: 130, y: 95, r: 50, c: 0xffc07a },
    far: [Fr(P.volcano, 3, [0.8, 1.1], [10, 70]), Fr(P.rock(0x3d3430), 14, [1.6, 2.6], [30, 120])],
    props: [L(P.volcano, 2, [330, 800], [0.38, 0.5], { edge: true, fp: 60 }), L(P.lavaPool, 12, [300, 1140], [0.8, 1.5], { fp: 30 }), L(P.rock(0x5d5049), 18, [300, 1150], [0.8, 1.6], { fp: 16 }), L(P.charTree, 12, [300, 1140], [0.9, 1.4], { fp: 10 }), L(P.crystal(0xff6a2a), 6, [320, 1140], [0.7, 1.1], { fp: 18 })],
    speck: [0xff9a3a, 0xfde047], speckKind: 'ember' },
  { // 10 Cloud Kingdom
    sky: [0x5a68e8, 0xa9b6fb, 0xffe9c4], fog: 0xe6e4fb, fogAmt: 0.4, ridge: 175, hill: [14, 34],
    ground: [0xe2e8ff, 0xb3c0fb], patch: [0xffffff, 0x95a4f0], tex: 'cloud', gloss: 0.9,
    road: { edge: 0xf59e0b, edge2: 0xfde68a, fill: 0xfff6d6, mark: 0xffffff }, plinth: 0x818cf8,
    sun: { color: 0xfff1d0, i: 2.5, hemiSky: 0xe8ecff, hemiGround: 0x93a0ea, hemiI: 0.95, env: 0.6 }, orb: { x: 690, y: 80, r: 50, c: 0xfff0b0 },
    far: [Fr(P.cloud(), 12, [1.2, 2.0], [0, 100]), Fr(P.rainbow, 1, [1.4, 1.5], [30, 40], 0)],
    props: [L(P.castle, 2, [380, 820], [1.0, 1.25], { edge: true, fp: 70 }), L(P.cloud(), 18, [290, 1160], [0.9, 1.6], { fp: 0 }), L(P.balloon, 7, [150, 1000], [0.9, 1.4], { fp: 0, lift: [40, 110] }), L(P.starProp, 18, [280, 1170], [1, 1.7], { fp: 0, lift: [0, 40] })],
    speck: [0xffffff, 0xfde047], speckKind: 'spark' },
  { // 11 Space Station
    sky: [0x01030f, 0x0a1028, 0x1b1550], fog: 0x120e3a, fogAmt: 0.4, ridge: 120, hill: [0, 8],
    ground: [0x1a2140, 0x0a0f24], patch: [0x2c3868, 0x05081a], tex: 'space', gloss: 0.35,
    road: { edge: 0x22d3ee, edge2: 0x67e8f9, fill: 0x1b2742, mark: 0x22d3ee, glow: true, dash: 20 }, plinth: 0x06b6d4,
    sun: { color: 0xcfe0ff, i: 2.2, hemiSky: 0x6a7cff, hemiGround: 0x1a1450, hemiI: 1.0, env: 0.8 }, orb: { x: 130, y: 70, r: 40, c: 0xe2e8f0, moon: true }, stars: 1,
    far: [Fr(P.planet(0x7c3aed, 0xc4b5fd, true), 2, [1.6, 2.4], [10, 40], 0)],
    props: [L(P.planet(0xf472b6, 0xfbcfe8, false), 4, [200, 1000], [0.8, 1.5], { edge: true, fp: 0 }), L(P.planet(0x22d3ee, 0xa5f3fc, true), 3, [200, 1000], [0.8, 1.3], { edge: true, fp: 0 }), L(P.planet(0xfbbf24, 0xfde68a, false), 3, [200, 1000], [0.8, 1.3], { edge: true, fp: 0 }),
      L(P.station, 5, [260, 1060], [0.9, 1.3], { edge: true, fp: 50 }), L(P.asteroid, 24, [180, 1170], [0.8, 1.8], { fp: 12 }), L(P.crystal(0x22d3ee), 8, [260, 1150], [0.7, 1.1], { fp: 16 })],
    speck: [0xffffff, 0x67e8f9], speckKind: 'spark' },
];

// ───────────── terrain textures ─────────────
function groundTexture(kind: Cfg['tex'], rr: Rng): THREE.CanvasTexture {
  return paint(512, 512, (g, w, h) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);
    const dots = (n: number, f: () => void) => { for (let i = 0; i < n; i++) f(); };
    const blade = (c: string, len: number, a: number) => { g.strokeStyle = c; g.globalAlpha = a; g.lineWidth = 1.6; const x = rr() * w, y = rr() * h, k = (rr() - 0.5) * 6; for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + k, y + oy - len * 0.6, x + ox + k * 1.8, y + oy - len); g.stroke(); } };
    const spot = (c: string, r0: number, a: number) => { g.fillStyle = c; g.globalAlpha = a; const x = rr() * w, y = rr() * h; for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) { g.beginPath(); g.ellipse(x + ox, y + oy, r0, r0 * (0.6 + rr() * 0.5), rr() * 3, 0, 7); g.fill(); } };
    if (kind === 'grass') { dots(900, () => blade('#2f7d2f', 7 + rr() * 8, 0.28)); dots(500, () => blade('#d8ffc0', 6 + rr() * 6, 0.35)); dots(40, () => spot('#ffffff', 2, 0.5)); }
    else if (kind === 'sand') { dots(700, () => spot('#ffffff', 1.4, 0.45)); dots(500, () => spot('#a06a22', 1.6, 0.2)); g.globalAlpha = 0.12; g.strokeStyle = '#a06a22'; for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin((x + y) * 0.08) * 3); g.stroke(); } }
    else if (kind === 'snow') { dots(900, () => spot('#ffffff', 1.2, 0.9)); dots(200, () => spot('#9cc0ee', 3, 0.1)); dots(120, () => spot('#cfe8ff', 1, 1)); }
    else if (kind === 'candy') { dots(160, () => { g.save(); g.globalAlpha = 0.9; g.fillStyle = pick(rr, ['#ffffff', '#fde047', '#38bdf8', '#a855f7', '#fb7185', '#34d399']); const x = rr() * w, y = rr() * h; g.translate(x, y); g.rotate(rr() * 3); g.fillRect(-4, -1.6, 8, 3.2); g.restore(); }); }
    else if (kind === 'rock') { dots(600, () => spot('#222', 3, 0.22)); dots(300, () => spot('#fff', 2, 0.14)); g.strokeStyle = '#111'; g.globalAlpha = 0.25; for (let i = 0; i < 22; i++) { g.beginPath(); let x = rr() * w, y = rr() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rr() - 0.5) * 50; y += (rr() - 0.2) * 40; g.lineTo(x, y); } g.stroke(); } }
    else if (kind === 'plate') { g.globalAlpha = 1; for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) { g.fillStyle = ((x + y) / 128) % 2 ? '#f4f4f4' : '#dcdcdc'; g.fillRect(x, y, 128, 128); g.strokeStyle = '#9aa4b4'; g.globalAlpha = 0.6; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 126, 126); g.globalAlpha = 1; for (const [a, b] of [[10, 10], [118, 10], [10, 118], [118, 118]]) { g.fillStyle = '#8a96a8'; g.beginPath(); g.arc(x + a, y + b, 3, 0, 7); g.fill(); } } }
    else if (kind === 'cloud') { dots(60, () => spot('#c8ceff', 22, 0.12)); dots(70, () => spot('#ffffff', 18, 0.5)); }
    else if (kind === 'space') { g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h); g.globalAlpha = 0.75; g.strokeStyle = '#22d3ee'; g.lineWidth = 1.5; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } g.globalAlpha = 0.5; dots(26, () => { g.fillStyle = '#e0f2fe'; g.fillRect(Math.floor(rr() * 8) * 64 - 2, Math.floor(rr() * 8) * 64 - 2, 5, 5); }); }
    else { g.globalAlpha = 0.9; g.strokeStyle = '#8b5cf6'; g.lineWidth = 1.5; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } dots(40, () => { g.fillStyle = pick(rr, ['#f0abfc', '#67e8f9']); g.fillRect(Math.floor(rr() * 8) * 64 - 2, Math.floor(rr() * 8) * 64 - 2, 5, 5); }); }
    g.globalAlpha = 1;
  }, { repeat: true });
}

// ───────────── the world ─────────────
export interface Built { scene: THREE.Scene; camera: THREE.OrthographicCamera; own: THREE.BufferGeometry[]; cfg: Cfg; fogDepth: (y: number) => [number, number] }

/** Smooth polyline through the level buttons (map px), extended to the bottom edge and up to the world's landmark. */
export function roadCurve(pts: Pt[], h: number): Pt[] {
  const a = pts.slice().sort((p, q) => q[1] - p[1]);
  const ext: Pt[] = [[a[0][0] + (a[0][0] < 410 ? 40 : -40), h + 60], [a[0][0], h - 40], ...a, [a[a.length - 1][0] + (a[a.length - 1][0] < 410 ? 28 : -28), a[a.length - 1][1] - 90]];
  const out: Pt[] = [];
  for (let i = 0; i < ext.length - 1; i++) {
    const p0 = ext[i - 1] ?? ext[i], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2] ?? p2;
    for (let k = 0; k < 24; k++) { const t = k / 24, t2 = t * t, t3 = t2 * t; out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  out.push(ext[ext.length - 1]);
  return out;
}

export function buildWorld(w: number, H: number, pts: Pt[]): Built {
  const cfg = CFGS[w], r = rngOf(9001 + w * 7919), own: THREE.BufferGeometry[] = [];
  const scene = new THREE.Scene();
  const zOf = (y: number) => y / S;
  const zr = zOf(cfg.ridge), zEnd = zOf(H) + 80;
  const hillAt = (x: number, z: number): number => {
    if (cfg.sea) return z < zOf(cfg.sea.shoreY) ? -6 : 0;
    const edge = cfg.hill[0] + (cfg.hill[1] - cfg.hill[0]) * fbm(x / 170 + w * 3, 0.5);
    const u = smooth(zr, zr + 320, z);
    return edge * (1 - u) * (1 - u) + (fbm(x / 60, z / 60) - 0.5) * 5 * smooth(zr, zr + 60, z) * (cfg.tex === 'cloud' ? 3 : 1);
  };
  const dist = (x: number, y: number) => ({ x, y }); void dist;

  // sky, depth haze
  const D = 3000, zt = H / (2 * S);
  const depthAt = (y: number) => D + (C / S) * (H / 2 - y);
  const fogNear = depthAt(cfg.ridge + (H - cfg.ridge) * 0.34 * (cfg.fogAmt / 0.6)), fogFar = depthAt(cfg.ridge - 14);
  scene.fog = new THREE.Fog(cfg.fog, fogNear, fogFar);
  scene.background = skyTexture(cfg, H, r);

  // camera: tilted orthographic, looking at the centre of the section
  const camera = new THREE.OrthographicCamera(-MAP_W / 2, MAP_W / 2, H / 2, -H / 2, 10, D * 2);
  const target = new THREE.Vector3(MAP_W / 2, 0, zt);
  camera.position.set(target.x, D * S, target.z + D * C);
  camera.lookAt(target);

  // lights
  const sun = new THREE.DirectionalLight(cfg.sun.color, cfg.sun.i);
  const dir = cfg.sun.dir ?? [-0.62, 0.78, 0.05];
  sun.position.set(target.x + dir[0] * 1600, dir[1] * 1600, target.z + dir[2] * 1600);
  sun.target.position.copy(target); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.left = -760; sc.right = 760; sc.top = zEnd * 0.82; sc.bottom = -zEnd * 0.82; sc.near = 200; sc.far = 3600; sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 1.4; sun.shadow.radius = 3.2;
  scene.add(new THREE.HemisphereLight(cfg.sun.hemiSky, cfg.sun.hemiGround, cfg.sun.hemiI));
  const fill = new THREE.DirectionalLight(mixc(cfg.sun.hemiSky, 0xffffff, 0.3), 0.5); fill.position.set(500, 500, 1200); scene.add(fill);
  scene.environmentIntensity = cfg.sun.env;

  // terrain
  const x0 = -30, x1 = MAP_W + 30, nx = 150, nz = 200;
  const zStart = cfg.sea ? zOf(cfg.sea.shoreY) - 40 : zr;
  const tg = new THREE.PlaneGeometry(x1 - x0, zEnd - zStart, nx, nz);
  tg.rotateX(-Math.PI / 2); tg.translate((x0 + x1) / 2, 0, (zStart + zEnd) / 2);
  const p = tg.attributes.position, colors = new Float32Array(p.count * 3), uv = tg.attributes.uv;
  const gA = col(cfg.ground[0]), gB = col(cfg.ground[1]), pA = col(cfg.patch[0]), pB = col(cfg.patch[1]), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), hgt = hillAt(x, z);
    p.setY(i, hgt);
    const t = smooth(zr, zOf(H), z), n = fbm(x / 120 + w * 5, z / 120), n2 = fbm(x / 34 + 9, z / 34);
    tmp.copy(gA).lerp(gB, t);
    tmp.lerp(n > 0.5 ? pA : pB, Math.abs(n - 0.5) * 1.3 * (0.5 + n2 * 0.7));
    tmp.multiplyScalar(0.9 + n2 * 0.2 + clamp(hgt / 80) * 0.12);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    uv.setXY(i, x / 150, z / 150);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(colors, 3)); tg.computeVertexNormals(); own.push(tg);
  const gtex = groundTexture(cfg.tex, r);
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: gtex, roughness: cfg.gloss !== undefined ? 1 - cfg.gloss : 0.92, metalness: 0, envMapIntensity: cfg.gloss ? 0.9 : 0.35 }));
  terrain.receiveShadow = true; scene.add(terrain);

  if (cfg.sea) addSea(scene, cfg, zOf(cfg.sea.shoreY), zOf(cfg.ridge), own, r);

  // the road
  const curve = roadCurve(pts, H), wide = cfg.road.wide ?? 1, hw = 34 * wide;
  const rz = curve.map(([x, y]) => new THREE.Vector3(x, 0, zOf(y)));
  rz.forEach((v) => { v.y = hillAt(v.x, v.z); });
  addRoad(scene, cfg, rz, hw, own);

  // plinths under the level buttons
  pts.forEach(([x, y], i) => {
    const boss = i === pts.length - 1 || y === Math.min(...pts.map((q) => q[1])), z = zOf(y), rad = boss ? 62 : 48, base = hillAt(x, z) + 4.5;
    put(scene, G.cyl(), mat(cfg.plinth, { r: 0.35, env: 1.2 }), x, base + 2, z, { s: [rad + 5, 6, rad + 5], cast: true });
    put(scene, G.cyl(), mat(boss ? 0xfde047 : tone(cfg.road.fill, 0.15), { r: 0.45 }), x, base + 5, z, { s: [rad, 4, rad] });
  });

  // props
  const roadPx = curve;
  const nearRoad = (x: number, y: number): number => { let m = 1e9; for (let i = 0; i < roadPx.length; i += 2) { const d = Math.hypot(roadPx[i][0] - x, roadPx[i][1] - y); if (d < m) m = d; } return m; };
  const items: { x: number; z: number; g: THREE.Group; fp: number }[] = [];
  const placeLayer = (Lr: Layer) => {
    let placed = 0, tries = 0;
    const want = Math.round(Lr.n * 1.3);
    while (placed < want && tries++ < want * 40) {
      const y = range(r, Lr.y[0], Lr.y[1]), x = range(r, -10, MAP_W + 10), d = nearRoad(x, y);
      if (d < (Lr.edge ? 112 : 96) * wide || (Lr.edge && d > 280)) continue;
      const g = Lr.fn(r), s = range(r, Lr.s[0], Lr.s[1]) * 1.25;
      g.scale.multiplyScalar(s);
      const z = zOf(y), ground = hillAt(x, z);
      g.position.set(x, ground + (Lr.lift ? range(r, Lr.lift[0], Lr.lift[1]) : 0), z);
      g.rotation.y += (r() - 0.5) * 0.5;
      items.push({ x, z, g, fp: (Lr.fp ?? 20) * s });
      scene.add(g); placed++;
    }
  };
  cfg.props.forEach(placeLayer);
  cfg.far.forEach((F) => {
    for (let i = 0; i < F.n; i++) {
      const x = ((i + 0.5) / F.n) * (MAP_W + 160) - 80 + (r() - 0.5) * 40, z = zr + range(r, F.dz[0], F.dz[1]), g = F.fn(r), s = range(r, F.s[0], F.s[1]);
      g.scale.multiplyScalar(s); g.position.set(x, hillAt(x, z) + (F.lift ?? 0), z); scene.add(g);
    }
  });
  cfg.sky3d?.forEach((F) => { for (let i = 0; i < F.n; i++) { const x = r() * MAP_W, ys = range(r, 18, cfg.ridge - 40), g = F.fn(r), s = range(r, F.s[0], F.s[1]); const zz = zr - 60; g.scale.multiplyScalar(s); g.position.set(x, (zz * S - ys) / C, zz); scene.add(g); } });

  // contact shadows: soft dark discs under things (the shadow map handles the long shadows)
  const dm = new THREE.MeshBasicMaterial({ map: softDisc(), color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false });
  for (const it of items) {
    if (it.fp < 3) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), dm); m.rotation.x = -Math.PI / 2; m.scale.set(it.fp * 2.6, it.fp * 2.0, 1); m.position.set(it.x, hillAt(it.x, it.z) + 0.5, it.z); m.renderOrder = 1; scene.add(m);
  }

  // the world's landmark scene mood: ambient light motes
  addMotes(scene, cfg, H, r, hillAt, zOf);
  scene.traverse((o) => { const ud = (o as THREE.Object3D).userData?.own as THREE.BufferGeometry[] | undefined; if (ud) own.push(...ud); });
  return { scene, camera, own, cfg, fogDepth: (y) => [depthAt(y), 0] };
}

function skyTexture(cfg: Cfg, H: number, r: Rng): THREE.CanvasTexture {
  return paint(MAP_W, H, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, cfg.ridge + 40);
    gr.addColorStop(0, css(cfg.sky[0])); gr.addColorStop(0.55, css(cfg.sky[1])); gr.addColorStop(1, css(cfg.sky[2]));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (cfg.stars) for (let i = 0; i < 160; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.fillStyle = '#fff'; g.beginPath(); g.arc(r() * w, r() * (cfg.ridge + 30), 0.5 + r() * 1.4, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    if (cfg.orb) {
      const { x, y, r: rr, c, moon } = cfg.orb, hr = g.createRadialGradient(x, y, rr * 0.2, x, y, rr * 4);
      hr.addColorStop(0, css(c) + 'cc'); hr.addColorStop(0.3, css(c) + '55'); hr.addColorStop(1, css(c) + '00'); g.fillStyle = hr; g.fillRect(x - rr * 4, y - rr * 4, rr * 8, rr * 8);
      const dg = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr); dg.addColorStop(0, '#ffffff'); dg.addColorStop(1, css(c)); g.fillStyle = dg; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
      if (moon) { g.fillStyle = 'rgba(120,110,150,0.35)'; for (const [dx, dy, s] of [[-0.3, -0.2, 0.2], [0.35, 0.25, 0.28], [0.1, -0.5, 0.12], [-0.2, 0.4, 0.14]]) { g.beginPath(); g.arc(x + dx * rr, y + dy * rr, s * rr, 0, 7); g.fill(); } }
    }
  });
}

function addSea(scene: THREE.Scene, cfg: Cfg, zShore: number, zHorizon: number, own: THREE.BufferGeometry[], r: Rng): void {
  const sea = cfg.sea!, g = new THREE.PlaneGeometry(MAP_W + 80, zShore - zHorizon + 60, 90, 40);
  g.rotateX(-Math.PI / 2); g.translate(MAP_W / 2, 0, (zShore + zHorizon) / 2 - 20);
  const p = g.attributes.position, c = new Float32Array(p.count * 3), a = col(sea.deep), b = col(sea.mid), s = col(sea.shore), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i), t = clamp((z - zHorizon) / (zShore - zHorizon)); p.setY(i, -3 + Math.sin(p.getX(i) * 0.05 + z * 0.08) * 0.8); tmp.copy(a).lerp(b, smooth(0, 0.6, t)).lerp(s, smooth(0.6, 1, t)); c.set([tmp.r, tmp.g, tmp.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); own.push(g);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.05, envMapIntensity: 1.5 })); m.receiveShadow = true; scene.add(m);
  // foam line along the shore plus a few sparkle ripples
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W + 60, 14, 80, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(MAP_W / 2, 0.2, zShore - 2);
  const fp = foam.geometry.attributes.position; for (let i = 0; i < fp.count; i++) fp.setY(i, fp.getY(i) + Math.sin(fp.getX(i) * 0.04) * 6);
  scene.add(foam); own.push(foam.geometry);
  void r;
}

function addRoad(scene: THREE.Scene, cfg: Cfg, line: THREE.Vector3[], hw: number, own: THREE.BufferGeometry[]): void {
  const prof: [number, number][] = [[-hw - 11, 0], [-hw - 7, 5.5], [-hw - 2.5, 7], [-hw, 5], [hw, 5], [hw + 2.5, 7], [hw + 7, 5.5], [hw + 11, 0]];
  const strips = [cfg.road.edge, cfg.road.edge2, cfg.road.fill, cfg.road.fill, cfg.road.fill, cfg.road.edge2, cfg.road.edge];
  const n = line.length, len: number[] = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + line[i].distanceTo(line[i - 1]));
  const tex = paint(256, 256, (g, w, h) => { g.fillStyle = '#ececec'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.globalAlpha = 0.18; g.fillStyle = Math.random() > 0.5 ? '#fff' : '#555'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } }, { repeat: true });
  for (let s = 0; s < strips.length; s++) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
      const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      for (const k of [s, s + 1]) { const [o, hgt] = prof[k]; pos.push(line[i].x + nx * o, line[i].y + hgt, line[i].z + nz * o); uv.push((k - s) * 0.4, len[i] / 120); }
      if (i < n - 1) { const b0 = i * 2; idx.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // normals must point up: flip when the winding came out downwards
    const nrm = g.attributes.normal; if (nrm.getY(0) < 0) { for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i)); const ix = g.index!; for (let i = 0; i < ix.count; i += 3) { const t = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, t); } }
    own.push(g);
    const edgeStrip = s === 0 || s === 6 || s === 1 || s === 5;
    const m = new THREE.MeshStandardMaterial({ color: strips[s], map: tex, roughness: cfg.road.glow ? 0.35 : 0.78, metalness: 0, emissive: cfg.road.glow && edgeStrip ? strips[s] : 0x000000, emissiveIntensity: cfg.road.glow && edgeStrip ? 0.9 : 0, envMapIntensity: 0.6 });
    const me = new THREE.Mesh(g, m); me.castShadow = true; me.receiveShadow = true; scene.add(me);
  }
  // centre dashes
  const dash = cfg.road.dash ?? 16, gap = dash * 1.1, m = mat(cfg.road.mark, { r: 0.5, vc: false, e: cfg.road.glow ? 1.4 : 0, ec: cfg.road.mark });
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += line[i].distanceTo(line[i - 1]);
    if (acc < dash + gap) continue; acc = 0;
    const a = line[i - 1], b = line[i], ang = Math.atan2(b.x - a.x, b.z - a.z);
    const d = new THREE.Mesh(G.box(), m); d.geometry = G.box(); d.scale.set(3.4, 1.4, dash); d.position.set(b.x, b.y + 5.6, b.z); d.rotation.y = ang; d.receiveShadow = true; scene.add(d);
  }
}

function addMotes(scene: THREE.Scene, cfg: Cfg, H: number, r: Rng, hillAt: (x: number, z: number) => number, zOf: (y: number) => number): void {
  const n = cfg.speckKind === 'snow' ? 140 : 90, pos = new Float32Array(n * 3), colr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = r() * MAP_W, y = range(r, cfg.ridge - 20, H), z = zOf(y), lift = range(r, 6, 70);
    pos.set([x, hillAt(x, z) + lift, z], i * 3); const c = col(pick(r, cfg.speck)); colr.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  const pm = new THREE.PointsMaterial({ size: cfg.speckKind === 'snow' ? 6 : 7, map: softDisc(), vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, fog: false });
  scene.add(new THREE.Points(g, pm));
}

// ───────────── rendering ─────────────
export interface MapRenderer { render(w: number, h: number, pts: Pt[], scale: number): Promise<Blob>; dispose(): void }

export function createMapRenderer(): MapRenderer {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(); const envTex = pm.fromScene(room, 0.04).texture; room.dispose?.();
  return {
    render: (w, h, pts, scale) => new Promise<Blob>((resolve, reject) => {
      try {
        const b = buildWorld(w, h, pts);
        b.scene.environment = envTex;
        const W = Math.round(MAP_W * scale), Hh = Math.round(h * scale);
        renderer.setPixelRatio(1); renderer.setSize(W, Hh, false);
        renderer.render(b.scene, b.camera);
        const out = document.createElement('canvas'); out.width = W; out.height = Hh;
        const g = out.getContext('2d')!;
        g.drawImage(canvas, 0, 0);
        finish(g, W, Hh, b.cfg);
        out.toBlob((blob) => {
          cleanup(b.scene);
          if (blob) resolve(blob); else reject(new Error('toBlob failed'));
        }, 'image/jpeg', 0.9);
      } catch (e) { reject(e); }
    }),
    dispose: () => { envTex.dispose(); pm.dispose(); renderer.dispose(); },
  };
}

function cleanup(scene: THREE.Scene): void {
  const mats = new Set<THREE.Material>();
  scene.traverse((o) => {
    const m = o as THREE.Mesh & THREE.DirectionalLight;
    if (m.isLight && (m as THREE.DirectionalLight).shadow) (m as THREE.DirectionalLight).dispose();
    if (m.geometry) m.geometry.dispose();
    const ms = (m as THREE.Mesh).material; if (ms) (Array.isArray(ms) ? ms : [ms]).forEach((x) => mats.add(x));
  });
  mats.forEach((x) => { const t = x as THREE.MeshStandardMaterial; t.map?.dispose(); t.emissiveMap?.dispose(); x.dispose(); });
  (scene.background as THREE.Texture | null)?.dispose();
  disposeKit();
  P.releaseProps();
}

/** 2-D finish: soft vignette and a gentle warm/cool split tone, so the render feels graded instead of raw. */
function finish(g: CanvasRenderingContext2D, W: number, H: number, cfg: Cfg): void {
  const v = g.createRadialGradient(W / 2, H * 0.52, W * 0.35, W / 2, H * 0.52, Math.max(W, H) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, cfg.stars ? 'rgba(0,0,10,0.38)' : 'rgba(20,10,30,0.2)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'soft-light';
  const t = g.createLinearGradient(0, 0, 0, H); t.addColorStop(0, 'rgba(120,170,255,0.18)'); t.addColorStop(1, 'rgba(255,210,150,0.2)');
  g.fillStyle = t; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}
