import SwiftUI

struct RelationshipsView: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var adding = false
    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(model.text("The ties that bring us together")).font(.largeTitle.bold())
                Text(model.text("Each connection includes its reverse relationship.")).foregroundStyle(AtlasDesign.secondaryText)
                Picker(model.text("Filter by person"), selection: $model.selectedPersonID) {
                    Text(model.text("Everyone")).tag(nil as UUID?)
                    ForEach(model.network.people) { Text($0.name).tag(Optional($0.id)) }
                }.frame(maxWidth: 420)
                let connections = model.selectedPersonID.map { model.network.connections(for: $0) } ?? model.network.pairs
                if connections.isEmpty {
                    AtlasEmpty(title: "No connections yet", detail: model.network.people.count < 2 ? "Add at least two people to create a relationship." : "Add a relationship to connect this person.", symbol: "link")
                } else {
                    LazyVStack(spacing: 12) { ForEach(connections) { RelationCard(relation: $0) } }
                }
            }.padding(24).frame(maxWidth: 900).frame(maxWidth: .infinity)
        }
        .background(.quaternary.opacity(0.35))
        .safeAreaInset(edge: .bottom) {
            if horizontalSizeClass == .compact { Color.clear.frame(height: 88).accessibilityHidden(true) }
        }
        .navigationTitle(model.text("Relationships"))
        .toolbar {
            Button { adding = true } label: { Label(model.text("Add relationship"), systemImage: "plus") }
                .disabled(model.network.people.count < 2).accessibilityIdentifier("addRelationship")
        }
        .sheet(isPresented: $adding) { RelationshipEditor(preferredSource: model.selectedPersonID) }
    }
}

struct RelationCard: View {
    @Environment(AtlasViewModel.self) private var model
    let relation: AtlasRelation
    @State private var editing = false
    var body: some View {
        AtlasCard {
            HStack(spacing: 14) {
                Image(systemName: relation.kind.isSpouse ? "heart" : "link").font(.title2).foregroundStyle(AtlasDesign.accent)
                VStack(alignment: .leading, spacing: 6) {
                    Text(model.description(relation)).font(.headline)
                    if let inverse = model.network.relations.first(where: { $0.id == relation.inverseID }) {
                        Text(model.description(inverse)).font(.subheadline.weight(.medium)).foregroundStyle(.primary)
                    }
                }
                Spacer(minLength: 4)
                Menu {
                    Button(model.text("Edit"), systemImage: "pencil") { editing = true }
                    Button(model.text("Delete relationship"), systemImage: "trash", role: .destructive) { model.deleteRelation(relation.id) }
                } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44).contentShape(Rectangle()) }
                    .accessibilityLabel(model.text("Relationship actions"))
            }
        }
        .sheet(isPresented: $editing) { RelationshipEditor(existing: relation) }
    }
}

struct RelationshipEditor: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var existing: AtlasRelation?
    var preferredSource: UUID?
    @State private var sourceID: UUID?
    @State private var targetID: UUID?
    @State private var kind: RelationKind = .colleague
    @State private var smart = true
    @State private var initialized = false
    @State private var choices: [String: String] = [:]
    @State private var preview: SmartPlan?
    private var options: [RelationKind] { AtlasRules.options(source: sourceID.flatMap(model.network.person), target: targetID.flatMap(model.network.person)) }
    private var valid: Bool { sourceID != nil && targetID != nil && options.contains(kind) }
    private var answered: Bool { preview?.questions.allSatisfy { !(choices[$0.id] ?? "").isEmpty } ?? true }
    var body: some View {
        NavigationStack {
            Form {
                if let plan = preview { confirmation(plan) }
                else {
                    Section(model.text("Relationship")) {
                        personPicker("Person A", selection: $sourceID)
                        Picker(model.text("A is B’s…"), selection: $kind) {
                            ForEach(options, id: \.self) { Text(model.title($0)).tag($0) }
                            if options.isEmpty { Text(model.text("Choose two people first")).tag(RelationKind.colleague) }
                        }.disabled(options.isEmpty).accessibilityIdentifier("relationshipKind")
                        personPicker("Person B", selection: $targetID)
                    }
                    if existing == nil {
                        Section {
                            Toggle(model.text("Smart family connections"), isOn: $smart)
                            Text(model.text("A parent’s only spouse is treated as the other parent. Siblings share known parents. You choose any unknown age order.")).font(.footnote).foregroundStyle(AtlasDesign.secondaryText)
                        }
                    }
                    Section { Text(model.text("The reverse relationship is saved automatically.")).foregroundStyle(AtlasDesign.secondaryText) }
                }
                if let error = model.error { Section { Label(error, systemImage: "exclamationmark.circle").foregroundStyle(.red) } }
            }
            .formStyle(.grouped)
            .navigationTitle(model.text(preview == nil ? (existing == nil ? "Add relationship" : "Edit relationship") : "Confirm connections"))
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(model.text("Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(model.text("Save")) { save() }
                        .disabled(preview == nil ? !valid : !answered).accessibilityIdentifier("saveRelationship")
                }
            }
        }
        .frame(minWidth: 320, idealWidth: 520, minHeight: 480)
        .onAppear {
            guard !initialized else { return }
            sourceID = existing?.sourceID ?? preferredSource ?? model.network.people.first?.id
            targetID = existing?.targetID ?? model.network.people.first(where: { $0.id != sourceID })?.id
            kind = existing?.kind ?? .colleague
            initialized = true
        }
        .onChange(of: sourceID) { _, _ in normalizeKind() }
        .onChange(of: targetID) { _, _ in normalizeKind() }
    }
    private func personPicker(_ title: String, selection: Binding<UUID?>) -> some View {
        Picker(model.text(title), selection: selection) {
            Text(model.text("Select person")).tag(nil as UUID?)
            ForEach(model.network.people) { Text($0.name).tag(Optional($0.id)) }
        }.accessibilityIdentifier(title == "Person A" ? "relationshipSource" : "relationshipTarget")
    }
    private func normalizeKind() { if !options.contains(kind) { kind = options.first ?? .colleague } }
    private func save() {
        if let preview {
            if model.confirm(plan: preview, choices: choices) { dismiss() }
            else if preview.base != model.network { self.preview = nil; choices = [:] }
        } else if let sourceID, let targetID {
            if model.saveRelation(RelationDraft(sourceID: sourceID, targetID: targetID, kind: kind), editing: existing?.id, smart: smart) { dismiss() }
            else {
                // A preview belongs to this editor, never to another open window's form.
                preview = model.pendingPlan; model.pendingPlan = nil
            }
        }
    }
    @ViewBuilder private func confirmation(_ plan: SmartPlan) -> some View {
        Section {
            Text(model.text("Nothing is saved until you confirm. Choose an age order or skip each uncertain connection."))
            Button(model.text("Back to editing"), systemImage: "chevron.backward") {
                // Retain the user's draft, but recalculate suggestions on the next save.
                preview = nil
                choices = [:]
                model.error = nil
            }.accessibilityIdentifier("backToRelationshipEditing")
        }
        Section(model.text("Your relationship")) {
            Text(draftDescription(plan.original)).accessibilityIdentifier("smartOriginalRelationship")
        }
        if !plan.automatic.isEmpty {
            Section(model.text("Automatic connections")) {
                ForEach(Array(plan.automatic.enumerated()), id: \.offset) { _, draft in
                    Text(draftDescription(draft))
                }
            }
        }
        ForEach(plan.questions) { question in
            Section {
                Picker(model.text("Relationship"), selection: Binding(get: { choices[question.id] ?? "" }, set: { choices[question.id] = $0 })) {
                    Text(model.text("Choose relationship")).tag("")
                    ForEach(question.options, id: \.self) { Text(model.title($0)).tag($0.rawValue) }
                    Text(model.text("Skip this connection")).tag("skip")
                }.accessibilityLabel(questionTitle(question)).accessibilityIdentifier("smartQuestion.\(question.id)")
            } header: {
                // Names can be 30 characters long; do not squeeze both people beside the choice.
                Text(questionTitle(question)).textCase(nil).fixedSize(horizontal: false, vertical: true)
            }
        }
        if !plan.warnings.isEmpty {
            Section(model.text("Please review")) {
                ForEach(plan.warnings, id: \.self) { Label(model.text($0), systemImage: "exclamationmark.triangle").foregroundStyle(.orange) }
            }
        }
    }
    private func questionTitle(_ question: SiblingQuestion) -> String {
        let source = model.network.person(question.sourceID)?.name ?? ""
        let target = model.network.person(question.targetID)?.name ?? ""
        return model.language.code == "zh-Hans" ? "\(source) 是 \(target) 的…" : "\(source) is \(target)’s…"
    }
    private func draftDescription(_ draft: RelationDraft) -> String {
        model.description(AtlasRelation(id: UUID(), inverseID: UUID(), sourceID: draft.sourceID, targetID: draft.targetID, kind: draft.kind))
    }
}
