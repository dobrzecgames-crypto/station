import assert from 'node:assert/strict'
import test from 'node:test'
import { StepSequencer } from '../src/audio/StepSequencer.ts'
import type { SequencerTicker, StepSequencerConfig, StepSequencerTrack } from '../src/audio/StepSequencer.ts'
import { ChordPriority } from '../src/music/chordPriority.ts'
import { chordIntervals, chordSuggestions, createChordAssignments, isChordCompatible, maximumChordVoices, padRootPitchClass, resolveChordMidiNotes, resolveChordVoicing, scaleChordVoiceVelocity, scalePitchClasses } from '../src/music/chords.ts'
import type { ChordType } from '../src/music/chords.ts'
import { clampChordPerformance, defaultChordPerformance, isPendingChordVoice, maximumHumanTimingSeconds, maximumHumanVelocityVariation, maximumStrumSweepSeconds, performChordVoices } from '../src/music/chordPerformance.ts'
import { defaultProjectKey, getCenteredScalePitchOffsets, getScalePitchOffsets, scaleIds } from '../src/music/scales.ts'
import type { ProjectKey } from '../src/music/scales.ts'
import { remapScalarChordBank } from '../src/music/scaleMapping.ts'
import { chordFieldsForMode, chordFieldsWithAssignment, normalizePatternChordFields, repairedChordFields } from '../src/patterns/patternChordState.ts'
import { clonePatternGroup, createPatternGroup, setPatternGroupPadMode } from '../src/patterns/patternOperations.ts'
import { createDefaultSynthPatch } from '../src/synth/synthOperations.ts'

test('legacy Patterns migrate to NOTES with safe empty chord slots', () => {
  const migrated = normalizePatternChordFields({}, 16)
  assert.equal(migrated.padMode, 'notes')
  assert.deepEqual(migrated.chordAssignments, Array(16).fill(null))
})

test('legacy octave-only assignments normalize to an unassigned harmonic position', () => {
  const normalized = normalizePatternChordFields({ padMode: 'chords', chordAssignments: [{ type: 'rootOctave' }] }, 1)
  assert.deepEqual(normalized.chordAssignments, [null])
})

test('every generated chord contains only notes from the selected scale', () => {
  for (const scale of scaleIds) {
    const key: ProjectKey = { root: 'C', scale }
    const pads = fakePads().map((pad, index) => ({ ...pad, pitchSemitones: getCenteredScalePitchOffsets(scale, 16)[index] }))
    const allowed = scalePitchClasses(key)
    createChordAssignments(pads, key).forEach((assignment, index) => {
      if (!assignment) return
      assert.notEqual(assignment.type, 'rootOctave')
      assert.equal(isChordCompatible(assignment.type, pads[index], key), true)
      const root = padRootPitchClass(pads[index], key)
      assert.equal(chordIntervals(assignment.type).every((interval) => allowed.has((root + interval) % 12)), true)
    })
  }
})

test('SMART CHORDS centers scale-degree roots for seven- and five-note scales', () => {
  const cases = [
    {
      key: { root: 'C', scale: 'naturalMinor' } as const,
      expected: [-12, -10, -9, -7, -5, -4, -2, 0, 2, 3, 5, 7, 8, 10, 12, 14],
      centralTonicPad: 8,
    },
    {
      key: { root: 'C', scale: 'dorian' } as const,
      expected: [-12, -10, -9, -7, -5, -3, -2, 0, 2, 3, 5, 7, 9, 10, 12, 14],
      centralTonicPad: 8,
    },
    {
      key: { root: 'C', scale: 'minorPentatonic' } as const,
      expected: [-17, -14, -12, -9, -7, -5, -2, 0, 3, 5, 7, 10, 12, 15, 17, 19],
      centralTonicPad: 8,
    },
  ]

  for (const { key, expected, centralTonicPad } of cases) {
    const group = scalarSynthGroup(key.scale)
    const [mapped] = setPatternGroupPadMode([group], group.id, 'chords', key)
    const offsets = mapped.bank.pads.map((pad) => pad.pitchSemitones)
    assert.deepEqual(offsets, expected)
    assert.equal(offsets.indexOf(0) + 1, centralTonicPad)
    assert.equal(Math.min(...offsets) < 0, true)
    assert.equal(Math.max(...offsets) > 0, true)
  }
})

test('centering derives the tonic position from the window size rather than scale cycles', () => {
  for (const scale of scaleIds) {
    for (const count of [5, 10, 15, 16]) {
      const offsets = getCenteredScalePitchOffsets(scale, count)
      assert.equal(offsets.indexOf(0), Math.floor((count - 1) / 2))
    }
  }
})

test('SMART CHORDS fills pentatonic roots without creating octave-only chords', () => {
  const key = { root: 'C', scale: 'minorPentatonic' } as const
  const [group] = setPatternGroupPadMode([scalarSynthGroup(key.scale)], 'group-1', 'chords', key)
  assert.equal(group.chordAssignments.every((assignment) => assignment !== null), true)
  assert.equal(group.chordAssignments.every((assignment) => assignment?.type !== 'rootOctave'), true)
})

test('C Aeolian derives a different chord family for every diatonic degree', () => {
  const key = { root: 'C', scale: 'naturalMinor' } as const
  assertSuggestionFamily(key, 0, ['minor9', 'minor11', 'minor7', 'minorFlat13'])
  assertSuggestionFamily(key, 2, ['halfDiminished7', 'diminished'])
  assertSuggestionFamily(key, 3, ['major9', 'major7'])
  assertSuggestionFamily(key, 5, ['minor9', 'minor11', 'minor7'])
  assertSuggestionFamily(key, 7, ['minor11', 'minor7', 'minorFlat9'])
  assertSuggestionFamily(key, 8, ['major9', 'major7'])
  assertSuggestionFamily(key, 10, ['dominant9', 'dominant7'])
})

test('Dorian natural 6 changes tonic and IV harmony relative to Aeolian', () => {
  const dorian = { root: 'C', scale: 'dorian' } as const
  const aeolianTypes = suggestionTypes({ root: 'C', scale: 'naturalMinor' }, 0)
  const dorianTypes = suggestionTypes(dorian, 0)
  assert.deepEqual(dorianTypes.slice(0, 5), ['minor6', 'minor69', 'minor13', 'minor9', 'minor11'])
  assert.equal(aeolianTypes.includes('minor6'), false)
  assert.equal(aeolianTypes.includes('minor69'), false)
  assert.notDeepEqual(dorianTypes, aeolianTypes)
  assertSuggestionFamily(dorian, 5, ['dominant9', 'dominant13', 'dominant7'])
})

test('Phrygian b2 and Lydian #4 lead their tonic suggestions', () => {
  assert.deepEqual(suggestionTypes({ root: 'C', scale: 'phrygian' }, 0).slice(0, 2), ['minorFlat9', 'susFlat9'])
  assert.deepEqual(suggestionTypes({ root: 'C', scale: 'lydian' }, 0).slice(0, 2), ['major7Sharp11', 'major9Sharp11'])
})

test('Major keeps ordinary diatonic tonic and leading-tone harmony', () => {
  const key = { root: 'C', scale: 'major' } as const
  assertSuggestionFamily(key, 0, ['major9', 'major7'])
  assertSuggestionFamily(key, 11, ['halfDiminished7', 'diminished'])
})

test('minor pentatonic uses available scale material without seven-note assumptions', () => {
  const key = { root: 'C', scale: 'minorPentatonic' } as const
  const degreeTypes = [0, 3, 5, 7, 10].map((offset) => suggestionTypes(key, offset))
  assert.deepEqual(degreeTypes.map((types) => types[0]), ['minor11', 'major69', 'sus2', 'minor11', 'sus2'])
  assert.equal(degreeTypes.every((types) => types.length > 0 && types.length <= 8), true)
  for (const offset of [0, 3, 5, 7, 10]) {
    const pad = { pitchSemitones: offset } as never
    assert.equal(chordSuggestions(suggestionGroup(key.scale), pad, key).every((suggestion) => isChordCompatible(suggestion.type, pad, key)), true)
  }
})

test('modal tonic suggestion rankings are deterministic and meaningfully distinct', () => {
  const scales = ['naturalMinor', 'dorian', 'phrygian', 'lydian'] as const
  const rankings = scales.map((scale) => suggestionTypes({ root: 'C', scale }, 0))
  assert.equal(new Set(rankings.map((ranking) => ranking.join(','))).size, scales.length)
  for (let index = 0; index < scales.length; index += 1) {
    assert.deepEqual(suggestionTypes({ root: 'C', scale: scales[index] }, 0), rankings[index])
    assert.equal(rankings[index].length <= 8, true)
  }
})

test('Aeolian V exposes only an explicit borrowed dominant below native minor choices', () => {
  const key = { root: 'C', scale: 'naturalMinor' } as const
  const types = suggestionTypes(key, 7)
  assert.equal(types.includes('dominant9'), true)
  assert.equal(types.includes('dominant7'), true)
  const pad = { pitchSemitones: 7 } as never
  assert.equal(isChordCompatible('dominant7', pad, key), false)
  assert.equal(types.indexOf('dominant7') > types.indexOf('minor7'), true)
})

test('a current supported assignment remains selectable while NOTES to CHORDS deliberately regenerates defaults', () => {
  const key = { root: 'C', scale: 'naturalMinor' } as const
  const group = suggestionGroup(key.scale)
  const tonic = { ...group.bank.pads[0], pitchSemitones: 0 }
  assert.equal(chordSuggestions(group, tonic, key, { type: 'major' }).some((suggestion) => suggestion.type === 'major'), true)

  const pads = group.bank.pads.map((pad, index) => ({ ...pad, pitchSemitones: getCenteredScalePitchOffsets(key.scale, 16)[index] }))
  const stored = { padMode: 'notes', chordAssignments: Array(16).fill({ type: 'major' }) } as const
  const regenerated = chordFieldsForMode(pads, stored as never, 'chords', key)
  assert.equal(regenerated.chordAssignments[7]?.type, 'minor11')
  assert.notEqual(regenerated.chordAssignments[7]?.type, 'major')
})

test('pads in different octaves keep their own chord voicing', () => {
  const [low, high] = fakePads().map((pad, index) => ({ ...pad, pitchSemitones: index === 1 ? 12 : 0 }))
  const group = { synthPatches: [{ id: 'patch', baseMidiNote: 36 }], stringsPatches: [] } as never
  const lowNotes = resolveChordMidiNotes(group, { ...low, synthPatchId: 'patch' } as never, { type: 'minor' }, defaultProjectKey)
  const highNotes = resolveChordMidiNotes(group, { ...high, synthPatchId: 'patch' } as never, { type: 'minor7' }, defaultProjectKey)
  assert.equal(highNotes[0] - lowNotes[0], 12)
  assert.notDeepEqual(highNotes, lowNotes)
})

test('Cm9 keeps its identity in a musical five-voice cluster instead of a mechanical stack', () => {
  const voices = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 60)
  const notes = voices.map((voice) => voice.midiNote)
  assert.equal(voices.length <= maximumChordVoices, true)
  assert.deepEqual(new Set(notes.map((note) => note % 12)), new Set([0, 2, 3, 7, 10]))
  assert.notDeepEqual(notes, [60, 63, 67, 70, 74])
  assert.deepEqual(notes, [60, 67, 70, 74, 75])
  assert.equal(notes.some((note, index) => index > 0 && note - notes[index - 1] <= 2), true)
})

test('characteristic Lydian, Phrygian and Dorian tones survive the five-voice limit', () => {
  const lydian = voicedChord('major9Sharp11', { root: 'C', scale: 'lydian' }, 60)
  assert.equal(lydian.length, maximumChordVoices)
  assert.equal(lydian.some((voice) => voice.midiNote % 12 === 6 && voice.role === 'characteristic'), true)
  assert.equal(lydian.some((voice) => voice.midiNote % 12 === 7), false)

  const phrygian = voicedChord('minorFlat9', { root: 'C', scale: 'phrygian' }, 60)
  assert.equal(phrygian.some((voice) => voice.midiNote % 12 === 1 && voice.role === 'characteristic'), true)

  const dorian = voicedChord('minor69', { root: 'C', scale: 'dorian' }, 60)
  assert.equal(dorian.some((voice) => voice.midiNote % 12 === 9 && voice.role === 'characteristic'), true)
})

test('m7b5 treats the altered fifth as defining material', () => {
  const voices = voicedChord('halfDiminished7', { root: 'C', scale: 'locrian' }, 48)
  const flatFive = voices.find((voice) => voice.midiNote % 12 === 6)
  assert.ok(flatFive)
  assert.equal(flatFive.role, 'characteristic')
  assert.equal(flatFive.harmonicVelocity, 0.9)
})

test('register-aware spacing opens the bass and permits compact upper clusters', () => {
  const low = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 36).map((voice) => voice.midiNote)
  const high = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 72).map((voice) => voice.midiNote)
  assert.deepEqual(low, [36, 43, 58, 62, 63])
  assert.equal(low.filter((note) => note < 54).every((note, index, notes) => index === 0 || note - notes[index - 1] >= 5), true)
  assert.deepEqual(high, [67, 70, 72, 74, 75])
  assert.equal(high.some((note, index) => index > 0 && note - high[index - 1] <= 2), true)
  assert.equal(Math.max(...high) - Math.min(...high) < Math.max(...low) - Math.min(...low), true)
})

test('harmonic velocity is role-aware, scales input velocity and clamps safely', () => {
  const native = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 60)
  assert.equal(new Set(native.map((voice) => voice.harmonicVelocity)).size > 1, true)
  assert.equal(native.find((voice) => voice.role === 'root')?.harmonicVelocity, 1)
  assert.equal((native.find((voice) => voice.role === 'fifth')?.harmonicVelocity ?? 1) < (native.find((voice) => voice.role === 'seventh')?.harmonicVelocity ?? 0), true)

  const borrowed = voicedChord('dominant7', { root: 'C', scale: 'naturalMinor' }, 60, 7)
  const chromaticThird = borrowed.find((voice) => voice.role === 'third')
  assert.ok(chromaticThird)
  assert.equal(chromaticThird.isChromatic, true)
  assert.equal(chromaticThird.harmonicVelocity < 0.8, true)
  assert.equal(scaleChordVoiceVelocity(0.8, 1), 0.8)
  assert.equal(scaleChordVoiceVelocity(0.8, chromaticThird.harmonicVelocity), 0.8 * chromaticThird.harmonicVelocity)
  assert.equal(scaleChordVoiceVelocity(2, 2), 1)
  assert.equal(scaleChordVoiceVelocity(-1, 0.8), 0)
  assert.equal(scaleChordVoiceVelocity(Number.NaN, 0.8), 0)
})

test('voicing and harmonic velocity are deterministic for identical context', () => {
  const first = voicedChord('major9Sharp11', { root: 'C', scale: 'lydian' }, 72)
  const second = voicedChord('major9Sharp11', { root: 'C', scale: 'lydian' }, 72)
  assert.deepEqual(second, first)
})

test('STRUM zero is simultaneous and maximum follows actual LOW to HIGH voicing safely', () => {
  const voices = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 60)
  const simultaneous = performChordVoices(voices, { strum: 0, dynamics: 100, humanize: 0 }, 0)
  assert.deepEqual(simultaneous.map((voice) => voice.delaySeconds), Array(voices.length).fill(0))

  const swept = performChordVoices([...voices].reverse(), { strum: 100, dynamics: 100, humanize: 0 }, 0)
  assert.deepEqual(swept.map((voice) => voice.midiNote), [...voices].map((voice) => voice.midiNote).sort((a, b) => a - b))
  assert.equal(swept.every((voice, index) => index === 0 || voice.delaySeconds >= swept[index - 1].delaySeconds), true)
  assert.equal(swept.at(-1)?.delaySeconds, maximumStrumSweepSeconds)
})

test('STRUM is clamped inside a short sequencer event', () => {
  const voices = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 60)
  const duration = 0.04
  const performed = performChordVoices(voices, { strum: 100, dynamics: 100, humanize: 0 }, 0, duration)
  assert.equal(Math.max(...performed.map((voice) => voice.delaySeconds)) <= duration * 0.35 + 0.000001, true)
})

test('DYNAMICS interpolates from equal voices to full Task 3 hierarchy', () => {
  const voices = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 60)
  const flat = performChordVoices(voices, { strum: 0, dynamics: 0, humanize: 0 }, 0)
  const half = performChordVoices(voices, { strum: 0, dynamics: 50, humanize: 0 }, 0)
  const full = performChordVoices(voices, { strum: 0, dynamics: 100, humanize: 0 }, 0)
  assert.deepEqual(flat.map((voice) => voice.performanceVelocity), Array(voices.length).fill(1))
  full.forEach((voice) => assert.equal(voice.performanceVelocity, voice.harmonicVelocity))
  half.forEach((voice) => assert.equal(voice.performanceVelocity, Number(((1 + voice.harmonicVelocity) / 2).toFixed(4))))

  const borrowed = voicedChord('dominant7', { root: 'C', scale: 'naturalMinor' }, 60, 7)
  const borrowedFlat = performChordVoices(borrowed, { strum: 0, dynamics: 0, humanize: 0 }, 0)
  const borrowedFull = performChordVoices(borrowed, { strum: 0, dynamics: 100, humanize: 0 }, 0)
  const chromaticIndex = borrowed.findIndex((voice) => voice.isChromatic)
  assert.equal(borrowedFlat[chromaticIndex].performanceVelocity, 1)
  assert.equal(borrowedFull[chromaticIndex].performanceVelocity, borrowed[chromaticIndex].harmonicVelocity)
  assert.equal(borrowedFull[chromaticIndex].performanceVelocity >= 0.55, true)
})

test('HUMANIZE zero is exact while repeated hits vary within hard velocity and microtiming bounds', () => {
  const voices = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 60)
  const exactA = performChordVoices(voices, { strum: 0, dynamics: 65, humanize: 0 }, 0)
  const exactB = performChordVoices(voices, { strum: 0, dynamics: 65, humanize: 0 }, 99)
  assert.deepEqual(exactB, exactA)

  const first = performChordVoices(voices, { strum: 0, dynamics: 100, humanize: 100 }, 0)
  const second = performChordVoices(voices, { strum: 0, dynamics: 100, humanize: 100 }, 1)
  assert.notDeepEqual(second.map((voice) => [voice.delaySeconds, voice.performanceVelocity]), first.map((voice) => [voice.delaySeconds, voice.performanceVelocity]))
  for (const performed of [first, second]) {
    assert.equal(Math.max(...performed.map((voice) => voice.delaySeconds)) <= maximumHumanTimingSeconds, true)
    performed.forEach((voice) => {
      const base = voice.harmonicVelocity
      assert.equal(Math.abs(voice.performanceVelocity - base) <= maximumHumanVelocityVariation + 0.001, true)
      assert.equal(voice.performanceVelocity >= 0.55 && voice.performanceVelocity <= 1, true)
    })
    const root = performed.find((voice) => voice.role === 'root')!
    const fifth = performed.find((voice) => voice.role === 'fifth')!
    assert.equal(root.performanceVelocity > fifth.performanceVelocity, true)
  }
  assert.deepEqual(performChordVoices(voices, { strum: 0, dynamics: 100, humanize: 100 }, 1), second)
})

test('strong STRUM keeps direction when HUMANIZE timing is layered on top', () => {
  const voices = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 60)
  const performed = performChordVoices(voices, { strum: 100, dynamics: 65, humanize: 100 }, 7)
  assert.equal(performed.every((voice, index) => index === 0 || voice.delaySeconds >= performed[index - 1].delaySeconds), true)
  assert.equal(performed.at(-1)!.delaySeconds <= maximumStrumSweepSeconds + maximumHumanTimingSeconds, true)
})

test('pending delayed voices are cancellable before note-on for release, retrigger and transport stop', () => {
  const voices = voicedChord('minor9', { root: 'C', scale: 'naturalMinor' }, 60)
  const performed = performChordVoices(voices, { strum: 100, dynamics: 65, humanize: 0 }, 0)
  const releaseAt = 10
  const startsAt = performed.map((voice) => releaseAt + voice.delaySeconds)
  assert.equal(startsAt.slice(1).every((start) => isPendingChordVoice(start, releaseAt)), true)
  assert.equal(isPendingChordVoice(releaseAt - 0.001, releaseAt), false)
})

test('legacy Pattern Groups receive safe performance defaults without changing assignments', () => {
  const group = scalarSynthGroup('naturalMinor')
  group.chordAssignments[0] = { type: 'minor9' }
  delete (group as Partial<typeof group>).chordPerformance
  const normalized = clonePatternGroup(group)
  assert.deepEqual(normalized.chordPerformance, defaultChordPerformance)
  assert.deepEqual(normalized.chordAssignments[0], { type: 'minor9' })
  assert.deepEqual(clampChordPerformance({ strum: -4, dynamics: 101, humanize: Number.NaN }), { strum: 0, dynamics: 100, humanize: defaultChordPerformance.humanize })
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
  assert.deepEqual(remapped.bank.pads.map((pad) => pad.pitchSemitones), getCenteredScalePitchOffsets('major', 16))
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
    voices: voicedChord('minor', { root: 'C', scale: 'naturalMinor' }, 48),
    performance: { ...defaultChordPerformance },
    steps: Array.from({ length: 16 }, (_, index) => activeSteps.includes(index) ? 0.8 : 0),
    shifts: Array(16).fill(0),
    lengths: Array(16).fill(1),
  })
  const config: StepSequencerConfig = { bpm: 120, swing: 0, metronomeEnabled: false, mode: 'pattern', loopSong: false, lastSongSlot: null, getTracksForSlot: () => [track('channel-a', [0, 1]), track('channel-b', [0])] }
  sequencer.start(() => config)
  assert.deepEqual(engine.scheduled.map((event) => event.channelId), ['channel-b'])
  assert.equal(engine.scheduled[0].inputVelocity, 0.8)
  assert.equal(new Set(engine.scheduled[0].harmonicVelocity).size > 1, true)
  assert.deepEqual(engine.scheduled[0].performance, defaultChordPerformance)
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
  scheduled: Array<{ channelId: string; when: number; off: number; inputVelocity: number; harmonicVelocity: number[]; performance: typeof defaultChordPerformance }> = []
  getCurrentTime(): number { return this.now }
  releaseSequencerChordAt(_groupId: string, when: number): void { this.releases.push(when) }
  scheduleSynthChord(_groupId: string, channelId: string, _patch: unknown, voices: ReturnType<typeof voicedChord>, performance: typeof defaultChordPerformance, when: number, off: number, inputVelocity: number): void { this.scheduled.push({ channelId, when, off, inputVelocity, harmonicVelocity: voices.map((voice) => voice.harmonicVelocity), performance }) }
  scheduleSynthPad(): void {}
  scheduleStringsPad(): void {}
  scheduleStringsChord(): void {}
  schedulePolyChord(): void {}
  scheduleSample(): void {}
  stopSequencerChokeGroupAt(): void {}
  scheduleMetronome(): void {}
}

function fakePads() {
  return Array.from({ length: 16 }, (_, index) => ({ id: `pad-${index + 1}`, pitchSemitones: index })) as never[]
}

function scalarSynthGroup(scale: ProjectKey['scale']) {
  const padIds = Array.from({ length: 16 }, (_, index) => `pad-${String(index + 1).padStart(2, '0')}`)
  const group = createPatternGroup('group-1', 1, padIds)
  group.synthPatches = [{ ...createDefaultSynthPatch('patch'), mode: 'poly5' }]
  group.bank.pads = group.bank.pads.map((pad, index) => ({
    ...pad,
    synthPatchId: 'patch',
    pitchSemitones: getScalePitchOffsets(scale, 16)[index],
  }))
  return group
}

function suggestionGroup(scale: ProjectKey['scale']) {
  return scalarSynthGroup(scale)
}

function voicedChord(type: ChordType, key: ProjectKey, baseMidiNote: number, pitchSemitones = 0) {
  const group = suggestionGroup(key.scale)
  group.synthPatches = [{ ...group.synthPatches[0], baseMidiNote }]
  const pad = { ...group.bank.pads[0], synthPatchId: group.synthPatches[0].id, pitchSemitones }
  return resolveChordVoicing(group, pad, { type }, key)
}

function suggestionTypes(key: ProjectKey, pitchSemitones: number): ChordType[] {
  const group = suggestionGroup(key.scale)
  const pad = { ...group.bank.pads[0], pitchSemitones }
  return chordSuggestions(group, pad, key).map((suggestion) => suggestion.type)
}

function assertSuggestionFamily(key: ProjectKey, pitchSemitones: number, expected: readonly ChordType[]): void {
  const actual = suggestionTypes(key, pitchSemitones)
  for (const type of expected) assert.equal(actual.includes(type), true, `${key.scale} degree ${pitchSemitones} should suggest ${type}; got ${actual.join(', ')}`)
}
