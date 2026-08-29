import { readFile, writeFile } from 'node:fs/promises'
import { eRegisters, sourceUrl } from '../src/data/e-registers.js'
import { verificationFields } from '../src/data/verification-fields.js'
import { enabledQrRecordsFor } from '../src/data/qr-codes.js'

const normalize = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function inferredStandardItem(label) {
  const value = normalize(label)
  const isDate = /(date|fecha|emission|issue|dated)/.test(value)
  if (isDate && !/(signature|underlying|source document)/.test(value)) return 6
  const specialCode = /(security|verification|access|keycode|sticker|application|barcode|reference|crc|control|clave|codigo|code)/.test(value)
  // Authorities label item 8 in their own language. Matching only the English
  // word left Spanish, French, Portuguese and German fields with no item at
  // all, so the number printed on the certificate could never reach them.
  // "Notarial Certificate No." numbers the underlying document, not the
  // Apostille, so its item 8 belongs to a different piece of paper.
  if (/(notarial|notary|underlying|source document)/.test(value)) return null
  const numberWord = /(number|numero|numéro|numer|nummer|\bno\b|\bnum\b)/
  if (!specialCode && (/(apostille number|apostille no|certificate number|document number|\bid\b)/.test(value) || numberWord.test(value))) return 8
  return null
}

function genericAliases(label, standardItem) {
  const value = normalize(label)
  if (standardItem === 6) return [
    'Date', 'Date of issue', 'Issue date', 'Issuance date', 'Dated', 'Fecha',
    'Fecha de emisión', "Date d'émission", 'Ausstellungsdatum', 'Data di emissione',
    'Data de emissão', 'Дата выдачи', '签发日期', '発行日'
  ]
  if (standardItem === 8) return [
    'Apostille number', 'Apostille No.', 'Certificate number', 'Número de Apostilla',
    "Numéro de l'apostille", 'Apostillenummer', 'Numero di apostille',
    'Número da apostila', 'Номер апостиля', '附加证明书编号', 'アポスティーユ番号'
  ]
  if (value.includes('sticker')) return ['Sticker number', 'Sticker No.', 'Sticker code', '贴纸编号', '贴纸号码', '스티커 번호']
  if (value.includes('security') || value.includes('seguridad')) return ['Security code', 'Código de seguridad', 'Code de sécurité', 'Sicherheitscode', '安全码']
  if (value.includes('verification') || value.includes('verificacion')) return ['Verification code', 'Código de verificación', 'Code de vérification', '验证码']
  if (value.includes('access code')) return ['Access code', 'Code d’accès', 'Código de acceso', '访问码']
  if (value.includes('reference')) return ['Reference number', 'Reference code', 'Reference No.', 'Numéro de référence', 'Código de referencia']
  if (value.includes('application')) return ['Application number', 'Application No.', 'Request number', 'Número de solicitud']
  if (value.includes('barcode')) return ['Barcode number', 'Número del código de barras']
  if (value.includes('keycode')) return ['Keycode', 'Key code', 'Security key']
  // Costa Rica prints its apostille code as "Código: NCDXATKNWGC". A label that
  // says only "code" still needs the word the certificate actually prints. The
  // bare English "Code" is deliberately not an alias: bilingual certificates
  // print it as a sub-label — "(Code – Code:)" — with no value after it.
  if (value.includes('code') || value.includes('codigo')) return ['Código', 'Codigo']
  return []
}

function normalizeField(field, index) {
  const value = typeof field === 'string' ? { label: field } : field
  const label = value.label
  const portalOnly = /captcha|code shown on page|from an image/i.test(label)
  const standardItem = value.ocr?.standardItem ?? inferredStandardItem(label)
  const aliases = [...new Set([label, ...genericAliases(label, standardItem), ...(value.ocr?.aliases || []), ...(value.browser?.aliases || [])])]
  return {
    id: value.name || `field-${index}`,
    label,
    placeholder: value.placeholder || 'Exactly as printed',
    aliases,
    browserSelectors: value.browser?.selectors || [],
    captureSource: portalOnly ? 'portal' : 'document',
    ...(standardItem ? { standardItem } : {}),
    ...(value.ocr?.pattern ? { pattern: value.ocr.pattern } : {}),
    ...(value.format ? { format: value.format } : {})
  }
}

function normalizeQrRoute(record) {
  return {
    function: record.function,
    specimenCount: record.specimenCount,
    ...(record.normalizeSchemelessTo ? { normalizeSchemelessTo: record.normalizeSchemelessTo } : {}),
    allowedUrls: (record.allowedUrls || []).map((rule) => ({
      protocol: rule.protocol || 'https:',
      hostname: rule.hostname,
      port: rule.port || '',
      allowedSearchParams: rule.allowedSearchParams || [],
      requiredSearchParams: rule.requiredSearchParams || [],
      staticSearchParams: rule.staticSearchParams || {},
      allowSubdomains: Boolean(rule.allowSubdomains),
      allowFragment: Boolean(rule.allowFragment),
      requireFragment: Boolean(rule.requireFragment),
      insecureAccepted: Boolean(rule.insecureAccepted),
      ...(rule.pathnamePattern ? { pathnamePattern: rule.pathnamePattern } : {}),
      ...(rule.fragmentPattern ? { fragmentPattern: rule.fragmentPattern } : {}),
      ...(rule.tokenPattern ? { tokenPattern: rule.tokenPattern } : {}),
      ...(rule.tokenGroup !== undefined ? { tokenGroup: rule.tokenGroup } : {}),
      ...(rule.tokenSource ? { tokenSource: rule.tokenSource } : {}),
      ...(rule.canonicalUrlTemplate ? { canonicalUrlTemplate: rule.canonicalUrlTemplate } : {})
    }))
  }
}

const entries = eRegisters.map((entry) => {
  const config = verificationFields[entry.id]
  const qrRoutes = enabledQrRecordsFor(entry.id).map(normalizeQrRoute)
  return {
    id: entry.id,
    country: entry.country,
    authority: entry.authority,
    ...(entry.registerUrl ? { registerUrl: entry.registerUrl } : {}),
    verificationMode: entry.verificationMode,
    notes: entry.notes,
    registerLinks: entry.registerLinks || [],
    qrRoutes,
    ...(entry.registerGuide ? { registerGuide: entry.registerGuide } : {}),
    ...(config ? {
      verification: {
        kind: config.kind,
        fields: (config.fields || []).map(normalizeField),
        ...(config.note ? { note: config.note } : {}),
        ...(config.deepLink ? {
          deepLink: {
            method: config.deepLink.method || 'get',
            url: config.deepLink.baseUrl || config.deepLink.actionUrl,
            extraParams: config.deepLink.extraParams || {},
            paramOrder: config.deepLink.paramOrder
          }
        } : {})
      }
    } : {})
  }
})

const payload = {
  schemaVersion: 1,
  sourceUrl,
  entries
}

if (entries.length !== 97) throw new Error(`Expected 97 authority entries, found ${entries.length}`)
const deepLinks = entries.filter((entry) => entry.verification?.deepLink)
if (deepLinks.length !== 6) throw new Error(`Expected 6 confirmed deep links, found ${deepLinks.length}`)
for (const entry of deepLinks) {
  if (entry.verification.fields.length !== entry.verification.deepLink.paramOrder.length) {
    throw new Error(`${entry.id}: deep-link parameters must map one-to-one to verification fields`)
  }
}

const output = new URL('../ios/Apositify/Resources/e-registers.json', import.meta.url)
const serialized = `${JSON.stringify(payload, null, 2)}\n`
if (process.argv.includes('--check')) {
  const bundled = await readFile(output, 'utf8')
  if (bundled !== serialized) {
    throw new Error('The bundled iOS register catalog is stale. Run npm run build:ios-data and commit the result.')
  }
  console.log(`Verified bundled iOS catalog matches ${entries.length} shared register entries.`)
} else {
  await writeFile(output, serialized)
  console.log(`Wrote ${entries.length} iOS register entries to ${output.pathname}`)
}
