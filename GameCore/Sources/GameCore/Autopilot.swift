/// A simple bot. Powers autoplay screenshots and proves generated tracks can be survived.
public enum Autopilot {
    public static func move(_ s: RunnerState, track: Track) -> Move {
        let ahead = s.speed * 0.6 + 3
        func trainIn(_ lane: Int, _ z0: Double, _ z1: Double) -> Bool {
            track.obstacles.contains { $0.kind == .train && $0.lane == lane && $0.z < z1 && $0.z + $0.length > z0 }
        }
        if trainIn(s.lane, s.z - 1, s.z + ahead) {
            let order = [s.lane - 1, s.lane + 1, s.lane - 2, s.lane + 2].filter { (0...2).contains($0) }
            for target in order where !trainIn(target, s.z - 1, s.z + ahead) {
                let step = target < s.lane ? -1 : 1
                var lane = s.lane + step, pathClear = true
                while lane != target { if trainIn(lane, s.z - 1.5, s.z + 2.5) { pathClear = false }; lane += step }
                if pathClear { return step < 0 ? .left : .right }
            }
            return .none
        }
        let next = track.obstacles
            .filter { $0.lane == s.lane && $0.kind != .train && $0.z + $0.length > s.z - Runner.halfDepth }
            .min { $0.z < $1.z }
        guard let o = next else { return .none }
        let gap = o.z - (s.z + Runner.halfDepth)
        switch o.kind {
        case .hurdle where s.isGrounded && gap <= s.speed * 0.25: return .up
        case .bar where gap <= s.speed * 0.3 && Double(s.slideTicks) * Runner.dt * s.speed < gap + 1.3: return .down
        default: return .none
        }
    }
}
