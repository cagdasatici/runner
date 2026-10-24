// Port of scripts/make_audio.swift: music and sound effects are synthesised in code with Web Audio.
// iPad Safari only allows sound after a user gesture, so call unlock() from the first tap.

const RATE = 22050;
type Chord = [number, boolean]; // [pitch class of root, minor?]
const C: Chord = [0, false], G: Chord = [7, false], Am: Chord = [9, true], F: Chord = [5, false];
const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let lcg = 12345;
const noise = () => { lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0; return lcg / 2147483648 - 1; };

class Buf {
  s: Float32Array;
  constructor(seconds: number) { this.s = new Float32Array(Math.round(seconds * RATE)); }
  add(start: number, dur: number, amp: number, gen: (t: number) => number, env = true): void {
    const i0 = Math.round(start * RATE), n = Math.round(dur * RATE);
    for (let k = 0; k < n && i0 + k < this.s.length; k++) {
      const t = k / RATE;
      let e = 1;
      if (env) e = Math.min(1, t / 0.005, Math.max(0, (dur - t) / 0.02));
      this.s[i0 + k] += amp * e * gen(t);
    }
  }
}
const square = (f: number, duty = 0.25) => (t: number) => ((t * f) % 1 < duty ? 1 : -1);
const triangle = (f: number) => (t: number) => 4 * Math.abs(((t * f) % 1) - 0.5) - 1;
const sweep = (f0: number, f1: number, dur: number) => (t: number) => {
  const k = Math.log(f1 / f0) / dur;
  return ((f0 * (Math.exp(k * t) - 1)) / k) % 1 < 0.5 ? 1 : -1;
};

function music(bpm: number, chords: Chord[], leadAmp: number, kick: boolean): Buf {
  const beat = 60 / bpm;
  const b = new Buf(16 * 4 * beat);
  const arp = [1, 3, 5, 8, 5, 3, 5, 8, 1, 3, 5, 8, 10, 8, 5, 3];
  for (let bar = 0; bar < 16; bar++) {
    const [pc, minor] = chords[bar % 4];
    const t0 = bar * 4 * beat;
    const third = minor ? 3 : 4;
    const off = (d: number) => (d === 1 ? 0 : d === 3 ? third : d === 5 ? 7 : d === 8 ? 12 : 12 + third);
    const base = 72 + pc - (pc >= 7 ? 12 : 0);
    for (let i = 0; i < 16; i++) b.add(t0 + (i * beat) / 4, beat / 4, leadAmp, square(freq(base + off(arp[i]))));
    const bassBase = 36 + pc - (pc >= 7 ? 12 : 0);
    for (let i = 0; i < 8; i++) {
      const st = t0 + (i * beat) / 2;
      b.add(st, beat / 2, 0.22, triangle(freq(bassBase + (i % 2 === 0 ? 0 : 12))));
      b.add(st, 0.03, 0.06, (t) => noise() * Math.max(0, 1 - t / 0.03), false);
    }
    if (kick) {
      for (const bt of [0, 2]) {
        b.add(t0 + bt * beat, 0.12, 0.5, (t) => {
          const k = Math.log(45 / 150) / 0.12;
          return Math.sin((2 * Math.PI * 150 * (Math.exp(k * t) - 1)) / k) * Math.max(0, 1 - t / 0.12);
        }, false);
      }
    }
  }
  return b;
}

function makeSounds(): Record<string, Buf> {
  const crash = new Buf(0.35);
  crash.add(0, 0.35, 0.5, (t) => noise() * Math.exp(-t * 12), false);
  crash.add(0, 0.35, 0.25, sweep(400, 80, 0.35));
  const coin = new Buf(0.2);
  coin.add(0, 0.06, 0.2, square(freq(83), 0.5));
  coin.add(0.06, 0.14, 0.2, square(freq(88), 0.5));
  const jump = new Buf(0.15);
  jump.add(0, 0.15, 0.2, sweep(300, 600, 0.15));
  const star = new Buf(0.45); // golden star: quick rising sparkle
  [84, 88, 91, 96].forEach((m, i) => star.add(i * 0.05, 0.25, 0.16, square(freq(m), 0.5)));
  const win = new Buf(1.3); // level complete: little fanfare
  [72, 76, 79].forEach((m, i) => win.add(i * 0.12, 0.12, 0.2, square(freq(m), 0.5)));
  for (const m of [72, 76, 79, 84]) win.add(0.36, 0.9, 0.1, triangle(freq(m)));
  win.add(0.36, 0.9, 0.14, square(freq(84), 0.25));
  return {
    star, win,
    menu: music(100, [C, Am, F, G], 0.16 * 0.6, false),
    run: music(140, [C, G, Am, F], 0.16, true),
    crash, coin, jump,
  };
}

const MUTE_KEY = 'muted';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private musicNode: AudioBufferSourceNode | null = null;
  private wanted: string | null = null;
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
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      const sounds = makeSounds();
      for (const [name, buf] of Object.entries(sounds)) {
        const ab = this.ctx.createBuffer(1, buf.s.length, RATE);
        const data = ab.getChannelData(0);
        for (let i = 0; i < buf.s.length; i++) data[i] = Math.tanh(1.2 * buf.s[i]); // soft clip, as on iOS
        this.buffers[name] = ab;
      }
      if (this.wanted) this.playMusic(this.wanted);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  playMusic(name: string): void {
    this.wanted = name;
    this.stopMusic(false);
    if (!this.ctx || !this.master || !this.buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = true;
    src.connect(this.master);
    src.start();
    this.musicNode = src;
  }

  stopMusic(forget = true): void {
    if (forget) this.wanted = null;
    this.musicNode?.stop();
    this.musicNode = null;
  }

  sfx(name: string): void {
    if (!this.ctx || !this.master || !this.buffers[name] || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.connect(this.master);
    src.start();
  }

  /** Pause/resume everything when the app goes to the background. */
  suspend(hidden: boolean): void {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }
}
