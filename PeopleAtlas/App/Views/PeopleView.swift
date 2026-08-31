import SwiftUI

struct PeopleView: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var adding = false
    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(model.text("Every connection tells a story.")).font(.largeTitle.bold()).fixedSize(horizontal: false, vertical: true)
                    Text(model.text("Keep your people close. Build your personal atlas.")).foregroundStyle(AtlasDesign.secondaryText)
                }.padding(.top, 12)
                HStack(spacing: 14) {
                    stat("People", value: model.network.people.count, symbol: "person.2")
                    stat("Connections", value: model.network.pairs.count, symbol: "point.3.connected.trianglepath.dotted")
                }
                Picker(model.text("Gender"), selection: $model.genderFilter) {
                    Text(model.text("Everyone")).tag(nil as Gender?)
                    ForEach(Gender.allCases, id: \.self) { Text(model.text($0.rawValue)).tag(Optional($0)) }
                }.pickerStyle(.segmented).frame(maxWidth: 420)
                if model.people.isEmpty {
                    AtlasEmpty(title: model.network.people.isEmpty ? "Your atlas starts with one person" : "No matching people", detail: model.network.people.isEmpty ? "Add someone to begin connecting your world." : "Try a different name or filter.", symbol: "person.crop.circle.badge.plus")
                    if model.network.people.isEmpty { Button(model.text("Add person")) { adding = true }.buttonStyle(.borderedProminent).frame(maxWidth: .infinity) }
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: dynamicTypeSize.isAccessibilitySize ? 260 : 150, maximum: 320), spacing: 16)], spacing: 16) {
                        ForEach(model.people) { person in
                            NavigationLink { PersonDetailView(personID: person.id) } label: {
                                AtlasCard {
                                    VStack(alignment: .leading, spacing: 16) {
                                        PersonAvatar(person: person)
                                        Text(person.name).font(.title3.weight(.semibold)).foregroundStyle(.primary).lineLimit(2)
                                        HStack {
                                            Label(model.text(person.gender.rawValue), systemImage: "person")
                                            Spacer()
                                            Label("\(model.network.connections(for: person.id).count)", systemImage: "link")
                                        }.font(.subheadline.weight(.medium)).foregroundStyle(.primary)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(person.name), \(model.text(person.gender.rawValue)), \(model.network.connections(for: person.id).count) \(model.text("Connections"))")
                            .accessibilityIdentifier("person.\(person.name)")
                        }
                    }
                }
                Label(model.text("Private by design. Stored in your personal atlas."), systemImage: "lock.shield").font(.footnote).foregroundStyle(AtlasDesign.secondaryText)
            }.padding(24).frame(maxWidth: 1400, alignment: .leading).frame(maxWidth: .infinity)
        }
        .background(.quaternary.opacity(0.35))
        .safeAreaInset(edge: .bottom) {
            if horizontalSizeClass == .compact { Color.clear.frame(height: 88).accessibilityHidden(true) }
        }
        .navigationTitle(model.text("People"))
        // Search bars remain single-line at accessibility sizes. A compact prompt
        // avoids clipping while the navigation title preserves its people context.
        .searchable(text: $model.search, prompt: model.text("Search"))
        .toolbar { Button { adding = true } label: { Label(model.text("Add person"), systemImage: "plus") }.accessibilityIdentifier("addPerson") }
        .sheet(isPresented: $adding) { PersonEditor() }
    }
    private func stat(_ title: String, value: Int, symbol: String) -> some View {
        AtlasCard {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: symbol).foregroundStyle(AtlasDesign.accent).accessibilityHidden(true)
                Text(value, format: .number).font(.largeTitle.bold().monospacedDigit())
                Text(model.text(title)).font(.subheadline).foregroundStyle(AtlasDesign.secondaryText)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(model.text(title)): \(value)")
        }
    }
}

struct PersonEditor: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var existing: AtlasPerson?
    @State private var name = ""
    @State private var gender: Gender = .male
    @State private var notes = ""
    @State private var initialized = false
    var body: some View {
        NavigationStack {
            Form {
                Section(model.text("Personal details")) {
                    TextField(model.text("Name"), text: $name).accessibilityIdentifier("personName")
                    Picker(model.text("Gender"), selection: $gender) {
                        ForEach(Gender.allCases, id: \.self) { Text(model.text($0.rawValue)).tag($0) }
                    }.accessibilityIdentifier("personGender")
                }
                Section(model.text("Notes")) { TextEditor(text: $notes).frame(minHeight: 100).accessibilityLabel(model.text("Notes")) }
                Section { Text(model.text("Stored privately with optional iCloud synchronization. No contact access is required.")).foregroundStyle(AtlasDesign.secondaryText) }
                if let error = model.error { Section { Label(error, systemImage: "exclamationmark.circle").foregroundStyle(.red) } }
            }
            .formStyle(.grouped)
            .navigationTitle(model.text(existing == nil ? "Add person" : "Edit person"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(model.text("Cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(model.text("Save")) {
                        var person = existing ?? AtlasPerson(name: name, gender: gender)
                        person.name = name; person.gender = gender; person.notes = notes
                        if model.savePerson(person) { dismiss() }
                    }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty).accessibilityIdentifier("savePerson")
                }
            }
        }
        .frame(minWidth: 320, idealWidth: 480, minHeight: 420)
        .onAppear { if !initialized { name = existing?.name ?? ""; gender = existing?.gender ?? .male; notes = existing?.notes ?? ""; initialized = true } }
    }
}

struct PersonDetailView: View {
    @Environment(AtlasViewModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let personID: UUID
    @State private var editing = false
    @State private var addingRelation = false
    @State private var deleting = false
    var body: some View {
        if let person = model.network.person(personID) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    AtlasCard {
                        HStack(spacing: 20) {
                            PersonAvatar(person: person, size: 80)
                            VStack(alignment: .leading, spacing: 8) {
                                Text(person.name).font(.largeTitle.bold())
                                Text(model.text(person.gender.rawValue)).foregroundStyle(AtlasDesign.secondaryText)
                            }
                        }
                        if !person.notes.isEmpty { Text(person.notes).padding(.top, 16).textSelection(.enabled) }
                    }
                    HStack {
                        Text(model.text("Connections")).font(.title2.bold())
                        Spacer()
                        Button { addingRelation = true } label: { Label(model.text("Add relationship"), systemImage: "plus") }.disabled(model.network.people.count < 2)
                    }
                    if model.network.connections(for: personID).isEmpty { AtlasEmpty(title: "No connections yet", detail: "Add a relationship to connect this person.", symbol: "link") }
                    ForEach(model.network.connections(for: personID)) { RelationCard(relation: $0) }
                    Button(model.text("Delete person"), role: .destructive) { deleting = true }.buttonStyle(.bordered).accessibilityIdentifier("deletePerson")
                }.padding(24).frame(maxWidth: 900).frame(maxWidth: .infinity)
            }
            .navigationTitle(person.name)
            .toolbar { Button(model.text("Edit")) { editing = true } }
            .sheet(isPresented: $editing) { PersonEditor(existing: person) }
            .sheet(isPresented: $addingRelation) { RelationshipEditor(preferredSource: personID) }
            .confirmationDialog(model.text("Delete this person and all their relationships?"), isPresented: $deleting, titleVisibility: .visible) {
                Button(model.text("Delete person"), role: .destructive) { if model.deletePerson(personID) { dismiss() } }.accessibilityIdentifier("confirmDeletePerson")
                Button(model.text("Cancel"), role: .cancel) {}
            }
        } else { AtlasEmpty(title: "Person not found", detail: "This person may have been deleted.", symbol: "person.crop.circle.badge.questionmark") }
    }
}
