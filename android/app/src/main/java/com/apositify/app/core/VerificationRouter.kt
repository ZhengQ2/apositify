package com.apositify.app.core

import com.apositify.app.model.RegisterEntry
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

sealed interface VerificationRoute {
    data class Get(val uri: URI) : VerificationRoute
    data class Post(val uri: URI, val body: ByteArray) : VerificationRoute
    data class Official(val uri: URI) : VerificationRoute
    data class ExternalInsecure(val uri: URI) : VerificationRoute
    data object Unavailable : VerificationRoute
}

object VerificationRouter {
    fun route(entry: RegisterEntry, values: Map<String, String>): VerificationRoute {
        val config = entry.verification
        val deep = config?.deepLink
        if (deep != null && deep.paramOrder.size == config.fields.size &&
            config.fields.all { values[it.id].orEmpty().trim().isNotEmpty() }) {
            val uri = parse(deep.url) ?: return VerificationRoute.Unavailable
            if (uri.scheme?.lowercase() != "https") return VerificationRoute.ExternalInsecure(uri)
            val parameters = deep.extraParams.toMutableMap()
            config.fields.map { values[it.id].orEmpty().trim() }
                .zip(deep.paramOrder).forEach { (value, name) -> parameters[name] = value }
            val encoded = parameters.toSortedMap().entries.joinToString("&") { (key, value) ->
                "${formEncode(key)}=${formEncode(value)}"
            }
            return if (deep.method.lowercase() == "post") {
                VerificationRoute.Post(uri, encoded.toByteArray(StandardCharsets.UTF_8))
            } else {
                val separator = if (uri.rawQuery.isNullOrEmpty()) "?" else "&"
                VerificationRoute.Get(URI(uri.toASCIIString() + separator + encoded))
            }
        }

        entry.registerUrl?.let { return routeTo(it) }
        entry.registerLinks.firstOrNull()?.url?.let { return routeTo(it) }
        return VerificationRoute.Unavailable
    }

    fun routeTo(url: String): VerificationRoute {
        val uri = parse(url) ?: return VerificationRoute.Unavailable
        return when (uri.scheme?.lowercase()) {
            "https" -> VerificationRoute.Official(uri)
            "http" -> VerificationRoute.ExternalInsecure(uri)
            else -> VerificationRoute.Unavailable
        }
    }

    private fun parse(value: String) = runCatching { URI(value) }.getOrNull()
    private fun formEncode(value: String) = URLEncoder.encode(value, "UTF-8")
}

/**
 * @param allowedDomains roots the approved hosts may widen to, computed against
 * the Public Suffix List when the catalogue is generated so a root can never be
 * a suffix itself. A verifier that redirects to its own www, or to a sibling
 * subdomain, has not left the authority.
 */
data class OfficialHostPolicy(
    val allowedHosts: Set<String>,
    val allowedDomains: Set<String> = emptySet(),
) {
    fun permits(uri: URI): Boolean {
        if (uri.toString() == "about:blank") return true
        if (uri.scheme?.lowercase() != "https") return false
        val host = uri.host?.lowercase() ?: return false
        if (host in allowedHosts) return true
        return allowedDomains.any { host == it || host.endsWith(".$it") }
    }

    companion object {
        fun forEntry(entry: RegisterEntry, initial: URI?): OfficialHostPolicy {
            val hosts = buildSet {
                fun addUrl(url: String?) { runCatching { URI(url).host?.lowercase() }.getOrNull()?.let(::add) }
                initial?.host?.lowercase()?.let(::add)
                addUrl(entry.registerUrl)
                addUrl(entry.verification?.deepLink?.url)
                entry.registerLinks.forEach { addUrl(it.url) }
                entry.qrRoutes.flatMap { it.allowedUrls }.forEach { add(it.hostname.lowercase()) }
            }
            return OfficialHostPolicy(hosts, entry.allowedDomains.map { it.lowercase() }.toSet())
        }
    }
}
