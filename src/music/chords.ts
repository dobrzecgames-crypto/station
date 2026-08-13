import type { PadState } from '../pads/types'
import type { PatternGroup } from '../patterns/patternTypes'
import { noteNames, scaleDefinitions } from './scales.ts'
import type { ProjectKey } from './scales'

export const chordTypes = [
  'major', 'minor', 'diminished', 'augmented', 'sus2', 'sus4', 'power',
  'major6', 'minor6', 'dominant7', 'major7', 'minor7', 'halfDiminished7',
  'diminished7', 'add9', 'minorAdd9', 'major9', 'minor9', 'dominant9',
  'major69', 'minor69', 'minor11', 'dominant13', 'minor13',
  'minorFlat9', 'susFlat9', 'minorFlat13', 'major7Sharp11', 'major9Sharp11',
  'rootOctave',
] as const

export type ChordType = typeof chordTypes[number]
export interface ChordAssignment { type: ChordType }

export type ChordToneRole = 'root' | 'third' | 'seventh' | 'characteristic' | 'extension' | 'fifth' | 'other'

export interface ChordVoice {
  midiNote: number
  interval: number
  role: ChordToneRole
  isChromatic: boolean
  /** Deterministic harmonic hierarchy. Input velocity is applied at playback. */
  harmonicVelocity: number
}

interface ChordDefinition {
  type: ChordType
  suffix: string
  intervals: readonly number[]
}

type TriadQuality = 'major' | 'minor' | 'diminished' | 'augmented' | 'none'

interface HarmonicContext {
  projectKey: ProjectKey
  degreeIndex: number
  relativePitchClasses: ReadonlySet<number>
  triadQuality: TriadQuality
  seventhInterval: number | null
  isHeptatonic: boolean
}

export interface ChordSuggestion extends ChordAssignment {
  name: string
  intervals: readonly number[]
  midiNotes: readonly number[]
  noteNames: readonly string[]
}

const definitions: readonly ChordDefinition[] = [
  { type: 'major', suffix: '', intervals: [0, 4, 7] },
  { type: 'minor', suffix: 'm', intervals: [0, 3, 7] },
  { type: 'diminished', suffix: 'dim', intervals: [0, 3, 6] },
  { type: 'augmented', suffix: 'aug', intervals: [0, 4, 8] },
  { type: 'sus2', suffix: 'sus2', intervals: [0, 2, 7] },
  { type: 'sus4', suffix: 'sus4', intervals: [0, 5, 7] },
  { type: 'power', suffix: '5', intervals: [0, 7] },
  { type: 'dominant7', suffix: '7', intervals: [0, 4, 7, 10] },
  { type: 'major7', suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { type: 'minor7', suffix: 'm7', intervals: [0, 3, 7, 10] },
  { type: 'halfDiminished7', suffix: 'm7b5', intervals: [0, 3, 6, 10] },
  { type: 'diminished7', suffix: 'dim7', intervals: [0, 3, 6, 9] },
  { type: 'major6', suffix: '6', intervals: [0, 4, 7, 9] },
  { type: 'minor6', suffix: 'm6', intervals: [0, 3, 7, 9] },
  { type: 'add9', suffix: 'add9', intervals: [0, 4, 7, 14] },
  { type: 'minorAdd9', suffix: 'madd9', intervals: [0, 3, 7, 14] },
  { type: 'major9', suffix: 'maj9', intervals: [0, 4, 7, 11, 14] },
  { type: 'minor9', suffix: 'm9', intervals: [0, 3, 7, 10, 14] },
  { type: 'dominant9', suffix: '9', intervals: [0, 4, 7, 10, 14] },
  { type: 'major69', suffix: '6/9', intervals: [0, 4, 7, 9, 14] },
  { type: 'minor69', suffix: 'm6/9', intervals: [0, 3, 7, 9, 14] },
  { type: 'minor11', suffix: 'm11', intervals: [0, 3, 10, 17] },
  { type: 'dominant13', suffix: '13', intervals: [0, 4, 10, 14, 21] },
  { type: 'minor13', suffix: 'm13', intervals: [0, 3, 10, 14, 21] },
  { type: 'minorFlat9', suffix: 'm7(b9)', intervals: [0, 3, 7, 10, 13] },
  { type: 'susFlat9', suffix: 'sus(b9)', intervals: [0, 5, 7, 13] },
  { type: 'minorFlat13', suffix: 'm7(b13)', intervals: [0, 3, 10, 14, 20] },
  { type: 'major7Sharp11', suffix: 'maj7#11', intervals: [0, 4, 7, 11, 18] },
  { type: 'major9Sharp11', suffix: 'maj9#11', intervals: [0, 4, 11, 14, 18] },
  { type: 'rootOctave', suffix: ' OCT', intervals: [0, 12] },
]

const definitionByType = new Map(definitions.map((definition) => [definition.type, definition]))
const definitionOrder = new Map(definitions.map((definition, index) => [definition.type, index]))
const maximumSuggestions = 8
export const maximumChordVoices = 5

export function isChordType(value: unknown): value is ChordType {
  return typeof value === 'string' && chordTypes.includes(value as ChordType)
}

export function chordIntervals(type: ChordType): readonly number[] {
  return definitionByType.get(type)!.intervals
}

export function scalePitchClasses(projectKey: ProjectKey): Set<number> {
  const root = noteNames.indexOf(projectKey.root)
  return new Set(scaleDefinitions[projectKey.scale].intervals.map((interval) => modulo12(root + interval)))
}

export function padRootPitchClass(pad: Pick<PadState, 'pitchSemitones'>, projectKey: ProjectKey): number {
  return modulo12(noteNames.indexOf(projectKey.root) + pad.pitchSemitones)
}

export function isChordCompatible(type: ChordType, pad: Pick<PadState, 'pitchSemitones'>, projectKey: ProjectKey): boolean {
  if (type === 'rootOctave') return false
  const allowed = scalePitchClasses(projectKey)
  const root = padRootPitchClass(pad, projectKey)
  return chordIntervals(type).every((interval) => allowed.has(modulo12(root + interval)))
}

export function createChordAssignments(pads: readonly PadState[], projectKey: ProjectKey, current?: readonly (ChordAssignment | null)[]): Array<ChordAssignment | null> {
  const occurrences = new Map<number, number>()
  return pads.map((pad, index) => {
    const pitchClass = padRootPitchClass(pad, projectKey)
    const occurrence = occurrences.get(pitchClass) ?? 0
    occurrences.set(pitchClass, occurrence + 1)
    const existing = current?.[index]
    if (existing && existing.type !== 'rootOctave' && harmonicDefinitions(pad, projectKey).some((definition) => definition.type === existing.type)) return { ...existing }
    const type = defaultChordType(pad, projectKey, occurrence)
    return type ? { type } : null
  })
}

export function chordSuggestions(group: PatternGroup, pad: PadState, projectKey: ProjectKey, current?: ChordAssignment): ChordSuggestion[] {
  const rootMidi = chordRootMidiNote(group, pad, projectKey)
  const ranked = harmonicDefinitions(pad, projectKey).slice(0, maximumSuggestions)
  const currentDefinition = current?.type === 'rootOctave' ? undefined : definitionByType.get(current?.type as ChordType)
  if (currentDefinition && !ranked.some((definition) => definition.type === currentDefinition.type)) {
    if (ranked.length === maximumSuggestions) ranked[ranked.length - 1] = currentDefinition
    else ranked.push(currentDefinition)
  }
  return ranked.map((definition) => suggestion(definition, rootMidi, projectKey))
}

export function resolveChordMidiNotes(group: PatternGroup, pad: PadState, assignment: ChordAssignment, projectKey: ProjectKey): number[] {
  return resolveChordVoicing(group, pad, assignment, projectKey).map((voice) => voice.midiNote)
}

export function resolveChordVoicing(group: PatternGroup, pad: PadState, assignment: ChordAssignment, projectKey: ProjectKey): ChordVoice[] {
  const rootMidi = chordRootMidiNote(group, pad, projectKey)
  return resolveDefinitionVoicing(definitionByType.get(assignment.type)!, rootMidi, projectKey)
}

function resolveDefinitionVoicing(definition: ChordDefinition, rootMidi: number, projectKey: ProjectKey): ChordVoice[] {
  const scale = scalePitchClasses(projectKey)
  const rootPitchClass = modulo12(rootMidi)
  const tones = definition.intervals.map((interval, definitionIndex) => {
    const role = chordToneRole(definition.type, interval)
    const isChromatic = !scale.has(modulo12(rootPitchClass + interval))
    return { interval, definitionIndex, role, isChromatic, importance: toneImportance(role) }
  })
  const selected = tones
    .sort((left, right) => right.importance - left.importance || left.definitionIndex - right.definitionIndex)
    .slice(0, maximumChordVoices)
  const voicedNotes = voiceSelectedTones(rootMidi, selected)
  return selected
    .map((tone) => ({
      midiNote: voicedNotes.get(tone.definitionIndex)!,
      interval: tone.interval,
      role: tone.role,
      isChromatic: tone.isChromatic,
      harmonicVelocity: harmonicVelocity(tone.role, tone.isChromatic),
    }))
    .sort((left, right) => left.midiNote - right.midiNote)
}

export function scaleChordVoiceVelocity(inputVelocity: number, harmonicVelocity: number): number {
  return clamp01(inputVelocity) * clamp01(harmonicVelocity)
}

export function formatChordAssignment(group: PatternGroup, pad: PadState, assignment: ChordAssignment, projectKey: ProjectKey): string {
  return suggestion(definitionByType.get(assignment.type)!, chordRootMidiNote(group, pad, projectKey), projectKey).name
}

export function chordRootMidiNote(group: PatternGroup, pad: PadState, projectKey: ProjectKey): number {
  const synth = pad.synthPatchId ? group.synthPatches.find((patch) => patch.id === pad.synthPatchId) : undefined
  const strings = pad.stringsPatchId ? group.stringsPatches.find((patch) => patch.id === pad.stringsPatchId) : undefined
  const poly = pad.polyPatchId ? group.polyPatches.find((patch) => patch.id === pad.polyPatchId) : undefined
  const sourceBase = synth?.baseMidiNote ?? strings?.baseMidiNote ?? poly?.baseMidiNote ?? 36
  const octaveOffset = strings?.octave ? strings.octave * 12 : 0
  const projectRoot = noteNames.indexOf(projectKey.root)
  return Math.floor(sourceBase / 12) * 12 + projectRoot + pad.pitchSemitones + octaveOffset
}

export function formatMidiNoteName(midiNote: number): string {
  const rounded = Math.round(midiNote)
  return `${noteNames[modulo12(rounded)]}${Math.floor(rounded / 12) - 1}`
}

function defaultChordType(pad: Pick<PadState, 'pitchSemitones'>, projectKey: ProjectKey, occurrence: number): ChordType | null {
  const candidates = harmonicDefinitions(pad, projectKey)
  return candidates[Math.min(occurrence, candidates.length - 1)]?.type ?? null
}

function harmonicDefinitions(pad: Pick<PadState, 'pitchSemitones'>, projectKey: ProjectKey): ChordDefinition[] {
  const context = analyzeHarmonicContext(pad, projectKey)
  if (!context) return []
  const priority = chordTypePriority(context)
  return definitions
    .filter((definition) => definition.type !== 'rootOctave' && (isDiatonicDefinition(definition, context) || hasExplicitChromaticRole(definition.type, context)))
    .sort((left, right) => candidateRank(left, priority) - candidateRank(right, priority))
}

function analyzeHarmonicContext(pad: Pick<PadState, 'pitchSemitones'>, projectKey: ProjectKey): HarmonicContext | null {
  const scale = scaleDefinitions[projectKey.scale].intervals
  const rootOffset = modulo12(pad.pitchSemitones)
  const degreeIndex = scale.findIndex((interval) => modulo12(interval) === rootOffset)
  if (degreeIndex < 0) return null
  const relativePitchClasses = new Set(scale.map((interval) => modulo12(interval - rootOffset)))
  const isHeptatonic = scale.length === 7
  const third = isHeptatonic ? diatonicInterval(scale, degreeIndex, 2) : relativePitchClasses.has(4) ? 4 : relativePitchClasses.has(3) ? 3 : null
  const fifth = isHeptatonic ? diatonicInterval(scale, degreeIndex, 4) : relativePitchClasses.has(7) ? 7 : relativePitchClasses.has(6) ? 6 : relativePitchClasses.has(8) ? 8 : null
  const seventhInterval = isHeptatonic ? diatonicInterval(scale, degreeIndex, 6) : relativePitchClasses.has(11) ? 11 : relativePitchClasses.has(10) ? 10 : relativePitchClasses.has(9) ? 9 : null
  return { projectKey, degreeIndex, relativePitchClasses, triadQuality: triadQuality(third, fifth), seventhInterval, isHeptatonic }
}

function chordTypePriority(context: HarmonicContext): readonly ChordType[] {
  if (context.degreeIndex === 0) {
    if (context.projectKey.scale === 'dorian') return ['minor6', 'minor69', 'minor13', 'minor9', 'minor11', 'minor7', 'minorAdd9', 'minor']
    if (context.projectKey.scale === 'phrygian') return ['minorFlat9', 'susFlat9', 'minor11', 'minor7', 'minorFlat13', 'minor', 'sus4', 'power']
    if (context.projectKey.scale === 'lydian') return ['major7Sharp11', 'major9Sharp11', 'major9', 'major7', 'major69', 'major6', 'add9', 'major']
    if (context.projectKey.scale === 'naturalMinor') return ['minor9', 'minor11', 'minor7', 'minorFlat13', 'minorAdd9', 'minor', 'sus4', 'power']
  }
  if (context.projectKey.scale === 'naturalMinor' && context.degreeIndex === 4) {
    return ['minor9', 'minor11', 'minor7', 'minorAdd9', 'minor', 'dominant9', 'dominant7', 'sus4']
  }
  if (context.triadQuality === 'diminished') return context.seventhInterval === 10
    ? ['halfDiminished7', 'diminished', 'diminished7']
    : ['diminished7', 'diminished', 'halfDiminished7']
  if (context.triadQuality === 'augmented') return ['augmented', 'major', 'major7', 'major9']
  if (context.triadQuality === 'minor') {
    if (!context.isHeptatonic) return ['minor11', 'minor7', 'minor', 'minorAdd9', 'minor9', 'minor6', 'minor69', 'minor13']
    return ['minor9', 'minor11', 'minor7', 'minorAdd9', 'minor', 'minor6', 'minor69', 'minor13', 'minorFlat13', 'minorFlat9']
  }
  if (context.triadQuality === 'major') {
    if (context.seventhInterval === 10) return ['dominant9', 'dominant13', 'dominant7', 'major69', 'major6', 'add9', 'major', 'sus2']
    if (context.seventhInterval === 11) return ['major9', 'major7', 'major69', 'major6', 'add9', 'major', 'sus2', 'power']
    if (!context.isHeptatonic) return ['major69', 'major6', 'add9', 'major', 'sus2', 'power', 'major9', 'major7']
    return ['add9', 'major69', 'major6', 'major', 'sus2', 'power', 'major9', 'major7']
  }
  return ['sus2', 'sus4', 'minor11', 'power', 'minor7', 'dominant7', 'major6', 'minor6']
}

function candidateRank(definition: ChordDefinition, priority: readonly ChordType[]): number {
  const preferredIndex = priority.indexOf(definition.type)
  return preferredIndex >= 0 ? preferredIndex : 100 + (definitionOrder.get(definition.type) ?? 0)
}

function isDiatonicDefinition(definition: ChordDefinition, context: HarmonicContext): boolean {
  return definition.intervals.every((interval) => context.relativePitchClasses.has(modulo12(interval)))
}

/** The first engine version exposes one deliberate chromatic colour: the
    raised-third dominant on Aeolian's V degree, borrowed from harmonic minor.
    It is ranked behind the native minor-family choices. */
function hasExplicitChromaticRole(type: ChordType, context: HarmonicContext): boolean {
  return context.projectKey.scale === 'naturalMinor'
    && context.degreeIndex === 4
    && (type === 'dominant7' || type === 'dominant9')
}

function diatonicInterval(scale: readonly number[], degreeIndex: number, degreeSteps: number): number {
  const target = degreeIndex + degreeSteps
  return scale[target % scale.length] + Math.floor(target / scale.length) * 12 - scale[degreeIndex]
}

function triadQuality(third: number | null, fifth: number | null): TriadQuality {
  if (third === 4 && fifth === 7) return 'major'
  if (third === 3 && fifth === 7) return 'minor'
  if (third === 3 && fifth === 6) return 'diminished'
  if (third === 4 && fifth === 8) return 'augmented'
  return 'none'
}

function suggestion(definition: ChordDefinition, rootMidi: number, projectKey: ProjectKey): ChordSuggestion {
  const midiNotes = resolveDefinitionVoicing(definition, rootMidi, projectKey).map((voice) => voice.midiNote)
  const rootName = noteNames[modulo12(rootMidi)]
  return { type: definition.type, name: `${rootName}${definition.suffix}`, intervals: definition.intervals, midiNotes, noteNames: midiNotes.map((note) => noteNames[modulo12(note)]) }
}

function voiceSelectedTones(
  rootMidi: number,
  tones: readonly { interval: number; definitionIndex: number; role: ChordToneRole }[],
): Map<number, number> {
  const offsets = rootMidi < 48
    ? lowRegisterOffsets(tones)
    : rootMidi >= 72
      ? highRegisterOffsets(tones)
      : middleRegisterOffsets(tones)
  const fitted = fitMidiRange(offsets.map((entry) => rootMidi + entry.offset))
  return new Map(offsets.map((entry, index) => [entry.definitionIndex, fitted[index]]))
}

function lowRegisterOffsets(tones: readonly { interval: number; definitionIndex: number; role: ChordToneRole }[]) {
  return tones.map((tone) => {
    const pitchClass = modulo12(tone.interval)
    if (tone.role === 'root') return { definitionIndex: tone.definitionIndex, offset: 0 }
    if (tone.role === 'fifth' && pitchClass === 7) return { definitionIndex: tone.definitionIndex, offset: 7 }
    let offset = pitchClass
    while (offset < 18) offset += 12
    return { definitionIndex: tone.definitionIndex, offset }
  })
}

function middleRegisterOffsets(tones: readonly { interval: number; definitionIndex: number; role: ChordToneRole }[]) {
  const hasUpperColour = tones.some((tone) => tone.interval >= 12 || [1, 2, 5, 6].includes(modulo12(tone.interval)))
  return tones.map((tone) => {
    const pitchClass = modulo12(tone.interval)
    if (tone.role === 'root') return { definitionIndex: tone.definitionIndex, offset: 0 }
    if (tone.role === 'third' && hasUpperColour) return { definitionIndex: tone.definitionIndex, offset: pitchClass + 12 }
    if (tone.interval >= 12) return { definitionIndex: tone.definitionIndex, offset: pitchClass + 12 }
    return { definitionIndex: tone.definitionIndex, offset: pitchClass }
  })
}

function highRegisterOffsets(tones: readonly { interval: number; definitionIndex: number }[]) {
  return tones.map((tone) => {
    const pitchClass = modulo12(tone.interval)
    return { definitionIndex: tone.definitionIndex, offset: pitchClass > 6 ? pitchClass - 12 : pitchClass }
  })
}

function chordToneRole(type: ChordType, interval: number): ChordToneRole {
  const pitchClass = modulo12(interval)
  if (pitchClass === 0) return 'root'
  if (characteristicPitchClasses(type).includes(pitchClass)) return 'characteristic'
  if (pitchClass === 3 || pitchClass === 4) return 'third'
  if (pitchClass === 10 || pitchClass === 11) return 'seventh'
  if (pitchClass === 7) return 'fifth'
  if ([1, 2, 5, 6, 8, 9].includes(pitchClass)) return 'extension'
  return 'other'
}

function characteristicPitchClasses(type: ChordType): readonly number[] {
  switch (type) {
    case 'diminished': case 'halfDiminished7': return [6]
    case 'diminished7': return [6, 9]
    case 'augmented': return [8]
    case 'sus2': return [2]
    case 'sus4': return [5]
    case 'minor6': case 'minor69': case 'minor13': case 'dominant13': case 'major6': case 'major69': return [9]
    case 'minor11': return [5]
    case 'minorFlat9': case 'susFlat9': return [1]
    case 'minorFlat13': return [8]
    case 'major7Sharp11': case 'major9Sharp11': return [6]
    default: return []
  }
}

function toneImportance(role: ChordToneRole): number {
  switch (role) {
    case 'root': return 100
    case 'characteristic': return 98
    case 'third': return 94
    case 'seventh': return 92
    case 'extension': return 84
    case 'fifth': return 76
    default: return 80
  }
}

function harmonicVelocity(role: ChordToneRole, isChromatic: boolean): number {
  const roleWeight = role === 'root' ? 1
    : role === 'seventh' ? 0.94
      : role === 'third' ? 0.92
        : role === 'characteristic' ? 0.9
          : role === 'fifth' ? 0.82
            : role === 'extension' ? 0.84
              : 0.86
  return roundVelocity(roleWeight * (isChromatic ? 0.82 : 1))
}

function fitMidiRange(notes: readonly number[]): number[] {
  if (notes.length === 0) return []
  let shift = 0
  while (Math.max(...notes) + shift > 108) shift -= 12
  while (Math.min(...notes) + shift < 12) shift += 12
  return notes.map((note) => note + shift)
}

function modulo12(value: number): number {
  return ((Math.round(value) % 12) + 12) % 12
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function roundVelocity(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000
}
