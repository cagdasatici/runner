import Foundation

let rate = 22050.0
var lcg: UInt64 = 12345
func noise() -> Double {
    lcg = lcg &* 6364136223846793005 &+ 1442695040888963407
    return Double(Int64(bitPattern: lcg) >> 11) / Double(1 << 52)  // roughly -1...1
}
func freq(_ midi: Double) -> Double { 440 * pow(2, (midi - 69) / 12) }

struct Buf {
    var s: [Double]
    init(seconds: Double) { s = [Double](repeating: 0, count: Int((seconds * rate).rounded())) }
    mutating func add(_ start: Double, _ dur: Double, _ amp: Double, env: Bool = true, _ gen: (Double) -> Double) {
        let i0 = Int((start * rate).rounded())
        let n = Int((dur * rate).rounded())
        for k in 0..<n where i0 + k < s.count {
            let t = Double(k) / rate
            var e = 1.0
            if env {
                e = min(1, t / 0.005)
                e = min(e, max(0, (dur - t) / 0.02))
            }
            s[i0 + k] += amp * e * gen(t)
        }
    }
}
func square(_ f: Double, duty: Double = 0.25) -> (Double) -> Double {
    { t in let p = (t * f).truncatingRemainder(dividingBy: 1); return p < duty ? 1 : -1 }
}
func triangle(_ f: Double) -> (Double) -> Double {
    { t in let p = (t * f).truncatingRemainder(dividingBy: 1); return 4 * abs(p - 0.5) - 1 }
}

func write(_ buf: Buf, _ path: String) {
    var pcm = Data()
    for v in buf.s {
        var i = Int16(max(-1, min(1, tanh(1.2 * v))) * 32767)
        withUnsafeBytes(of: &i) { pcm.append(contentsOf: $0) }
    }
    var h = Data()
    func u32(_ v: UInt32) { var x = v.littleEndian; withUnsafeBytes(of: &x) { h.append(contentsOf: $0) } }
    func u16(_ v: UInt16) { var x = v.littleEndian; withUnsafeBytes(of: &x) { h.append(contentsOf: $0) } }
    h.append("RIFF".data(using: .ascii)!); u32(UInt32(36 + pcm.count))
    h.append("WAVEfmt ".data(using: .ascii)!); u32(16); u16(1); u16(1)
    u32(UInt32(rate)); u32(UInt32(rate) * 2); u16(2); u16(16)
    h.append("data".data(using: .ascii)!); u32(UInt32(pcm.count))
    try! (h + pcm).write(to: URL(fileURLWithPath: path))
}

// chord: (pitch class of root, minor?)
typealias Chord = (pc: Int, minor: Bool)
let C: Chord = (0, false), G: Chord = (7, false), Am: Chord = (9, true), F: Chord = (5, false)
let Dm: Chord = (2, true), Bb: Chord = (10, false), A: Chord = (9, false)

func music(bpm: Double, chords: [Chord], leadAmp: Double, kick: Bool) -> Buf {
    let beat = 60 / bpm
    var b = Buf(seconds: 16 * 4 * beat)
    let arp = [1, 3, 5, 8, 5, 3, 5, 8, 1, 3, 5, 8, 10, 8, 5, 3]
    for bar in 0..<16 {
        let ch = chords[bar % 4]
        let t0 = Double(bar) * 4 * beat
        let third = ch.minor ? 3 : 4
        func off(_ d: Int) -> Int {
            switch d { case 1: return 0; case 3: return third; case 5: return 7; case 8: return 12; default: return 12 + third }
        }
        let base = 72 + ch.pc - (ch.pc >= 7 ? 12 : 0)
        for i in 0..<16 {
            let f = freq(Double(base + off(arp[i])))
            b.add(t0 + Double(i) * beat / 4, beat / 4, leadAmp, square(f))
        }
        let bassBase = 36 + ch.pc - (ch.pc >= 7 ? 12 : 0)
        for i in 0..<8 {
            let f = freq(Double(bassBase + (i % 2 == 0 ? 0 : 12)))
            let st = t0 + Double(i) * beat / 2
            b.add(st, beat / 2, 0.22, triangle(f))
            b.add(st, 0.03, 0.06, env: false) { t in noise() * max(0, 1 - t / 0.03) }
        }
        if kick {
            for bt in [0, 2] {
                b.add(t0 + Double(bt) * beat, 0.12, 0.5, env: false) { t in
                    let f = 150 * pow(45.0 / 150, t / 0.12)
                    // phase of exponential sweep
                    let k = log(45.0 / 150) / 0.12
                    let phase = 2 * Double.pi * 150 * (exp(k * t) - 1) / k
                    _ = f
                    return sin(phase) * max(0, 1 - t / 0.12)
                }
            }
        }
    }
    return b
}

let out = CommandLine.arguments[1]
write(music(bpm: 100, chords: [C, Am, F, G], leadAmp: 0.16 * 0.6, kick: false), out + "/menu.wav")
write(music(bpm: 140, chords: [C, G, Am, F], leadAmp: 0.16, kick: true), out + "/run.wav")

var d = Buf(seconds: 0.35)
d.add(0, 0.35, 0.5, env: false) { t in noise() * exp(-t * 12) }
d.add(0, 0.35, 0.25) { t in
    let k = log(80.0 / 400) / 0.35
    let phase = 400 * (exp(k * t) - 1) / k
    return (phase.truncatingRemainder(dividingBy: 1)) < 0.5 ? 1 : -1
}
write(d, out + "/sfx_crash.wav")

var c = Buf(seconds: 0.2)
c.add(0, 0.06, 0.2, square(freq(83), duty: 0.5))      // B5
c.add(0.06, 0.14, 0.2, square(freq(88), duty: 0.5))   // E6
write(c, out + "/sfx_coin.wav")

var j = Buf(seconds: 0.15)
j.add(0, 0.15, 0.2) { t in
    let k = log(2.0) / 0.15                          // 300 → 600 Hz sweep
    let phase = 300 * (exp(k * t) - 1) / k
    return (phase.truncatingRemainder(dividingBy: 1)) < 0.5 ? 1 : -1
}
write(j, out + "/sfx_jump.wav")
