// Port of App/Materials.swift. Shared materials keep draw cost low.
// Lambert (cheap) for most things; Standard (PBR) only where shine matters (rails, coins, train).
import * as THREE from 'three';
import * as T from './textures';

const lambert = (color: number, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
const std = (color: number, roughness: number, metalness: number, emissive = 0x000000) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive });
const mapped = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });

export function createMaterials() {
  return {
    // character
    skin: lambert(0xf2c29b),
    hoodie: lambert(0x14b8a6),
    pants: lambert(0x1e3a8a),
    cap: lambert(0xef4444),
    shoe: lambert(0xf8fafc),
    sole: lambert(0xf97316),
    backpack: lambert(0xf59e0b),
    eyeWhite: lambert(0xffffff),
    pupil: lambert(0x111827),
    hair: lambert(0x5b3a1e),
    cheek: lambert(0xf9a8a8),
    // track and city
    gravel: mapped(T.gravelTexture()),
    wood: mapped(T.woodTexture()),
    rail: std(0xcbd5e1, 0.3, 0.9),
    railBase: lambert(0x57534e),
    concrete: lambert(0xd6d3d1),
    curbStripe: lambert(0xfacc15),
    roof: lambert(0x475569),
    pole: lambert(0x334155),
    lamp: lambert(0xfff7d6, 0xffe9a8),
    leaf: lambert(0x22c55e),
    trunk: lambert(0x92400e),
    grass: lambert(0x4ade80),
    facades: T.BUILDING_COLORS.map((c) => mapped(T.facadeTexture(c))),
    // obstacles
    hurdleStripes: mapped(T.stripesTexture(0xef4444, 0xffffff)),
    barStripes: mapped(T.stripesTexture(0xfacc15, 0x111827)),
    darkMetal: lambert(0x1f2937),
    warning: lambert(0xef4444, 0xff3b3b),
    trainSide: new THREE.MeshStandardMaterial({ map: T.trainSideTexture(), roughness: 0.4, metalness: 0.1 }),
    trainFront: new THREE.MeshStandardMaterial({ map: T.trainFrontTexture(), roughness: 0.4, metalness: 0.1 }),
    trainRoof: lambert(0xcbd5e1),
    trainBottom: lambert(0x1f2937),
    headlight: lambert(0xffffff, 0xfff3c4),
    wheel: lambert(0x111827),
    // coins
    gold: std(0xfbbf24, 0.25, 0.9, 0x5c3d00),
    goldDark: std(0xd97706, 0.3, 0.9, 0x3a2600),
  };
}
export type Materials = ReturnType<typeof createMaterials>;
