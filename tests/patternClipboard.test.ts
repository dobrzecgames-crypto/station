import assert from 'node:assert/strict'
import test from 'node:test'
import { createPadBank } from '../src/pads/padBank.ts'
import { addPatternGroup, copyVariantSequence, createInitialPatternGroups, paintVariantStepSpan, pasteVariantSequence, setVariantStepShift, setVariantStepVelocity } from '../src/patterns/patternOperations.ts'

const padIds = createPadBank().map((pad) => pad.id)

test('pattern clipboard copies positions, velocity, SHIFT and event lengths to another instrument bank', () => {
  let groups = addPatternGroup(createInitialPatternGroups(padIds), 'pattern-group-2', padIds)
  groups[1].bank.pads[0] = { ...groups[1].bank.pads[0], volume: 0.42, pitchSemitones: 7 }
  const targetBankBeforePaste = structuredClone(groups[1].bank)

  groups = paintVariantStepSpan(groups, 'pattern-group-1', 'A', padIds[0], 3, 5)
  groups = setVariantStepVelocity(groups, 'pattern-group-1', 'A', padIds[0], 3, 0.64)
  groups = setVariantStepShift(groups, 'pattern-group-1', 'A', padIds[0], 3, -0.18)
  const clipboard = copyVariantSequence(groups, 'pattern-group-1', 'A')
  const pasted = pasteVariantSequence(groups, 'pattern-group-2', 'A', clipboard)

  assert.deepEqual(pasted[1].variants.A, clipboard.pattern)
  assert.deepEqual(pasted[1].shifts.A, clipboard.shifts)
  assert.deepEqual(pasted[1].lengths.A, clipboard.lengths)
  assert.deepEqual(pasted[1].bank, targetBankBeforePaste)
  assert.equal(pasted[1].variants.A?.[padIds[0]][3], 0.64)
  assert.equal(pasted[1].shifts.A?.[padIds[0]][3], -0.18)
  assert.equal(pasted[1].lengths.A?.[padIds[0]][3], 3)
})

test('pattern clipboard is detached from later source and destination edits', () => {
  let groups = createInitialPatternGroups(padIds)
  groups = setVariantStepVelocity(groups, 'pattern-group-1', 'A', padIds[1], 7, 0.75)
  const clipboard = copyVariantSequence(groups, 'pattern-group-1', 'A')

  groups = setVariantStepVelocity(groups, 'pattern-group-1', 'A', padIds[1], 7, 0.25)
  assert.equal(clipboard.pattern[padIds[1]][7], 0.75)

  const pasted = pasteVariantSequence(groups, 'pattern-group-1', 'B', clipboard)
  pasted[0].variants.B![padIds[1]][7] = 0.5
  assert.equal(clipboard.pattern[padIds[1]][7], 0.75)
})
