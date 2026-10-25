// Public audio API used by main.ts. The procedural engine lives in ./audio/ (see docs/music-design.md).
// iPad Safari only allows sound after a user gesture, so call unlock() from the first tap.
import { MusicEngine } from './audio/engine';
import { themeFor, type MusicMode } from './audio/themes';

const MUTE_KEY = 'muted';

export type MusicRequest = 'menu' | 'run' | { mode: MusicMode; world?: number };

export class Audio {
  private ctx: AudioContext | null = null;
  private engine: MusicEngine | null = null;
  private wanted: MusicRequest | null = null;
  private speed = 10;
  private boost = false;
  private powerUp = false;
  muted: boolean;

  constructor() {
    let m = false;
    try { m = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked: default unmuted */ }
    this.muted = m;
    // Like the iOS app's .ambient session: respect the iPad's silent switch where Safari supports it.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  }

  /** Call from a tap/click handler. Safe to call many times. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.engine = new MusicEngine(this.ctx);
      this.engine.setSpeed(this.speed); this.engine.setBoost(this.boost); this.engine.setPowerUp(this.powerUp);
      if (this.wanted && !this.muted) this.playMusic(this.wanted);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (!this.engine) return;
    if (m) this.engine.stop(0.05); // nothing is audible, so do not burn CPU on it
    else if (this.wanted) this.playMusic(this.wanted);
  }

  /** 'menu' | 'run' (endless) | { mode, world } for journey levels and results. */
  playMusic(req: MusicRequest): void {
    this.wanted = req;
    if (!this.engine || this.muted) return;
    const r = typeof req === 'string' ? { mode: (req === 'run' ? 'endless' : req) as MusicMode, world: 1 } : req;
    const theme = themeFor(r.mode, r.world ?? 1);
    if (r.mode === 'results') this.engine.start(theme, this.engine.nextBeat());
    else if (!this.engine.playing) this.engine.start(theme);
    else if (this.engine.themeId !== theme.id) this.engine.switchTheme(theme);
  }

  stopMusic(forget = true): void {
    if (forget) this.wanted = null;
    this.engine?.stop();
  }

  /** Smoothed speed in m/s drives the music layers and tempo. */
  setSpeed(mps: number): void { this.speed = mps; this.engine?.setSpeed(mps); }
  /** Hold-to-boost pushes intensity and tempo up while true. */
  setBoost(on: boolean): void { this.boost = on; this.engine?.setBoost(on); }
  /** Power-up active: opens the top layer. */
  setPowerUp(on: boolean): void { this.powerUp = on; this.engine?.setPowerUp(on); }

  /** Names: coin star jump slide roll lane powerup boardbreak jetpack jetpackStop warn(arg 3,2,1) nearmiss combo click win crash */
  sfx(name: string, arg = 0): void {
    if (!this.engine || this.muted || this.ctx?.state === 'suspended') return;
    this.engine.sfx(name, arg);
  }

  /**
   * Triumphant level-finish piece (~7.5 s): rising brass run over a cymbal swell, stabs, a
   * bVI-bVII-I cadence and a big held B-flat chord. Fades out and stops the music.
   * Returns the piece's length in seconds (0 if audio is not unlocked or is muted).
   */
  playFinishFanfare(): number {
    this.wanted = null;
    this.engine?.stop(0.4);
    if (!this.ctx || this.muted) return 0;
    playFanfare(this.ctx, this.ctx.currentTime + 0.05);
    return FANFARE_SECONDS;
  }

  /** Pause/resume everything when the app goes to the background. */
  suspend(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) { this.engine?.pauseTimer(); void this.ctx.suspend(); } else { void this.ctx.resume(); this.engine?.resumeTimer(); }
  }
}

// ---------------------------------------------------------------- finish fanfare

export type FanfareInst = 'brass' | 'lead' | 'bass' | 'bell' | 'pad' | 'kick' | 'snare' | 'crash' | 'swell' | 'timp';
/** One note of the fanfare: t/d in seconds from the start, m = MIDI note, v = 0..1. */
export interface FanfareNote { inst: FanfareInst; t: number; d: number; m: number; v: number }
export const FANFARE_SECONDS = 7.5;

/** The fanfare score: B-flat major, Bb ... Gb (bVI) - Ab (bVII) - Bb. Pure, so it is unit-tested. */
export function fanfareEvents(): FanfareNote[] {
  const ev: FanfareNote[] = [];
  const add = (inst: FanfareInst, t: number, d: number, m: number, v: number) => ev.push({ inst, t, d, m, v });
  // 0-1.25 s: cymbal swell + snare roll under a rising Bb major run (Bb3 -> Bb5).
  add('swell', 0, 1.25, 0, 0.8);
  for (let i = 0; i < 20; i++) add('snare', i * 0.06, 0.06, 0, 0.15 + i * 0.035);
  [58, 60, 62, 63, 65, 67, 69, 70, 72, 74, 75, 77, 79, 81, 82].forEach((m, i) => add('brass', i * 0.08, 0.12, m, 0.45 + i * 0.03));
  const stab = (t: number, d: number, notes: number[], top: number, v: number) => {
    for (const m of notes) add('brass', t, d, m, v);
    add('lead', t, d, top, v);
    add('bass', t, d, notes[0] - 12, v);
  };
  const Bb = [46, 58, 62, 65, 70], Gb = [42, 54, 58, 61, 66], Ab = [44, 56, 60, 63, 68];
  stab(1.25, 0.22, Bb, 77, 0.9); add('kick', 1.25, 0.3, 0, 1); add('crash', 1.25, 1.5, 0, 0.7);
  stab(1.55, 0.18, Bb, 77, 0.75);
  stab(1.8, 0.5, Bb, 82, 0.95); add('kick', 1.8, 0.3, 0, 0.9);
  stab(2.4, 0.5, Gb, 78, 0.9); add('kick', 2.4, 0.3, 0, 0.9); add('timp', 2.4, 0.5, 42, 0.8);
  stab(3.0, 0.5, Ab, 80, 0.95); add('kick', 3.0, 0.3, 0, 0.9); add('timp', 3.0, 0.5, 44, 0.8);
  add('swell', 2.6, 1.0, 0, 0.7);
  for (let i = 0; i < 8; i++) add('snare', 3.1 + i * 0.06, 0.06, 0, 0.3 + i * 0.08);
  // 3.6 s: the big final chord, held with a timpani roll and shimmer, fading out by 7.5 s.
  for (const m of [34, 46, 53, 58, 62, 65, 70, 74, 77]) add('brass', 3.6, 3.6, m, 1);
  add('lead', 3.6, 3.6, 82, 1); add('bell', 3.6, 3.0, 94, 0.5); add('bell', 3.75, 2.6, 89, 0.4);
  for (const m of [58, 65, 70]) add('pad', 3.6, 3.8, m, 0.8);
  add('kick', 3.6, 0.5, 0, 1); add('crash', 3.6, 3.5, 0, 1); add('crash', 3.62, 3.5, 0, 0.6);
  for (let i = 0; i < 14; i++) add('timp', 3.6 + i * 0.07, 0.12, 34, 0.9 - i * 0.05);
  return ev;
}

const LEVEL: Record<FanfareInst, number> = {
  brass: 0.07, lead: 0.14, bass: 0.3, bell: 0.08, pad: 0.08, kick: 0.8, snare: 0.3, crash: 0.13, swell: 0.2, timp: 0.45,
};

/** Synthesise the fanfare on its own graph (compressor + generated-impulse reverb). It disconnects itself when done. */
function playFanfare(ctx: AudioContext, t0: number): void {
  const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const bus = ctx.createGain(); bus.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
  bus.connect(comp).connect(ctx.destination);
  const rev = ctx.createConvolver();
  const n = Math.round(2.6 * ctx.sampleRate);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++) { const x = i / n; lp += (Math.random() * 2 - 1 - lp) * (0.85 - 0.8 * x); d[i] = lp * Math.pow(1 - x, 3); }
  }
  rev.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  wet.connect(rev).connect(bus);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const outs = {} as Record<FanfareInst, GainNode>;
  for (const k of Object.keys(LEVEL) as FanfareInst[]) { const g = ctx.createGain(); g.gain.value = LEVEL[k]; g.connect(bus); g.connect(wet); outs[k] = g; }
  bus.gain.setValueAtTime(0.8, t0 + FANFARE_SECONDS - 1.5);
  bus.gain.linearRampToValueAtTime(0, t0 + FANFARE_SECONDS);
  setTimeout(() => { try { bus.disconnect(); wet.disconnect(); comp.disconnect(); } catch { /* gone */ } }, (FANFARE_SECONDS + 3) * 1000);

  for (const e of fanfareEvents()) {
    const t = t0 + e.t, d = e.d, v = e.v, f = freq(e.m), out = outs[e.inst];
    const osc = (type: OscillatorType, hz: number, detune: number, dest: AudioNode, end: number) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; o.detune.value = detune;
      o.connect(dest); o.start(t); o.stop(end); return o;
    };
    const noiseSrc = (dest: AudioNode, end: number) => {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.connect(dest); s.start(t, Math.random() * 0.8); s.stop(end);
    };
    const g = ctx.createGain();
    switch (e.inst) {
      case 'brass': case 'pad': case 'lead': case 'bass': {
        const brassy = e.inst !== 'pad';
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = brassy ? 2 : 0.8;
        const peak = e.inst === 'bass' ? 1200 : brassy ? 2200 + 2500 * v : 1800;
        lp.frequency.setValueAtTime(400, t);
        lp.frequency.linearRampToValueAtTime(peak, t + (brassy ? 0.07 : 0.5)); // brass "bloom"
        lp.frequency.setTargetAtTime(peak * 0.5, t + 0.1, 0.4);
        lp.connect(g).connect(out);
        const a = brassy ? 0.025 : 0.3, rel = Math.min(0.8, 0.15 + d * 0.3);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
        g.gain.setTargetAtTime(v * 0.75, t + a, 0.2); g.gain.setTargetAtTime(0, t + Math.max(a, d), rel / 4);
        const end = t + d + rel + 0.1;
        for (const dt of e.inst === 'pad' ? [-12, -4, 5, 13] : [-9, 0, 8]) {
          const o = osc('sawtooth', f, dt, lp, end);
          if (brassy) { o.detune.setValueAtTime(dt - 40, t); o.detune.linearRampToValueAtTime(dt, t + 0.06); } // lip slide into pitch
        }
        break;
      }
      case 'bell': {
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.004, d / 3);
        g.connect(out); osc('sine', f, 0, g, t + d * 2); osc('sine', f * 2.01, 0, g, t + d * 2);
        break;
      }
      case 'kick': {
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); g.connect(out);
        const o = osc('sine', 160, 0, g, t + 0.4); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        break;
      }
      case 'snare': {
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); g.connect(out);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7;
        bp.connect(g); noiseSrc(bp, t + 0.18);
        break;
      }
      case 'crash': case 'swell': {
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000; hp.connect(g).connect(out);
        if (e.inst === 'swell') { // reverse cymbal: rises, then cuts
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d); g.gain.setTargetAtTime(0, t + d, 0.02);
          hp.frequency.setValueAtTime(9000, t); hp.frequency.exponentialRampToValueAtTime(3000, t + d);
        } else {
          g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
          for (const hz of [3150, 4870, 6420]) osc('square', hz, 0, hp, t + Math.min(d, 1.5)); // metallic partials
        }
        noiseSrc(hp, t + d + 0.1);
        break;
      }
      case 'timp': {
        const len = Math.max(0.4, d * 3);
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); g.connect(out);
        const o = osc('sine', f * 1.15, 0, g, t + len); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        osc('triangle', f * 1.5, 0, g, t + 0.3);
        break;
      }
    }
  }
}
