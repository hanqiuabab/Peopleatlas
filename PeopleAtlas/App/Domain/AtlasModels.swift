import Foundation

enum Gender: String, Codable, CaseIterable, Sendable { case male, female }

/// A relationship describes its source person, not the target (A is B's father).
enum RelationKind: String, Codable, CaseIterable, Sendable {
    case father, mother, husband, wife, son, daughter
    case olderBrother, olderSister, youngerBrother, youngerSister, colleague

    var gender: Gender? {
        switch self {
        case .father, .husband, .son, .olderBrother, .youngerBrother: .male
        case .mother, .wife, .daughter, .olderSister, .youngerSister: .female
        case .colleague: nil
        }
    }
    var isParent: Bool { self == .father || self == .mother }
    var isChild: Bool { self == .son || self == .daughter }
    var isSpouse: Bool { self == .husband || self == .wife }
    var isSibling: Bool { [.olderBrother, .olderSister, .youngerBrother, .youngerSister].contains(self) }
    var levelDelta: Int { isParent ? 1 : isChild ? -1 : 0 }
    var proximity: Double { isSpouse ? 12 : isSibling ? 8 : (isParent || isChild) ? 5 : 1 }

    func inverse(targetGender: Gender) -> Self {
        switch self {
        case .father, .mother: targetGender == .male ? .son : .daughter
        case .son, .daughter: targetGender == .male ? .father : .mother
        case .husband: .wife
        case .wife: .husband
        case .olderBrother, .olderSister: targetGender == .male ? .youngerBrother : .youngerSister
        case .youngerBrother, .youngerSister: targetGender == .male ? .olderBrother : .olderSister
        case .colleague: .colleague
        }
    }
    func matches(_ source: Gender, _ target: Gender) -> Bool {
        (gender == nil || gender == source)
        && (inverse(targetGender: target).gender == nil || inverse(targetGender: target).gender == target)
    }
    /// Gender edits preserve the semantic family (parent/child/older/younger).
    func adjusted(to gender: Gender) -> Self {
        switch self {
        case .father, .mother: gender == .male ? .father : .mother
        case .son, .daughter: gender == .male ? .son : .daughter
        case .husband, .wife: gender == .male ? .husband : .wife
        case .olderBrother, .olderSister: gender == .male ? .olderBrother : .olderSister
        case .youngerBrother, .youngerSister: gender == .male ? .youngerBrother : .youngerSister
        case .colleague: .colleague
        }
    }
}

struct AtlasPerson: Identifiable, Codable, Equatable, Sendable {
    var id: UUID = UUID()
    var name: String
    var gender: Gender
    var notes: String = ""
    var createdAt: Date = Date()
    var updatedAt: Date = Date()
}

struct AtlasRelation: Identifiable, Codable, Equatable, Sendable {
    var id: UUID = UUID()
    var inverseID: UUID
    var sourceID: UUID
    var targetID: UUID
    var kind: RelationKind
    var createdAt: Date = Date()
}

struct RelationDraft: Equatable, Sendable {
    var sourceID: UUID
    var targetID: UUID
    var kind: RelationKind
}

struct AtlasSnapshot: Codable, Equatable, Sendable {
    var people: [AtlasPerson] = []
    var relations: [AtlasRelation] = []
    func person(_ id: UUID) -> AtlasPerson? { people.first { $0.id == id } }
    var pairs: [AtlasRelation] { relations.filter { $0.id.uuidString < $0.inverseID.uuidString } }
    func connections(for id: UUID) -> [AtlasRelation] { relations.filter { $0.sourceID == id } }
}

enum AtlasError: String, Error, LocalizedError, Sendable {
    case invalidName = "Enter a name of 1–30 characters."
    case longNotes = "Notes must not exceed 2,000 characters."
    case missingPerson = "Select two existing people."
    case selfRelation = "A person cannot have a relationship with themselves."
    case incompatibleGender = "The relationship does not match the selected genders."
    case duplicate = "This relationship already exists."
    case invalidBackup = "This backup is invalid or uses an unsupported format."
    case confirmationRequired = "Choose or skip every uncertain sibling relationship."
    case missingRelation = "This relationship no longer exists."
    case dataChanged = "Data changed on another device. Please try again."
    var errorDescription: String? { L10n.text(rawValue) }
}
