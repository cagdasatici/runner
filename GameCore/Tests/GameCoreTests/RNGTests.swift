import XCTest
@testable import GameCore

final class RNGTests: XCTestCase {
    func testSplitMix64KnownValues() {
        var r = SplitMix64(seed: 0)
        XCTAssertEqual(r.next(), 0xE220_A839_7B1D_CDAF)
        XCTAssertEqual(r.next(), 0x6E78_9E6A_A1B9_65F4)
    }
    func testIntStaysInRangeAndHitsEveryValue() {
        var r = SplitMix64(seed: 42)
        var seen = Set<Int>()
        for _ in 0..<1000 { let v = r.int(3); XCTAssertTrue((0..<3).contains(v)); seen.insert(v) }
        XCTAssertEqual(seen, [0, 1, 2])
    }
}
