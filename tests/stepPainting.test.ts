import assert from 'node:assert/strict'
import test from 'node:test'
import { createPadBank } from '../src/pads/padBank.ts'
import { createInitialPatternGroups, mergeAdjacentVariantSteps, setVariantStepPresence, setVariantStepVelocity, updateVariantStep } from '../src/patterns/patternOperations.ts'
import { getStepEventRange } from '../src/patterns/stepEvents.ts'

const padId = createPadBank()[0].id
const groupId = 'pattern-group-1'

test('step painting adds independent events and repeated passes keep their state', () => {
  let groups = createInitialPatternGroups([padId])
  groups = setVariantStepPresence(groups, groupId, 'A', padId, 2, true)
  groups = setVariantStepVelocity(groups, groupId, 'A', padId, 2, 0.42)
  groups = setVariantStepPresence(groups, groupId, 'A', padId, 2, true)
  groups = setVariantStepPresence(groups, groupId, 'A', padId, 3, true)

  assert.deepEqual(groups[0].variants.A![padId].slice(2, 4), [0.42, 1])
  assert.deepEqual(groups[0].lengths.A![padId].slice(2, 4), [1, 1])
})

test('erase painting is idempotent and safely clears a legacy merged event', () => {
  let groups = createInitialPatternGroups([padId])
  for (const stepIndex of [5, 6, 7]) groups = updateVariantStep(groups, groupId, 'A', padId, stepIndex)
  groups = mergeAdjacentVariantSteps(groups, groupId, 'A', padId, 6)
  groups = setVariantStepPresence(groups, groupId, 'A', padId, 7, false)
  groups = setVariantStepPresence(groups, groupId, 'A', padId, 7, false)

  assert.deepEqual(groups[0].variants.A![padId].slice(5, 8), [0, 0, 0])
  assert.equal(getStepEventRange(groups[0].variants.A![padId], groups[0].lengths.A![padId], 6), null)
})
