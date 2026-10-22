import SwiftUI

struct GameView: View {
    let autoplay: Bool
    let idle: Bool
    let seed: UInt64
    let onRestart: () -> Void
    let onExit: () -> Void
    var body: some View { Button("Back", action: onExit) }
}
