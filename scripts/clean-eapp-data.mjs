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

const normalizeMethod = (method) => {
  const normalized = normalizeWhitespace(method).toLowerCase()

  if (!normalized) return 'manual_contact'
  if (normalized.includes('available') && normalized.includes('qr')) return 'hybrid_link_missing'
  if (normalized.includes('available')) return 'source_link_missing'
  if (normalized.includes('qr')) return 'qr_only'

  return 'manual_contact'
}

const modeLabels = {
  source_link_missing: 'Listed as available in HCCH chart; embedded URL not included in source JSON',
  hybrid_link_missing: 'Listed as available online and via QR code in HCCH chart; embedded URL not included in source JSON',
  qr_only: 'QR-code verification only',
  manual_contact: 'Contact authority to verify'
}

const raw = JSON.parse(await readFile(sourcePath, 'utf8'))
const entries = raw.records.flatMap((record) => {
  const country = normalizeWhitespace(record.contracting_party)

  return record.competent_authorities.map((authority, authorityIndex) => {
    const authorityName = normalizeWhitespace(authority.name || country)
    const register = authority.e_register || {}
    const method = normalizeWhitespace(register.method)
    const verificationMode = normalizeMethod(method)
    const eApostille = authority.e_apostille || null
    const notes = normalizeWhitespace(authority.notes)

    return {
      id: `${slugify(country)}-${slugify(authorityName) || authorityIndex + 1}`,
      sourceRecordId: record.id,
      country,
      authority: authorityName,
      registerUrl: '',
      verificationMode,
      verificationLabel: modeLabels[verificationMode],
      eRegisterNumber: register.number ?? null,
      eRegisterMethod: method || null,
      eApostilleNumber: eApostille?.number ?? null,
      eApostilleDate: eApostille?.date ? normalizeWhitespace(eApostille.date) : null,
      notes: notes || modeLabels[verificationMode]
    }
  })
})

const cleaned = {
  schemaVersion: 1,
  sourceTitle: normalizeWhitespace(raw.title),
  sourceFile: raw.source_file,
  sourceUrl,
  generatedFrom: 'src/data/eAPP_implementation_chart_full.json',
  recordsCount: raw.records.length,
  entriesCount: entries.length,
  notes: 'Rows marked source_link_missing or hybrid_link_missing need the official embedded HCCH Available Here URL before one-click production redirects are enabled.',
  entries
}

await writeFile(outputPath, `${JSON.stringify(cleaned, null, 2)}\n`)
console.log(`Cleaned ${entries.length} entries across ${raw.records.length} records into src/data/e-registers.cleaned.json`)
