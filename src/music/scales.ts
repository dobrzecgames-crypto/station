export const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export type NoteName = typeof noteNames[number]

export const scaleIds = [
  'chromatic',
  'major',
  'naturalMinor',
  'harmonicMinor',
  'melodicMinor',
  'majorPentatonic',
  'minorPentatonic',
  'blues',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
] as const

export type ScaleId = typeof scaleIds[number]

export interface ScaleDefinition {
  id: ScaleId
  label: string
  intervals: readonly number[]
}

export interface ProjectKey {
  root: NoteName
  scale: ScaleId
}

export const defaultProjectKey: ProjectKey = { root: 'C', scale: 'naturalMinor' }

export const scaleDefinitions: Record<ScaleId, ScaleDefinition> = {
  chromatic: { id: 'chromatic', label: 'CHROMATIC', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  major: { id: 'major', label: 'MAJOR / IONIAN', intervals: [0, 2, 4, 5, 7, 9, 11] },
  naturalMinor: { id: 'naturalMinor', label: 'MINOR / AEOLIAN', intervals: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor: { id: 'harmonicMinor', label: 'HARMONIC MINOR', intervals: [0, 2, 3, 5, 7, 8, 11] },
  melodicMinor: { id: 'melodicMinor', label: 'MELODIC MINOR', intervals: [0, 2, 3, 5, 7, 9, 11] },
  majorPentatonic: { id: 'majorPentatonic', label: 'MAJOR PENTATONIC', intervals: [0, 2, 4, 7, 9] },
  minorPentatonic: { id: 'minorPentatonic', label: 'MINOR PENTATONIC', intervals: [0, 3, 5, 7, 10] },
  blues: { id: 'blues', label: 'BLUES', intervals: [0, 3, 5, 6, 7, 10] },
  dorian: { id: 'dorian', label: 'DORIAN', intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { id: 'phrygian', label: 'PHRYGIAN', intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { id: 'lydian', label: 'LYDIAN', intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { id: 'mixolydian', label: 'MIXOLYDIAN', intervals: [0, 2, 4, 5, 7, 9, 10] },
  locrian: { id: 'locrian', label: 'LOCRIAN', intervals: [0, 1, 3, 5, 6, 8, 10] },
}

export function getScalePitchOffsets(scaleId: ScaleId, count: number): number[] {
  const intervals = scaleDefinitions[scaleId].intervals
  return Array.from({ length: Math.max(0, count) }, (_, index) => intervals[index % intervals.length] + Math.floor(index / intervals.length) * 12)
}

export function isNoteName(value: unknown): value is NoteName {
  return typeof value === 'string' && noteNames.includes(value as NoteName)
}

export function isScaleId(value: unknown): value is ScaleId {
  return typeof value === 'string' && scaleIds.includes(value as ScaleId)
}

export function formatProjectKey(projectKey: ProjectKey): string {
  return `${projectKey.root} ${scaleDefinitions[projectKey.scale].label}`
}
