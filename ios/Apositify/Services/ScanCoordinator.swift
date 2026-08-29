import SwiftUI
import UIKit

@MainActor
final class ScanCoordinator: ObservableObject {
    @Published var isProcessing = false
    @Published var outcome: ScanOutcome?
    @Published var image: UIImage?
    @Published var errorMessage: String?

    func process(_ image: UIImage, entries: [RegisterEntry]) {
        self.image = nil
        isProcessing = true
        errorMessage = nil

        Task {
            do {
                let analysis = try await ApostilleRecognizer().analyze(image: image, entries: entries)
                self.image = analysis.previewImage
                outcome = analysis.outcome
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? "The scan could not be read."
            }
            isProcessing = false
        }
    }

    func reset() {
        outcome = nil
        image = nil
        errorMessage = nil
        isProcessing = false
    }
}
