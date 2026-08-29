import { mkdir, readFile, writeFile } from 'node:fs/promises'

const source = new URL('../ios/Apositify/Resources/e-registers.json', import.meta.url)
const output = new URL('../android/app/src/main/assets/e-registers.json', import.meta.url)
const expected = await readFile(source, 'utf8')
const parsed = JSON.parse(expected)

if (parsed.schemaVersion !== 1 || parsed.entries?.length !== 97) {
  throw new Error(`Expected schema 1 with 97 authority entries, found schema ${parsed.schemaVersion} with ${parsed.entries?.length ?? 0} entries.`)
}

if (process.argv.includes('--check')) {
  const bundled = await readFile(output, 'utf8')
  if (bundled !== expected) {
    throw new Error('The bundled Android register catalog is stale. Run npm run build:android-data and commit the result.')
  }
  console.log(`Verified bundled Android catalog matches ${parsed.entries.length} shared register entries.`)
} else {
  await mkdir(new URL('../android/app/src/main/assets/', import.meta.url), { recursive: true })
  await writeFile(output, expected)
  console.log(`Wrote ${parsed.entries.length} Android register entries to ${output.pathname}`)
}
