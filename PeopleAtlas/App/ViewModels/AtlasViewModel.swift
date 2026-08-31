import Foundation
import Observation
import CloudKit

enum ICloudAccountState: Equatable {
    case disabled, checking, available, noAccount, restricted, temporarilyUnavailable, couldNotDetermine
}

@Observable @MainActor final class AtlasViewModel {
    private let repository: any AtlasRepository
    @ObservationIgnored private let iCloudAccountStatus: () async throws -> CKAccountStatus
    private(set) var network: AtlasSnapshot
    private(set) var iCloudState: ICloudAccountState
    var search = ""
    var genderFilter: Gender?
    var selectedPersonID: UUID?
    var selectedRelationID: UUID?
    var language: AppLanguage = .system
    var error: String?
    var notice: String?
    var pendingPlan: SmartPlan?
    var pendingImport: AtlasSnapshot?

    init(
        repository: any AtlasRepository,
        iCloudAccountStatus: @escaping () async throws -> CKAccountStatus = {
            try await CKContainer(identifier: AtlasCloud.containerIdentifier).accountStatus()
        }
    ) throws {
        self.repository = repository
        self.iCloudAccountStatus = iCloudAccountStatus
        self.network = try repository.load()
        self.iCloudState = repository.cloudSyncEnabled ? .checking : .disabled
    }
    func text(_ key: String) -> String { L10n.text(key, language: language) }
    func title(_ kind: RelationKind) -> String { text(kind.rawValue) }
    var people: [AtlasPerson] {
        network.people.filter {
            (genderFilter == nil || $0.gender == genderFilter)
            && (search.isEmpty || $0.name.localizedStandardContains(search) || $0.notes.localizedStandardContains(search))
        }.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }
    func description(_ relation: AtlasRelation) -> String {
        guard let a = network.person(relation.sourceID), let b = network.person(relation.targetID) else { return "" }
        return language.code == "zh-Hans" ? "\(a.name) 是 \(b.name) 的\(title(relation.kind))" : "\(a.name) is \(b.name)’s \(title(relation.kind).lowercased())"
    }
    var cloudSyncEnabled: Bool { repository.cloudSyncEnabled }

    func refreshICloudState() async {
        guard cloudSyncEnabled else { iCloudState = .disabled; return }
        iCloudState = .checking
        do {
            switch try await iCloudAccountStatus() {
            case .available: iCloudState = .available
            case .noAccount: iCloudState = .noAccount
            case .restricted: iCloudState = .restricted
            case .temporarilyUnavailable: iCloudState = .temporarilyUnavailable
            case .couldNotDetermine: iCloudState = .couldNotDetermine
            @unknown default: iCloudState = .couldNotDetermine
            }
        } catch {
            iCloudState = .couldNotDetermine
        }
    }

    /// Pull CloudKit imports into the value snapshot without replacing valid visible data on failure.
    func refreshFromStore() {
        do { publish(try repository.load()) }
        catch { report(error) }
    }

    private func publish(_ snapshot: AtlasSnapshot) {
        network = snapshot
        if let id = selectedPersonID, snapshot.person(id) == nil { selectedPersonID = nil }
        if let id = selectedRelationID, !snapshot.relations.contains(where: { $0.id == id }) { selectedRelationID = nil }
    }

    /// Re-read before every mutation so a stale window cannot silently replace newer cloud imports.
    /// The published snapshot only changes once local persistence succeeds.
    @discardableResult private func commit(_ operation: (AtlasSnapshot) throws -> AtlasSnapshot) -> Bool {
        do {
            let base = try repository.load()
            if base != network { publish(base) }
            let next = try operation(base)
            try repository.replace(with: next)
            publish(next)
            error = nil; notice = text("Saved on this device")
            return true
        } catch { report(error); return false }
    }
    func report(_ caught: Error) {
        error = (caught as? AtlasError).map { text($0.rawValue) } ?? text("Unable to save or read data. Your existing data has not been replaced. Please try again.")
    }
    @discardableResult func savePerson(_ person: AtlasPerson) -> Bool {
        commit { try AtlasRules.savingPerson(person, in: $0) }
    }
    @discardableResult func deletePerson(_ id: UUID) -> Bool {
        commit { AtlasRules.removingPerson(id, from: $0) }
    }
    @discardableResult func deleteRelation(_ id: UUID) -> Bool {
        commit { AtlasRules.removingRelation(id, from: $0) }
    }
    @discardableResult func saveRelation(_ draft: RelationDraft, editing id: UUID? = nil, smart: Bool = true) -> Bool {
        // A new request must never reuse a preview or error from a previous form.
        pendingPlan = nil
        error = nil
        if let id { return commit { try AtlasRules.updatingRelation(id, draft: draft, in: $0) } }
        if !smart { return commit { try AtlasRules.adding(draft, to: $0) } }
        do {
            let base = try repository.load()
            publish(base)
            let plan = try SmartRelationships.plan(draft, in: base)
            if plan.requiresConfirmation { pendingPlan = plan; return false }
            return commit {
                guard $0 == plan.base else { throw AtlasError.dataChanged }
                return plan.proposed
            }
        } catch { report(error); return false }
    }
    @discardableResult func confirmPlan(_ choices: [String: String]) -> Bool {
        guard let plan = pendingPlan else { return false }
        let success = confirm(plan: plan, choices: choices)
        if success || plan.base != network { pendingPlan = nil }
        return success
    }
    @discardableResult func confirm(plan: SmartPlan, choices: [String: String]) -> Bool {
        // A stale preview must not overwrite newer edits (e.g. from another window).
        guard plan.base == network else { error = text("Data changed. Please reopen the relationship form."); return false }
        return commit {
            guard $0 == plan.base else { throw AtlasError.dataChanged }
            return try plan.resolved(choices: choices)
        }
    }
    func prepareImport(_ data: Data) {
        pendingImport = nil
        error = nil
        do { pendingImport = try AtlasBackup.decode(data) } catch { report(error) }
    }
    @discardableResult func confirmImport(_ confirmedSnapshot: AtlasSnapshot? = nil) -> Bool {
        // SwiftUI may clear the presentation binding before invoking an alert action.
        // Use the snapshot shown in that alert, not a newly selected or cleared payload.
        guard let imported = confirmedSnapshot ?? pendingImport else { return false }
        let success = commit { _ in imported }
        if success { pendingImport = nil }
        return success
    }
    func exportData() throws -> Data { try AtlasBackup(network: network).encoded() }
}
