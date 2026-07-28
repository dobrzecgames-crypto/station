import type { SampleAssetId, SampleId } from '../audio/AudioEngine'
import type { SynthPatchId } from '../synth/synthTypes'

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
  slices: SampleSlice[]
  chopSessionId: string | null
  pitchSemitones: number
  /** Musical rise time for newly triggered pad voices. */
  attackMs: number
  /** End fade for newly triggered pad voices. Kept short for samples and slices. */
  releaseMs: number
  synthPatchId: SynthPatchId | null
  chordIntervals: number[]
}

export interface PadDefinition {
  id: SampleId
  keyCode: string
  keyLabel: string
  label: string
}
