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
