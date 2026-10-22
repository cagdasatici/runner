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
