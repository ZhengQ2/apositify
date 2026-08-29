import Foundation

struct ApostilleParser {
    private typealias Candidate = (value: String, confidence: Float, source: String)

    private struct FieldResolution {
        let confirmed: Candidate?
        let alternatives: [Candidate]
    }

    static func numberedItems(in lines: [RecognizedLine]) -> [Int: String] {
        resolvedItems(in: lines).mapValues(\.value)
    }

    /// Resolves each standard item to one value by collecting what three
    /// independent readings propose and keeping the most plausible:
    ///
    /// 1. the value printed on the item's own numbered line;
    /// 2. the value printed beside or below that line, paired by geometry;
    /// 3. whatever followed the line in OCR reading order.
    ///
    /// They compete on `standardItemScore` — does this look like a date, like a
    /// reference — with a small bonus for the steadier readings. That ordering
    /// is deliberate in both directions. Reading order gets no bonus because it
    /// is the one input that moves: a two-column certificate re-orders between
    /// scans of the same document, so consulting it first pairs item 7 with
    /// item 8's number on one scan and not the next. But it is still allowed to
    /// win, because the bonus must not let an unrecognised label sitting on the
    /// item's own line — Austria's "unter Zahl / Number" — beat the real
    /// reference found further down the page.
    private static func resolvedItems(in lines: [RecognizedLine]) -> [Int: Candidate] {
        var best: [Int: (candidate: Candidate, score: Int)] = [:]

        func offer(_ item: Int, _ candidate: Candidate, bonus: Int) {
            guard !candidate.value.isEmpty else { return }
            let score = standardItemScore(candidate.value, item: item) + bonus
            if let existing = best[item], existing.score >= score { return }
            best[item] = (candidate, score)
        }

        for anchor in itemAnchors(in: lines) where !anchor.inlineValue.isEmpty {
            offer(anchor.item, (anchor.inlineValue, anchor.line.confidence, anchor.line.text), bonus: 30)
        }
        for (item, candidate) in spatiallyPairedItems(in: lines) {
            offer(item, candidate, bonus: 20)
        }
        for (item, candidates) in rawNumberedItems(in: lines) {
            if let value = bestStandardItem(item, from: candidates) {
                offer(item, (value, 0.85, value), bonus: 0)
            }
        }
        return best.mapValues(\.candidate)
    }

    static func extractFields(for entry: RegisterEntry, from recognition: RecognitionResult) -> [ExtractedField] {
        guard let fields = entry.verification?.fields else { return [] }
        let items = resolvedItems(in: recognition.lines)

        return fields.map { field in
            let resolution = field.captureSource == .document
                ? resolve(field: field, lines: recognition.lines, items: items)
                : FieldResolution(confirmed: nil, alternatives: [])
            let extracted = resolution.confirmed
            let value = extracted?.value ?? ""
            return ExtractedField(
                id: field.id,
                label: field.label,
                value: value,
                confidence: extracted?.confidence ?? 0,
                sourceText: extracted?.source,
                isoDate: field.standardItem == 6 ? isoDate(from: value, expectedFormat: field.format) : nil,
                suggestedValues: resolution.alternatives.map(\.value),
                aliases: field.aliases,
                browserSelectors: field.browserSelectors,
                captureSource: field.captureSource
            )
        }
    }

    /// Standard item 6 and 8 are semantic entities—a date and a compact
    /// reference—not arbitrary lines beside a label. Geometry is allowed to
    /// rank review suggestions, but never to confirm an ambiguous association.
    private static func resolve(
        field: VerificationField,
        lines: [RecognizedLine],
        items: [Int: Candidate]
    ) -> FieldResolution {
        guard field.standardItem == 6 || field.standardItem == 8 else {
            return FieldResolution(
                confirmed: candidate(for: field, lines: lines, items: items),
                alternatives: []
            )
        }

        if let pattern = field.pattern {
            let matches = uniqueCandidates(
                candidatesMatching(pattern: pattern, in: lines).map { format($0, for: field) }
            )
            if matches.count == 1 { return FieldResolution(confirmed: matches[0], alternatives: []) }
            if matches.count > 1 { return FieldResolution(confirmed: nil, alternatives: matches) }
        }

        let anchors = itemAnchors(in: lines).filter { $0.item == field.standardItem }
        let inline = uniqueCandidates(anchors.compactMap { anchor -> Candidate? in
            guard !anchor.inlineValue.isEmpty else { return nil }
            let candidate: Candidate = (anchor.inlineValue, anchor.line.confidence, anchor.line.text)
            guard isSemanticallyValid(candidate.value, for: field) else { return nil }
            return format(candidate, for: field)
        })
        if inline.count == 1 { return FieldResolution(confirmed: inline[0], alternatives: []) }
        if inline.count > 1 { return FieldResolution(confirmed: nil, alternatives: inline) }

        let semantic = field.standardItem == 6
            ? dateCandidates(in: lines, for: field)
            : referenceCandidates(in: lines, for: field)
        // Rank before trimming to the review shortlist. Candidates arrive in
        // reading order, so trimming first silently dropped the value the item
        // resolver had already settled on whenever three unrelated strings
        // happened to be printed above it — a watermark across the top of a
        // photo was enough to lose the certificate number entirely.
        let candidates = distinctCandidates(semantic)

        // A numeric date such as 12/07/2019 has two valid readings and the
        // certificate does not say which. Declining to guess is right, but
        // discarding it left the field blank with nothing to review and no sign
        // of what had been read. Offer the readings so the choice is the user's.
        if field.standardItem == 6, candidates.isEmpty {
            let readings = uniqueCandidates(ambiguousDateReadings(in: lines, for: field))
            if !readings.isEmpty {
                return FieldResolution(confirmed: nil, alternatives: readings)
            }
        }

        // A visible numbered anchor plus exactly one entity of the right type
        // is strong without assuming that the entity is on the same row. This
        // handles two-column forms whose item 8 value is printed above its row.
        if !anchors.isEmpty, candidates.count == 1 {
            return FieldResolution(confirmed: candidates[0], alternatives: [])
        }

        // A value explicitly labelled in the same OCR observation is also
        // deterministic even when Vision missed the printed item number.
        if let labeled = inlineLabeledValue(for: field, in: lines) {
            return FieldResolution(confirmed: format(labeled, for: field), alternatives: [])
        }

        if candidates.count == 1, field.standardItem == 6,
           hasIssueDateSignal(candidates[0].source) {
            return FieldResolution(confirmed: candidates[0], alternatives: [])
        }

        // Put the old resolver's preference first for a helpful review order,
        // but leave the field blank because proximity alone is not identity.
        let preferred = items[field.standardItem!].flatMap { resolved -> Candidate? in
            let normalizedResolved = normalize(resolved.value)
            return candidates.first { candidate in
                let normalizedCandidate = normalize(candidate.value)
                return normalizedResolved == normalizedCandidate
                    || normalizedResolved.contains(normalizedCandidate)
            }
        }
        return FieldResolution(
            confirmed: nil,
            alternatives: uniqueCandidates([preferred].compactMap { $0 } + candidates)
        )
    }

    /// Rebuilds browser-only date metadata from values the user actually
    /// reviewed. OCR-derived metadata must never outlive a correction made in
    /// the review form.
    static func refreshingDateMetadata(in fields: [ExtractedField], for entry: RegisterEntry) -> [ExtractedField] {
        let configuration = Dictionary(uniqueKeysWithValues: (entry.verification?.fields ?? []).map { ($0.id, $0) })
        return fields.map { field in
            guard configuration[field.id]?.standardItem == 6 else { return field }
            var refreshed = field
            refreshed.isoDate = isoDate(from: refreshed.value, expectedFormat: configuration[field.id]?.format)
            return refreshed
        }
    }

    /// A line that opens a standard item, with whatever value it carries after
    /// its own template labels are removed.
    private struct ItemAnchor {
        let item: Int
        let index: Int
        let line: RecognizedLine
        let inlineValue: String
    }

    private static func itemAnchors(in lines: [RecognizedLine]) -> [ItemAnchor] {
        lines.enumerated().compactMap { index, line in
            let text = clean(line.text)
            if let match = firstMatch(#"^\s*(10|[1-9])\s*[\.\):\-]\s*(.*)$"#, in: text),
               let item = Int(match[1]) {
                return ItemAnchor(
                    item: item,
                    index: index,
                    line: line,
                    inlineValue: stripTemplateLabels(match[2], item: item)
                )
            }
            // Right-to-left OCR returns the item number at the end of the line.
            if containsRightToLeftScript(text),
               let match = firstMatch(#"^(.*?)\s*[\.\):\-]\s*(10|[1-9])\s*$"#, in: text),
               let item = Int(match[2]) {
                return ItemAnchor(
                    item: item,
                    index: index,
                    line: line,
                    inlineValue: stripTemplateLabels(match[1], item: item)
                )
            }
            return nil
        }
    }

    /// Pairs the items whose own line carries no value with the value printed
    /// beside or below them.
    ///
    /// Assignment is exclusive and greedy by cost, which is what makes it
    /// stable: one value can serve only one item, so the number on item 8's row
    /// cannot also be claimed by item 7, and a signature — one tall box
    /// overlapping several rows — settles on item 10, where it belongs, instead
    /// of outranking the number for item 8.
    private static func spatiallyPairedItems(in lines: [RecognizedLine]) -> [Int: Candidate] {
        let anchors = itemAnchors(in: lines)
        let anchorIndices = Set(anchors.map(\.index))
        let unresolved = anchors.filter { $0.inlineValue.isEmpty }
        guard !unresolved.isEmpty else { return [:] }

        var pairings: [(cost: Double, anchor: Int, candidate: Int)] = []
        for (position, anchor) in unresolved.enumerated() {
            for (index, line) in lines.enumerated() {
                guard !anchorIndices.contains(index),
                      !isStructuralLine(line.text),
                      !stripTemplateLabels(line.text, item: anchor.item).isEmpty,
                      let cost = pairingCost(label: anchor.line, candidate: line) else { continue }
                pairings.append((cost, position, index))
            }
        }

        var claimedAnchors = Set<Int>()
        var claimedCandidates = Set<Int>()
        var result: [Int: Candidate] = [:]
        for pairing in pairings.sorted(by: { $0.cost < $1.cost }) {
            guard !claimedAnchors.contains(pairing.anchor),
                  !claimedCandidates.contains(pairing.candidate) else { continue }
            claimedAnchors.insert(pairing.anchor)
            claimedCandidates.insert(pairing.candidate)

            let anchor = unresolved[pairing.anchor]
            let line = lines[pairing.candidate]
            let value = stripTemplateLabels(line.text, item: anchor.item)
            let confidence = min(anchor.line.confidence, line.confidence) * 0.94
            if let existing = result[anchor.item],
               standardItemScore(existing.value, item: anchor.item) >= standardItemScore(value, item: anchor.item) {
                continue
            }
            result[anchor.item] = (value, confidence, anchor.line.text + " " + line.text)
        }
        return result
    }

    private static func rawNumberedItems(in lines: [RecognizedLine]) -> [Int: [String]] {
        var blocks: [Int: [[String]]] = [:]
        var current: (number: Int, block: Int)?

        for line in lines {
            let text = line.text.trimmingCharacters(in: .whitespacesAndNewlines)
            if let match = firstMatch(#"^\s*(10|[1-9])\s*[\.\):\-]\s*(.*)$"#, in: text),
               let number = Int(match[1]) {
                blocks[number, default: []].append([])
                current = (number, blocks[number]!.count - 1)
                if !match[2].isEmpty { blocks[number]![current!.block].append(match[2]) }
            } else if containsRightToLeftScript(text),
                      let match = firstMatch(#"^(.*?)\s*[\.\):\-]\s*(10|[1-9])\s*$"#, in: text),
                      let number = Int(match[2]) {
                // In right-to-left OCR, the visual item number is frequently
                // returned at the end ("No: ABC / رقم .8"). Treat it as the
                // same numbered block while preserving the value before it.
                // Left-to-right lines never do this, and accepting them there
                // let ordinary text ending in "ref A-5" open a bogus item 5 and
                // swallow every line that followed it.
                blocks[number, default: []].append([])
                current = (number, blocks[number]!.count - 1)
                if !match[1].isEmpty { blocks[number]![current!.block].append(match[1]) }
            } else if let current, !text.isEmpty,
                      !isConventionReference(text), !isModelConnective(text) {
                blocks[current.number]![current.block].append(text)
            }
        }
        return Dictionary(uniqueKeysWithValues: blocks.map { number, candidates in
            // Keep every OCR observation in a numbered block as a candidate.
            // Multilingual certificates often put the translated template labels
            // on separate lines before the actual value. Selecting the first
            // non-label line made a partially stripped label (for example China's
            // item 8 heading) win over the number printed immediately after it.
            let values = candidates.flatMap { $0.map(clean) }
            return (number, values)
        })
    }

    /// Every distinct candidate, in the order given. Ranking must happen on the
    /// full set; `uniqueCandidates` then trims the ranked result to what the
    /// review screen can show.
    private static func distinctCandidates(_ candidates: [Candidate]) -> [Candidate] {
        var seen = Set<String>()
        var result: [Candidate] = []
        for candidate in candidates where !candidate.value.isEmpty {
            let key = normalize(candidate.value)
            guard !key.isEmpty, seen.insert(key).inserted else { continue }
            result.append(candidate)
        }
        return result
    }

    private static let reviewShortlistLimit = 3

    private static func uniqueCandidates(_ candidates: [Candidate]) -> [Candidate] {
        Array(distinctCandidates(candidates).prefix(reviewShortlistLimit))
    }

    private static func candidatesMatching(pattern: String, in lines: [RecognizedLine]) -> [Candidate] {
        guard let expression = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return []
        }
        return lines.flatMap { line -> [Candidate] in
            expression.matches(in: line.text, range: NSRange(line.text.startIndex..., in: line.text)).compactMap { match in
                guard let range = Range(match.range, in: line.text) else { return nil }
                return (String(line.text[range]), line.confidence, line.text)
            }
        }
    }

    /// Shapes a printed date can take, in every language the corpus prints.
    /// Loose on purpose: each match is gated on parsing as a real date.
    private static let datePatterns = [
        #"(?<!\d)\d{4}[-\./]\d{1,2}[-\./]\d{1,2}(?!\d)"#,
        #"(?<!\d)\d{1,2}[-\./]\d{1,2}[-\./]\d{2,4}(?!\d)"#,
        #"(?<!\d)\d{1,2}(?:st|nd|rd|th)?(?:\s+de)?\s+[\p{L}\.]+(?:\s+de)?\s+\d{4}(?!\d)"#,
        #"[\p{L}\.]+\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{4}"#,
        // Japan prints "Jul. 10.2026" — a month name whose day and year are
        // joined by the same separator, with no space before the year.
        #"(?<![\d\p{L}])[\p{L}]{3,}\.?\s*\d{1,2}\s*[\.,]\s*\d{4}(?!\d)"#,
        #"\d{4}年\d{1,2}月\d{1,2}日"#
    ]

    /// The date inside a longer labelled phrase. Chile prints
    /// "Fecha Emisión [ 28-10-2016 ]"; the brackets and the repeated label are
    /// not part of what its verifier accepts.
    private static func dateSubstring(in value: String, for field: VerificationField) -> String? {
        for pattern in datePatterns {
            guard let range = value.range(of: pattern, options: [.regularExpression, .caseInsensitive]) else { continue }
            let candidate = String(value[range])
            if parseDate(candidate, expectedFormat: field.format) != nil { return candidate }
        }
        return nil
    }

    private static func dateCandidates(in lines: [RecognizedLine], for field: VerificationField) -> [Candidate] {
        let patterns = datePatterns
        var candidates: [Candidate] = []
        for line in lines where !isConventionReference(line.text) {
            for pattern in patterns {
                guard let expression = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { continue }
                for match in expression.matches(in: line.text, range: NSRange(line.text.startIndex..., in: line.text)) {
                    guard let range = Range(match.range, in: line.text) else { continue }
                    let raw = String(line.text[range])
                    guard parseDate(raw, expectedFormat: field.format) != nil else { continue }
                    candidates.append(format((raw, line.confidence, line.text), for: field))
                }
            }
        }

        // Different languages can print the same date on one line. Collapse
        // those by their ISO meaning rather than their spelling.
        var seen = Set<String>()
        return candidates.filter { candidate in
            let key = isoDate(from: candidate.value, expectedFormat: field.format) ?? normalize(candidate.value)
            return seen.insert(key).inserted
        }
    }

    /// Both readings of a numeric date whose day and month could each be
    /// either. A field that must submit ISO gets the two ISO dates; one that
    /// submits the printed text gets the text, which is not itself ambiguous.
    private static func ambiguousDateReadings(
        in lines: [RecognizedLine],
        for field: VerificationField
    ) -> [Candidate] {
        var result: [Candidate] = []
        for line in lines where !isConventionReference(line.text) && !isUnderlyingDocumentDate(line.text) {
            guard let match = firstMatch(#"(?<!\d)(\d{1,2})[-\./](\d{1,2})[-\./](\d{4})(?!\d)"#, in: line.text),
                  let first = Int(match[1]), let second = Int(match[2]), let year = Int(match[3]),
                  (1...12).contains(first), (1...12).contains(second) else { continue }
            guard field.format == "date-iso" else {
                result.append((match[0], line.confidence, line.text))
                continue
            }
            // Day-first is the prevailing convention on Apostilles, so it leads.
            result.append((String(format: "%04d-%02d-%02d", year, second, first), line.confidence, line.text))
            result.append((String(format: "%04d-%02d-%02d", year, first, second), line.confidence, line.text))
        }
        return result
    }

    private static func referenceCandidates(in lines: [RecognizedLine], for field: VerificationField) -> [Candidate] {
        let tokenPattern = #"[\p{L}\p{N}](?:[\p{L}\p{N}]|[._/\-]){3,47}"#
        guard let expression = try? NSRegularExpression(pattern: tokenPattern) else { return [] }
        var candidates: [Candidate] = []
        for line in lines where !isStructuralLine(line.text) {
            let range = NSRange(line.text.startIndex..., in: line.text)
            for match in expression.matches(in: line.text, range: range) {
                guard let swiftRange = Range(match.range, in: line.text) else { continue }
                let value = String(line.text[swiftRange])
                guard isPlausibleReference(value) else { continue }
                candidates.append(format((value, line.confidence, line.text), for: field))
            }
        }
        return candidates
    }

    /// Fields outside standard items 6 and 8 take whatever follows their label,
    /// which on a dense page is often prose. "…this 12th day of February in the
    /// Year Two Thousand and Twenty-six" filled Hong Kong's Year field with
    /// "Two", and its Reference Code with a fragment of Japanese. A field that
    /// asks for a number, year, code or reference is asking for a token.
    private static func suitsLabel(_ value: String, field: VerificationField) -> Bool {
        let label = field.label
        let asksForToken = label.range(
            of: #"number|numero|numéro|\bno\.|\bcode\b|c[oó]digo|clave|year|a[ñn]o|reference"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
        guard asksForToken else { return true }
        guard value.range(of: #"[A-Za-z0-9]{2,}"#, options: .regularExpression) != nil else { return false }
        let asksForDigits = label.range(
            of: #"number|numero|numéro|\bno\.|year|a[ñn]o"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
        return !asksForDigits || value.range(of: #"\d"#, options: .regularExpression) != nil
    }

    private static func isSemanticallyValid(_ value: String, for field: VerificationField) -> Bool {
        if field.standardItem == 6 {
            return parseDate(value, expectedFormat: field.format) != nil
        }
        return isPlausibleReference(value)
    }

    private static func isPlausibleReference(_ value: String) -> Bool {
        let cleaned = clean(value).trimmingCharacters(in: CharacterSet(charactersIn: ".:/|·•–—- "))
        guard (4...48).contains(cleaned.count),
              cleaned.range(of: #"\d"#, options: .regularExpression) != nil,
              parseDate(cleaned) == nil else { return false }
        // Legalisation stickers print a fee beside the reference. "GBP40.00" is
        // shaped like a reference and sat alone on the page often enough to be
        // confirmed as the certificate number and sent to the verifier.
        if cleaned.range(
            of: #"^(?:[A-Z]{3}|[$€£¥₹])\s?\d{1,3}(?:[ ,]\d{3})*[.,]\d{2}$"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil { return false }
        let alphanumerics = cleaned.unicodeScalars.filter(CharacterSet.alphanumerics.contains)
        guard alphanumerics.count >= 4 else { return false }
        if alphanumerics.allSatisfy(CharacterSet.decimalDigits.contains), alphanumerics.count < 5 {
            return false
        }
        return cleaned.split(separator: " ").count <= 3
    }

    /// Unlike `valueBesideLabel`, this deliberately does not look on adjacent
    /// lines or use geometry. Only text following an exact label in the same
    /// Vision observation is strong enough to confirm automatically.
    private static func inlineLabeledValue(for field: VerificationField, in lines: [RecognizedLine]) -> Candidate? {
        let aliases = field.aliases.sorted { $0.count > $1.count }
        for line in lines {
            if field.standardItem == 6, isUnderlyingDocumentDate(line.text) { continue }
            for alias in aliases {
                guard let range = line.text.range(of: alias, options: [.caseInsensitive, .diacriticInsensitive]) else { continue }
                let suffix = clean(String(line.text[range.upperBound...])
                    .trimmingCharacters(in: CharacterSet(charactersIn: ":/·•–—- ")))
                guard !suffix.isEmpty, isSemanticallyValid(suffix, for: field) else { continue }
                if field.standardItem == 6, let narrowed = dateSubstring(in: suffix, for: field) {
                    return (narrowed, line.confidence, line.text)
                }
                return (suffix, line.confidence, line.text)
            }
        }
        return nil
    }

    private static func hasIssueDateSignal(_ text: String) -> Bool {
        guard text.range(
            of: #"issued|issue\s+date|date\s+of\s+issue|dated|certified\s+on|fecha\s+de\s+emisi[oó]n|date\s+d['’]émission|ausstellungsdatum"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil else { return false }
        return !isUnderlyingDocumentDate(text)
    }

    private static func isUnderlyingDocumentDate(_ text: String) -> Bool {
        text.range(
            of: #"underlying|source\s+document|original\s+document"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private static func candidate(
        for field: VerificationField,
        lines: [RecognizedLine],
        items: [Int: Candidate]
    ) -> Candidate? {
        if let item = field.standardItem, let resolved = items[item] {
            // Where an authority documents the shape of its reference, the
            // printed item can wrap it in text the portal will not accept:
            // China prints "认字第263600004721号" for the twelve digits its
            // verifier wants. Narrow to the documented shape, and fall through
            // to the label and pattern searches when the item does not contain
            // it at all.
            if let pattern = field.pattern {
                if let narrowed = matchingValue(resolved.value, pattern: pattern) {
                    return format((narrowed, resolved.confidence, resolved.source), for: field)
                }
            } else {
                return format(resolved, for: field)
            }
        }

        if let labeled = valueBesideLabel(aliases: field.aliases, pattern: field.pattern, lines: lines),
           suitsLabel(labeled.value, field: field) {
            return format(labeled, for: field)
        }

        // An authority-documented shape is the one signal that depends on
        // neither layout nor reading order, so it carries the cases the two
        // above miss. Only used when the authority metadata provides a
        // sufficiently specific pattern; generic fields never scan arbitrary
        // document text for a code.
        if let pattern = field.pattern,
           let patterned = firstPattern(pattern, in: lines) {
            return format(patterned, for: field)
        }

        if field.standardItem == 6, let fallback = firstDate(in: lines) {
            return format(fallback, for: field)
        }
        return nil
    }

    private static func bestStandardItem(_ item: Int, from blocks: [String]) -> String? {
        blocks
            .map { stripTemplateLabels($0, item: item) }
            .filter { !$0.isEmpty }
            .max { standardItemScore($0, item: item) < standardItemScore($1, item: item) }
    }

    private static func standardItemScore(_ value: String, item: Int? = nil) -> Int {
        var score = value.unicodeScalars.filter(CharacterSet.alphanumerics.contains).count
        if item == 6, parseDate(value) != nil { score += 200 }
        if item == 8 {
            if value.range(of: #"\d"#, options: .regularExpression) != nil { score += 100 }
            // An item 8 reference is one compact token. Narrative text that OCR
            // dropped into the block ("Registered under file ref A-5") would
            // otherwise outscore the real number purely by being longer.
            score -= 25 * max(0, value.split(separator: " ").count - 1)
        }
        return score
    }

    /// Item labels as the certificate prints them, in the languages of the
    /// authorities in the register. Each alternative must be a label an issuer
    /// actually uses; anything broader eats real values.
    private static let templateLabelPatterns: [Int: String] = [
        1: #"country|pays|pa[ií]s|land|paese|χώρα|[üu]lke|[țt]ara|страна|държава|الدولة|文书出具国|國家|国家|국가"#,
        2: #"has been signed by|a été signé par|ha sido firmado por|unterzeichnet von|è stato firmato da|is ondertekend door|a fost semnat[ăa] de|έχει υπογραφεί από|imzalayan|подписан|签署人"#,
        3: #"acting in the capacity of|agissant en qualité de|quien actúa en calidad de|in seiner eigenschaft als|nella qualità di|handelend in de hoedanigheid van|în calitate de|με την ιδιότητα|s[ıi]fat[ıi]yla|в качестве|身份"#,
        4: #"bears? the seal\W*(?:or\W*)?stamp\W*of|bears? the (?:seal|stamp)\W*of|est rev[êe]tu du sceau\W*(?:ou\W*)?(?:du\W*)?timbre de|(?:y\W*)?est[áa] revestido del sello\W*(?:o\W*)?(?:del\W*)?timbre de|seal|stamp|sceau|sello|timbro|sigillo|zegel|stempel|sigiliul|[șs]tampila|σφραγίδα|m[üu]h[üu]r|damga|печать|印章"#,
        // Deliberately no one- or two-letter additions here: a bare "la" or
        // "te" would eat the start of "La Paz" or "Te Awamutu".
        5: #"at|à|en|in|в|地点"#,
        6: #"dated?|date|the|fecha|el\s+d[ií]a|d[ií]a|le|il|op|am|data|datum|dato|tanggal|ημερομηνία|tarih|дата|بالتاريخ|التاريخ|签发日期|簽發日期|日期|日付"#,
        7: #"by|par|por|durch|da|door|de c[ăa]tre|από|taraf[ıi]ndan|от|بواسطة|签发人|簽發人|由|발급자"#,
        // "nº" is printed with either the ordinal indicator or a degree sign,
        // and OCR does not reliably tell them apart.
        8: #"number|num[eé]ro|n[uú]mero|num[ăa]rul|nummer|bajo\s+el\s+n[uú]mero|unter\s+nr\.?|unter\s+zahl|zahl|onder\s+nr\.?|sous\s+n[oº°]\.?|no\.?|nr\.?|n[º°]|αριθμ[όο]ς|αρ\.?|numara|say[ıi]|номер|رقم|附加证明书编号|附加證明書編號|编号|編號|番号"#,
        9: #"seal.?stamp|sceau.?timbre|sello.?timbre|sigillo|zegel|stempel|sigiliu|σφραγίδα|m[üu]h[üu]r|печать|印章"#,
        10: #"signature|firma|handtekening|semn[ăa]tura|υπογραφή|imza|подпись|签名|署名"#
    ]

    /// A template label is only a label when it *leads* the value. The same
    /// words occur inside real values — "Aix-en-Provence", "Tribunal de Justiça
    /// da Bahia", the "NO" in "NO-123456" — and stripping every occurrence
    /// corrupted them.
    ///
    /// Multilingual certificates chain the label in several languages, and they
    /// follow one convention throughout: a slash (or a bullet or dash) joins the
    /// languages, and a colon ends the label group before the value —
    /// "Country: / Pays : Canada", "6. the / le  2026-06-19", "8. N° / sous n°".
    /// So a continuation is admitted only across a chain separator. Requiring a
    /// colon instead would be reading the wrong side of the label: it would both
    /// miss the final language in a chain and swallow the first word of a value
    /// that merely follows a colon ("7. por: Da Costa Office").
    private static func stripTemplateLabels(_ value: String, item: Int?) -> String {
        let selectedPatterns = item.flatMap { templateLabelPatterns[$0] }.map { [$0] }
            ?? Array(templateLabelPatterns.values)
        var result = clean(value)
        var isContinuation = false
        var didStrip = true

        while didStrip {
            didStrip = false
            for pattern in selectedPatterns {
                let lead = isContinuation
                    ? #"[\s.:-]*[/|·•–—]+[\s.:/|·•–—-]*"#
                    : #"[\s.:/|·•–—-]*"#
                // A lookahead rather than \b: labels ending in a symbol — "N°"
                // with a degree sign — have no word boundary after them, so \b
                // silently refused to strip them.
                let stripped = result.replacingOccurrences(
                    of: "^\(lead)(?:\(pattern))(?![\\p{L}\\p{N}])",
                    with: "",
                    options: [.regularExpression, .caseInsensitive]
                )
                guard stripped != result else { continue }
                result = stripped
                didStrip = true
                isContinuation = true
            }
            // Vision returns a mixed right-to-left line in visual order, which
            // puts that language's label after the value ("No: ABC / رقم").
            // Mirror the leading strip so the label does not ride along in the
            // value the user is asked to submit.
            guard containsRightToLeftScript(result) else { continue }
            for pattern in selectedPatterns {
                let stripped = result.replacingOccurrences(
                    of: "[\\s.:/|·•–—-]+(?:\(pattern))[\\s.:/|·•–—-]*$",
                    with: "",
                    options: [.regularExpression, .caseInsensitive]
                )
                guard stripped != result else { continue }
                result = stripped
                didStrip = true
            }
        }
        return clean(result.trimmingCharacters(in: CharacterSet(charactersIn: ".:/|·•–—- ")))
    }

    /// The model certificate prints connective phrases between the numbered
    /// items — "This public document / Le présent acte public", "Certified /
    /// Attesté". They belong to no item, but they follow one, so they were
    /// absorbed into its block and outscored the real value by being longer.
    /// A line counts as boilerplate only when nothing but these phrases and
    /// their separators is on it, so a value that merely contains one of the
    /// words is untouched.
    private static func isModelConnective(_ text: String) -> Bool {
        let phrases = #"this public document|le pr[ée]sent acte public|el presente documento p[uú]blico|o presente documento p[uú]blico|dieses [öo]ffentliche dokument|il presente atto pubblico|acest document oficial|certified|certifi[ée]e?|attest[ée]e?|attested|certificado|beglaubigt|bevestigd|certificato|证明|本公文书|本公文書"#
        let remainder = text
            .replacingOccurrences(of: phrases, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"[\s.:/|·•–—-]"#, with: "", options: .regularExpression)
        return !text.isEmpty && remainder.isEmpty
    }

    /// Every Apostille reprints the Convention reference — "Convention de La
    /// Haye du 5 octobre 1961". That date is boilerplate on every certificate
    /// ever issued, never the date this one was certified, so it must not reach
    /// item 6 as a block candidate or as the unlabeled date fallback.
    private static func isConventionReference(_ text: String) -> Bool {
        // Arabic-script certificates print the year in Arabic-Indic or Eastern
        // Arabic-Indic digits, which the date patterns below still match.
        guard ["1961", "١٩٦١", "۱۹۶۱"].contains(where: text.contains) else { return false }
        return text.range(
            of: #"convention|convenio|conven[cç][ãa]o|convenzione|konvention|verdrag|übereinkommen|σύμβαση|s[öo]zle[şs]me|конвенц|اتفاقي|公约|公約|条約|협약|la haye|hague|la haya|haag"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private static func containsRightToLeftScript(_ text: String) -> Bool {
        text.unicodeScalars.contains {
            (0x0590...0x08FF).contains($0.value)
                || (0xFB1D...0xFDFF).contains($0.value)
                || (0xFE70...0xFEFF).contains($0.value)
        }
    }

    private static func valueBesideLabel(
        aliases: [String],
        pattern: String?,
        lines: [RecognizedLine]
    ) -> Candidate? {
        let normalizedAliases = aliases
            .map { ($0, normalize($0)) }
            .filter { !$0.1.isEmpty }
            .sorted { $0.1.count > $1.1.count }

        for (index, line) in lines.enumerated() {
            let normalizedLine = normalize(line.text)
            guard let alias = normalizedAliases.first(where: { normalizedLine.contains($0.1) }) else { continue }

            if let exactRange = line.text.range(of: alias.0, options: [.caseInsensitive, .diacriticInsensitive]) {
                let suffix = clean(String(line.text[exactRange.upperBound...]).trimmingCharacters(in: CharacterSet(charactersIn: ":/·•–—- ")))
                if let value = matchingValue(suffix, pattern: pattern), !value.isEmpty {
                    return (value, line.confidence, line.text)
                }
            }

            if let spatial = nearestValue(to: line, excluding: index, aliases: normalizedAliases.map(\.1), pattern: pattern, lines: lines) {
                return spatial
            }

            if index + 1 < lines.count,
               let value = matchingValue(lines[index + 1].text, pattern: pattern),
               !normalizedAliases.contains(where: { normalize(value).contains($0.1) }) {
                let next = lines[index + 1]
                return (value, min(line.confidence, next.confidence) * 0.88, line.text + " " + next.text)
            }
        }
        return nil
    }

    /// A line that is itself structure — another item's numbered label, or the
    /// model's boilerplate — is never a value.
    private static func isStructuralLine(_ text: String) -> Bool {
        let cleaned = clean(text)
        if isConventionReference(cleaned) || isModelConnective(cleaned) { return true }
        return firstMatch(#"^\s*(10|[1-9])\s*[\.\):\-]\s"#, in: cleaned) != nil
    }

    /// How far a candidate line sits from a label, or nil when it is in no
    /// position to be that label's value. A value printed on the label's own
    /// row always beats one printed below it.
    private static func pairingCost(label: RecognizedLine, candidate: RecognizedLine) -> Double? {
        let labelMidY = label.bounds.y + label.bounds.height / 2
        let labelMaxX = label.bounds.x + label.bounds.width
        let candidateMidY = candidate.bounds.y + candidate.bounds.height / 2
        let verticalDifference = abs(candidateMidY - labelMidY)

        // The row tolerance is anchored on the label, which is ordinary body
        // text. Scaling it by whichever box was taller let a signature scrawl —
        // one tall box spanning several rows — claim the label's row and
        // outrank the value actually printed on it.
        let rowTolerance = max(label.bounds.height, 0.008) * 1.2
        if verticalDifference < rowTolerance, candidate.bounds.x >= labelMaxX - 0.02 {
            return max(0, candidate.bounds.x - labelMaxX) + verticalDifference
        }
        let isBelow = candidate.bounds.y < label.bounds.y
            && label.bounds.y - candidate.bounds.y < 0.10
            && abs(candidate.bounds.x - label.bounds.x) < 0.18
        return isBelow ? 1 + (label.bounds.y - candidate.bounds.y) : nil
    }

    private static func nearestValue(
        to label: RecognizedLine,
        excluding labelIndex: Int,
        aliases: [String],
        pattern: String?,
        lines: [RecognizedLine],
    ) -> Candidate? {
        let candidates = lines.enumerated().compactMap { index, line -> (Double, RecognizedLine, String)? in
            guard index != labelIndex, !isStructuralLine(line.text) else { return nil }
            let normalized = normalize(line.text)
            guard !aliases.contains(where: normalized.contains),
                  let value = matchingValue(line.text, pattern: pattern),
                  !value.isEmpty else { return nil }

            guard let score = pairingCost(label: label, candidate: line) else { return nil }
            return (score, line, value)
        }
        guard let best = candidates.min(by: { $0.0 < $1.0 }) else { return nil }
        return (best.2, min(label.confidence, best.1.confidence) * 0.94, label.text + " " + best.1.text)
    }

    private static func matchingValue(_ raw: String, pattern: String?) -> String? {
        let value = clean(raw)
        guard !value.isEmpty else { return nil }
        guard let pattern else { return value }
        guard let expression = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = expression.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)),
              let range = Range(match.range, in: value) else { return nil }
        return String(value[range])
    }

    private static func firstPattern(_ pattern: String, in lines: [RecognizedLine]) -> Candidate? {
        guard let expression = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return nil
        }
        return lines.compactMap { line -> Candidate? in
            let range = NSRange(line.text.startIndex..., in: line.text)
            guard let match = expression.firstMatch(in: line.text, range: range),
                  let swiftRange = Range(match.range, in: line.text) else { return nil }
            return (String(line.text[swiftRange]), line.confidence * 0.82, line.text)
        }
        .max { left, right in
            if left.confidence == right.confidence { return left.value.count < right.value.count }
            return left.confidence < right.confidence
        }
    }

    private static func firstDate(in lines: [RecognizedLine]) -> Candidate? {
        let patterns = [
            #"\b\d{4}[-\./]\d{1,2}[-\./]\d{1,2}\b"#,
            #"\b\d{1,2}[-\./]\d{1,2}[-\./]\d{2,4}\b"#,
            #"\b\d{1,2}\s+[\p{L}\.]+\s+\d{4}\b"#,
            #"\b\d{4}\s+[\p{L}\.]+\s+\d{1,2}\b"#,
            #"\d{4}年\d{1,2}月\d{1,2}日"#
        ]
        for line in lines where !isConventionReference(line.text) {
            for pattern in patterns {
                if let result = line.text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) {
                    return (String(line.text[result]), line.confidence * 0.78, line.text)
                }
            }
        }
        return nil
    }

    private static func format(_ candidate: Candidate, for field: VerificationField) -> Candidate {
        var value = clean(candidate.value)
        if field.format == "date-iso", let iso = isoDate(from: value, expectedFormat: field.format) {
            value = iso
        } else if field.format == "date-dotted",
                  !hasWrongNumericSeparators(value, expected: "."),
                  let date = parseDate(value, expectedFormat: field.format) {
            value = dateString(date, format: "dd.MM.yyyy")
        } else if let format = field.format, format.hasPrefix("mask:") {
            value = self.value(conforming: value, to: String(format.dropFirst("mask:".count)))
        }
        return (value, candidate.confidence, candidate.source)
    }

    /// Corrects only the OCR ambiguities made unambiguous by an authority's
    /// documented identifier shape. `A` means a letter and `9` means a digit.
    private static func value(conforming raw: String, to mask: String) -> String {
        let compact = raw.unicodeScalars.filter(CharacterSet.alphanumerics.contains).map(String.init)
        let slots = mask.map(String.init)
        guard compact.count == slots.count else { return raw }

        let digitSubstitutions: [String: String] = [
            "O": "0", "Q": "0", "D": "0", "I": "1", "L": "1",
            "Z": "2", "S": "5", "G": "6", "B": "8"
        ]
        let letterSubstitutions: [String: String] = [
            "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B"
        ]

        return zip(compact, slots).map { character, slot in
            let uppercased = character.uppercased()
            if slot == "9" { return digitSubstitutions[uppercased] ?? uppercased }
            if slot == "A" { return letterSubstitutions[uppercased] ?? uppercased }
            return uppercased
        }.joined()
    }

    static func isoDate(from value: String) -> String? {
        isoDate(from: value, expectedFormat: nil)
    }

    private static func isoDate(from value: String, expectedFormat: String?) -> String? {
        parseDate(value, expectedFormat: expectedFormat).map { dateString($0, format: "yyyy-MM-dd") }
    }

    private static func parseDate(_ value: String, expectedFormat: String? = nil) -> Date? {
        let cleaned = clean(value)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:/|·•–—- "))
            .replacingOccurrences(of: #"(?<=\d)(st|nd|rd|th)\b"#, with: "", options: [.regularExpression, .caseInsensitive])
        let authorityDefinesDayFirst = expectedFormat == "date-dotted"
            && !hasWrongNumericSeparators(cleaned, expected: ".")
        if isAmbiguousNumericDate(cleaned), !authorityDefinesDayFirst {
            return nil
        }
        let monthAliases = [
            "يناير": "January", "فبراير": "February", "مارس": "March", "أبريل": "April",
            "ابريل": "April", "مايو": "May", "يونيو": "June", "يوليو": "July",
            "أغسطس": "August", "اغسطس": "August", "سبتمبر": "September", "أكتوبر": "October",
            "اكتوبر": "October", "نوفمبر": "November", "ديسمبر": "December"
        ]
        let latinizedArabicMonth = monthAliases.reduce(cleaned) { result, replacement in
            result.replacingOccurrences(of: replacement.key, with: replacement.value)
        }
        var candidates = [
            cleaned,
            // Spanish and Portuguese commonly write dates as
            // "18 de julio de 2026". DateFormatter expects the same month
            // names without the connecting particles.
            cleaned.replacingOccurrences(of: #"\s+de\s+"#, with: " ", options: [.regularExpression, .caseInsensitive]),
            latinizedArabicMonth
        ]
        let embeddedDatePatterns = [
            #"(?<!\d)\d{1,2}\s+[\p{L}\.]+\s+\d{4}(?!\d)"#,
            #"(?<!\d)\d{4}[-\./]\d{1,2}[-\./]\d{1,2}(?!\d)"#,
            #"(?<!\d)\d{1,2}[-\./]\d{1,2}[-\./]\d{2,4}(?!\d)"#,
            #"\d{4}年\d{1,2}月\d{1,2}日"#
        ]
        for source in [cleaned, latinizedArabicMonth] {
            for pattern in embeddedDatePatterns {
                if let range = source.range(of: pattern, options: [.regularExpression, .caseInsensitive]) {
                    candidates.append(String(source[range]))
                }
            }
        }
        for candidate in candidates {
            for formatter in dateFormatters {
                if let date = formatter.date(from: candidate) { return date }
            }
        }
        return nil
    }

    /// Built once. Each `parseDate` call tries every locale/format pair, so
    /// constructing them per attempt meant hundreds of `DateFormatter`
    /// allocations for a single scanned certificate.
    private static let dateFormatters: [DateFormatter] = {
        // One entry per language an authority in the register prints month
        // names in. A locale that is not here cannot yield an ISO date, which
        // is why Greek and Turkish certificates produced no date at all.
        let localeIdentifiers = [
            "en_US_POSIX", "fr_FR", "es_ES", "de_DE", "it_IT", "pt_PT", "nl_NL",
            "ru_RU", "uk_UA", "ar_SA", "zh_CN", "ja_JP", "ko_KR",
            "el_GR", "tr_TR", "ro_RO", "bg_BG", "da_DK", "id_ID", "he_IL",
            "et_EE", "lv_LV", "sl_SI", "ka_GE", "hy_AM", "kk_KZ"
        ]
        let formats = [
            "yyyy-MM-dd", "yyyy/MM/dd", "yyyy.MM.dd", "dd.MM.yyyy", "dd/MM/yyyy", "d/M/yyyy",
            "MM/dd/yyyy", "d MMMM yyyy", "d MMM yyyy", "d. MMMM yyyy", "d. MMM yyyy",
            "MMMM d yyyy", "MMM d yyyy", "MMMM d,yyyy", "MMM d,yyyy",
            "yyyy MMMM d", "yyyy MMM d", "yyyy年M月d日"
        ]
        return localeIdentifiers.flatMap { locale in
            formats.map { format in
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: locale)
                formatter.calendar = Calendar(identifier: .gregorian)
                formatter.timeZone = TimeZone(secondsFromGMT: 0)
                formatter.dateFormat = format
                formatter.isLenient = false
                return formatter
            }
        }
    }()

    /// Without authority metadata, `04/05/2026` could be either 4 May or
    /// April 5. Do not manufacture an ISO value that silently chooses one.
    private static func isAmbiguousNumericDate(_ value: String) -> Bool {
        guard let match = firstMatch(#"(?<!\d)(\d{1,2})[-\./](\d{1,2})[-\./]\d{4}(?!\d)"#, in: value),
              let first = Int(match[1]), let second = Int(match[2]) else { return false }
        return (1...12).contains(first) && (1...12).contains(second)
    }

    private static func hasWrongNumericSeparators(_ value: String, expected separator: Character) -> Bool {
        guard value.range(of: #"(?<!\d)\d{1,2}[-\./]\d{1,2}[-\./]\d{4}(?!\d)"#, options: .regularExpression) != nil else {
            return false
        }
        return value.filter { $0 == "." || $0 == "/" || $0 == "-" }.contains { $0 != separator }
    }

    private static func dateString(_ date: Date, format: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = format
        return formatter.string(from: date)
    }

    private static func normalize(_ value: String) -> String {
        value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
            .replacingOccurrences(of: "[^\\p{L}\\p{N}]+", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func clean(_ value: String) -> String {
        value.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func firstMatch(_ pattern: String, in value: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) else { return nil }
        return (0..<match.numberOfRanges).map { index in
            let range = match.range(at: index)
            guard let swiftRange = Range(range, in: value) else { return "" }
            return String(value[swiftRange])
        }
    }
}
