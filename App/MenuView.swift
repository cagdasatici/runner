import SwiftUI
import GameCore

struct MenuView: View {
    let onPlay: () -> Void
    @State private var best = 0
    @State private var muted = AudioManager.shared.isMuted

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x38BDF8), Color(hex: 0x0EA5E9)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            VStack(spacing: 28) {
                Spacer()
                Text("Subway\nRunner")
                    .font(.system(size: 64, weight: .heavy, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.25), radius: 0, x: 4, y: 4)
                Text("Best: \(best)")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(Color(hex: 0xFACC15))
                Button(action: onPlay) {
                    Text("PLAY")
                        .font(.system(size: 40, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                        .frame(width: 240, height: 96)
                        .background(Color(hex: 0xF97316), in: RoundedRectangle(cornerRadius: 28))
                        .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white, lineWidth: 4))
                }
                Text("Swipe ← → to change lanes\nSwipe ↑ to jump, ↓ to slide")
                    .font(.system(size: 20, weight: .semibold, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                Spacer()
            }
            VStack {
                HStack {
                    Spacer()
                    Button {
                        muted.toggle()
                        AudioManager.shared.isMuted = muted
                        if !muted { AudioManager.shared.playMusic("menu") }
                    } label: {
                        Image(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(24)
                    }
                }
                Spacer()
            }
            .padding(.top, 40)
        }
        .onAppear {
            best = ScoreStore().best
            AudioManager.shared.playMusic("menu")
        }
    }
}
