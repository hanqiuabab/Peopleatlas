import AppKit

// Reproducible vector artwork: three connected people in an orbital atlas.
// Rendering this source creates icon assets only; no user image is read or modified.
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let sizes = [16, 32, 64, 128, 256, 512, 1024]
for size in sizes {
    let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    context.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)
    let bounds = NSRect(x: 0, y: 0, width: 1024, height: 1024)
    NSGradient(starting: NSColor(red: 0.06, green: 0.17, blue: 0.22, alpha: 1), ending: NSColor(red: 0.19, green: 0.43, blue: 0.47, alpha: 1))!.draw(in: bounds, angle: 45)
    let orbit = NSBezierPath(ovalIn: NSRect(x: 162, y: 162, width: 700, height: 700))
    NSColor(white: 1, alpha: 0.18).setStroke(); orbit.lineWidth = 4; orbit.stroke()
    let points = [NSPoint(x: 290, y: 365), NSPoint(x: 734, y: 365), NSPoint(x: 512, y: 719)]
    let lines = NSBezierPath(); lines.move(to: points[0]); lines.line(to: points[1]); lines.line(to: points[2]); lines.close()
    NSColor(red: 0.66, green: 0.86, blue: 0.83, alpha: 0.85).setStroke(); lines.lineWidth = 22; lines.lineCapStyle = .round; lines.lineJoinStyle = .round; lines.stroke()
    for (index, point) in points.enumerated() {
        let radius: CGFloat = index == 2 ? 98 : 80
        let path = NSBezierPath(ovalIn: NSRect(x: point.x - radius, y: point.y - radius, width: 2 * radius, height: 2 * radius))
        (index == 2 ? NSColor(red: 0.95, green: 0.70, blue: 0.39, alpha: 1) : NSColor(red: 0.85, green: 0.95, blue: 0.91, alpha: 1)).setFill(); path.fill()
        NSColor(white: 1, alpha: 0.65).setStroke(); path.lineWidth = 3; path.stroke()
    }
    NSGraphicsContext.restoreGraphicsState()
    let bitmap = NSBitmapImageRep(cgImage: context.makeImage()!)
    try bitmap.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent("icon-\(size).png"))
}
