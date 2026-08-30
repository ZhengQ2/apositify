import SwiftUI

/// The scan-first path has no answer for a certificate the camera cannot read,
/// or an authority whose verifier wants a value no Apostille prints. The
/// directory is the way through: pick the authority and go straight to its
/// official page — the same fallback the website offers.
struct DirectoryView: View {
    let entries: [RegisterEntry]
    let onScanQr: () -> Void

    @State private var query = ""

    private var matches: [RegisterEntry] {
        DirectorySearch.matching(query, in: entries)
    }

    var body: some View {
        List(matches) { entry in
            NavigationLink {
                AuthorityView(entry: entry, onScanQr: onScanQr)
            } label: {
                VStack(alignment: .leading, spacing: 3) {
                    Text(entry.country).font(.subheadline.weight(.semibold))
                    Text(entry.authority)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.vertical, 2)
            }
        }
        .searchable(text: $query, prompt: "Country or authority")
        .navigationTitle("Find your authority")
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if matches.isEmpty {
                ContentUnavailableView(
                    "No match",
                    systemImage: "magnifyingglass",
                    description: Text("The Convention has 126 parties; this directory covers the ones with a published verification route.")
                )
            }
        }
    }
}

/// What an authority offers, mirroring the website's directory: an official
/// page for most, a QR scan for the ones that publish nothing else, and an
/// honest explanation where verification means contacting them.
struct AuthorityView: View {
    let entry: RegisterEntry
    let onScanQr: () -> Void

    @State private var webSession: WebSession?
    @State private var insecureURL: URL?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                summary
                action
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(entry.country)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $webSession) { WebVerifierView(session: $0) }
        .alert("This verifier is not secure", isPresented: insecureIsPresented, presenting: insecureURL) { url in
            Button("Open in Safari") {
                UIApplication.shared.open(url)
                insecureURL = nil
            }
            Button("Cancel", role: .cancel) { insecureURL = nil }
        } message: { _ in
            Text("This authority only provides an unencrypted HTTP page. Its contents can be changed in transit, so Apostifi will not show it with official branding.")
        }
    }

    private var insecureIsPresented: Binding<Bool> {
        Binding(get: { insecureURL != nil }, set: { if !$0 { insecureURL = nil } })
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(entry.authority).font(.headline)
            if !entry.notes.isEmpty {
                Text(entry.notes).font(.subheadline).foregroundStyle(.secondary)
            }
            if let guide = entry.registerGuide {
                Text(guide.title).font(.subheadline.weight(.semibold))
                ForEach(Array(guide.steps.enumerated()), id: \.offset) { index, step in
                    Text("\(index + 1). \(step)").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .cardStyle()
    }

    @ViewBuilder
    private var action: some View {
        switch entry.verificationMode {
        case .qrOnly:
            guidance(
                icon: "qrcode.viewfinder",
                title: "Verified by QR code",
                body: "This authority publishes no lookup page. Its Apostille carries a QR code that resolves to the official record — scan the certificate and the app will follow it.",
                action: "Scan the QR code",
                perform: onScanQr
            )
        case .manualContact:
            guidance(
                icon: "envelope",
                title: "Contact the authority",
                body: "This authority has no online register. Verification means writing to them directly, so there is nothing for the app to open.",
                action: nil,
                perform: {}
            )
        case .sourceLinkMissing, .hybridLinkMissing:
            guidance(
                icon: "exclamationmark.triangle",
                title: "No official link recorded",
                body: "This authority verifies online, but no official URL has been confirmed for it yet. Opening an unverified page would defeat the point.",
                action: nil,
                perform: {}
            )
        default:
            links
        }
    }

    @ViewBuilder
    private var links: some View {
        let available = entry.registerLinks.isEmpty
            ? entry.registerUrl.map { [RegisterLink(label: "Open official verifier", url: $0)] } ?? []
            : entry.registerLinks
        if available.isEmpty {
            guidance(
                icon: "exclamationmark.triangle",
                title: "No official link recorded",
                body: "No official URL has been confirmed for this authority yet.",
                action: nil,
                perform: {}
            )
        } else {
            VStack(spacing: 12) {
                ForEach(available, id: \.url) { link in
                    Button {
                        open(link.url)
                    } label: {
                        Label(link.label.isEmpty ? "Open official verifier" : link.label, systemImage: "arrow.up.forward.app")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
                Text("The authority’s own page decides whether the Apostille is genuine. Nothing about your document is sent from here.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func guidance(
        icon: String,
        title: String,
        body: String,
        action: String?,
        perform: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(title, systemImage: icon).font(.headline)
            Text(body).font(.subheadline).foregroundStyle(.secondary)
            if let action {
                Button(action: perform) {
                    Text(action).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
        .cardStyle()
    }

    private func open(_ url: URL) {
        switch VerificationRouter.route(to: url) {
        case .official(let destination):
            webSession = WebSession(
                route: .official(destination),
                title: entry.authority,
                fields: [],
                isPrefilled: false,
                entry: entry
            )
        case .externalInsecure(let destination):
            insecureURL = destination
        default:
            UIApplication.shared.open(url)
        }
    }
}
