import SwiftUI
import SceneKit
import GameCore

/// Values the HUD shows. Written on the main thread only.
final class GameModel: ObservableObject {
    @Published var score = 0
    @Published var coins = 0
    @Published var isOver = false
    @Published var isNewBest = false
}

struct GameView: View {
    let autoplay: Bool
    let idle: Bool
    let seed: UInt64
    let onRestart: () -> Void
    let onExit: () -> Void
    @StateObject private var model = GameModel()

    @State private var panelIn = false

    var body: some View {
        ZStack {
            GameSceneView(model: model, autoplay: autoplay, idle: idle, seed: seed)
                .ignoresSafeArea()
            VStack {
                HStack(alignment: .top) {
                    Button(action: onExit) {
                        Image(systemName: "xmark")
                            .font(.system(size: 24, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(width: 58, height: 58)
                            .background(.ultraThinMaterial, in: Circle())
                            .overlay(Circle().stroke(.white.opacity(0.6), lineWidth: 2))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 8) {
                        HStack(spacing: 8) {
                            Text("SCORE")
                                .font(.system(size: 14, weight: .heavy, design: .rounded))
                                .foregroundStyle(.white.opacity(0.8))
                            Text("\(model.score)")
                                .font(.system(size: 34, weight: .black, design: .rounded))
                                .foregroundStyle(.white)
                                .monospacedDigit()
                                .contentTransition(.numericText())
                        }
                        .padding(.horizontal, 18).frame(height: 54)
                        .background(Color(hex: 0x1E1B4B).opacity(0.55), in: Capsule())
                        .overlay(Capsule().stroke(.white.opacity(0.5), lineWidth: 2))
                        HStack(spacing: 8) {
                            CoinIcon(size: 28)
                            Text("\(model.coins)")
                                .font(.system(size: 28, weight: .black, design: .rounded))
                                .foregroundStyle(Color(hex: 0xFDE047))
                                .monospacedDigit()
                        }
                        .padding(.horizontal, 14).frame(height: 46)
                        .background(Color(hex: 0x1E1B4B).opacity(0.55), in: Capsule())
                        .overlay(Capsule().stroke(Color(hex: 0xFDE047).opacity(0.6), lineWidth: 2))
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 60)
                Spacer()
            }
            if model.isOver {
                Color.black.opacity(0.35).ignoresSafeArea()
                gameOver
                    .scaleEffect(panelIn ? 1 : 0.6)
                    .opacity(panelIn ? 1 : 0)
                    .onAppear { withAnimation(.spring(response: 0.45, dampingFraction: 0.62)) { panelIn = true } }
            }
        }
    }

    private var gameOver: some View {
        VStack(spacing: 18) {
            OutlinedTitle(text: "Crash!", size: 60)
            VStack(spacing: 10) {
                statRow(label: "SCORE", value: "\(model.score)", color: 0xFFFFFF)
                HStack(spacing: 10) {
                    CoinIcon(size: 30)
                    Text("\(model.coins)")
                        .font(.system(size: 30, weight: .black, design: .rounded))
                        .foregroundStyle(Color(hex: 0xFDE047))
                }
                if model.isNewBest {
                    Label("New best!", systemImage: "trophy.fill")
                        .font(.system(size: 24, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color(hex: 0x1E1B4B))
                        .padding(.horizontal, 18).padding(.vertical, 8)
                        .background(Color(hex: 0xFDE047), in: Capsule())
                }
            }
            .padding(.vertical, 6)
            Button(action: onRestart) { Label("Play Again", systemImage: "arrow.clockwise") }
                .buttonStyle(ChunkyButtonStyle(top: 0xFB923C, bottom: 0xEA580C, base: 0x9A3412))
            Button(action: onExit) { Label("Menu", systemImage: "house.fill") }
                .buttonStyle(ChunkyButtonStyle(top: 0x38BDF8, bottom: 0x0284C7, base: 0x075985, height: 64))
        }
        .padding(.horizontal, 30).padding(.vertical, 32)
        .background(
            LinearGradient(colors: [Color(hex: 0x6366F1), Color(hex: 0x312E81)], startPoint: .top, endPoint: .bottom),
            in: RoundedRectangle(cornerRadius: 36))
        .overlay(RoundedRectangle(cornerRadius: 36).stroke(.white.opacity(0.8), lineWidth: 4))
        .shadow(color: .black.opacity(0.35), radius: 20, y: 10)
    }

    private func statRow(label: String, value: String, color: UInt32) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(.white.opacity(0.75))
            Text(value)
                .font(.system(size: 44, weight: .black, design: .rounded))
                .foregroundStyle(Color(hex: color))
        }
    }
}

/// Hosts the SCNView and turns swipes into moves.
struct GameSceneView: UIViewRepresentable {
    let model: GameModel
    let autoplay: Bool
    let idle: Bool
    let seed: UInt64

    func makeCoordinator() -> GameController {
        GameController(model: model, autoplay: autoplay, idle: idle,
                       seed: seed != 0 ? seed : UInt64.random(in: 1...UInt64(UInt32.max)))
    }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = context.coordinator.scene
        view.pointOfView = context.coordinator.cameraNode
        view.delegate = context.coordinator
        view.isPlaying = true
        view.rendersContinuously = true
        view.preferredFramesPerSecond = 60
        view.antialiasingMode = .multisampling4X
        view.backgroundColor = UIColor(red: 0.53, green: 0.81, blue: 0.98, alpha: 1)
        for dir: UISwipeGestureRecognizer.Direction in [.left, .right, .up, .down] {
            let swipe = UISwipeGestureRecognizer(target: context.coordinator, action: #selector(GameController.swiped(_:)))
            swipe.direction = dir
            view.addGestureRecognizer(swipe)
        }
        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {}
}
