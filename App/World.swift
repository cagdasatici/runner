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
