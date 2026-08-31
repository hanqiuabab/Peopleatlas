import XCTest
@testable import PeopleAtlas

final class AtlasRulesTests: XCTestCase {
    func testEveryRelationshipBuildsValidReciprocalPairForAllGenderCombinations() throws {
        for kind in RelationKind.allCases {
            for sourceGender in Gender.allCases {
                for targetGender in Gender.allCases {
                    let a = AtlasPerson(name: "A", gender: sourceGender), b = AtlasPerson(name: "B", gender: targetGender)
                    let base = AtlasSnapshot(people: [a, b])
                    let draft = RelationDraft(sourceID: a.id, targetID: b.id, kind: kind)
                    if kind.matches(sourceGender, targetGender) {
                        let result = try AtlasRules.adding(draft, to: base)
                        try AtlasRules.validate(result)
                        XCTAssertEqual(result.relations.count, 2)
                        XCTAssertEqual(result.pairs.count, 1)
                        XCTAssertEqual(result.connections(for: b.id).first?.kind, kind.inverse(targetGender: targetGender))
                    } else { XCTAssertThrowsError(try AtlasRules.adding(draft, to: base)) }
                    XCTAssertTrue(base.relations.isEmpty, "Pure operations must not mutate their input")
                }
            }
        }
    }
    func testGenderOptionsAndSelfRelation() {
        let a = AtlasPerson(name: "A", gender: .female), b = AtlasPerson(name: "B", gender: .female)
        XCTAssertEqual(Set(AtlasRules.options(source: a, target: b)), [.mother, .daughter, .olderSister, .youngerSister, .colleague])
        XCTAssertTrue(AtlasRules.options(source: a, target: a).isEmpty)
        XCTAssertTrue(AtlasRules.options(source: nil, target: b).isEmpty)
        XCTAssertThrowsError(try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: a.id, kind: .colleague), to: AtlasSnapshot(people: [a])))
    }
    func testPersonValidationTrimsAndBoundsUnicodeNames() throws {
        XCTAssertEqual(try AtlasRules.validatedPerson(AtlasPerson(name: "  小明\n", gender: .male)).name, "小明")
        for name in ["", " \n", String(repeating: "明", count: 31)] {
            XCTAssertThrowsError(try AtlasRules.validatedPerson(AtlasPerson(name: name, gender: .male)))
        }
        XCTAssertNoThrow(try AtlasRules.validatedPerson(AtlasPerson(name: String(repeating: "👨‍👩‍👧", count: 30), gender: .female)))
        XCTAssertThrowsError(try AtlasRules.validatedPerson(AtlasPerson(name: "A", gender: .male, notes: String(repeating: "a", count: 2001))))
    }
    func testEditingAndDeletingEitherDirectionKeepsPairsConsistent() throws {
        let a = AtlasPerson(name: "A", gender: .male), b = AtlasPerson(name: "B", gender: .female)
        let draft = RelationDraft(sourceID: a.id, targetID: b.id, kind: .father)
        let base = try AtlasRules.adding(draft, to: AtlasSnapshot(people: [a, b]))
        XCTAssertThrowsError(try AtlasRules.adding(draft, to: base))
        let reverse = try XCTUnwrap(base.connections(for: b.id).first)
        let edited = try AtlasRules.updatingRelation(reverse.id, draft: RelationDraft(sourceID: b.id, targetID: a.id, kind: .olderSister), in: base)
        try AtlasRules.validate(edited)
        XCTAssertEqual(Set(edited.relations.map(\.id)), Set(base.relations.map(\.id)))
        XCTAssertEqual(edited.connections(for: a.id).first?.kind, .youngerBrother)
        XCTAssertTrue(AtlasRules.removingRelation(reverse.id, from: edited).relations.isEmpty)
        let deleted = AtlasRules.removingPerson(b.id, from: edited)
        XCTAssertEqual(deleted.people.count, 1)
        XCTAssertTrue(deleted.relations.isEmpty)
    }
    func testGenderEditUpdatesFamilyButRejectsInvalidSpouse() throws {
        var a = AtlasPerson(name: "A", gender: .male)
        let b = AtlasPerson(name: "B", gender: .female)
        let base = AtlasSnapshot(people: [a, b])
        let family = try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: b.id, kind: .father), to: base)
        a.gender = .female
        let changed = try AtlasRules.savingPerson(a, in: family)
        XCTAssertEqual(changed.connections(for: a.id).first?.kind, .mother)
        try AtlasRules.validate(changed)
        let spouses = try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: b.id, kind: .husband), to: base)
        XCTAssertThrowsError(try AtlasRules.savingPerson(a, in: spouses))
        XCTAssertEqual(spouses.person(a.id)?.gender, .male)
    }
    func testBackupRoundTripAndCorruptionRejection() throws {
        let a = AtlasPerson(name: "小明", gender: .male, notes: "Private notes"), b = AtlasPerson(name: "B", gender: .female)
        let network = try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: b.id, kind: .son), to: AtlasSnapshot(people: [a, b]))
        let data = try AtlasBackup(network: network).encoded()
        let decoded = try AtlasBackup.decode(data)
        XCTAssertEqual(decoded.people.map(\.id), network.people.map(\.id))
        XCTAssertEqual(decoded.people.first?.notes, "Private notes")
        XCTAssertEqual(decoded.relations.map(\.kind), network.relations.map(\.kind))
        XCTAssertThrowsError(try AtlasBackup.decode(Data("not json".utf8)))
        var future = AtlasBackup(network: network); future.version = 99
        XCTAssertThrowsError(try AtlasBackup.decode(future.encoded()))
        var malformed = network; malformed.relations.removeLast()
        XCTAssertThrowsError(try AtlasRules.validate(malformed))
        malformed = network; malformed.people.append(a)
        XCTAssertThrowsError(try AtlasRules.validate(malformed))
        malformed = network; malformed.people.removeLast()
        XCTAssertThrowsError(try AtlasRules.validate(malformed))
    }
    func testBackupRejectsUntrimmedNamesRatherThanAcceptingAnUnboundedRawValue() throws {
        for name in [" Alice ", "\n小明\t", String(repeating: " ", count: 10_000) + "A"] {
            let person = AtlasPerson(name: name, gender: .female)
            let snapshot = AtlasSnapshot(people: [person])
            XCTAssertThrowsError(try AtlasRules.validate(snapshot))
            XCTAssertThrowsError(try AtlasBackup(network: snapshot).encoded())
            // Simulate an externally edited JSON file, bypassing the validated exporter.
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            XCTAssertThrowsError(try AtlasBackup.decode(encoder.encode(AtlasBackup(network: snapshot))))
            let saved = try AtlasRules.savingPerson(person, in: AtlasSnapshot())
            XCTAssertEqual(saved.people.first?.name, name.trimmingCharacters(in: .whitespacesAndNewlines))
            XCTAssertNoThrow(try AtlasRules.validate(saved), "Normal form input still trims whitespace before persistence")
        }
    }
}
