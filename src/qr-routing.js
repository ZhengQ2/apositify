// Phase 3.3 — payload classification and safe routing.
//
// A decoded QR is untrusted input. A matching logo, a plausible page design, or
// the mere presence of HTTPS does not make a destination official. Nothing here
// fetches, follows, or renders a decoded destination; it only decides whether an
// "open the official page" action may be offered, and rebuilds a canonical URL
// from the authority's own stored base wherever a token mapping is documented.
//
// This module is pure and dependency-free so the adversarial suite in
// scripts/test-qr-routing.mjs can exercise it directly under Node.

import { enabledQrRecordsFor, qrRecordsFor } from './data/qr-codes.js'

/** Outcome kinds. Only `official` may render a navigation action. */
export const OUTCOME = {
  OFFICIAL: 'official',
  OFFLINE_APP: 'offline_app',
  BLOCKED: 'blocked',
  UNSUPPORTED: 'unsupported',
  NOT_ENABLED: 'not_enabled'
}

const MAX_PAYLOAD_LENGTH = 4096

/**
 * Hostnames are compared after the URL parser's IDN → ASCII (punycode)
 * normalisation, lowercased, with a trailing root dot removed. Never substring,
 * never endsWith without a dot boundary — `evil-e-verify.am` and
 * `e-verify.am.attacker.test` must both fail against `e-verify.am`.
 */
export function normalizeHostname(hostname) {
  return String(hostname || '').toLowerCase().replace(/\.$/, '')
}

export function hostnameMatches(actual, rule) {
  const host = normalizeHostname(actual)
  const expected = normalizeHostname(rule.hostname)
  if (!host || !expected) return false
  if (host === expected) return true
  if (rule.allowSubdomains) return host.endsWith(`.${expected}`)
  return false
}

/** Percent-encoding that does not decode is treated as hostile, not as a typo. */
function hasWellFormedEncoding(url) {
  try {
    decodeURIComponent(url.pathname)
    decodeURIComponent(url.search)
    return true
  } catch {
    return false
  }
}

function parsePayloadUrl(text) {
  let url
  try {
    url = new URL(text)
  } catch {
    return { error: 'not_a_url' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'unsupported_scheme' }
  // Credentials in a URL are a classic host-confusion trick: the part a human
  // reads as the host is actually the username.
  if (url.username || url.password) return { error: 'credentials_in_url' }
  if (!url.hostname) return { error: 'malformed_host' }
  if (!hasWellFormedEncoding(url)) return { error: 'malformed_encoding' }
  return { url }
}

function matchRule(url, rule) {
  if (url.protocol !== (rule.protocol || 'https:')) return 'protocol_mismatch'
  if (!hostnameMatches(url.hostname, rule)) return 'host_not_allowlisted'
  // An empty rule port means "the scheme default"; a payload that names an
  // explicit non-default port is rejected rather than silently normalised.
  if (url.port !== (rule.port || '')) return 'unexpected_port'
  if (rule.pathnamePattern && !new RegExp(rule.pathnamePattern).test(url.pathname)) return 'path_mismatch'

  // Query parameters are deny-by-default. This is what keeps open-redirect
  // parameters (`?next=`, `?url=`, `?returnUrl=`) out without enumerating them.
  const allowedParams = rule.allowedSearchParams || []
  for (const key of url.searchParams.keys()) {
    if (!allowedParams.includes(key)) return 'unexpected_query_parameter'
  }
  if (url.hash && !rule.allowFragment) return 'unexpected_fragment'
  return null
}

/**
 * Rebuild the destination from the authority's stored base where the rule
 * documents a token mapping, so we navigate to a URL we constructed rather than
 * one the QR handed us. Falls back to the validated payload URL.
 */
function buildDestination(url, rule) {
  if (!rule.tokenPattern || !rule.canonicalUrlTemplate) {
    return { href: url.toString(), token: null, canonical: false }
  }
  const match = new RegExp(rule.tokenPattern).exec(url.pathname + url.search)
  const token = match?.[rule.tokenGroup ?? 1]
  if (!token) return null
  return {
    href: rule.canonicalUrlTemplate.replace('{token}', encodeURIComponent(token)),
    token,
    canonical: true
  }
}

/**
 * Classify a decoded QR payload against the selected authority.
 *
 * Returns a plain result object; the caller decides what to render. The only
 * kind that may produce a navigation action is OUTCOME.OFFICIAL, and even then
 * the copy must describe what the destination *is* (status lookup, portal, or
 * document retrieval) rather than claiming this app verified anything.
 */
export function classifyQrPayload(rawText, authorityId) {
  const raw = typeof rawText === 'string' ? rawText.trim() : ''
  if (!raw) return { kind: OUTCOME.UNSUPPORTED, reason: 'empty_payload', raw, authorityId }
  if (raw.length > MAX_PAYLOAD_LENGTH) {
    return { kind: OUTCOME.UNSUPPORTED, reason: 'payload_too_large', raw: raw.slice(0, 256), authorityId }
  }

  const enabled = enabledQrRecordsFor(authorityId)
  if (enabled.length === 0) {
    // Covers unknown authorities, every not-yet-gated authority, and the
    // presence tiers that are documented but deliberately not routable.
    const known = qrRecordsFor(authorityId)
    return {
      kind: OUTCOME.NOT_ENABLED,
      reason: known.length > 0 ? 'authority_not_enabled' : 'authority_unknown',
      presence: known[0]?.presence ?? null,
      raw,
      authorityId
    }
  }

  // An offline-app authority's payload is a signed blob for a government app,
  // not something we parse or open.
  const offlineApp = enabled.find((entry) => entry.function === 'offline_app')
  if (offlineApp) {
    return { kind: OUTCOME.OFFLINE_APP, reason: 'offline_app', app: offlineApp.app || null, record: offlineApp, raw, authorityId }
  }

  const parsed = parsePayloadUrl(raw)
  if (parsed.error) return { kind: OUTCOME.UNSUPPORTED, reason: parsed.error, raw, authorityId }
  const { url } = parsed

  let lastReason = 'host_not_allowlisted'
  for (const entry of enabled) {
    for (const rule of entry.allowedUrls || []) {
      const failure = matchRule(url, rule)
      if (failure) {
        lastReason = failure
        continue
      }
      const destination = buildDestination(url, rule)
      if (!destination) {
        lastReason = 'token_not_extractable'
        continue
      }
      if (entry.function === 'unknown') {
        return { kind: OUTCOME.UNSUPPORTED, reason: 'undocumented_function', host: normalizeHostname(url.hostname), raw, authorityId }
      }
      return {
        kind: OUTCOME.OFFICIAL,
        function: entry.function,
        url: destination.href,
        host: normalizeHostname(url.hostname),
        token: destination.token,
        canonical: destination.canonical,
        record: entry,
        raw,
        authorityId
      }
    }
  }

  // The payload decoded cleanly but does not belong to the selected authority.
  // Show the decoded host so the user can see the mismatch; never open it.
  return { kind: OUTCOME.BLOCKED, reason: lastReason, host: normalizeHostname(url.hostname), raw, authorityId }
}
