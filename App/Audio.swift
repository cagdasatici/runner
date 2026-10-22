import AVFoundation

final class AudioManager {
    static let shared = AudioManager()

    private var music: [String: AVAudioPlayer] = [:]
    private var sfx: [AVAudioPlayer] = []
    private var current: String?

    var isMuted: Bool {
        didSet {
            UserDefaults.standard.set(isMuted, forKey: "muted")
            if isMuted { stopMusic(); sfx.forEach { $0.stop() }; sfx.removeAll() }
        }
    }

    private init() {
        isMuted = UserDefaults.standard.bool(forKey: "muted")
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.ambient)
            try session.setActive(true)
        } catch { print("Audio session error: \(error)") }
    }

    private func player(_ name: String) -> AVAudioPlayer? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "wav") else {
            print("Missing audio file: \(name).wav"); return nil
        }
        do { let p = try AVAudioPlayer(contentsOf: url); p.prepareToPlay(); return p }
        catch { print("Audio load error \(name): \(error)"); return nil }
    }

    func playMusic(_ name: String) {
        stopMusic()
        guard !isMuted else { return }
        if music[name] == nil { music[name] = player(name) }
        guard let p = music[name] else { return }
        p.numberOfLoops = -1
        p.currentTime = 0
        p.play()
        current = name
    }

    func stopMusic() {
        if let c = current { music[c]?.stop() }
        current = nil
    }

    func playSFX(_ name: String) {
        guard !isMuted, let p = player(name) else { return }
        sfx.removeAll { !$0.isPlaying }
        sfx.append(p)
        p.play()
    }
}
