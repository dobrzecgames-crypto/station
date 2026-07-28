export const synthWaveforms = ['sine', 'triangle', 'sawtooth', 'square'] as const
export const subWaveforms = ['sine', 'square'] as const
export const synthVoiceModes = ['mono', 'poly5'] as const
export const synthLfoDivisions = ['1/2', '1/2T', '1/4', '1/4T', '1/8', '1/8T', '1/16', '1/16T'] as const

export type SynthPatchId = string
export type SynthWaveform = typeof synthWaveforms[number]
export type SubWaveform = typeof subWaveforms[number]
export type SynthVoiceMode = typeof synthVoiceModes[number]
export type SynthLfoDivision = typeof synthLfoDivisions[number]

export interface SynthOscillatorState {
  waveform: SynthWaveform
  octave: number
  detuneCents: number
  level: number
}

export interface SynthPatch {
  id: SynthPatchId
  name: string
  mode: SynthVoiceMode
  baseMidiNote: number
  oscillator1: SynthOscillatorState
  oscillator2: SynthOscillatorState
  sub: {
    waveform: SubWaveform
    octave: -1 | -2
    level: number
  }
  ampEnvelope: {
    attackSeconds: number
    decaySeconds: number
    sustain: number
    releaseSeconds: number
  }
  filter: {
    cutoffHz: number
    resonance: number
    envelopeAttackSeconds: number
    envelopeDecaySeconds: number
    envelopeAmountSemitones: number
  }
  lfo: {
    waveform: SynthWaveform
    division: SynthLfoDivision
    depthSemitones: number
  }
  drive: number
  glideSeconds: number
  gate: number
}

