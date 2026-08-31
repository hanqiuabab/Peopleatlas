import Foundation
import SwiftData

@Model final class PersonEntity {
    var id: UUID = UUID()
    var name: String = ""
    var gender: String = Gender.male.rawValue
    var notes: String = ""
    var createdAt: Date = Date()
    var updatedAt: Date = Date()
    init(_ person: AtlasPerson) { update(person) }
    func update(_ person: AtlasPerson) {
        id = person.id; name = person.name; gender = person.gender.rawValue
        notes = person.notes; createdAt = person.createdAt; updatedAt = person.updatedAt
    }
    func value() throws -> AtlasPerson {
        guard let gender = Gender(rawValue: gender) else { throw AtlasError.invalidBackup }
        return AtlasPerson(id: id, name: name, gender: gender, notes: notes, createdAt: createdAt, updatedAt: updatedAt)
    }
}

@Model final class RelationEntity {
    var id: UUID = UUID()
    var inverseID: UUID = UUID()
    var sourceID: UUID = UUID()
    var targetID: UUID = UUID()
    var kind: String = RelationKind.colleague.rawValue
    var createdAt: Date = Date()
    init(_ relation: AtlasRelation) { update(relation) }
    func update(_ relation: AtlasRelation) {
        id = relation.id; inverseID = relation.inverseID; sourceID = relation.sourceID
        targetID = relation.targetID; kind = relation.kind.rawValue; createdAt = relation.createdAt
    }
    func value() throws -> AtlasRelation {
        guard let kind = RelationKind(rawValue: kind) else { throw AtlasError.invalidBackup }
        return AtlasRelation(id: id, inverseID: inverseID, sourceID: sourceID, targetID: targetID, kind: kind, createdAt: createdAt)
    }
}

@MainActor protocol AtlasRepository {
    var cloudSyncEnabled: Bool { get }
    func load() throws -> AtlasSnapshot
    func replace(with snapshot: AtlasSnapshot) throws
}

extension AtlasRepository {
    var cloudSyncEnabled: Bool { false }
}

enum AtlasCloud {
    /// The entitlement and SwiftData configuration must always refer to the same container.
    static var containerIdentifier: String {
        guard let bundleIdentifier = Bundle.main.bundleIdentifier, !bundleIdentifier.isEmpty else {
            return "iCloud.com.hanqiu.peopleatlas"
        }
        return "iCloud.\(bundleIdentifier)"
    }
}

/// All writes use one ModelContext transaction. No background autosave may commit half a pair.
@MainActor final class SwiftDataAtlasRepository: AtlasRepository {
    let context: ModelContext
    let cloudSyncEnabled: Bool
    private let save: (ModelContext) throws -> Void
    init(
        container: ModelContainer,
        cloudSyncEnabled: Bool = false,
        save: @escaping (ModelContext) throws -> Void = { try $0.save() }
    ) {
        context = ModelContext(container)
        context.autosaveEnabled = false
        self.cloudSyncEnabled = cloudSyncEnabled
        self.save = save
    }
    static func container(inMemory: Bool = false, url: URL? = nil, cloudSyncEnabled: Bool = false) throws -> ModelContainer {
        let schema = Schema([PersonEntity.self, RelationEntity.self])
        // Tests and explicit file stores remain local. Only the production store is attached
        // to the user's private CloudKit database, preserving deterministic isolated tests.
        let cloudDatabase: ModelConfiguration.CloudKitDatabase = cloudSyncEnabled
            ? .private(AtlasCloud.containerIdentifier)
            : .none
        let config: ModelConfiguration
        if let url { config = ModelConfiguration("PeopleAtlas", schema: schema, url: url, cloudKitDatabase: cloudDatabase) }
        else { config = ModelConfiguration("PeopleAtlas", schema: schema, isStoredInMemoryOnly: inMemory, cloudKitDatabase: cloudDatabase) }
        return try ModelContainer(for: schema, configurations: [config])
    }
    func load() throws -> AtlasSnapshot {
        let people = try context.fetch(FetchDescriptor<PersonEntity>(sortBy: [SortDescriptor(\.createdAt)]))
        let relations = try context.fetch(FetchDescriptor<RelationEntity>(sortBy: [SortDescriptor(\.createdAt)]))
        let snapshot = try AtlasSnapshot(people: people.map { try $0.value() }, relations: relations.map { try $0.value() })
        try AtlasRules.validate(snapshot)
        return snapshot
    }
    func replace(with snapshot: AtlasSnapshot) throws {
        try AtlasRules.validate(snapshot)
        do {
            let storedPeople = try context.fetch(FetchDescriptor<PersonEntity>())
            let storedRelations = try context.fetch(FetchDescriptor<RelationEntity>())
            let people = Dictionary(uniqueKeysWithValues: snapshot.people.map { ($0.id, $0) })
            let relations = Dictionary(uniqueKeysWithValues: snapshot.relations.map { ($0.id, $0) })
            let existingPeople = Set(storedPeople.map(\.id)), existingRelations = Set(storedRelations.map(\.id))
            for entity in storedPeople {
                if let value = people[entity.id] { entity.update(value) } else { context.delete(entity) }
            }
            for entity in storedRelations {
                if let value = relations[entity.id] { entity.update(value) } else { context.delete(entity) }
            }
            for person in snapshot.people where !existingPeople.contains(person.id) { context.insert(PersonEntity(person)) }
            for relation in snapshot.relations where !existingRelations.contains(relation.id) { context.insert(RelationEntity(relation)) }
            try save(context)
        } catch {
            context.rollback()
            throw error
        }
    }
}
