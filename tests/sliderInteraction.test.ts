import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const sourceRoot = join(import.meta.dirname, '..', 'src')

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return tsxFiles(path)
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : []
  })
}

test('every Station range input uses the complete shared drag contract', () => {
  const rangeInputs = tsxFiles(sourceRoot).flatMap((path) => {
    const source = readFileSync(path, 'utf8')
    return [...source.matchAll(/<input\b(?=[^>]*\btype="range")[^>]*\/>/gs)].map((match) => ({ path, markup: match[0] }))
  })

  assert.ok(rangeInputs.length > 0)
  for (const input of rangeInputs) {
    assert.match(input.markup, /\{\.\.\.[A-Za-z][A-Za-z0-9]*InputProps\}|\{\.\.\.[A-Za-z][A-Za-z0-9]*\.inputProps\}/, input.path)
    assert.doesNotMatch(input.markup, /\bonPointerDown=/, input.path)
    assert.doesNotMatch(input.markup, /\bonChange=/, input.path)
  }
})

test('shared slider CSS owns touch gestures and prevents selection', () => {
  const css = readFileSync(join(sourceRoot, 'lab-interface.css'), 'utf8')
  const sharedRule = css.match(/input\[type="range"\]\s*\{([^}]*)\}/)?.[1] ?? ''

  assert.match(sharedRule, /touch-action:\s*none/)
  assert.match(sharedRule, /user-select:\s*none/)
  assert.match(sharedRule, /height:\s*30px/)
})
