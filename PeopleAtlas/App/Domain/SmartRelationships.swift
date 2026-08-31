import Foundation

struct SiblingQuestion: Identifiable, Sendable {
    var sourceID: UUID
    var targetID: UUID
    var options: [RelationKind]
    var id: String { "\(sourceID):\(targetID)" }
}
struct SmartPlan: Sendable {
    var base: AtlasSnapshot
    var original: RelationDraft
    var proposed: AtlasSnapshot
    var automatic: [RelationDraft] = []
    var questions: [SiblingQuestion] = []
    var warnings: [String] = []
    var requiresConfirmation: Bool { !questions.isEmpty || !warnings.isEmpty }

    /// A nil choice is not the same as an explicit skip; every question must be answered.
    func resolved(choices: [String: String]) throws -> AtlasSnapshot {
        var result = proposed
        for question in questions {
            guard let value = choices[question.id] else { throw AtlasError.confirmationRequired }
            if value == "skip" { continue }
            guard let kind = RelationKind(rawValue: value), question.options.contains(kind) else { throw AtlasError.confirmationRequired }
            result = try AtlasRules.adding(RelationDraft(sourceID: question.sourceID, targetID: question.targetID, kind: kind), to: result)
        }
        return result
    }
}

/// Conservative family inference: only the direct family touched by this addition is expanded.
enum SmartRelationships {
    static func plan(_ input: RelationDraft, in network: AtlasSnapshot) throws -> SmartPlan {
        var plan = SmartPlan(base: network, original: input, proposed: try AtlasRules.adding(input, to: network))
        guard input.kind.isParent || input.kind.isChild || input.kind.isSibling || input.kind.isSpouse else { return plan }
        var touchedChildren = Set<UUID>()
        var candidateParents = Set<UUID>()
        func parents(of child: UUID) -> Set<UUID> {
            Set(plan.proposed.relations.filter { $0.sourceID == child && $0.kind.isChild }.map(\.targetID))
        }
        func warn(_ key: String) { if !plan.warnings.contains(key) { plan.warnings.append(key) } }
        if input.kind.isSpouse {
            // A marriage revisits only these partners' direct children. Do not pool
            // unrelated existing parents across children or recurse into grandchildren.
            candidateParents = [input.sourceID, input.targetID]
            touchedChildren = Set(plan.proposed.relations.filter { $0.kind.isChild && candidateParents.contains($0.targetID) }.map(\.sourceID))
        } else if input.kind.isSibling {
            touchedChildren = [input.sourceID, input.targetID]
            candidateParents = parents(of: input.sourceID).union(parents(of: input.targetID))
        } else {
            let child = input.kind.isChild ? input.sourceID : input.targetID
            let parent = input.kind.isChild ? input.targetID : input.sourceID
            touchedChildren = [child]
            candidateParents = parents(of: child).union([parent])
        }
        guard !touchedChildren.isEmpty else { return plan }
        // The unique-spouse assumption is visible in the form and can be switched off.
        for parent in candidateParents.sorted(by: { $0.uuidString < $1.uuidString }) {
            let spouses = Set(plan.proposed.relations.filter { $0.sourceID == parent && $0.kind.isSpouse }.map(\.targetID))
            if spouses.count == 1 { candidateParents.formUnion(spouses) }
            else if spouses.count > 1 {
                warn("Multiple spouses found. Choose the other parent manually.")
                // Both newly married partners must be each other's only spouse.
                if input.kind.isSpouse { return plan }
            }
        }
        var validParents = Set<UUID>()
        for gender in Gender.allCases {
            let matches = candidateParents.filter { plan.proposed.person($0)?.gender == gender }
            if matches.count > 1 { warn("Conflicting parent candidates were skipped.") }
            else { validParents.formUnion(matches) }
        }
        // Detect ancestral loops before inferring a parent; never turn spouses or siblings into parents.
        func isAncestor(_ ancestor: UUID, of person: UUID) -> Bool {
            var pending = Array(parents(of: person)), visited = Set<UUID>()
            while let next = pending.popLast() {
                if next == ancestor { return true }
                if visited.insert(next).inserted { pending.append(contentsOf: parents(of: next)) }
            }
            return false
        }
        for child in touchedChildren.sorted(by: { $0.uuidString < $1.uuidString }) {
            for parent in validParents.sorted(by: { $0.uuidString < $1.uuidString }) {
                if parents(of: child).contains(parent) { continue }
                // Spouse additions use only the couple as candidates, so protect each
                // child's other recorded parent separately rather than replacing it.
                if parents(of: child).contains(where: { plan.proposed.person($0)?.gender == plan.proposed.person(parent)?.gender }) {
                    warn("Conflicting parent candidates were skipped.")
                    continue
                }
                let conflicts = plan.proposed.relations.contains { $0.sourceID == child && $0.targetID == parent && ($0.kind.isSibling || $0.kind.isSpouse) }
                if parent == child || isAncestor(child, of: parent) || conflicts {
                    warn("Conflicting family roles were skipped. Please check this family.")
                    continue
                }
                guard let childPerson = plan.proposed.person(child) else { continue }
                let draft = RelationDraft(sourceID: child, targetID: parent, kind: childPerson.gender == .male ? .son : .daughter)
                plan.proposed = try AtlasRules.adding(draft, to: plan.proposed)
                plan.automatic.append(draft)
            }
        }
        var asked = Set<String>()
        for child in touchedChildren.sorted(by: { $0.uuidString < $1.uuidString }) {
            let parentIDs = parents(of: child)
            let siblings = Set(plan.proposed.relations.filter { $0.kind.isChild && parentIDs.contains($0.targetID) }.map(\.sourceID))
            for sibling in siblings.sorted(by: { $0.uuidString < $1.uuidString }) where sibling != child {
                let key = [child.uuidString, sibling.uuidString].sorted().joined(separator: ":")
                guard asked.insert(key).inserted else { continue }
                let existing = plan.proposed.relations.filter { $0.sourceID == child && $0.targetID == sibling }
                if existing.contains(where: { $0.kind.isSibling }) { continue }
                if existing.contains(where: { $0.kind.isSpouse || $0.kind.isParent || $0.kind.isChild }) || isAncestor(child, of: sibling) || isAncestor(sibling, of: child) {
                    warn("Conflicting family roles were skipped. Please check this family.")
                    continue
                }
                let options: [RelationKind] = plan.proposed.person(child)?.gender == .male ? [.olderBrother, .youngerBrother] : [.olderSister, .youngerSister]
                plan.questions.append(SiblingQuestion(sourceID: child, targetID: sibling, options: options))
            }
        }
        return plan
    }
}
