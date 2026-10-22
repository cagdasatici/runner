public enum ObstacleKind: String, CaseIterable, Equatable {
    case hurdle   // low: jump over
    case bar      // overhead: slide under
    case train    // tall and long: change lane
}

public struct Obstacle: Equatable {
    public let id: Int
    public let kind: ObstacleKind
    public let lane: Int        // 0 = left, 1 = middle, 2 = right
    public let z: Double        // near edge; the far edge is z + length
    public var length: Double { kind == .train ? Track.trainLength : Track.thinLength }
    public init(id: Int, kind: ObstacleKind, lane: Int, z: Double) { self.id = id; self.kind = kind; self.lane = lane; self.z = z }
}

public struct Coin: Equatable {
    public let id: Int
    public let lane: Int
    public let z: Double
    public init(id: Int, lane: Int, z: Double) { self.id = id; self.lane = lane; self.z = z }
}

public struct Track {
    public static let laneWidth = 2.5
    public static let firstRowZ = 40.0
    public static let rowGap = 18.0
    public static let trainLength = 10.0
    public static let thinLength = 0.5
    public static let coinsPerRow = 5
    public static let coinSpacing = 2.0
    public static let coinY = 0.9

    public private(set) var obstacles: [Obstacle] = []
    public private(set) var coins: [Coin] = []
    public private(set) var rowsGenerated = 0
    private var rng: SplitMix64
    private var nextID = 0

    public init(seed: UInt64) { rng = SplitMix64(seed: seed) }

    /// Hand-made track for tests. Don't call generate(upTo:) on it.
    public init(fixed obstacles: [Obstacle], coins: [Coin] = []) {
        rng = SplitMix64(seed: 0)
        self.obstacles = obstacles
        self.coins = coins
    }

    public static func laneX(_ lane: Int) -> Double { Double(lane - 1) * laneWidth }
    public static func rowZ(_ row: Int) -> Double { firstRowZ + Double(row) * rowGap }

    /// Adds rows until the next row would start beyond `z`.
    public mutating func generate(upTo z: Double) {
        while Track.rowZ(rowsGenerated) <= z { addRow(rowsGenerated); rowsGenerated += 1 }
    }

    /// Forgets things the runner has fully passed.
    public mutating func dropBehind(_ z: Double) {
        obstacles.removeAll { $0.z + $0.length < z - 5 }
        coins.removeAll { $0.z < z - 5 }
    }

    private mutating func addRow(_ row: Int) {
        let z0 = Track.rowZ(row)
        let count = row < 3 ? 1 : 1 + rng.int(2)          // 1 or 2 obstacles; one lane always free
        let a = rng.int(3)
        var lanes = [a]
        if count == 2 { lanes.append((a + 1 + rng.int(2)) % 3) }
        for lane in lanes {
            let kind = ObstacleKind.allCases[rng.int(3)]
            obstacles.append(Obstacle(id: nextID, kind: kind, lane: lane, z: z0)); nextID += 1
        }
        let free = (0..<3).filter { !lanes.contains($0) }
        let coinLane = free[rng.int(free.count)]
        for i in 0..<Track.coinsPerRow {
            coins.append(Coin(id: nextID, lane: coinLane, z: z0 + Double(i) * Track.coinSpacing)); nextID += 1
        }
    }
}
