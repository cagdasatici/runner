import XCTest
@testable import GameCore

final class RunnerTests: XCTestCase {
    private let empty = Track(fixed: [])

    /// Steps with `.none` (or `moveAt` when its condition first holds) until crashed or `ticks` reached.
    private func run(_ track: Track, from s: RunnerState = .start, ticks: Int,
                     moveAt: ((RunnerState) -> Move?)? = nil) -> RunnerState {
        var s = s
        var used = false
        for _ in 0..<ticks where !s.crashed {
            var m = Move.none
            if !used, let pick = moveAt?(s) { m = pick; used = true }
            s = Runner.step(s, move: m, track: track)
        }
        return s
    }

    func testSpeedRamp() {
        XCTAssertEqual(Runner.speed(atTick: 0), 10)
        XCTAssertEqual(Runner.speed(atTick: 1200), 11, accuracy: 1e-9)
        XCTAssertEqual(Runner.speed(atTick: 12000), 20)
        XCTAssertEqual(Runner.speed(atTick: 50000), 20)
    }
    func testRunsForwardOnEmptyTrack() {
        let s = run(empty, ticks: 12000)
        XCTAssertEqual(s.z, 1499.958333, accuracy: 1e-5)
        XCTAssertFalse(s.crashed)
        XCTAssertTrue(s.isGrounded)
    }
    func testJumpArc() {
        var s = Runner.step(.start, move: .up, track: empty)
        var ticks = 1, peak = 0.0
        while !s.isGrounded { peak = max(peak, s.y); s = Runner.step(s, move: .none, track: empty); ticks += 1 }
        XCTAssertEqual(ticks, 72)
        XCTAssertEqual(peak, 1.3125, accuracy: 1e-9)
    }
    func testCannotDoubleJump() {
        let up = Runner.step(.start, move: .up, track: empty)
        let next = Runner.step(up, move: .up, track: empty)
        XCTAssertLessThan(next.vy, up.vy)
    }
    func testSlideLasts72TicksAndLowersHeight() {
        var s = Runner.step(.start, move: .down, track: empty)
        XCTAssertEqual(s.height, 0.9)
        var ticks = 1
        while s.isSliding { s = Runner.step(s, move: .none, track: empty); ticks += 1 }
        XCTAssertEqual(ticks, 72)
        XCTAssertEqual(s.height, 1.8)
    }
    func testUpCancelsSlide() {
        let sliding = Runner.step(.start, move: .down, track: empty)
        let s = Runner.step(sliding, move: .up, track: empty)
        XCTAssertFalse(s.isSliding)
        XCTAssertGreaterThan(s.y, 0)
    }
    func testDownInAirFastFalls() {
        let air = run(empty, ticks: 10, moveAt: { _ in .up })
        let s = Runner.step(air, move: .down, track: empty)
        XCTAssertLessThanOrEqual(s.vy, -15)
        XCTAssertTrue(s.isSliding)
    }
    func testLaneChangeTakes12TicksAndClampsAtEdges() {
        var s = Runner.step(.start, move: .left, track: empty)
        var ticks = 1
        while s.x != -2.5 { s = Runner.step(s, move: .none, track: empty); ticks += 1 }
        XCTAssertEqual(ticks, 12)
        s = Runner.step(s, move: .left, track: empty)
        XCTAssertEqual(s.lane, 0)
        XCTAssertEqual(s.x, -2.5)
    }
    func testHurdleCrashesUnlessJumped() {
        let track = Track(fixed: [Obstacle(id: 0, kind: .hurdle, lane: 1, z: 10)])
        let hit = run(track, ticks: 240)
        XCTAssertTrue(hit.crashed)
        XCTAssertEqual(hit.z, 9.6, accuracy: 0.1)
        let cleared = run(track, ticks: 240, moveAt: { $0.z >= 8 ? .up : nil })
        XCTAssertFalse(cleared.crashed)
    }
    func testBarCrashesUnlessSlid() {
        let track = Track(fixed: [Obstacle(id: 0, kind: .bar, lane: 1, z: 10)])
        XCTAssertTrue(run(track, ticks: 240).crashed)
        XCTAssertTrue(run(track, ticks: 240, moveAt: { $0.z >= 8 ? .up : nil }).crashed)   // jumping is not enough
        XCTAssertFalse(run(track, ticks: 240, moveAt: { $0.z >= 8 ? .down : nil }).crashed)
    }
    func testTrainCrashesEvenWhenJumpingButNotInOtherLane() {
        let track = Track(fixed: [Obstacle(id: 0, kind: .train, lane: 1, z: 10)])
        XCTAssertTrue(run(track, ticks: 480, moveAt: { $0.z >= 8 ? .up : nil }).crashed)
        XCTAssertFalse(run(track, ticks: 480, moveAt: { $0.z >= 5 ? .right : nil }).crashed)
    }
    func testSwitchingIntoTrainSideCrashes() {
        let track = Track(fixed: [Obstacle(id: 0, kind: .train, lane: 0, z: 2)])
        XCTAssertTrue(run(track, ticks: 120, moveAt: { $0.z >= 5 ? .left : nil }).crashed)
    }
    func testCollectsCoinsInOwnLaneOnly() {
        let track = Track(fixed: [], coins: [Coin(id: 0, lane: 1, z: 5), Coin(id: 1, lane: 1, z: 7), Coin(id: 2, lane: 2, z: 5)])
        let s = run(track, ticks: 120)
        XCTAssertEqual(s.coins, 2)
        XCTAssertEqual(s.collected, [0, 1])
        XCTAssertEqual(s.score, Int(s.z) + 20)
    }
    func testCrashedStateIsFrozen() {
        var s = RunnerState.start
        s.crashed = true
        XCTAssertEqual(Runner.step(s, move: .up, track: empty), s)
    }
}
