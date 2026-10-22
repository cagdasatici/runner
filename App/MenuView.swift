import SwiftUI
import SceneKit
import GameCore

struct MenuView: View {
    let onPlay: () -> Void
    @State private var best = 0
    @State private var muted = AudioManager.shared.isMuted
    @State private var pulse = false

    var body: some View {
        ZStack {
            MenuBackdrop().ignoresSafeArea()
            LinearGradient(colors: [Color(hex: 0x1E1B4B).opacity(0.55), .clear, .clear, Color(hex: 0x1E1B4B).opacity(0.65)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            VStack(spacing: 18) {
                Spacer().frame(height: 90)
                VStack(spacing: -14) {
                    OutlinedTitle(text: "SUBWAY", size: 68)
                    OutlinedTitle(text: "RUNNER", size: 68)
                }
                .rotationEffect(.degrees(-4))
                HStack(spacing: 8) {
                    Image(systemName: "trophy.fill").foregroundStyle(Color(hex: 0xFDE047))
                    Text("Best \(best)")
                        .foregroundStyle(.white)
                }
                .font(.system(size: 24, weight: .heavy, design: .rounded))
                .padding(.horizontal, 20).frame(height: 48)
                .background(Color(hex: 0x1E1B4B).opacity(0.6), in: Capsule())
                .overlay(Capsule().stroke(.white.opacity(0.5), lineWidth: 2))
                Spacer()
                Button(action: onPlay) { Label("PLAY", systemImage: "play.fill") }
                    .buttonStyle(ChunkyButtonStyle(top: 0x4ADE80, bottom: 0x16A34A, base: 0x14532D, width: 260, height: 92))
                    .scaleEffect(pulse ? 1.06 : 1)
                    .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: pulse)
                HStack(spacing: 14) {
                    hint("arrow.left.and.right", "Lanes")
                    hint("arrow.up", "Jump")
                    hint("arrow.down", "Roll")
                }
                .padding(.bottom, 50)
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
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 56, height: 56)
                            .background(.ultraThinMaterial, in: Circle())
                            .overlay(Circle().stroke(.white.opacity(0.6), lineWidth: 2))
                    }
                    .padding(.trailing, 22)
                }
                Spacer()
            }
            .padding(.top, 60)
        }
        .onAppear {
            best = ScoreStore().best
            pulse = true
            AudioManager.shared.playMusic("menu")
        }
    }

    private func hint(_ symbol: String, _ text: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: symbol).font(.system(size: 22, weight: .heavy))
            Text(text).font(.system(size: 15, weight: .heavy, design: .rounded))
        }
        .foregroundStyle(.white)
        .frame(width: 88, height: 70)
        .background(Color(hex: 0x1E1B4B).opacity(0.55), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.4), lineWidth: 2))
    }
}

/// Live 3D backdrop: the runner jogging on the tracks while the camera slowly swings around.
struct MenuBackdrop: UIViewRepresentable {
    final class Coordinator: NSObject, SCNSceneRendererDelegate {
        let scene = SCNScene()
        let camera = World.makeCamera()
        let figure = RunnerFigure()
        override init() {
            super.init()
            World.setupEnvironment(scene)
            for k in -7...1 { scene.rootNode.addChildNode(World.segment(k)) }   // the camera looks back along +z
            scene.rootNode.addChildNode(figure.root)
            scene.rootNode.addChildNode(camera)
        }
        func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
            figure.menuPose(time: time)
            let a = 0.35 * sin(time * 0.3)
            camera.position = SCNVector3(5.2 * sin(a), 2.3, -6.4 * cos(a))
            camera.look(at: SCNVector3(0, 1.35, 0))
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = context.coordinator.scene
        view.pointOfView = context.coordinator.camera
        view.delegate = context.coordinator
        view.isPlaying = true
        view.rendersContinuously = true
        view.antialiasingMode = .multisampling4X
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {}
}
