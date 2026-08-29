package com.apositify.app.core

import com.apositify.app.model.QrMatch
import com.apositify.app.model.QrUrlRule
import com.apositify.app.model.RegisterEntry
import java.net.URI
import java.net.URLEncoder

object QrRouter {
    private const val MAX_PAYLOAD_LENGTH = 4_096

    fun match(rawPayload: String, entries: List<RegisterEntry>): QrMatch? {
        val matches = entries.mapNotNull { match(rawPayload, it) }
        val first = matches.firstOrNull() ?: return null
        return first.takeIf { matches.all { candidate -> candidate.entry.id == first.entry.id } }
    }

    fun match(rawPayload: String, entry: RegisterEntry): QrMatch? {
        val raw = rawPayload.trim()
        if (raw.isEmpty() || raw.length > MAX_PAYLOAD_LENGTH) return null

        entry.qrRoutes.filter { it.allowedUrls.isNotEmpty() }.forEach { route ->
            val normalized = normalizeScheme(raw, route.normalizeSchemelessTo)
            val uri = runCatching { URI(normalized) }.getOrNull() ?: return@forEach
            val scheme = uri.scheme?.lowercase() ?: return@forEach
            val host = uri.host?.lowercase() ?: return@forEach
            if (scheme !in setOf("https", "http") || uri.userInfo != null || host.isBlank()) return@forEach

            route.allowedUrls.firstOrNull { ruleMatches(uri, rule = it) }?.let { rule ->
                val destination = canonicalDestination(uri, rule, route.specimenCount) ?: uri
                return QrMatch(entry, destination, route.function, raw, route.specimenCount)
            }
        }
        return null
    }

    private fun normalizeScheme(raw: String, scheme: String?): String {
        if (Regex("^[a-z][a-z0-9+.-]*:", RegexOption.IGNORE_CASE).containsMatchIn(raw)) return raw
        if (scheme != null && Regex("^[a-z0-9.-]+\\.[a-z]{2,}(?:[:/?#]|$)", RegexOption.IGNORE_CASE).containsMatchIn(raw)) {
            return "$scheme//$raw"
        }
        return raw
    }

    private fun ruleMatches(uri: URI, rule: QrUrlRule): Boolean {
        val expectedScheme = rule.protocol.removeSuffix(":").lowercase()
        if (uri.scheme?.lowercase() != expectedScheme) return false
        if (expectedScheme == "http" && !rule.insecureAccepted) return false

        val expectedHost = rule.hostname.lowercase().trim('.')
        val host = uri.host?.lowercase() ?: return false
        if (host != expectedHost && !(rule.allowSubdomains && host.endsWith(".$expectedHost"))) return false
        val actualPort = if (uri.port == defaultPort(expectedScheme)) -1 else uri.port
        val expectedPort = rule.port.toIntOrNull() ?: -1
        if (actualPort != expectedPort) return false
        if (rule.pathnamePattern != null && !safeMatches(rule.pathnamePattern, uri.rawPath.orEmpty())) return false

        val query = parseRawQuery(uri.rawQuery)
        if (query.size != query.keys.size) return false
        if (query.keys.any { it !in rule.allowedSearchParams }) return false
        if (rule.requiredSearchParams.any { query[it].isNullOrBlank() }) return false
        if (rule.staticSearchParams.any { (key, value) -> query[key] != value }) return false

        val fragment = uri.rawFragment?.let { "#$it" }.orEmpty()
        if (fragment.isNotEmpty() && !rule.allowFragment) return false
        if (rule.requireFragment && fragment.isEmpty()) return false
        if (rule.fragmentPattern != null && !safeMatches(rule.fragmentPattern, fragment)) return false
        return true
    }

    private fun parseRawQuery(raw: String?): Map<String, String> {
        if (raw.isNullOrEmpty()) return emptyMap()
        val result = linkedMapOf<String, String>()
        for (part in raw.split('&')) {
            val pieces = part.split('=', limit = 2)
            val name = decode(pieces[0])
            if (result.containsKey(name)) return mapOf("__duplicate__" to "1", name to "")
            result[name] = decode(pieces.getOrElse(1) { "" })
        }
        return result
    }

    private fun canonicalDestination(uri: URI, rule: QrUrlRule, specimenCount: Int): URI? {
        if (specimenCount < 2 || rule.tokenPattern == null || rule.canonicalUrlTemplate == null) return null
        val subject = if (rule.tokenSource == "hash") "#${uri.rawFragment.orEmpty()}"
            else uri.rawPath.orEmpty() + uri.rawQuery?.let { "?$it" }.orEmpty()
        val match = runCatching { Regex(rule.tokenPattern, RegexOption.IGNORE_CASE).find(subject) }.getOrNull() ?: return null
        val token = match.groups[rule.tokenGroup ?: 1]?.value ?: return null
        val encoded = URLEncoder.encode(token, "UTF-8").replace("+", "%20")
        return runCatching { URI(rule.canonicalUrlTemplate.replace("{token}", encoded)) }.getOrNull()
    }

    private fun safeMatches(pattern: String, value: String) = runCatching { Regex(pattern).matches(value) }.getOrDefault(false)
    private fun defaultPort(scheme: String) = if (scheme == "https") 443 else if (scheme == "http") 80 else -1
    private fun decode(value: String) = runCatching { java.net.URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
}
