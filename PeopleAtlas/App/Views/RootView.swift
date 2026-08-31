import SwiftUI

enum AtlasSection: String, CaseIterable, Identifiable {
    case people = "People", graph = "Atlas", relations = "Relationships", settings = "Settings"
    var id: String { rawValue }
    var symbol: String {
        switch self { case .people: "person.2"; case .graph: "circle.hexagongrid"; case .relations: "point.3.connected.trianglepath.dotted"; case .settings: "slider.horizontal.3" }
    }
}

struct RootView: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @AppStorage("atlas.language") private var language = AppLanguage.system.rawValue
    @AppStorage("atlas.appearance") private var appearance = AppAppearance.system.rawValue
    @State private var section: AtlasSection? = .people
    var body: some View {
        @Bindable var model = model
        Group {
            #if os(iOS)
            // At accessibility sizes a narrow sidebar breaks words into unreadable fragments.
            if sizeClass == .compact || dynamicTypeSize.isAccessibilitySize {
                TabView {
                    ForEach(AtlasSection.allCases) { item in
                        NavigationStack { content(item) }.tabItem { Label(model.text(item.rawValue), systemImage: item.symbol) }
                    }
                }
            } else { split }
            #else
            split
            #endif
        }
        .onChange(of: language, initial: true) { _, value in model.language = AppLanguage(rawValue: value) ?? .system }
        .environment(\.locale, Locale(identifier: model.language.code))
        .preferredColorScheme((AppAppearance(rawValue: appearance) ?? .system).colorScheme)
        .alert(model.text("Something needs attention"), isPresented: Binding(get: { model.error != nil }, set: { if !$0 { model.error = nil } })) {
            Button(model.text("OK")) { model.error = nil }
        } message: { Text(model.error ?? "") }
    }
    private var split: some View {
        NavigationSplitView {
            List(AtlasSection.allCases, selection: $section) { item in
                Label(model.text(item.rawValue), systemImage: item.symbol).tag(item)
            }
            .navigationTitle(model.text("People Atlas"))
            .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 280)
        } detail: { NavigationStack { content(section ?? .people) } }
    }
    @ViewBuilder private func content(_ section: AtlasSection) -> some View {
        switch section {
        case .people: PeopleView()
        case .graph: GraphView()
        case .relations: RelationshipsView()
        case .settings: SettingsView()
        }
    }
}
