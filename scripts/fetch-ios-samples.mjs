import { mkdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const manifestPath = 'ios/ApositifySampleTests/official-samples.json'
const cachePath = 'specimens/official-test-cache'
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

await mkdir(cachePath, { recursive: true })

for (const sample of manifest.samples) {
  const imagePrefix = path.join(cachePath, sample.id)
  const outputPath = `${imagePrefix}.png`

  if (sample.imageUrl) {
    const sourcePath = path.join(cachePath, `${sample.id}.source-image`)
    const download = spawnSync('curl', [
      '-L', '--fail', '--silent', '--show-error', '--retry', '2',
      sample.imageUrl, '-o', sourcePath
    ], { stdio: 'inherit' })

    if (download.status !== 0) {
      console.warn(`SKIP ${sample.id}: download failed`)
      continue
    }

    const convert = spawnSync('sips', [
      '-s', 'format', 'png', sourcePath, '--out', outputPath
    ], { stdio: 'inherit' })
    if (convert.status !== 0) {
      console.warn(`SKIP ${sample.id}: image could not be converted`)
      continue
    }
    console.log(`CACHED ${sample.id} from ${sample.sourcePageUrl}`)
    continue
  }

  const pdfPath = path.join(cachePath, `${sample.id}.pdf`)
  const download = spawnSync('curl', [
    '-L', '--fail', '--silent', '--show-error', '--retry', '2',
    sample.pdfUrl, '-o', pdfPath
  ], { stdio: 'inherit' })

  if (download.status !== 0) {
    console.warn(`SKIP ${sample.id}: download failed`)
    continue
  }

  const render = spawnSync('pdftoppm', [
    '-f', String(sample.page),
    '-l', String(sample.page),
    '-singlefile',
    '-png',
    '-r', '180',
    pdfPath,
    imagePrefix
  ], { stdio: 'inherit' })

  if (render.status !== 0) {
    console.warn(`SKIP ${sample.id}: PDF page could not be rendered`)
    continue
  }
  console.log(`CACHED ${sample.id} from ${sample.sourcePageUrl}`)
}
