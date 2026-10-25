# Music and SFX design

Everything is generated in code with Web Audio (no samples). Code: `web/src/audio/`.

- `theory.ts`: seeded RNG (mulberry32), scales, degree to MIDI. `themes.ts`: 12 world themes + menu + endless; results reuses the world's key.
- `music.ts`: pure logic (bar generation, layer gating, tempo, `Sequencer`). Tested in `web/tests/music.test.ts`.
- `engine.ts`: instruments, buses, 25 ms lookahead scheduler (140 ms ahead), SFX.
- `audio.ts`: facade used by main.ts: `unlock`, `setMuted`, `playMusic('menu'|'run'|{mode,world})`, `stopMusic`, `setSpeed`, `setBoost`, `setPowerUp`, `sfx(name, arg)`.

## Themes (root, mode, tempo range, drums)
| World | Key | Mode | BPM | Drums |
|---|---|---|---|---|
| 1 | C | major | 112-126 | four |
| 2 | G | mixolydian | 114-128 | bounce |
| 3 | A | dorian | 116-130 | broken |
| 4 | D | lydian | 112-128 | half |
| 5 | E | minor | 118-134 | four |
| 6 | F | major | 114-130 | shuffle (swing .18) |
| 7 | Bb | dorian | 116-132 | bounce |
| 8 | D | mixolydian | 118-134 | broken |
| 9 | A | minor | 120-136 | four |
| 10 | Eb | lydian | 114-130 | half |
| 11 | F | dorian | 120-136 | shuffle |
| 12 | C | lydian | 122-136 | bounce |
| menu | F | major | 92 fixed, layer 1 only | half |
| endless | D | dorian | 112-136 | four |

Chords are diatonic (stacked scale thirds), so every pitched note is in key (unit-tested for all themes).
All themes swing odd 16ths a little (0.06 by default; menu 0.16, worlds 6 and 11 more).

## Form and melody (horizontal)
Each theme is a 32-bar song that repeats: verse (8) - chorus (8) - verse 2 (8) - breakdown (8). A theme switch restarts at the verse.
- Chords per section, as indices into the theme's 4-chord `prog`: verse/verse 2 `0 1 2 3 0 1 2 3`, chorus `3 0 2 1 3 0 1 3`, breakdown `0 0 3 3 2 2 3 3` (half-speed harmony).
- Lead melody: hand-written one-bar motifs (`MOTIFS` in music.ts, degrees above the chord root; chord tones on strong beats). Each theme has a 4-motif set `melody = [a, b, c, d]`: verse bars `a b a c a b d` + cadence, chorus `c d c a c d b` + high cadence, an octave up when it fits. The breakdown lead holds long chord tones. Same theme = same tune every time.
- Counter line (L3) harmonises the lead's long notes a third below.
- Bass follows the theme pattern (chorus adds a pickup octave), walks into the next chord with an in-key approach note on the last 16th, and holds whole notes in the breakdown.
- Drums: accented hats, ghost snares on odd bars, a snare+tom fill on bar 8, crash at section starts. Breakdown: no hats/snare/clap, kick on beat 1, then 2 and 4 kicks per bar and a snare roll to rebuild.
- Humanising (deterministic per bar): velocity +-10 %, timing drift up to +-0.06 of a 16th (never on kicks, never before a bar line).

## Instruments and mix
Pad: 3 detuned oscillators + sine per note, filter envelope that swells through the bar plus a slow LFO. Lead: two detuned oscillators + sub square, per-note filter blip, delayed vibrato, reverb + echo. Bass: plucky resonant filter that snaps shut (velocity opens it). Snare: two detuned body tones + bandpassed crack + highpassed sizzle. Hats: velocity changes length and brightness. Kicks pump the tonal buses (pad, bass, plucks, arp, lead, counter) down by 45 % for ~0.1 s, sidechain style; drums are on separate, unpumped buses.

## Layers (vertical)
L0 pad + kick + lead melody always; L1 hats, snare, bass, chord plucks from 14 m/s; L2 arp lead from 18 m/s; L3 shaker, toms, clap, open hat, counter-melody and filter opening (5.2 kHz to 12 kHz) from 22 m/s or while a power-up is active. Held boost adds +3 m/s. Hysteresis 0.8 m/s. Changes are evaluated at bar lines: fade in 1 bar, out 2 bars. Speed is smoothed (1.5 s time constant sampled per bar).
Tempo: linear in speed 9 to 24 m/s between the theme's min and max, even BPM, max 4 BPM change per bar.

## Switching and stingers
Theme change waits for the next bar line, with a noise riser and cymbal swell. Results starts on the next beat together with the quantised win fanfare. Crash: low-pass sweep + thump, music fades out. Stingers (star, powerup, boardbreak, combo, win) duck music by 6 dB (12 ms attack, ~0.12 s release).

## Safety
Master chain: compressor, limiter, soft clip bounded at 0.92, 9.5 kHz low-pass; music trimmed to 0.2. Voice cap 22 (hats and arps dropped first). Offline check (`node scripts/check-audio.mjs`): 20 s of 5 configurations, peak < 0.95, RMS about -20 dBFS, no NaN.

## SFX names
coin (pitch climbs the scale one octave, resets after 1 s), star, jump, slide/roll, lane, powerup, boardbreak, jetpack/jetpackStop, warn (arg 3, 2, 1), nearmiss, combo, click, win, crash.
