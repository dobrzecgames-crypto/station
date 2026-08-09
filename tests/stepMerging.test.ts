import assert from 'node:assert/strict'
import test from 'node:test'
import { StepSequencer } from '../src/audio/StepSequencer.ts'
import type { SequencerTicker, StepSequencerConfig, StepSequencerTrack } from '../src/audio/StepSequencer.ts'
import { createPadBank } from '../src/pads/padBank.ts'
import {
  addPatternGroup,
  createInitialPatternGroups,
  clonePatternGroup,
  duplicateVariant,
  ensurePatternGroupLengths,
  mergeAdjacentVariantSteps,
  setVariantStepShift,
  setVariantStepVelocity,
  splitMergedVariantStep,
  updateVariantStep,
} from '../src/patterns/patternOperations.ts'
import { getStepEventRange } from '../src/patterns/stepEvents.ts'

const padIds = createPadBank().map((pad) => pad.id)
const groupId = 'pattern-group-1'
const firstPadId = padIds[0]
const secondPadId = padIds[1]

test('SCAL merges runs of 2, 3 and more adjacent active steps around the selection', () => {
  for (const count of [2, 3, 6]) {
    let groups = createInitialPatternGroups(padIds)
    for (let index = 2; index < 2 + count; index += 1) groups = updateVariantStep(groups, groupId, 'A', firstPadId, index)
    groups = mergeAdjacentVariantSteps(groups, groupId, 'A', firstPadId, 2 + Math.floor(count / 2))
    const group = groups[0]
    const steps = group.variants.A![firstPadId]
    const lengths = group.lengths.A![firstPadId]
    assert.equal(lengths[2], count)
    assert.equal(steps.slice(2, 2 + count).every((velocity) => velocity > 0), true)
    assert.deepEqual(getStepEventRange(steps, lengths, 2 + count - 1), { headIndex: 2, endIndex: count + 1, length: count, merged: true })
  }
})

test('SCAL does not bridge gaps, rows or the step 16 to step 1 boundary', () => {
  let groups = createInitialPatternGroups(padIds)
  for (const stepIndex of [0, 2, 15]) groups = updateVariantStep(groups, groupId, 'A', firstPadId, stepIndex)
  groups = updateVariantStep(groups, groupId, 'A', secondPadId, 1)
  groups = mergeAdjacentVariantSteps(groups, groupId, 'A', firstPadId, 0)
  groups = mergeAdjacentVariantSteps(groups, groupId, 'A', secondPadId, 1)
  const group = groups[0]
  assert.equal(group.lengths.A![firstPadId][0], 1)
  assert.equal(group.lengths.A![firstPadId][15], 1)
  assert.equal(group.lengths.A![secondPadId][1], 1)
})

test('SCAL changes only the targeted Pattern Group and variant', () => {
  let groups = createInitialPatternGroups(padIds)
  for (const stepIndex of [5, 6]) groups = updateVariantStep(groups, groupId, 'A', firstPadId, stepIndex)
  groups = duplicateVariant(groups, groupId, 'A', 'B')
  groups = addPatternGroup(groups, 'pattern-group-2', padIds)
  for (const stepIndex of [5, 6]) groups = updateVariantStep(groups, 'pattern-group-2', 'A', firstPadId, stepIndex)
  groups = mergeAdjacentVariantSteps(groups, groupId, 'A', firstPadId, 5)
  assert.equal(groups[0].lengths.A![firstPadId][5], 2)
  assert.deepEqual(groups[0].lengths.B![firstPadId].slice(5, 7), [1, 1])
  assert.deepEqual(groups[1].lengths.A![firstPadId].slice(5, 7), [1, 1])
})

test('merged velocity and SHIFT belong to the whole event, and ROZDZIEL restores ordinary steps', () => {
  let groups = createInitialPatternGroups(padIds)
  for (const stepIndex of [4, 5, 6]) groups = updateVariantStep(groups, groupId, 'A', firstPadId, stepIndex)
  groups = mergeAdjacentVariantSteps(groups, groupId, 'A', firstPadId, 5)
  groups = setVariantStepVelocity(groups, groupId, 'A', firstPadId, 6, 0.42)
  groups = setVariantStepShift(groups, groupId, 'A', firstPadId, 5, -0.2)
  let group = groups[0]
  assert.deepEqual(group.variants.A![firstPadId].slice(4, 7), [0.42, 0.42, 0.42])
  assert.deepEqual(group.shifts.A![firstPadId].slice(4, 7), [-0.2, -0.2, -0.2])

  groups = splitMergedVariantStep(groups, groupId, 'A', firstPadId, 6)
  group = groups[0]
  assert.deepEqual(group.lengths.A![firstPadId].slice(4, 7), [1, 1, 1])
  assert.equal(getStepEventRange(group.variants.A![firstPadId], group.lengths.A![firstPadId], 5)?.merged, false)
})

test('removing any selected merged event clears its whole block', () => {
  let groups = createInitialPatternGroups(padIds)
  for (const stepIndex of [7, 8, 9]) groups = updateVariantStep(groups, groupId, 'A', firstPadId, stepIndex)
  groups = mergeAdjacentVariantSteps(groups, groupId, 'A', firstPadId, 8)
  groups = updateVariantStep(groups, groupId, 'A', firstPadId, 9)
  assert.deepEqual(groups[0].variants.A![firstPadId].slice(7, 10), [0, 0, 0])
  assert.deepEqual(groups[0].lengths.A![firstPadId].slice(7, 10), [0, 0, 0])
})

test('legacy patterns migrate active cells to independent one-step events and preserve stored stretched sound', () => {
  const independent = createInitialPatternGroups(padIds)
  independent[0].variants.A![firstPadId][0] = 1
  independent[0].variants.A![firstPadId][1] = 0.7
  delete (independent[0] as Partial<typeof independent[0]>).lengths
  const normalizedIndependent = ensurePatternGroupLengths(independent)[0]
  assert.deepEqual(normalizedIndependent.lengths.A![firstPadId].slice(0, 2), [1, 1])

  const stretched = createInitialPatternGroups(padIds)
  stretched[0].variants.A![firstPadId][4] = 0.8
  stretched[0].lengths.A![firstPadId][4] = 3
  const normalizedStretched = ensurePatternGroupLengths(stretched)[0]
  assert.deepEqual(normalizedStretched.variants.A![firstPadId].slice(4, 7), [0.8, 0.8, 0.8])
  assert.deepEqual(normalizedStretched.lengths.A![firstPadId].slice(4, 7), [3, 1, 1])

  const unboundedSample = createInitialPatternGroups(padIds)
  unboundedSample[0].bank.pads[0].assetId = 'legacy-sample'
  unboundedSample[0].variants.A![firstPadId][8] = 1
  delete (unboundedSample[0] as Partial<typeof unboundedSample[0]>).lengths
  const normalizedSample = ensurePatternGroupLengths(unboundedSample)[0]
  assert.equal(getStepEventRange(normalizedSample.variants.A![firstPadId], normalizedSample.lengths.A![firstPadId], 8)?.length, 1)
  assert.equal(normalizedSample.lengths.A![firstPadId][8], 0)
})

test('SAVE/OPEN-compatible JSON round-trip preserves merged event spans', () => {
  let groups = createInitialPatternGroups(padIds)
  for (const stepIndex of [1, 2, 3]) groups = updateVariantStep(groups, groupId, 'A', firstPadId, stepIndex)
  groups = mergeAdjacentVariantSteps(groups, groupId, 'A', firstPadId, 2)
  const reopened = clonePatternGroup(JSON.parse(JSON.stringify(groups[0])) as typeof groups[0])
  assert.deepEqual(reopened.lengths.A![firstPadId].slice(1, 4), [3, 1, 1])
})

test('scheduler triggers a merged sample once for its exact span and leaves ordinary neighbours independent', () => {
  const ticker = new ManualTicker()
  const engine = new FakeEngine()
  const sequencer = new StepSequencer(engine as never, ticker, 0.1)
  const track: StepSequencerTrack = {
    source: 'sample', groupId, channelId: firstPadId, assetId: 'sample-1', options: {},
    steps: [1, 1, 1, 0, 1, ...Array(11).fill(0)],
    shifts: Array(16).fill(0),
    lengths: [3, 1, 1, 0, 1, ...Array(11).fill(0)],
  }
  const config = sequencerConfig(track)
  sequencer.start(() => config)
  engine.now = 0.13; ticker.run()
  engine.now = 0.26; ticker.run()
  engine.now = 0.38; ticker.run()
  engine.now = 0.51; ticker.run()
  assert.equal(engine.samples.length, 2)
  assert.deepEqual(engine.samples.map((event) => event.when), [0, 0.5])
  assert.ok(Math.abs(engine.samples[0].duration - 0.375) < 1e-9)
  assert.ok(Math.abs(engine.samples[1].duration - 0.125) < 1e-9)
})

test('scheduler gives every current synth source one note-on and a gate spanning all merged steps', () => {
  const ticker = new ManualTicker()
  const engine = new FakeEngine()
  const sequencer = new StepSequencer(engine as never, ticker, 0.1)
  const common = {
    groupId, channelId: firstPadId,
    steps: [0.6, 0.6, 0.6, ...Array(13).fill(0)],
    shifts: Array(16).fill(0),
    lengths: [3, 1, 1, ...Array(13).fill(0)],
  }
  const tracks: StepSequencerTrack[] = [{
    ...common,
    source: 'synth', groupId, channelId: firstPadId, patch: { gate: 1 } as never, midiNotes: [48],
  }, {
    ...common,
    source: 'strings', patch: { gate: 1 } as never, midiNotes: [48, 55],
  }, {
    ...common,
    source: 'organicBass', patch: { gate: 1 } as never, midiNote: 36,
  }]
  const config: StepSequencerConfig = { ...sequencerConfig(tracks[0]), getTracksForSlot: () => tracks }
  sequencer.start(() => config)
  engine.now = 0.13; ticker.run()
  engine.now = 0.26; ticker.run()
  assert.equal(engine.synths.length, 1)
  assert.equal(engine.strings.length, 1)
  assert.equal(engine.organicBass.length, 1)
  assert.ok(Math.abs(engine.synths[0].off - 0.375) < 1e-9)
  assert.ok(Math.abs(engine.strings[0].off - 0.375) < 1e-9)
  assert.ok(Math.abs(engine.organicBass[0].off - 0.375) < 1e-9)
})

function sequencerConfig(track: StepSequencerTrack): StepSequencerConfig {
  return { bpm: 120, swing: 0, metronomeEnabled: false, mode: 'pattern', loopSong: false, lastSongSlot: null, getTracksForSlot: () => [track] }
}

class ManualTicker implements SequencerTicker {
  private callback?: () => void
  wake(callback: () => void): void { this.callback = callback }
  cancel(): void { this.callback = undefined }
  run(): void { const callback = this.callback; this.callback = undefined; callback?.() }
}

class FakeEngine {
  now = 0
  samples: Array<{ when: number; duration: number }> = []
  synths: Array<{ when: number; off: number }> = []
  strings: Array<{ when: number; off: number }> = []
  organicBass: Array<{ when: number; off: number }> = []
  getCurrentTime(): number { return this.now }
  scheduleSample(_groupId: string, _channelId: string, _assetId: string, when: number, options: { maxDurationSeconds?: number }): void { this.samples.push({ when, duration: options.maxDurationSeconds ?? Infinity }) }
  scheduleSynthPad(_groupId: string, _channelId: string, _patch: unknown, _notes: readonly number[], when: number, off: number): void { this.synths.push({ when, off }) }
  scheduleSynthChord(): void {}
  scheduleStringsPad(_groupId: string, _channelId: string, _patch: unknown, _notes: readonly number[], when: number, off: number): void { this.strings.push({ when, off }) }
  scheduleOrganicBassPad(_groupId: string, _channelId: string, _patch: unknown, _note: number, when: number, off: number): void { this.organicBass.push({ when, off }) }
  releaseSequencerChordAt(): void {}
  stopSequencerChokeGroupAt(): void {}
  scheduleMetronome(): void {}
}
