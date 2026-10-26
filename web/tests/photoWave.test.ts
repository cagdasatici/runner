import { describe, expect, it } from 'vitest';
import { WAVE, pickPhotos, wavePos } from '../src/ui/photoWave';

describe('photoWave', () => {
  it('picks only the kid\'s image files, sorted', () => {
    expect(pickPhotos(['arel3.png', 'Arel1.JPG', 'nora1.png', 'arel.txt', 'index.json'], 'arel')).toEqual(['Arel1.JPG', 'arel3.png']);
  });
  it('travels from -size to vw+size', () => {
    const a = wavePos(0, 0, 1000, 800, 100)!;
    expect(a.x).toBe(-100);
    expect(a.scale).toBe(0);
    expect(wavePos(0, WAVE.travel, 1000, 800, 100)!.x).toBeCloseTo(1100, 6);
  });
  it('is null before start and after the end', () => {
    expect(wavePos(3, 0.2, 1000, 800, 100)).toBeNull();
    expect(wavePos(0, WAVE.travel + 0.01, 1000, 800, 100)).toBeNull();
  });
  it('stays within its row band', () => {
    for (let k = 1; k < 20; k++) {
      const t = (k / 20) * WAVE.travel;
      expect(Math.abs(wavePos(0, t, 1000, 800, 100)!.y - 0.34 * 800)).toBeLessThanOrEqual(WAVE.amp * 800 + 1e-9);
      expect(Math.abs(wavePos(1, t + WAVE.stagger, 1000, 800, 100)!.y - 0.62 * 800)).toBeLessThanOrEqual(WAVE.amp * 800 + 1e-9);
    }
  });
  it('the last bubble ends before the overlay does', () => {
    expect((WAVE.count - 1) * WAVE.stagger + WAVE.travel).toBeLessThanOrEqual(WAVE.total);
  });
});
