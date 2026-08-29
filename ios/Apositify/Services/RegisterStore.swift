import Combine
import Foundation

@MainActor
final class RegisterStore: ObservableObject {
    @Published private(set) var entries: [RegisterEntry] = []
    @Published private(set) var sourceUrl: URL?
    @Published private(set) var loadError: String?

    init(bundle: Bundle = .main) {
        do {
            guard let url = bundle.url(forResource: "e-registers", withExtension: "json") else {
                throw CocoaError(.fileNoSuchFile)
            }
            let catalog = try JSONDecoder().decode(RegisterCatalog.self, from: Data(contentsOf: url))
            entries = catalog.entries
            sourceUrl = catalog.sourceUrl
        } catch {
            loadError = "The verification directory could not be loaded."
        }
    }
}
