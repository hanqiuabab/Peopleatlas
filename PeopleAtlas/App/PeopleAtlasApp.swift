import SwiftUI
import SwiftData
import Observation
import CoreData

@Observable @MainActor final class AppBootstrap {
    var model: AtlasViewModel?
    var failed = false
    let preferences: UserDefaults
    @ObservationIgnored private let repositoryFactory: (() throws -> any AtlasRepository)?
    init(repositoryFactory: (() throws -> any AtlasRepository)? = nil) {
        self.repositoryFactory = repositoryFactory
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--uitesting") {
            preferences = UserDefaults(suiteName: "PeopleAtlas.UITests")!
            preferences.set(ProcessInfo.processInfo.arguments.contains("--uitesting-chinese") ? "zh-Hans" : "en", forKey: "atlas.language")
            preferences.set(AppAppearance.system.rawValue, forKey: "atlas.appearance")
            preferences.set("ring", forKey: "atlas.graphStyle")
            preferences.set(false, forKey: "atlas.rotation")
        } else { preferences = .standard }
        #else
        preferences = .standard
        #endif
    }
    /// A failed store stays untouched. Retry is explicit; there is no empty-database fallback.
    func open() {
        // All windows share one model. A new window must not reopen the store or discard edits.
        guard model == nil else { return }
        do {
            if let repositoryFactory {
                model = try AtlasViewModel(repository: repositoryFactory())
                failed = false
                return
            }
            var inMemory = false
            #if DEBUG
            inMemory = ProcessInfo.processInfo.arguments.contains("--uitesting")
                || ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
            #endif
            let isQABuild = Bundle.main.bundleIdentifier?.hasSuffix(".qa") == true
            let cloudSyncEnabled = !inMemory && !isQABuild
            let container = try SwiftDataAtlasRepository.container(inMemory: inMemory, cloudSyncEnabled: cloudSyncEnabled)
            model = try AtlasViewModel(repository: SwiftDataAtlasRepository(container: container, cloudSyncEnabled: cloudSyncEnabled))
            #if DEBUG
            if inMemory && ProcessInfo.processInfo.arguments.contains("--uitesting-demo") {
                try loadTestFixture(container: container)
            }
            #endif
            failed = false
        } catch { failed = true }
    }
    #if DEBUG
    /// UI screenshot fixtures are opt-in and confined to an isolated memory-only store.
    private func loadTestFixture(container: ModelContainer) throws {
        // Existing interaction tests intentionally retain their stable Chinese names.
        // Store screenshots may opt into locale-matched names without changing the
        // relationship topology, deterministic IDs, or any production data path.
        let localizedStoreFixture = ProcessInfo.processInfo.arguments.contains("--uitesting-store-localized-demo")
        let names = localizedStoreFixture
            ? ["Ethan Lin", "Claire Su", "Leo Lin", "Mia Lin", "Noah Chen", "Ava Jiang", "Ryan Zhou", "Grace Shen"]
            : ["林远", "苏晴", "林辰", "林悦", "陈墨", "江宁", "周屿", "沈禾"]
        // Stable IDs make layout screenshots and gesture regressions reproducible. They
        // exist only in this opt-in, memory-only Debug fixture, never in a user's store.
        let people = names.enumerated().map {
            AtlasPerson(id: UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", $0.offset + 1))!,
                        name: $0.element, gender: $0.offset.isMultiple(of: 2) ? .male : .female)
        }
        var snapshot = AtlasSnapshot(people: people)
        for (a, b, kind) in [(0, 1, RelationKind.husband), (2, 0, .son), (2, 1, .son), (3, 0, .daughter), (3, 1, .daughter), (2, 3, .olderBrother), (4, 0, .colleague), (5, 1, .colleague), (6, 7, .husband)] {
            snapshot = try AtlasRules.adding(RelationDraft(sourceID: people[a].id, targetID: people[b].id, kind: kind), to: snapshot)
        }
        let repository = SwiftDataAtlasRepository(container: container)
        try repository.replace(with: snapshot)
        model = try AtlasViewModel(repository: repository)
    }
    #endif
}

@main struct PeopleAtlasApp: App {
    @State private var bootstrap: AppBootstrap
    init() {
        // Prepare the window's model before scene creation, rather than waiting for a loading
        // view to appear. Failure still presents the retry screen and never replaces the store.
        let bootstrap = AppBootstrap()
        bootstrap.open()
        _bootstrap = State(initialValue: bootstrap)
    }
    var body: some Scene {
        WindowGroup(id: "atlas-main") {
            AtlasLaunchView(bootstrap: bootstrap)
        }
        #if os(macOS)
        .defaultSize(width: 1160, height: 800)
        #endif
    }
}

/// Keep a stable window root while loading; scene creation must not depend on a transient branch.
private struct AtlasLaunchView: View {
    let bootstrap: AppBootstrap
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        ZStack {
            if let model = bootstrap.model { RootView().environment(model) }
            else if bootstrap.failed {
                ContentUnavailableView {
                    Label(L10n.text("Unable to open your data"), systemImage: "externaldrive.badge.exclamationmark")
                } description: { Text(L10n.text("Your saved data has not been deleted. Free some device storage and try again.")) }
                actions: { Button(L10n.text("Try again")) { bootstrap.open() } }
            } else { ProgressView() }
        }
        .tint(AtlasDesign.accent)
        .defaultAppStorage(bootstrap.preferences)
        .onReceive(NotificationCenter.default.publisher(for: .NSPersistentStoreRemoteChange)) { _ in
            bootstrap.model?.refreshFromStore()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { bootstrap.model?.refreshFromStore() }
        }
        #if os(macOS)
        .frame(minWidth: 820, minHeight: 620)
        #endif
    }
}
