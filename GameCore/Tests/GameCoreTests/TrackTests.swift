import XCTest
@testable import GameCore

final class TrackTests: XCTestCase {
    func testLaneX() {
        XCTAssertEqual([0, 1, 2].map(Track.laneX), [-2.5, 0, 2.5])
    }
    func testSeed1FirstRows() {
        var t = Track(seed: 1)
        t.generate(upTo: 120)
        XCTAssertEqual(t.rowsGenerated, 5)
        XCTAssertEqual(t.obstacles.map(\.kind), [.bar, .hurdle, .hurdle, .bar, .train])
        XCTAssertEqual(t.obstacles.map(\.lane), [2, 2, 0, 0, 1])
        XCTAssertEqual(t.obstacles.map(\.z), [40, 58, 76, 94, 112])
        XCTAssertEqual(t.coins.count, 25)
        XCTAssertEqual(t.coins.prefix(5).map(\.z), [40, 42, 44, 46, 48])
        XCTAssertEqual(Set(t.coins.prefix(5).map(\.lane)), [0])
    }
    func testSameSeedSameTrack() {
        var a = Track(seed: 99), b = Track(seed: 99)
        a.generate(upTo: 2000); b.generate(upTo: 2000)
        XCTAssertEqual(a.obstacles, b.obstacles)
        XCTAssertEqual(a.coins, b.coins)
    }
    func testFirstThreeRowsHaveOneObstacle() {
        for seed: UInt64 in 1...50 {
            var t = Track(seed: seed)
            t.generate(upTo: Track.rowZ(2))
            XCTAssertEqual(t.obstacles.count, 3, "seed \(seed)")
        }
    }
    func testEveryRowLeavesAFreeLaneAndCoinsAreInAFreeLane() {
        for seed: UInt64 in 1...50 {
            var t = Track(seed: seed)
            t.generate(upTo: 3000)
            for row in 0..<t.rowsGenerated {
                let z0 = Track.rowZ(row)
                let lanes = t.obstacles.filter { $0.z == z0 }.map(\.lane)
                XCTAssertTrue((1...2).contains(lanes.count), "seed \(seed) row \(row)")
                XCTAssertEqual(Set(lanes).count, lanes.count, "seed \(seed) row \(row): two obstacles in one lane")
                let coinLanes = Set(t.coins.filter { $0.z >= z0 && $0.z < z0 + Track.rowGap }.map(\.lane))
                XCTAssertEqual(coinLanes.count, 1)
                XCTAssertFalse(lanes.contains(coinLanes.first!), "seed \(seed) row \(row): coins on an obstacle")
            }
        }
    }
    func testDropBehindForgetsPassedThings() {
        var t = Track(seed: 1)
        t.generate(upTo: 120)
        t.dropBehind(60)   // keeps anything whose far end is at or after z 55
        XCTAssertEqual(t.obstacles.map(\.z), [58, 76, 94, 112])
        XCTAssertEqual(t.coins.first?.z, 58)
    }
}
