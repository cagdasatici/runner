import { describe, expect, it } from 'vitest';
import { autopilotMove } from '../src/core/autopilot';
import { RunSession, score } from '../src/core/runner';

describe('AutopilotTests', () => {
  it('testIdleRunnerCrashesOnSeed2', () => {
    const g = new RunSession(2n);
    while (!g.state.crashed && g.state.tick < 20000) g.tick('none');
    expect(g.state.crashed).toBe(true);
    expect(g.state.tick).toBe(467);
    expect(score(g.state)).toBe(39); // the iOS crash screenshot shows "Score 39"
  });
  it('testAutopilotSurvivesTwoMinutesOnSeeds1to20', () => {
    for (let seed = 1n; seed <= 20n; seed++) {
      const g = new RunSession(seed);
      while (!g.state.crashed && g.state.tick < 14400) g.tick(autopilotMove(g.state, g.track));
      expect(g.state.crashed, `seed ${seed} crashed at z ${g.state.z}`).toBe(false);
    }
  });
  it('testAutopilotSeed1Golden', () => {
    const g = new RunSession(1n);
    while (g.state.tick < 14400) { g.track.pickups = []; g.tick(autopilotMove(g.state, g.track)); } // the autopilot ignores jetpacks
    expect(Math.abs(g.state.z - 1899.958333)).toBeLessThan(1e-4);
    expect(g.state.coins).toBe(252);
    expect(score(g.state)).toBe(4419);
  });
});
