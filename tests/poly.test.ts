import assert from 'node:assert/strict'
import test from 'node:test'
import { clonePadBank, createPadBankState } from '../src/pads/padBank.ts'
import { clonePatternGroup, createPatternGroup } from '../src/patterns/patternOperations.ts'
import {
  assignPolySource, choosePolyVoiceToSteal, clampModulationAmount, clonePolyPatch,
  createDefaultPolyPatch, mapPolyModulation, removeUnreferencedPolyPatches,
} from '../src/poly/polyOperations.ts'
import { generatePolyWavetable, interpolateWavetablePosition, interpolateWavetableSample, polyWavetableBank, polyWavetableFrameCount } from '../src/poly/polyWavetables.ts'

test('default POLY patch is musical, serializable, and fully independent when cloned', () => {
  const patch = createDefaultPolyPatch('poly-1')
  assert.equal(patch.name, 'CLEAN MODERN')
  assert.equal(patch.oscillator1.unison, 4)
  assert.ok(patch.filter.cutoffHz < 8000)
  assert.ok(patch.level < 0.8)
  assert.doesNotThrow(() => JSON.stringify(patch))
  const cloned = clonePolyPatch(patch)
  cloned.oscillator1.position = 1
  cloned.ampEnvelope.releaseSeconds = 9
  cloned.modulation[0].amount = -1
  assert.notEqual(cloned.oscillator1.position, patch.oscillator1.position)
  assert.notEqual(cloned.ampEnvelope.releaseSeconds, patch.ampEnvelope.releaseSeconds)
  assert.notEqual(cloned.modulation[0].amount, patch.modulation[0].amount)
})

test('POLY assignment is mutually exclusive and cleanup keeps only referenced patches', () => {
  const pad = { ...createPadBankState().pads[0], assetId: 'sample', synthPatchId: 'mono', organicBassPatchId: 'bass' }
  const assigned = assignPolySource(pad, 'poly-1', [0, 4, 7])
  assert.equal(assigned.assetId, null)
  assert.equal(assigned.synthPatchId, null)
  assert.equal(assigned.organicBassPatchId, null)
  assert.equal(assigned.polyPatchId, 'poly-1')
  const group = createPatternGroup('group-1', 1, createPadBankState().pads.map((item) => item.id))
  group.bank.pads[0] = assigned
  group.polyPatches = [createDefaultPolyPatch('poly-1'), createDefaultPolyPatch('poly-unused')]
  const cleaned = removeUnreferencedPolyPatches(group)
  assert.deepEqual(cleaned.polyPatches.map((patch) => patch.id), ['poly-1'])
})

test('modulation clamps bipolar amounts and sums sources into destination ranges', () => {
  assert.equal(clampModulationAmount(-4), -1)
  assert.equal(clampModulationAmount(4), 1)
  assert.equal(clampModulationAmount(Number.NaN), 0)
  const routes = [
    { source: 'lfo1', destination: 'filterCutoff', amount: .8 },
    { source: 'modEnv', destination: 'filterCutoff', amount: -.25 },
  ] as const
  assert.ok(Math.abs(mapPolyModulation('filterCutoff', routes, { lfo1: .5, modEnv: 1 }) - 9) < 1e-9)
  assert.equal(mapPolyModulation('filterCutoff', [{ source: 'lfo1', destination: 'filterCutoff', amount: 1 }], { lfo1: 4 }), 60)
})

test('built-in wavetable bank is substantial, deterministic, multi-frame and finite', () => {
  assert.ok(polyWavetableBank.length >= 40)
  const first = generatePolyWavetable('motion-aurora')
  const second = generatePolyWavetable('motion-aurora')
  assert.equal(first.levels[0].frames.length, polyWavetableFrameCount)
  assert.deepEqual(first.levels.at(-1)?.frames[7], second.levels.at(-1)?.frames[7])
  assert.equal(first.levels.every((level) => level.frames.every((frame) => frame.every(Number.isFinite))), true)
})

test('wavetable interpolation is continuous and bounded at position and phase edges', () => {
  const frames = [new Float32Array([0, 1, 0, -1]), new Float32Array([1, 0, -1, 0])]
  assert.equal(interpolateWavetablePosition(frames, -1, 0), 0)
  assert.equal(interpolateWavetablePosition(frames, 1, 0), 1)
  assert.equal(interpolateWavetablePosition(frames, .5, 0), .5)
  assert.ok(Math.abs(interpolateWavetableSample(frames[0], .9999) - interpolateWavetableSample(frames[0], 0)) < .001)
})

test('voice stealing prefers release, otherwise oldest active voice', () => {
  const voices = Array.from({ length: 8 }, (_, serial) => ({ startsAt: serial, serial }))
  assert.equal(choosePolyVoiceToSteal(voices, 10)?.serial, 0)
  const releasing = voices.map((voice) => ({ ...voice, stopAt: voice.serial === 5 ? 12 : undefined }))
  assert.equal(choosePolyVoiceToSteal(releasing, 10)?.serial, 5)
  assert.equal(choosePolyVoiceToSteal(voices.slice(0, 7), 10), undefined)
})

test('schema-v20-shaped groups migrate with empty POLY collections and null pad references', () => {
  const group = createPatternGroup('group-1', 1, createPadBankState().pads.map((pad) => pad.id))
  const legacy = structuredClone(group) as unknown as Record<string, unknown>
  delete legacy.polyPatches
  const bank = legacy.bank as { pads: Array<Record<string, unknown>> }
  for (const pad of bank.pads) delete pad.polyPatchId
  const migrated = clonePatternGroup(legacy as never)
  assert.deepEqual(migrated.polyPatches, [])
  assert.equal(migrated.bank.pads[0].polyPatchId, null)
  assert.equal(clonePadBank(migrated.bank).pads[0].polyPatchId, null)
})
