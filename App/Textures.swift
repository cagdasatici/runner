import UIKit

/// All images are drawn in code at launch (no downloaded art). Each is made once and cached.
enum Tex {
    static func color(_ hex: UInt32, _ a: CGFloat = 1) -> UIColor {
        UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255, alpha: a)
    }

    private static func draw(_ w: Int, _ h: Int, _ body: (CGContext, CGSize) -> Void) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format).image { ctx in
            body(ctx.cgContext, CGSize(width: w, height: h))
        }
    }

    /// Fixed-seed noise so textures look the same every launch.
    private struct Noise {
        var s: UInt64
        mutating func next() -> CGFloat {
            s = s &* 6364136223846793005 &+ 1442695040888963407
            return CGFloat((s >> 33) % 10_000) / 10_000
        }
    }

    /// Sky: deep blue at the top, warm peach at the horizon, soft haze below. Used as an equirectangular background.
    static let sky: UIImage = draw(1024, 512) { c, size in
        let colors = [color(0x1D4ED8).cgColor, color(0x38BDF8).cgColor, color(0xBAE6FD).cgColor,
                      color(0xFDE68A).cgColor, color(0xFBCFE8).cgColor] as CFArray
        let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.3, 0.44, 0.5, 1])!
        c.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        // a few soft clouds above the horizon
        var n = Noise(s: 7)
        for _ in 0..<18 {
            let x = n.next() * size.width, y = 196 + n.next() * 44, r = 6 + n.next() * 10
            color(0xFFFFFF, 0.7).setFill()
            for k in 0..<5 {
                c.fillEllipse(in: CGRect(x: x + CGFloat(k) * r * 1.1, y: y - CGFloat(k % 2) * r * 0.4, width: r * 2.4, height: r * 0.9))
            }
        }
    }

    /// Track bed gravel: grey with lots of small stones.
    static let gravel: UIImage = draw(256, 256) { c, size in
        color(0x6B6F76).setFill(); c.fill(CGRect(origin: .zero, size: size))
        var n = Noise(s: 11)
        for _ in 0..<1800 {
            let v = 0.35 + n.next() * 0.45
            UIColor(white: v, alpha: 1).setFill()
            let r = 2 + n.next() * 5
            c.fillEllipse(in: CGRect(x: n.next() * size.width, y: n.next() * size.height, width: r, height: r * 0.8))
        }
    }

    /// Wooden sleeper: warm brown with grain lines.
    static let wood: UIImage = draw(256, 64) { c, size in
        color(0x7C4A21).setFill(); c.fill(CGRect(origin: .zero, size: size))
        var n = Noise(s: 3)
        for _ in 0..<40 {
            color(n.next() > 0.5 ? 0x5B3416 : 0x96612F, 0.7).setStroke()
            c.setLineWidth(1 + n.next() * 2)
            let y = n.next() * size.height
            c.move(to: CGPoint(x: 0, y: y))
            c.addCurve(to: CGPoint(x: size.width, y: y + (n.next() - 0.5) * 10),
                       control1: CGPoint(x: 80, y: y + 6), control2: CGPoint(x: 170, y: y - 6))
            c.strokePath()
        }
    }

    /// Building facade: wall colour with a grid of lit and unlit windows. One texture = 4 floors × 4 windows.
    static let buildingColors: [UInt32] = [0xF87171, 0xFBBF24, 0x34D399, 0x60A5FA, 0xA78BFA, 0xF472B6, 0xFB923C, 0x2DD4BF]
    /// One facade per building colour, made once (static lets are thread-safe; segments are built on the render thread).
    static let facades: [UIImage] = buildingColors.map(facade)

    private static func facade(_ wall: UInt32) -> UIImage {
        draw(256, 256) { c, size in
            color(wall).setFill(); c.fill(CGRect(origin: .zero, size: size))
            var n = Noise(s: UInt64(wall))
            for row in 0..<4 {
                // floor line
                color(0x000000, 0.12).setFill()
                c.fill(CGRect(x: 0, y: CGFloat(row) * 64 + 60, width: size.width, height: 4))
                for col in 0..<4 {
                    let r = CGRect(x: CGFloat(col) * 64 + 14, y: CGFloat(row) * 64 + 12, width: 36, height: 40)
                    color(0xFFFFFF, 0.85).setFill(); c.fill(r.insetBy(dx: -3, dy: -3))      // frame
                    color(n.next() > 0.7 ? 0xFDE68A : 0x1E3A5F).setFill(); c.fill(r)    // glass
                    color(0xFFFFFF, 0.25).setFill(); c.fill(CGRect(x: r.minX + 4, y: r.minY + 4, width: 8, height: r.height - 8))
                }
            }
        }
    }

    /// Diagonal warning stripes (two colours).
    static func stripes(_ a: UInt32, _ b: UInt32) -> UIImage {
        draw(256, 64) { c, size in
            color(a).setFill(); c.fill(CGRect(origin: .zero, size: size))
            color(b).setFill()
            var x: CGFloat = -64
            while x < size.width + 64 {
                c.move(to: CGPoint(x: x, y: size.height)); c.addLine(to: CGPoint(x: x + 32, y: size.height))
                c.addLine(to: CGPoint(x: x + 96, y: 0)); c.addLine(to: CGPoint(x: x + 64, y: 0)); c.closePath(); c.fillPath()
                x += 64
            }
        }
    }

    /// Train side: white body, blue window band, red stripe, grey skirt. Texture spans the whole 10 m side.
    static let trainSide: UIImage = draw(1024, 256) { c, size in
        color(0xF8FAFC).setFill(); c.fill(CGRect(origin: .zero, size: size))
        color(0x1E40AF).setFill(); c.fill(CGRect(x: 0, y: 52, width: size.width, height: 70))
        for i in 0..<9 {                                   // windows
            color(0x93C5FD).setFill()
            let r = CGRect(x: 30 + CGFloat(i) * 110, y: 60, width: 80, height: 54)
            c.addPath(UIBezierPath(roundedRect: r, cornerRadius: 10).cgPath); c.fillPath()
            color(0xFFFFFF, 0.5).setFill(); c.fill(CGRect(x: r.minX + 8, y: r.minY + 6, width: 14, height: r.height - 12))
        }
        color(0xEF4444).setFill(); c.fill(CGRect(x: 0, y: 140, width: size.width, height: 22))
        color(0xFACC15).setFill(); c.fill(CGRect(x: 0, y: 166, width: size.width, height: 6))
        for d in [300.0, 700.0] {                          // doors
            color(0x94A3B8).setStroke(); c.setLineWidth(5)
            c.stroke(CGRect(x: d, y: 40, width: 70, height: 170))
        }
        color(0x475569).setFill(); c.fill(CGRect(x: 0, y: 214, width: size.width, height: 42))
    }

    /// Train front: windscreen, destination sign, red stripe, headlight housings.
    static let trainFront: UIImage = draw(256, 384) { c, size in
        color(0xF8FAFC).setFill(); c.fill(CGRect(origin: .zero, size: size))
        color(0x0F172A).setFill()
        c.addPath(UIBezierPath(roundedRect: CGRect(x: 26, y: 60, width: 204, height: 120), cornerRadius: 22).cgPath); c.fillPath()
        color(0x60A5FA, 0.5).setFill(); c.fill(CGRect(x: 40, y: 72, width: 40, height: 96))
        color(0x111827).setFill(); c.fill(CGRect(x: 60, y: 20, width: 136, height: 30))
        color(0xF59E0B).setFill(); c.fill(CGRect(x: 72, y: 28, width: 112, height: 14))
        color(0xEF4444).setFill(); c.fill(CGRect(x: 0, y: 210, width: size.width, height: 30))
        color(0x1E40AF).setFill(); c.fill(CGRect(x: 0, y: 244, width: size.width, height: 10))
        color(0x334155).setFill()
        c.fillEllipse(in: CGRect(x: 30, y: 270, width: 56, height: 40)); c.fillEllipse(in: CGRect(x: 170, y: 270, width: 56, height: 40))
        color(0x475569).setFill(); c.fill(CGRect(x: 0, y: 330, width: size.width, height: 54))
    }

    /// Soft round dot for particles (white, alpha falloff). Not opaque.
    static let dot: UIImage = {
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
        return UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64), format: format).image { ctx in
            let colors = [UIColor.white.cgColor, UIColor.white.withAlphaComponent(0).cgColor] as CFArray
            let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
            ctx.cgContext.drawRadialGradient(g, startCenter: CGPoint(x: 32, y: 32), startRadius: 0,
                                             endCenter: CGPoint(x: 32, y: 32), endRadius: 32, options: [])
        }
    }()
}
