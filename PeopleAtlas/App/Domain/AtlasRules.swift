import Foundation

/// Pure snapshot operations let validation finish before any persistent object is changed.
enum AtlasRules {
    static func validatedPerson(_ person: AtlasPerson) throws -> AtlasPerson {
        var result = person
        result.name = person.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...30).contains(result.name.count) else { throw AtlasError.invalidName }
        guard result.notes.count <= 2_000 else { throw AtlasError.longNotes }
        return result
    }

    static func options(source: AtlasPerson?, target: AtlasPerson?) -> [RelationKind] {
        guard let source, let target, source.id != target.id else { return [] }
        return RelationKind.allCases.filter { $0.matches(source.gender, target.gender) }
    }

    static func adding(_ draft: RelationDraft, to snapshot: AtlasSnapshot) throws -> AtlasSnapshot {
        guard let source = snapshot.person(draft.sourceID), let target = snapshot.person(draft.targetID) else { throw AtlasError.missingPerson }
        guard source.id != target.id else { throw AtlasError.selfRelation }
        guard draft.kind.matches(source.gender, target.gender) else { throw AtlasError.incompatibleGender }
        guard !snapshot.relations.contains(where: { $0.sourceID == source.id && $0.targetID == target.id && $0.kind == draft.kind }) else { throw AtlasError.duplicate }
        let forwardID = UUID(), reverseID = UUID(), now = Date()
        var result = snapshot
        result.relations.append(AtlasRelation(id: forwardID, inverseID: reverseID, sourceID: source.id, targetID: target.id, kind: draft.kind, createdAt: now))
        result.relations.append(AtlasRelation(id: reverseID, inverseID: forwardID, sourceID: target.id, targetID: source.id, kind: draft.kind.inverse(targetGender: target.gender), createdAt: now))
        return result
    }

    static func removingRelation(_ id: UUID, from snapshot: AtlasSnapshot) -> AtlasSnapshot {
        let inverse = snapshot.relations.first { $0.id == id }?.inverseID
        var result = snapshot
        result.relations.removeAll { $0.id == id || $0.id == inverse || $0.inverseID == id }
        return result
    }

    static func updatingRelation(_ id: UUID, draft: RelationDraft, in snapshot: AtlasSnapshot) throws -> AtlasSnapshot {
        guard let old = snapshot.relations.first(where: { $0.id == id }) else { throw AtlasError.missingRelation }
        var result = try adding(draft, to: removingRelation(id, from: snapshot))
        // Keep the original stable identifiers when changing a pair.
        let count = result.relations.count
        result.relations[count - 2].id = old.id
        result.relations[count - 2].inverseID = old.inverseID
        result.relations[count - 1].id = old.inverseID
        result.relations[count - 1].inverseID = old.id
        return result
    }

    static func savingPerson(_ person: AtlasPerson, in snapshot: AtlasSnapshot) throws -> AtlasSnapshot {
        var person = try validatedPerson(person)
        person.updatedAt = Date()
        var result = snapshot
        if let index = result.people.firstIndex(where: { $0.id == person.id }) {
            result.people[index] = person
            for index in result.relations.indices where result.relations[index].sourceID == person.id {
                result.relations[index].kind = result.relations[index].kind.adjusted(to: person.gender)
            }
        } else { result.people.append(person) }
        try validate(result)
        return result
    }

    static func removingPerson(_ id: UUID, from snapshot: AtlasSnapshot) -> AtlasSnapshot {
        var result = snapshot
        result.people.removeAll { $0.id == id }
        result.relations.removeAll { $0.sourceID == id || $0.targetID == id }
        return result
    }

    /// Strict backup/store validation never silently discards malformed records.
    static func validate(_ snapshot: AtlasSnapshot) throws {
        guard snapshot.people.count <= 10_000, snapshot.relations.count <= 100_000,
              Set(snapshot.people.map(\.id)).count == snapshot.people.count,
              Set(snapshot.relations.map(\.id)).count == snapshot.relations.count else { throw AtlasError.invalidBackup }
        let people = Dictionary(uniqueKeysWithValues: snapshot.people.map { ($0.id, $0) })
        let relations = Dictionary(uniqueKeysWithValues: snapshot.relations.map { ($0.id, $0) })
        var keys = Set<String>()
        for person in snapshot.people {
            let validated = try validatedPerson(person)
            // Forms normalize before saving. A stored/imported snapshot must already be
            // canonical: validating a trimmed copy must not admit an oversized raw name.
            guard person.name == validated.name else { throw AtlasError.invalidBackup }
        }
        for relation in snapshot.relations {
            guard let source = people[relation.sourceID], let target = people[relation.targetID] else { throw AtlasError.missingPerson }
            guard source.id != target.id else { throw AtlasError.selfRelation }
            guard relation.kind.matches(source.gender, target.gender) else { throw AtlasError.incompatibleGender }
            let key = "\(source.id):\(target.id):\(relation.kind.rawValue)"
            guard keys.insert(key).inserted else { throw AtlasError.duplicate }
            guard let inverse = relations[relation.inverseID], inverse.inverseID == relation.id,
                  inverse.sourceID == target.id, inverse.targetID == source.id,
                  inverse.kind == relation.kind.inverse(targetGender: target.gender) else { throw AtlasError.invalidBackup }
        }
    }
}

struct AtlasBackup: Codable, Sendable {
    var version = 1
    var exportedAt = Date()
    var network: AtlasSnapshot

    func encoded() throws -> Data {
        try AtlasRules.validate(network)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(self)
    }
    static func decode(_ data: Data) throws -> AtlasSnapshot {
        guard data.count <= 20_000_000 else { throw AtlasError.invalidBackup }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let backup = try? decoder.decode(Self.self, from: data), backup.version == 1 else { throw AtlasError.invalidBackup }
        try AtlasRules.validate(backup.network)
        return backup.network
    }
}
