import { describe, expect, it } from 'vitest';
import { animFor, CHARACTERS, characterById, DEFAULT_CHARACTER, loadCharacter, saveCharacter, stepCharacter, type AnimInput } from '../src/gfx/characters';

const base: AnimInput = { y: 0, vy: 0, slideTicks: 0, crashed: false };

describe('animFor', () => {
  it('maps the runner state to an animation', () => {
    expect(animFor(base)).toBe('run');
    expect(animFor({ ...base, slideTicks: 10 })).toBe('slide');
    expect(animFor({ ...base, y: 0.4, vy: 3 })).toBe('jump');
    expect(animFor({ ...base, vy: 5 })).toBe('jump');
    expect(animFor({ ...base, crashed: true })).toBe('crash');
    expect(animFor({ ...base, board: 100 })).toBe('board');
    expect(animFor({ ...base, fly: 5 })).toBe('fly');
  });
  it('applies the priority crash > stumble > fly > slide > jump > board', () => {
    expect(animFor({ ...base, crashed: true, slideTicks: 5, fly: 5 }, true)).toBe('crash');
    expect(animFor({ ...base, slideTicks: 5, fly: 5 }, true)).toBe('stumble');
    expect(animFor({ ...base, slideTicks: 5, fly: 5 })).toBe('fly');
    expect(animFor({ ...base, slideTicks: 5, board: 5 })).toBe('slide');
    expect(animFor({ ...base, y: 1, vy: 1, board: 5 })).toBe('jump');
  });
});

describe('registry', () => {
  it('has four unique characters with the clips the game needs', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(['adventurer', 'shiba', 'cat', 'fox']);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
    for (const c of CHARACTERS) {
      expect(c.model).toBe(`models/${c.id}.glb`);
      for (const k of ['run', 'jump', 'crash', 'idle'] as const) expect(c.clips[k], `${c.id}.${k}`).toBeTruthy();
      expect(c.height).toBeGreaterThan(0.5);
      if (c.slide === 'clip') expect(c.clips.slide).toBeTruthy();
    }
  });
  it('looks characters up with a safe default and steps with wraparound', () => {
    expect(characterById('cat').name).toBe('Whiskers');
    expect(characterById('nope').id).toBe(DEFAULT_CHARACTER);
    expect(characterById(null).id).toBe(DEFAULT_CHARACTER);
    expect(stepCharacter('adventurer', -1)).toBe('fox');
    expect(stepCharacter('fox', 1)).toBe('adventurer');
    expect(stepCharacter('shiba', 1)).toBe('cat');
  });
  it('persists the choice and survives broken storage', () => {
    const mem = new Map<string, string>();
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(loadCharacter(st)).toBe(DEFAULT_CHARACTER);
    saveCharacter('fox', st);
    expect(mem.get('character')).toBe('fox');
    expect(loadCharacter(st)).toBe('fox');
    mem.set('character', 'bogus');
    expect(loadCharacter(st)).toBe(DEFAULT_CHARACTER);
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(loadCharacter(broken)).toBe(DEFAULT_CHARACTER);
    expect(() => saveCharacter('cat', broken)).not.toThrow();
  });
  it('after the finish-line coast releases crawl/jump the animation returns to run', () => {
    expect(animFor({ ...base, slideTicks: 0, y: 0.4 })).toBe('jump'); // easing down
    expect(animFor({ ...base, slideTicks: 0, y: 0, vy: 0 })).toBe('run'); // standing again
  });
});
