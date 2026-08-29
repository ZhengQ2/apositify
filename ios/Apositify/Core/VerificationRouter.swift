import Foundation

enum VerificationRoute {
    case get(URL)
    case post(URLRequest)
    case official(URL)
    case externalInsecure(URL)
    case unavailable

    var initialURL: URL? {
        switch self {
        case .get(let url), .official(let url), .externalInsecure(let url): url
        case .post(let request): request.url
        case .unavailable: nil
        }
    }

    var isPrefilled: Bool {
        switch self {
        case .get, .post: true
        case .official, .externalInsecure, .unavailable: false
        }
    }
}

struct OfficialHostPolicy: Hashable {
    let allowedHosts: Set<String>

    init(entry: RegisterEntry, initialURL: URL?) {
        var hosts = Set<String>()
        func include(_ url: URL?) {
            if let host = url?.host?.lowercased() { hosts.insert(host) }
        }

        include(initialURL)
        include(entry.registerUrl)
        include(entry.verification?.deepLink?.url)
        entry.registerLinks.forEach { include($0.url) }
        entry.qrRoutes.flatMap(\.allowedUrls).forEach { hosts.insert($0.hostname.lowercased()) }
        allowedHosts = hosts
    }

    func permitsMainFrameNavigation(to url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        if scheme == "about" { return true }
        guard scheme == "https", let host = url.host?.lowercased() else { return false }
        return allowedHosts.contains(host)
    }
}

enum VerificationRouter {
    static func route(for entry: RegisterEntry, values: [String: String]) -> VerificationRoute {
        if let deepLink = entry.verification?.deepLink,
           deepLink.paramOrder.count == entry.verification?.fields.count,
           entry.verification?.fields.allSatisfy({ !(values[$0.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) == true {
            // Never place reviewed certificate values in an HTTP URL or body.
            // HTTP-only authorities are opened externally after an explicit
            // warning, without official in-app branding or autofill.
            guard isSecure(deepLink.url) else {
                return .externalInsecure(deepLink.url)
            }
            let orderedValues = entry.verification?.fields.map {
                values[$0.id, default: ""].trimmingCharacters(in: .whitespacesAndNewlines)
            } ?? []
            var parameters = deepLink.extraParams
            for (name, value) in zip(deepLink.paramOrder, orderedValues) {
                parameters[name] = value
            }

            switch deepLink.method {
            case .get:
                guard var components = URLComponents(url: deepLink.url, resolvingAgainstBaseURL: false) else {
                    return .unavailable
                }
                var queryItems = components.queryItems ?? []
                queryItems.append(contentsOf: parameters.sorted(by: { $0.key < $1.key }).map(URLQueryItem.init))
                components.queryItems = queryItems
                return components.url.map(VerificationRoute.get) ?? .unavailable
            case .post:
                var request = URLRequest(url: deepLink.url)
                request.httpMethod = "POST"
                request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
                request.httpBody = parameters.sorted(by: { $0.key < $1.key })
                    .map { "\(formEncode($0.key))=\(formEncode($0.value))" }
                    .joined(separator: "&")
                    .data(using: .utf8)
                return .post(request)
            }
        }

        if let registerUrl = entry.registerUrl { return route(to: registerUrl) }
        if let first = entry.registerLinks.first { return route(to: first.url) }
        return .unavailable
    }

    static func route(to officialURL: URL) -> VerificationRoute {
        isSecure(officialURL) ? .official(officialURL) : .externalInsecure(officialURL)
    }

    private static func isSecure(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https"
    }

    private static func formEncode(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed)?
            .replacingOccurrences(of: "%20", with: "+") ?? value
    }
}
