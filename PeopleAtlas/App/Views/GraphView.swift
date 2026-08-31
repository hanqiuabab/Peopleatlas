import SwiftUI
import Combine
#if os(macOS)
import AppKit
#endif

/// Canvas draws the network; aligned transparent buttons provide native focus and hit targets.
struct GraphView: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("atlas.graphStyle") private var storedStyle = GraphStyle.ring.rawValue
    @AppStorage("atlas.rotation") private var rotation = true
    @State private var graph = GraphViewModel()
    @State private var expanded = false
    @State private var hovered: UUID?
    @State private var visible = false
    @State private var lastTick: Date?
    @State private var suppressTapUntil = Date.distantPast
    #if os(macOS)
    @State private var macFullScreen = false
    @State private var macWindow: NSWindow?
    #endif
    private let timer = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()
    private var style: GraphStyle { GraphStyle(rawValue: storedStyle) ?? .ring }
    private var dark: Bool { style == .planet || style == .nebula || colorScheme == .dark }
    private var workspaceColorScheme: ColorScheme { style == .planet || style == .nebula ? .dark : colorScheme }
    private var showsPersistentLabels: Bool { style == .ring || style == .hierarchy }
    private var isRotating: Bool {
        graph.shouldRotate(enabled: rotation, reduceMotion: reduceMotion, style: style,
                           visibleCount: model.network.people.filter { graph.genders.contains($0.gender) }.count,
                           hasSelection: model.selectedPersonID != nil || model.selectedRelationID != nil)
    }
    var body: some View {
        workspace(fullScreen: false)
            .environment(\.colorScheme, workspaceColorScheme)
            #if os(iOS)
            .toolbarColorScheme(style == .planet || style == .nebula ? .dark : nil, for: .navigationBar, .tabBar)
            #endif
            #if os(macOS)
            .background(MacWindowReader(window: $macWindow).frame(width: 0, height: 0))
            #endif
            #if os(iOS)
            // The cover owns interaction and VoiceOver while the underlying graph is hidden.
            .accessibilityHidden(expanded)
            #endif
            .navigationTitle(model.text("Atlas"))
            .onAppear { visible = true; graph.update(model.network, style: style) }
            .onDisappear { visible = false; lastTick = nil; graph.cancelGestures() }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active { graph.cancelGestures(); lastTick = nil }
            }
            .onChange(of: model.network) { _, network in graph.update(network, style: style) }
            .onChange(of: storedStyle) { _, _ in graph.reset(); graph.update(model.network, style: style) }
            .onReceive(timer) { date in
                defer { lastTick = date }
                guard (visible || expanded), scenePhase == .active, isRotating, let previous = lastTick else { return }
                graph.angle += min(date.timeIntervalSince(previous), 0.1) * 0.15
            }
            #if os(macOS)
            .onReceive(NotificationCenter.default.publisher(for: NSWindow.didEnterFullScreenNotification)) { notification in
                guard let window = notification.object as? NSWindow, window === macWindow else { return }
                macFullScreen = true
            }
            .onReceive(NotificationCenter.default.publisher(for: NSWindow.didExitFullScreenNotification)) { notification in
                guard let window = notification.object as? NSWindow, window === macWindow else { return }
                macFullScreen = false
            }
            #endif
            #if os(iOS)
            .fullScreenCover(isPresented: $expanded) { workspace(fullScreen: true) }
            #endif
    }
    private func workspace(fullScreen: Bool) -> some View {
        VStack(spacing: 0) {
            Picker(model.text("Layout"), selection: $storedStyle) {
                ForEach(GraphStyle.allCases, id: \.self) { Text(model.text($0.rawValue)).tag($0.rawValue) }
            }.pickerStyle(.segmented).padding(16).accessibilityIdentifier("graphLayout")
            filters
            if model.network.people.isEmpty {
                AtlasEmpty(title: "Your atlas starts with one person", detail: "Add people in the People tab to see them here.", symbol: "circle.hexagongrid")
                    .frame(maxHeight: .infinity)
                    .overlay(alignment: .bottomTrailing) {
                        fullScreenControl(fullScreen: fullScreen)
                            .padding(5).background(.regularMaterial, in: Capsule()).padding(16)
                    }
            } else {
                VStack(spacing: 0) {
                    GeometryReader { geometry in
                        canvas(size: geometry.size)
                            .overlay(alignment: .topLeading) { selection.padding(16) }
                    }
                    // Reserve space for controls instead of painting them over nodes or the
                    // gesture hint. On narrow phones the hint can wrap beside the toolbar.
                    HStack(spacing: 12) {
                        Text(model.text("Drag to explore · Pinch to zoom"))
                            .font(.caption.weight(.medium)).foregroundStyle(dark ? .white.opacity(0.85) : .primary)
                            .fixedSize(horizontal: false, vertical: true).allowsHitTesting(false)
                        Spacer(minLength: 0)
                        controls(fullScreen: fullScreen)
                    }.padding(16)
                }.frame(minHeight: 320)
            }
        }
        .background(dark ? Color(red: 0.025, green: 0.055, blue: 0.11) : Color.primary.opacity(0.025))
    }
    private var filters: some View {
        VStack(alignment: .trailing, spacing: 8) {
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                ForEach(Gender.allCases, id: \.self) { gender in
                    chip(model.text(gender.rawValue), active: graph.genders.contains(gender)) { graph.toggleGender(gender); clearHiddenSelection() }
                        .accessibilityIdentifier("graph.filter.\(gender.rawValue)")
                }
                chip(model.text("Relationships"), active: !graph.kinds.isEmpty) { graph.toggleAllRelations(); clearHiddenSelection() }
                    .accessibilityIdentifier("graph.filter.relationships")
            }
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(RelationKind.allCases, id: \.self) { kind in
                        chip(model.title(kind), active: graph.kinds.contains(kind)) { graph.toggleKind(kind); clearHiddenSelection() }
                            .accessibilityIdentifier("graph.filter.\(kind.rawValue)")
                    }
                }
            }.scrollIndicators(.hidden)
        }.padding(.horizontal, 16).padding(.bottom, 12)
    }
    private func chip(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.caption.weight(.medium)).padding(.horizontal, 12).padding(.vertical, 9)
                .background(active ? AtlasDesign.accent : Color.primary.opacity(0.07), in: Capsule())
                .foregroundStyle(active ? .white : (dark ? .white.opacity(0.6) : .secondary))
        }.buttonStyle(.plain).accessibilityAddTraits(active ? [.isSelected] : [])
    }
    private func controls(fullScreen: Bool) -> some View {
        HStack(spacing: 2) {
            if style != .hierarchy {
                control(isRotating ? "pause" : "play", label: isRotating ? "Pause rotation" : "Start rotation") {
                    if model.selectedPersonID != nil || model.selectedRelationID != nil { clearSelection(); rotation = true }
                    else { rotation.toggle() }
                }.disabled(reduceMotion)
            }
            control("minus.magnifyingglass", label: "Zoom out") { graph.setZoom(graph.zoom / 1.2) }
                .disabled(graph.zoom <= 0.4)
            control("plus.magnifyingglass", label: "Zoom in") { graph.setZoom(graph.zoom * 1.2) }
                .disabled(graph.zoom >= 4)
            control("arrow.counterclockwise", label: "Reset view") { graph.reset(); clearSelection() }
            // Presentation state is shared, but only the cover owns an exit button.
            fullScreenControl(fullScreen: fullScreen)
        }.padding(5).background(.regularMaterial, in: Capsule())
    }
    private func fullScreenControl(fullScreen: Bool) -> some View {
        #if os(macOS)
        let presented = macFullScreen
        #else
        let presented = fullScreen
        #endif
        return control(presented ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right",
                       label: presented ? "Close full screen" : "Full screen") {
            #if os(macOS)
            macWindow?.toggleFullScreen(nil)
            #else
            expanded.toggle()
            #endif
        }
    }
    private func control(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(model.text(label), systemImage: symbol)
                .labelStyle(.iconOnly)
                .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
        .accessibilityLabel(model.text(label))
    }
    @ViewBuilder private var selection: some View {
        if let id = model.selectedPersonID, let person = model.network.person(id) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(person.name).font(.headline)
                    Text(model.text(person.gender.rawValue)).font(.caption).foregroundStyle(AtlasDesign.secondaryText)
                }
                Button { clearSelection() } label: { Image(systemName: "xmark.circle.fill") }.accessibilityLabel(model.text("Clear selection"))
            }.padding(12).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        } else if let id = model.selectedRelationID, let edge = model.network.relations.first(where: { $0.id == id }) {
            HStack {
                Text(model.description(edge)).font(.subheadline)
                Button { clearSelection() } label: { Image(systemName: "xmark.circle.fill") }.accessibilityLabel(model.text("Clear selection"))
            }.padding(12).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
    }
    private func projected(_ point: AtlasPoint, size: CGSize) -> CGPoint {
        let angle = style == .hierarchy ? 0 : graph.angle
        let x: Double, y: Double, depth: Double
        if style == .planet {
            x = point.x * cos(angle) + point.z * sin(angle); y = point.y
            depth = 1 + (point.z * cos(angle) - point.x * sin(angle)) * 0.16
        } else {
            x = point.x * cos(angle) - point.y * sin(angle)
            y = point.x * sin(angle) + point.y * cos(angle); depth = 1
        }
        let scale = max(30, min(size.width, size.height) * 0.39) * graph.zoom
        return CGPoint(x: size.width / 2 + x * scale * depth + graph.pan.x, y: size.height / 2 + y * scale * depth + graph.pan.y)
    }
    private func depth(_ point: AtlasPoint) -> Double { style == .planet ? point.z * cos(graph.angle) - point.x * sin(graph.angle) : 0 }
    private func visiblePeople() -> [AtlasPerson] {
        model.network.people.filter { graph.genders.contains($0.gender) }.sorted { depth(graph.positions[$0.id] ?? AtlasPoint(x: 0, y: 0)) < depth(graph.positions[$1.id] ?? AtlasPoint(x: 0, y: 0)) }
    }
    private func canvas(size: CGSize) -> some View {
        let points = graph.positions.mapValues { projected($0, size: size) }
        let pairs = graph.visiblePairs(model.network, selectedPerson: model.selectedPersonID)
        let people = visiblePeople()
        return Canvas { context, canvasSize in
            if style == .planet || style == .nebula { drawAtmosphere(&context, size: canvasSize) }
            for edge in pairs {
                guard let a = points[edge.sourceID], let b = points[edge.targetID] else { continue }
                let selected = model.selectedRelationID == edge.id
                var path = Path(); path.move(to: a); path.addLine(to: b)
                context.stroke(path, with: .color(selected ? AtlasDesign.warm : (dark ? .cyan : AtlasDesign.accent).opacity(0.72)), lineWidth: selected ? 2.5 : 1.4)
            }
            // Reserve node and persistent-name rectangles before placing edge labels.
            // Shared parents create clustered midpoints, so each label tries perpendicular
            // offsets and chooses the lowest-overlap position instead of stacking text.
            var occupied: [CGRect] = people.compactMap { person in
                guard let center = points[person.id] else { return nil }
                let z = depth(graph.positions[person.id] ?? AtlasPoint(x: 0, y: 0))
                let radius = style == .planet ? 9 + 3 * (z + 1) : 12.0
                return CGRect(x: center.x - radius - 5, y: center.y - radius - 5, width: radius * 2 + 10, height: radius * 2 + 10)
            }
            if showsPersistentLabels {
                for person in people {
                    guard let center = points[person.id] else { continue }
                    let resolved = context.resolve(Text(person.name).font(.caption.weight(.semibold)))
                    let size = resolved.measure(in: CGSize(width: 160, height: 40))
                    occupied.append(CGRect(x: center.x - size.width / 2 - 4, y: center.y + 24, width: size.width + 8, height: size.height + 4))
                }
            }
            let bounds = CGRect(origin: .zero, size: canvasSize).insetBy(dx: 6, dy: 6)
            for edge in pairs {
                guard (showsPersistentLabels || model.selectedRelationID == edge.id),
                      let a = points[edge.sourceID], let b = points[edge.targetID] else { continue }
                let selected = model.selectedRelationID == edge.id
                let text = Text(pairTitle(edge)).font(.caption2.weight(selected ? .bold : .medium)).foregroundStyle(dark ? .white : .primary)
                let resolved = context.resolve(text)
                let measured = resolved.measure(in: CGSize(width: 170, height: 50))
                let labelSize = CGSize(width: measured.width + 12, height: measured.height + 7)
                let dx = b.x - a.x, dy = b.y - a.y, length = max(1, hypot(dx, dy))
                let normal = CGVector(dx: -dy / length, dy: dx / length)
                let midpoint = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                let candidates: [CGFloat] = [0, 18, -18, 36, -36, 54, -54]
                func frame(offset: CGFloat) -> CGRect {
                    CGRect(x: midpoint.x + normal.dx * offset - labelSize.width / 2,
                           y: midpoint.y + normal.dy * offset - labelSize.height / 2,
                           width: labelSize.width, height: labelSize.height)
                }
                func overlap(_ rect: CGRect) -> CGFloat {
                    occupied.reduce(0) { result, item in
                        let intersection = rect.intersection(item)
                        return result + (intersection.isNull ? 0 : intersection.width * intersection.height)
                    } + (bounds.contains(rect) ? 0 : 10_000)
                }
                let labelFrame = candidates.map(frame).min { overlap($0) < overlap($1) } ?? frame(offset: 0)
                let badge = Path(roundedRect: labelFrame, cornerRadius: labelFrame.height / 2)
                context.fill(badge, with: .color(dark ? Color.black.opacity(0.72) : Color.white.opacity(0.88)))
                context.draw(resolved, at: CGPoint(x: labelFrame.midX, y: labelFrame.midY))
                occupied.append(labelFrame.insetBy(dx: -3, dy: -3))
            }
            for person in people {
                guard let center = points[person.id] else { continue }
                let selected = model.selectedPersonID == person.id
                let z = depth(graph.positions[person.id] ?? AtlasPoint(x: 0, y: 0))
                let radius = style == .planet ? 9 + 3 * (z + 1) : 12.0
                let color: Color = person.gender == .male ? (dark ? .cyan : AtlasDesign.accent) : (dark ? .pink : AtlasDesign.warm)
                let circle = Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
                var glow = context
                if dark { glow.addFilter(.shadow(color: color.opacity(0.6), radius: 9)) }
                glow.fill(circle, with: .radialGradient(Gradient(colors: [color.opacity(0.98), color.opacity(0.78)]), center: CGPoint(x: center.x - 3, y: center.y - 3), startRadius: 0, endRadius: radius * 2))
                if selected {
                    context.stroke(Path(ellipseIn: CGRect(x: center.x - radius - 5, y: center.y - radius - 5, width: radius * 2 + 10, height: radius * 2 + 10)), with: .color(dark ? .white : AtlasDesign.accent), lineWidth: 2)
                }
            }
            // Names are foreground annotations: later/deeper nodes must not paint over
            // the selected person's label. The selection outline still surrounds only the node.
            for person in people where showsPersistentLabels || model.selectedPersonID == person.id || hovered == person.id {
                if let center = points[person.id] {
                    let z = depth(graph.positions[person.id] ?? AtlasPoint(x: 0, y: 0))
                    let radius = style == .planet ? 9 + 3 * (z + 1) : 12.0
                    context.draw(Text(person.name).font(.caption.weight(.semibold)).foregroundStyle(dark ? .white : .primary), at: CGPoint(x: center.x, y: center.y + radius + 19))
                }
            }
        }
        .accessibilityHidden(true)
        .contentShape(Rectangle())
        .gesture(SpatialTapGesture().onEnded { tap in
            guard Date.now >= suppressTapUntil else { return }
            select(at: tap.location, points: points, people: people, pairs: pairs)
        })
        .overlay {
            ZStack {
                ForEach(pairs) { edge in
                    if let a = points[edge.sourceID], let b = points[edge.targetID] {
                        Button { guard Date.now >= suppressTapUntil else { return }; toggleRelation(edge.id) } label: {
                            Color.clear.frame(width: 28, height: 28).contentShape(Circle())
                        }
                        .buttonStyle(.plain).position(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                        .accessibilityLabel(model.description(edge)).accessibilityIdentifier("graphEdge.\(edge.id)")
                    }
                }
                ForEach(people) { person in
                    if let point = points[person.id] {
                        Button { guard Date.now >= suppressTapUntil else { return }; togglePerson(person.id) } label: {
                            Color.clear.frame(width: 44, height: 44).contentShape(Circle())
                        }
                        .buttonStyle(.plain).position(point)
                        .accessibilityLabel(person.name).accessibilityIdentifier("graphPerson.\(person.id)")
                        .accessibilityAddTraits(model.selectedPersonID == person.id ? [.isSelected] : [])
                        // The transparent button owns pointer hit testing, so canvas-level
                        // hover alone cannot observe the pointer while it is over a node.
                        .onHover { inside in
                            if inside { hovered = person.id }
                            else if hovered == person.id { hovered = nil }
                        }
                    }
                }
            }
        }
        .simultaneousGesture(DragGesture(minimumDistance: 8).onChanged { value in
            suppressTapUntil = .distantFuture
            graph.drag(translation: AtlasPoint(x: value.translation.width, y: value.translation.height), style: style)
        }.onEnded { _ in graph.endDrag(); suppressTapUntil = .now.addingTimeInterval(0.2) })
        .simultaneousGesture(MagnifyGesture().onChanged { value in
            suppressTapUntil = .distantFuture
            graph.magnify(value.magnification)
        }.onEnded { _ in graph.endMagnification(); suppressTapUntil = .now.addingTimeInterval(0.2) })
        .onContinuousHover { phase in
            switch phase {
            case .active(let location): hovered = hitPerson(location, points: points, people: people)
            case .ended: hovered = nil
            }
        }
        #if os(macOS)
        .overlay {
            MacWheelZoom { delta in graph.setZoom(graph.zoom * exp(delta * 0.01)) }
                .accessibilityHidden(true)
        }
        #endif
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("relationshipGraph")
    }
    private func drawAtmosphere(_ context: inout GraphicsContext, size: CGSize) {
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = min(size.width, size.height) * 0.48
        context.fill(Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)), with: .radialGradient(Gradient(colors: [.cyan.opacity(0.12), .clear]), center: center, startRadius: 0, endRadius: radius))
        if style == .planet {
            for flattening in [0.25, 0.6, 1.0] {
                let rect = CGRect(x: center.x - radius * 0.8, y: center.y - radius * 0.8 * flattening, width: radius * 1.6, height: radius * 1.6 * flattening)
                context.stroke(Path(ellipseIn: rect), with: .color(.cyan.opacity(0.07)), lineWidth: 1)
            }
        }
    }
    private func pairTitle(_ edge: AtlasRelation) -> String {
        guard let target = model.network.person(edge.targetID) else { return model.title(edge.kind) }
        let inverse = edge.kind.inverse(targetGender: target.gender)
        let forwardTitle = model.title(edge.kind), inverseTitle = model.title(inverse)
        return forwardTitle == inverseTitle ? forwardTitle : "\(forwardTitle) ↔ \(inverseTitle)"
    }
    private func hitPerson(_ location: CGPoint, points: [UUID: CGPoint], people: [AtlasPerson]) -> UUID? {
        people.reversed().first { person in
            guard let p = points[person.id] else { return false }
            return hypot(location.x - p.x, location.y - p.y) < 24
        }?.id
    }
    private func select(at location: CGPoint, points: [UUID: CGPoint], people: [AtlasPerson], pairs: [AtlasRelation]) {
        if let id = hitPerson(location, points: points, people: people) { togglePerson(id); return }
        let closest = pairs.compactMap { edge -> (UUID, Double)? in
            guard let a = points[edge.sourceID], let b = points[edge.targetID] else { return nil }
            let dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy
            guard length > 0 else { return nil }
            let t = min(1, max(0, ((location.x - a.x) * dx + (location.y - a.y) * dy) / length))
            return (edge.id, hypot(location.x - a.x - t * dx, location.y - a.y - t * dy))
        }.min { $0.1 < $1.1 }
        if let closest, closest.1 < 12 { toggleRelation(closest.0) } else { clearSelection() }
    }
    private func togglePerson(_ id: UUID) { model.selectedPersonID = model.selectedPersonID == id ? nil : id; model.selectedRelationID = nil }
    private func toggleRelation(_ id: UUID) { model.selectedRelationID = model.selectedRelationID == id ? nil : id; model.selectedPersonID = nil }
    private func clearSelection() { model.selectedPersonID = nil; model.selectedRelationID = nil }
    private func clearHiddenSelection() {
        if let id = model.selectedPersonID, let person = model.network.person(id), !graph.genders.contains(person.gender) { model.selectedPersonID = nil }
        if let id = model.selectedRelationID, !graph.visiblePairs(model.network, selectedPerson: nil).contains(where: { $0.id == id }) { model.selectedRelationID = nil }
    }
}

#if os(macOS)
/// Captures the window that owns this graph so fullscreen notifications from another
/// document window cannot change this graph's toolbar state.
private struct MacWindowReader: NSViewRepresentable {
    @Binding var window: NSWindow?

    func makeNSView(context: Context) -> WindowTrackingView {
        let view = WindowTrackingView()
        let binding = _window
        view.onWindowChange = { newWindow in
            DispatchQueue.main.async {
                if binding.wrappedValue !== newWindow {
                    binding.wrappedValue = newWindow
                }
            }
        }
        return view
    }

    func updateNSView(_ nsView: WindowTrackingView, context: Context) {
        nsView.reportWindow()
    }

    final class WindowTrackingView: NSView {
        var onWindowChange: ((NSWindow?) -> Void)?

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            reportWindow()
        }

        func reportWindow() {
            onWindowChange?(window)
        }
    }
}
#endif
