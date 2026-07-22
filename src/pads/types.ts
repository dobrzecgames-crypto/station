import type { SampleId } from '../audio/AudioEngine'

export interface ChannelState {
  id: SampleId
  volume: number
  muted: boolean
  solo: boolean
}

export interface PadState extends ChannelState {
  label: string
  fileName: string | null
  durationSeconds: number | null
  pitchSemitones: number
}

export interface PadDefinition {
  id: SampleId
  keyCode: string
  keyLabel: string
  label: string
}
