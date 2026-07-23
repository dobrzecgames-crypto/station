import type { SampleAssetId, SampleId } from '../audio/AudioEngine'

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

export interface PadState extends ChannelState {
  label: string
  assetId: SampleAssetId | null
  fileName: string | null
  durationSeconds: number | null
  region: SamplePlaybackRegion
  slices: SampleSlice[]
  chopSessionId: string | null
  pitchSemitones: number
}

export interface PadDefinition {
  id: SampleId
  keyCode: string
  keyLabel: string
  label: string
}
