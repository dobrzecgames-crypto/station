import type { SampleId } from '../audio/AudioEngine'
import type { EffectRackState } from '../audio/effects'
import type { PadBankState } from '../pads/padBank'

export const patternVariantNames = ['A', 'B', 'C', 'D'] as const
export const maximumPatternGroups = 8

export type PatternVariantName = typeof patternVariantNames[number]
export type PatternRetriggerMode = 'layer' | 'cut-previous'
export type StepPattern = Record<SampleId, number[]>
export type StepShiftPattern = Record<SampleId, number[]>

export interface GroupBusState {
  volume: number
  muted: boolean
  solo: boolean
}

export interface PatternGroup {
  id: string
  name: string
  retriggerMode: PatternRetriggerMode
  bank: PadBankState
  bus?: GroupBusState
  effects: EffectRackState
  variants: Partial<Record<PatternVariantName, StepPattern>>
  shifts: Partial<Record<PatternVariantName, StepShiftPattern>>
}

export function isPatternVariantName(value: unknown): value is PatternVariantName {
  return typeof value === 'string' && patternVariantNames.includes(value as PatternVariantName)
}
