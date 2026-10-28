import { describe, expect, it } from 'vitest';
import {
  barSeconds, chordMidi, coinMidi, generateBar, layerRamp, levelFor, LAYER_OF, MOTIFS, nextBpm, sectionChord, sectionOf, Sequencer, stepSeconds, targetBpm,
  type NoteEvent,
} from '../src/audio/music';
import { ENDLESS_THEME, MENU_THEME, themeFor, WORLD_THEMES } from '../src/audio/themes';
import { makeRng, pitchClass } from '../src/audio/theory';
import { levelSpec } from '../src/core/level';

const ALL = [...WORLD_THEMES, MENU_THEME, ENDLESS_THEME];

describe('timing', () => {
  it('bar and step durations follow BPM', () => {
    expect(barSeconds(120)).toBe(2);
    expect(stepSeconds(120)).toBe(0.125);
    expect(barSeconds(60)).toBe(4);
  });
  it('sequencer emits each step once, bars on exact boundaries, tempo only changes at bar lines', () => {
    const th = WORLD_THEMES[0];
    const seq = new Sequencer(th, 10, 120);
    const bars: [number, number][] = [];
    const kicks: number[] = [];
    let bpm = 120;
    const run = (until: number) => seq.pump(until,
      (e, t) => { if (e.inst === 'kick' && e.step === 0) kicks.push(t); },
      (bar, t) => { bars.push([bar, t]); bpm = bar === 1 ? 124 : bpm; return { bpm }; });
    run(10.14); run(12.14); run(14.14);
    expect(bars.map((b) => b[0])).toEqual([0, 1, 2]);
    expect(bars[0][1]).toBe(10);
    expect(bars[1][1]).toBe(12);
    expect(bars[2][1]).toBeCloseTo(12 + 240 / 124, 9); // bar 1 played at the new tempo
    expect(kicks).toHaveLength(3);
  });
  it('theme switch happens at a bar line and restarts the phrase', () => {
    const seq = new Sequencer(WORLD_THEMES[0], 0, 120);
    const log: string[] = [];
    seq.pump(5, () => {}, (bar, t) => { log.push(`${seq.theme.id}@${t}`); return bar === 1 ? { theme: WORLD_THEMES[1] } : undefined; });
    expect(log).toEqual(['world1@0', 'world1@2', 'world2@4']);
    expect([seq.bar, seq.step]).toEqual([0, 8]);
  });
});

describe('tempo', () => {
  it('follows speed within the theme range, even BPM, small steps', () => {
    const t = WORLD_THEMES[0];
    expect(targetBpm(t, 0)).toBe(t.bpmMin);
    expect(targetBpm(t, 40)).toBe(t.bpmMax);
    expect(targetBpm(t, 16.5) % 2).toBe(0);
    expect(nextBpm(112, 130)).toBe(116);
    expect(nextBpm(130, 112)).toBe(126);
    expect(nextBpm(112, 113)).toBe(113);
    for (const th of ALL) { expect(th.bpmMin).toBeGreaterThanOrEqual(92); expect(th.bpmMax).toBeLessThanOrEqual(136); }
  });
});

describe('layers', () => {
  it('thresholds 14 / 18 / 22 m/s, boost adds 3, power-up opens everything', () => {
    expect(levelFor(10, false, false)).toBe(0);
    expect(levelFor(14, false, false)).toBe(1);
    expect(levelFor(18, false, false)).toBe(2);
    expect(levelFor(22, false, false)).toBe(3);
    expect(levelFor(15, true, false)).toBe(2);
    expect(levelFor(19, true, false)).toBe(2); // boost never adds the top layer
    expect(levelFor(22, true, false)).toBe(2);
    expect(levelFor(8, false, true)).toBe(3);
  });
  it('hysteresis keeps a layer until speed drops 0.8 below', () => {
    expect(levelFor(13.5, false, false, 1)).toBe(1);
    expect(levelFor(13.1, false, false, 1)).toBe(0);
  });
  it('fades in over 1 bar and out over 2', () => {
    expect(layerRamp(0, 2)).toEqual([{ layer: 1, to: 1, bars: 1 }, { layer: 2, to: 1, bars: 1 }]);
    expect(layerRamp(3, 1)).toEqual([{ layer: 2, to: 0, bars: 2 }, { layer: 3, to: 0, bars: 2 }]);
    expect(layerRamp(2, 2)).toEqual([]);
  });
  it('instruments sit on the specified layers', () => {
    const insts = (l: number) => new Set(generateBar(WORLD_THEMES[0], 3).filter((e) => e.layer === l).map((e) => e.inst));
    expect([...insts(0)].sort()).toEqual(['kick', 'lead', 'pad']);
    expect([...insts(1)].sort()).toEqual(['bass', 'hat', 'pluck', 'snare']);
    expect([...insts(2)]).toEqual(['arp']);
    expect(insts(3).has('tom')).toBe(true);
    expect(insts(3).has('counter')).toBe(true);
    for (const e of generateBar(WORLD_THEMES[0], 0)) expect(e.layer).toBe(LAYER_OF[e.inst]);
  });
});

describe('generation', () => {
  it('is deterministic', () => {
    expect(generateBar(WORLD_THEMES[4], 7)).toEqual(generateBar(WORLD_THEMES[4], 7));
    expect(makeRng(5).next()).toBe(makeRng(5).next());
  });
  it('keeps every pitched note in the theme key', () => {
    for (const th of ALL) {
      const set = new Set(th.scale.map((s) => (s + th.rootPc) % 12));
      for (let bar = 0; bar < 16; bar++) {
        for (const e of generateBar(th, bar)) {
          const ms = [...(e.notes ?? []), ...(e.midi !== undefined ? [e.midi] : [])];
          for (const m of ms) expect(set.has(pitchClass(m)), `${th.id} bar ${bar} ${e.inst} midi ${m}`).toBe(true);
          expect(e.step).toBeGreaterThanOrEqual(0);
          expect(e.step).toBeLessThan(16);
        }
      }
    }
  });
  it('keeps notes in a comfortable register (no shrill highs)', () => {
    for (const th of ALL) for (let b = 0; b < 8; b++) for (const e of generateBar(th, b)) {
      for (const m of [...(e.notes ?? []), ...(e.midi !== undefined ? [e.midi] : [])]) expect(m).toBeLessThanOrEqual(90);
    }
  });
  it('worlds differ in key, mode or tempo; 12 worlds', () => {
    expect(WORLD_THEMES).toHaveLength(12);
    const sig = new Set(WORLD_THEMES.map((t) => `${t.rootPc}${t.scaleName}${t.drums}`));
    expect(sig.size).toBe(12);
    expect(themeFor('run', levelSpec(1).world).id).toBe('world1');
    expect(themeFor('run', levelSpec(120).world).id).toBe('world12');
    expect(themeFor('results', 3).rootPc).toBe(WORLD_THEMES[2].rootPc);
    expect(MENU_THEME.fixedLevel).toBe(1);
  });
  it('chords are diatonic triads/sevenths', () => {
    expect(chordMidi(WORLD_THEMES[0], 0, 48)).toEqual([48, 52, 55]);
    expect(chordMidi(WORLD_THEMES[0], 5, 48)).toEqual([57, 60, 64]);
  });
});

describe('composition', () => {
  it('follows a 32-bar verse / chorus / verse 2 / breakdown form', () => {
    expect([0, 8, 16, 24, 32].map((b) => sectionOf(b).section)).toEqual(['verse', 'chorus', 'verse2', 'breakdown', 'verse']);
  });
  it('the lead plays the theme motif, not random notes, and repeats it when the form repeats', () => {
    const th = WORLD_THEMES[0];
    const lead = (b: number) => generateBar(th, b).filter((e) => e.inst === 'lead').map((e) => [e.step, e.midi]);
    expect(lead(0).map(([s]) => s)).toEqual(MOTIFS[th.melody[0]].map(([s]) => s));
    expect(lead(0)).toEqual(lead(32));
    expect(lead(0)).toEqual(lead(16)); // verse 2 reuses the verse tune
    expect(lead(8)).not.toEqual(lead(0)); // chorus has its own hook
  });
  it('sections change the arrangement: chorus is busier, breakdown drops the groove and builds back in', () => {
    const th = WORLD_THEMES[0];
    const n = (b: number, inst: string) => generateBar(th, b).filter((e) => e.inst === inst).length;
    expect(n(8, 'arp')).toBeGreaterThanOrEqual(n(1, 'arp'));
    expect(n(25, 'hat')).toBe(0);
    expect(n(25, 'kick')).toBe(1);
    expect(n(31, 'snare')).toBeGreaterThan(8); // roll back into the verse
    expect(n(8, 'crash')).toBe(1);
    expect(n(7, 'tom')).toBeGreaterThan(2); // fill at the end of the phrase
  });
  it('humanises velocity and timing a little, but keeps kicks on the grid', () => {
    const ev = generateBar(WORLD_THEMES[2], 5);
    const hats = ev.filter((e) => e.inst === 'hat');
    expect(new Set(hats.map((e) => e.vel.toFixed(3))).size).toBeGreaterThan(3);
    for (const e of ev) {
      expect(Math.abs(e.nudge ?? 0)).toBeLessThanOrEqual(0.06);
      if (e.inst === 'kick') expect(e.nudge).toBe(0);
    }
  });
  it('bass walks into the next chord with an in-key approach note', () => {
    const th = WORLD_THEMES[0];
    for (let b = 0; b < 32; b++) {
      const { section, bar } = sectionOf(b);
      if (section === 'breakdown' || bar === 7) continue;
      const walk = generateBar(th, b).find((e) => e.inst === 'bass' && e.step === 15);
      if (sectionChord(th.prog, section, bar) !== sectionChord(th.prog, section, bar + 1) && th.bassPattern[15] === '.') expect(walk).toBeDefined();
    }
  });
});

describe('coin streak pitch', () => {
  it('climbs the scale up to exactly one octave', () => {
    const t = WORLD_THEMES[0];
    const ms = Array.from({ length: 10 }, (_, i) => coinMidi(t, i));
    expect(ms.slice(0, 8)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(ms[9]).toBe(72);
    const evs: NoteEvent[] = [];
    void evs;
  });
});
