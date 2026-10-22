/// SplitMix64: tiny deterministic random generator. Same seed → same track on every device.
public struct SplitMix64: Equatable {
    public private(set) var state: UInt64
    public init(seed: UInt64) { state = seed }
    public mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
    /// Uniform-ish integer in 0..<n (n > 0).
    public mutating func int(_ n: Int) -> Int { Int(next() % UInt64(n)) }
}
