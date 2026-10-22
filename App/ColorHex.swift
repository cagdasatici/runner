import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// Chunky, toy-like button: gradient face, darker "base" under it that the face presses into.
struct ChunkyButtonStyle: ButtonStyle {
    let top: UInt32
    let bottom: UInt32
    let base: UInt32
    var width: CGFloat = 240
    var height: CGFloat = 76

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        return ZStack {
            RoundedRectangle(cornerRadius: 26).fill(Color(hex: base))
                .frame(width: width, height: height)
                .offset(y: 7)
            configuration.label
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.25), radius: 0, x: 0, y: 2)
                .frame(width: width, height: height)
                .background(
                    LinearGradient(colors: [Color(hex: top), Color(hex: bottom)], startPoint: .top, endPoint: .bottom),
                    in: RoundedRectangle(cornerRadius: 26))
                .overlay(RoundedRectangle(cornerRadius: 26).stroke(.white.opacity(0.85), lineWidth: 3))
                .offset(y: pressed ? 6 : 0)
        }
        .frame(width: width, height: height + 8)
        .animation(.spring(response: 0.18, dampingFraction: 0.6), value: pressed)
    }
}

/// Gold coin icon drawn with SwiftUI shapes.
struct CoinIcon: View {
    var size: CGFloat = 26
    var body: some View {
        ZStack {
            Circle().fill(LinearGradient(colors: [Color(hex: 0xFDE047), Color(hex: 0xF59E0B)], startPoint: .top, endPoint: .bottom))
            Circle().stroke(Color(hex: 0xB45309), lineWidth: size * 0.1)
            Circle().fill(Color(hex: 0xFBBF24)).frame(width: size * 0.5, height: size * 0.5)
                .overlay(Circle().stroke(Color(hex: 0xD97706), lineWidth: size * 0.06))
        }
        .frame(width: size, height: size)
    }
}

/// Big outlined title text (white fill, dark outline, orange drop).
struct OutlinedTitle: View {
    let text: String
    var size: CGFloat = 72
    var body: some View {
        let font = Font.system(size: size, weight: .black, design: .rounded)
        ZStack {
            Text(text).font(font).foregroundStyle(Color(hex: 0xEA580C)).offset(y: size * 0.09)
            ForEach(0..<8, id: \.self) { i in
                let a = Double(i) / 8 * 2 * .pi
                Text(text).font(font).foregroundStyle(Color(hex: 0x1E1B4B))
                    .offset(x: cos(a) * size * 0.05, y: sin(a) * size * 0.05)
            }
            Text(text).font(font)
                .foregroundStyle(LinearGradient(colors: [.white, Color(hex: 0xFEF08A)], startPoint: .top, endPoint: .bottom))
        }
    }
}
