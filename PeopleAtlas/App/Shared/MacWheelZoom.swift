#if os(macOS)
import SwiftUI
import AppKit

/// Only wheel events inside this view are consumed. Clicks continue to SwiftUI node buttons.
struct MacWheelZoom: NSViewRepresentable {
    var onScroll: (Double) -> Void
    func makeNSView(context: Context) -> WheelView { WheelView() }
    func updateNSView(_ view: WheelView, context: Context) { view.onScroll = onScroll }
    final class WheelView: NSView {
        var onScroll: ((Double) -> Void)?
        override func hitTest(_ point: NSPoint) -> NSView? {
            guard NSApp.currentEvent?.type == .scrollWheel else { return nil }
            return super.hitTest(point)
        }
        override func scrollWheel(with event: NSEvent) { onScroll?(Double(event.scrollingDeltaY)) }
    }
}
#endif
