import assert from 'node:assert/strict'
import test from 'node:test'
import { createPadBank } from '../src/pads/padBank.ts'
import { addPatternGroup, createInitialPatternGroups, renamePatternGroup } from '../src/patterns/patternOperations.ts'

const padIds = createPadBank().map((pad) => pad.id)

test('bank rename changes only the selected Pattern Group and normalizes whitespace', () => {
  let groups = createInitialPatternGroups(padIds)
  groups = addPatternGroup(groups, 'pattern-group-2', padIds)
  groups = renamePatternGroup(groups, 'pattern-group-2', '  DRUM   BREAK  ')

  assert.equal(groups[0].name, 'Pattern 1')
  assert.equal(groups[1].name, 'DRUM BREAK')
})

test('bank rename rejects an empty name', () => {
  const groups = createInitialPatternGroups(padIds)
  assert.throws(() => renamePatternGroup(groups, groups[0].id, '   '), /cannot be empty/)
})
