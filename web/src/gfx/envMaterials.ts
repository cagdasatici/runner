// Materials of the environment (track, city, trains, ramps, finish). Few materials = few draw calls:
//   vc      – vertex-coloured Lambert for nearly all scenery (colours baked per vertex, themeable without new textures)
//   facade  – building walls (window texture + emissive lit windows, tinted by vertex colours)
//   glow    – unlit HDR vertex colours: lamps, neon, headlights (the bloom picks these up)
//   atlas   – trains, ramps, barriers (one 1024² trim sheet, tinted by vertex colours)
//   gravel  – track bed
import * as THREE from 'three';
import { facadeTextures, vehicleAtlas } from './envTextures';
import * as T from './textures';
import type { Theme } from './themes';

export function createEnvMaterials() {
  const facade = facadeTextures();
  const atlas = vehicleAtlas();
  return {
    vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    facade: new THREE.MeshLambertMaterial({
      map: facade.map, vertexColors: true, emissive: 0xffffff, emissiveMap: facade.glow, emissiveIntensity: 0.1,
    }),
    atlas: new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.45 }),
    gravel: new THREE.MeshLambertMaterial({ map: T.gravelTexture() }),
    finishBanner: new THREE.MeshLambertMaterial({ map: T.finishBannerTexture() }),
    checker: new THREE.MeshLambertMaterial({ map: T.checkerTexture() }),
  };
}
export type EnvMaterials = ReturnType<typeof createEnvMaterials>;

/** Retints the shared materials for a theme (geometry colours are baked per segment when it is built). */
export function applyThemeToMaterials(m: EnvMaterials, t: Theme): void {
  m.facade.emissiveIntensity = t.windowGlow;
  m.gravel.color.setHex(t.ground.gravel);
}
