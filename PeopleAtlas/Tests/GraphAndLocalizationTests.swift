import XCTest
@testable import PeopleAtlas

final class GraphAndLocalizationTests: XCTestCase {
    private func people(_ count: Int) -> [AtlasPerson] {
        (0..<count).map {
            AtlasPerson(id: UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", $0 + 1))!,
                        name: "P\($0)", gender: $0.isMultiple(of: 2) ? .male : .female)
        }
    }
    private func distance(_ a: AtlasPoint, _ b: AtlasPoint) -> Double {
        sqrt(pow(a.x - b.x, 2) + pow(a.y - b.y, 2) + pow(a.z - b.z, 2))
    }
    func testFamilyRelaxationKeepsClearanceAndSphereShape() throws {
        for count in [8, 60, 180] {
            let people = people(count)
            var network = AtlasSnapshot(people: people)
            for index in stride(from: 0, to: count, by: 2) {
                network = try AtlasRules.adding(RelationDraft(sourceID: people[index].id, targetID: people[index + 1].id, kind: .husband), to: network)
            }
            for style in [GraphStyle.planet, .nebula] {
                let points = GraphLayout.positions(network, style: style)
                XCTAssertEqual(points, GraphLayout.positions(network, style: style))
                let clearance = GraphLayout.minimumSpacing(count: count, style: style)
                for (index, person) in people.enumerated() {
                    let point = try XCTUnwrap(points[person.id])
                    if style == .planet { XCTAssertEqual(distance(point, AtlasPoint(x: 0, y: 0)), 1, accuracy: 0.000001) }
                    for other in people.dropFirst(index + 1) {
                        XCTAssertGreaterThanOrEqual(distance(point, try XCTUnwrap(points[other.id])), clearance * 0.9,
                                                    "\(style) at \(count) people must not collapse nearby nodes")
                    }
                }
                let baseline = GraphLayout.positions(AtlasSnapshot(people: people), style: style)
                let before = stride(from: 0, to: count, by: 2).reduce(0.0) {
                    $0 + distance(baseline[people[$1].id]!, baseline[people[$1 + 1].id]!)
                }
                let after = stride(from: 0, to: count, by: 2).reduce(0.0) {
                    $0 + distance(points[people[$1].id]!, points[people[$1 + 1].id]!)
                }
                XCTAssertLessThan(after, before, "Separation must preserve the family proximity improvement")
            }
        }
    }
    func testFamilyOrderingHandlesTenThousandPersonChainWithoutRecursion() {
        let people = people(10_000)
        var edges: [AtlasRelation] = []
        for index in 1..<people.count {
            let forward = UUID(), inverse = UUID()
            edges.append(AtlasRelation(id: forward, inverseID: inverse, sourceID: people[index - 1].id, targetID: people[index].id, kind: .colleague))
            edges.append(AtlasRelation(id: inverse, inverseID: forward, sourceID: people[index].id, targetID: people[index - 1].id, kind: .colleague))
        }
        XCTAssertEqual(GraphLayout.orderedIDs(AtlasSnapshot(people: people, relations: edges)), people.map(\.id))
    }
    @MainActor func testRotationPausesForSelectionAndOverlappingGesturesWithoutLosingManualPause() {
        let graph = GraphViewModel()
        func rotating(enabled: Bool = true, reduced: Bool = false, style: GraphStyle = .planet, count: Int = 8, selected: Bool = false) -> Bool {
            graph.shouldRotate(enabled: enabled, reduceMotion: reduced, style: style, visibleCount: count, hasSelection: selected)
        }
        XCTAssertTrue(rotating())
        XCTAssertFalse(rotating(enabled: false)); XCTAssertFalse(rotating(reduced: true))
        XCTAssertFalse(rotating(style: .hierarchy)); XCTAssertFalse(rotating(count: 1)); XCTAssertFalse(rotating(count: 0))
        XCTAssertFalse(rotating(selected: true))
        graph.drag(translation: AtlasPoint(x: 10, y: 20), style: .planet)
        XCTAssertFalse(rotating())
        graph.magnify(1.2); graph.endDrag()
        XCTAssertFalse(rotating(), "Finishing a drag must not resume rotation while a pinch is still active")
        graph.endMagnification()
        XCTAssertTrue(rotating()); XCTAssertFalse(rotating(enabled: false))
        graph.magnify(1.2); graph.cancelGestures()
        XCTAssertTrue(rotating(), "Leaving the screen or backgrounding cancels an interrupted gesture")
    }
    @MainActor func testViewportGesturesUseStartValuesClampZoomAndReset() {
        let graph = GraphViewModel()
        graph.angle = 0.5
        graph.drag(translation: AtlasPoint(x: 10, y: 200), style: .planet)
        graph.drag(translation: AtlasPoint(x: 20, y: 300), style: .planet)
        XCTAssertEqual(graph.angle, 0.66, accuracy: 0.000001)
        XCTAssertEqual(graph.pan, AtlasPoint(x: 0, y: 0))
        graph.endDrag()
        for style in [GraphStyle.ring, .hierarchy, .nebula] {
            graph.reset()
            graph.drag(translation: AtlasPoint(x: 10, y: 20), style: style)
            graph.drag(translation: AtlasPoint(x: 30, y: 40), style: style)
            XCTAssertEqual(graph.pan, AtlasPoint(x: 30, y: 40))
            graph.endDrag()
        }
        graph.reset(); graph.magnify(1.2); graph.magnify(1.5)
        XCTAssertEqual(graph.zoom, 1.5)
        graph.endMagnification(); graph.magnify(2)
        XCTAssertEqual(graph.zoom, 3)
        graph.magnify(100); XCTAssertEqual(graph.zoom, 4)
        graph.magnify(0.001); XCTAssertEqual(graph.zoom, 0.4)
        graph.magnify(.nan); graph.setZoom(.infinity); XCTAssertEqual(graph.zoom, 0.4)
        graph.reset()
        XCTAssertFalse(graph.isInteracting); XCTAssertEqual(graph.zoom, 1)
        XCTAssertEqual(graph.angle, 0); XCTAssertEqual(graph.pan, AtlasPoint(x: 0, y: 0))
    }
    func testLevelsRespectParentAndColleagueWhileIsolatedIsMinusOne() throws {
        let a = AtlasPerson(name: "Parent", gender: .male), b = AtlasPerson(name: "Child", gender: .female)
        let c = AtlasPerson(name: "Colleague", gender: .male), isolated = AtlasPerson(name: "Alone", gender: .female)
        var network = AtlasSnapshot(people: [a, b, c, isolated])
        network = try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: b.id, kind: .father), to: network)
        network = try AtlasRules.adding(RelationDraft(sourceID: b.id, targetID: c.id, kind: .colleague), to: network)
        let levels = GraphLayout.levels(network)
        XCTAssertEqual(levels[a.id], (levels[b.id] ?? 0) + 1)
        XCTAssertEqual(levels[b.id], levels[c.id])
        XCTAssertEqual(levels[isolated.id], -1)
        let positions = GraphLayout.positions(network, style: .hierarchy)
        XCTAssertLessThan(try XCTUnwrap(positions[a.id]?.y), try XCTUnwrap(positions[b.id]?.y))
    }
    func testAllLayoutsAreFiniteStableAndIncludeEveryPerson() throws {
        let network = AtlasSnapshot(people: (0..<24).map { AtlasPerson(name: "P\($0)", gender: $0.isMultiple(of: 2) ? .male : .female) })
        for style in GraphStyle.allCases {
            let points = GraphLayout.positions(network, style: style)
            XCTAssertEqual(points.count, network.people.count)
            XCTAssertEqual(points, GraphLayout.positions(network, style: style))
            XCTAssertTrue(points.values.allSatisfy { $0.x.isFinite && $0.y.isFinite && $0.z.isFinite })
            XCTAssertTrue(GraphLayout.positions(AtlasSnapshot(), style: style).isEmpty)
        }
    }
    @MainActor func testFilterMasterAndChildrenAndInverseSemantics() async throws {
        let a = AtlasPerson(name: "Father", gender: .male), b = AtlasPerson(name: "Daughter", gender: .female)
        let network = try AtlasRules.adding(RelationDraft(sourceID: b.id, targetID: a.id, kind: .daughter), to: AtlasSnapshot(people: [a, b]))
        let graph = GraphViewModel()
        graph.toggleAllRelations(); XCTAssertTrue(graph.visiblePairs(network, selectedPerson: nil).isEmpty)
        graph.toggleKind(.father); XCTAssertEqual(graph.visiblePairs(network, selectedPerson: nil).count, 1)
        graph.toggleGender(.female); XCTAssertTrue(graph.visiblePairs(network, selectedPerson: nil).isEmpty)
        graph.toggleGender(.female)
        XCTAssertTrue(graph.visiblePairs(network, selectedPerson: UUID()).isEmpty)
        XCTAssertEqual(graph.visiblePairs(network, selectedPerson: b.id).count, 1)
        graph.toggleAllRelations(); XCTAssertTrue(graph.kinds.isEmpty)
        graph.toggleAllRelations(); XCTAssertEqual(graph.kinds.count, 11)
    }
    func testLocalizationResourcesIncludeRelationshipsAndCoreActions() {
        XCTAssertEqual(L10n.text("People", language: .chinese), "人物")
        XCTAssertEqual(L10n.text("olderSister", language: .english), "Older sister")
        XCTAssertEqual(L10n.text("System appearance", language: .chinese), "跟随系统")
        XCTAssertEqual(L10n.text("System", language: .chinese), "跟随系统")
        XCTAssertEqual(L10n.text("Privacy policy", language: .chinese), "隐私政策")
        XCTAssertEqual(L10n.text("Where your data is stored", language: .chinese), "数据保存在哪里")
        XCTAssertEqual(L10n.text("iCloud sync", language: .chinese), "iCloud 同步")
        XCTAssertNil(AppAppearance.system.colorScheme)
        XCTAssertEqual(AppAppearance.light.colorScheme, .light)
        XCTAssertEqual(AppAppearance.dark.colorScheme, .dark)
        for kind in RelationKind.allCases {
            XCTAssertNotEqual(L10n.text(kind.rawValue, language: .chinese), kind.rawValue)
        }
    }
    func testBothLanguagesContainTheSameNonemptyStrings() throws {
        func catalog(_ language: String) throws -> [String: String] {
            let url = try XCTUnwrap(Bundle.main.url(forResource: "Localizable", withExtension: "strings", subdirectory: nil, localization: language))
            return try XCTUnwrap(PropertyListSerialization.propertyList(from: Data(contentsOf: url), format: nil) as? [String: String])
        }
        let english = try catalog("en"), chinese = try catalog("zh-Hans")
        XCTAssertFalse(english.isEmpty)
        XCTAssertEqual(Set(english.keys), Set(chinese.keys), "Every user-visible key must have both translations")
        for (language, strings) in [("en", english), ("zh-Hans", chinese)] {
            for (key, value) in strings {
                XCTAssertFalse(value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "Empty \(language) translation: \(key)")
            }
        }
    }
    @MainActor func testHierarchyRemainsActiveAndRecomputesAfterRelationshipChanges() async throws {
        let a = AtlasPerson(name: "A", gender: .male), b = AtlasPerson(name: "B", gender: .female)
        let empty = AtlasSnapshot(people: [a, b])
        let graph = GraphViewModel()
        graph.update(empty, style: .hierarchy)
        XCTAssertEqual(graph.positions[a.id]?.y, graph.positions[b.id]?.y)
        let linked = try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: b.id, kind: .father), to: empty)
        graph.update(linked, style: .hierarchy)
        XCTAssertLessThan(try XCTUnwrap(graph.positions[a.id]?.y), try XCTUnwrap(graph.positions[b.id]?.y))
        XCTAssertEqual(graph.positions, GraphLayout.positions(linked, style: .hierarchy))
    }
}
