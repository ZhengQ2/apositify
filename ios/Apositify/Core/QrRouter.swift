import Foundation

enum QrRouter {
    private static let maximumPayloadLength = 4_096

    static func match(_ rawPayload: String, entries: [RegisterEntry]) -> QrMatch? {
        let matches = entries.compactMap { match(rawPayload, entry: $0) }
        guard let first = matches.first else { return nil }
        // Ambiguous authority matches must fall back to text/user review.
        guard matches.dropFirst().allSatisfy({ $0.entry.id == first.entry.id }) else { return nil }
        return first
    }

    static func match(_ rawPayload: String, entry: RegisterEntry) -> QrMatch? {
        let raw = rawPayload.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty, raw.count <= maximumPayloadLength else { return nil }

        for route in entry.qrRoutes where !route.allowedUrls.isEmpty {
            let normalized = normalizeScheme(in: raw, route: route)
            guard var components = URLComponents(string: normalized),
                  let scheme = components.scheme?.lowercased(),
                  ["https", "http"].contains(scheme),
                  components.user == nil,
                  components.password == nil,
                  let host = components.host?.lowercased(),
                  !host.isEmpty else { continue }
            // The web engine parses with WHATWG `URL`, which drops a redundant
            // default port, so `https://host:443/x` and `https://host/x` are the
            // same URL there. `URLComponents` keeps it, and the rules record an
            // empty port; normalize so both engines route the payload alike.
            if components.port == defaultPort(for: scheme) { components.port = nil }

            for rule in route.allowedUrls where matches(components, host: host, rule: rule) {
                let destination = canonicalDestination(components, rule: rule, specimenCount: route.specimenCount)
                    ?? components.url
                guard let destination else { continue }
                return QrMatch(
                    entry: entry,
                    destination: destination,
                    function: route.function,
                    rawPayload: raw,
                    specimenCount: route.specimenCount
                )
            }
        }
        return nil
    }

    private static func normalizeScheme(in raw: String, route: QrRoute) -> String {
        if raw.range(of: #"^[a-z][a-z0-9+.-]*:"#, options: [.regularExpression, .caseInsensitive]) != nil {
            return raw
        }
        guard let scheme = route.normalizeSchemelessTo,
              raw.range(of: #"^[a-z0-9.-]+\.[a-z]{2,}(?:[:/?#]|$)"#, options: [.regularExpression, .caseInsensitive]) != nil else {
            return raw
        }
        return "\(scheme)//\(raw)"
    }

    private static func matches(_ components: URLComponents, host: String, rule: QrUrlRule) -> Bool {
        let expectedScheme = rule.protocol.replacingOccurrences(of: ":", with: "").lowercased()
        guard components.scheme?.lowercased() == expectedScheme else { return false }
        if expectedScheme == "http" && !rule.insecureAccepted { return false }

        let expectedHost = rule.hostname.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let hostMatches = host == expectedHost || (rule.allowSubdomains && host.hasSuffix(".\(expectedHost)"))
        guard hostMatches else { return false }
        guard String(components.port ?? defaultPortSentinel) == (rule.port.isEmpty ? String(defaultPortSentinel) : rule.port) else { return false }

        if let pattern = rule.pathnamePattern, !regex(pattern, matches: components.percentEncodedPath) { return false }

        let queryItems = components.queryItems ?? []
        var seen = Set<String>()
        for item in queryItems {
            guard rule.allowedSearchParams.contains(item.name), seen.insert(item.name).inserted else { return false }
        }
        for required in rule.requiredSearchParams {
            guard let value = queryItems.first(where: { $0.name == required })?.value,
                  !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        }
        for (name, expected) in rule.staticSearchParams {
            guard queryItems.first(where: { $0.name == name })?.value == expected else { return false }
        }

        let fragment = components.percentEncodedFragment.map { "#\($0)" } ?? ""
        if !fragment.isEmpty && !rule.allowFragment { return false }
        if rule.requireFragment && fragment.isEmpty { return false }
        if let pattern = rule.fragmentPattern, !regex(pattern, matches: fragment) { return false }
        return true
    }

    private static let defaultPortSentinel = -1

    private static func defaultPort(for scheme: String) -> Int? {
        switch scheme {
        case "https": 443
        case "http": 80
        default: nil
        }
    }

    private static func canonicalDestination(
        _ components: URLComponents,
        rule: QrUrlRule,
        specimenCount: Int
    ) -> URL? {
        guard specimenCount >= 2,
              let pattern = rule.tokenPattern,
              let template = rule.canonicalUrlTemplate else { return nil }
        let subject = rule.tokenSource == "hash"
            ? "#\(components.percentEncodedFragment ?? "")"
            : components.percentEncodedPath + (components.percentEncodedQuery.map { "?\($0)" } ?? "")
        guard let expression = try? NSRegularExpression(pattern: pattern),
              let match = expression.firstMatch(in: subject, range: NSRange(subject.startIndex..., in: subject)) else { return nil }
        let group = rule.tokenGroup ?? 1
        guard group < match.numberOfRanges,
              let range = Range(match.range(at: group), in: subject) else { return nil }
        let token = String(subject[range]).addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? String(subject[range])
        return URL(string: template.replacingOccurrences(of: "{token}", with: token))
    }

    private static func regex(_ pattern: String, matches value: String) -> Bool {
        guard let expression = try? NSRegularExpression(pattern: pattern) else { return false }
        let range = NSRange(value.startIndex..., in: value)
        guard let match = expression.firstMatch(in: value, range: range) else { return false }
        return match.range == range
    }
}
