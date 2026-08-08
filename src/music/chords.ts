import type { PadState } from '../pads/types'
import type { PatternGroup } from '../patterns/patternTypes'
import { noteNames, scaleDefinitions } from './scales.ts'
import type { ProjectKey } from './scales'

export const chordTypes = [
  'major', 'minor', 'diminished', 'augmented', 'sus2', 'sus4', 'power',
  'major6', 'minor6', 'dominant7', 'major7', 'minor7', 'halfDiminished7',
  'diminished7', 'add9', 'minorAdd9', 'major9', 'minor9', 'dominant9',
  'rootOctave',
] as const

export type ChordType = typeof chordTypes[number]
export interface ChordAssignment { type: ChordType }

interface ChordDefinition {
  type: ChordType
  suffix: string
  intervals: readonly number[]
  richness: 0 | 1 | 2 | 3
}

export interface ChordSuggestion extends ChordAssignment {
  name: string
  intervals: readonly number[]
  midiNotes: readonly number[]
  noteNames: readonly string[]
}

const definitions: readonly ChordDefinition[] = [
  { type: 'major', suffix: '', intervals: [0, 4, 7], richness: 0 },
  { type: 'minor', suffix: 'm', intervals: [0, 3, 7], richness: 0 },
  { type: 'diminished', suffix: 'dim', intervals: [0, 3, 6], richness: 0 },
  { type: 'augmented', suffix: 'aug', intervals: [0, 4, 8], richness: 0 },
  { type: 'sus2', suffix: 'sus2', intervals: [0, 2, 7], richness: 0 },
  { type: 'sus4', suffix: 'sus4', intervals: [0, 5, 7], richness: 0 },
  { type: 'power', suffix: '5', intervals: [0, 7], richness: 0 },
  { type: 'dominant7', suffix: '7', intervals: [0, 4, 7, 10], richness: 1 },
  { type: 'major7', suffix: 'maj7', intervals: [0, 4, 7, 11], richness: 1 },
  { type: 'minor7', suffix: 'm7', intervals: [0, 3, 7, 10], richness: 1 },
  { type: 'halfDiminished7', suffix: 'm7b5', intervals: [0, 3, 6, 10], richness: 1 },
  { type: 'diminished7', suffix: 'dim7', intervals: [0, 3, 6, 9], richness: 1 },
  { type: 'major6', suffix: '6', intervals: [0, 4, 7, 9], richness: 2 },
  { type: 'minor6', suffix: 'm6', intervals: [0, 3, 7, 9], richness: 2 },
  { type: 'add9', suffix: 'add9', intervals: [0, 4, 7, 14], richness: 2 },
  { type: 'minorAdd9', suffix: 'madd9', intervals: [0, 3, 7, 14], richness: 2 },
  { type: 'major9', suffix: 'maj9', intervals: [0, 4, 7, 11, 14], richness: 3 },
  { type: 'minor9', suffix: 'm9', intervals: [0, 3, 7, 10, 14], richness: 3 },
  { type: 'dominant9', suffix: '9', intervals: [0, 4, 7, 10, 14], richness: 3 },
  { type: 'rootOctave', suffix: ' OCT', intervals: [0, 12], richness: 0 },
]

const definitionByType = new Map(definitions.map((definition) => [definition.type, definition]))

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
  const allowed = scalePitchClasses(projectKey)
  const root = padRootPitchClass(pad, projectKey)
  return chordIntervals(type).every((interval) => allowed.has(modulo12(root + interval)))
}

export function createChordAssignments(pads: readonly PadState[], projectKey: ProjectKey, current?: readonly (ChordAssignment | null)[]): ChordAssignment[] {
  const occurrences = new Map<number, number>()
  return pads.map((pad, index) => {
    const pitchClass = padRootPitchClass(pad, projectKey)
    const occurrence = occurrences.get(pitchClass) ?? 0
    occurrences.set(pitchClass, occurrence + 1)
    const existing = current?.[index]
    if (existing && isChordCompatible(existing.type, pad, projectKey)) return { ...existing }
    return { type: defaultChordType(pad, projectKey, occurrence) }
  })
}

export function chordSuggestions(group: PatternGroup, pad: PadState, projectKey: ProjectKey): ChordSuggestion[] {
  const rootMidi = chordRootMidiNote(group, pad, projectKey)
  return compatibleDefinitions(pad, projectKey).map((definition) => suggestion(definition, rootMidi))
}

export function resolveChordMidiNotes(group: PatternGroup, pad: PadState, assignment: ChordAssignment, projectKey: ProjectKey): number[] {
  const rootMidi = chordRootMidiNote(group, pad, projectKey)
  return fitMidiRange(chordIntervals(assignment.type).map((interval) => rootMidi + interval))
}

export function formatChordAssignment(group: PatternGroup, pad: PadState, assignment: ChordAssignment, projectKey: ProjectKey): string {
  return suggestion(definitionByType.get(assignment.type)!, chordRootMidiNote(group, pad, projectKey)).name
}

export function chordRootMidiNote(group: PatternGroup, pad: PadState, projectKey: ProjectKey): number {
  const synth = pad.synthPatchId ? group.synthPatches.find((patch) => patch.id === pad.synthPatchId) : undefined
  const strings = pad.stringsPatchId ? group.stringsPatches.find((patch) => patch.id === pad.stringsPatchId) : undefined
  const sourceBase = synth?.baseMidiNote ?? strings?.baseMidiNote ?? 36
  const octaveOffset = strings?.octave ? strings.octave * 12 : 0
  const projectRoot = noteNames.indexOf(projectKey.root)
  return Math.floor(sourceBase / 12) * 12 + projectRoot + pad.pitchSemitones + octaveOffset
}

export function formatMidiNoteName(midiNote: number): string {
  const rounded = Math.round(midiNote)
  return `${noteNames[modulo12(rounded)]}${Math.floor(rounded / 12) - 1}`
}

function defaultChordType(pad: Pick<PadState, 'pitchSemitones'>, projectKey: ProjectKey, occurrence: number): ChordType {
  const compatible = compatibleDefinitions(pad, projectKey)
  const desiredRichness = Math.min(3, occurrence) as 0 | 1 | 2 | 3
  return compatible.find((definition) => definition.richness === desiredRichness)?.type
    ?? compatible.find((definition) => definition.richness > desiredRichness)?.type
    ?? compatible.at(-1)?.type
    ?? 'rootOctave'
}

function compatibleDefinitions(pad: Pick<PadState, 'pitchSemitones'>, projectKey: ProjectKey): readonly ChordDefinition[] {
  const compatible = definitions.filter((definition) => isChordCompatible(definition.type, pad, projectKey))
  const named = compatible.filter((definition) => definition.type !== 'rootOctave')
  return named.length > 0 ? named : compatible
}

function suggestion(definition: ChordDefinition, rootMidi: number): ChordSuggestion {
  const midiNotes = fitMidiRange(definition.intervals.map((interval) => rootMidi + interval))
  const rootName = noteNames[modulo12(rootMidi)]
  return { type: definition.type, name: `${rootName}${definition.suffix}`, intervals: definition.intervals, midiNotes, noteNames: midiNotes.map((note) => noteNames[modulo12(note)]) }
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
