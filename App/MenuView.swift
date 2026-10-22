import SwiftUI

struct MenuView: View {
    let onPlay: () -> Void
    var body: some View { Button("PLAY", action: onPlay) }
}
