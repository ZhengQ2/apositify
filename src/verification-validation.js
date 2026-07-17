function isCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function fieldKey(field, index) {
  return typeof field === 'string' ? field : field.name || String(index)
}

export function fieldLabel(field) {
  return typeof field === 'string' ? field : field.label
}

export function validateVerificationField(field, rawValue) {
  const value = rawValue.trim()
  if (!value) return 'Enter this value.'

  if (field.format === 'date-iso') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match || !isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) return 'Use YYYY-MM-DD.'
  }

  if (field.format === 'date-dotted') {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value)
    if (!match || !isCalendarDate(Number(match[3]), Number(match[2]), Number(match[1]))) return 'Use DD.MM.YYYY.'
  }

  if (field.format === 'non-arij-apostille-code' && /^arij/i.test(value)) {
    return 'ARIJ-prefixed codes use Moldova’s separate MPass verification service.'
  }

  return ''
}
