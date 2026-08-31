import SwiftUI

enum AtlasDesign {
    static let accent = Color(red: 0.16, green: 0.40, blue: 0.48)
    static let warm = Color(red: 0.61, green: 0.30, blue: 0.08)
    /// Keeps supporting copy above WCAG-style contrast thresholds on both
    /// system backgrounds while remaining visually subordinate to primary text.
    static let secondaryText = Color.primary
    static let columns = [GridItem(.adaptive(minimum: 180, maximum: 320), spacing: 16, alignment: .top)]
}

struct AtlasCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content.padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(.background, in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(.primary.opacity(0.07)))
    }
}

struct PersonAvatar: View {
    let person: AtlasPerson
    var size: CGFloat = 56
    var body: some View {
        Text(String(person.name.prefix(1))).font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
            .foregroundStyle(person.gender == .male ? AtlasDesign.accent : AtlasDesign.warm)
            .frame(width: size, height: size)
            .background((person.gender == .male ? AtlasDesign.accent : AtlasDesign.warm).opacity(0.12), in: Circle())
            .accessibilityHidden(true)
    }
}

struct AtlasEmpty: View {
    @Environment(AtlasViewModel.self) private var model
    let title: String
    let detail: String
    let symbol: String
    var body: some View {
        ContentUnavailableView(model.text(title), systemImage: symbol, description: Text(model.text(detail)))
            .frame(maxWidth: .infinity, minHeight: 240)
    }
}
