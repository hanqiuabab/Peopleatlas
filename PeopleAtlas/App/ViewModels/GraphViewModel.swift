import Foundation
import Observation

@Observable @MainActor final class GraphViewModel {
    var genders = Set(Gender.allCases)
    var kinds = Set(RelationKind.allCases)
    var positions: [UUID: AtlasPoint] = [:]
    var angle: Double = 0
    private(set) var zoom: Double = 1
    var pan = AtlasPoint(x: 0, y: 0)
    private var dragStart: (pan: AtlasPoint, angle: Double)?
    private var magnificationStart: Double?
    var isInteracting: Bool { dragStart != nil || magnificationStart != nil }
    func toggleGender(_ gender: Gender) { if genders.contains(gender) { genders.remove(gender) } else { genders.insert(gender) } }
    func toggleKind(_ kind: RelationKind) { if kinds.contains(kind) { kinds.remove(kind) } else { kinds.insert(kind) } }
    func toggleAllRelations() { kinds = kinds.isEmpty ? Set(RelationKind.allCases) : [] }
    func reset() { cancelGestures(); zoom = 1; angle = 0; pan = AtlasPoint(x: 0, y: 0) }
    /// Gestures use the viewport at their start, not the previous event's value; otherwise
    /// cumulative drag/pinch events accelerate unexpectedly. Overlapping gestures pause rotation.
    func drag(translation: AtlasPoint, style: GraphStyle) {
        guard translation.x.isFinite, translation.y.isFinite else { return }
        if dragStart == nil { dragStart = (pan, angle) }
        guard let start = dragStart else { return }
        if style == .planet { angle = start.angle + translation.x * 0.008 }
        else { pan = AtlasPoint(x: start.pan.x + translation.x, y: start.pan.y + translation.y) }
    }
    func endDrag() { dragStart = nil }
    func magnify(_ scale: Double) {
        guard scale.isFinite, scale > 0 else { return }
        if magnificationStart == nil { magnificationStart = zoom }
        setZoom((magnificationStart ?? zoom) * scale)
    }
    func endMagnification() { magnificationStart = nil }
    func cancelGestures() { endDrag(); endMagnification() }
    func setZoom(_ value: Double) {
        guard value.isFinite else { return }
        zoom = min(4, max(0.4, value))
    }
    func shouldRotate(enabled: Bool, reduceMotion: Bool, style: GraphStyle, visibleCount: Int, hasSelection: Bool) -> Bool {
        enabled && !reduceMotion && style != .hierarchy && visibleCount > 1 && !hasSelection && !isInteracting
    }
    func update(_ network: AtlasSnapshot, style: GraphStyle) { positions = GraphLayout.positions(network, style: style) }
    /// Either direction being enabled makes the single physical pair visible.
    func visiblePairs(_ network: AtlasSnapshot, selectedPerson: UUID?) -> [AtlasRelation] {
        network.pairs.filter { edge in
            guard let source = network.person(edge.sourceID), let target = network.person(edge.targetID),
                  genders.contains(source.gender), genders.contains(target.gender) else { return false }
            return (kinds.contains(edge.kind) || kinds.contains(edge.kind.inverse(targetGender: target.gender)))
                && (selectedPerson == nil || edge.sourceID == selectedPerson || edge.targetID == selectedPerson)
        }
    }
}
