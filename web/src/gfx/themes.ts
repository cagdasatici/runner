// Visual themes: one per journey world (1…12) plus the menu and the endless run. Pure data, no THREE objects.
// Colours are 0xRRGGBB (sRGB). `applyTheme` in game.ts / world.ts turns them into sky, fog, lights, grading and scenery.

export type PropKind = 'tree' | 'pine' | 'palm' | 'cactus' | 'crystal' | 'lolly' | 'container' | 'rock' | 'pylon';
export type BackdropKind = 'city' | 'hills' | 'mesas' | 'islands' | 'planet' | 'candy' | 'volcano' | 'peaks';

export interface Livery { body: number; accent: number }

export interface Theme {
  id: string;
  name: string;
  /** Sky gradient, top → horizon (the horizon colour should match the fog). */
  sky: { top: number; mid: number; horizon: number; below: number };
  cloud: { color: number; alpha: number; count: number };
  stars: number;              // 0…1 star density in the sky
  orb: { color: number; size: number; height: number } | null; // sun or moon disc in front of the runner
  fog: { color: number; near: number; far: number };
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number };
  /** Colour grading in the composite pass: multiplies the image, then saturation and contrast. */
  grade: { tint: [number, number, number]; saturation: number; contrast: number };
  bloom: { strength: number; threshold: number };
  ground: { side: number; path: number; gravel: number };  // verges beyond the lots, pavement beside the track, ballast tint
  buildings: number[];        // wall colours
  roof: number;
  windowGlow: number;         // how brightly the lit windows shine (0 day … 1.6 night)
  neon: number[];             // sign / trim glow colours
  prop: PropKind;
  propColors: { a: number; b: number; trunk: number };
  snow: boolean;              // snow caps and falling flakes
  backdrop: { kind: BackdropKind; color: number; far: number };
  trains: Livery[];
}

const L = (body: number, accent: number): Livery => ({ body, accent });

export const MENU_THEME_ID = 'menu';
export const ENDLESS_THEME_ID = 'endless';

const THEME_LIST: Theme[] = [
  { // 1 – sunny city
    id: 'sunny-city', name: 'Sunny City',
    sky: { top: 0x2f7be8, mid: 0x4fb0f5, horizon: 0xa8dcf7, below: 0xa8dcf7 },
    cloud: { color: 0xffffff, alpha: 0.9, count: 16 }, stars: 0,
    orb: { color: 0xfff6c8, size: 26, height: 0.2 },
    fog: { color: 0xb8e2f8, near: 48, far: 128 },
    hemi: { sky: 0xdff1ff, ground: 0xa89c86, intensity: 1.55 },
    sun: { color: 0xfff0d2, intensity: 2.5 },
    grade: { tint: [1.02, 1.0, 0.98], saturation: 1.14, contrast: 1.06 },
    bloom: { strength: 0.18, threshold: 0.86 },
    ground: { side: 0x7ed957, path: 0xe2dfd8, gravel: 0xffffff },
    buildings: [0xf5a3a0, 0xf7cb6a, 0x8fd9b6, 0x82b9f0, 0xb9a6ee, 0xf3a6cf, 0xf8b27a, 0x7fd8d0],
    roof: 0x5b6b82, windowGlow: 0.05, neon: [0xff4d6d, 0x38bdf8, 0xfacc15],
    prop: 'tree', propColors: { a: 0x35c46a, b: 0x7be07a, trunk: 0x9a5b2e }, snow: false,
    backdrop: { kind: 'city', color: 0x9db8d6, far: 0.55 },
    trains: [L(0xe8434f, 0xfacc15), L(0x2f7be8, 0xffffff), L(0x14b8a6, 0xfacc15)],
  },
  { // 2 – sunset
    id: 'golden-sunset', name: 'Golden Sunset',
    sky: { top: 0x6a3fa0, mid: 0xf2788a, horizon: 0xffc680, below: 0xffc680 },
    cloud: { color: 0xffd1b0, alpha: 0.85, count: 14 }, stars: 0.05,
    orb: { color: 0xfff1b0, size: 40, height: 0.02 },
    fog: { color: 0xffc07c, near: 42, far: 122 },
    hemi: { sky: 0xffd6b0, ground: 0x8a6a74, intensity: 1.35 },
    sun: { color: 0xffb86b, intensity: 2.8 },
    grade: { tint: [1.04, 0.99, 0.94], saturation: 1.12, contrast: 1.05 },
    bloom: { strength: 0.12, threshold: 0.9 },
    ground: { side: 0xc9a05a, path: 0xe8cdb0, gravel: 0xffe3c8 },
    buildings: [0xe58b6e, 0xf2b46d, 0xd96f8b, 0xb979c9, 0xf0cf79, 0xe9967a],
    roof: 0x6b4a6e, windowGlow: 0.5, neon: [0xff6f91, 0xffc75f, 0xff9671],
    prop: 'palm', propColors: { a: 0x2e9c5a, b: 0x58c06a, trunk: 0x8a5a3a }, snow: false,
    backdrop: { kind: 'city', color: 0x7a4a86, far: 0.6 },
    trains: [L(0xf25c54, 0xffe08a), L(0x8a4fff, 0xffc75f), L(0xff8f3f, 0xffffff)],
  },
  { // 3 – neon night
    id: 'neon-night', name: 'Neon Night',
    sky: { top: 0x0b0a2e, mid: 0x2a1670, horizon: 0x7a2fa8, below: 0x2a1456 },
    cloud: { color: 0x7a5ad0, alpha: 0.35, count: 10 }, stars: 1,
    orb: { color: 0xdfe8ff, size: 20, height: 0.28 },
    fog: { color: 0x4a1f78, near: 36, far: 112 },
    hemi: { sky: 0x9a9aff, ground: 0x4a3078, intensity: 1.7 },
    sun: { color: 0xa9b8ff, intensity: 1.5 },
    grade: { tint: [1.0, 0.99, 1.04], saturation: 1.12, contrast: 1.06 },
    bloom: { strength: 0.4, threshold: 0.78 },
    ground: { side: 0x2c1b5a, path: 0x6a5fa0, gravel: 0xa090d8 },
    buildings: [0x4b3a8f, 0x3a4c9a, 0x6a3a8f, 0x2f5f9a, 0x7a3f7f, 0x3f3f8a],
    roof: 0x251a50, windowGlow: 1.7, neon: [0xff2fa8, 0x22e6ff, 0xb6ff3a, 0xffd23f],
    prop: 'crystal', propColors: { a: 0x22e6ff, b: 0xff2fa8, trunk: 0x3b2a6a }, snow: false,
    backdrop: { kind: 'city', color: 0x2a1b66, far: 0.5 },
    trains: [L(0x3a2a8a, 0x22e6ff), L(0x7a1fa2, 0xff2fa8), L(0x1a4aa0, 0xb6ff3a)],
  },
  { // 4 – snow village
    id: 'snow-village', name: 'Snow Village',
    sky: { top: 0x7aa8e0, mid: 0x8fbdf0, horizon: 0xcfe5f8, below: 0xcfe5f8 },
    cloud: { color: 0xffffff, alpha: 0.95, count: 18 }, stars: 0,
    orb: { color: 0xffffff, size: 18, height: 0.16 },
    fog: { color: 0xd6e8f8, near: 38, far: 112 },
    hemi: { sky: 0xe3f0ff, ground: 0x9fb2c8, intensity: 1.6 },
    sun: { color: 0xf3f6ff, intensity: 2.2 },
    grade: { tint: [0.98, 1.0, 1.04], saturation: 1.1, contrast: 1.05 },
    bloom: { strength: 0.2, threshold: 0.88 },
    ground: { side: 0xf4f8fc, path: 0xdce8f2, gravel: 0xe6f0fa },
    buildings: [0xd9825f, 0xc9a06a, 0xb8604f, 0xe0b878, 0x9a6a58, 0xc7794f],
    roof: 0xf6fbff, windowGlow: 0.55, neon: [0xff6b6b, 0x6bd0ff, 0xffe066],
    prop: 'pine', propColors: { a: 0x2f8f6a, b: 0x4ab08a, trunk: 0x7a4a2a }, snow: true,
    backdrop: { kind: 'peaks', color: 0xb5cce6, far: 0.6 },
    trains: [L(0xd8433f, 0xffffff), L(0x2e86c1, 0xffffff), L(0x2f9e6e, 0xffe066)],
  },
  { // 5 – desert canyon
    id: 'desert-canyon', name: 'Desert Canyon',
    sky: { top: 0x3b9fe0, mid: 0x6cc0ec, horizon: 0xfde6b8, below: 0xfde6b8 },
    cloud: { color: 0xfff6e6, alpha: 0.7, count: 8 }, stars: 0,
    orb: { color: 0xfffbe0, size: 30, height: 0.3 },
    fog: { color: 0xf8dfb0, near: 46, far: 126 },
    hemi: { sky: 0xfff0d0, ground: 0xb08a5a, intensity: 1.55 },
    sun: { color: 0xffe4b0, intensity: 2.7 },
    grade: { tint: [1.06, 1.0, 0.92], saturation: 1.15, contrast: 1.07 },
    bloom: { strength: 0.2, threshold: 0.86 },
    ground: { side: 0xe5b872, path: 0xeed9b4, gravel: 0xffe2b0 },
    buildings: [0xe3a874, 0xd98c5f, 0xf0c48a, 0xc8764f, 0xe8b27c, 0xdb9a6a],
    roof: 0x9a5a3a, windowGlow: 0.05, neon: [0x2ec4b6, 0xff6b35, 0xffd23f],
    prop: 'cactus', propColors: { a: 0x3fae5a, b: 0x6bc46a, trunk: 0x9a6a3a }, snow: false,
    backdrop: { kind: 'mesas', color: 0xd8946a, far: 0.6 },
    trains: [L(0xd8613a, 0xffe08a), L(0x2a9d8f, 0xffffff), L(0xe9b44c, 0x7a3a1a)],
  },
  { // 6 – jungle
    id: 'jungle-rush', name: 'Jungle Rush',
    sky: { top: 0x1f9a8f, mid: 0x6fd0b0, horizon: 0xdff7d0, below: 0xdff7d0 },
    cloud: { color: 0xf4fff0, alpha: 0.8, count: 12 }, stars: 0,
    orb: { color: 0xfffbd0, size: 24, height: 0.34 },
    fog: { color: 0xc4ecc6, near: 36, far: 110 },
    hemi: { sky: 0xd8ffe0, ground: 0x5a7a4a, intensity: 1.55 },
    sun: { color: 0xfff2c0, intensity: 2.4 },
    grade: { tint: [0.97, 1.05, 0.97], saturation: 1.22, contrast: 1.06 },
    bloom: { strength: 0.2, threshold: 0.86 },
    ground: { side: 0x3fb05a, path: 0xc8c09a, gravel: 0xd8e0b8 },
    buildings: [0x8a7a58, 0x6f9a62, 0xb08a5a, 0x5f8a5a, 0xa8905a, 0x7a9a6a],
    roof: 0x3f6b3a, windowGlow: 0.1, neon: [0xff6b35, 0xffd23f, 0x2ee6a6],
    prop: 'palm', propColors: { a: 0x1f9a4a, b: 0x4cc45a, trunk: 0x7a4a2a }, snow: false,
    backdrop: { kind: 'hills', color: 0x4a9a6a, far: 0.7 },
    trains: [L(0x2f9e5a, 0xffd23f), L(0xe0742c, 0xffffff), L(0x2a7fc4, 0xffd23f)],
  },
  { // 7 – harbour
    id: 'harbour-bay', name: 'Harbour Bay',
    sky: { top: 0x1f88e0, mid: 0x4aaaf0, horizon: 0xa6d8f5, below: 0xa6d8f5 },
    cloud: { color: 0xffffff, alpha: 0.9, count: 14 }, stars: 0,
    orb: { color: 0xfffadc, size: 24, height: 0.24 },
    fog: { color: 0xb4dcf4, near: 44, far: 124 },
    hemi: { sky: 0xd8efff, ground: 0x8a9aa8, intensity: 1.55 },
    sun: { color: 0xfff4dc, intensity: 2.5 },
    grade: { tint: [0.99, 1.01, 1.03], saturation: 1.15, contrast: 1.06 },
    bloom: { strength: 0.2, threshold: 0.86 },
    ground: { side: 0x2f93dc, path: 0xcfd6dc, gravel: 0xe0e6ee },
    buildings: [0xe9eef3, 0xf2d4a0, 0xd4e4f2, 0xf0b6a8, 0xc8d8e8, 0xe6e0c8],
    roof: 0x5a6b7e, windowGlow: 0.05, neon: [0xff5a5f, 0xffc857, 0x2ec4b6],
    prop: 'container', propColors: { a: 0xe8434f, b: 0x2f7be8, trunk: 0xf5b82e }, snow: false,
    backdrop: { kind: 'islands', color: 0x7fa9c8, far: 0.7 },
    trains: [L(0x1f6fd0, 0xffc857), L(0xe8434f, 0xffffff), L(0x2a9d8f, 0xffc857)],
  },
  { // 8 – space station
    id: 'space-station', name: 'Space Station',
    sky: { top: 0x04051a, mid: 0x151a4a, horizon: 0x3a3a96, below: 0x1a1c52 },
    cloud: { color: 0x6a6aff, alpha: 0.2, count: 6 }, stars: 1,
    orb: { color: 0xff9a6a, size: 60, height: 0.35 },
    fog: { color: 0x23266a, near: 38, far: 118 },
    hemi: { sky: 0x9aa4ff, ground: 0x303466, intensity: 1.3 },
    sun: { color: 0xdfe6ff, intensity: 1.9 },
    grade: { tint: [0.97, 0.99, 1.08], saturation: 1.22, contrast: 1.1 },
    bloom: { strength: 0.35, threshold: 0.78 },
    ground: { side: 0x1a1e50, path: 0x8890c8, gravel: 0xb8c0f0 },
    buildings: [0x9aa8d0, 0x7e8ec0, 0xb8c0dc, 0x6a7ab0, 0xa0a8e0, 0x8a98c8],
    roof: 0x39406e, windowGlow: 1.4, neon: [0x3ae6ff, 0xff4fd8, 0x9aff5a],
    prop: 'pylon', propColors: { a: 0x3ae6ff, b: 0xff4fd8, trunk: 0x7a86b8 },  snow: false,
    backdrop: { kind: 'planet', color: 0x3a3a9a, far: 0.5 },
    trains: [L(0xd8def0, 0x3ae6ff), L(0x7a6af0, 0xff4fd8), L(0xf0f2fa, 0xff9a3a)],
  },
  { // 9 – candy land
    id: 'candy-land', name: 'Candy Land',
    sky: { top: 0xb78af0, mid: 0xf5a6e0, horizon: 0xffe6f4, below: 0xffe6f4 },
    cloud: { color: 0xffffff, alpha: 0.95, count: 16 }, stars: 0,
    orb: { color: 0xfff2fa, size: 26, height: 0.3 },
    fog: { color: 0xffd9ee, near: 42, far: 120 },
    hemi: { sky: 0xffe6f6, ground: 0xc09ab8, intensity: 1.6 },
    sun: { color: 0xfff0f8, intensity: 2.3 },
    grade: { tint: [1.03, 0.99, 1.04], saturation: 1.28, contrast: 1.04 },
    bloom: { strength: 0.25, threshold: 0.86 },
    ground: { side: 0xff9fd0, path: 0xfff0f6, gravel: 0xffe0ee },
    buildings: [0xff9fc4, 0xa8e6cf, 0xffe28a, 0xb8a6ff, 0x9fd8ff, 0xffb48a],
    roof: 0xd96ab0, windowGlow: 0.2, neon: [0xff4fa0, 0x4fd8ff, 0xffe04f],
    prop: 'lolly', propColors: { a: 0xff5fa8, b: 0x5fd0ff, trunk: 0xffffff }, snow: false,
    backdrop: { kind: 'candy', color: 0xf09ac8, far: 0.6 },
    trains: [L(0xff6fb0, 0xffffff), L(0x5fc8ff, 0xffe04f), L(0xa98bff, 0xffffff)],
  },
  { // 10 – volcano
    id: 'volcano-ridge', name: 'Volcano Ridge',
    sky: { top: 0x3a0f20, mid: 0xb53a28, horizon: 0xff9a4a, below: 0xff8a3a },
    cloud: { color: 0x7a3a3a, alpha: 0.6, count: 12 }, stars: 0.1,
    orb: { color: 0xffd09a, size: 34, height: 0.08 },
    fog: { color: 0xe8703a, near: 34, far: 106 },
    hemi: { sky: 0xffd0b0, ground: 0x7a4a40, intensity: 1.5 },
    sun: { color: 0xffa860, intensity: 2.5 },
    grade: { tint: [1.03, 0.98, 0.95], saturation: 1.08, contrast: 1.05 },
    bloom: { strength: 0.22, threshold: 0.82 },
    ground: { side: 0x3a2622, path: 0xa08878, gravel: 0xe8d8cc },
    buildings: [0x5a4640, 0x6a4a42, 0x4a3a38, 0x7a544a, 0x58423e, 0x6a5048],
    roof: 0x2e2220, windowGlow: 1.2, neon: [0xff6a1a, 0xffc21a, 0xff3a3a],
    prop: 'rock', propColors: { a: 0x6a5a58, b: 0xff7a1a, trunk: 0x3a2e2c }, snow: false,
    backdrop: { kind: 'volcano', color: 0x4a1f24, far: 0.55 },
    trains: [L(0x3a3a46, 0xff8a1a), L(0xc4361f, 0xffd23f), L(0x5a4a8a, 0xff6a1a)],
  },
  { // 11 – autumn park
    id: 'autumn-park', name: 'Autumn Park',
    sky: { top: 0x4f9ade, mid: 0x7fbcf0, horizon: 0xfff0d0, below: 0xfff0d0 },
    cloud: { color: 0xfffaf0, alpha: 0.9, count: 14 }, stars: 0,
    orb: { color: 0xfff2c0, size: 26, height: 0.22 },
    fog: { color: 0xf8e6c0, near: 44, far: 124 },
    hemi: { sky: 0xfff0d8, ground: 0xa08060, intensity: 1.5 },
    sun: { color: 0xffe2b0, intensity: 2.6 },
    grade: { tint: [1.05, 1.0, 0.93], saturation: 1.2, contrast: 1.07 },
    bloom: { strength: 0.2, threshold: 0.86 },
    ground: { side: 0xb8c45a, path: 0xe6d6b8, gravel: 0xf4e4c4 },
    buildings: [0xb85a45, 0xc9794f, 0xd9a05a, 0xa8584a, 0xc58a5a, 0xe0b070],
    roof: 0x6a4034, windowGlow: 0.15, neon: [0xff7a2f, 0xffc233, 0xd9442f],
    prop: 'tree', propColors: { a: 0xf08a2a, b: 0xe0442f, trunk: 0x7a4a2a }, snow: false,
    backdrop: { kind: 'hills', color: 0xd6a060, far: 0.65 },
    trains: [L(0xc8402f, 0xffd23f), L(0x2e7d6a, 0xffe6a0), L(0xe08a2c, 0x6a3a1a)],
  },
  { // 12 – crystal dreams
    id: 'crystal-dreams', name: 'Crystal Dreams',
    sky: { top: 0x1a1a6a, mid: 0x2a6ab0, horizon: 0x8ae0e0, below: 0x2a5a9a },
    cloud: { color: 0xa0ffe0, alpha: 0.45, count: 12 }, stars: 0.8,
    orb: { color: 0xeaffff, size: 28, height: 0.3 },
    fog: { color: 0x6ad0d8, near: 38, far: 114 },
    hemi: { sky: 0xb8f0ff, ground: 0x4a6aa8, intensity: 1.45 },
    sun: { color: 0xd0f4ff, intensity: 2.2 },
    grade: { tint: [0.96, 1.03, 1.06], saturation: 1.3, contrast: 1.08 },
    bloom: { strength: 0.3, threshold: 0.8 },
    ground: { side: 0x6ab8e8, path: 0xbfe8f4, gravel: 0xd0f0ff },
    buildings: [0x8ad4f0, 0xa89cf0, 0x7ae6d0, 0xc4a0f4, 0x78c0f4, 0x9ae0e8],
    roof: 0x4a6ab0, windowGlow: 0.9, neon: [0x5affd8, 0xc07aff, 0x7ad0ff],
    prop: 'crystal', propColors: { a: 0x5affd8, b: 0xc07aff, trunk: 0x7aa0d8 }, snow: true,
    backdrop: { kind: 'peaks', color: 0x3a78c0, far: 0.55 },
    trains: [L(0x3aa8e8, 0x5affd8), L(0x8a5af0, 0xffffff), L(0x2ac8b0, 0xc07aff)],
  },
];

const MENU: Theme = {
  ...THEME_LIST[1],
  id: MENU_THEME_ID, name: 'Menu',
  sky: { top: 0x3f6fd8, mid: 0xf08ab0, horizon: 0xffd29a, below: 0xffd29a },
  fog: { color: 0xffd29a, near: 38, far: 112 },
  hemi: { sky: 0xffe2c4, ground: 0x8f7480, intensity: 1.4 },
  grade: { tint: [1.06, 0.99, 0.93], saturation: 1.22, contrast: 1.08 },
  bloom: { strength: 0.14, threshold: 0.9 },
  prop: 'tree', propColors: { a: 0x35c46a, b: 0x7be07a, trunk: 0x9a5b2e },
};

const ENDLESS: Theme = {
  ...THEME_LIST[0],
  id: ENDLESS_THEME_ID, name: 'Rainbow Metro',
  sky: { top: 0x3a6ff0, mid: 0x7dd3fc, horizon: 0xe6f6ff, below: 0xe6f6ff },
  fog: { color: 0xe6f6ff, near: 48, far: 128 },
  grade: { tint: [1.02, 1.0, 1.0], saturation: 1.2, contrast: 1.07 },
  buildings: [0xff7f7f, 0xffc857, 0x6ee7b7, 0x60a5fa, 0xc4a1ff, 0xff8ad8, 0xff9f5a, 0x5eead4],
  trains: [L(0xe8434f, 0xfacc15), L(0x2f7be8, 0xffffff), L(0x14b8a6, 0xfacc15), L(0x8b5cf6, 0xfde047)],
};

export const THEMES: Readonly<Record<string, Theme>> = Object.fromEntries(
  [...THEME_LIST, MENU, ENDLESS].map((t) => [t.id, t]));

export const WORLD_THEMES: readonly Theme[] = THEME_LIST;
export const MENU_THEME: Theme = MENU;
export const ENDLESS_THEME: Theme = ENDLESS;

/** Theme of journey world 1…12 (clamped, so a bad number never crashes the renderer). */
export function themeForWorld(world: number): Theme {
  const i = Math.min(THEME_LIST.length, Math.max(1, Math.trunc(world) || 1)) - 1;
  return THEME_LIST[i];
}
