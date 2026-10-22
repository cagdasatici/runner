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
