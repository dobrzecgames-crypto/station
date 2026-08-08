import assert from 'node:assert/strict'
import test from 'node:test'
import { StepSequencer } from '../src/audio/StepSequencer.ts'
import type { SequencerTicker, StepSequencerConfig, StepSequencerTrack } from '../src/audio/StepSequencer.ts'
import { ChordPriority } from '../src/music/chordPriority.ts'
import { chordIntervals, createChordAssignments, isChordCompatible, padRootPitchClass, resolveChordMidiNotes, scalePitchClasses } from '../src/music/chords.ts'
import { defaultProjectKey, getScalePitchOffsets, scaleIds } from '../src/music/scales.ts'
import type { ProjectKey } from '../src/music/scales.ts'
import { remapScalarChordBank } from '../src/music/scaleMapping.ts'
import { chordFieldsForMode, chordFieldsWithAssignment, normalizePatternChordFields, repairedChordFields } from '../src/patterns/patternChordState.ts'

test('legacy Patterns migrate to NOTES with safe empty chord slots', () => {
  const migrated = normalizePatternChordFields({}, 16)
  assert.equal(migrated.padMode, 'notes')
  assert.deepEqual(migrated.chordAssignments, Array(16).fill(null))
})

test('every generated chord contains only notes from the selected scale', () => {
  for (const scale of scaleIds) {
    const key: ProjectKey = { root: 'C', scale }
    const pads = fakePads().map((pad, index) => ({ ...pad, pitchSemitones: getScalePitchOffsets(scale, 16)[index] }))
    const allowed = scalePitchClasses(key)
    createChordAssignments(pads, key).forEach((assignment, index) => {
      assert.equal(isChordCompatible(assignment.type, pads[index], key), true)
      const root = padRootPitchClass(pads[index], key)
      assert.equal(chordIntervals(assignment.type).every((interval) => allowed.has((root + interval) % 12)), true)
    })
  }
})

test('pads in different octaves keep their own chord voicing', () => {
  const [low, high] = fakePads().map((pad, index) => ({ ...pad, pitchSemitones: index === 1 ? 12 : 0 }))
  const group = { synthPatches: [{ id: 'patch', baseMidiNote: 36 }], stringsPatches: [] } as never
  const lowNotes = resolveChordMidiNotes(group, { ...low, synthPatchId: 'patch' } as never, { type: 'minor' }, defaultProjectKey)
  const highNotes = resolveChordMidiNotes(group, { ...high, synthPatchId: 'patch' } as never, { type: 'minor7' }, defaultProjectKey)
  assert.equal(highNotes[0] - lowNotes[0], 12)
  assert.notDeepEqual(highNotes, lowNotes)
})

test('Project Key changes preserve compatible chords and repair incompatible ones', () => {
  const pads = fakePads().map((pad) => ({ ...pad, pitchSemitones: 0 }))
  let fields = chordFieldsForMode(pads, normalizePatternChordFields({}, 16), 'chords', { root: 'C', scale: 'major' })
  fields = chordFieldsWithAssignment(fields, 0, { type: 'major' })
  fields = chordFieldsWithAssignment(fields, 1, { type: 'power' })
  const repaired = repairedChordFields(pads, fields, { root: 'C', scale: 'naturalMinor' })
  assert.notEqual(repaired.chordAssignments[0]?.type, 'major')
  assert.equal(repaired.chordAssignments[1]?.type, 'power')
})

test('a scalar SMART CHORDS bank follows the changed Project Key', () => {
  const pads = fakePads().map((pad, index) => ({
    ...pad,
    assetId: null,
    synthPatchId: 'patch',
    stringsPatchId: null,
    chordIntervals: [0],
    pitchSemitones: getScalePitchOffsets('naturalMinor', 16)[index],
  }))
  const group = { id: 'group-1', bank: { pads } } as never
  const remapped = remapScalarChordBank(group, { root: 'C', scale: 'major' })
  assert.deepEqual(remapped.bank.pads.map((pad) => pad.pitchSemitones), getScalePitchOffsets('major', 16))
})

test('returning to NOTES preserves existing per-pad POLY chord data', () => {
  const pads = fakePads().map((pad, index) => ({ ...pad, chordIntervals: index === 0 ? [0, 4, 7] : [0] }))
  const chordFields = chordFieldsForMode(pads, normalizePatternChordFields({}, 16), 'chords', defaultProjectKey)
  const notesFields = chordFieldsForMode(pads, chordFields, 'notes', defaultProjectKey)
  assert.equal(notesFields.padMode, 'notes')
  assert.deepEqual(pads[0].chordIntervals, [0, 4, 7])
  assert.deepEqual(notesFields.chordAssignments, chordFields.chordAssignments)
})

test('last-pad priority ignores stale releases', () => {
  const priority = new ChordPriority()
  const first = priority.press('group-1', 'pad-01')
  const second = priority.press('group-1', 'pad-05')
  assert.equal(second.previousToken, first.token)
  assert.equal(priority.release('pad-01'), undefined)
  assert.equal(priority.release('pad-05'), second.token)
})

test('simultaneous chord steps collapse to one and later steps choke their predecessor', () => {
  const ticker = new ManualTicker()
  const engine = new FakeChordEngine()
  const sequencer = new StepSequencer(engine as never, ticker, 0.1)
  const patch = { gate: 1 } as never
  const track = (channelId: string, activeSteps: number[]): StepSequencerTrack => ({
    source: 'synthChord',
    groupId: 'group-1',
    chordGroupId: 'group-1',
    channelId,
    patch,
    midiNotes: [48, 52, 55],
    steps: Array.from({ length: 16 }, (_, index) => activeSteps.includes(index) ? 1 : 0),
    shifts: Array(16).fill(0),
    lengths: Array(16).fill(4),
  })
  const config: StepSequencerConfig = { bpm: 120, swing: 0, metronomeEnabled: false, mode: 'pattern', loopSong: false, lastSongSlot: null, getTracksForSlot: () => [track('channel-a', [0, 1]), track('channel-b', [0])] }
  sequencer.start(() => config)
  assert.deepEqual(engine.scheduled.map((event) => event.channelId), ['channel-b'])
  engine.now = 0.13
  ticker.run()
  assert.deepEqual(engine.scheduled.map((event) => event.channelId), ['channel-b', 'channel-a'])
  assert.deepEqual(engine.releases, [0, 0.125])
})

class ManualTicker implements SequencerTicker {
  private callback?: () => void
  wake(callback: () => void): void { this.callback = callback }
  cancel(): void { this.callback = undefined }
  run(): void { const callback = this.callback; this.callback = undefined; callback?.() }
}

class FakeChordEngine {
  now = 0
  releases: number[] = []
  scheduled: Array<{ channelId: string; when: number; off: number }> = []
  getCurrentTime(): number { return this.now }
  releaseSequencerChordAt(_groupId: string, when: number): void { this.releases.push(when) }
  scheduleSynthChord(_groupId: string, channelId: string, _patch: unknown, _notes: readonly number[], when: number, off: number): void { this.scheduled.push({ channelId, when, off }) }
  scheduleSynthPad(): void {}
  scheduleStringsPad(): void {}
  scheduleSample(): void {}
  stopSequencerChokeGroupAt(): void {}
  scheduleMetronome(): void {}
}

function fakePads() {
  return Array.from({ length: 16 }, (_, index) => ({ id: `pad-${index + 1}`, pitchSemitones: index })) as never[]
}
