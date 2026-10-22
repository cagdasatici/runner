import Foundation

public final class ScoreStore {
    public static let bestKey = "best.score"
    private let defaults: UserDefaults
    public init(defaults: UserDefaults = .standard) { self.defaults = defaults }
    /// Never negative, even if storage holds garbage.
    public var best: Int { max(0, defaults.integer(forKey: ScoreStore.bestKey)) }
    /// Saves `score` if it beats the best. Returns true when it is a new best.
    @discardableResult
    public func record(_ score: Int) -> Bool {
        guard score > best else { return false }
        defaults.set(score, forKey: ScoreStore.bestKey)
        return true
    }
}
