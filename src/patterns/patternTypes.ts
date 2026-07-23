import type { SampleId } from '../audio/AudioEngine'

export const patternVariantNames = ['A', 'B', 'C', 'D'] as const
export const maximumPatternGroups = 8

export type PatternVariantName = typeof patternVariantNames[number]
export type StepPattern = Record<SampleId, number[]>
export type StepShiftPattern = Record<SampleId, number[]>

export interface PatternGroup {
  id: string
  name: string
  variants: Partial<Record<PatternVariantName, StepPattern>>
  shifts: Partial<Record<PatternVariantName, StepShiftPattern>>
}

export function isPatternVariantName(value: unknown): value is PatternVariantName {
  return typeof value === 'string' && patternVariantNames.includes(value as PatternVariantName)
}
