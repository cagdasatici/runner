// Web Audio side of the procedural soundtrack: instruments, effects buses, lookahead scheduling, SFX.
// All pitch/rhythm decisions come from music.ts (pure). Works on AudioContext and OfflineAudioContext.
import {
  barSeconds, beatSeconds, coinMidi, layerRamp, levelFor, nextBpm, Sequencer, smoothSpeed, targetBpm,
  BOOST_SPEED_BONUS, type BarDecision, type Layer, type NoteEvent,
} from './music';
import { WORLD_THEMES, type Theme } from './themes';
import { degreeToMidi, makeRng, midiToFreq } from './theory';

export const LOOKAHEAD = 0.14;        // seconds scheduled ahead of currentTime
export const TICK_MS = 25;
export const MAX_VOICES = 22;         // hard cap is below 24 on purpose
export const MASTER_LEVEL = 0.6;
export const MUSIC_TRIM = 0.2;
export const DUCK_GAIN = 0.5;         // -6 dB

interface Bus { dry: GainNode; wet: GainNode; echo: GainNode; wetAmt: number; echoAmt: number }
interface Ramp { t0: number; t1: number; v0: number; v1: number }
interface Session { gain: GainNode; layers: Bus[]; ramps: Ramp[] }

const STINGERS = new Set(['star', 'powerup', 'boardbreak', 'combo', 'win']);

export class MusicEngine {
  readonly ctx: BaseAudioContext;
  private master: GainNode;
  private musicFilter: BiquadFilterNode;
  private duck: GainNode;
  private sfxBus: Bus;
  private revIn: GainNode;
  private echoIn: GainNode;
  private delay: DelayNode;
  private noiseBuf: AudioBuffer;
  private satCurve: Float32Array<ArrayBuffer>;
  private voices = 0;
  private session: Session | null = null;
  private seq: Sequencer | null = null;
  private pending: Theme | null = null;
  theme: Theme | null = null;
  private lastTheme: Theme | null = null;
  // game state
  private speed = 10;
  private smooth = 10;
  private boost = false;
  private powerUp = false;
  private level = 0;
  private lastBarTime = -1;
  private timer: ReturnType<typeof setInterval> | null = null;
  // sfx state
  private streak = 0;
  private lastCoinTime = -10;
  private jet: { gain: GainNode; stop: () => void } | null = null;
  private duckUntil = 0;
  private sfxRng = makeRng(99);
  stats = { peakVoices: 0, scheduled: 0 };

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    // master chain: compressor -> limiter -> soft clip (hard bound 0.92) -> out
    this.master = ctx.createGain();
    this.master.gain.value = MASTER_LEVEL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.008; comp.release.value = 0.22;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
    const clip = ctx.createWaveShaper();
    const curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++) { const x = (i / 1024 - 1) * 2; curve[i] = 0.92 * Math.tanh(x / 0.92); }
    clip.curve = curve;
    // gentle top end: nothing harsh on a tablet speaker
    const tame = ctx.createBiquadFilter();
    tame.type = 'lowpass'; tame.frequency.value = 9500; tame.Q.value = 0.5;
    this.master.connect(comp); comp.connect(lim); lim.connect(clip); clip.connect(tame); tame.connect(ctx.destination);

    this.duck = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 5200; this.musicFilter.Q.value = 0.6;
    const trim = ctx.createGain(); trim.gain.value = MUSIC_TRIM; // music sits under the SFX
    this.musicFilter.connect(this.duck); this.duck.connect(trim); trim.connect(this.master);

    // reverb (generated impulse) and tempo-synced echo
    this.revIn = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = this.makeImpulse(1.7);
    const revOut = ctx.createGain(); revOut.gain.value = 0.55;
    this.revIn.connect(conv); conv.connect(revOut); revOut.connect(this.master);
    this.echoIn = ctx.createGain();
    this.delay = ctx.createDelay(1.5); this.delay.delayTime.value = 0.35;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const fbLp = ctx.createBiquadFilter(); fbLp.type = 'lowpass'; fbLp.frequency.value = 2400;
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.5;
    this.echoIn.connect(this.delay); this.delay.connect(fbLp); fbLp.connect(fb); fb.connect(this.delay);
    fbLp.connect(echoOut); echoOut.connect(this.master);

    const sfxGain = ctx.createGain(); sfxGain.gain.value = 1; sfxGain.connect(this.master);
    this.sfxBus = this.makeBus(sfxGain);

    const n = Math.floor(ctx.sampleRate * 2);
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0), r = makeRng(4242);
    for (let i = 0; i < n; i++) d[i] = r.next() * 2 - 1;
    this.satCurve = new Float32Array(new ArrayBuffer(257 * 4));
    for (let i = 0; i < 257; i++) this.satCurve[i] = Math.tanh(((i / 128) - 1) * 2.2);
  }

  private get realtime(): boolean { return typeof OfflineAudioContext === 'undefined' || !(this.ctx instanceof OfflineAudioContext); }

  // ---------------- graph helpers ----------------
  private makeImpulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate, n = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, n, rate), r = makeRng(7);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        lp += (r.next() * 2 - 1 - lp) * (0.55 - 0.45 * t); // darker as it decays
        d[i] = lp * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1);
      }
    }
    return buf;
  }

  private makeBus(dest: AudioNode, wetAmt = 1, echoAmt = 1): Bus {
    const ctx = this.ctx;
    const dry = ctx.createGain(), wet = ctx.createGain(), echo = ctx.createGain();
    dry.connect(dest);
    wet.gain.value = wetAmt; echo.gain.value = echoAmt;
    wet.connect(this.revIn); echo.connect(this.echoIn);
    return { dry, wet, echo, wetAmt, echoAmt };
  }

  private route(src: AudioNode, bus: Bus, wet = 0, echo = 0, pan = 0): void {
    let node: AudioNode = src;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p;
    }
    node.connect(bus.dry);
    if (wet > 0) { const g = this.ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(bus.wet); }
    if (echo > 0) { const g = this.ctx.createGain(); g.gain.value = echo; node.connect(g); g.connect(bus.echo); }
  }

  private claim(prio: number): boolean {
    if (!this.realtime) return true; // offline renders pre-schedule everything, so the live voice cap does not apply
    if (this.voices >= MAX_VOICES + 1) return false;
    if (this.voices >= MAX_VOICES - 6 && prio < 2) return false; // drop hats/arps first when busy
    if (this.voices >= MAX_VOICES - 2 && prio < 3) return false;
    this.voices++;
    if (this.voices > this.stats.peakVoices) this.stats.peakVoices = this.voices;
    return true;
  }
  private track(src: AudioScheduledSourceNode): void {
    src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
  }

  private noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.start(t, this.sfxRng.next() * 1.5);
    s.stop(t + dur);
    return s;
  }

  /** Generic enveloped voice: 1-2 oscillators -> lowpass -> gain. */
  private blip(o: {
    t: number; f: number; f2?: number; type: OscillatorType; dur: number; att?: number; peak: number; lp?: number; lp2?: number;
    detune?: number; bus: Bus; wet?: number; echo?: number; pan?: number; prio?: number; q?: number;
  }): void {
    if (!this.claim(o.prio ?? 1)) return;
    const ctx = this.ctx, att = o.att ?? 0.004, end = o.t + att + o.dur;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, o.t);
    g.gain.linearRampToValueAtTime(o.peak, o.t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    let tail: AudioNode = g;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = o.q ?? 0.7;
      f.frequency.setValueAtTime(o.lp, o.t);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, end);
      f.connect(g); tail = f;
    }
    const detunes = o.detune ? [-o.detune, o.detune] : [0];
    let last: OscillatorNode | null = null;
    for (const dt of detunes) {
      const osc = ctx.createOscillator();
      osc.type = o.type; osc.detune.value = dt;
      osc.frequency.setValueAtTime(o.f, o.t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, end);
      osc.connect(tail); osc.start(o.t); osc.stop(end + 0.05);
      last = osc;
    }
    if (last) this.track(last);
    this.route(g, o.bus, o.wet, o.echo, o.pan);
  }

  private noiseHit(o: {
    t: number; dur: number; type: BiquadFilterType; f: number; f2?: number; q?: number; peak: number; att?: number;
    bus: Bus; wet?: number; prio?: number; pan?: number; curve?: 'exp' | 'swell';
  }): void {
    if (!this.claim(o.prio ?? 1)) return;
    const ctx = this.ctx, att = o.att ?? 0.002;
    const src = this.noiseSrc(o.t, o.dur + att + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = o.type; f.Q.value = o.q ?? 0.8;
    f.frequency.setValueAtTime(o.f, o.t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.dur + att);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, o.t);
    g.gain.linearRampToValueAtTime(o.peak, o.t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + att + o.dur);
    src.connect(f); f.connect(g);
    this.track(src);
    this.route(g, o.bus, o.wet ?? 0, 0, o.pan ?? 0);
  }

  // ---------------- music instruments ----------------
  private kick(t: number, vel: number, bus: Bus): void {
    if (!this.claim(3)) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper();
    sh.curve = this.satCurve;
    osc.frequency.setValueAtTime(135, t); osc.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(sh); sh.connect(g); osc.start(t); osc.stop(t + 0.34); this.track(osc);
    this.route(g, bus, 0.04);
    this.noiseHit({ t, dur: 0.012, type: 'bandpass', f: 2200, q: 0.8, peak: 0.07 * vel, bus, prio: 3 });
  }
  private snare(t: number, vel: number, bus: Bus): void {
    this.noiseHit({ t, dur: 0.17, type: 'bandpass', f: 1900, f2: 1200, q: 0.7, peak: 0.2 * vel, bus, wet: 0.35, prio: 2 });
    this.blip({ t, f: 210, f2: 150, type: 'triangle', dur: 0.1, peak: 0.16 * vel, bus, prio: 2 });
  }
  private clap(t: number, vel: number, bus: Bus): void {
    for (const off of [0, 0.011, 0.024]) {
      this.noiseHit({ t: t + off, dur: off === 0.024 ? 0.12 : 0.025, type: 'bandpass', f: 1500, q: 1.1, peak: 0.12 * vel, bus, wet: 0.3, prio: 1, pan: 0.15 });
    }
  }
  private hat(t: number, vel: number, bus: Bus, open: boolean): void {
    this.noiseHit({ t, dur: open ? 0.16 : 0.035, type: 'highpass', f: 6500, q: 0.5, peak: (open ? 0.05 : 0.04) * vel, bus, prio: 1, pan: open ? -0.2 : 0.2 });
  }
  private shaker(t: number, vel: number, bus: Bus): void {
    this.noiseHit({ t, dur: 0.05, type: 'bandpass', f: 5200, q: 0.9, peak: 0.05 * vel, att: 0.012, bus, prio: 1, pan: -0.25 });
  }
  private tom(t: number, vel: number, midi: number, bus: Bus): void {
    const f = midiToFreq(midi);
    this.blip({ t, f: f * 1.4, f2: f, type: 'sine', dur: 0.22, peak: 0.3 * vel, bus, wet: 0.15, prio: 2 });
  }
  private bass(t: number, vel: number, midi: number, dur: number, th: Theme, bus: Bus): void {
    if (!this.claim(3)) return;
    const ctx = this.ctx, f = midiToFreq(midi), end = t + dur;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(th.bass === 'sine' ? 700 : 1500, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3 * vel, t + 0.006);
    g.gain.setTargetAtTime(0.18 * vel, t + 0.02, 0.08);
    g.gain.linearRampToValueAtTime(0, end + 0.04);
    const a = ctx.createOscillator(); a.type = th.bass; a.frequency.value = f;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f;
    const up = ctx.createOscillator(); up.type = 'triangle'; up.frequency.value = f * 2; // audible on small speakers
    const upG = ctx.createGain(); upG.gain.value = 0.35;
    a.connect(lp); sub.connect(lp); up.connect(upG); upG.connect(lp); lp.connect(g);
    for (const o of [a, sub, up]) { o.start(t); o.stop(end + 0.08); }
    this.track(a);
    this.route(g, bus, 0.03);
  }
  private pad(t: number, vel: number, notes: number[], th: Theme, secs: number, bus: Bus): void {
    if (!this.claim(3)) return;
    const ctx = this.ctx, end = t + secs;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1500, t + secs * 0.6);
    lp.frequency.linearRampToValueAtTime(700, end + 0.4);
    const per = 0.05 * vel / Math.sqrt(notes.length);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(per * 3, t + 0.45);
    g.gain.setValueAtTime(per * 3, end - 0.05); g.gain.linearRampToValueAtTime(0, end + 0.5);
    lp.connect(g);
    let last: OscillatorNode | null = null;
    notes.forEach((m, i) => {
      const f = midiToFreq(m);
      for (const [type, cents] of [[th.pad, -9], [th.pad, 9], ['sine', 0]] as [OscillatorType, number][]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents + (i % 2) * 2;
        const og = ctx.createGain(); og.gain.value = type === 'sine' ? 0.6 : 0.5;
        o.connect(og); og.connect(lp); o.start(t); o.stop(end + 0.6); last = o;
      }
    });
    if (last) this.track(last);
    this.route(g, bus, 0.55);
  }

  private playEvent(e: NoteEvent, time: number, sd: number, sess: Session): void {
    const th = this.theme!;
    const bus = sess.layers[e.layer];
    if (!this.layerAudible(sess, e.layer, time)) return;
    this.stats.scheduled++;
    const dur = e.dur * sd;
    switch (e.inst) {
      case 'kick': this.kick(time, e.vel, bus); break;
      case 'snare': this.snare(time, e.vel, bus); break;
      case 'clap': this.clap(time, e.vel, bus); break;
      case 'hat': this.hat(time, e.vel, bus, false); break;
      case 'ohat': this.hat(time, e.vel, bus, true); break;
      case 'shaker': this.shaker(time, e.vel, bus); break;
      case 'tom': this.tom(time, e.vel, e.midi!, bus); break;
      case 'bass': this.bass(time, e.vel, e.midi!, dur, th, bus); break;
      case 'pad': this.pad(time, e.vel, e.notes!, th, dur, bus); break;
      case 'pluck':
        e.notes!.forEach((m, i) => this.blip({ t: time + i * 0.006, f: midiToFreq(m), type: 'triangle', dur: 0.22, peak: 0.05 * e.vel, lp: 2800, lp2: 600, detune: 5, bus, wet: 0.3, echo: 0.3, pan: (i - 1) * 0.3, prio: 1 }));
        break;
      case 'arp':
        this.blip({ t: time, f: midiToFreq(e.midi!), type: th.lead, dur: Math.max(0.09, dur * 0.9), peak: 0.075 * e.vel, lp: 3600, lp2: 900, q: 1.5, detune: 6, bus, wet: 0.2, echo: 0.35, pan: ((e.midi! % 5) - 2) * 0.12, prio: 1 });
        break;
      case 'counter':
        this.blip({ t: time, f: midiToFreq(e.midi!), type: 'sine', att: 0.05, dur: dur * 0.95, peak: 0.1 * e.vel, bus, wet: 0.5, echo: 0.2, pan: 0.2, prio: 1 });
        this.blip({ t: time, f: midiToFreq(e.midi!) * 2, type: 'triangle', att: 0.08, dur: dur * 0.8, peak: 0.025 * e.vel, bus, wet: 0.5, prio: 1 });
        break;
    }
  }

  // ---------------- layers ----------------
  private newSession(): Session {
    const gain = this.ctx.createGain();
    gain.connect(this.musicFilter);
    const mix: [number, number][] = [[0.3, 0], [0.12, 0], [0.2, 0.3], [0.25, 0.15]];
    const layers = mix.map(([w, e]) => this.makeBus(gain, w, e));
    return { gain, layers, ramps: [0, 1, 2, 3].map((l) => ({ t0: 0, t1: 0, v0: l === 0 ? 1 : 0, v1: l === 0 ? 1 : 0 })) };
  }
  private rampValue(r: Ramp, t: number): number {
    if (t >= r.t1) return r.v1;
    if (t <= r.t0) return r.v0;
    return r.v0 + ((r.v1 - r.v0) * (t - r.t0)) / (r.t1 - r.t0);
  }
  private setLayer(sess: Session, l: number, to: number, t0: number, t1: number): void {
    const r = sess.ramps[l];
    const v0 = this.rampValue(r, t0);
    sess.ramps[l] = { t0, t1: Math.max(t1, t0 + 0.001), v0, v1: to };
    const bus = sess.layers[l];
    for (const [p, k] of [[bus.dry.gain, 1], [bus.wet.gain, bus.wetAmt], [bus.echo.gain, bus.echoAmt]] as [AudioParam, number][]) {
      p.cancelScheduledValues(t0);
      p.setValueAtTime(v0 * k, t0);
      p.linearRampToValueAtTime(to * k, t1);
    }
  }
  private layerAudible(sess: Session, l: number, t: number): boolean {
    const r = sess.ramps[l];
    return this.rampValue(r, t) > 0.002 || r.v1 > 0;
  }

  // ---------------- public control ----------------
  setSpeed(mps: number): void { this.speed = mps; }
  setBoost(b: boolean): void { this.boost = b; }
  setPowerUp(b: boolean): void { this.powerUp = b; }
  /** Snap smoothing (tests / offline render). */
  snapSpeed(): void { this.smooth = this.speed; }
  get currentBpm(): number { return this.seq?.bpm ?? 0; }
  get currentLevel(): number { return this.level; }
  get playing(): boolean { return this.seq !== null; }
  get themeId(): string | null { return (this.pending ?? this.theme)?.id ?? null; }

  /** Starts a theme from silence at time `when` (default: now). */
  start(theme: Theme, when = this.ctx.currentTime + 0.05): void {
    this.stop(0.15, when);
    this.theme = theme; this.lastTheme = theme; this.pending = null;
    const sess = this.newSession();
    this.session = sess;
    this.smooth = this.speed;
    this.level = theme.fixedLevel ?? levelFor(this.smooth, this.boost, this.powerUp, 0);
    for (let l = 1; l <= 3; l++) this.setLayer(sess, l, this.level >= l ? 1 : 0, when, when);
    this.musicFilter.frequency.cancelScheduledValues(when);
    this.musicFilter.frequency.setValueAtTime(this.level >= 3 ? 12000 : 5200, when);
    sess.gain.gain.setValueAtTime(1, when);
    this.lastBarTime = -1;
    this.seq = new Sequencer(theme, when, targetBpm(theme, this.smooth));
    this.seq.barStart = when;
    this.startTimer();
  }

  /** Quarter-note grid time at or after now (for quantised stingers). */
  nextBeat(): number {
    const now = this.ctx.currentTime + 0.02;
    return this.seq ? this.seq.nextBeatTime(now) : now;
  }

  /** Switches theme at the next bar line with a riser + cymbal swell. */
  switchTheme(theme: Theme): void {
    if (!this.seq) { this.start(theme); return; }
    if ((this.pending ?? this.theme)?.id === theme.id) return;
    this.pending = theme;
    this.lastTheme = theme;
    const at = this.seq.nextBarTime(), now = this.ctx.currentTime;
    const len = Math.min(1.1, Math.max(0.2, at - now));
    const t0 = Math.max(now, at - len);
    this.noiseHit({ t: t0, dur: len, type: 'bandpass', f: 400, f2: 5000, q: 1.2, peak: 0.12, att: len * 0.9, bus: this.sfxBus, wet: 0.4, prio: 3 });
    this.blip({ t: t0, f: 220, f2: 880, type: 'sine', att: len * 0.9, dur: 0.1, peak: 0.05, bus: this.sfxBus, wet: 0.4, prio: 3 });
    this.noiseHit({ t: at, dur: 0.9, type: 'highpass', f: 5000, q: 0.5, peak: 0.07, bus: this.sfxBus, wet: 0.6, prio: 3 });
  }

  /** Fade the music out. `at` = when the fade starts. */
  stop(fade = 0.3, at = this.ctx.currentTime): void {
    const sess = this.session;
    this.seq = null; this.pending = null; this.session = null;
    if (!sess) return;
    sess.gain.gain.cancelScheduledValues(at);
    sess.gain.gain.setValueAtTime(1, at);
    sess.gain.gain.linearRampToValueAtTime(0, at + fade);
    // Realtime only: drop the old graph once it has faded and its reverb tails are gone.
    if (typeof setTimeout === 'function' && this.realtime) {
      const wait = (Math.max(0, at - this.ctx.currentTime) + fade + 0.1) * 1000;
      setTimeout(() => { try { sess.gain.disconnect(); for (const b of sess.layers) { b.dry.disconnect(); } } catch { /* already gone */ } }, wait + 3000);
    }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private onBar(bar: number, time: number, seq: Sequencer): BarDecision {
    void bar;
    const sess = this.session!;
    const dtBar = this.lastBarTime < 0 ? 100 : time - this.lastBarTime;
    this.lastBarTime = time;
    this.smooth = smoothSpeed(this.smooth, this.speed, dtBar);
    const dec: BarDecision = {};
    const th = this.pending ?? seq.theme;
    if (this.pending) { dec.theme = this.pending; this.theme = this.pending; this.pending = null; }
    const eff = this.smooth + (this.boost ? BOOST_SPEED_BONUS : 0);
    const bpm = seq.bpm;
    dec.bpm = nextBpm(bpm, targetBpm(th, eff));
    const barLen = barSeconds(dec.bpm);
    const want = th.fixedLevel ?? levelFor(this.smooth, this.boost, this.powerUp, this.level);
    if (want !== this.level) {
      for (const r of layerRamp(this.level, want)) this.setLayer(sess, r.layer, r.to, time, time + r.bars * barLen);
      this.level = want;
    }
    this.musicFilter.frequency.cancelScheduledValues(time);
    this.musicFilter.frequency.setValueAtTime(this.musicFilter.frequency.value, time);
    this.musicFilter.frequency.linearRampToValueAtTime(want >= 3 ? 12000 : 5200, time + barLen);
    this.delay.delayTime.setTargetAtTime((beatSeconds(dec.bpm) * 3) / 4, time, 0.05); // dotted eighth
    return dec;
  }

  /** Schedules everything that starts before `until` (defaults to the lookahead window). */
  pump(until = this.ctx.currentTime + LOOKAHEAD): void {
    const seq = this.seq, sess = this.session;
    if (!seq || !sess) return;
    seq.pump(until, (e, t, sd) => this.playEvent(e, t, sd, sess), (bar, t, s) => this.onBar(bar, t, s));
  }

  private startTimer(): void {
    if (this.timer || typeof setInterval !== 'function' || !this.realtime) return;
    this.timer = setInterval(() => this.pump(), TICK_MS);
  }
  pauseTimer(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  resumeTimer(): void { if (this.seq) this.startTimer(); }

  // ---------------- SFX ----------------
  private duckMusic(t: number, hold = 0.18): void {
    const p = this.duck.gain;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(DUCK_GAIN, t, 0.012);
    p.setTargetAtTime(1, t + hold, 0.12);
    this.duckUntil = t + hold + 0.5;
  }

  private key(): Theme {
    return this.theme ?? this.lastTheme ?? WORLD_THEMES[0];
  }
  private deg(d: number, base = 72): number { const k = this.key(); return degreeToMidi(k.scale, base - 12 + k.rootPc, d); }

  /** Crash: low-pass sweep + thump, then the music goes silent. */
  private crash(t: number): void {
    const sess = this.session;
    if (sess) {
      this.musicFilter.frequency.cancelScheduledValues(t);
      this.musicFilter.frequency.setValueAtTime(5200, t);
      this.musicFilter.frequency.exponentialRampToValueAtTime(160, t + 0.3);
      this.stop(0.28, t + 0.05);
      const f = this.musicFilter.frequency;
      f.setValueAtTime(160, t + 0.4); f.linearRampToValueAtTime(5200, t + 0.6);
    }
    const b = this.sfxBus;
    this.blip({ t, f: 130, f2: 38, type: 'sine', dur: 0.45, peak: 0.55, bus: b, wet: 0.12, prio: 4 });
    this.noiseHit({ t, dur: 0.3, type: 'lowpass', f: 2200, f2: 200, q: 0.7, peak: 0.35, bus: b, wet: 0.3, prio: 4 });
    this.blip({ t: t + 0.02, f: 320, f2: 90, type: 'sawtooth', dur: 0.3, peak: 0.07, lp: 1100, bus: b, prio: 4 });
  }

  private win(t: number): void {
    const b = this.sfxBus, k = this.key();
    this.duckMusic(t, 1.2);
    const ds = [0, 2, 4, 7];
    ds.forEach((d, i) => {
      const f = midiToFreq(this.deg(d));
      this.blip({ t: t + i * 0.13, f, type: 'sawtooth', dur: 0.34, peak: 0.1, lp: 2600, lp2: 800, detune: 7, bus: b, wet: 0.4, echo: 0.2, prio: 4 });
      this.blip({ t: t + i * 0.13, f: f * 2, type: 'triangle', dur: 0.3, peak: 0.04, bus: b, wet: 0.5, prio: 4 });
    });
    const tf = t + ds.length * 0.13;
    for (const d of [0, 2, 4, 7, 9]) {
      this.blip({ t: tf, f: midiToFreq(this.deg(d)), type: 'sawtooth', att: 0.02, dur: 1.5, peak: 0.055, lp: 2400, lp2: 700, detune: 8, bus: b, wet: 0.6, prio: 4 });
    }
    this.noiseHit({ t: tf, dur: 1.2, type: 'highpass', f: 6000, peak: 0.04, bus: b, wet: 0.8, prio: 4 });
    void k;
  }

  /** SFX entry point. `arg`: warn tick number (3, 2, 1). */
  sfx(name: string, arg = 0): void {
    const ctx = this.ctx, t = ctx.currentTime + 0.004, b = this.sfxBus;
    if (STINGERS.has(name) && name !== 'win') this.duckMusic(t);
    switch (name) {
      case 'coin': {
        if (t - this.lastCoinTime > 1) this.streak = 0;
        const f = midiToFreq(coinMidi(this.key(), this.streak));
        this.streak++; this.lastCoinTime = t;
        this.blip({ t, f, type: 'triangle', dur: 0.2, peak: 0.16, lp: 5000, bus: b, wet: 0.25, prio: 3 });
        this.blip({ t, f: f * 2, type: 'sine', dur: 0.14, peak: 0.07, bus: b, wet: 0.25, prio: 3 });
        break;
      }
      case 'star': {
        [0, 2, 4, 7].forEach((d, i) => {
          const f = midiToFreq(this.deg(d, 84));
          for (const [mul, pk, dur] of [[1, 0.1, 0.9], [2.01, 0.04, 0.5], [3.97, 0.015, 0.3]]) {
            this.blip({ t: t + i * 0.06, f: f * mul, type: 'sine', dur, peak: pk, bus: b, wet: 0.5, echo: 0.2, prio: 3 });
          }
        });
        break;
      }
      case 'jump':
        this.noiseHit({ t, dur: 0.2, type: 'bandpass', f: 350, f2: 1700, q: 0.9, peak: 0.12, att: 0.04, bus: b, wet: 0.1, prio: 2 });
        this.blip({ t, f: 240, f2: 480, type: 'sine', dur: 0.16, peak: 0.05, bus: b, prio: 2 });
        break;
      case 'slide': case 'roll':
        this.noiseHit({ t, dur: 0.3, type: 'bandpass', f: 2400, f2: 450, q: 0.8, peak: 0.12, att: 0.03, bus: b, prio: 2 });
        break;
      case 'lane':
        this.blip({ t, f: 1100, f2: 800, type: 'triangle', dur: 0.04, peak: 0.07, bus: b, prio: 2 });
        this.noiseHit({ t, dur: 0.02, type: 'bandpass', f: 3000, q: 1, peak: 0.04, bus: b, prio: 2 });
        break;
      case 'powerup': {
        [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => {
          const f = midiToFreq(this.deg(d, 72));
          this.blip({ t: t + i * 0.055, f, type: 'sawtooth', dur: 0.22, peak: 0.07, lp: 3800, lp2: 900, detune: 6, bus: b, wet: 0.35, echo: 0.4, prio: 3 });
        });
        break;
      }
      case 'boardbreak':
        this.noiseHit({ t, dur: 0.09, type: 'bandpass', f: 1000, q: 1.4, peak: 0.25, bus: b, wet: 0.15, prio: 3 });
        [0, 0.03, 0.07].forEach((o, i) => this.blip({ t: t + o, f: 420 - i * 90, f2: 200, type: 'triangle', dur: 0.14, peak: 0.12, bus: b, prio: 3 }));
        this.blip({ t, f: 110, f2: 45, type: 'sine', dur: 0.2, peak: 0.3, bus: b, prio: 3 });
        break;
      case 'jetpack': this.jetpack(true); break;
      case 'jetpackStop': this.jetpack(false); break;
      case 'warn': {
        const d = arg === 1 ? 7 : 4;
        this.blip({ t, f: midiToFreq(this.deg(d, 84)), type: 'sine', dur: arg === 1 ? 0.22 : 0.1, peak: 0.12, bus: b, wet: 0.15, prio: 3 });
        break;
      }
      case 'nearmiss':
        this.noiseHit({ t, dur: 0.28, type: 'bandpass', f: 600, f2: 3200, q: 1.4, peak: 0.12, att: 0.1, bus: b, pan: this.sfxRng.chance(0.5) ? -0.5 : 0.5, prio: 2 });
        break;
      case 'combo': {
        for (let i = 0; i < 6; i++) {
          const d = [7, 9, 11, 14, 11, 16][i] + (this.sfxRng.int(2) ? 0 : 0);
          this.blip({ t: t + i * 0.04, f: midiToFreq(this.deg(d, 84)), type: 'sine', dur: 0.2, peak: 0.07, bus: b, wet: 0.5, echo: 0.3, pan: i % 2 ? 0.4 : -0.4, prio: 3 });
        }
        break;
      }
      case 'click':
        this.blip({ t, f: 760, f2: 520, type: 'sine', dur: 0.05, peak: 0.12, bus: b, prio: 3 });
        break;
      case 'win': this.win(this.nextBeat()); break;
      case 'crash': this.crash(t); break;
    }
  }

  private jetpack(on: boolean): void {
    const ctx = this.ctx, t = ctx.currentTime;
    if (!on) { this.jet?.stop(); this.jet = null; return; }
    if (this.jet || !this.claim(4)) return;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.9;
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 78;
    const sawLp = ctx.createBiquadFilter(); sawLp.type = 'lowpass'; sawLp.frequency.value = 400;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.02;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.15);
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(bp); bp.connect(g); saw.connect(sawLp); sawLp.connect(g);
    this.route(g, this.sfxBus, 0.05);
    src.start(t); saw.start(t); lfo.start(t);
    this.track(src);
    this.jet = {
      gain: g,
      stop: () => {
        const n = ctx.currentTime;
        g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + 0.25);
        for (const o of [src, saw, lfo]) o.stop(n + 0.3);
      },
    };
  }
}
