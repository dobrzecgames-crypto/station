export type PolyPatchId = string

export const polyUnisonCounts = [1, 2, 4, 8] as const
export const polyFilterModes = ['LP12', 'LP24', 'HP12', 'BP12', 'NOTCH'] as const
export const polyLfoShapes = ['sine', 'triangle', 'saw', 'ramp', 'square', 'random'] as const
export const polyLfoDivisions = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32'] as const
export const polyModSources = ['lfo1', 'lfo2', 'modEnv', 'velocity', 'keytrack'] as const
export const polyModDestinations = [
  'osc1Position', 'osc2Position', 'osc1Pitch', 'osc2Pitch', 'osc1Fine', 'osc2Fine',
  'oscMix', 'fmAmount', 'filterCutoff', 'filterResonance', 'filterDrive',
  'filterEnvAmount', 'ampLevel', 'pan', 'unisonDetune', 'width', 'lfo1Rate',
] as const

export type PolyUnisonCount = typeof polyUnisonCounts[number]
export type PolyFilterMode = typeof polyFilterModes[number]
export type PolyLfoShape = typeof polyLfoShapes[number]
export type PolyLfoDivision = typeof polyLfoDivisions[number]
export type PolyModSource = typeof polyModSources[number]
export type PolyModDestination = typeof polyModDestinations[number]

export interface PolyOscillatorState {
  tableId: string
  position: number
  octave: number
  semitone: number
  fineCents: number
  level: number
  unison: PolyUnisonCount
  detuneCents: number
  width: number
}

export interface PolyEnvelopeState {
  attackSeconds: number
  decaySeconds: number
  sustain: number
  releaseSeconds: number
}

export interface PolyLfoState {
  shape: PolyLfoShape
  mode: 'sync' | 'free'
  division: PolyLfoDivision
  rateHz: number
  phase: number
  retrigger: boolean
  fadeInSeconds: number
}

export interface PolyModRoute {
  source: PolyModSource
  destination: PolyModDestination
  amount: number
}

export interface PolyPatch {
  id: PolyPatchId
  name: string
  baseMidiNote: number
  oscillator1: PolyOscillatorState
  oscillator2: PolyOscillatorState
  oscillatorMix: number
  fmAmount: number
  filter: {
    mode: PolyFilterMode
    cutoffHz: number
    resonance: number
    drive: number
    envelopeAmountSemitones: number
    keytrack: number
  }
  ampEnvelope: PolyEnvelopeState
  filterEnvelope: PolyEnvelopeState
  modEnvelope: PolyEnvelopeState
  lfo1: PolyLfoState
  lfo2: PolyLfoState
  modulation: PolyModRoute[]
  level: number
  pan: number
  gate: number
}
