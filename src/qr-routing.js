// Phase 3.3 — payload classification and safe routing.
//
// A decoded QR is untrusted input. A matching logo, a plausible page design, or
// the mere presence of HTTPS does not make a destination official. Nothing here
// fetches, follows, or renders a decoded destination.
//
// Routing is TIERED. The tier decides how strongly the UI may speak, not merely
// whether a link appears:
//
//   verified    The host came from a decoded specimen of a real apostille for
//               THIS authority. Full "open the official lookup" affordance.
//   government  No specimen for this authority, but the host sits inside the
//               party's government namespace. Weaker affordance, explicit
//               "we have not verified this authority's QR format" warning, and
//               never the word verification. See ./data/government-domains.js
//               for why this tier is a heuristic and not evidence.
//   none        Neither. No navigation offered at all.
//
// This module is pure and dependency-free so the adversarial suite in
// scripts/test-qr-routing.mjs can exercise it directly under Node.

import { enabledQrRecordsFor, qrRecordsFor } from './data/qr-codes.js'
import { looksNonProduction, matchesGovernmentSuffix } from './data/government-domains.js'

export const OUTCOME = {
  OFFICIAL: 'official',              // verified tier, navigation allowed
  UNVERIFIED_GOVERNMENT: 'unverified_government', // government tier, cautious navigation
  EMBEDDED_FIELDS: 'embedded_fields', // payload is the apostille's own field data
  OFFLINE_APP: 'offline_app',
  BLOCKED: 'blocked',
  UNSUPPORTED: 'unsupported',
  NOT_ENABLED: 'not_enabled'
}

export const TRUST = { VERIFIED: 'verified', GOVERNMENT: 'government', NONE: 'none' }

const MAX_PAYLOAD_LENGTH = 4096

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

function hasWellFormedEncoding(url) {
  try {
    decodeURIComponent(url.pathname)
    decodeURIComponent(url.search)
    decodeURIComponent(url.hash)
    return true
  } catch {
    return false
  }
}

/**
 * Some authorities encode a bare host with no scheme (Bahrain:
 * "www.mofa.gov.bh/legalization?id=..."). `new URL()` rejects that. Only
 * authorities that documented the behaviour opt in, and only to https.
 */
function applySchemeNormalization(raw, records) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return { text: raw, normalized: false }
  const rule = records.find((entry) => entry.normalizeSchemelessTo)
  if (!rule) return { text: raw, normalized: false }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}(?:[:/?#]|$)/i.test(raw)) return { text: raw, normalized: false }
  return { text: `${rule.normalizeSchemelessTo}//${raw}`, normalized: true }
}

function parsePayloadUrl(text) {
  let url
  try {
    url = new URL(text)
  } catch {
    return { error: 'not_a_url' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'unsupported_scheme' }
  if (url.username || url.password) return { error: 'credentials_in_url' }
  if (!url.hostname) return { error: 'malformed_host' }
  if (!hasWellFormedEncoding(url)) return { error: 'malformed_encoding' }
  return { url }
}

function matchRule(url, rule) {
  const expectedProtocol = rule.protocol || 'https:'
  if (url.protocol !== expectedProtocol) return 'protocol_mismatch'
  // Plain HTTP is only ever reachable through an explicit, recorded risk
  // acceptance for a specific legacy endpoint.
  if (expectedProtocol === 'http:' && !rule.insecureAccepted) return 'insecure_not_accepted'
  if (!hostnameMatches(url.hostname, rule)) return 'host_not_allowlisted'
  if (url.port !== (rule.port || '')) return 'unexpected_port'
  if (rule.pathnamePattern && !new RegExp(rule.pathnamePattern).test(url.pathname)) return 'path_mismatch'

  const allowedParams = rule.allowedSearchParams || []
  for (const key of url.searchParams.keys()) {
    if (!allowedParams.includes(key)) return 'unexpected_query_parameter'
  }

  // Allowed is not the same as present. Rejecting only unexpected keys would
  // accept a bare https://apostil.org.br/v -- the right host and path, but no
  // apostille reference at all -- and then present it as the official lookup
  // "for this Apostille". A payload that identifies no document must not be
  // routed as though it identifies this one.
  for (const key of rule.requiredSearchParams || []) {
    const value = url.searchParams.get(key)
    if (value === null || value.trim() === '') return 'missing_required_query_parameter'
  }

  // Static routing parameters must hold their documented VALUE, not merely
  // appear. Brazil's legacy endpoint takes ?acao=documento_conferir; any other
  // action is a different function of the same government system, so accepting
  // an arbitrary value would let us label it "the official lookup for this
  // Apostille" when it is nothing of the sort.
  //
  // Constrained rather than canonicalised on purpose: rewriting a tampered value
  // back to the expected one would mean opening a URL the QR did not contain,
  // which is exactly the substitution this module refuses to make elsewhere.
  for (const [key, expected] of Object.entries(rule.staticSearchParams || {})) {
    if (url.searchParams.get(key) !== expected) return 'static_query_parameter_mismatch'
  }

  // Hash-router portals (China: consular.mfa.gov.cn/VERIFY/#/<token>) carry the
  // record id in the fragment, so it cannot simply be rejected or dropped --
  // and, by the same argument, cannot be allowed to be absent either.
  if (url.hash) {
    if (!rule.allowFragment) return 'unexpected_fragment'
    if (rule.fragmentPattern && !new RegExp(rule.fragmentPattern).test(url.hash)) return 'fragment_mismatch'
  } else if (rule.requireFragment) {
    return 'missing_required_fragment'
  }
  return null
}

/**
 * Check a payload against an embedded_fields authority's declared structure.
 * Returns null when it matches, or a reason code.
 *
 * The field COUNT is derived from `fieldShape` rather than stored separately, so
 * the documented shape and the check can never drift apart.
 */
function embeddedShapeError(raw, record) {
  const delimiter = record.fieldDelimiter
  const shape = record.fieldShape
  if (!delimiter || !shape) return 'embedded_shape_undocumented'

  // An optional tighter pattern for authorities whose fields have a known form.
  if (record.payloadPattern && !new RegExp(record.payloadPattern).test(raw)) {
    return 'embedded_shape_mismatch'
  }

  const expected = shape.split(delimiter).length
  const parts = raw.split(delimiter)
  if (parts.length !== expected) return 'embedded_field_count_mismatch'
  if (parts.some((part) => part.trim() === '')) return 'embedded_field_empty'
  return null
}

/**
 * Rebuild from the authority's stored base where a token mapping is documented,
 * so navigation targets a URL we constructed. Requires two specimens: one
 * specimen cannot distinguish a stable path segment from a coincidence.
 */
function buildDestination(url, rule, record) {
  const canReconstruct = rule.tokenPattern && rule.canonicalUrlTemplate && record.specimenCount >= 2
  if (!canReconstruct) {
    return { href: url.toString(), token: null, canonical: false }
  }
  const subject = rule.tokenSource === 'hash' ? url.hash : url.pathname + url.search
  const match = new RegExp(rule.tokenPattern).exec(subject)
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
 * `country` enables the tier-2 government-domain fallback; omit it to disable
 * tier 2 entirely.
 */
export function classifyQrPayload(rawText, authorityId, country = null) {
  const raw = typeof rawText === 'string' ? rawText.trim() : ''
  if (!raw) return { kind: OUTCOME.UNSUPPORTED, trust: TRUST.NONE, reason: 'empty_payload', raw, authorityId }
  if (raw.length > MAX_PAYLOAD_LENGTH) {
    return { kind: OUTCOME.UNSUPPORTED, trust: TRUST.NONE, reason: 'payload_too_large', raw: raw.slice(0, 256), authorityId }
  }

  const enabled = enabledQrRecordsFor(authorityId)
  const known = qrRecordsFor(authorityId)
  const confirmed = known.some((entry) => entry.presence === 'confirmed')

  // Tier 2 is keyed on the ABSENCE OF VERIFIED HOSTS, not on enablement state.
  // An authority can be enabled for a non-URL function, or enabled in a dev
  // configuration, while still having no host we have ever seen -- and in every
  // one of those cases the heuristic is the correct fallback rather than tier 1
  // blocking against an empty allowlist.
  const hasVerifiedHosts = enabled.some((entry) => (entry.allowedUrls || []).length > 0)
  const nonUrlFunction = enabled.some((entry) => entry.function === 'offline_app' || entry.function === 'embedded_fields')

  if (!hasVerifiedHosts && !nonUrlFunction) {
    const tier2 = confirmed && country ? governmentTier(raw, country, authorityId) : null
    if (tier2) return tier2
    return {
      kind: OUTCOME.NOT_ENABLED,
      trust: TRUST.NONE,
      reason: known.length > 0 ? 'authority_not_enabled' : 'authority_unknown',
      presence: known[0]?.presence ?? null,
      raw,
      authorityId
    }
  }

  const offlineApp = enabled.find((entry) => entry.function === 'offline_app')
  if (offlineApp) {
    return { kind: OUTCOME.OFFLINE_APP, trust: TRUST.NONE, reason: 'offline_app', app: offlineApp.app || null, raw, authorityId }
  }

  // Costa Rica's QR is delimited plain text carrying the apostille's own fields
  // -- including personal names. There is no destination, and the values must
  // not be rendered wholesale.
  //
  // "Not a URL" is not the same as "is this authority's field data". Accepting
  // any non-URL payload here would tell someone who scanned an unrelated QR that
  // the code stores their apostille's details, and would route it away from the
  // unsupported path that offers a report. The declared shape must actually match.
  const embedded = enabled.find((entry) => entry.function === 'embedded_fields')
  if (embedded && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    const shapeError = embeddedShapeError(raw, embedded)
    if (shapeError) {
      return { kind: OUTCOME.UNSUPPORTED, trust: TRUST.NONE, reason: shapeError, raw, authorityId }
    }
    return {
      kind: OUTCOME.EMBEDDED_FIELDS,
      trust: TRUST.NONE,
      reason: 'embedded_fields',
      fieldShape: embedded.fieldShape || null,
      containsPersonalData: embedded.containsPersonalData !== false,
      raw,
      authorityId
    }
  }

  const { text, normalized } = applySchemeNormalization(raw, enabled)
  const parsed = parsePayloadUrl(text)
  if (parsed.error) return { kind: OUTCOME.UNSUPPORTED, trust: TRUST.NONE, reason: parsed.error, raw, authorityId }
  const { url } = parsed
  const host = normalizeHostname(url.hostname)

  // --- Tier 1: specimen-verified allowlist ---------------------------------
  //
  // Reason selection matters for multi-rule authorities. Brazil has two rules
  // (current and legacy), so a payload that matches the first host but omits its
  // reference would, under last-wins, report `host_not_allowlisted` from the
  // second rule -- burying the real cause. A failure from a rule whose host
  // matched is always the more informative one.
  let bestReason = 'host_not_allowlisted'
  let bestFromMatchedHost = false
  for (const entry of enabled) {
    for (const rule of entry.allowedUrls || []) {
      const failure = matchRule(url, rule)
      if (failure) {
        const hostMatched = hostnameMatches(url.hostname, rule)
        if (hostMatched || !bestFromMatchedHost) {
          bestReason = failure
          bestFromMatchedHost = bestFromMatchedHost || hostMatched
        }
        continue
      }
      const destination = buildDestination(url, rule, entry)
      if (!destination) {
        bestReason = 'token_not_extractable'
        bestFromMatchedHost = true
        continue
      }
      if (entry.function === 'unknown') {
        return { kind: OUTCOME.UNSUPPORTED, trust: TRUST.NONE, reason: 'undocumented_function', host, raw, authorityId }
      }
      return {
        kind: OUTCOME.OFFICIAL,
        trust: TRUST.VERIFIED,
        function: entry.function,
        url: destination.href,
        host,
        token: destination.token,
        canonical: destination.canonical,
        schemeNormalized: normalized,
        specimenCount: entry.specimenCount,
        raw,
        authorityId
      }
    }
  }

  // Once an authority has a specimen-verified host, a non-matching payload is a
  // mismatch -- never a tier-2 candidate. Falling back here would let a bad
  // payload launder itself through the weaker heuristic.
  return { kind: OUTCOME.BLOCKED, trust: TRUST.NONE, reason: bestReason, host, raw, authorityId }
}

/**
 * Tier 2. Narrows an unbounded internet to the party's government namespace.
 * That is worth something; it is not evidence, and the caller must not label the
 * result as verification. See ./data/government-domains.js.
 */
function governmentTier(raw, country, authorityId) {
  const parsed = parsePayloadUrl(raw)
  if (parsed.error) return null
  const { url } = parsed
  const host = normalizeHostname(url.hostname)
  const suffix = matchesGovernmentSuffix(host, country)
  if (!suffix) return { kind: OUTCOME.BLOCKED, trust: TRUST.NONE, reason: 'not_a_government_host', host, raw, authorityId }
  if (looksNonProduction(host)) {
    return { kind: OUTCOME.BLOCKED, trust: TRUST.NONE, reason: 'non_production_host', host, raw, authorityId }
  }
  if (url.protocol !== 'https:') {
    return { kind: OUTCOME.BLOCKED, trust: TRUST.NONE, reason: 'government_host_insecure', host, raw, authorityId }
  }
  if (url.port) {
    return { kind: OUTCOME.BLOCKED, trust: TRUST.NONE, reason: 'unexpected_port', host, raw, authorityId }
  }
  return {
    kind: OUTCOME.UNVERIFIED_GOVERNMENT,
    trust: TRUST.GOVERNMENT,
    url: url.toString(),
    host,
    matchedSuffix: suffix,
    raw,
    authorityId
  }
}

/** Outcomes worth inviting the user to report, so coverage can improve. */
export function isReportable(result) {
  return [OUTCOME.BLOCKED, OUTCOME.UNSUPPORTED, OUTCOME.NOT_ENABLED, OUTCOME.UNVERIFIED_GOVERNMENT].includes(result.kind)
}
