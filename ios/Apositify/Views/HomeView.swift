import SwiftUI
import UIKit

struct HomeView: View {
    @EnvironmentObject private var registers: RegisterStore
    @StateObject private var scan = ScanCoordinator()
    @State private var showsCamera = false
    @State private var showsPhotos = false
    @State private var showsReview = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    hero
                    scanCard
                    directoryCard
                    privacyCard
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Apostifi")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showsCamera) {
                DocumentScannerView(
                    onComplete: { image in
                        showsCamera = false
                        scan.process(image, entries: registers.entries)
                    },
                    onCancel: { showsCamera = false },
                    onError: { error in
                        showsCamera = false
                        scan.errorMessage = error.localizedDescription
                    }
                )
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showsPhotos) {
                PhotoLibraryPicker(
                    onComplete: { image in
                        showsPhotos = false
                        scan.process(image, entries: registers.entries)
                    },
                    onCancel: { showsPhotos = false }
                )
                .ignoresSafeArea()
            }
            .navigationDestination(isPresented: $showsReview) {
                if let outcome = scan.outcome {
                    switch outcome {
                    case .qr(let match):
                        QrReviewView(match: match, previewImage: scan.image, onStartOver: startOver)
                    case .text(let recognition, let detectedQrPayloads):
                    ReviewScanView(
                        recognition: recognition,
                        detectedQrPayloads: detectedQrPayloads,
                        previewImage: scan.image,
                        entries: registers.entries,
                        onStartOver: startOver
                    )
                    }
                }
            }
            .onChange(of: scan.outcome) { _, outcome in
                showsReview = outcome != nil
            }
            .alert("Couldn’t read this scan", isPresented: errorIsPresented) {
                Button("OK", role: .cancel) { scan.errorMessage = nil }
            } message: {
                Text(scan.errorMessage ?? "Try taking another photo.")
            }
            .overlay {
                if scan.isProcessing { processingOverlay }
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Official sources only", systemImage: "checkmark.shield.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.9))
            Text("Scan an Apostille.\nFind its official verifier.")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
            Text("Your certificate is read on this iPhone and never uploaded. The verification itself happens on the issuing authority\u{2019}s official website.")
                .font(.body)
                .foregroundStyle(.white.opacity(0.82))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(26)
        .background(
            LinearGradient(
                colors: [Color(red: 0.05, green: 0.15, blue: 0.30), Color("BrandBlue")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 28, style: .continuous)
        )
        .shadow(color: Color.blue.opacity(0.18), radius: 20, y: 10)
    }

    private var scanCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Start with a clear, flat document", systemImage: "doc.viewfinder")
                .font(.headline)
            Text("Include the title \u{201C}Apostille\u{201D} and numbered items 1\u{2013}10. Avoid glare over seals and security codes.")
                .foregroundStyle(.secondary)

            Button {
                showsCamera = true
            } label: {
                Label("Scan with camera", systemImage: "camera.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))

            Button {
                showsPhotos = true
            } label: {
                Label("Choose existing photos", systemImage: "photo.on.rectangle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            if let error = registers.loadError {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
        }
        .cardStyle()
    }

    private var directoryCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Can\u{2019}t scan it?", systemImage: "magnifyingglass")
                .font(.headline)
            Text("Look the authority up by name and go straight to its official verifier.")
                .foregroundStyle(.secondary)
            NavigationLink {
                DirectoryView(entries: registers.entries, onScanQr: { showsCamera = true })
            } label: {
                Label("Find your authority", systemImage: "list.bullet.rectangle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
        }
        .cardStyle()
    }

    private var privacyCard: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "lock.fill")
                .foregroundStyle(Color("BrandBlue"))
            VStack(alignment: .leading, spacing: 5) {
                Text("Private by design").font(.headline)
                Text("Recognition happens on this device. Scans are not uploaded or retained by Apostifi.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .cardStyle()
    }

    private var processingOverlay: some View {
        ZStack {
            Color.black.opacity(0.32).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView().controlSize(.large)
                Text("Reading your document…").font(.headline)
                Text("This happens on your device. Nothing is uploaded.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(28)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
        }
    }

    private var errorIsPresented: Binding<Bool> {
        Binding(
            get: { scan.errorMessage != nil },
            set: { if !$0 { scan.errorMessage = nil } }
        )
    }

    private func startOver() {
        showsReview = false
        scan.reset()
    }
}

extension View {
    func cardStyle() -> some View {
        frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
