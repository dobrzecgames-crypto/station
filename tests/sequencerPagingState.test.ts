import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('changing BANK or PATTERN resets the SEQ editor to steps 01-08', () => {
  const source = readFileSync(join(import.meta.dirname, '..', 'src', 'sequencer', 'SequencerControls.tsx'), 'utf8')
  const resetEffect = source.match(/useEffect\(\(\) => \{[\s\S]*?stepPageRef\.current = 0[\s\S]*?\}, \[group\.id, selectedVariant\]\)/)?.[0] ?? ''

  assert.match(resetEffect, /paintStroke\.current = null/)
  assert.match(resetEffect, /pendingPageEntryStep\.current = null/)
  assert.match(resetEffect, /setStepPageState\(0\)/)
  assert.match(resetEffect, /setEditedStep\(\(current\) => \(\{ \.\.\.current, stepIndex: 0 \}\)\)/)
})
