import Foundation
import SwiftUI

enum AppLanguage: String, CaseIterable, Identifiable, Sendable {
    case system, english = "en", chinese = "zh-Hans"
    var id: String { rawValue }
    var code: String {
        self == .system ? (Locale.preferredLanguages.first?.hasPrefix("zh") == true ? "zh-Hans" : "en") : rawValue
    }
    var label: String {
        switch self { case .system: "System language"; case .english: "English"; case .chinese: "简体中文" }
    }
}

enum AppAppearance: String, CaseIterable, Identifiable, Sendable {
    case system, light, dark
    var id: String { rawValue }
    var labelKey: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

/// An explicit bundle lets an in-app language change refresh every dynamic string immediately.
enum L10n {
    static func text(_ key: String, language: AppLanguage = .system) -> String {
        guard let path = Bundle.main.path(forResource: language.code, ofType: "lproj"),
              let bundle = Bundle(path: path) else { return key }
        return bundle.localizedString(forKey: key, value: key, table: "Localizable")
    }
}
