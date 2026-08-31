import SwiftUI
import UniformTypeIdentifiers

struct AtlasBackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else { throw AtlasError.invalidBackup }
        self.data = data
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct SettingsView: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @AppStorage("atlas.language") private var language = AppLanguage.system.rawValue
    @AppStorage("atlas.appearance") private var appearance = AppAppearance.system.rawValue
    @State private var exporting = false
    @State private var importing = false
    @State private var document: AtlasBackupDocument?
    @State private var backupNotice: String?
    @State private var showingPrivacyPolicy = false
    var body: some View {
        Form {
            Section {
                Picker(model.text("Color scheme"), selection: $appearance) {
                    ForEach(AppAppearance.allCases) { Text(model.text($0.labelKey)).lineLimit(2).tag($0.rawValue) }
                }.accessibilityIdentifier("appAppearance")
                Picker(model.text("Language"), selection: $language) {
                    ForEach(AppLanguage.allCases) { Text($0 == .system ? model.text("System language") : $0.label).lineLimit(2).tag($0.rawValue) }
                }.accessibilityIdentifier("appLanguage")
            } header: { Text(model.text("Appearance")).foregroundStyle(.primary) }
                .headerProminence(.increased)
            Section {
                Label(model.text("Saved in People Atlas"), systemImage: "internaldrive").foregroundStyle(.primary)
                Text(model.text("Changes are saved on this device first and sync through your private iCloud database when iCloud is available.")).foregroundStyle(AtlasDesign.secondaryText)
                iCloudStatus
                Button { export() } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Image(systemName: "square.and.arrow.up").accessibilityHidden(true)
                        Text(model.text("Export backup")).lineLimit(nil).fixedSize(horizontal: false, vertical: true)
                    }
                }
                    .accessibilityLabel(model.text("Export backup"))
                    .accessibilityIdentifier("exportBackup")
                Button { importing = true } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Image(systemName: "square.and.arrow.down").accessibilityHidden(true)
                        Text(model.text("Import backup")).lineLimit(nil).fixedSize(horizontal: false, vertical: true)
                    }
                }
                    .accessibilityLabel(model.text("Import backup"))
                    .accessibilityIdentifier("importBackup")
                if let backupNotice { Text(backupNotice).foregroundStyle(AtlasDesign.accent).accessibilityIdentifier("backupNotice") }
                Text(model.text("Back up regularly. Removing the app or losing this device can remove local data. Backup files contain personal information; keep them somewhere safe."))
                    .font(.footnote).foregroundStyle(.primary)
            } header: { Text(model.text("Your data")).foregroundStyle(.primary) }
                .headerProminence(.increased)
            Section {
                Button { showingPrivacyPolicy = true } label: {
                    Label(model.text("Privacy policy"), systemImage: "doc.text")
                }
                .accessibilityIdentifier("privacyPolicy")
                Label(model.text("No app account. No tracking. No ads."), systemImage: "lock.shield").foregroundStyle(.primary)
                Text(model.text("People Atlas does not use a developer-operated server, access your contacts, or collect analytics. If iCloud is available, your records sync through Apple’s CloudKit service. You control what you record and share.")).foregroundStyle(.primary)
                Text(model.text("Exporting a backup shares only the file you choose. The destination service’s privacy policy applies to that copy.")).foregroundStyle(.primary)
            } header: { Text(model.text("Privacy")).foregroundStyle(.primary) }
                .headerProminence(.increased)
            Section {
                LabeledContent(model.text("People Atlas"), value: "\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"))")
                Text(model.text("A personal space for the people who matter.")).foregroundStyle(AtlasDesign.secondaryText)
            } header: { Text(model.text("About")).foregroundStyle(.primary) }
                .headerProminence(.increased)
        }
        .formStyle(.grouped)
        // A modal policy is the only active accessibility context. Keeping the dimmed form
        // exposed behind it makes VoiceOver navigation ambiguous and confuses iPadOS audits.
        .accessibilityHidden(showingPrivacyPolicy)
        .safeAreaInset(edge: .bottom) {
            if horizontalSizeClass == .compact { Color.clear.frame(height: 88).accessibilityHidden(true) }
        }
        .navigationTitle(model.text("Settings"))
        .task { await model.refreshICloudState() }
        .sheet(isPresented: $showingPrivacyPolicy) { PrivacyPolicyView() }
        .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "PeopleAtlas-\(Date.now.formatted(.iso8601.year().month().day().dateSeparator(.dash)))") { result in
            switch result {
            case .success: backupNotice = model.text("Backup exported")
            case .failure(let error): model.report(error)
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let granted = url.startAccessingSecurityScopedResource()
                defer { if granted { url.stopAccessingSecurityScopedResource() } }
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= 20_000_000 else { throw AtlasError.invalidBackup }
                model.prepareImport(try Data(contentsOf: url))
            } catch { model.report(error) }
        }
        .alert(model.text("Replace all local data with this backup?"), isPresented: Binding(get: { model.pendingImport != nil }, set: { if !$0 { model.pendingImport = nil } }), presenting: model.pendingImport) { imported in
            Button(model.text("Replace local data"), role: .destructive) {
                if model.confirmImport(imported) { backupNotice = model.text("Backup imported") }
            }
            Button(model.text("Cancel"), role: .cancel) { model.pendingImport = nil }
        } message: { imported in
            Text("\(model.text("People")): \(imported.people.count) · \(model.text("Connections")): \(imported.pairs.count)\n\n\(model.text("Existing people and relationships will be replaced. Export your current data first if you want to keep it."))")
        }
    }
    private func export() {
        do { document = AtlasBackupDocument(data: try model.exportData()); exporting = true }
        catch { model.report(error) }
    }

    @ViewBuilder private var iCloudStatus: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: iCloudStatusIcon)
                .foregroundStyle(model.iCloudState == .available ? AtlasDesign.accent : AtlasDesign.secondaryText)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(model.text("iCloud sync")).font(.headline)
                Text(model.text(iCloudStatusMessage)).foregroundStyle(AtlasDesign.secondaryText)
            }
            Spacer(minLength: 8)
            if model.iCloudState == .checking {
                ProgressView().controlSize(.small).accessibilityLabel(model.text("Checking iCloud availability"))
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("iCloudStatus")
        if model.cloudSyncEnabled && model.iCloudState != .checking {
            Button(model.text("Check iCloud again")) { Task { await model.refreshICloudState() } }
                .accessibilityIdentifier("refreshICloudStatus")
        }
    }

    private var iCloudStatusIcon: String {
        switch model.iCloudState {
        case .available: "icloud.fill"
        case .checking: "icloud"
        default: "icloud.slash"
        }
    }

    private var iCloudStatusMessage: String {
        switch model.iCloudState {
        case .disabled: "iCloud sync is not available in this build."
        case .checking: "Checking iCloud availability…"
        case .available: "iCloud is available. Changes sync automatically; this status does not confirm that every change has finished uploading."
        case .noAccount: "Sign in to iCloud in System Settings to sync across your devices. Local data remains available."
        case .restricted: "iCloud access is restricted on this device. Local data remains available."
        case .temporarilyUnavailable: "iCloud is temporarily unavailable. Changes remain on this device and will retry automatically."
        case .couldNotDetermine: "iCloud availability could not be determined. Changes remain on this device and will retry automatically."
        }
    }
}

/// A bundled policy keeps the app's current data practices available offline.
/// Store metadata still needs a public policy URL before submission.
private struct PrivacyPolicyView: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text(model.text("How People Atlas handles your information"))
                        .font(.title2.weight(.semibold))
                    policySection(
                        "Where your data is stored",
                        "Names, genders, notes, and relationships are stored locally with SwiftData. When iCloud is available, SwiftData also synchronizes them through your private CloudKit database so they can appear on your devices signed in to the same Apple Account."
                    )
                    policySection(
                        "Data we do not collect",
                        "People Atlas does not operate a developer server, access your contacts, collect analytics, show ads, or track you."
                    )
                    policySection(
                        "Backups and deletion",
                        "JSON backups are created only when you export them. They are not encrypted, so store and share them carefully. Deleting a person also deletes their relationships. Importing a backup replaces local data only after you confirm."
                    )
                    policySection(
                        "iCloud and other services",
                        "iCloud synchronization is provided by Apple and follows your iCloud settings and Apple’s privacy terms. People Atlas has no separate account and does not operate a server that receives your records. Device backups and file-storage services you choose follow their own privacy policies."
                    )
                    policySection(
                        "Your choices",
                        "You can edit or delete your records at any time. Only record personal information you are entitled to use. Removing the app or losing the device can remove local data, so back up regularly."
                    )
                    policySection(
                        "Privacy questions",
                        "Use the support contact on the App Store product page or support website for privacy questions."
                    )
                }
                .padding(24)
                .frame(maxWidth: 720, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle(model.text("Privacy policy"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(model.text("Done")) { dismiss() }
                        .accessibilityIdentifier("privacyPolicyClose")
                }
            }
        }
    }

    private func policySection(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.text(title))
                .font(.headline)
                .accessibilityIdentifier(title == "Where your data is stored" ? "privacyPolicyStorage" : "privacyPolicySection.\(title)")
            Text(model.text(body))
                .font(.body)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
