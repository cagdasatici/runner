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
