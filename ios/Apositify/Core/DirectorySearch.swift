import Foundation

/// Finding an authority by name, for the directory the app offers when
/// scanning cannot get there.
enum DirectorySearch {
    /// Matches on either half of the name, so "ontario" and "canada" both find
    /// it, and orders by country then authority so the list reads consistently.
    static func matching(_ query: String, in entries: [RegisterEntry]) -> [RegisterEntry] {
        let ordered = entries.sorted {
            ($0.country, $0.authority) < ($1.country, $1.authority)
        }
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return ordered }
        return ordered.filter {
            $0.country.lowercased().contains(needle) || $0.authority.lowercased().contains(needle)
        }
    }
}
