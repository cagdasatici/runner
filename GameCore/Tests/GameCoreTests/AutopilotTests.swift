import XCTest
@testable import GameCore

final class AutopilotTests: XCTestCase {
    func testIdleRunnerCrashesOnSeed2() {
        var g = RunSession(seed: 2)
        while !g.state.crashed && g.state.tick < 20000 { g.tick(.none) }
        XCTAssertTrue(g.state.crashed)
        XCTAssertEqual(g.state.tick, 467)
    }
    func testAutopilotSurvivesTwoMinutesOnSeeds1to20() {
        for seed: UInt64 in 1...20 {
            var g = RunSession(seed: seed)
            while !g.state.crashed && g.state.tick < 14400 { g.tick(Autopilot.move(g.state, track: g.track)) }
            XCTAssertFalse(g.state.crashed, "seed \(seed) crashed at z \(g.state.z)")
        }
    }
    func testAutopilotSeed1Golden() {
        var g = RunSession(seed: 1)
        while g.state.tick < 14400 { g.tick(Autopilot.move(g.state, track: g.track)) }
        XCTAssertEqual(g.state.z, 1899.958333, accuracy: 1e-4)
        XCTAssertEqual(g.state.coins, 252)
        XCTAssertEqual(g.state.score, 4419)
    }
}
