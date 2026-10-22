# Subway Runner: Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Subway Runner look like a real, polished kids' game, with no change to gameplay:
- a cartoon kid with a run cycle, jump tuck, roll and crash fall
- gravel track with wooden sleepers and steel rails
- a colourful city of buildings with lit windows, parks, street lamps and wire gantries
- detailed trains, striped barriers and shiny spinning coins
- a painted sky with clouds, sun shadows, bloom, fog and particles (dust, coin sparkle, crash burst)
- a chunky toy-style HUD, crash panel and menu, with a live 3D backdrop on the menu

**Architecture:** Visuals only. `GameCore` is **not touched**, so the rules, autopilot and tests are unchanged. All art is generated in code at launch: textures with `UIGraphicsImageRenderer`, models from SceneKit primitives, particles from `SCNParticleSystem`. There are no downloaded assets and no licensing risk. New files:
- `Textures.swift` (images)
- `Materials.swift` (shared PBR materials plus node helpers)
- `Character.swift` (jointed runner, posed every frame from `RunnerState`)
- `World.swift` (environment, camera, track segments, obstacles, coins)
- `Effects.swift` (particles)

`GameController`, `GameView`, `MenuView` and `ColorHex` are replaced.

**Base plan:** `docs/superpowers/plans/2026-10-22-subway-runner.md`. Its Executor Rules apply unchanged, and this plan reuses its build, install and screenshot commands (steps 6.9, 7.4, 9.1).

**Pre-verified:** On 2026-10-22, every file below was applied stage by stage to a copy of this repo at commit `1331165`, and each stage built with **zero errors**. The final app ran on the iPhone 18 Pro and iPad Pro 13-inch (M5) simulators, with menu, autoplay, crash and run-cycle screenshots checked. A before/after picture is at `/Users/cagdas/Library/Application Support/Claude/side-session-notes/local_ed920f1e-5efd-4d65-b1f2-34292b643962/subway-runner-before-after.png`. Copy the code exactly.

---

## Executor Rules (in addition to the base plan's rules)

1. Work in `/Users/cagdas/Projects/Subway_Runner`. Don't modify anything under `GameCore/`, or `project.yml`, `App/SubwayRunnerApp.swift`, `App/Audio.swift`, `App/Audio/`, `App/PrivacyInfo.xcprivacy` or `App/Assets.xcassets`.
2. Create or replace files with **exactly** the code shown. Don't change colours, numbers or names.
3. Run `xcodegen generate` before every build, because new `.swift` files only join the project after regeneration.
4. Build command (the same as base step 6.9):
   `xcodegen generate && xcodebuild -project SubwayRunner.xcodeproj -scheme SubwayRunner -destination 'generic/platform=iOS Simulator' -derivedDataPath build build 2>&1 | grep -E "error:|BUILD"`
   Expected: `** BUILD SUCCEEDED **` and no `error:` lines.
5. Use simctl only. Don't open Simulator.app. Look at screenshots by reading the PNG.
6. Commit after each task with exactly the message given. Never push.
7. Never use the names "Subway Surfers", "SYBO", "Jake", "Tricky", "Fresh", "hoverboard" or "Inspector", or that game's art, in code, comments, store text or screenshots.

## Visual Spec (all values are already in the code)

| Area | Look |
|---|---|
| Sky | Equirectangular gradient `#1D4ED8` → `#38BDF8` → `#BAE6FD` → `#FDE68A` (horizon) → `#FBCFE8`, with 18 small cloud puffs just above the horizon. Also used as image-based lighting (intensity 1.3). |
| Light | Sun: directional, 1600, warm `#FFF1D6`, angles (−0.95, 0.55, 0), 2048² shadow map, 8 samples, radius 2, 45 % black shadow, max distance 45. Ambient fill 220 `#BFDBFE`. |
| Fog | 45 → 115 m, exponent 1.3, `#E9EEF0` |
| Camera | FOV 66° → 76° as speed rises 10 → 20; HDR bloom 0.45 (threshold 0.85, blur 10); vignette 0.35/1.2; saturation 1.12; position (0.6x, 4.0, −z+7.2), pitch −0.2 |
| Track (per 18 m) | Gravel bed 8.6 m wide; sleepers 2.3×0.1×0.3 every 1.2 m; rails = dark base + metallic head at ±0.72 from lane centre; concrete curbs at ±5 with a yellow edge line |
| City | Per side, two 9 m lots: building 7×(6–14)×8.6 m with a window facade in one of 8 colours, plus a roof slab and maybe a water tank; or (1 in 4) a grass park with 2 trees. Street lamps on even segments, wire gantry every 3rd segment. Seeded by segment index, so it's stable. |
| Runner | Teal hoodie, orange backpack and straps, navy trousers, white trainers with orange soles, red cap, brown hair, eyes, rosy cheeks and a smile. Joints: hips, knees, shoulders and elbows. One stride per 2.6 m, a hip bob, leaning into lane changes. |
| Poses | Jump: knees tucked, arms up. Roll (slide): curled ball spinning forward. Crash: falls backwards, arms up. |
| Hurdle | Two red/white striped boards on dark-metal legs, with red warning lights |
| Bar | A yellow/black striped beam on posts, with 3 red warning lights on top |
| Train | 2.3×3.0×10 m rounded body; side livery (white, blue window band with 9 windows, red and yellow stripes, doors, grey skirt); front with windscreen, sign and headlights; roof unit; 2 bogies with 8 wheels |
| Coin | Gold metallic disc plus darker inner disc, spinning once per 1.2 s; when collected it pops up, grows, fades and sparkles |
| FX | Dust puffs behind the feet while running on the ground; crash star burst plus camera shake |
| HUD | ✕ in a frosted circle; a "SCORE" capsule; a coin capsule with a drawn coin icon; numbers in black rounded font |
| Crash panel | Indigo gradient card with a white border; outlined "Crash!" title; score, coins and a "New best!" trophy chip; chunky orange "Play Again" and blue "Menu" buttons; springs in |
| Menu | Live 3D backdrop (the runner jogging on the tracks, camera slowly swinging); tilted outlined "SUBWAY / RUNNER" title; trophy "Best" chip; pulsing green chunky PLAY; three hint tiles (Lanes, Jump, Roll); frosted mute button |

## Review Focus

1. **Thread safety:** segments and obstacles are built on SceneKit's render thread. All shared textures and materials are `static let`, which Swift makes thread-safe. There are no mutable static caches. Don't add any.
2. **Gameplay unchanged:** `cd GameCore && swift test` still reports 27 tests, and the autoplay crash with seed 2 still shows **Score 39**.
3. **Cost:** segments and obstacles are `flattenedClone()`d, and segments don't cast shadows. The menu and game never render at the same time.

---

## File Structure

```
App/Textures.swift      # NEW: generated images (sky, gravel, wood, facades, stripes, train livery, particle dot)
App/Materials.swift     # NEW: shared PBR materials + SCNNode.box/capsule/sphere/cylinder/at helpers
App/Character.swift     # NEW: RunnerFigure (jointed kid, pose(_:time:), menuPose(time:))
App/World.swift         # NEW: setupEnvironment, makeCamera, segment(k), obstacle(o), coin(c)
App/Effects.swift       # NEW: FX.dust(), FX.sparkle(), FX.crash()
App/ColorHex.swift      # REPLACED: + ChunkyButtonStyle, CoinIcon, OutlinedTitle
App/GameController.swift# REPLACED: uses World/RunnerFigure/FX
App/GameView.swift      # REPLACED: new HUD + crash panel
App/MenuView.swift      # REPLACED: 3D backdrop menu
```

---

### Task V0: Preflight

- [ ] **V0.1** Run `cd /Users/cagdas/Projects/Subway_Runner && git status --short`. Expected: no output, or only this plan file (untracked). Run `git log --oneline -1`. Expected: `1331165 chore(store): screenshots, privacy page, metadata`, or a later commit.
- [ ] **V0.2** Run `cd GameCore && swift test 2>&1 | grep Executed | tail -1`. Expected: `Executed 27 tests, with 0 failures`.
- [ ] **V0.3** Commit the plan: `git add docs/superpowers/plans && git commit -m "docs: visual overhaul plan"`

---

### Task V1: Textures and materials

- [ ] **V1.1** Create `App/Textures.swift`:

```swift
import UIKit

/// All images are drawn in code at launch (no downloaded art). Each is made once and cached.
enum Tex {
    static func color(_ hex: UInt32, _ a: CGFloat = 1) -> UIColor {
        UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255, alpha: a)
    }

    private static func draw(_ w: Int, _ h: Int, _ body: (CGContext, CGSize) -> Void) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format).image { ctx in
            body(ctx.cgContext, CGSize(width: w, height: h))
        }
    }

    /// Fixed-seed noise so textures look the same every launch.
    private struct Noise {
        var s: UInt64
        mutating func next() -> CGFloat {
            s = s &* 6364136223846793005 &+ 1442695040888963407
            return CGFloat((s >> 33) % 10_000) / 10_000
        }
    }

    /// Sky: deep blue at the top, warm peach at the horizon, soft haze below. Used as an equirectangular background.
    static let sky: UIImage = draw(1024, 512) { c, size in
        let colors = [color(0x1D4ED8).cgColor, color(0x38BDF8).cgColor, color(0xBAE6FD).cgColor,
                      color(0xFDE68A).cgColor, color(0xFBCFE8).cgColor] as CFArray
        let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.3, 0.44, 0.5, 1])!
        c.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        // a few soft clouds above the horizon
        var n = Noise(s: 7)
        for _ in 0..<18 {
            let x = n.next() * size.width, y = 196 + n.next() * 44, r = 6 + n.next() * 10
            color(0xFFFFFF, 0.7).setFill()
            for k in 0..<5 {
                c.fillEllipse(in: CGRect(x: x + CGFloat(k) * r * 1.1, y: y - CGFloat(k % 2) * r * 0.4, width: r * 2.4, height: r * 0.9))
            }
        }
    }

    /// Track bed gravel: grey with lots of small stones.
    static let gravel: UIImage = draw(256, 256) { c, size in
        color(0x6B6F76).setFill(); c.fill(CGRect(origin: .zero, size: size))
        var n = Noise(s: 11)
        for _ in 0..<1800 {
            let v = 0.35 + n.next() * 0.45
            UIColor(white: v, alpha: 1).setFill()
            let r = 2 + n.next() * 5
            c.fillEllipse(in: CGRect(x: n.next() * size.width, y: n.next() * size.height, width: r, height: r * 0.8))
        }
    }

    /// Wooden sleeper: warm brown with grain lines.
    static let wood: UIImage = draw(256, 64) { c, size in
        color(0x7C4A21).setFill(); c.fill(CGRect(origin: .zero, size: size))
        var n = Noise(s: 3)
        for _ in 0..<40 {
            color(n.next() > 0.5 ? 0x5B3416 : 0x96612F, 0.7).setStroke()
            c.setLineWidth(1 + n.next() * 2)
            let y = n.next() * size.height
            c.move(to: CGPoint(x: 0, y: y))
            c.addCurve(to: CGPoint(x: size.width, y: y + (n.next() - 0.5) * 10),
                       control1: CGPoint(x: 80, y: y + 6), control2: CGPoint(x: 170, y: y - 6))
            c.strokePath()
        }
    }

    /// Building facade: wall colour with a grid of lit and unlit windows. One texture = 4 floors × 4 windows.
    static let buildingColors: [UInt32] = [0xF87171, 0xFBBF24, 0x34D399, 0x60A5FA, 0xA78BFA, 0xF472B6, 0xFB923C, 0x2DD4BF]
    /// One facade per building colour, made once (static lets are thread-safe; segments are built on the render thread).
    static let facades: [UIImage] = buildingColors.map(facade)

    private static func facade(_ wall: UInt32) -> UIImage {
        draw(256, 256) { c, size in
            color(wall).setFill(); c.fill(CGRect(origin: .zero, size: size))
            var n = Noise(s: UInt64(wall))
            for row in 0..<4 {
                // floor line
                color(0x000000, 0.12).setFill()
                c.fill(CGRect(x: 0, y: CGFloat(row) * 64 + 60, width: size.width, height: 4))
                for col in 0..<4 {
                    let r = CGRect(x: CGFloat(col) * 64 + 14, y: CGFloat(row) * 64 + 12, width: 36, height: 40)
                    color(0xFFFFFF, 0.85).setFill(); c.fill(r.insetBy(dx: -3, dy: -3))      // frame
                    color(n.next() > 0.7 ? 0xFDE68A : 0x1E3A5F).setFill(); c.fill(r)    // glass
                    color(0xFFFFFF, 0.25).setFill(); c.fill(CGRect(x: r.minX + 4, y: r.minY + 4, width: 8, height: r.height - 8))
                }
            }
        }
    }

    /// Diagonal warning stripes (two colours).
    static func stripes(_ a: UInt32, _ b: UInt32) -> UIImage {
        draw(256, 64) { c, size in
            color(a).setFill(); c.fill(CGRect(origin: .zero, size: size))
            color(b).setFill()
            var x: CGFloat = -64
            while x < size.width + 64 {
                c.move(to: CGPoint(x: x, y: size.height)); c.addLine(to: CGPoint(x: x + 32, y: size.height))
                c.addLine(to: CGPoint(x: x + 96, y: 0)); c.addLine(to: CGPoint(x: x + 64, y: 0)); c.closePath(); c.fillPath()
                x += 64
            }
        }
    }

    /// Train side: white body, blue window band, red stripe, grey skirt. Texture spans the whole 10 m side.
    static let trainSide: UIImage = draw(1024, 256) { c, size in
        color(0xF8FAFC).setFill(); c.fill(CGRect(origin: .zero, size: size))
        color(0x1E40AF).setFill(); c.fill(CGRect(x: 0, y: 52, width: size.width, height: 70))
        for i in 0..<9 {                                   // windows
            color(0x93C5FD).setFill()
            let r = CGRect(x: 30 + CGFloat(i) * 110, y: 60, width: 80, height: 54)
            c.addPath(UIBezierPath(roundedRect: r, cornerRadius: 10).cgPath); c.fillPath()
            color(0xFFFFFF, 0.5).setFill(); c.fill(CGRect(x: r.minX + 8, y: r.minY + 6, width: 14, height: r.height - 12))
        }
        color(0xEF4444).setFill(); c.fill(CGRect(x: 0, y: 140, width: size.width, height: 22))
        color(0xFACC15).setFill(); c.fill(CGRect(x: 0, y: 166, width: size.width, height: 6))
        for d in [300.0, 700.0] {                          // doors
            color(0x94A3B8).setStroke(); c.setLineWidth(5)
            c.stroke(CGRect(x: d, y: 40, width: 70, height: 170))
        }
        color(0x475569).setFill(); c.fill(CGRect(x: 0, y: 214, width: size.width, height: 42))
    }

    /// Train front: windscreen, destination sign, red stripe, headlight housings.
    static let trainFront: UIImage = draw(256, 384) { c, size in
        color(0xF8FAFC).setFill(); c.fill(CGRect(origin: .zero, size: size))
        color(0x0F172A).setFill()
        c.addPath(UIBezierPath(roundedRect: CGRect(x: 26, y: 60, width: 204, height: 120), cornerRadius: 22).cgPath); c.fillPath()
        color(0x60A5FA, 0.5).setFill(); c.fill(CGRect(x: 40, y: 72, width: 40, height: 96))
        color(0x111827).setFill(); c.fill(CGRect(x: 60, y: 20, width: 136, height: 30))
        color(0xF59E0B).setFill(); c.fill(CGRect(x: 72, y: 28, width: 112, height: 14))
        color(0xEF4444).setFill(); c.fill(CGRect(x: 0, y: 210, width: size.width, height: 30))
        color(0x1E40AF).setFill(); c.fill(CGRect(x: 0, y: 244, width: size.width, height: 10))
        color(0x334155).setFill()
        c.fillEllipse(in: CGRect(x: 30, y: 270, width: 56, height: 40)); c.fillEllipse(in: CGRect(x: 170, y: 270, width: 56, height: 40))
        color(0x475569).setFill(); c.fill(CGRect(x: 0, y: 330, width: size.width, height: 54))
    }

    /// Soft round dot for particles (white, alpha falloff). Not opaque.
    static let dot: UIImage = {
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
        return UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64), format: format).image { ctx in
            let colors = [UIColor.white.cgColor, UIColor.white.withAlphaComponent(0).cgColor] as CFArray
            let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
            ctx.cgContext.drawRadialGradient(g, startCenter: CGPoint(x: 32, y: 32), startRadius: 0,
                                             endCenter: CGPoint(x: 32, y: 32), endRadius: 32, options: [])
        }
    }()
}
```

- [ ] **V1.2** Create `App/Materials.swift`:

```swift
import SceneKit
import UIKit

/// Shared physically based materials. Sharing one material between many nodes keeps draw cost low.
enum Mat {
    static func pbr(_ hex: UInt32, rough: CGFloat = 0.6, metal: CGFloat = 0, emit: UInt32? = nil) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = Tex.color(hex)
        m.roughness.contents = rough
        m.metalness.contents = metal
        if let e = emit { m.emission.contents = Tex.color(e) }
        return m
    }

    static func textured(_ img: UIImage, rough: CGFloat = 0.8, repeatU: Float = 1, repeatV: Float = 1) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = img
        m.roughness.contents = rough
        m.metalness.contents = 0.0
        m.diffuse.wrapS = .repeat
        m.diffuse.wrapT = .repeat
        m.diffuse.contentsTransform = SCNMatrix4MakeScale(repeatU, repeatV, 1)
        m.diffuse.mipFilter = .linear
        return m
    }

    // Character
    static let skin = pbr(0xF2C29B, rough: 0.7)
    static let hoodie = pbr(0x14B8A6, rough: 0.8)
    static let pants = pbr(0x1E3A8A, rough: 0.85)
    static let cap = pbr(0xEF4444, rough: 0.6)
    static let shoe = pbr(0xF8FAFC, rough: 0.5)
    static let sole = pbr(0xF97316, rough: 0.6)
    static let backpack = pbr(0xF59E0B, rough: 0.7)
    static let eyeWhite = pbr(0xFFFFFF, rough: 0.2)
    static let pupil = pbr(0x111827, rough: 0.2)
    static let hair = pbr(0x5B3A1E, rough: 0.9)
    static let cheek = pbr(0xF9A8A8, rough: 0.8)

    // Track
    static let gravel = textured(Tex.gravel, rough: 0.95, repeatU: 4, repeatV: 8)
    static let wood = textured(Tex.wood, rough: 0.85)
    static let rail = pbr(0xCBD5E1, rough: 0.25, metal: 1)
    static let railBase = pbr(0x57534E, rough: 0.8, metal: 0.3)
    static let concrete = pbr(0xD6D3D1, rough: 0.9)
    static let curbStripe = pbr(0xFACC15, rough: 0.7)
    static let roof = pbr(0x475569, rough: 0.8)
    static let pole = pbr(0x334155, rough: 0.4, metal: 0.8)
    static let lamp = pbr(0xFFF7D6, rough: 0.3, emit: 0xFFE9A8)
    static let leaf = pbr(0x22C55E, rough: 0.9)
    static let grass = pbr(0x4ADE80, rough: 0.95)
    static let trunk = pbr(0x92400E, rough: 0.9)
    static let facades: [SCNMaterial] = Tex.facades.map { textured($0, rough: 0.85) }

    // Obstacles
    static let hurdleStripes = textured(Tex.stripes(0xEF4444, 0xFFFFFF), rough: 0.6, repeatU: 2)
    static let barStripes = textured(Tex.stripes(0xFACC15, 0x111827), rough: 0.6, repeatU: 2)
    static let darkMetal = pbr(0x1F2937, rough: 0.4, metal: 0.7)
    static let warning = pbr(0xEF4444, rough: 0.3, emit: 0xFF3B3B)
    static let trainSide = textured(Tex.trainSide, rough: 0.35)
    static let trainFront = textured(Tex.trainFront, rough: 0.35)
    static let trainRoof = pbr(0xCBD5E1, rough: 0.4, metal: 0.5)
    static let trainBottom = pbr(0x1F2937, rough: 0.8)
    static let headlight = pbr(0xFFFFFF, rough: 0.1, emit: 0xFFF3C4)
    static let wheel = pbr(0x111827, rough: 0.5, metal: 0.8)

    // Coins
    static let gold = pbr(0xFBBF24, rough: 0.2, metal: 1, emit: 0x5C3D00)
    static let goldDark = pbr(0xD97706, rough: 0.25, metal: 1, emit: 0x3A2600)
}

extension SCNNode {
    /// Box (or chamfered box) node with one material.
    static func box(_ w: CGFloat, _ h: CGFloat, _ l: CGFloat, _ m: SCNMaterial, chamfer: CGFloat = 0) -> SCNNode {
        let g = SCNBox(width: w, height: h, length: l, chamferRadius: chamfer)
        g.materials = [m]
        return SCNNode(geometry: g)
    }
    static func capsule(_ r: CGFloat, _ h: CGFloat, _ m: SCNMaterial) -> SCNNode {
        let g = SCNCapsule(capRadius: r, height: h); g.materials = [m]; return SCNNode(geometry: g)
    }
    static func sphere(_ r: CGFloat, _ m: SCNMaterial) -> SCNNode {
        let g = SCNSphere(radius: r); g.segmentCount = 24; g.materials = [m]; return SCNNode(geometry: g)
    }
    static func cylinder(_ r: CGFloat, _ h: CGFloat, _ m: SCNMaterial) -> SCNNode {
        let g = SCNCylinder(radius: r, height: h); g.radialSegmentCount = 32; g.materials = [m]; return SCNNode(geometry: g)
    }
    func at(_ x: Double, _ y: Double, _ z: Double) -> SCNNode { position = SCNVector3(x, y, z); return self }
}
```

- [ ] **V1.3** Build (Rule 4). Expected: `** BUILD SUCCEEDED **`.
- [ ] **V1.4** Commit: `git add -A && git commit -m "feat(art): generated textures and shared materials"`

---

### Task V2: The runner character

- [ ] **V2.1** Create `App/Character.swift`. The pose angles follow the sign guide in the class comment. Don't flip them.

```swift
import SceneKit
import GameCore

/// The runner: a small cartoon kid built from primitives, with joints posed every frame.
/// Faces -z (the running direction). Feet touch y = 0 when standing.
/// Rotation sign guide: a positive x-rotation swings a hanging limb forward (-z); knees bend with negative values.
final class RunnerFigure {
    let root = SCNNode()          // placed at the runner's world position
    private let spin = SCNNode()  // rotation centre for the roll, 0.55 m above the feet
    private let hips = SCNNode()
    private let torso = SCNNode()
    private let head = SCNNode()
    private let shoulderL = SCNNode(), shoulderR = SCNNode()
    private let elbowL = SCNNode(), elbowR = SCNNode()
    private let hipL = SCNNode(), hipR = SCNNode()
    private let kneeL = SCNNode(), kneeR = SCNNode()

    static let spinHeight = 0.55
    static let hipHeight = 0.88

    init() {
        root.addChildNode(spin)
        spin.position = SCNVector3(0, RunnerFigure.spinHeight, 0)
        spin.addChildNode(hips)
        hips.position = SCNVector3(0, RunnerFigure.hipHeight - RunnerFigure.spinHeight, 0)

        // Legs: hip → thigh → knee → shin → shoe
        for (hip, knee, x) in [(hipL, kneeL, -0.15), (hipR, kneeR, 0.15)] {
            hip.position = SCNVector3(x, -0.02, 0)
            hips.addChildNode(hip)
            hip.addChildNode(SCNNode.capsule(0.12, 0.46, Mat.pants).at(0, -0.2, 0))
            knee.position = SCNVector3(0, -0.4, 0)
            hip.addChildNode(knee)
            knee.addChildNode(SCNNode.capsule(0.105, 0.42, Mat.pants).at(0, -0.18, 0))
            knee.addChildNode(SCNNode.box(0.22, 0.12, 0.36, Mat.shoe, chamfer: 0.05).at(0, -0.4, -0.06))
            knee.addChildNode(SCNNode.box(0.23, 0.04, 0.37, Mat.sole, chamfer: 0.02).at(0, -0.46, -0.06))
        }

        // Torso (hoodie) with backpack on the back (+z)
        hips.addChildNode(torso)
        torso.addChildNode(SCNNode.box(0.62, 0.64, 0.4, Mat.hoodie, chamfer: 0.16).at(0, 0.32, 0))
        torso.addChildNode(SCNNode.box(0.5, 0.52, 0.22, Mat.backpack, chamfer: 0.09).at(0, 0.36, 0.28))
        torso.addChildNode(SCNNode.box(0.36, 0.14, 0.06, Mat.sole, chamfer: 0.03).at(0, 0.24, 0.4))     // pocket
        torso.addChildNode(SCNNode.capsule(0.05, 0.6, Mat.sole).at(-0.18, 0.4, 0.18))                // straps
        torso.addChildNode(SCNNode.capsule(0.05, 0.6, Mat.sole).at(0.18, 0.4, 0.18))

        // Head: face, hair, eyes, cap with brim pointing forward
        head.position = SCNVector3(0, 0.86, 0)
        torso.addChildNode(head)
        head.addChildNode(SCNNode.sphere(0.33, Mat.skin))
        let hair = SCNNode.sphere(0.345, Mat.hair); hair.scale = SCNVector3(1, 0.8, 1); hair.position = SCNVector3(0, 0.03, 0.04)
        head.addChildNode(hair)
        let capTop = SCNNode.sphere(0.355, Mat.cap); capTop.scale = SCNVector3(1, 0.62, 1); capTop.position = SCNVector3(0, 0.1, 0)
        head.addChildNode(capTop)
        let brim = SCNNode.cylinder(0.24, 0.04, Mat.cap); brim.scale = SCNVector3(1, 1, 0.75); brim.position = SCNVector3(0, 0.1, -0.3)
        head.addChildNode(brim)
        for x in [-0.12, 0.12] {
            head.addChildNode(SCNNode.sphere(0.085, Mat.eyeWhite).at(x, 0.05, -0.27))
            head.addChildNode(SCNNode.sphere(0.045, Mat.pupil).at(x, 0.05, -0.345))
            head.addChildNode(SCNNode.sphere(0.06, Mat.cheek).at(x * 1.7, -0.08, -0.25))            // rosy cheeks
        }
        head.addChildNode(SCNNode.sphere(0.05, Mat.skin).at(0, -0.04, -0.33))                       // nose
        let mouth = SCNNode.capsule(0.022, 0.14, Mat.pupil).at(0, -0.15, -0.3)                      // smile:
        mouth.eulerAngles.z = .pi / 2                                                                // a flat line…
        head.addChildNode(mouth)
        for x in [-0.075, 0.075] {                                                                   // …with corners turned up
            let corner = SCNNode.capsule(0.02, 0.07, Mat.pupil).at(x, -0.13, -0.295)
            corner.eulerAngles.z = Float(x > 0 ? 0.9 : -0.9)
            head.addChildNode(corner)
        }

        // Arms: shoulder → upper arm → elbow → forearm → hand
        for (shoulder, elbow, x) in [(shoulderL, elbowL, -0.42), (shoulderR, elbowR, 0.42)] {
            shoulder.position = SCNVector3(x, 0.56, 0)
            torso.addChildNode(shoulder)
            shoulder.addChildNode(SCNNode.capsule(0.095, 0.38, Mat.hoodie).at(0, -0.16, 0))
            elbow.position = SCNVector3(0, -0.33, 0)
            shoulder.addChildNode(elbow)
            elbow.addChildNode(SCNNode.capsule(0.085, 0.32, Mat.hoodie).at(0, -0.13, 0))
            elbow.addChildNode(SCNNode.sphere(0.1, Mat.skin).at(0, -0.32, 0))
        }
        root.enumerateHierarchy { n, _ in n.castsShadow = true }
    }

    /// Poses the figure for this frame. `time` is in seconds and only drives the idle/roll animation.
    func pose(_ s: RunnerState, time: Double) {
        root.position = SCNVector3(s.x, s.y, -s.z)
        // lean into lane changes
        root.eulerAngles.z = Float(max(-0.35, min(0.35, -(Track.laneX(s.lane) - s.x) * 0.18)))

        if s.crashed {
            spin.eulerAngles = SCNVector3(1.35, 0, 0.2)       // falls backwards
            spin.position.y = Float(RunnerFigure.spinHeight * 0.5)
            setLimbs(hip: (0.9, 0.4), knee: (-0.6, -0.9), shoulder: (2.6, 2.4), elbow: (0.3, 0.3), lean: 0)
            return
        }
        spin.position.y = Float(RunnerFigure.spinHeight)
        spin.eulerAngles.z = 0

        if s.isSliding {
            // roll: tuck into a ball and spin forward
            spin.eulerAngles.x = Float(-Double(s.slideTicks) * Runner.dt * 18)
            setLimbs(hip: (2.1, 2.1), knee: (-2.3, -2.3), shoulder: (1.6, 1.6), elbow: (1.6, 1.6), lean: -0.5)
            return
        }
        spin.eulerAngles.x = 0

        if !s.isGrounded {
            // jump: knees tucked, arms thrown up
            let up = s.vy > 0
            setLimbs(hip: (up ? 1.3 : 0.7, up ? 0.5 : 0.9), knee: (-1.6, -1.2),
                     shoulder: (up ? 2.7 : 2.0, up ? 2.4 : 2.2), elbow: (0.4, 0.4), lean: -0.1)
            return
        }

        // run cycle: one stride every 2.6 m
        let p = s.z / 2.6 * 2 * .pi
        let swing = sin(p)
        hips.position.y = Float(RunnerFigure.hipHeight - RunnerFigure.spinHeight + abs(cos(p)) * 0.07)
        setLimbs(hip: (0.9 * swing, -0.9 * swing),
                 knee: (-0.2 - 1.1 * max(0, -cos(p)), -0.2 - 1.1 * max(0, cos(p))),
                 shoulder: (-0.8 * swing, 0.8 * swing),
                 elbow: (1.3, 1.3), lean: -0.18)
    }

    /// Idle/cheer pose for the menu: bouncy run in place.
    func menuPose(time: Double) {
        var s = RunnerState.start
        s.z = time * 6
        pose(s, time: time)
        root.position = SCNVector3(0, 0, 0)
    }

    private func setLimbs(hip: (Double, Double), knee: (Double, Double), shoulder: (Double, Double),
                          elbow: (Double, Double), lean: Double) {
        hipL.eulerAngles.x = Float(hip.0); hipR.eulerAngles.x = Float(hip.1)
        kneeL.eulerAngles.x = Float(knee.0); kneeR.eulerAngles.x = Float(knee.1)
        shoulderL.eulerAngles.x = Float(shoulder.0); shoulderR.eulerAngles.x = Float(shoulder.1)
        elbowL.eulerAngles.x = Float(elbow.0); elbowR.eulerAngles.x = Float(elbow.1)
        torso.eulerAngles.x = Float(lean)
    }
}
```

- [ ] **V2.2** Build. Expected: `** BUILD SUCCEEDED **`.
- [ ] **V2.3** Commit: `git add -A && git commit -m "feat(art): jointed runner character with run, jump, roll, crash poses"`

---

### Task V3: World builders and particle effects

- [ ] **V3.1** Create `App/World.swift`:

```swift
import SceneKit
import GameCore

/// Builds the look of the world. Pure visuals: never reads or changes game rules.
/// World → scene mapping: scene position = (x, y, -z).
enum World {
    static let segmentLength = 18.0

    /// Sky, image-based lighting, sun with shadows, fill light, fog.
    static func setupEnvironment(_ scene: SCNScene) {
        scene.background.contents = Tex.sky
        scene.lightingEnvironment.contents = Tex.sky
        scene.lightingEnvironment.intensity = 1.3
        scene.fogStartDistance = 45
        scene.fogEndDistance = 115
        scene.fogDensityExponent = 1.3
        scene.fogColor = Tex.color(0xE9EEF0)

        let sun = SCNNode()
        let light = SCNLight()
        light.type = .directional
        light.intensity = 1600
        light.color = Tex.color(0xFFF1D6)
        light.castsShadow = true
        light.shadowMapSize = CGSize(width: 2048, height: 2048)
        light.shadowSampleCount = 8
        light.shadowRadius = 2
        light.shadowColor = UIColor(white: 0, alpha: 0.45)
        light.automaticallyAdjustsShadowProjection = true
        light.maximumShadowDistance = 45
        sun.light = light
        sun.eulerAngles = SCNVector3(-0.95, 0.55, 0)
        scene.rootNode.addChildNode(sun)

        let fill = SCNNode()
        fill.light = SCNLight()
        fill.light!.type = .ambient
        fill.light!.intensity = 220
        fill.light!.color = Tex.color(0xBFDBFE)
        scene.rootNode.addChildNode(fill)
    }

    /// Camera with HDR bloom and a soft vignette.
    static func makeCamera() -> SCNNode {
        let cam = SCNCamera()
        cam.fieldOfView = 68
        cam.zNear = 0.1
        cam.zFar = 160
        cam.wantsHDR = true
        cam.wantsExposureAdaptation = false
        cam.exposureOffset = 0
        cam.bloomIntensity = 0.45
        cam.bloomThreshold = 0.85
        cam.bloomBlurRadius = 10
        cam.vignettingIntensity = 0.35
        cam.vignettingPower = 1.2
        cam.saturation = 1.12
        let node = SCNNode()
        node.camera = cam
        return node
    }

    /// One 18 m piece of track and city: gravel bed, sleepers, rails, curbs, buildings, lamps, trees.
    /// Same `k` always gives the same piece (seeded by k).
    static func segment(_ k: Int) -> SCNNode {
        let len = segmentLength
        var rng = SplitMix64(seed: UInt64(bitPattern: Int64(k)) &+ 1000)
        let node = SCNNode()

        node.addChildNode(SCNNode.box(8.6, 0.3, len, Mat.gravel).at(0, -0.15, -len / 2))
        for lane in 0..<3 {
            let x = Track.laneX(lane)
            var z = 0.6
            while z < len {
                node.addChildNode(SCNNode.box(2.3, 0.1, 0.3, Mat.wood).at(x, 0.03, -z))
                z += 1.2
            }
            for side in [-0.72, 0.72] {
                node.addChildNode(SCNNode.box(0.18, 0.06, len, Mat.railBase).at(x + side, 0.11, -len / 2))
                node.addChildNode(SCNNode.box(0.1, 0.1, len, Mat.rail).at(x + side, 0.19, -len / 2))
            }
        }
        for side in [-1.0, 1.0] {
            node.addChildNode(SCNNode.box(1.4, 0.6, len, Mat.concrete).at(side * 5.0, 0.3, -len / 2))
            node.addChildNode(SCNNode.box(0.18, 0.02, len, Mat.curbStripe).at(side * 4.42, 0.61, -len / 2))

            // two 9 m lots per side: a building, or (1 in 4) a little park
            for lot in 0..<2 {
                let zc = -(Double(lot) * 9 + 4.5)
                if rng.int(4) == 0 {
                    node.addChildNode(SCNNode.box(7, 0.5, 9, Mat.grass).at(side * 9.2, 0.25, zc))
                    for t in 0..<2 {
                        let tz = zc + (t == 0 ? -2.2 : 2.2)
                        node.addChildNode(SCNNode.cylinder(0.18, 1.6, Mat.trunk).at(side * 7.4, 1.3, tz))
                        node.addChildNode(SCNNode.sphere(1.25, Mat.leaf).at(side * 7.4, 2.9, tz))
                        node.addChildNode(SCNNode.sphere(0.9, Mat.leaf).at(side * 7.4 + 0.5, 3.7, tz + 0.3))
                    }
                } else {
                    let h = 6.0 + Double(rng.int(9))                        // 6…14 m
                    let m = Mat.facades[rng.int(Mat.facades.count)].copy() as! SCNMaterial
                    m.diffuse.contentsTransform = SCNMatrix4MakeScale(1, Float(h / 6), 1)
                    let b = SCNNode(geometry: SCNBox(width: 7, height: h, length: 8.6, chamferRadius: 0))
                    b.geometry!.materials = [m]
                    node.addChildNode(b.at(side * 9.6, h / 2, zc))
                    node.addChildNode(SCNNode.box(7.4, 0.5, 9.0, Mat.roof).at(side * 9.6, h + 0.25, zc))
                    if rng.int(2) == 0 {                                    // rooftop water tank
                        node.addChildNode(SCNNode.cylinder(0.9, 1.6, Mat.roof).at(side * 10.5, h + 1.3, zc + 2))
                    }
                }
            }
            if k % 2 == 0 {                                                   // street lamp
                node.addChildNode(SCNNode.cylinder(0.08, 4.4, Mat.pole).at(side * 4.9, 2.2, -9))
                node.addChildNode(SCNNode.box(0.9, 0.08, 0.12, Mat.pole).at(side * 4.5, 4.4, -9))
                node.addChildNode(SCNNode.box(0.5, 0.12, 0.3, Mat.lamp).at(side * 4.15, 4.32, -9))
            }
        }
        if k % 3 == 0 {                                                       // overhead wire gantry
            for side in [-1.0, 1.0] { node.addChildNode(SCNNode.box(0.25, 7.5, 0.25, Mat.pole).at(side * 4.6, 3.75, -2)) }
            node.addChildNode(SCNNode.box(9.5, 0.2, 0.2, Mat.pole).at(0, 7.5, -2))
        }
        let flat = node.flattenedClone()
        flat.castsShadow = false
        flat.position = SCNVector3(0, 0, -Double(k) * len)
        return flat
    }

    static func obstacle(_ o: Obstacle) -> SCNNode {
        let x = Track.laneX(o.lane)
        let node = SCNNode()
        switch o.kind {
        case .hurdle:
            for side in [-0.92, 0.92] {
                node.addChildNode(SCNNode.box(0.09, 1.0, 0.09, Mat.darkMetal).at(side, 0.5, 0))
                node.addChildNode(SCNNode.box(0.14, 0.06, 0.5, Mat.darkMetal).at(side, 0.03, 0))
            }
            node.addChildNode(SCNNode.box(2.0, 0.42, 0.08, Mat.hurdleStripes, chamfer: 0.03).at(0, 0.76, 0))
            node.addChildNode(SCNNode.box(2.0, 0.18, 0.06, Mat.hurdleStripes, chamfer: 0.02).at(0, 0.34, 0))
            node.addChildNode(SCNNode.sphere(0.07, Mat.warning).at(-0.92, 1.04, 0))
            node.addChildNode(SCNNode.sphere(0.07, Mat.warning).at(0.92, 1.04, 0))
            node.position = SCNVector3(x, 0, -(o.z + 0.25))
        case .bar:
            for side in [-1.12, 1.12] {
                node.addChildNode(SCNNode.box(0.16, 2.3, 0.16, Mat.darkMetal).at(side, 1.15, 0))
            }
            node.addChildNode(SCNNode.box(2.4, 0.95, 0.22, Mat.barStripes, chamfer: 0.05).at(0, 1.7, 0))
            for lx in [-0.7, 0.0, 0.7] { node.addChildNode(SCNNode.sphere(0.09, Mat.warning).at(lx, 2.25, 0)) }
            node.position = SCNVector3(x, 0, -(o.z + 0.25))
        case .train:
            let L = Track.trainLength
            let body = SCNBox(width: 2.3, height: 3.0, length: L, chamferRadius: 0.22)
            body.materials = [Mat.trainFront, Mat.trainSide, Mat.trainFront, Mat.trainSide, Mat.trainRoof, Mat.trainBottom]
            node.addChildNode(SCNNode(geometry: body).at(0, 1.95, 0))
            node.addChildNode(SCNNode.box(1.2, 0.25, 3.2, Mat.trainRoof, chamfer: 0.08).at(0, 3.55, 0))
            for bz in [-3.2, 3.2] {
                node.addChildNode(SCNNode.box(1.9, 0.35, 2.4, Mat.trainBottom).at(0, 0.3, bz))
                for wz in [-0.7, 0.7] {
                    for wx in [-0.86, 0.86] {
                        let w = SCNNode.cylinder(0.27, 0.12, Mat.wheel).at(wx, 0.27, bz + wz)
                        w.eulerAngles.z = .pi / 2
                        node.addChildNode(w)
                    }
                }
            }
            for hx in [-0.72, 0.72] { node.addChildNode(SCNNode.sphere(0.13, Mat.headlight).at(hx, 1.05, L / 2 + 0.02)) }
            node.position = SCNVector3(x, 0, -(o.z + L / 2))
        }
        let flat = node.flattenedClone()
        flat.position = node.position
        flat.castsShadow = true
        return flat
    }

    static func coin(_ c: Coin) -> SCNNode {
        let face = SCNNode.cylinder(0.38, 0.09, Mat.gold)
        face.addChildNode(SCNNode.cylinder(0.26, 0.12, Mat.goldDark))
        face.eulerAngles.x = .pi / 2
        let node = SCNNode()
        node.addChildNode(face)
        node.position = SCNVector3(Track.laneX(c.lane), Track.coinY, -c.z)
        node.eulerAngles.y = Float(c.id % 8) * 0.4      // stagger the spin so coins don't all turn edge-on together
        node.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 1.2)))
        node.castsShadow = true
        return node
    }
}
```

- [ ] **V3.2** Create `App/Effects.swift`:

```swift
import SceneKit
import UIKit

/// Particle effects built in code (no .scnp files).
enum FX {
    private static func fade(_ from: CGFloat) -> SCNParticlePropertyController {
        let a = CAKeyframeAnimation()
        a.values = [from, 0]
        return SCNParticlePropertyController(animation: a)
    }

    /// Dust puffs kicked up behind the runner's feet. Turn on/off with `birthRate`.
    static func dust() -> SCNParticleSystem {
        let p = SCNParticleSystem()
        p.particleImage = Tex.dot
        p.birthRate = 0
        p.particleLifeSpan = 0.45
        p.particleSize = 0.22
        p.particleSizeVariation = 0.1
        p.particleColor = Tex.color(0xD6CFC4)
        p.particleVelocity = 1.4
        p.particleVelocityVariation = 0.6
        p.emittingDirection = SCNVector3(0, 1, 1)
        p.spreadingAngle = 35
        p.blendMode = .alpha
        p.isLightingEnabled = false
        p.propertyControllers = [.opacity: fade(0.55)]
        return p
    }

    /// Gold sparkle burst for a collected coin.
    static func sparkle() -> SCNParticleSystem {
        let p = SCNParticleSystem()
        p.particleImage = Tex.dot
        p.loops = false
        p.emissionDuration = 0.05
        p.birthRate = 400
        p.particleLifeSpan = 0.35
        p.particleSize = 0.14
        p.particleColor = Tex.color(0xFDE047)
        p.particleVelocity = 3.5
        p.spreadingAngle = 180
        p.blendMode = .additive
        p.isLightingEnabled = false
        p.propertyControllers = [.opacity: fade(1)]
        return p
    }

    /// Big burst of stars when the runner crashes.
    static func crash() -> SCNParticleSystem {
        let p = SCNParticleSystem()
        p.particleImage = Tex.dot
        p.loops = false
        p.emissionDuration = 0.08
        p.birthRate = 900
        p.particleLifeSpan = 0.7
        p.particleSize = 0.25
        p.particleSizeVariation = 0.15
        p.particleColor = Tex.color(0xFFFFFF)
        p.particleColorVariation = SCNVector4(0.15, 0.6, 0.2, 0)
        p.particleVelocity = 5
        p.particleVelocityVariation = 2
        p.spreadingAngle = 180
        p.acceleration = SCNVector3(0, -6, 0)
        p.blendMode = .additive
        p.isLightingEnabled = false
        p.propertyControllers = [.opacity: fade(1)]
        return p
    }
}
```

- [ ] **V3.3** Build. Expected: `** BUILD SUCCEEDED **`.
- [ ] **V3.4** Commit: `git add -A && git commit -m "feat(art): city, track, obstacles, coins and particle effects"`

---

### Task V4: New game scene, HUD and crash panel

- [ ] **V4.1** Replace the whole of `App/ColorHex.swift`:

```swift
import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// Chunky, toy-like button: gradient face, darker "base" under it that the face presses into.
struct ChunkyButtonStyle: ButtonStyle {
    let top: UInt32
    let bottom: UInt32
    let base: UInt32
    var width: CGFloat = 240
    var height: CGFloat = 76

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        return ZStack {
            RoundedRectangle(cornerRadius: 26).fill(Color(hex: base))
                .frame(width: width, height: height)
                .offset(y: 7)
            configuration.label
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.25), radius: 0, x: 0, y: 2)
                .frame(width: width, height: height)
                .background(
                    LinearGradient(colors: [Color(hex: top), Color(hex: bottom)], startPoint: .top, endPoint: .bottom),
                    in: RoundedRectangle(cornerRadius: 26))
                .overlay(RoundedRectangle(cornerRadius: 26).stroke(.white.opacity(0.85), lineWidth: 3))
                .offset(y: pressed ? 6 : 0)
        }
        .frame(width: width, height: height + 8)
        .animation(.spring(response: 0.18, dampingFraction: 0.6), value: pressed)
    }
}

/// Gold coin icon drawn with SwiftUI shapes.
struct CoinIcon: View {
    var size: CGFloat = 26
    var body: some View {
        ZStack {
            Circle().fill(LinearGradient(colors: [Color(hex: 0xFDE047), Color(hex: 0xF59E0B)], startPoint: .top, endPoint: .bottom))
            Circle().stroke(Color(hex: 0xB45309), lineWidth: size * 0.1)
            Circle().fill(Color(hex: 0xFBBF24)).frame(width: size * 0.5, height: size * 0.5)
                .overlay(Circle().stroke(Color(hex: 0xD97706), lineWidth: size * 0.06))
        }
        .frame(width: size, height: size)
    }
}

/// Big outlined title text (white fill, dark outline, orange drop).
struct OutlinedTitle: View {
    let text: String
    var size: CGFloat = 72
    var body: some View {
        let font = Font.system(size: size, weight: .black, design: .rounded)
        ZStack {
            Text(text).font(font).foregroundStyle(Color(hex: 0xEA580C)).offset(y: size * 0.09)
            ForEach(0..<8, id: \.self) { i in
                let a = Double(i) / 8 * 2 * .pi
                Text(text).font(font).foregroundStyle(Color(hex: 0x1E1B4B))
                    .offset(x: cos(a) * size * 0.05, y: sin(a) * size * 0.05)
            }
            Text(text).font(font)
                .foregroundStyle(LinearGradient(colors: [.white, Color(hex: 0xFEF08A)], startPoint: .top, endPoint: .bottom))
        }
    }
}
```

- [ ] **V4.2** Replace the whole of `App/GameController.swift`:

```swift
import SceneKit
import UIKit
import GameCore

/// Owns the 3D scene and the run. SceneKit calls `renderer(_:updateAtTime:)` on its render
/// thread; that is the only place `session` and scene nodes are changed.
/// World → scene mapping: scene position = (x, y, -z). The runner runs toward -z.
final class GameController: NSObject, SCNSceneRendererDelegate {
    let scene = SCNScene()
    let cameraNode = SCNNode()
    private let model: GameModel
    private let autoplay: Bool
    private let idle: Bool
    private let store = ScoreStore()
    private var session: RunSession

    private let lock = NSLock()
    private var pendingMoves: [Move] = []        // guarded by lock (written on main thread)

    private var lastTime: TimeInterval?
    private var accumulator = 0.0
    private var reportedScore = -1
    private var reportedCoins = -1
    private var crashHandled = false
    private var lastJumpTick = -100

    private let figure = RunnerFigure()
    private let dust = FX.dust()
    private let dustNode = SCNNode()
    private var crashFXDone = false
    private var obstacleNodes: [Int: SCNNode] = [:]
    private var coinNodes: [Int: SCNNode] = [:]
    private var segmentNodes: [Int: SCNNode] = [:]

    static let viewAhead = 115.0

    init(model: GameModel, autoplay: Bool, idle: Bool, seed: UInt64) {
        self.model = model
        self.autoplay = autoplay
        self.idle = idle
        session = RunSession(seed: seed)
        super.init()
        buildScene()
        AudioManager.shared.playMusic("run")
    }

    // MARK: Input (main thread)

    @objc func swiped(_ g: UISwipeGestureRecognizer) {
        guard !autoplay else { return }
        let move: Move
        switch g.direction {
        case .left: move = .left
        case .right: move = .right
        case .up: move = .up
        default: move = .down
        }
        lock.lock(); pendingMoves.append(move); lock.unlock()
    }

    // MARK: Loop (render thread)

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        guard let last = lastTime else { lastTime = time; syncNodes(); return }
        lastTime = time
        if session.state.crashed { syncNodes(); return }
        accumulator += min(time - last, 0.25)
        var ticks = 0
        while accumulator >= Runner.dt && ticks < 8 {
            accumulator -= Runner.dt
            ticks += 1
            session.tick(nextMove())
            if session.state.crashed { break }
        }
        if ticks == 8 { accumulator = 0 }
        syncNodes()
        report()
    }

    private func nextMove() -> Move {
        if autoplay { return idle ? .none : Autopilot.move(session.state, track: session.track) }
        lock.lock(); defer { lock.unlock() }
        return pendingMoves.isEmpty ? .none : pendingMoves.removeFirst()
    }

    private func report() {
        let s = session.state
        // AudioManager is not thread-safe: only call it on the main thread.
        if s.vy > 0 && s.tick - lastJumpTick > 30 {
            lastJumpTick = s.tick
            DispatchQueue.main.async { AudioManager.shared.playSFX("sfx_jump") }
        }
        if s.coins != reportedCoins && reportedCoins >= 0 {
            DispatchQueue.main.async { AudioManager.shared.playSFX("sfx_coin") }
        }
        if s.score != reportedScore || s.coins != reportedCoins {
            reportedScore = s.score; reportedCoins = s.coins
            let score = s.score, coins = s.coins
            DispatchQueue.main.async { self.model.score = score; self.model.coins = coins }
        }
        if s.crashed && !crashHandled {
            crashHandled = true
            let score = s.score
            DispatchQueue.main.async {
                let newBest = self.store.record(score)
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                AudioManager.shared.stopMusic()
                AudioManager.shared.playSFX("sfx_crash")
                self.model.isNewBest = newBest
                self.model.isOver = true
            }
        }
    }

    // MARK: Scene

    private func buildScene() {
        World.setupEnvironment(scene)
        let cam = World.makeCamera()
        cameraNode.camera = cam.camera
        cameraNode.eulerAngles.x = -0.2
        scene.rootNode.addChildNode(cameraNode)

        scene.rootNode.addChildNode(figure.root)
        dustNode.position = SCNVector3(0, 0.05, 0.25)
        dustNode.addParticleSystem(dust)
        figure.root.addChildNode(dustNode)
    }

    /// Makes scene nodes match `session`: adds new things, removes passed or collected ones.
    private func syncNodes() {
        let s = session.state, track = session.track
        let len = World.segmentLength
        let firstSeg = max(-1, Int((s.z - 10) / len) - 1)
        let lastSeg = Int((s.z + GameController.viewAhead) / len)
        for k in firstSeg...lastSeg where segmentNodes[k] == nil {
            let n = World.segment(k); segmentNodes[k] = n; scene.rootNode.addChildNode(n)
        }
        for (k, n) in segmentNodes where k < firstSeg { n.removeFromParentNode(); segmentNodes[k] = nil }

        var live = Set<Int>()
        for o in track.obstacles where o.z < s.z + GameController.viewAhead {
            live.insert(o.id)
            if obstacleNodes[o.id] == nil { let n = World.obstacle(o); obstacleNodes[o.id] = n; scene.rootNode.addChildNode(n) }
        }
        for (id, n) in obstacleNodes where !live.contains(id) { n.removeFromParentNode(); obstacleNodes[id] = nil }

        live.removeAll()
        for c in track.coins where c.z < s.z + GameController.viewAhead && !s.collected.contains(c.id) {
            live.insert(c.id)
            if coinNodes[c.id] == nil { let n = World.coin(c); coinNodes[c.id] = n; scene.rootNode.addChildNode(n) }
        }
        for (id, n) in coinNodes where !live.contains(id) {
            coinNodes[id] = nil
            if s.collected.contains(id) {
                // collected: pop up, grow, fade, sparkle
                scene.addParticleSystem(FX.sparkle(), transform: SCNMatrix4MakeTranslation(n.position.x, n.position.y, n.position.z))
                n.runAction(.sequence([.group([.moveBy(x: 0, y: 0.9, z: -1.5, duration: 0.18),
                                               .scale(to: 1.7, duration: 0.18), .fadeOut(duration: 0.18)]),
                                       .removeFromParentNode()]))
            } else {
                n.removeFromParentNode()
            }
        }

        figure.pose(s, time: Double(s.tick) * Runner.dt)
        dust.birthRate = (s.isGrounded && !s.crashed) ? 45 : 0
        cameraNode.camera?.fieldOfView = CGFloat(66 + (s.speed - Runner.startSpeed) * 1.0)    // 66° → 76° as it speeds up
        cameraNode.position = SCNVector3(s.x * 0.6, 4.0, -s.z + 7.2)

        if s.crashed && !crashFXDone {
            crashFXDone = true
            scene.addParticleSystem(FX.crash(), transform: SCNMatrix4MakeTranslation(Float(s.x), Float(s.y) + 1, Float(-s.z) - 0.5))
            let shake = SCNAction.sequence((0..<8).map { i in
                let d: CGFloat = (i % 2 == 0 ? 1 : -1) * CGFloat(0.22 - Double(i) * 0.025)
                return SCNAction.moveBy(x: d, y: -d * 0.6, z: 0, duration: 0.035)
            })
            cameraNode.runAction(shake)
        }
    }
}
```

- [ ] **V4.3** Replace the whole of `App/GameView.swift`:

```swift
import SwiftUI
import SceneKit
import GameCore

/// Values the HUD shows. Written on the main thread only.
final class GameModel: ObservableObject {
    @Published var score = 0
    @Published var coins = 0
    @Published var isOver = false
    @Published var isNewBest = false
}

struct GameView: View {
    let autoplay: Bool
    let idle: Bool
    let seed: UInt64
    let onRestart: () -> Void
    let onExit: () -> Void
    @StateObject private var model = GameModel()

    @State private var panelIn = false

    var body: some View {
        ZStack {
            GameSceneView(model: model, autoplay: autoplay, idle: idle, seed: seed)
                .ignoresSafeArea()
            VStack {
                HStack(alignment: .top) {
                    Button(action: onExit) {
                        Image(systemName: "xmark")
                            .font(.system(size: 24, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(width: 58, height: 58)
                            .background(.ultraThinMaterial, in: Circle())
                            .overlay(Circle().stroke(.white.opacity(0.6), lineWidth: 2))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 8) {
                        HStack(spacing: 8) {
                            Text("SCORE")
                                .font(.system(size: 14, weight: .heavy, design: .rounded))
                                .foregroundStyle(.white.opacity(0.8))
                            Text("\(model.score)")
                                .font(.system(size: 34, weight: .black, design: .rounded))
                                .foregroundStyle(.white)
                                .monospacedDigit()
                                .contentTransition(.numericText())
                        }
                        .padding(.horizontal, 18).frame(height: 54)
                        .background(Color(hex: 0x1E1B4B).opacity(0.55), in: Capsule())
                        .overlay(Capsule().stroke(.white.opacity(0.5), lineWidth: 2))
                        HStack(spacing: 8) {
                            CoinIcon(size: 28)
                            Text("\(model.coins)")
                                .font(.system(size: 28, weight: .black, design: .rounded))
                                .foregroundStyle(Color(hex: 0xFDE047))
                                .monospacedDigit()
                        }
                        .padding(.horizontal, 14).frame(height: 46)
                        .background(Color(hex: 0x1E1B4B).opacity(0.55), in: Capsule())
                        .overlay(Capsule().stroke(Color(hex: 0xFDE047).opacity(0.6), lineWidth: 2))
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 60)
                Spacer()
            }
            if model.isOver {
                Color.black.opacity(0.35).ignoresSafeArea()
                gameOver
                    .scaleEffect(panelIn ? 1 : 0.6)
                    .opacity(panelIn ? 1 : 0)
                    .onAppear { withAnimation(.spring(response: 0.45, dampingFraction: 0.62)) { panelIn = true } }
            }
        }
    }

    private var gameOver: some View {
        VStack(spacing: 18) {
            OutlinedTitle(text: "Crash!", size: 60)
            VStack(spacing: 10) {
                statRow(label: "SCORE", value: "\(model.score)", color: 0xFFFFFF)
                HStack(spacing: 10) {
                    CoinIcon(size: 30)
                    Text("\(model.coins)")
                        .font(.system(size: 30, weight: .black, design: .rounded))
                        .foregroundStyle(Color(hex: 0xFDE047))
                }
                if model.isNewBest {
                    Label("New best!", systemImage: "trophy.fill")
                        .font(.system(size: 24, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color(hex: 0x1E1B4B))
                        .padding(.horizontal, 18).padding(.vertical, 8)
                        .background(Color(hex: 0xFDE047), in: Capsule())
                }
            }
            .padding(.vertical, 6)
            Button(action: onRestart) { Label("Play Again", systemImage: "arrow.clockwise") }
                .buttonStyle(ChunkyButtonStyle(top: 0xFB923C, bottom: 0xEA580C, base: 0x9A3412))
            Button(action: onExit) { Label("Menu", systemImage: "house.fill") }
                .buttonStyle(ChunkyButtonStyle(top: 0x38BDF8, bottom: 0x0284C7, base: 0x075985, height: 64))
        }
        .padding(.horizontal, 30).padding(.vertical, 32)
        .background(
            LinearGradient(colors: [Color(hex: 0x6366F1), Color(hex: 0x312E81)], startPoint: .top, endPoint: .bottom),
            in: RoundedRectangle(cornerRadius: 36))
        .overlay(RoundedRectangle(cornerRadius: 36).stroke(.white.opacity(0.8), lineWidth: 4))
        .shadow(color: .black.opacity(0.35), radius: 20, y: 10)
    }

    private func statRow(label: String, value: String, color: UInt32) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(.white.opacity(0.75))
            Text(value)
                .font(.system(size: 44, weight: .black, design: .rounded))
                .foregroundStyle(Color(hex: color))
        }
    }
}

/// Hosts the SCNView and turns swipes into moves.
struct GameSceneView: UIViewRepresentable {
    let model: GameModel
    let autoplay: Bool
    let idle: Bool
    let seed: UInt64

    func makeCoordinator() -> GameController {
        GameController(model: model, autoplay: autoplay, idle: idle,
                       seed: seed != 0 ? seed : UInt64.random(in: 1...UInt64(UInt32.max)))
    }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = context.coordinator.scene
        view.pointOfView = context.coordinator.cameraNode
        view.delegate = context.coordinator
        view.isPlaying = true
        view.rendersContinuously = true
        view.preferredFramesPerSecond = 60
        view.antialiasingMode = .multisampling4X
        view.backgroundColor = UIColor(red: 0.53, green: 0.81, blue: 0.98, alpha: 1)
        for dir: UISwipeGestureRecognizer.Direction in [.left, .right, .up, .down] {
            let swipe = UISwipeGestureRecognizer(target: context.coordinator, action: #selector(GameController.swiped(_:)))
            swipe.direction = dir
            view.addGestureRecognizer(swipe)
        }
        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {}
}
```

- [ ] **V4.4** Build. Expected: `** BUILD SUCCEEDED **`.
- [ ] **V4.5 Check on the iPhone simulator:**

```bash
SIM=$(xcrun simctl list devices available | grep "iPhone 18 Pro Max" | head -1 | grep -oE '[0-9A-F-]{36}')
xcrun simctl boot $SIM; xcrun simctl bootstatus $SIM -b
mkdir -p build/shots
xcrun simctl install $SIM build/Build/Products/Debug-iphonesimulator/SubwayRunner.app
xcrun simctl launch --terminate-running-process $SIM com.cagdasatici.subwayrunner -autoplay YES -seed 1
sleep 13; xcrun simctl io $SIM screenshot build/shots/v_run.png
xcrun simctl launch --terminate-running-process $SIM com.cagdasatici.subwayrunner -autoplay YES -idle YES -seed 2
sleep 6; xcrun simctl io $SIM screenshot build/shots/v_crash.png
```

Look at `build/shots/v_run.png`. Expected:
- a gradient sky with small clouds
- colourful buildings with window grids on both sides
- grey gravel track with brown sleepers and shiny rails
- the kid seen from behind (orange backpack, teal hoodie, red cap, navy legs) in the lower middle
- striped barriers and/or white trains and gold coins ahead
- a "SCORE" capsule top-right with a number > 150, a coin capsule below it, and a frosted ✕ top-left

Look at `build/shots/v_crash.png`. Expected: an indigo card with an outlined **"Crash!"**, **SCORE 39**, coin icon 0, a chunky orange "Play Again" and a blue "Menu". If the score isn't 39, gameplay changed: compare `GameController.swift` with V4.2.

- [ ] **V4.6** Commit: `git add -A && git commit -m "feat(art): new game scene, HUD and crash panel"`

---

### Task V5: 3D menu

- [ ] **V5.1** Replace the whole of `App/MenuView.swift`:

```swift
import SwiftUI
import SceneKit
import GameCore

struct MenuView: View {
    let onPlay: () -> Void
    @State private var best = 0
    @State private var muted = AudioManager.shared.isMuted
    @State private var pulse = false

    var body: some View {
        ZStack {
            MenuBackdrop().ignoresSafeArea()
            LinearGradient(colors: [Color(hex: 0x1E1B4B).opacity(0.55), .clear, .clear, Color(hex: 0x1E1B4B).opacity(0.65)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            VStack(spacing: 18) {
                Spacer().frame(height: 90)
                VStack(spacing: -14) {
                    OutlinedTitle(text: "SUBWAY", size: 68)
                    OutlinedTitle(text: "RUNNER", size: 68)
                }
                .rotationEffect(.degrees(-4))
                HStack(spacing: 8) {
                    Image(systemName: "trophy.fill").foregroundStyle(Color(hex: 0xFDE047))
                    Text("Best \(best)")
                        .foregroundStyle(.white)
                }
                .font(.system(size: 24, weight: .heavy, design: .rounded))
                .padding(.horizontal, 20).frame(height: 48)
                .background(Color(hex: 0x1E1B4B).opacity(0.6), in: Capsule())
                .overlay(Capsule().stroke(.white.opacity(0.5), lineWidth: 2))
                Spacer()
                Button(action: onPlay) { Label("PLAY", systemImage: "play.fill") }
                    .buttonStyle(ChunkyButtonStyle(top: 0x4ADE80, bottom: 0x16A34A, base: 0x14532D, width: 260, height: 92))
                    .scaleEffect(pulse ? 1.06 : 1)
                    .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: pulse)
                HStack(spacing: 14) {
                    hint("arrow.left.and.right", "Lanes")
                    hint("arrow.up", "Jump")
                    hint("arrow.down", "Roll")
                }
                .padding(.bottom, 50)
            }
            VStack {
                HStack {
                    Spacer()
                    Button {
                        muted.toggle()
                        AudioManager.shared.isMuted = muted
                        if !muted { AudioManager.shared.playMusic("menu") }
                    } label: {
                        Image(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 56, height: 56)
                            .background(.ultraThinMaterial, in: Circle())
                            .overlay(Circle().stroke(.white.opacity(0.6), lineWidth: 2))
                    }
                    .padding(.trailing, 22)
                }
                Spacer()
            }
            .padding(.top, 60)
        }
        .onAppear {
            best = ScoreStore().best
            pulse = true
            AudioManager.shared.playMusic("menu")
        }
    }

    private func hint(_ symbol: String, _ text: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: symbol).font(.system(size: 22, weight: .heavy))
            Text(text).font(.system(size: 15, weight: .heavy, design: .rounded))
        }
        .foregroundStyle(.white)
        .frame(width: 88, height: 70)
        .background(Color(hex: 0x1E1B4B).opacity(0.55), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.4), lineWidth: 2))
    }
}

/// Live 3D backdrop: the runner jogging on the tracks while the camera slowly swings around.
struct MenuBackdrop: UIViewRepresentable {
    final class Coordinator: NSObject, SCNSceneRendererDelegate {
        let scene = SCNScene()
        let camera = World.makeCamera()
        let figure = RunnerFigure()
        override init() {
            super.init()
            World.setupEnvironment(scene)
            for k in -7...1 { scene.rootNode.addChildNode(World.segment(k)) }   // the camera looks back along +z
            scene.rootNode.addChildNode(figure.root)
            scene.rootNode.addChildNode(camera)
        }
        func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
            figure.menuPose(time: time)
            let a = 0.35 * sin(time * 0.3)
            camera.position = SCNVector3(5.2 * sin(a), 2.3, -6.4 * cos(a))
            camera.look(at: SCNVector3(0, 1.35, 0))
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = context.coordinator.scene
        view.pointOfView = context.coordinator.camera
        view.delegate = context.coordinator
        view.isPlaying = true
        view.rendersContinuously = true
        view.antialiasingMode = .multisampling4X
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {}
}
```

- [ ] **V5.2** Build. Install as in V4.5, then run:

```bash
SIM=$(xcrun simctl list devices available | grep "iPhone 18 Pro Max" | head -1 | grep -oE '[0-9A-F-]{36}')
xcrun simctl launch --terminate-running-process $SIM com.cagdasatici.subwayrunner
sleep 4; xcrun simctl io $SIM screenshot build/shots/v_menu.png
```

Expected:
- the 3D city and tracks fill the screen, with the kid jogging toward the camera (face visible: eyes, smile, red cap)
- a tilted, outlined white/yellow "SUBWAY / RUNNER" title near the top
- a "Best N" trophy chip
- a big green "▶ PLAY" button low down
- three hint tiles (Lanes, Jump, Roll) and a frosted speaker button at the top-right

- [ ] **V5.3** If the tool `mcp__Claude_Code_iOS_Simulator__control` is available (don't call `attach`): `tap` (220, 745) on PLAY, then `swipe` (150, 600)→(330, 600) with duration 0.15, then `screenshot`. Expected: a run starts and the kid moves to the right lane. If the tool isn't available, skip this and say so in your final report.
- [ ] **V5.4** Run `cd GameCore && swift test 2>&1 | grep Executed | tail -1`. Expected: `Executed 27 tests, with 0 failures`.
- [ ] **V5.5** Commit: `git add -A && git commit -m "feat(art): 3D menu with live backdrop"`

---

### Task V6: Refresh store screenshots and text

- [ ] **V6.1** Re-run base plan step **9.1** exactly, for both devices (it uninstalls first, so the menu shows "Best 0"). It overwrites `store/screenshots/{iphone,ipad}/01–04.png`. Expected sizes: iPhone `1320 × 2868`, iPad `2064 × 2752`. Look at each image. Every one must show the new look (as in V4.5 and V5.2).
- [ ] **V6.2** In `store/metadata.md`, make exactly these two text replacements:
  - `Change lanes to get around the big blue trains.` → `Change lanes to get around the big trains.`
  - `Bright, colourful 3D graphics.` → `A bright, colourful 3D city with a cheerful little runner.`
- [ ] **V6.3** Run `grep -ri "surfers\|sybo" --exclude-dir=build --exclude-dir=.git --exclude-dir=plans . || echo clean`. Expected: `clean`.
- [ ] **V6.4** Commit: `git add -A && git commit -m "chore(store): screenshots and copy for new visuals"`
- [ ] **V6.5** Stop and report: the commits made, the test count, and the screenshot paths. Also report anything that differed from "Expected" or was skipped.

---

## Post-overhaul ideas (don't build now)
- A matching new app icon showing the kid's face
- Character colour picker
- Day/night sky themes
- Coin trail magnet effect
