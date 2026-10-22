import AppKit

// 1024×1024 app icon with NO alpha channel (App Store Connect rejects alpha).
let size = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                           samplesPerPixel: 3, hasAlpha: false, isPlanar: false,
                           colorSpaceName: .calibratedRGB, bytesPerRow: 0, bitsPerPixel: 32)!
func hex(_ v: Int) -> NSColor {
    NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
}
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
hex(0x38BDF8).setFill(); NSRect(x: 0, y: 0, width: size, height: size).fill()          // sky
hex(0x4ADE80).setFill(); NSRect(x: 0, y: 0, width: size, height: 560).fill()           // grass
let road = NSBezierPath()                                                               // road in perspective
road.move(to: NSPoint(x: 60, y: 0)); road.line(to: NSPoint(x: 964, y: 0))
road.line(to: NSPoint(x: 600, y: 560)); road.line(to: NSPoint(x: 424, y: 560)); road.close()
hex(0x475569).setFill(); road.fill()
hex(0xFFFFFF).setStroke()
for (bottom, top) in [(361.0, 483.0), (663.0, 541.0)] {                                // lane lines
    let line = NSBezierPath(); line.lineWidth = 18
    line.move(to: NSPoint(x: bottom, y: 0)); line.line(to: NSPoint(x: top, y: 560)); line.stroke()
}
hex(0xFACC15).setFill(); NSBezierPath(ovalIn: NSRect(x: 362, y: 600, width: 300, height: 300)).fill()   // coin
hex(0xF59E0B).setFill(); NSBezierPath(ovalIn: NSRect(x: 422, y: 660, width: 180, height: 180)).fill()
hex(0xF97316).setFill(); NSBezierPath(roundedRect: NSRect(x: 432, y: 120, width: 160, height: 260), xRadius: 60, yRadius: 60).fill()  // runner
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
