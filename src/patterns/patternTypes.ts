import type { SampleId } from '../audio/AudioEngine'
import type { EffectRackState } from '../audio/effects'
import type { PadBankState } from '../pads/padBank'
import type { SynthPatch } from '../synth/synthTypes'
import type { StringsPatch } from '../strings/stringsTypes'
import type { OrganicBassPatch } from '../organic-bass/organicBassTypes'
import type { PolyPatch } from '../poly/polyTypes'
import type { ChordAssignment } from '../music/chords'

export const patternVariantNames = ['A', 'B', 'C', 'D'] as const
export const maximumPatternGroups = 8

export type PatternVariantName = typeof patternVariantNames[number]
export type PadMode = 'notes' | 'chords'
export type StepPattern = Record<SampleId, number[]>
export type StepShiftPattern = Record<SampleId, number[]>
/**
 * Event span in whole grid steps. An ordinary active cell stores `1`. A merged
 * event stores its full span on the first active cell; the following active
 * cells remain in the grid but do not trigger independently. Inactive cells
 * store `0`. A legacy sample event may retain `0` to preserve its historical
 * unbounded one-shot playback while still resolving as one grid step.
 */
export type StepLengthPattern = Record<SampleId, number[]>

export interface GroupBusState {
  volume: number
  muted: boolean
  solo: boolean
}

export interface PatternGroup {
  id: string
  name: string
  bank: PadBankState
  bus?: GroupBusState
  effects: EffectRackState
  synthPatches: SynthPatch[]
  stringsPatches: StringsPatch[]
  organicBassPatches: OrganicBassPatch[]
  polyPatches: PolyPatch[]
  padMode: PadMode
  chordAssignments: Array<ChordAssignment | null>
  variants: Partial<Record<PatternVariantName, StepPattern>>
  shifts: Partial<Record<PatternVariantName, StepShiftPattern>>
  lengths: Partial<Record<PatternVariantName, StepLengthPattern>>
}

export function isPatternVariantName(value: unknown): value is PatternVariantName {
  return typeof value === 'string' && patternVariantNames.includes(value as PatternVariantName)
}
