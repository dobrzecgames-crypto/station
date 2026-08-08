import type { SampleId } from '../audio/AudioEngine'
import type { EffectRackState } from '../audio/effects'
import type { PadBankState } from '../pads/padBank'
import type { SynthPatch } from '../synth/synthTypes'
import type { StringsPatch } from '../strings/stringsTypes'
import type { OrganicBassPatch } from '../organic-bass/organicBassTypes'
import type { ChordAssignment } from '../music/chords'

export const patternVariantNames = ['A', 'B', 'C', 'D'] as const
export const maximumPatternGroups = 8

export type PatternVariantName = typeof patternVariantNames[number]
export type PadMode = 'notes' | 'chords'
export type StepPattern = Record<SampleId, number[]>
export type StepShiftPattern = Record<SampleId, number[]>
/**
 * Step length in whole steps. `0` means "unbounded" - a sample step plays its
 * full configured region uncut, which only means something for sample pads;
 * a MONOPOLY or STRINGS step always has a concrete duration, so its length is
 * never 0.
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
  padMode: PadMode
  chordAssignments: Array<ChordAssignment | null>
  variants: Partial<Record<PatternVariantName, StepPattern>>
  shifts: Partial<Record<PatternVariantName, StepShiftPattern>>
  lengths: Partial<Record<PatternVariantName, StepLengthPattern>>
}

export function isPatternVariantName(value: unknown): value is PatternVariantName {
  return typeof value === 'string' && patternVariantNames.includes(value as PatternVariantName)
}
