import { describe, expect, it } from 'vitest';
import { composeBar, fanfareEvents, FANFARE_SECONDS, SONGS, sectionAt } from '../src/audio';

describe('music composition', () => {
  it('is deterministic per bar', () => {
    expect(composeBar('run', 13)).toEqual(composeBar('run', 13));
  });
  it('runs intro once then cycles verse/chorus/verseB/breakdown/chorus', () => {
    const run = SONGS.run;
    expect(sectionAt(run, 0).section).toBe('intro');
    expect(sectionAt(run, 4).section).toBe('verse');
    expect(sectionAt(run, 12).section).toBe('chorus');
    expect(sectionAt(run, 28).section).toBe('breakdown');
    expect(sectionAt(run, 44).section).toBe('verse'); // looped, intro not repeated
  });
  it('sections sound different and stay inside the bar', () => {
    const verse = composeBar('run', 4), chorus = composeBar('run', 12), brk = composeBar('run', 28);
    const leads = (ev: ReturnType<typeof composeBar>) => ev.filter((e) => e.inst === 'lead').map((e) => e.m);
    expect(leads(verse)).not.toEqual(leads(chorus));
    expect(leads(brk)).toEqual([]);
    expect(chorus.filter((e) => e.inst === 'kick').length).toBe(4);
    for (const bar of [0, 5, 12, 30, 100]) for (const e of composeBar('run', bar)) {
      expect(e.t).toBeGreaterThan(-0.05); expect(e.t).toBeLessThan(4);
      expect(e.v).toBeGreaterThan(0); expect(e.v).toBeLessThanOrEqual(1);
    }
    expect(composeBar('menu', 3).length).toBeGreaterThan(10);
    expect(composeBar('nope', 0)).toEqual([]);
  });
  it('fanfare lasts 5-8 s and ends on a held B-flat chord', () => {
    const ev = fanfareEvents();
    const end = Math.max(...ev.map((e) => e.t + e.d));
    expect(end).toBeGreaterThan(5); expect(end).toBeLessThanOrEqual(FANFARE_SECONDS);
    const final = ev.filter((e) => e.inst === 'brass' && e.d > 2);
    expect(final.length).toBeGreaterThan(4);
    for (const e of final) expect([10, 2, 5]).toContain(e.m % 12); // Bb D F
  });
});
