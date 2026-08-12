import type { SampleAssetId, SampleId } from '../audio/AudioEngine'
import type { SynthPatchId } from '../synth/synthTypes'
import type { StringsPatchId } from '../strings/stringsTypes'
import type { OrganicBassPatchId } from '../organic-bass/organicBassTypes'
import type { PolyPatchId } from '../poly/polyTypes'

export interface ChannelState {
  id: SampleId
  volume: number
  muted: boolean
  solo: boolean
}

export interface SamplePlaybackRegion {
  startSeconds: number
  endSeconds: number
}

export interface SampleSlice extends SamplePlaybackRegion {
  id: string
  sourceAssetId: SampleAssetId
  /** Plays this slice's audio back to front. A property of this exact slice,
      not of the source sample - other slices of the same asset are unaffected. */
  reversed: boolean
}

export interface ChopSessionState {
  id: string
  assetId: SampleAssetId | null
  fileName: string | null
  durationSeconds: number | null
  slices: SampleSlice[]
  activeSliceId: string | null
  /** The source's base pitch. Applied to every pad newly mapped from this
      session; a pad already on the session keeps whatever pitch it has. */
  pitchSemitones: number
}

export interface PadState extends ChannelState {
  label: string
  assetId: SampleAssetId | null
  fileName: string | null
  durationSeconds: number | null
  region: SamplePlaybackRegion
  /** Plays this pad's region back to front. Mirrors the CHOP slice it was
      mapped from (see applyChopMapping) but can also be set directly on a
      pad with no live slice at all, the same way region can. */
  reversed: boolean
  slices: SampleSlice[]
  chopSessionId: string | null
  pitchSemitones: number
  /** Musical rise time for newly triggered pad voices. */
  attackMs: number
  /** End fade for newly triggered pad voices. Kept short for samples and slices. */
  releaseMs: number
  synthPatchId: SynthPatchId | null
  stringsPatchId: StringsPatchId | null
  organicBassPatchId: OrganicBassPatchId | null
  polyPatchId: PolyPatchId | null
  chordIntervals: number[]
}

export interface PadDefinition {
  id: SampleId
  keyCode: string
  keyLabel: string
  label: string
}
