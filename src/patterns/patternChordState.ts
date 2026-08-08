import { createChordAssignments } from '../music/chords.ts'
import type { ChordAssignment } from '../music/chords.ts'
import type { ProjectKey } from '../music/scales.ts'
import type { PadState } from '../pads/types.ts'
import type { PadMode } from './patternTypes.ts'

export interface PatternChordFields {
  padMode: PadMode
  chordAssignments: Array<ChordAssignment | null>
}

export function normalizePatternChordFields(value: { padMode?: unknown; chordAssignments?: unknown }, padCount: number): PatternChordFields {
  const padMode = (value.padMode === undefined ? 'notes' : value.padMode) as PadMode
  const chordAssignments = value.chordAssignments === undefined
    ? Array(padCount).fill(null)
    : Array.isArray(value.chordAssignments)
      ? value.chordAssignments.map((assignment) => assignment && typeof assignment === 'object' ? { ...assignment } : assignment) as Array<ChordAssignment | null>
      : value.chordAssignments as Array<ChordAssignment | null>
  return { padMode, chordAssignments }
}

export function chordFieldsForMode(pads: readonly PadState[], current: PatternChordFields, mode: PadMode, projectKey: ProjectKey): PatternChordFields {
  return { padMode: mode, chordAssignments: mode === 'chords' ? createChordAssignments(pads, projectKey, current.chordAssignments) : cloneAssignments(current.chordAssignments) }
}

export function repairedChordFields(pads: readonly PadState[], current: PatternChordFields, projectKey: ProjectKey): PatternChordFields {
  if (current.padMode === 'notes' && current.chordAssignments.every((assignment) => assignment === null)) return { ...current, chordAssignments: cloneAssignments(current.chordAssignments) }
  return { ...current, chordAssignments: createChordAssignments(pads, projectKey, current.chordAssignments) }
}

export function chordFieldsWithAssignment(current: PatternChordFields, padIndex: number, assignment: ChordAssignment): PatternChordFields {
  if (padIndex < 0 || padIndex >= current.chordAssignments.length) throw new Error('Chord pad is invalid.')
  return { ...current, chordAssignments: current.chordAssignments.map((candidate, index) => index === padIndex ? { ...assignment } : candidate) }
}

function cloneAssignments(assignments: readonly (ChordAssignment | null)[]): Array<ChordAssignment | null> {
  return assignments.map((assignment) => assignment ? { ...assignment } : null)
}
