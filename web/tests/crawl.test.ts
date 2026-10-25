import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Runner } from '../src/core/runner';
import { CRAWL_LIMIT, fitClearance } from '../src/gfx/clearance';
import { MalteseFigure } from '../src/gfx/maltese';
import { CHARACTERS } from '../src/gfx/characters';

const fitted = (lo: number, hi: number) => {
  const { f, lift } = fitClearance(lo, hi);
  return [lo * f + lift, hi * f + lift];
};

describe('crawl clearance (shared by every character)', () => {
  it('fits any posed bounds on the ground and under the slide hitbox', () => {
    expect(CRAWL_LIMIT).toBeLessThan(Runner.slideHeight);
    // a tall leaning humanoid poking through the track, a too-tall animal tuck, an already-fine pose
    for (const [lo, hi] of [[-0.2, 1.1], [0, 1.35], [0.05, 0.7], [-0.05, 0.5]]) {
      const [a, b] = fitted(lo, hi);
      expect(a, `${lo},${hi} bottom`).toBeGreaterThanOrEqual(-1e-9);
      expect(b, `${lo},${hi} top`).toBeLessThanOrEqual(CRAWL_LIMIT + 1e-9);
    }
    expect(fitClearance(0.05, 0.7)).toEqual({ f: 1, lift: 0 }); // fine poses are untouched
    expect(fitClearance(NaN, 1)).toEqual({ f: 1, lift: 0 });
  });

  it('every character height fits once squashed (no character is too tall to fix)', () => {
    for (const c of CHARACTERS) {
      const [a, b] = fitted(0, c.height);
      expect(b - a, c.id).toBeLessThanOrEqual(CRAWL_LIMIT + 1e-9);
    }
  });

  it("the Maltese's own crawl pose is belly-down, on the track and under a bar", () => {
    const dog = new MalteseFigure();
    const def = CHARACTERS.find((c) => c.id === 'maltese')!;
    dog.animate('idle', 0, 0, 0);
    const stand = new THREE.Box3().setFromObject(dog.root);
    dog.root.scale.setScalar(def.height / (stand.max.y - stand.min.y));
    dog.root.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(dog.root).min.y).toBeGreaterThan(-0.05); // paws on the ground
    dog.animate('slide', 0.3, 0, 0);
    dog.root.updateMatrixWorld(true);
    const crawl = new THREE.Box3().setFromObject(dog.root);
    expect(crawl.min.y, `crawl bottom ${crawl.min.y}`).toBeGreaterThan(-0.03);
    expect(crawl.max.y, `crawl top ${crawl.max.y}`).toBeLessThan(CRAWL_LIMIT); // fits by itself, no squash needed
    expect(crawl.max.y).toBeLessThan(Runner.slideHeight);
  });
});
