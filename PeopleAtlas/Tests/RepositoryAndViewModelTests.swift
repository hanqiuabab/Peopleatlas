import XCTest
import SwiftData
@testable import PeopleAtlas

@MainActor private final class MemoryRepository: AtlasRepository {
    var snapshot = AtlasSnapshot()
    var cloudSyncEnabled = false
    var failLoad = false
    var failSave = false
    var saves = 0
    func load() throws -> AtlasSnapshot { if failLoad { throw CocoaError(.fileReadCorruptFile) }; return snapshot }
    func replace(with snapshot: AtlasSnapshot) throws {
        if failSave { throw CocoaError(.fileWriteOutOfSpace) }
        try AtlasRules.validate(snapshot); self.snapshot = snapshot; saves += 1
    }
}

@MainActor final class RepositoryAndViewModelTests: XCTestCase {
    func testBootstrapSharesLoadedModelAcrossWindows() async throws {
        let repository = MemoryRepository()
        var opens = 0
        let bootstrap = AppBootstrap(repositoryFactory: { opens += 1; return repository })
        bootstrap.open()
        let model = try XCTUnwrap(bootstrap.model)
        XCTAssertTrue(model.savePerson(AtlasPerson(name: "Keep across windows", gender: .female)))
        bootstrap.open()
        XCTAssertTrue(bootstrap.model === model)
        XCTAssertEqual(opens, 1)
        XCTAssertEqual(bootstrap.model?.network.people.count, 1)
    }
    func testBootstrapReportsLoadFailureAndAllowsExplicitRetry() async throws {
        let repository = MemoryRepository()
        repository.snapshot = AtlasSnapshot(people: [AtlasPerson(name: "Existing", gender: .male)])
        repository.failLoad = true
        let bootstrap = AppBootstrap(repositoryFactory: { repository })
        bootstrap.open()
        XCTAssertTrue(bootstrap.failed)
        XCTAssertNil(bootstrap.model)
        XCTAssertEqual(repository.saves, 0)
        repository.failLoad = false
        bootstrap.open()
        XCTAssertFalse(bootstrap.failed)
        XCTAssertEqual(bootstrap.model?.network.people.first?.name, "Existing")
        XCTAssertEqual(repository.saves, 0)
    }
    func testSwiftDataRoundTripUpdatesAndCascadeDeletion() async throws {
        let repository = SwiftDataAtlasRepository(container: try SwiftDataAtlasRepository.container(inMemory: true))
        let a = AtlasPerson(name: "Alice", gender: .female), b = AtlasPerson(name: "Bob", gender: .male)
        let network = try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: b.id, kind: .wife), to: AtlasSnapshot(people: [a, b]))
        try repository.replace(with: network)
        XCTAssertEqual(try repository.load().pairs.count, 1)
        var changed = a; changed.name = "Alice New"
        try repository.replace(with: AtlasRules.savingPerson(changed, in: network))
        XCTAssertEqual(try repository.load().person(a.id)?.name, "Alice New")
        try repository.replace(with: AtlasRules.removingPerson(b.id, from: network))
        XCTAssertEqual(try repository.load().people.count, 1)
        XCTAssertTrue(try repository.load().relations.isEmpty)
    }
    func testFailedSwiftDataSaveRollsBackUpdatesDeletesAndInserts() async throws {
        let container = try SwiftDataAtlasRepository.container(inMemory: true)
        let normal = SwiftDataAtlasRepository(container: container)
        let a = AtlasPerson(name: "Original", gender: .male), b = AtlasPerson(name: "Keep me", gender: .female)
        let base = try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: b.id, kind: .colleague), to: AtlasSnapshot(people: [a, b]))
        try normal.replace(with: base)
        let failing = SwiftDataAtlasRepository(container: container, save: { _ in throw CocoaError(.fileWriteOutOfSpace) })
        var changed = a; changed.name = "Should not persist"
        let candidate = AtlasSnapshot(people: [changed, AtlasPerson(name: "Uncommitted", gender: .female)])
        XCTAssertThrowsError(try failing.replace(with: candidate))
        let recovered = try failing.load()
        XCTAssertEqual(recovered.person(a.id)?.name, "Original")
        XCTAssertNotNil(recovered.person(b.id))
        XCTAssertEqual(recovered.people.count, 2)
        XCTAssertEqual(recovered.relations.count, 2)
        XCTAssertFalse(failing.context.hasChanges)
    }
    func testInvalidImportCannotMutateExistingStore() async throws {
        let repository = SwiftDataAtlasRepository(container: try SwiftDataAtlasRepository.container(inMemory: true))
        let a = AtlasPerson(name: "Keep", gender: .male)
        try repository.replace(with: AtlasSnapshot(people: [a]))
        XCTAssertThrowsError(try repository.replace(with: AtlasSnapshot(people: [a, a])))
        XCTAssertEqual(try repository.load().people.map(\.id), [a.id])
    }
    func testPersistentStoreReopensWithSamePeopleAndRelationships() async throws {
        // Only this test-created temporary directory is removed; never touch the app's store.
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("PeopleAtlasTests-\(UUID())", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("Test.store")
        let a = AtlasPerson(name: "Persisted", gender: .male), b = AtlasPerson(name: "持久化", gender: .female)
        do {
            let repository = SwiftDataAtlasRepository(container: try SwiftDataAtlasRepository.container(url: url))
            let network = try AtlasRules.adding(RelationDraft(sourceID: a.id, targetID: b.id, kind: .father), to: AtlasSnapshot(people: [a, b]))
            try repository.replace(with: network)
        }
        let reopened = SwiftDataAtlasRepository(container: try SwiftDataAtlasRepository.container(url: url))
        XCTAssertEqual(try reopened.load().person(b.id)?.name, "持久化")
        XCTAssertEqual(try reopened.load().connections(for: a.id).first?.kind, .father)
    }
    func testCorruptStoredValueThrowsInsteadOfReturningEmptySnapshot() async throws {
        let container = try SwiftDataAtlasRepository.container(inMemory: true)
        let repository = SwiftDataAtlasRepository(container: container)
        let entity = PersonEntity(AtlasPerson(name: "Saved person", gender: .male)); entity.gender = "invalid"
        repository.context.insert(entity); try repository.context.save()
        XCTAssertThrowsError(try repository.load())
        XCTAssertEqual(try repository.context.fetchCount(FetchDescriptor<PersonEntity>()), 1)
    }
    func testViewModelNeverPublishesFailedSaveAndLoadErrorPropagates() async throws {
        let repository = MemoryRepository()
        repository.failLoad = true
        XCTAssertThrowsError(try AtlasViewModel(repository: repository))
        repository.failLoad = false
        let model = try AtlasViewModel(repository: repository)
        let person = AtlasPerson(name: "First", gender: .female)
        XCTAssertTrue(model.savePerson(person))
        let saved = model.network
        repository.failSave = true
        XCTAssertFalse(model.deletePerson(person.id))
        XCTAssertEqual(model.network, saved)
        XCTAssertNotNil(model.error)
        XCTAssertEqual(repository.saves, 1)
    }
    func testMutationRebasesOnLatestImportedSnapshot() async throws {
        let repository = MemoryRepository()
        let model = try AtlasViewModel(repository: repository)
        let remote = AtlasPerson(name: "Cloud import", gender: .female)
        repository.snapshot = AtlasSnapshot(people: [remote])
        let local = AtlasPerson(name: "Local edit", gender: .male)
        XCTAssertTrue(model.savePerson(local))
        XCTAssertEqual(Set(model.network.people.map(\.id)), Set([remote.id, local.id]))
        XCTAssertEqual(repository.snapshot, model.network)
    }
    func testRemoteRefreshPublishesChangesAndPreservesDataOnReadFailure() async throws {
        let repository = MemoryRepository()
        let model = try AtlasViewModel(repository: repository)
        let imported = AtlasPerson(name: "Another device", gender: .female)
        repository.snapshot = AtlasSnapshot(people: [imported])
        model.refreshFromStore()
        XCTAssertEqual(model.network.people.map(\.id), [imported.id])
        repository.failLoad = true
        repository.snapshot = AtlasSnapshot()
        model.refreshFromStore()
        XCTAssertEqual(model.network.people.map(\.id), [imported.id])
        XCTAssertNotNil(model.error)
    }
    func testICloudAccountAvailabilityIsExplicitAndTestable() async throws {
        let repository = MemoryRepository()
        repository.cloudSyncEnabled = true
        let available = try AtlasViewModel(repository: repository, iCloudAccountStatus: { .available })
        XCTAssertEqual(available.iCloudState, .checking)
        await available.refreshICloudState()
        XCTAssertEqual(available.iCloudState, .available)

        let unavailable = try AtlasViewModel(repository: repository, iCloudAccountStatus: { .noAccount })
        await unavailable.refreshICloudState()
        XCTAssertEqual(unavailable.iCloudState, .noAccount)

        repository.cloudSyncEnabled = false
        var queried = false
        let disabled = try AtlasViewModel(repository: repository, iCloudAccountStatus: { queried = true; return .available })
        await disabled.refreshICloudState()
        XCTAssertEqual(disabled.iCloudState, .disabled)
        XCTAssertFalse(queried)
    }
    func testViewModelSmartConfirmationDefersSaveAndRejectsStalePlan() async throws {
        let repository = MemoryRepository(), a = AtlasPerson(name: "A", gender: .male), c = AtlasPerson(name: "C", gender: .male), d = AtlasPerson(name: "D", gender: .female)
        repository.snapshot = try AtlasRules.adding(RelationDraft(sourceID: c.id, targetID: a.id, kind: .son), to: AtlasSnapshot(people: [a, c, d]))
        let model = try AtlasViewModel(repository: repository)
        XCTAssertFalse(model.saveRelation(RelationDraft(sourceID: d.id, targetID: a.id, kind: .daughter)))
        XCTAssertNotNil(model.pendingPlan)
        XCTAssertEqual(repository.saves, 0)
        XCTAssertEqual(model.network.pairs.count, 1)
        XCTAssertTrue(model.savePerson(AtlasPerson(name: "Newer edit", gender: .male)))
        XCTAssertFalse(model.confirmPlan([:]))
        XCTAssertNil(model.pendingPlan)
        XCTAssertEqual(model.network.people.count, 4)
    }
    func testImportNeedsConfirmationAndSearchAndSelectionsStayConsistent() async throws {
        let repository = MemoryRepository(), model = try AtlasViewModel(repository: repository)
        let a = AtlasPerson(name: "小明", gender: .male, notes: "Family"), b = AtlasPerson(name: "Alice", gender: .female)
        model.prepareImport(try AtlasBackup(network: AtlasSnapshot(people: [a, b])).encoded())
        XCTAssertTrue(model.network.people.isEmpty)
        XCTAssertTrue(model.confirmImport())
        model.search = "family"; XCTAssertEqual(model.people.map(\.id), [a.id])
        model.genderFilter = .female; XCTAssertTrue(model.people.isEmpty)
        model.selectedPersonID = a.id
        XCTAssertTrue(model.deletePerson(a.id)); XCTAssertNil(model.selectedPersonID)
        model.prepareImport(Data("invalid".utf8)); XCTAssertNil(model.pendingImport)
        XCTAssertEqual(model.network.people.map(\.id), [b.id])
    }
    func testInvalidBackupClearsAnyEarlierUnconfirmedImport() async throws {
        let model = try AtlasViewModel(repository: MemoryRepository())
        model.prepareImport(try AtlasBackup(network: AtlasSnapshot()).encoded())
        XCTAssertNotNil(model.pendingImport)
        model.prepareImport(Data("bad".utf8))
        XCTAssertNil(model.pendingImport)
        XCTAssertFalse(model.confirmImport())
    }
    func testImportUsesTheSnapshotShownInTheConfirmationEvenAfterDismissal() async throws {
        let repository = MemoryRepository(), model = try AtlasViewModel(repository: repository)
        let saved = AtlasSnapshot(people: [AtlasPerson(name: "Confirmed backup", gender: .female)])
        model.prepareImport(try AtlasBackup(network: saved).encoded())
        let confirmed = try XCTUnwrap(model.pendingImport)
        model.pendingImport = nil // The system dismisses the alert before running its action.
        XCTAssertTrue(model.confirmImport(confirmed))
        XCTAssertEqual(model.network, confirmed)
        XCTAssertEqual(repository.saves, 1)
    }
    func testNewRelationshipRequestClearsOldPreviewAndError() async throws {
        let repository = MemoryRepository()
        let father = AtlasPerson(name: "Father", gender: .male)
        let son = AtlasPerson(name: "Son", gender: .male)
        let daughter = AtlasPerson(name: "Daughter", gender: .female)
        let existing = RelationDraft(sourceID: son.id, targetID: father.id, kind: .son)
        repository.snapshot = try AtlasRules.adding(existing, to: AtlasSnapshot(people: [father, son, daughter]))
        let model = try AtlasViewModel(repository: repository)
        let requested = RelationDraft(sourceID: daughter.id, targetID: father.id, kind: .daughter)
        XCTAssertFalse(model.saveRelation(requested))
        XCTAssertEqual(model.pendingPlan?.original, requested)
        XCTAssertFalse(model.saveRelation(existing))
        XCTAssertNil(model.pendingPlan, "An invalid new draft must not display an older family's preview")
        XCTAssertNotNil(model.error)
        XCTAssertFalse(model.saveRelation(requested))
        XCTAssertNil(model.error, "A valid confirmation must not keep an earlier duplicate error")
        XCTAssertEqual(repository.saves, 0)
        XCTAssertTrue(model.saveRelation(RelationDraft(sourceID: daughter.id, targetID: son.id, kind: .olderSister)))
        XCTAssertNil(model.pendingPlan)
        XCTAssertEqual(repository.saves, 1)
        XCTAssertEqual(model.network.pairs.count, 3)
    }
    func testSmartConfirmationFailureCanRetryWithoutPartialFamilyWrites() async throws {
        let repository = MemoryRepository()
        let father = AtlasPerson(name: "A", gender: .male), mother = AtlasPerson(name: "B", gender: .female)
        let son = AtlasPerson(name: "C", gender: .male), daughter = AtlasPerson(name: "D", gender: .female)
        var base = AtlasSnapshot(people: [father, mother, son, daughter])
        for draft in [RelationDraft(sourceID: father.id, targetID: mother.id, kind: .husband),
                      RelationDraft(sourceID: son.id, targetID: father.id, kind: .son)] {
            base = try AtlasRules.adding(draft, to: base)
        }
        repository.snapshot = base
        let model = try AtlasViewModel(repository: repository)
        XCTAssertFalse(model.saveRelation(RelationDraft(sourceID: daughter.id, targetID: father.id, kind: .daughter)))
        let plan = try XCTUnwrap(model.pendingPlan), question = try XCTUnwrap(plan.questions.first)
        XCTAssertFalse(model.confirmPlan([:]))
        XCTAssertEqual(model.network, base)
        repository.failSave = true
        XCTAssertFalse(model.confirmPlan([question.id: "olderSister"]))
        XCTAssertEqual(repository.snapshot, base)
        XCTAssertEqual(model.network, base)
        XCTAssertNotNil(model.pendingPlan)
        repository.failSave = false
        XCTAssertTrue(model.confirmPlan([question.id: "olderSister"]))
        XCTAssertNil(model.pendingPlan)
        XCTAssertEqual(repository.saves, 1)
        XCTAssertEqual(model.network.pairs.count, 5)
        try AtlasRules.validate(model.network)
    }
    func testImportFailureKeepsOriginalAndCanRetryWithNoStaleError() async throws {
        let repository = MemoryRepository(), model = try AtlasViewModel(repository: repository)
        XCTAssertTrue(model.savePerson(AtlasPerson(name: "Original", gender: .male)))
        let original = model.network
        let imported = AtlasSnapshot(people: [AtlasPerson(name: "Backup", gender: .female)])
        model.prepareImport(Data("bad".utf8))
        XCTAssertNotNil(model.error)
        model.prepareImport(try AtlasBackup(network: imported).encoded())
        XCTAssertNil(model.error)
        repository.failSave = true
        XCTAssertFalse(model.confirmImport())
        XCTAssertEqual(model.network, original)
        XCTAssertEqual(repository.snapshot, original)
        XCTAssertNotNil(model.pendingImport)
        repository.failSave = false
        XCTAssertTrue(model.confirmImport())
        XCTAssertEqual(model.network.people.map(\.id), imported.people.map(\.id))
        XCTAssertNil(model.pendingImport)
        XCTAssertNil(model.error)
    }

    func testSpouseCompletionSavesAtomicallyAndCanBeDisabled() async throws {
        let father = AtlasPerson(name: "A", gender: .male), son = AtlasPerson(name: "B", gender: .male), mother = AtlasPerson(name: "C", gender: .female)
        let base = try AtlasRules.adding(RelationDraft(sourceID: father.id, targetID: son.id, kind: .father), to: AtlasSnapshot(people: [father, son, mother]))
        let spouse = RelationDraft(sourceID: mother.id, targetID: father.id, kind: .wife)
        let repository = MemoryRepository(); repository.snapshot = base
        let model = try AtlasViewModel(repository: repository)
        repository.failSave = true
        XCTAssertFalse(model.saveRelation(spouse))
        XCTAssertEqual(model.network, base)
        XCTAssertEqual(repository.snapshot, base)
        repository.failSave = false
        XCTAssertTrue(model.saveRelation(spouse))
        XCTAssertNil(model.pendingPlan)
        XCTAssertEqual(repository.saves, 1)
        XCTAssertEqual(model.network.pairs.count, 3)
        XCTAssertTrue(model.network.relations.contains { $0.sourceID == son.id && $0.targetID == mother.id && $0.kind == .son })
        let plainRepository = MemoryRepository(); plainRepository.snapshot = base
        let plain = try AtlasViewModel(repository: plainRepository)
        XCTAssertTrue(plain.saveRelation(spouse, smart: false))
        XCTAssertEqual(plain.network.pairs.count, 2)
        XCTAssertFalse(plain.network.relations.contains { $0.sourceID == son.id && $0.targetID == mother.id })
    }
}
