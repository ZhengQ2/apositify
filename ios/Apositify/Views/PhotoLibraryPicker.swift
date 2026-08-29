import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct PhotoLibraryPicker: UIViewControllerRepresentable {
    let onComplete: (UIImage) -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .images
        configuration.selectionLimit = 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: PhotoLibraryPicker

        init(parent: PhotoLibraryPicker) { self.parent = parent }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            guard !results.isEmpty else {
                parent.onCancel()
                return
            }
            Task {
                guard let provider = results.first?.itemProvider,
                      provider.hasItemConformingToTypeIdentifier(UTType.image.identifier),
                      let image = try? await provider.loadPreparedImage() else {
                    await MainActor.run { parent.onCancel() }
                    return
                }
                await MainActor.run { parent.onComplete(image) }
            }
        }
    }
}

private extension NSItemProvider {
    func loadPreparedImage() async throws -> UIImage {
        try await withCheckedThrowingContinuation { continuation in
            loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let url else {
                    continuation.resume(throwing: CocoaError(.fileReadCorruptFile))
                    return
                }
                do {
                    continuation.resume(returning: try ApostilleRecognizer.preparedImage(fromEncodedFileAt: url))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}
