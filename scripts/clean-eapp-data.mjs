import { readFile, writeFile } from 'node:fs/promises'

const sourceUrl = 'https://assets.hcch.net/docs/e8e7549d-e34a-452f-9fa3-cf2241aa4197.pdf'
const sourcePath = new URL('../src/data/eAPP_implementation_chart_full.json', import.meta.url)
const outputPath = new URL('../src/data/e-registers.cleaned.json', import.meta.url)

const normalizeWhitespace = (value = '') => value == null ? '' : String(value).replace(/\s+/g, ' ').trim()
const slugify = (value) => normalizeWhitespace(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const isHttpUrl = (value) => /^https?:\/\//i.test(normalizeWhitespace(value))

const unwrapSafelink = (url) => {
  if (!isHttpUrl(url)) return ''

  try {
    const parsed = new URL(url)
    const wrapped = parsed.searchParams.get('url')
    return wrapped && isHttpUrl(wrapped) ? wrapped : url
  } catch {
    return url
  }
}

const getRegisterMode = ({ method, label }) => {
  const normalizedMethod = normalizeWhitespace(method).toLowerCase()
  const normalizedLabel = normalizeWhitespace(label).toLowerCase()
  const combined = `${normalizedLabel} ${normalizedMethod}`.trim()

  if (isHttpUrl(method) && combined.includes('qr')) return 'hybrid'
  if (isHttpUrl(method)) return 'online'
  if (combined.includes('available') && combined.includes('qr')) return 'hybrid_link_missing'
  if (combined.includes('available')) return 'source_link_missing'
  if (combined.includes('qr')) return 'qr_only'

  return 'manual_contact'
}

const modeLabels = {
  online: 'Official e-Register link available',
  hybrid: 'Official e-Register link available; QR-code verification is also listed',
  source_link_missing: 'Listed as available in HCCH chart; embedded URL not included in source JSON',
  hybrid_link_missing: 'Listed as available online and via QR code in HCCH chart; embedded URL not included in source JSON',
  qr_only: 'QR-code verification only',
  manual_contact: 'Contact authority to verify'
}

// The HCCH chart has one generic Brazil URL, while CNJ maintains separate official
// validation systems. Keep independently verified destinations stable across refreshes.
const curatedEntryOverrides = {
  'brazil-national-council-of-justice': {
    registerUrl: 'https://apostil.cnj.jus.br/pt/validation',
    eRegisterMethod: 'https://apostil.cnj.jus.br/pt/validation',
    registerLinks: [
      { label: 'Validate in APOSTIL', url: 'https://apostil.cnj.jus.br/pt/validation' },
      { label: 'Validate in legacy SEI Apostila', url: 'https://apostila.cnj.jus.br/seiapostila/controlador_externo.php?acao=documento_conferir&acao_origem=documento_conferir&lang=pt_BR&id_orgao_acesso_externo=0' }
    ],
    registerGuide: {
      title: 'Which link should I use?',
      steps: [
        'Choose APOSTIL if the Apostille identifies the APOSTIL system.',
        'Choose legacy SEI Apostila if the Apostille identifies the SEI Apostila system.',
        'If neither system is named, use the verification URL printed on the Apostille.'
      ]
    },
    notes: 'Choose the official system named on the Apostille: APOSTIL or legacy SEI Apostila.'
  }
}

const raw = JSON.parse(await readFile(sourcePath, 'utf8'))
const entries = raw.records.flatMap((record) => {
  const country = normalizeWhitespace(record.contracting_party)

  return record.competent_authorities.map((authority, authorityIndex) => {
    const authorityName = normalizeWhitespace(authority.name || country)
    const register = authority.e_register || {}
    const method = normalizeWhitespace(register.method)
    const label = normalizeWhitespace(register.label)
    const verificationMode = getRegisterMode(register)
    const eApostille = authority.e_apostille || null
    const notes = normalizeWhitespace(authority.notes || register.url_missing_note)
    const registerUrl = isHttpUrl(method) ? unwrapSafelink(method) : ''

    const entry = {
      id: `${slugify(country)}-${slugify(authorityName) || authorityIndex + 1}`,
      sourceRecordId: record.id,
      country,
      authority: authorityName,
      registerUrl,
      verificationMode,
      verificationLabel: modeLabels[verificationMode],
      eRegisterNumber: register.number ?? null,
      eRegisterMethod: method || null,
      eRegisterLabel: label || null,
      eApostilleNumber: eApostille?.number ?? null,
      eApostilleDate: eApostille?.date ? normalizeWhitespace(eApostille.date) : null,
      notes: notes || modeLabels[verificationMode]
    }

    return { ...entry, ...curatedEntryOverrides[entry.id] }
  })
})

const modeCounts = entries.reduce((counts, entry) => {
  counts[entry.verificationMode] = (counts[entry.verificationMode] || 0) + 1
  return counts
}, {})

const cleaned = {
  schemaVersion: 2,
  sourceTitle: normalizeWhitespace(raw.title),
  sourceFile: raw.source_file,
  sourceUrl,
  generatedFrom: 'src/data/eAPP_implementation_chart_full.json',
  recordsCount: raw.records.length,
  entriesCount: entries.length,
  modeCounts,
  notes: 'Rows with online or hybrid mode include a usable registerUrl. Rows marked source_link_missing or hybrid_link_missing need the official embedded HCCH Available Here URL before one-click redirects can be enabled.',
  entries
}

await writeFile(outputPath, `${JSON.stringify(cleaned, null, 2)}\n`)
console.log(`Cleaned ${entries.length} entries across ${raw.records.length} records into src/data/e-registers.cleaned.json`)
console.log(`Mode counts: ${JSON.stringify(modeCounts)}`)
