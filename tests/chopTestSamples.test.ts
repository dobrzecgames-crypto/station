import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('every built-in Chop test button references a bundled WAV file', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'chop', 'chopTestSamples.ts'), 'utf8')
  const assetPaths = [...source.matchAll(/libraryAssetUrl\('([^']+\.wav)'\)/g)].map((match) => match[1])

  assert.equal(assetPaths.length, 4)
  for (const assetPath of assetPaths) {
    assert.equal(existsSync(join(process.cwd(), 'public', 'library', assetPath)), true, `${assetPath} must be bundled`)
  }
})
