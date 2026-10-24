import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, levelSpec, WORLDS } from '../src/core/level';
import { ENDLESS_THEME, MENU_THEME, themeForWorld, THEMES, WORLD_THEMES } from '../src/gfx/themes';

const validColor = (c: number) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;

describe('theme registry', () => {
  it('defines a distinct theme for every world, plus menu and endless', () => {
    expect(WORLD_THEMES).toHaveLength(WORLDS);
    expect(new Set(WORLD_THEMES.map((t) => t.id)).size).toBe(WORLDS);
    expect(THEMES.menu).toBe(MENU_THEME);
    expect(THEMES.endless).toBe(ENDLESS_THEME);
    for (let n = 1; n <= LEVEL_COUNT; n++) expect(themeForWorld(levelSpec(n).world)).toBeDefined();
  });

  it('has valid colours and numbers in every theme', () => {
    for (const t of Object.values(THEMES)) {
      const cols = [t.sky.top, t.sky.mid, t.sky.horizon, t.sky.below, t.cloud.color, t.fog.color, t.hemi.sky, t.hemi.ground, t.sun.color,
        t.ground.side, t.ground.path, t.ground.gravel, t.roof, t.backdrop.color, t.propColors.a, t.propColors.b, t.propColors.trunk,
        ...t.buildings, ...t.neon, ...t.trains.flatMap((l) => [l.body, l.accent])];
      for (const c of cols) expect(validColor(c), `${t.id} colour ${c}`).toBe(true);
      expect(t.fog.near).toBeLessThan(t.fog.far);
      expect(t.fog.far).toBeLessThan(160);
      expect(t.buildings.length).toBeGreaterThan(2);
      expect(t.trains.length).toBeGreaterThan(1);
      expect(t.bloom.strength).toBeGreaterThanOrEqual(0);
      expect(t.bloom.threshold).toBeGreaterThan(0);
      expect(t.hemi.intensity + t.sun.intensity).toBeGreaterThan(0);
    }
  });

  it('clamps bad world numbers instead of throwing', () => {
    expect(themeForWorld(0)).toBe(WORLD_THEMES[0]);
    expect(themeForWorld(99)).toBe(WORLD_THEMES[WORLDS - 1]);
    expect(themeForWorld(Number.NaN)).toBe(WORLD_THEMES[0]);
  });
});
