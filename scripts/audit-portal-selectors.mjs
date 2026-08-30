// Runs the shipping autofill script against the real markup of each authority's
// verification portal, and reports which declared fields would find a control.
// Read-only: fetches the page, fills a detached DOM, never submits anything.
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const source = readFileSync('android/app/src/main/java/com/apositify/app/SecureVerifierScreen.kt', 'utf8')
const body = source.split('return """')[1].split('""".trimIndent()')[0]
const script = (fields) => body.replace('$json', JSON.stringify(fields))

const catalog = JSON.parse(readFileSync('ios/Apositify/Resources/e-registers.json', 'utf8'))
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const targets = catalog.entries.filter((entry) =>
  entry.verification?.kind === 'fields' &&
  entry.registerUrl?.startsWith('https') &&
  (only.length === 0 || only.some((needle) => entry.id.includes(needle)))
)

const placeholder = (field) =>
  field.standardItem === 6 ? '19/06/2026' : 'PROBE-0000-0000'

async function probe(entry) {
  const documentFields = entry.verification.fields.filter((f) => f.captureSource === 'document')
  const fields = documentFields.map((f) => ({
    id: f.id,
    value: placeholder(f),
    dateValue: f.standardItem === 6 ? '2026-06-19' : null,
    aliases: f.aliases,
    selectors: f.browserSelectors || []
  }))
  if (fields.length === 0) return { status: 'no-document-fields' }

  let html
  try {
    const response = await fetch(entry.registerUrl, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ApositifySelectorAudit/1.0)' },
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) return { status: `http-${response.status}` }
    html = await response.text()
  } catch (error) {
    return { status: `unreachable: ${error.message.slice(0, 40)}` }
  }

  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  const controls = dom.window.document.querySelectorAll(
    'input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea'
  )
  if (controls.length === 0) return { status: 'no-form-in-static-html', fields: fields.length }

  try {
    dom.window.eval(script(fields))
  } catch (error) {
    return { status: `script-error: ${error.message.slice(0, 40)}` }
  }

  const filled = fields.filter((field) => {
    const match = [...dom.window.document.querySelectorAll('input, select, textarea')]
      .find((el) => el.value === field.value || el.value === field.dateValue)
    return Boolean(match)
  })
  return {
    status: filled.length === fields.length ? 'all-filled' : filled.length ? 'partial' : 'none-matched',
    fields: fields.length,
    filled: filled.length,
    controls: controls.length,
    missed: fields.filter((f) => !filled.includes(f)).map((f) => f.id)
  }
}

const explain = process.argv.includes('--explain')

async function describePortal(entry) {
  const fields = entry.verification.fields.filter((f) => f.captureSource === 'document')
  console.log(`\n=== ${entry.country} — ${entry.registerUrl}`)
  for (const field of fields) {
    console.log(`   want ${field.id}: ${field.aliases.slice(0, 5).join(' | ')}`)
  }
  let html
  try {
    const response = await fetch(entry.registerUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ApositifySelectorAudit/1.0)' },
      signal: AbortSignal.timeout(20000)
    })
    html = await response.text()
  } catch (error) {
    console.log(`   unreachable: ${error.message.slice(0, 50)}`)
    return
  }
  const dom = new JSDOM(html)
  const norm = (value) =>
    (value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const controls = [...dom.window.document.querySelectorAll(
    'input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea'
  )]
  if (controls.length === 0) console.log('   (no controls in static HTML)')
  for (const el of controls) {
    const labels = el.labels ? [...el.labels].map((l) => l.textContent) : []
    const signal = norm([el.name, el.id, el.placeholder, el.getAttribute('aria-label'), ...labels].filter(Boolean).join(' '))
    console.log(`   have <${el.tagName.toLowerCase()} type=${el.type}> "${signal.slice(0, 90)}"`)
  }
}

if (explain) {
  for (const entry of targets) await describePortal(entry)
  process.exit(0)
}

const summary = {}
for (const entry of targets) {
  const result = await probe(entry)
  summary[result.status] = (summary[result.status] || 0) + 1
  const missed = result.missed?.length ? `  missed: ${result.missed.join(', ')}` : ''
  const detail = result.fields
    ? `${result.filled ?? 0}/${result.fields} fields, ${result.controls ?? 0} controls${missed}`
    : ''
  console.log(`${result.status.padEnd(26)} ${entry.country.slice(0, 20).padEnd(20)} ${detail}`)
}
console.log('\n--- ' + Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join(', '))
