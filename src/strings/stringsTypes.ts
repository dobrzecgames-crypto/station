export type StringsPatchId = string

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
}
