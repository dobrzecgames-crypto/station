import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const sourceRoot = join(import.meta.dirname, '..', 'src')

test('SEQ row labels hand vertical touch drags to native workspace scrolling', () => {
  const css = readFileSync(join(sourceRoot, 'index.css'), 'utf8')
  const ownedGestureSelector = css.match(/\.station-shell\s+:where\(([^)]*)\)\s*\{\s*touch-action:\s*none;/)?.[1] ?? ''
  const rowLabelRule = css.match(/\.station-shell\s+\.pattern-pad-label\s*\{([^}]*)\}/)?.[1] ?? ''

  assert.doesNotMatch(ownedGestureSelector, /\.pattern-pad-label/)
  assert.match(rowLabelRule, /touch-action:\s*pan-y/)
})

test('SEQ row label audition releases when native scrolling cancels its pointer', () => {
  const source = readFileSync(join(sourceRoot, 'sequencer', 'SequencerControls.tsx'), 'utf8')
  const rowLabel = source.match(/<button\s+className=\{pad\.id === selectedPadId[\s\S]*?>\{padNumber\}<\/button>/)?.[0] ?? ''

  assert.match(rowLabel, /onPointerDown=/)
  assert.match(rowLabel, /onPointerCancel=\{\(\) => onReleasePad\(pad\.id\)\}/)
  assert.match(rowLabel, /onLostPointerCapture=\{\(\) => onReleasePad\(pad\.id\)\}/)
})
