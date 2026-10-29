import { describe, expect, it, vi } from 'vitest';
import { FrameStats, ipadName, sendReport, verdict, type PerfResult } from '../src/ui/perfTest';

const r = (name: string, fps: number, cpuMs: number, slowPct = 20): PerfResult => ({ name, fps, slowPct, worstMs: 50, cpuMs, draws: 100 });

describe('speed test', () => {
  it('FrameStats averages frames and ignores tab-switch gaps', () => {
    const s = new FrameStats();
    s.add(16, 4, 100);
    s.add(32, 6, 120);
    s.add(2000, 1, 1); // ignored
    expect(s.result('x')).toEqual({ name: 'x', fps: 42, slowPct: 50, worstMs: 32, cpuMs: 5, draws: 110 });
  });
  it('verdict tells GPU-bound from CPU-bound', () => {
    expect(verdict([r('a', 60, 5, 1), r('b', 60, 5), r('c', 60, 5), r('d', 60, 5)])).toMatch(/no limit/);
    expect(verdict([r('a', 56, 2, 5), r('b', 60, 2), r('c', 60, 2), r('d', 60, 2)])).toMatch(/Nearly smooth/);
    expect(verdict([r('a', 30, 5), r('b', 50, 5), r('c', 40, 5), r('d', 58, 5)])).toMatch(/GPU-bound.*resolution/);
    expect(verdict([r('a', 30, 15), r('b', 31, 15), r('c', 32, 15), r('d', 32, 15)])).toMatch(/CPU-bound/);
    expect(verdict([r('a', 30, 5)])).toMatch(/stopped early/);
  });
  it('names the two family iPads in either orientation', () => {
    expect(ipadName(810, 1080)).toBe('iPad (2021) 10.2"');
    expect(ipadName(1112, 834)).toBe('iPad Air (2019) 10.5"');
    expect(ipadName(390, 844)).toBe('unknown 390x844');
  });
  it('sendReport posts to the home server and reports failure without throwing', async () => {
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal('fetch', async (u: string, i: RequestInit) => { calls.push([u, i]); return { ok: true }; });
    const rep = { ipad: 'x', version: '1', device: 'd', verdict: 'v', results: [r('a', 30, 5)] };
    expect(await sendReport(rep, '/')).toBe(true);
    expect(calls[0][0]).toBe('/api/perf');
    expect(JSON.parse(String(calls[0][1].body)).results[0].fps).toBe(30);
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    expect(await sendReport(rep, '/')).toBe(false);
    vi.unstubAllGlobals();
  });
});
