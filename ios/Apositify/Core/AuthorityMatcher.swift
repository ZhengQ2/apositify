import Foundation

struct AuthorityMatcher {
    private let entries: [RegisterEntry]

    init(entries: [RegisterEntry]) {
        self.entries = entries
    }

    func matches(for recognition: RecognitionResult, limit: Int = 5) -> [AuthorityMatch] {
        let text = normalize(recognition.fullText)
        let itemSeven = ApostilleParser.numberedItems(in: recognition.lines)[7].map(normalize) ?? ""
        let textTokens = Set(text.split(separator: " ").map(String.init))
        let itemSevenTokens = Set(itemSeven.split(separator: " ").map(String.init))
        let normalizedLines = recognition.lines.map { normalize($0.text) }
        let detectedCountries = detectCountries(in: normalizedLines, fullText: text)

        return entries.compactMap { entry -> AuthorityMatch? in
            let countryHit = detectedCountries.contains(entry.country)
            let authorityTokens = significantTokens(entry.authority)
            let authorityHits = authorityTokens.filter(textTokens.contains)
            let itemSevenHits = authorityTokens.filter(itemSevenTokens.contains)
            let aliasHit = authorityAliases[entry.id, default: []]
                .map(normalize)
                .contains { containsPhrase($0, in: text) }

            var score = countryHit ? 0.66 : 0
            if !authorityTokens.isEmpty {
                score += 0.24 * Double(authorityHits.count) / Double(authorityTokens.count)
                score += 0.10 * Double(itemSevenHits.count) / Double(authorityTokens.count)
            }
            if aliasHit { score += 0.28 }

            // When a country only has one authority in our data, its country label is
            // enough to present a strong suggestion. It is still reviewed by the user.
            if countryHit && entries.lazy.filter({ $0.country == entry.country }).prefix(2).count == 1 {
                score = max(score, 0.91)
            }
            guard score >= 0.20 else { return nil }

            let evidence: String
            if countryHit && !authorityHits.isEmpty {
                evidence = "Country and issuing authority appear in the scan"
            } else if countryHit {
                evidence = "Country appears in the scan"
            } else {
                evidence = "Issuing authority words appear in the scan"
            }
            return AuthorityMatch(entry: entry, score: min(score, 1), evidence: evidence)
        }
        .sorted {
            if $0.score == $1.score { return $0.entry.authority < $1.entry.authority }
            return $0.score > $1.score
        }
        .prefix(limit)
        .map { $0 }
    }

    private func normalize(_ value: String) -> String {
        value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
            .replacingOccurrences(of: "[^\\p{L}\\p{N}]+", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func significantTokens(_ value: String) -> [String] {
        let ignored: Set<String> = [
            "and", "of", "the", "for", "to", "a", "an", "de", "la", "le", "du",
            "des", "et", "ministry", "minister", "department", "office", "authority"
        ]
        return normalize(value).split(separator: " ").map(String.init).filter {
            $0.count > 2 && !ignored.contains($0)
        }
    }

    private func countryNames(for country: String) -> [String] {
        let aliases: [String: [String]] = [
            "Korea, Republic of": ["republic of korea", "south korea"],
            "Moldova, Republic of": ["republic of moldova", "moldova"],
            "China": ["china", "中国", "中國"],
            "Türkiye": ["turkiye", "turkey"],
            "United States of America": ["united states of america", "united states", "usa"],
            "Russian Federation": ["russian federation", "russia", "российская федерация", "россия"]
        ]
        let regionCodes: [String: String] = [
            "Andorra": "AD", "Argentina": "AR", "Armenia": "AM", "Australia": "AU", "Austria": "AT",
            "Azerbaijan": "AZ", "Bahrain": "BH", "Bangladesh": "BD", "Belgium": "BE", "Bolivia": "BO",
            "Brazil": "BR", "Bulgaria": "BG", "Canada": "CA", "Chile": "CL", "China": "CN",
            "Colombia": "CO", "Costa Rica": "CR", "Cyprus": "CY", "Denmark": "DK", "Dominican Republic": "DO",
            "Ecuador": "EC", "El Salvador": "SV", "Estonia": "EE", "France": "FR", "Georgia": "GE",
            "Greece": "GR", "Guatemala": "GT", "India": "IN", "Indonesia": "ID", "Ireland": "IE",
            "Israel": "IL", "Japan": "JP", "Kazakhstan": "KZ", "Korea, Republic of": "KR", "Kosovo": "XK",
            "Latvia": "LV", "Luxembourg": "LU", "Mexico": "MX", "Moldova, Republic of": "MD", "Mongolia": "MN",
            "Morocco": "MA", "New Zealand": "NZ", "Nicaragua": "NI", "Pakistan": "PK", "Panama": "PA",
            "Paraguay": "PY", "Peru": "PE", "Philippines": "PH", "Romania": "RO", "Russian Federation": "RU",
            "Rwanda": "RW", "Saint Kitts and Nevis": "KN", "Saudi Arabia": "SA", "Singapore": "SG", "Slovenia": "SI",
            "Spain": "ES", "Tajikistan": "TJ", "Türkiye": "TR", "Ukraine": "UA", "United Kingdom": "GB",
            "United States of America": "US", "Uruguay": "UY", "Uzbekistan": "UZ", "Venezuela": "VE"
        ]
        let languageLocales = ["en", "fr", "es", "de", "it", "pt", "nl", "ru", "uk", "zh_Hans", "zh_Hant", "ja", "ko", "ar"]
        let localized = regionCodes[country].map { code in
            languageLocales.compactMap { Locale(identifier: $0).localizedString(forRegionCode: code) }
        } ?? []
        return Array(Set(([country] + (aliases[country] ?? []) + localized).map(normalize)))
    }

    /// An Apostille prints its country as a field value, not inside a sentence.
    /// A Hong Kong certificate whose attached notarial page happens to mention
    /// exporting goods "to India" was being read as an Indian Apostille, because
    /// the country name appearing anywhere on the page counted the same as the
    /// country field itself. Require the name to account for a real share of the
    /// line it sits on, and fall back to the whole page when that finds nothing.
    private func detectCountries(in lines: [String], fullText: String) -> Set<String> {
        func detected(_ isFieldLike: Bool) -> Set<String> {
            Set(entries.compactMap { entry -> String? in
                let names = countryNames(for: entry.country)
                guard names.contains(where: { name in
                    lines.contains { line in
                        containsPhrase(name, in: line)
                            && (!isFieldLike || name.count * 2 + 24 >= line.count)
                    }
                }) else { return nil }
                return entry.country
            })
        }
        let fieldLike = detected(true)
        if !fieldLike.isEmpty { return fieldLike }
        return Set(entries.compactMap { entry in
            countryNames(for: entry.country).contains(where: { containsPhrase($0, in: fullText) }) ? entry.country : nil
        })
    }

    /// A country name printed only inside a larger place name that belongs to a
    /// different state is not that country. "United Kingdom of Great Britain and
    /// Northern Ireland" names one country, and reading "Ireland" out of it put
    /// every UK Apostille under the wrong authority.
    private var shadowingPhrases: [String: [String]] {
        ["ireland": ["northern ireland"]]
    }

    private func containsPhrase(_ phrase: String, in text: String) -> Bool {
        var padded = " \(text) "
        for shadow in shadowingPhrases[phrase] ?? [] {
            padded = padded.replacingOccurrences(of: " \(shadow) ", with: " ")
        }
        return padded.contains(" \(phrase) ")
    }

    private var authorityAliases: [String: [String]] {
        [
            "united-kingdom-foreign-and-commonwealth-office": [
                "legalisation office",
                "legalization office",
                "foreign commonwealth and development office",
                "fcdo"
            ]
        ]
    }
}
