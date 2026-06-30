import cleanedData from './e-registers.cleaned.json' with { type: 'json' }

export const sourceUrl = cleanedData.sourceUrl
export const eRegisters = cleanedData.entries
export const dataSummary = {
  schemaVersion: cleanedData.schemaVersion,
  sourceTitle: cleanedData.sourceTitle,
  sourceFile: cleanedData.sourceFile,
  recordsCount: cleanedData.recordsCount,
  entriesCount: cleanedData.entriesCount,
  notes: cleanedData.notes
}
