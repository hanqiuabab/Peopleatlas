import XCTest
@testable import PeopleAtlas

final class SmartRelationshipsTests: XCTestCase {
    let father = AtlasPerson(name: "A", gender: .male)
    let mother = AtlasPerson(name: "B", gender: .female)
    let son = AtlasPerson(name: "C", gender: .male)
    let daughter = AtlasPerson(name: "D", gender: .female)
    private func family(withSon: Bool = true) throws -> AtlasSnapshot {
        var network = AtlasSnapshot(people: [father, mother, son, daughter])
        network = try AtlasRules.adding(RelationDraft(sourceID: father.id, targetID: mother.id, kind: .husband), to: network)
        if withSon {
            network = try AtlasRules.adding(RelationDraft(sourceID: son.id, targetID: father.id, kind: .son), to: network)
            network = try AtlasRules.adding(RelationDraft(sourceID: son.id, targetID: mother.id, kind: .son), to: network)
        }
        return network
    }
    func testDaughterAddsOtherParentAndAsksUnknownSiblingAge() throws {
        let base = try family()
        let plan = try SmartRelationships.plan(RelationDraft(sourceID: daughter.id, targetID: father.id, kind: .daughter), in: base)
        XCTAssertEqual(plan.automatic.count, 1)
        XCTAssertEqual(plan.automatic.first?.targetID, mother.id)
        XCTAssertEqual(plan.questions.count, 1)
        let question = try XCTUnwrap(plan.questions.first)
        XCTAssertEqual(question.sourceID, daughter.id)
        XCTAssertEqual(question.targetID, son.id)
        XCTAssertEqual(question.options, [.olderSister, .youngerSister])
        XCTAssertThrowsError(try plan.resolved(choices: [:]))
        let resolved = try plan.resolved(choices: [question.id: RelationKind.olderSister.rawValue])
        XCTAssertTrue(resolved.relations.contains { $0.sourceID == son.id && $0.targetID == daughter.id && $0.kind == .youngerBrother })
        try AtlasRules.validate(resolved)
        XCTAssertEqual(base.pairs.count, 3)
    }
    func testAddingSisterInfersBothParentsWithoutConfirmation() throws {
        let plan = try SmartRelationships.plan(RelationDraft(sourceID: daughter.id, targetID: son.id, kind: .olderSister), in: family())
        XCTAssertEqual(plan.automatic.count, 2)
        XCTAssertFalse(plan.requiresConfirmation)
        XCTAssertEqual(Set(plan.automatic.map(\.targetID)), [father.id, mother.id])
        try AtlasRules.validate(plan.proposed)
    }
    func testCertainOtherParentRequiresNoConfirmationAndSkippedAgeDoesNotAddSibling() throws {
        let input = RelationDraft(sourceID: daughter.id, targetID: father.id, kind: .daughter)
        XCTAssertFalse(try SmartRelationships.plan(input, in: family(withSon: false)).requiresConfirmation)
        let plan = try SmartRelationships.plan(input, in: family())
        let question = try XCTUnwrap(plan.questions.first)
        let skipped = try plan.resolved(choices: [question.id: "skip"])
        XCTAssertFalse(skipped.relations.contains { $0.kind.isSibling })
        XCTAssertThrowsError(try plan.resolved(choices: [question.id: RelationKind.father.rawValue]))
    }
    func testMultipleSpousesAndConflictingParentsAreNotGuessed() throws {
        let other = AtlasPerson(name: "Other", gender: .female)
        var base = try family(withSon: false); base.people.append(other)
        base = try AtlasRules.adding(RelationDraft(sourceID: father.id, targetID: other.id, kind: .husband), to: base)
        let plan = try SmartRelationships.plan(RelationDraft(sourceID: daughter.id, targetID: father.id, kind: .daughter), in: base)
        XCTAssertTrue(plan.requiresConfirmation)
        XCTAssertTrue(plan.automatic.isEmpty)
        XCTAssertEqual(plan.warnings.count, 1)
    }
    func testNonFamilyAdditionDoesNotInferAnything() throws {
        let plan = try SmartRelationships.plan(RelationDraft(sourceID: daughter.id, targetID: son.id, kind: .colleague), in: family())
        XCTAssertFalse(plan.requiresConfirmation)
        XCTAssertTrue(plan.automatic.isEmpty)
    }

    func testAddingEitherSpouseAfterAChildCompletesBothDirectionsRegardlessOfOrder() throws {
        let spouses = [RelationDraft(sourceID: father.id, targetID: mother.id, kind: .husband),
                       RelationDraft(sourceID: mother.id, targetID: father.id, kind: .wife)]
        for spouse in spouses {
            for parent in [father, mother] {
                for child in [son, daughter] {
                    let other = parent.id == father.id ? mother : father
                    let parentKind: RelationKind = parent.gender == .male ? .father : .mother
                    let childKind: RelationKind = child.gender == .male ? .son : .daughter
                    let original = RelationDraft(sourceID: parent.id, targetID: child.id, kind: parentKind)
                    let empty = AtlasSnapshot(people: [father, mother, son, daughter])
                    let base = try AtlasRules.adding(original, to: empty)
                    let plan = try SmartRelationships.plan(spouse, in: base)
                    XCTAssertEqual(plan.automatic, [RelationDraft(sourceID: child.id, targetID: other.id, kind: childKind)])
                    XCTAssertFalse(plan.requiresConfirmation)
                    let result = try plan.resolved(choices: [:])
                    XCTAssertEqual(result.pairs.count, 3)
                    XCTAssertTrue(result.relations.contains { $0.sourceID == other.id && $0.targetID == child.id && $0.kind == (other.gender == .male ? .father : .mother) })
                    let reverse = try SmartRelationships.plan(original, in: AtlasRules.adding(spouse, to: empty))
                    let keys: (AtlasSnapshot) -> Set<String> = { Set($0.relations.map { "\($0.sourceID):\($0.targetID):\($0.kind.rawValue)" }) }
                    XCTAssertEqual(keys(result), keys(reverse.proposed))
                    XCTAssertEqual(base.pairs.count, 1, "Previewing does not mutate the input")
                    try AtlasRules.validate(result)
                }
            }
        }
    }

    func testAddingSpouseCompletesBothSidesAndAsksSiblingAgeOnlyOnce() throws {
        var base = AtlasSnapshot(people: [father, mother, son, daughter])
        base = try AtlasRules.adding(RelationDraft(sourceID: son.id, targetID: father.id, kind: .son), to: base)
        base = try AtlasRules.adding(RelationDraft(sourceID: daughter.id, targetID: mother.id, kind: .daughter), to: base)
        let spouse = RelationDraft(sourceID: mother.id, targetID: father.id, kind: .wife)
        let plan = try SmartRelationships.plan(spouse, in: base)
        XCTAssertEqual(plan.automatic.count, 2)
        XCTAssertTrue(plan.warnings.isEmpty)
        XCTAssertEqual(plan.questions.count, 1)
        let question = try XCTUnwrap(plan.questions.first)
        XCTAssertEqual(Set([question.sourceID, question.targetID]), [son.id, daughter.id])
        XCTAssertThrowsError(try plan.resolved(choices: [:]))
        XCTAssertEqual(try plan.resolved(choices: [question.id: "skip"]).pairs.count, 5)
        let confirmed = try plan.resolved(choices: [question.id: question.options[0].rawValue])
        XCTAssertEqual(confirmed.pairs.count, 6)
        try AtlasRules.validate(confirmed)
        base = try AtlasRules.adding(RelationDraft(sourceID: son.id, targetID: daughter.id, kind: .olderBrother), to: base)
        XCTAssertTrue(try SmartRelationships.plan(spouse, in: base).questions.isEmpty)
    }

    func testAddingSpousePreservesOtherParentsWithoutSharingThemAcrossChildren() throws {
        for parent in [father, mother] {
            let other = AtlasPerson(name: "Existing other parent", gender: parent.gender == .male ? .female : .male)
            let partner = parent.id == father.id ? mother : father
            var base = AtlasSnapshot(people: [father, mother, son, daughter, other])
            for draft in [RelationDraft(sourceID: son.id, targetID: parent.id, kind: .son),
                          RelationDraft(sourceID: son.id, targetID: other.id, kind: .son),
                          RelationDraft(sourceID: daughter.id, targetID: parent.id, kind: .daughter)] {
                base = try AtlasRules.adding(draft, to: base)
            }
            let plan = try SmartRelationships.plan(RelationDraft(sourceID: mother.id, targetID: father.id, kind: .wife), in: base)
            XCTAssertEqual(plan.automatic, [RelationDraft(sourceID: daughter.id, targetID: partner.id, kind: .daughter)])
            XCTAssertTrue(plan.warnings.contains("Conflicting parent candidates were skipped."))
            XCTAssertFalse(plan.proposed.relations.contains { $0.sourceID == son.id && $0.targetID == partner.id })
            for existing in base.relations { XCTAssertTrue(plan.proposed.relations.contains(existing)) }
            try AtlasRules.validate(plan.proposed)
        }
    }

    func testAddingSpouseSkipsMultipleSpousesOnEitherSide() throws {
        for parent in [father, mother] {
            let other = AtlasPerson(name: "Other spouse", gender: parent.gender == .male ? .female : .male)
            var base = AtlasSnapshot(people: [father, mother, son, daughter, other])
            for draft in [RelationDraft(sourceID: son.id, targetID: father.id, kind: .son),
                          RelationDraft(sourceID: daughter.id, targetID: mother.id, kind: .daughter),
                          RelationDraft(sourceID: parent.id, targetID: other.id, kind: parent.gender == .male ? .husband : .wife)] {
                base = try AtlasRules.adding(draft, to: base)
            }
            let plan = try SmartRelationships.plan(RelationDraft(sourceID: mother.id, targetID: father.id, kind: .wife), in: base)
            XCTAssertTrue(plan.automatic.isEmpty)
            XCTAssertTrue(plan.questions.isEmpty)
            XCTAssertTrue(plan.warnings.contains("Multiple spouses found. Choose the other parent manually."))
            XCTAssertEqual(plan.proposed.pairs.count, base.pairs.count + 1)
        }
    }

    func testAddingSpouseDeduplicatesParentsAndDoesNotExpandGrandchildren() throws {
        var base = AtlasSnapshot(people: [father, mother, son, daughter])
        for draft in [RelationDraft(sourceID: son.id, targetID: father.id, kind: .son),
                      RelationDraft(sourceID: son.id, targetID: mother.id, kind: .son),
                      RelationDraft(sourceID: daughter.id, targetID: son.id, kind: .daughter)] {
            base = try AtlasRules.adding(draft, to: base)
        }
        let plan = try SmartRelationships.plan(RelationDraft(sourceID: mother.id, targetID: father.id, kind: .wife), in: base)
        XCTAssertTrue(plan.automatic.isEmpty)
        XCTAssertFalse(plan.requiresConfirmation)
        XCTAssertEqual(plan.proposed.pairs.count, 4)
    }

    func testAddingSpouseDoesNotIntroduceConflictingRolesOrAncestorLoops() throws {
        let middle = AtlasPerson(name: "Middle", gender: .male)
        let conflicts = [[RelationDraft(sourceID: son.id, targetID: mother.id, kind: .olderBrother)],
                         [RelationDraft(sourceID: son.id, targetID: mother.id, kind: .husband)],
                         [RelationDraft(sourceID: mother.id, targetID: middle.id, kind: .daughter),
                          RelationDraft(sourceID: middle.id, targetID: son.id, kind: .son)]]
        for drafts in conflicts {
            var base = try AtlasRules.adding(RelationDraft(sourceID: son.id, targetID: father.id, kind: .son), to: AtlasSnapshot(people: [father, mother, son, middle]))
            for draft in drafts { base = try AtlasRules.adding(draft, to: base) }
            let plan = try SmartRelationships.plan(RelationDraft(sourceID: mother.id, targetID: father.id, kind: .wife), in: base)
            XCTAssertTrue(plan.automatic.isEmpty)
            XCTAssertFalse(plan.warnings.isEmpty)
            try AtlasRules.validate(plan.proposed)
        }
    }
}
