public enum Move: Equatable { case none, left, right, up, down }

public struct RunnerState: Equatable {
    public var tick = 0
    public var z = 0.0            // distance run, metres
    public var lane = 1           // target lane
    public var x = 0.0            // sideways position, follows Track.laneX(lane)
    public var y = 0.0            // feet height
    public var vy = 0.0
    public var slideTicks = 0     // > 0 while sliding
    public var coins = 0
    public var collected: Set<Int> = []
    public var crashed = false

    public static let start = RunnerState()
    public var isGrounded: Bool { y == 0 && vy == 0 }
    public var isSliding: Bool { slideTicks > 0 }
    public var height: Double { isSliding ? Runner.slideHeight : Runner.standHeight }
    public var speed: Double { Runner.speed(atTick: tick) }
    public var score: Int { Int(z) + coins * Runner.coinValue }
}

public enum Runner {
    public static let dt = 1.0 / 120.0
    public static let startSpeed = 10.0
    public static let acceleration = 0.1          // m/s gained per second
    public static let maxSpeed = 20.0
    public static let laneSwitchSpeed = 25.0      // sideways m/s → 0.1 s per lane
    public static let jumpVelocity = 9.0
    public static let gravity = 30.0
    public static let fastFallVelocity = -15.0
    public static let slideDuration = 72          // ticks = 0.6 s
    public static let halfWidth = 0.4
    public static let halfDepth = 0.4
    public static let standHeight = 1.8
    public static let slideHeight = 0.9
    public static let coinValue = 10
    public static let coinReach = 0.9

    public static func speed(atTick t: Int) -> Double {
        min(maxSpeed, startSpeed + acceleration * Double(t) * dt)
    }

    /// Box of an obstacle: (x half-width, y bottom, y top).
    static func box(_ kind: ObstacleKind) -> (halfW: Double, y0: Double, y1: Double) {
        switch kind {
        case .hurdle: return (1.0, 0.0, 1.0)
        case .bar: return (1.0, 1.2, 2.2)
        case .train: return (1.1, 0.0, 3.5)
        }
    }

    public static func step(_ s: RunnerState, move: Move, track: Track) -> RunnerState {
        var s = s
        guard !s.crashed else { return s }
        switch move {
        case .left: s.lane = max(0, s.lane - 1)
        case .right: s.lane = min(2, s.lane + 1)
        case .up: if s.isGrounded { s.vy = jumpVelocity; s.slideTicks = 0 }
        case .down:
            if !s.isGrounded { s.vy = min(s.vy, fastFallVelocity) }
            s.slideTicks = slideDuration
        case .none: break
        }
        let maxStep = laneSwitchSpeed * dt
        s.x += max(-maxStep, min(maxStep, Track.laneX(s.lane) - s.x))
        if s.y > 0 || s.vy > 0 {
            s.vy -= gravity * dt
            s.y += s.vy * dt
            if s.y <= 0 { s.y = 0; s.vy = 0 }
        }
        if s.slideTicks > 0 { s.slideTicks -= 1 }
        s.z += speed(atTick: s.tick) * dt
        s.tick += 1

        // overlap(a0, a1, b0, b1) = a0 < b1 && a1 > b0 (strict)
        func overlap(_ a0: Double, _ a1: Double, _ b0: Double, _ b1: Double) -> Bool { a0 < b1 && a1 > b0 }
        let h = s.height
        for o in track.obstacles {
            let b = box(o.kind), ox = Track.laneX(o.lane)
            if overlap(s.x - halfWidth, s.x + halfWidth, ox - b.halfW, ox + b.halfW)
                && overlap(s.y, s.y + h, b.y0, b.y1)
                && overlap(s.z - halfDepth, s.z + halfDepth, o.z, o.z + o.length) {
                s.crashed = true
                return s
            }
        }
        for c in track.coins where !s.collected.contains(c.id) {
            if abs(s.x - Track.laneX(c.lane)) < coinReach && abs(s.z - c.z) < coinReach
                && s.y <= Track.coinY && Track.coinY <= s.y + h {
                s.collected.insert(c.id)
                s.coins += 1
            }
        }
        return s
    }
}

/// One run: the track plus the runner. The app and the tests both drive the game through this.
public struct RunSession {
    public static let generateAhead = 120.0
    public private(set) var state = RunnerState.start
    public private(set) var track: Track

    public init(seed: UInt64) {
        track = Track(seed: seed)
        track.generate(upTo: RunSession.generateAhead)
    }

    public mutating func tick(_ move: Move) {
        state = Runner.step(state, move: move, track: track)
        track.generate(upTo: state.z + RunSession.generateAhead)
        track.dropBehind(state.z)
    }
}
