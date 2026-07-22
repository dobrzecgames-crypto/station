import type { SampleId } from '../audio/AudioEngine'

export interface PadState {
  id: SampleId
  label: string
  fileName: string | null
  durationSeconds: number | null
  gain: number
  pitchSemitones: number
}

export interface PadDefinition {
  id: SampleId
  keyCode: string
  keyLabel: string
  label: string
}
