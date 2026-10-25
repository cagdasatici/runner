import { describe, expect, it } from 'vitest';
import { fanfareEvents, FANFARE_SECONDS } from '../src/audio';

describe('finish fanfare', () => {
  it('lasts 5-8 s and ends on a held B-flat chord', () => {
    const ev = fanfareEvents();
    const end = Math.max(...ev.map((e) => e.t + e.d));
    expect(end).toBeGreaterThan(5); expect(end).toBeLessThanOrEqual(FANFARE_SECONDS);
    const final = ev.filter((e) => e.inst === 'brass' && e.d > 2);
    expect(final.length).toBeGreaterThan(4);
    for (const e of final) expect([10, 2, 5]).toContain(e.m % 12); // Bb D F
  });
  it('starts with a rising run', () => {
    const run = fanfareEvents().filter((e) => e.inst === 'brass' && e.t < 1.25).map((e) => e.m);
    expect(run.length).toBeGreaterThan(8);
    for (let i = 1; i < run.length; i++) expect(run[i]).toBeGreaterThan(run[i - 1]);
  });
});
