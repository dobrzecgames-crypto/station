export type StringsPatchId = string

export const stringsOctaves = [-1, 0, 1] as const
export const stringsOctaveLayers = ['off', 'down', 'up'] as const
export const stringsCharacters = ['strings', 'soft', 'brass'] as const

export type StringsOctave = typeof stringsOctaves[number]
export type StringsOctaveLayer = typeof stringsOctaveLayers[number]
export type StringsCharacter = typeof stringsCharacters[number]

export interface StringsAmpEnvelope {
  attackSeconds: number
  decaySeconds: number
  sustain: number
  releaseSeconds: number
}

export interface StringsPatch {
  id: StringsPatchId
  name: string
  baseMidiNote: number
  /** Static spread, in cents, between the two sawtooth layers of one voice. */
  detuneCents: number
  /** 0-1, musical taper onto the shared lowpass cutoff. */
  brightness: number
  /** 0-1, dry/wet and modulation depth of the ensemble chorus. */
  ensemble: number
  /** 0-1, depth of the shared vibrato LFO, in cents. */
  vibrato: number
  /** 0-1, output trim. */
  level: number
  /** Fraction of a SEQ step's duration a triggered voice holds before release, same meaning as SynthPatch.gate. */
  gate: number
  ampEnvelope: StringsAmpEnvelope
  /** Whole-octave transpose applied at playback only - never changes a pattern's stored notes. */
  octave: StringsOctave
  /** Optional extra voice one octave up or down from the main pitch. */
  octaveLayer: StringsOctaveLayer
  /** 0-1, level of the octave layer relative to the main voice. Only audible once `octaveLayer` is not 'off'. */
  octaveLayerMix: number
  /** Macro that biases (not overwrites) ensemble/vibrato/detune/brightness/envelope shape. */
  character: StringsCharacter
  /** 0-1, balance between the two voice oscillators - the harmonic/beating structure, not a filter. */
  body: number
  /** 0-1, depth of slow free-running filter and pan drift on long-held notes. */
  motion: number
  /** 0-1, stereo spread of the ensemble's panned taps, independent of ENSEMBLE's modulation amount. */
  width: number
  /** 0-1, level of the shared filtered-noise texture layered under the voice. */
  bow: number
  /** 0-2000, milliseconds after note-on before vibrato begins fading in. */
  vibratoDelayMs: number
  /** 0-1, dry/wet blend into a fixed soft-saturation curve - the curve itself never changes, only the mix. */
  warmth: number
  /** 0-1, send level into STRINGS' own light per-channel space (short damped feedback delay), independent of ENSEMBLE. */
  space: number
}
