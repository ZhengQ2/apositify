// Tier 2 fallback — recognised government domain suffixes, per party.
//
// This exists ONLY to give a decoded QR a weaker, clearly-labelled treatment
// when the selected authority has no specimen-verified host. It is a heuristic,
// not evidence, and the UI must never present a tier-2 match as official
// verification. See TRUST in ../qr-routing.js.
//
// Why this is deliberately narrow, from the 17-specimen audit (2026-07-18):
//
//   - It produces FALSE NEGATIVES. Four of fifteen real apostille QRs are not on
//     a government domain at all: Brazil (apostil.org.br), Brazil legacy
//     (www.cnj.jus.br — judiciary .jus.br), Armenia (e-verify.am), and Bulgaria
//     (apostille.nacid.bg). A suffix rule rejects every one of them.
//   - It produces FALSE POSITIVES. Bangladesh's specimen decodes to
//     apostille.training.mygov.bd — a TRAINING environment sitting inside the
//     government namespace. A *.mygov.bd rule would dignify a test system.
//   - Government namespaces are broadly delegated. A suffix match says nothing
//     about whether that subdomain is controlled by the apostille authority,
//     serves user-uploaded content, carries an open redirect, or is a dangling
//     CNAME available for takeover.
//
// So: tier 2 narrows an unbounded internet to a national government namespace.
// That is worth something. It is not worth an "official verification" label.
//
// Suffixes are registrable government namespaces, matched on a dot boundary.
// Add a party only when its government namespace is actually known.
//
// Never add a bare ccTLD ('gr', 'am', 'bg'). A country-code TLD is not a
// government namespace, and adding one silently converts tier 2 from "inside
// this government's domain" into "anywhere in this country".

export const governmentSuffixes = {
  Armenia: ['gov.am'],
  Bahrain: ['gov.bh'],
  Bangladesh: ['gov.bd', 'mygov.bd'],
  Bolivia: ['gob.bo'],
  Brazil: ['gov.br', 'jus.br'],
  Bulgaria: ['government.bg', 'egov.bg'],
  Chile: ['gob.cl'],
  // China's entry covers the Mainland only. Hong Kong's Judiciary sits on
  // judiciary.hk, so a gov.cn-only rule would reject a genuine Hong Kong
  // apostille QR outright -- the same country-level inheritance error the
  // registry avoids elsewhere. Both are listed because the dataset keys tier 2
  // by party, and Hong Kong SAR is an authority within the China party.
  China: ['gov.cn', 'gov.hk', 'judiciary.hk'],
  Colombia: ['gov.co'],
  'Costa Rica': ['go.cr'],
  Ecuador: ['gob.ec'],
  'El Salvador': ['gob.sv'],
  // NOT the bare 'gr' ccTLD: that would make every .gr host a government
  // namespace and hand a continue-link to any Greek domain.
  Greece: ['gov.gr'],
  Guatemala: ['gob.gt'],
  Japan: ['go.jp'],
  Kazakhstan: ['gov.kz'],
  Luxembourg: ['public.lu', 'etat.lu'],
  Mexico: ['gob.mx'],
  Pakistan: ['gov.pk'],
  Panama: ['gob.pa'],
  Philippines: ['gov.ph'],
  'Russian Federation': ['gov.ru'],
  Rwanda: ['gov.rw'],
  'United Kingdom': ['gov.uk'],
  'United States of America': ['gov']
}

/** Dot-boundary suffix match. Never substring, never bare endsWith. */
export function matchesGovernmentSuffix(hostname, country) {
  const suffixes = governmentSuffixes[country]
  if (!suffixes) return null
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '')
  for (const suffix of suffixes) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return suffix
  }
  return null
}

// Hosts that sit inside a government namespace but must never be treated as a
// production verification endpoint, even under tier 2.
const NON_PRODUCTION_MARKERS = ['training.', 'test.', 'uat.', 'staging.', 'dev.', 'demo.', 'sandbox.']

export function looksNonProduction(hostname) {
  const host = String(hostname || '').toLowerCase()
  return NON_PRODUCTION_MARKERS.some((marker) => host.startsWith(marker) || host.includes(`.${marker}`))
}
