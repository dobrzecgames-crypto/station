import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefaultDrumKickPatch } from '../src/drumsynth/drumSynthOperations.ts'
import { createKickSeed, createSeededRandom } from '../src/drumsynth/seededRandom.ts'

test('KICK derives a stable seed from its audible patch values', () => {
  const patch = createDefaultDrumKickPatch()
  assert.equal(createKickSeed(patch), createKickSeed({ ...patch }))
  assert.notEqual(createKickSeed(patch), createKickSeed({ ...patch, click: Math.min(1, patch.click + 0.01) }))
})

test('KICK seeded noise repeats exactly for the same patch', () => {
  const seed = createKickSeed(createDefaultDrumKickPatch())
  const first = createSeededRandom(seed)
  const second = createSeededRandom(seed)
  assert.deepEqual(Array.from({ length: 32 }, first), Array.from({ length: 32 }, second))
})
