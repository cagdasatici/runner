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

  /** Pause/resume everything when the app goes to the background. */
  suspend(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) { this.engine?.pauseTimer(); void this.ctx.suspend(); } else { void this.ctx.resume(); this.engine?.resumeTimer(); }
  }
}
