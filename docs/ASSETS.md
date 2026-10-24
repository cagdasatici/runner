
## Environment graphics (themes, trains, ramps, skyline)

No third-party assets were downloaded for the environment work. Everything (sky, skyline, facades, vehicle trim sheet, props)
is procedural: Canvas 2D textures and merged low-poly geometry generated in code (web/src/gfx/). Nothing added to web/public,
total added asset size 0 bytes, so the offline cache (vite.config.ts) needs no change.
# Third-party assets

All models are by **Quaternius**, listed on poly.pizza as "Public Domain (CC0)" (checked 2026-10-24 on each model page).
Licence text: `docs/licenses/CC0-1.0.txt` (CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/).

Note: quaternius.com switched new releases to the "Quaternius Asset License (QAL) v1.0" on 2026-08-28. These files were
published as CC0 before that and the poly.pizza listings still show CC0 (a CC0 dedication is irrevocable), so they are kept.
Do not add newer Quaternius downloads without re-checking their licence.

| File (web/public/models) | Source model / pack | URL | Original size | Shipped size |
|---|---|---|---|---|
| adventurer.glb | "Adventurer", Quaternius (Ultimate Modular Men / Animated Character set) | https://poly.pizza/m/5EGWBMpuXq | 1899 KB | 1555 KB |
| shiba.glb | "Shiba Inu", Animated Animal Pack, Quaternius | https://poly.pizza/m/y4wdQpg767 (bundle https://poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS) | 831 KB | 701 KB |
| fox.glb | "Fox", Animated Animal Pack, Quaternius | https://poly.pizza/m/Bc97C66HKi | 938 KB | 786 KB |
| cat.glb | "Cat", Quaternius | https://poly.pizza/m/qKICY6xla2 | 233 KB | 222 KB |

Downloaded 2026-10-24 from static.poly.pizza. Modifications: unused animation clips removed, duplicate clip names
removed, unused nodes pruned with @gltf-transform/core + functions.
Kept clips: adventurer Run/Roll/Death/HitRecieve/Idle/Idle_Neutral; shiba and fox Gallop/Gallop_Jump/Death/Idle/
Idle_HitReact_Left; cat Run/Jump_Start/Jump_Loop/Death/Idle.
Rejected: other cats on poly.pizza (CC-BY 3.0, not CC0).
