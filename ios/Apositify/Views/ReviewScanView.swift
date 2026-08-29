import SwiftUI
import UIKit

struct ReviewScanView: View {
    let recognition: RecognitionResult
    let detectedQrPayloads: [String]
    let previewImage: UIImage?
    let entries: [RegisterEntry]
    let onStartOver: () -> Void

    @State private var country: String
    @State private var selectedEntryID: String
    @State private var fields: [ExtractedField] = []
    @State private var webSession: WebSession?
    @State private var insecureExternalURL: URL?
    @State private var showsRecognizedText = false

    private let matches: [AuthorityMatch]

    init(
        recognition: RecognitionResult,
        detectedQrPayloads: [String],
        previewImage: UIImage?,
        entries: [RegisterEntry],
        onStartOver: @escaping () -> Void
    ) {
        self.recognition = recognition
        self.detectedQrPayloads = detectedQrPayloads
        self.previewImage = previewImage
        self.entries = entries
        self.onStartOver = onStartOver
        let matches = AuthorityMatcher(entries: entries).matches(for: recognition)
        self.matches = matches
        let initial = matches.first?.entry ?? entries.first
        _country = State(initialValue: initial?.country ?? "")
        _selectedEntryID = State(initialValue: initial?.id ?? "")
    }

    private var selectedEntry: RegisterEntry? {
        entries.first(where: { $0.id == selectedEntryID })
    }

    private var countries: [String] {
        Array(Set(entries.map(\.country))).sorted()
    }

    private var authorities: [RegisterEntry] {
        entries.filter { $0.country == country }.sorted { $0.authority < $1.authority }
    }

    private var fieldValues: [String: String] {
        Dictionary(uniqueKeysWithValues: fields.map { ($0.id, $0.value) })
    }

    private var hasFieldErrors: Bool {
        guard let config = selectedEntry?.verification, config.kind == .fields else { return false }
        return config.fields.contains {
            $0.captureSource == .document && FieldValidator.error(for: $0, value: fieldValues[$0.id, default: ""]) != nil
        }
    }

    private var insecureExternalURLIsPresented: Binding<Bool> {
        Binding(
            get: { insecureExternalURL != nil },
            set: { if !$0 { insecureExternalURL = nil } }
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                scanSummary
                authoritySection
                fieldsSection
                officialAction
                disclosureSection
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Review scan")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Start over", action: onStartOver)
            }
        }
        .onAppear(perform: refreshFields)
        .onChange(of: selectedEntryID) { _, _ in refreshFields() }
        .sheet(item: $webSession) { session in
            WebVerifierView(session: session)
        }
        .alert("This verifier is not secure", isPresented: insecureExternalURLIsPresented, presenting: insecureExternalURL) { url in
            Button("Open in Safari") {
                UIApplication.shared.open(url)
                insecureExternalURL = nil
            }
            Button("Cancel", role: .cancel) { insecureExternalURL = nil }
        } message: { _ in
            Text("This authority only provides an unencrypted HTTP page. Its contents can be changed in transit. Apostifi will open it outside the official verifier and will not send or autofill certificate values.")
        }
    }

    private var scanSummary: some View {
        HStack(spacing: 16) {
            if let previewImage {
                Image(uiImage: previewImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 72, height: 92)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            VStack(alignment: .leading, spacing: 6) {
                Label("Details read from your document", systemImage: "text.viewfinder")
                    .font(.headline)
                    .foregroundStyle(Color("BrandBlue"))
                Text("Review every highlighted value against the original before continuing.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if !detectedQrPayloads.isEmpty {
                    Label("We could not confirm where this QR code leads, so it was not opened. Use the details below instead.", systemImage: "qrcode")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
        }
        .cardStyle()
    }

    private var authoritySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Issuing authority").font(.headline)
            if let match = matches.first {
                HStack(alignment: .top) {
                    Image(systemName: match.score >= 0.8 ? "sparkles" : "questionmark.circle")
                        .foregroundStyle(Color("BrandBlue"))
                    Text(match.score >= 0.8 ? "Suggested from the document text" : "Best available text match")
                        .font(.subheadline)
                    Spacer()
                    Text("\(Int(match.score * 100))%")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            } else {
                Label("No confident match—choose the authority manually.", systemImage: "exclamationmark.triangle")
                    .font(.subheadline)
                    .foregroundStyle(.orange)
            }

            Menu {
                Picker("Country or jurisdiction", selection: $country) {
                    ForEach(countries, id: \.self) { Text($0).tag($0) }
                }
            } label: {
                selectionMenuLabel(country)
            }
            .accessibilityLabel("Country or jurisdiction")
            .onChange(of: country) { _, newCountry in
                if selectedEntry?.country != newCountry {
                    selectedEntryID = entries.first(where: { $0.country == newCountry })?.id ?? ""
                }
            }

            // A plain Picker renders its value in a single fixed-height row, so
            // a long authority name — "Ministry of Public and Business Service
            // Delivery and Procurement of the province of Ontario" — wrapped and
            // was clipped top and bottom. The user has to read the whole name to
            // confirm it, so the label wraps and the row grows instead.
            Menu {
                Picker("Issuing authority", selection: $selectedEntryID) {
                    ForEach(authorities) { entry in Text(entry.authority).tag(entry.id) }
                }
            } label: {
                selectionMenuLabel(selectedEntry?.authority ?? "Select an authority")
            }
            .accessibilityLabel("Issuing authority")
        }
        .cardStyle()
    }

    private func selectionMenuLabel(_ value: String) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text(value)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.up.chevron.down")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 16)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var fieldsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Verification details").font(.headline)

            if selectedEntry?.verification?.kind == .upload {
                Label("This authority verifies the original digital Apostille file, not text from a paper scan.", systemImage: "doc.badge.arrow.up")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else if fields.isEmpty {
                Text("This authority does not publish a confirmed field list. Continue to its official instructions.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach($fields) { $field in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text(field.label).font(.subheadline.weight(.semibold))
                            Spacer()
                            confidenceLabel(field)
                        }
                        if field.captureSource == .portal {
                            Label("Complete this on the official website", systemImage: "hand.tap")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        } else {
                            TextField("Enter exactly as printed", text: $field.value)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .textFieldStyle(.roundedBorder)
                            if !field.suggestedValues.isEmpty {
                                Label(
                                    field.value.isEmpty
                                        ? "OCR found several plausible values. Select the one shown on the Apostille."
                                        : "Selected by you—confirm it against the Apostille.",
                                    systemImage: "checklist"
                                )
                                .font(.caption)
                                .foregroundStyle(field.value.isEmpty ? .orange : .secondary)
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(field.suggestedValues, id: \.self) { suggestion in
                                            Button {
                                                field.value = suggestion
                                            } label: {
                                                Label(
                                                    suggestion,
                                                    systemImage: field.value == suggestion ? "checkmark.circle.fill" : "circle"
                                                )
                                                .font(.caption.monospaced())
                                            }
                                            .buttonStyle(.bordered)
                                            .tint(field.value == suggestion ? Color("BrandBlue") : .secondary)
                                        }
                                    }
                                }
                            }
                        }
                        if field.captureSource == .document,
                           let configField = selectedEntry?.verification?.fields.first(where: { $0.id == field.id }),
                           let error = FieldValidator.error(for: configField, value: field.value),
                           !field.value.isEmpty {
                            Text(error).font(.caption).foregroundStyle(.red)
                        }
                    }
                }
            }

            if let note = selectedEntry?.verification?.note {
                Text(note).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .cardStyle()
    }

    private var officialAction: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("The authority makes the decision", systemImage: "building.columns.fill")
                .font(.headline)
            Text(actionExplanation)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let guide = selectedEntry?.registerGuide {
                VStack(alignment: .leading, spacing: 5) {
                    Text(guide.title).font(.subheadline.weight(.semibold))
                    ForEach(Array(guide.steps.enumerated()), id: \.offset) { index, step in
                        Text("\(index + 1). \(step)").font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            if let links = selectedEntry?.registerLinks, links.count > 1, selectedEntry?.verification?.deepLink == nil {
                Menu {
                    ForEach(links, id: \.url) { link in
                        Button(link.label) { openVerifier(at: link.url) }
                    }
                } label: {
                    Label("Choose official verifier", systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!canOpenVerifier)
            } else {
                Button(action: openVerifier) {
                    Label(actionTitle, systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!canOpenVerifier)
            }
        }
        .cardStyle()
    }

    private var disclosureSection: some View {
        DisclosureGroup("View recognized text", isExpanded: $showsRecognizedText) {
            Text(recognition.fullText)
                .font(.caption.monospaced())
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 10)
        }
        .cardStyle()
    }

    private func confidenceLabel(_ field: ExtractedField) -> some View {
        Group {
            if field.captureSource == .portal {
                Label("On website", systemImage: "globe")
                    .foregroundStyle(.secondary)
            } else if field.needsCandidateSelection {
                Label("Choose a value", systemImage: "checklist")
                    .foregroundStyle(.orange)
            } else if field.value.isEmpty {
                Label("Not found", systemImage: "pencil")
                    .foregroundStyle(.orange)
            } else if field.confidence < 0.75 {
                Label("Check carefully", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
            } else {
                Label("Extracted", systemImage: "text.viewfinder")
                    .foregroundStyle(.secondary)
            }
        }
        .font(.caption)
    }

    private var canOpenVerifier: Bool {
        guard let entry = selectedEntry else { return false }
        switch entry.verificationMode {
        case .online, .hybrid:
            if let deepLink = entry.verification?.deepLink {
                return deepLink.url.scheme?.lowercased() == "https" ? !hasFieldErrors : true
            }
            return entry.registerUrl != nil || !entry.registerLinks.isEmpty
        default:
            return entry.registerUrl != nil || !entry.registerLinks.isEmpty
        }
    }

    private var actionTitle: String {
        if primaryVerifierIsInsecure { return "Open unencrypted site in Safari" }
        return selectedEntry?.verification?.deepLink == nil ? "Open official verifier" : "Continue with prefilled fields"
    }

    private var actionExplanation: String {
        guard let entry = selectedEntry else { return "Choose an authority to continue." }
        if primaryVerifierIsInsecure {
            return "This authority only provides an unencrypted HTTP page. Apostifi will warn before opening it in Safari and will not send or autofill any certificate values."
        }
        if entry.verification?.deepLink != nil {
            return "The reviewed values will be sent directly to the authority’s official lookup. Its result—not this scan—determines whether the Apostille is genuine."
        }
        if !fields.isEmpty {
            return "We’ll fill compatible controls on the official page after it loads, including localized date inputs. Any field the portal blocks remains available for one-tap copy."
        }
        return entry.notes
    }

    private var primaryVerifierIsInsecure: Bool {
        guard let entry = selectedEntry else { return false }
        let url = entry.verification?.deepLink?.url ?? entry.registerUrl ?? entry.registerLinks.first?.url
        return url?.scheme?.lowercased() == "http"
    }

    private func refreshFields() {
        guard let entry = selectedEntry else {
            fields = []
            return
        }
        fields = ApostilleParser.extractFields(for: entry, from: recognition)
    }

    private func openVerifier() {
        guard let entry = selectedEntry else { return }
        let route = VerificationRouter.route(for: entry, values: fieldValues)
        present(route, for: entry)
    }

    private func openVerifier(at url: URL) {
        guard let entry = selectedEntry else { return }
        present(VerificationRouter.route(to: url), for: entry)
    }

    private func present(_ route: VerificationRoute, for entry: RegisterEntry) {
        if case .externalInsecure(let url) = route {
            insecureExternalURL = url
            return
        }
        let reviewedFields = ApostilleParser.refreshingDateMetadata(
            in: fields.filter { !$0.value.isEmpty },
            for: entry
        )
        webSession = WebSession(
            route: route,
            title: entry.authority,
            fields: reviewedFields,
            isPrefilled: route.isPrefilled,
            entry: entry
        )
    }
}

struct QrReviewView: View {
    let match: QrMatch
    let previewImage: UIImage?
    let onStartOver: () -> Void
    @State private var webSession: WebSession?
    @State private var insecureExternalURL: URL?
    @State private var showsPayload = false

    private var insecureExternalURLIsPresented: Binding<Bool> {
        Binding(
            get: { insecureExternalURL != nil },
            set: { if !$0 { insecureExternalURL = nil } }
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                HStack(spacing: 16) {
                    if let previewImage {
                        Image(uiImage: previewImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 72, height: 92)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Official verifier found", systemImage: "checkmark.seal.fill")
                            .font(.headline)
                            .foregroundStyle(.green)
                        Text("This opens the issuing authority\u{2019}s own verification page. Only the authority can confirm the Apostille.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .cardStyle()

                VStack(alignment: .leading, spacing: 10) {
                    Text(match.entry.country).font(.caption).foregroundStyle(.secondary)
                    Text(match.entry.authority).font(.headline)
                    Label(match.destination.host ?? match.destination.absoluteString, systemImage: match.destination.scheme == "https" ? "lock.fill" : "exclamationmark.triangle.fill")
                        .font(.subheadline.monospaced())
                    Text(match.function == "document_url"
                         ? "This QR retrieves the authority’s document record; it is not itself a validity result."
                         : "Only the issuing authority’s destination can determine whether the Apostille is genuine.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .cardStyle()

                Button {
                    let route = VerificationRouter.route(to: match.destination)
                    if case .externalInsecure(let url) = route {
                        insecureExternalURL = url
                    } else {
                        webSession = WebSession(
                            route: route,
                            title: match.entry.authority,
                            fields: [],
                            isPrefilled: route.isPrefilled,
                            entry: match.entry
                        )
                    }
                } label: {
                    Label(match.function == "document_url" ? "Open authority record" : "Open official QR destination", systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                DisclosureGroup("View decoded QR payload", isExpanded: $showsPayload) {
                    Text(match.rawPayload)
                        .font(.caption.monospaced())
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 10)
                }
                .cardStyle()
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Review QR")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Start over", action: onStartOver) } }
        .sheet(item: $webSession) { WebVerifierView(session: $0) }
        .alert("This QR destination is not secure", isPresented: insecureExternalURLIsPresented, presenting: insecureExternalURL) { url in
            Button("Open in Safari") {
                UIApplication.shared.open(url)
                insecureExternalURL = nil
            }
            Button("Cancel", role: .cancel) { insecureExternalURL = nil }
        } message: { _ in
            Text("The decoded authority URL uses unencrypted HTTP, so its contents can be changed in transit. Apostifi will not display it with official branding.")
        }
    }
}
