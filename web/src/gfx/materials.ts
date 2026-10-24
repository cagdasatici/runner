// Port of App/Materials.swift. Shared materials keep draw cost low.
// Lambert (cheap) for most things; Standard (PBR) only where shine matters (rails, coins, train).
import * as THREE from 'three';

const lambert = (color: number, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
const std = (color: number, roughness: number, metalness: number, emissive = 0x000000) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive });

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
    // coins
    gold: std(0xfbbf24, 0.25, 0.9, 0x5c3d00),
    goldDark: std(0xd97706, 0.3, 0.9, 0x3a2600),
  };
}
export type Materials = ReturnType<typeof createMaterials>;
