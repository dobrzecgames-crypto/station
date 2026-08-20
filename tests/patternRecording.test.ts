import assert from 'node:assert/strict'
import test from 'node:test'
import { StepSequencer } from '../src/audio/StepSequencer.ts'
import type { SequencerTicker, StepSequencerConfig } from '../src/audio/StepSequencer.ts'
import { createPadBank } from '../src/pads/padBank.ts'
import { clearVariant, createInitialPatternGroups, recordVariantStep } from '../src/patterns/patternOperations.ts'
import {
  applyPatternTakeHit,
  commitPatternTake,
  createPatternTake,
  getPatternSectionCount,
  restorePatternSequence,
} from '../src/patterns/patternRecording.ts'

const padIds = createPadBank().map((pad) => pad.id)
const [firstPadId, secondPadId] = padIds
const groupId = 'pattern-group-1'

test('OVERDUB preserves existing events and auto-extends a first take through A-D before wrapping', () => {
  let groups = createInitialPatternGroups(padIds)
  let take = createPatternTake(groups[0], 'overdub', 0)

  for (const [takeStepIndex, padId] of [[4, firstPadId], [16, secondPadId], [32, firstPadId], [48, secondPadId], [64, firstPadId]] as const) {
    const result = applyPatternTakeHit(groups, take, padId, takeStepIndex)
    groups = result.groups
    take = result.take
  }

  assert.equal(getPatternSectionCount(groups[0]), 4)
  assert.equal(groups[0].variants.A![firstPadId][4], 1)
  assert.equal(groups[0].variants.B![secondPadId][0], 1)
  assert.equal(groups[0].variants.C![firstPadId][0], 1)
  assert.equal(groups[0].variants.D![secondPadId][0], 1)
  assert.equal(groups[0].variants.A![firstPadId][0], 1)
})

test('an established 32-step pattern loops A-B and does not auto-create C', () => {
  let groups = createInitialPatternGroups(padIds)
  groups = clearVariant(groups, groupId, 'B', padIds)
  const take = createPatternTake(groups[0], 'overdub', 0)
  const result = applyPatternTakeHit(groups, take, firstPadId, 32)

  assert.equal(result.take.autoExtend, false)
  assert.equal(getPatternSectionCount(result.groups[0]), 2)
  assert.equal(result.groups[0].variants.A![firstPadId][0], 1)
  assert.equal(result.groups[0].variants.C, undefined)
})

test('REPLACE clears only the recorded range across the A-B boundary', () => {
  let groups = createInitialPatternGroups(padIds)
  groups = clearVariant(groups, groupId, 'B', padIds)
  groups = recordVariantStep(groups, groupId, 'A', firstPadId, 14)
  groups = recordVariantStep(groups, groupId, 'A', firstPadId, 15)
  groups = recordVariantStep(groups, groupId, 'B', firstPadId, 0)
  groups = recordVariantStep(groups, groupId, 'B', firstPadId, 3)
  let take = createPatternTake(groups[0], 'replace', 15)

  let result = applyPatternTakeHit(groups, take, secondPadId, 0)
  groups = result.groups
  take = result.take
  result = applyPatternTakeHit(groups, take, secondPadId, 2)
  groups = result.groups

  assert.equal(groups[0].variants.A![firstPadId][14], 1)
  assert.equal(groups[0].variants.A![firstPadId][15], 0)
  assert.equal(groups[0].variants.B![firstPadId][0], 0)
  assert.equal(groups[0].variants.B![firstPadId][3], 1)
  assert.equal(groups[0].variants.A![secondPadId][15], 1)
  assert.equal(groups[0].variants.B![secondPadId][1], 1)
})

test('TAKE commit restores REPLACE removals on undo and reapplies them on redo', () => {
  let groups = createInitialPatternGroups(padIds)
  groups = recordVariantStep(groups, groupId, 'A', firstPadId, 5)
  const take = createPatternTake(groups[0], 'replace', 5)
  const result = applyPatternTakeHit(groups, take, secondPadId, 0)
  const commit = commitPatternTake(result.groups, result.take)

  assert.ok(commit)
  const undone = restorePatternSequence(result.groups, groupId, commit.before)
  assert.equal(undone[0].variants.A![firstPadId][5], 1)
  assert.equal(undone[0].variants.A![secondPadId][5], 0)

  const redone = restorePatternSequence(undone, groupId, commit.after)
  assert.equal(redone[0].variants.A![firstPadId][5], 0)
  assert.equal(redone[0].variants.A![secondPadId][5], 1)
})

test('an empty or cancelled take creates neither history nor pattern extension', () => {
  const groups = createInitialPatternGroups(padIds)
  const take = createPatternTake(groups[0], 'overdub', 0)

  assert.equal(commitPatternTake(groups, take), null)
  assert.equal(getPatternSectionCount(groups[0]), 1)
})

test('audio-clock scheduler plays pattern sections in order and loops after the fixed length or D', () => {
  assert.deepEqual(scheduledSectionStarts(2, false, 3), [0, 1, 0])
  assert.deepEqual(scheduledSectionStarts(1, true, 5), [0, 1, 2, 3, 0])
})

function scheduledSectionStarts(sectionCount: number, autoExtend: boolean, count: number): number[] {
  const ticker = new ManualTicker()
  const engine = new ClockEngine()
  const sequencer = new StepSequencer(engine as never, ticker, 0.1)
  const sectionStarts: number[] = []
  const config: StepSequencerConfig = {
    bpm: 120,
    swing: 0,
    metronomeEnabled: false,
    mode: 'pattern',
    loopSong: false,
    lastSongSlot: null,
    getPatternSectionCount: () => sectionCount,
    shouldAutoExtendPattern: () => autoExtend,
    getTracksForSlot: () => [],
    onStepScheduled: (stepIndex, _time, _duration, sectionIndex) => {
      if (stepIndex === 0) sectionStarts.push(sectionIndex)
    },
  }
  sequencer.start(() => config)
  for (let pass = 0; pass < 200 && sectionStarts.length < count; pass += 1) {
    // This helper verifies section order, not late-wake recovery. Advance by
    // the exact 120 BPM sixteenth so schedulerRecovery.test.ts owns stalls.
    engine.now += 0.125
    ticker.run()
  }
  sequencer.stop()
  return sectionStarts.slice(0, count)
}

class ManualTicker implements SequencerTicker {
  private callback?: () => void
  wake(callback: () => void): void { this.callback = callback }
  cancel(): void { this.callback = undefined }
  run(): void { const callback = this.callback; this.callback = undefined; callback?.() }
}

class ClockEngine {
  now = 0
  getCurrentTime(): number { return this.now }
  scheduleMetronome(): void {}
}
