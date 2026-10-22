import XCTest
@testable import GameCore

final class ScoreStoreTests: XCTestCase {
    private func freshDefaults() -> UserDefaults {
        let name = "test.\(UUID().uuidString)"
        let d = UserDefaults(suiteName: name)!
        d.removePersistentDomain(forName: name)
        return d
    }
    func testRecordKeepsBest() {
        let store = ScoreStore(defaults: freshDefaults())
        XCTAssertEqual(store.best, 0)
        XCTAssertTrue(store.record(50))
        XCTAssertFalse(store.record(30))
        XCTAssertEqual(store.best, 50)
    }
    func testNegativeStoredBestReadsAsZero() {
        let d = freshDefaults()
        d.set(-7, forKey: "best.score")
        XCTAssertEqual(ScoreStore(defaults: d).best, 0)
    }
}
