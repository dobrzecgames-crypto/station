import assert from 'node:assert/strict'
import test from 'node:test'
import { createPadBank } from '../src/pads/padBank.ts'
import { createInitialPatternGroups, mergeAdjacentVariantSteps, paintVariantStepSpan, setVariantStepPresence, setVariantStepShift, setVariantStepVelocity, updateVariantStep } from '../src/patterns/patternOperations.ts'
import { getStepEventRange } from '../src/patterns/stepEvents.ts'
import { getStepPageEdgeContinuationTarget, getStepPageEdgeTarget, sequencerEdgePaintInitialDelayMs, sequencerEdgePaintStepIntervalMs } from '../src/sequencer/stepPaging.ts'

const padId = createPadBank()[0].id
const groupId = 'pattern-group-1'

test('one paint stroke creates one event whose tail does not retrigger', () => {
  let groups = createInitialPatternGroups([padId])
  groups = paintVariantStepSpan(groups, groupId, 'A', padId, 2, 2)
  groups = setVariantStepVelocity(groups, groupId, 'A', padId, 2, 0.42)
  groups = setVariantStepShift(groups, groupId, 'A', padId, 2, -0.18)
  groups = paintVariantStepSpan(groups, groupId, 'A', padId, 2, 5)

  assert.deepEqual(groups[0].variants.A![padId].slice(2, 6), [0.42, 0.42, 0.42, 0.42])
  assert.deepEqual(groups[0].shifts.A![padId].slice(2, 6), [-0.18, -0.18, -0.18, -0.18])
  assert.deepEqual(groups[0].lengths.A![padId].slice(2, 6), [4, 1, 1, 1])
  assert.deepEqual(getStepEventRange(groups[0].variants.A![padId], groups[0].lengths.A![padId], 5), { headIndex: 2, endIndex: 5, length: 4, merged: true })
})

test('separate taps on adjacent cells remain separate triggers', () => {
  let groups = createInitialPatternGroups([padId])
  groups = setVariantStepPresence(groups, groupId, 'A', padId, 2, true)
  groups = setVariantStepPresence(groups, groupId, 'A', padId, 3, true)

  assert.deepEqual(groups[0].lengths.A![padId].slice(2, 4), [1, 1])
  assert.equal(getStepEventRange(groups[0].variants.A![padId], groups[0].lengths.A![padId], 3)?.headIndex, 3)
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

test('paint paging advances at the outer row edge without reacting above or below the row', () => {
  const firstCell = { left: 100, right: 140, top: 20, bottom: 60 }
  const lastCell = { left: 380, right: 420, top: 20, bottom: 60 }

  assert.equal(getStepPageEdgeTarget(0, 419, 40, firstCell, lastCell), 8)
  assert.equal(getStepPageEdgeTarget(1, 101, 40, firstCell, lastCell), 7)
  assert.equal(getStepPageEdgeTarget(0, 300, 40, firstCell, lastCell), null)
  assert.equal(getStepPageEdgeTarget(0, 419, 70, firstCell, lastCell), null)
})

test('holding a paint stroke at a turned page edge advances through the new page in order', () => {
  assert.equal(getStepPageEdgeContinuationTarget(8, sequencerEdgePaintInitialDelayMs - 1), 8)
  assert.equal(getStepPageEdgeContinuationTarget(8, sequencerEdgePaintInitialDelayMs), 9)
  assert.equal(getStepPageEdgeContinuationTarget(8, sequencerEdgePaintInitialDelayMs + (3 * sequencerEdgePaintStepIntervalMs)), 12)
  assert.equal(getStepPageEdgeContinuationTarget(8, 10_000), 15)

  assert.equal(getStepPageEdgeContinuationTarget(7, sequencerEdgePaintInitialDelayMs), 6)
  assert.equal(getStepPageEdgeContinuationTarget(7, 10_000), 0)
})
