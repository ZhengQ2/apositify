// Fallback guidance shown when in-app scanning is unavailable for an authority.
//
// Extracted from main.jsx so it can be unit-tested: main.jsx mounts the app on
// import, which makes importing it from a test both awkward and misleading. Two
// separate review findings have landed in this logic, and both were the kind a
// direct test would have caught.
//
// The governing rule is that this copy must never send a user to check for
// something the evidence does not support:
//
//   - Never require a government domain. Armenia's real destination is
//     e-verify.am, Brazil's is apostil.org.br, Bulgaria's is
//     apostille.nacid.bg. Telling users to expect a government address makes
//     them distrust the genuine target.
//   - Never name a PARTIAL set of hosts. Mexico holds two generations and only
//     the legacy one has a decoded host; naming it would misdirect anyone
//     holding a current apostille.
//
// Both failures share a shape: asserting more specificity than the registry
// actually carries.

import { messages as t } from './i18n/en.js'

/** Functions whose payload is not a URL, so they never contribute a host. */
export const NON_ROUTABLE_FUNCTIONS = new Set(['offline_app', 'embedded_fields'])

/** "a", "a or b", "a, b or c" — Brazil has two generations on two hosts. */
export function formatHostList(hosts) {
  if (hosts.length === 0) return null
  if (hosts.length === 1) return hosts[0]
  return `${hosts.slice(0, -1).join(', ')} or ${hosts[hosts.length - 1]}`
}

/**
 * Hosts to name, or null when the picture is incomplete.
 *
 * Returns null unless EVERY confirmed URL-based record carries a host, because
 * a partial list reads to the user as an exhaustive one.
 */
export function guidanceHosts(records) {
  const urlRecords = records.filter(
    (record) => record.presence === 'confirmed' && !NON_ROUTABLE_FUNCTIONS.has(record.function)
  )
  if (urlRecords.length === 0) return null
  if (!urlRecords.every((record) => (record.allowedUrls || []).length > 0)) return null
  const hosts = [...new Set(
    urlRecords.flatMap((record) => (record.allowedUrls || []).map((rule) => rule.hostname))
  )]
  return formatHostList(hosts)
}

/** Guidance text for an authority whose QR presence is `confirmed`. */
export function confirmedGuidance(records) {
  const confirmed = records.filter((record) => record.presence === 'confirmed')
  const functions = new Set(confirmed.map((record) => record.function))
  const hostList = guidanceHosts(confirmed)

  // Only collapse to a single non-URL message when every confirmed record for
  // this authority agrees; a mixed authority still needs the URL wording.
  if (functions.size === 1) {
    if (functions.has('embedded_fields')) return t.qrInfoConfirmedFields
    if (functions.has('offline_app')) {
      const appName = confirmed.find((record) => record.app?.name)?.app?.name
      return appName
        ? t.qrInfoConfirmedOfflineApp.replace('{app}', appName)
        : t.qrInfoConfirmedOfflineAppGeneric
    }
    if (functions.has('document_url')) {
      return hostList
        ? t.qrInfoConfirmedDocumentKnownHost.replace('{hosts}', hostList)
        : t.qrInfoConfirmedDocument
    }
  }
  return hostList
    ? t.qrInfoConfirmedKnownHost.replace('{hosts}', hostList)
    : t.qrInfoConfirmed
}
