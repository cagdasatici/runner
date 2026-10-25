# Runner feel research: what to borrow (mechanics only)

Date: 2026-10-24. Method: web search only. Search results were thin for exact numbers on
Temple Run 2, Minion Rush and Sonic Dash; the WebFetch of the Subway Surfers wiki returned 402.
Legend: [S] = sourced from a page listed below. [D] = my design recommendation / common genre
convention, NOT verified against a reference game. Treat all [D] constants as tunables.
No art, audio or names are to be copied; this describes mechanics only.

## Ranked borrow list

| # | Feature | What references do | Recommended constants for Subway Runner | Effort | Priority |
|---|---------|--------------------|------------------------------------------|--------|----------|
| 1 | Shield/hoverboard (crash absorb) | Subway Surfers: protects from crashing for ~30 s [S]; on a hit it breaks/explodes and needs a few seconds to recharge [S] | Absorbs 1 hit or 20 s [D]; on break: 1.5 s i-frames (blink), obstacle destroyed, camera shake + puff, no recharge for a kid game [D] | M | P0 |
| 2 | Stumble then caught (chaser) | Genre standard: first hit = stumble + chaser closes in; second hit within a window = caught | Hit 1: slow to 70% for 0.6 s, chaser appears at 4 m behind, 1.0 s i-frames. Hit 2 within 8 s = fall. Chaser retreats after 8 s clean [D] | M | P0 |
| 3 | Coin magnet | SS: upgradable, +5 s per level, max 30 s [S] | 10 s base, pull radius 6 m, lane-agnostic, coins ease-in fly (0.25 s) [D] | S | P0 |
| 4 | Jetpack / fly | SS: upgradable, max 25 s [S]; hoverboard/sneakers timers pause while flying [S] | 6 s base, rail of coins at fixed height, last 1 s blinks, soft descent over 0.8 s, 1.5 s i-frames on landing [D] | M | P0 |
| 5 | Score multiplier progression | SS: missions raise multiplier +1 per completed set of 3, cap x30 [S]; 2x power-up upgradable [S] | Kid mode: cap x5, +1 per 3 completed missions or per 500 m; 2x pickup 10 s [D] | S | P1 |
| 6 | Daily missions / daily challenge | SS: 3 tasks per set; Word Hunt daily letters [S]; Jetpack Joyride: objective-based missions are the retention hook [S] | 3 missions per set, always achievable in one session; one daily collect-the-letters word (kid vocabulary) [D] | M | P1 |
| 7 | Super sneakers / jump boost | SS: upgradable, max 30 s [S] | 8 s, jump height x1.6, air time x1.3 [D] | S | P1 |
| 8 | Revive / second chance | SS: keys or rewarded ad [S]; TR2: gems, cost doubles each use [S] | Free revive once per run (no ad, no currency); then restart. Never doubling cost [D] | S | P0 |
| 9 | Near-miss bonus | Common in runners (not verified for the named games) | Passing within 0.4 m of an obstacle edge = "Close!" +25 pts, tiny whoosh + 1 streak; no penalty if you miss it [D] | S | P1 |
| 10 | Coin streak / combo | Common | 8 coins in a row without a gap = star burst +50; streak resets on crash only, not on a missed coin [D] | S | P2 |
| 11 | Speed ramp | All references accelerate over time | Start 12 m/s, +0.25 m/s every 100 m, cap 26 m/s; level mode: fixed speed per level [D] | S | P0 |
| 12 | Mystery box | SS: Super Mystery Box rewards for streaks and Word Hunt [S] | Daily gift box, always a win, opened with a 1.5 s animation, no purchasable boxes [D] | M | P2 |
| 13 | Power-up upgrade tiers | SS: 6 levels, +5 s each, price 500 to 60000 coins [S] | 3 tiers, +3 s each, cost 100/300/800 coins, earnable in 2-3 sessions [D] | M | P2 |
| 14 | FOV/camera speed feel | Common | FOV 60 to 72 as speed rises; 0.15 s lerp; shake 0.2 s on hit [D] | S | P1 |
| 15 | Coin fly-to-HUD | Common | On pickup, a 2D sprite flies to the counter in 0.4 s with ease-out, counter pops 1.15x [D] | S | P1 |

## 1. Power-ups

Sourced facts [S]:
- Subway Surfers: Coin Magnet, Jetpack, Super Sneakers, 2x Multiplier have 6 upgrade levels; each adds 5 s;
  max duration 30 s, Jetpack max 25 s; upgrade prices run 500 up to 60000 coins.
- Hoverboard protects from crashing for 30 s; when hit it breaks and has a short recharge. Board variants exist
  (Windglider is a 30 s protection board).
- While the Jetpack is active, sneakers and hoverboard timers are paused until landing (per wiki wording).
- Temple Run 2: Boost gives invincibility and speed and auto-turns corners; Coin Magnet unlocks around level 5;
  ability upgrades lengthen power-up durations and Boost distance. Exact seconds were not found.
- Not found: hoverboard double-tap activation specifics (the sources describe tap to activate), i-frame length after
  a board breaks, magnet radius, jetpack landing details, coin-trail layout. Treat these as [D].

Design for Subway Runner:
- One active timed power-up per type, a new pickup refreshes (does not stack) the timer.
- Pause timers during fly, as SS does; it is fair for a child.
- HUD: a circular countdown ring per active power-up; last 20% pulses and plays a soft tick.
- Shield: double-tap or tap-the-icon to activate is optional; for a child, auto-activate on pickup
  (fewer failure modes on touch). Keep a visible bubble; on break play a pop and 1.5 s blink.
- Jetpack: lift off over 0.5 s, coin arc along the flight, safe from all obstacles, landing always on a clear
  strip (spawner must guarantee 15 m free at the end of the flight).
- Magnet: also attracts the golden star in level mode.

## 2. Game-feel mechanics

- Chaser, stumble then caught: first collision is non-fatal. Slow the runner briefly, shake the camera, bring the
  chaser (friendly creature, not a scary one) into view behind. A second collision while it is near ends the run
  and plays a short caught animation. After a calm window the chaser drifts back out. Gives kids a forgiving
  safety net and tension without a hard fail [D].
- Revive: SS offers keys or an ad; TR2 charges gems, doubling each time [S]. We do one free revive per run, with a
  3-2-1 count and 2 s of i-frames [D].
- Missions: SS sets of 3, multiplier +1 per completed set, cap 30 [S]. Jetpack Joyride's objective missions are
  repeatedly cited as the engagement driver [S]. Show progress bars on the pause screen and results screen.
- Near-miss and combo: I found no numbers for the named games; implement as in the table.
- Speed ramp: ramp speed, not obstacle density, first. Cap speed so a child on a touch screen can react:
  reaction budget >= 0.7 s between obstacle rows at max speed (spacing >= 18 m at 26 m/s) [D].
- Camera/FOV: widen FOV and lower the camera slightly with speed; brief zoom-out on power-up start [D].
- Juice: coin pickup pitch rises 1 semitone per coin in a streak up to an octave, resets after 1 s (common trick);
  screen-edge sparkle on streaks; results screen counts up with a tick per 10 points and a final star-pop.
- Haptics: iPad Safari has no Vibration API support, so haptics are not available on the target; use visual
  and audio feedback only. Do not rely on navigator.vibrate [D, verify on device].

## 3. Music and audio

Sourced [S]: vertical layering (stems that share tempo and key, volume-controlled) is the most common and
approachable adaptive method; a minimal version is one always-on base loop plus an intensity layer faded in by one
gameplay variable such as speed; stems must be sample-identical in length to avoid drift; smooth the control
parameter and use curved (equal-power) fades; Web Audio gives the primitives but no editor.

Recommendations for a procedural Web Audio engine [D]:
- Scheduler: lookahead scheduler (setInterval 25 ms, schedule 100-150 ms ahead on AudioContext.currentTime). This is
  the standard pattern for tight timing; never use setTimeout for note starts.
- Generate everything: oscillators/noise buffers for drums (kick, snare, hat), bass, pad, lead arp. No samples,
  so no copyright risk.
- Layers (all quantised to the bar): L0 pad + kick (always), L1 hats + bass (from speed 14 m/s), L2 arp lead
  (from 18 m/s), L3 extra percussion + filter open (from 22 m/s or while a power-up is active).
  Fade layers in over 1 bar, out over 2 bars. Drive from a smoothed speed value, not raw.
- Tempo vs speed: change BPM in small steps (e.g. 112 to 136 BPM across the speed range) at bar boundaries.
  Because it is generated, tempo changes cause no pitch shift (unlike changing playback rate on audio files).
- Per-theme: change scale/mode, root note, instrument waveforms and drum pattern per world; crossfade or switch at
  a bar line with a 1-bar riser.
- Stingers: coin = short pentatonic pluck matched to the current key (so pickups are always in tune); power-up =
  rising 3-note; crash = low thump plus filtered-down music (lowpass sweep to 400 Hz over 0.3 s); level complete =
  major fanfare quantised to next beat.
- Ducking: sidechain-style gain dip on the music bus (-6 dB, 80 ms attack, 300 ms release) when SFX stingers or
  voice play; use a master compressor/limiter to prevent clipping.
- iPad: create/resume AudioContext on first user gesture; handle visibilitychange (suspend on hide);
  keep voice count low (<24) for battery and glitch-free playback.
- Mix hygiene: music bus around -14 LUFS-equivalent relative to SFX; a user-facing music/SFX volume slider.

## 4. Kid-friendly and safety notes

Avoid these patterns seen in the genre [S where noted]:
- Revive for keys/ads and gem costs that double on each use [S]: replace with one free revive.
- Rewarded-ad prompts at the death screen and loot boxes tied to streaks or purchase [S: Super Mystery Boxes]:
  no ads, no real-money purchases, no purchasable boxes, no countdown timers or FOMO events.
- Streak-loss pressure (daily login/Word Hunt streak rewards [S]): use a gentle "welcome back" instead of
  streak-break punishment.
- Social/leaderboards with strangers: avoid; use local best score only.
- Data: no analytics beyond local storage; COPPA-friendly by design; no external requests from the game.
- Accessibility: reduced-motion toggle (no camera shake/FOV warp), colour-blind-safe pickups (shape plus colour),
  large touch targets (>=48 px), no flashing above 3 Hz, a "relaxed" speed cap.
- Failure tone: encouraging text and a quick retry (<2 s to restart); never shame the player.
- Rewards: every run ends with something earned (coins, a star progress bar), never zero.

## Open gaps (worth a follow-up if the numbers matter)

- Exact base seconds for SS magnet/sneakers/2x, TR2 power-up durations, Minion Rush and Sonic Dash specifics.
- Hoverboard i-frames and double-tap behaviour; SS guard/chaser catch sequence.
- Playtest on the target iPad to tune all [D] constants, especially the speed cap and i-frames.

## Sources

- https://subwaysurf.fandom.com/wiki/Power-Ups
- https://subwaysurf.fandom.com/wiki/Super_Sneakers
- https://subwaysurf.fandom.com/wiki/Windglider
- https://subwaysurf.fandom.com/wiki/Multiplier
- https://subwaysurf.fandom.com/wiki/Missions
- https://subwaysurf.fandom.com/wiki/Super_Mystery_Box
- https://sybo.helpshift.com/hc/en/5-subway-surfers/faq/143-missions/?p=android
- https://en.wikipedia.org/wiki/Subway_Surfers
- https://giantbomb.com/wiki/Games/Temple_Run_2
- https://www.gamerevolution.com/?p=58670
- https://www.pocketgamer.com/temple-run-2/temple-run-2-hints-tips-and-tricks-how-to-stay-on-your-feet/
- https://en.wikipedia.org/wiki/Jetpack_Joyride
- https://destructoid.com/?p=91439
- https://bugnet.io/blog/adaptive-music-a-beginners-guide
- https://www.abratabia.com/web-game-audio/dynamic-game-music.php
- https://gamedeveloper.com/audio/composer-guy-jones-talks-adaptive-music-for-games
