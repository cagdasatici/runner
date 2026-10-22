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

    private let runnerNode = SCNNode()
    private var obstacleNodes: [Int: SCNNode] = [:]
    private var coinNodes: [Int: SCNNode] = [:]
    private var segmentNodes: [Int: SCNNode] = [:]

    static let segmentLength = 18.0
    static let viewAhead = 110.0

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
        if session.state.crashed { return }
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

    private func material(_ hex: UInt32) -> SCNMaterial {
        let m = SCNMaterial()
        m.diffuse.contents = UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                                     blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        m.lightingModel = .lambert
        return m
    }

    private func box(_ w: Double, _ h: Double, _ l: Double, _ hex: UInt32) -> SCNNode {
        let g = SCNBox(width: w, height: h, length: l, chamferRadius: 0)
        g.firstMaterial = material(hex)
        return SCNNode(geometry: g)
    }

    private func buildScene() {
        let sky = UIColor(red: 0.53, green: 0.81, blue: 0.98, alpha: 1)
        scene.background.contents = sky
        scene.fogStartDistance = 60
        scene.fogEndDistance = 105
        scene.fogColor = sky

        let camera = SCNCamera()
        camera.fieldOfView = 70
        camera.zFar = 150
        cameraNode.camera = camera
        cameraNode.eulerAngles.x = -0.22
        scene.rootNode.addChildNode(cameraNode)

        let ambient = SCNNode(); ambient.light = SCNLight(); ambient.light!.type = .ambient
        ambient.light!.intensity = 500
        scene.rootNode.addChildNode(ambient)
        let sun = SCNNode(); sun.light = SCNLight(); sun.light!.type = .directional
        sun.light!.intensity = 900
        sun.eulerAngles = SCNVector3(-0.9, 0.4, 0)
        scene.rootNode.addChildNode(sun)

        // Runner: original character (orange body, skin head, blue cap). Feet at node origin.
        let body = SCNNode(geometry: SCNCapsule(capRadius: 0.38, height: 1.2))
        body.geometry!.firstMaterial = material(0xF97316)
        body.position = SCNVector3(0, 0.6, 0)
        let head = SCNNode(geometry: SCNSphere(radius: 0.3))
        head.geometry!.firstMaterial = material(0xFDE68A)
        head.position = SCNVector3(0, 1.45, 0)
        let cap = box(0.62, 0.14, 0.75, 0x2563EB)
        cap.position = SCNVector3(0, 1.68, -0.08)
        [body, head, cap].forEach(runnerNode.addChildNode)
        scene.rootNode.addChildNode(runnerNode)
    }

    /// One 18 m piece of track: ground, rails, sleepers and side walls.
    private func makeSegment(_ k: Int) -> SCNNode {
        let len = GameController.segmentLength
        let node = SCNNode()
        let ground = box(9, 0.2, len, 0x64748B)
        ground.position = SCNVector3(0, -0.1, -len / 2)
        node.addChildNode(ground)
        for lane in 0..<3 {
            let x = Track.laneX(lane)
            for side in [-0.75, 0.75] {
                let rail = box(0.12, 0.12, len, 0xCBD5E1)
                rail.position = SCNVector3(x + side, 0.06, -len / 2)
                node.addChildNode(rail)
            }
            var z = 0.75
            while z < len {
                let tie = box(2.0, 0.06, 0.35, 0x78350F)
                tie.position = SCNVector3(x, 0.01, -z)
                node.addChildNode(tie)
                z += 1.5
            }
        }
        let wallColor: UInt32 = k % 2 == 0 ? 0xFDBA74 : 0xA5B4FC
        for side in [-1.0, 1.0] {
            let wall = box(1, 4, len, wallColor)
            wall.position = SCNVector3(side * 5.5, 2, -len / 2)
            node.addChildNode(wall)
        }
        let flat = node.flattenedClone()
        flat.position = SCNVector3(0, 0, -Double(k) * len)
        return flat
    }

    private func makeObstacle(_ o: Obstacle) -> SCNNode {
        let x = Track.laneX(o.lane)
        let node: SCNNode
        switch o.kind {
        case .hurdle:
            node = box(2.0, 1.0, 0.5, 0xEF4444)
            let stripe = box(2.02, 0.25, 0.52, 0xFFFFFF)
            node.addChildNode(stripe)
            node.position = SCNVector3(x, 0.5, -(o.z + 0.25))
        case .bar:
            node = SCNNode()
            let bar = box(2.0, 1.0, 0.5, 0xFACC15)
            bar.position = SCNVector3(0, 1.7, 0)
            node.addChildNode(bar)
            for side in [-1.1, 1.1] {
                let post = box(0.15, 1.2, 0.15, 0x334155)
                post.position = SCNVector3(side, 0.6, 0)
                node.addChildNode(post)
            }
            node.position = SCNVector3(x, 0, -(o.z + 0.25))
        case .train:
            node = box(2.2, 3.5, Track.trainLength, 0x2563EB)
            let window = box(1.6, 1.0, 0.05, 0xBAE6FD)
            window.position = SCNVector3(0, 0.7, Track.trainLength / 2 + 0.03)   // front face (toward the runner)
            node.addChildNode(window)
            let stripe = box(2.22, 0.3, Track.trainLength + 0.02, 0xFFFFFF)
            stripe.position = SCNVector3(0, -0.6, 0)
            node.addChildNode(stripe)
            node.position = SCNVector3(x, 1.75, -(o.z + Track.trainLength / 2))
        }
        return node
    }

    private func makeCoin(_ c: Coin) -> SCNNode {
        let g = SCNCylinder(radius: 0.35, height: 0.08)
        let m = material(0xFACC15)
        m.emission.contents = UIColor(red: 0.4, green: 0.3, blue: 0, alpha: 1)
        g.firstMaterial = m
        let spin = SCNNode(geometry: g)
        spin.eulerAngles.x = .pi / 2
        let node = SCNNode()
        node.addChildNode(spin)
        node.position = SCNVector3(Track.laneX(c.lane), Track.coinY, -c.z)
        node.eulerAngles.y = Float(c.id % 8) * 0.4      // stagger the spin so coins don't all turn edge-on together
        node.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 1)))
        return node
    }

    /// Makes scene nodes match `session`: adds new things, removes passed or collected ones.
    private func syncNodes() {
        let s = session.state, track = session.track
        let len = GameController.segmentLength
        let firstSeg = max(-1, Int((s.z - 10) / len) - 1)
        let lastSeg = Int((s.z + GameController.viewAhead) / len)
        for k in firstSeg...lastSeg where segmentNodes[k] == nil {
            let n = makeSegment(k); segmentNodes[k] = n; scene.rootNode.addChildNode(n)
        }
        for (k, n) in segmentNodes where k < firstSeg { n.removeFromParentNode(); segmentNodes[k] = nil }

        var live = Set<Int>()
        for o in track.obstacles where o.z < s.z + GameController.viewAhead {
            live.insert(o.id)
            if obstacleNodes[o.id] == nil { let n = makeObstacle(o); obstacleNodes[o.id] = n; scene.rootNode.addChildNode(n) }
        }
        for (id, n) in obstacleNodes where !live.contains(id) { n.removeFromParentNode(); obstacleNodes[id] = nil }

        live.removeAll()
        for c in track.coins where c.z < s.z + GameController.viewAhead && !s.collected.contains(c.id) {
            live.insert(c.id)
            if coinNodes[c.id] == nil { let n = makeCoin(c); coinNodes[c.id] = n; scene.rootNode.addChildNode(n) }
        }
        for (id, n) in coinNodes where !live.contains(id) { n.removeFromParentNode(); coinNodes[id] = nil }

        runnerNode.position = SCNVector3(s.x, s.y, -s.z)
        runnerNode.scale = SCNVector3(1, s.isSliding ? 0.5 : 1, 1)
        runnerNode.eulerAngles.x = s.crashed ? -1.2 : 0
        cameraNode.position = SCNVector3(s.x * 0.6, 4.2, -s.z + 7.5)
    }
}
