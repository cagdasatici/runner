import SwiftUI

enum Screen: Equatable { case menu, playing }

@main
struct SubwayRunnerApp: App {
    // Launch arguments (testing and store screenshots):
    //   -autoplay YES   go straight into a run steered by Autopilot
    //   -idle YES       with -autoplay: never steer (crashes quickly, shows Game Over)
    //   -seed N         fixed track seed (0 or missing = random)
    @State private var screen: Screen = UserDefaults.standard.bool(forKey: "autoplay") ? .playing : .menu
    @State private var runID = 0

    var body: some Scene {
        WindowGroup {
            Group {
                switch screen {
                case .menu:
                    MenuView(onPlay: { runID += 1; screen = .playing })
                case .playing:
                    GameView(autoplay: UserDefaults.standard.bool(forKey: "autoplay"),
                             idle: UserDefaults.standard.bool(forKey: "idle"),
                             seed: UInt64(max(0, UserDefaults.standard.integer(forKey: "seed"))),
                             onRestart: { runID += 1 },
                             onExit: { screen = .menu })
                        .id(runID)   // new id = brand-new run
                }
            }
            .statusBarHidden()
            .ignoresSafeArea()
        }
    }
}
