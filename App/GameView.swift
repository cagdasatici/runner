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

    var body: some View {
        ZStack {
            GameSceneView(model: model, autoplay: autoplay, idle: idle, seed: seed)
                .ignoresSafeArea()
            VStack {
                HStack(alignment: .top) {
                    Button(action: onExit) {
                        Text("✕")
                            .font(.system(size: 30, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(width: 60, height: 60)
                            .background(.black.opacity(0.35), in: Circle())
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 6) {
                        Text("\(model.score)")
                            .font(.system(size: 40, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.4), radius: 0, x: 2, y: 2)
                        HStack(spacing: 8) {
                            Circle().fill(Color(hex: 0xFACC15)).frame(width: 24, height: 24)
                            Text("\(model.coins)")
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .shadow(color: .black.opacity(0.4), radius: 0, x: 2, y: 2)
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 60)
                Spacer()
            }
            if model.isOver { gameOver }
        }
    }

    private var gameOver: some View {
        VStack(spacing: 20) {
            Text("Crash!")
                .font(.system(size: 56, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Text("Score \(model.score)")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
            Text("Coins \(model.coins)")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundStyle(Color(hex: 0xFACC15))
            if model.isNewBest {
                Text("New best!")
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color(hex: 0x4ADE80))
            }
            Button(action: onRestart) { pill("Play Again", color: 0xF97316) }
            Button(action: onExit) { pill("Menu", color: 0x0EA5E9) }
        }
        .padding(36)
        .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 32))
    }

    private func pill(_ title: String, color: UInt32) -> some View {
        Text(title)
            .font(.system(size: 28, weight: .heavy, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: 220, height: 72)
            .background(Color(hex: color), in: RoundedRectangle(cornerRadius: 22))
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
        view.antialiasingMode = .multisampling2X
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
