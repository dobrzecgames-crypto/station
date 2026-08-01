export const drumInstrumentTypes = ['kick'] as const
export type DrumInstrumentType = typeof drumInstrumentTypes[number]

export interface DrumKickPatch {
  instrument: 'kick'
  /** 0-1, body oscillator's settled pitch - from a deep sub to a tuned electronic kick. */
  tune: number
  /** 0-1, pitch-envelope overshoot and speed only - never touches level. See kickPunchToPitchEnvelope. */
  punch: number
  /** 0-1, sub-layer weight crossfaded against the main body oscillator. See kickBodyToMainGain/kickBodyToSubGain. */
  body: number
  /** 0-1, level of the short (<=15ms), independently-enveloped transient layer that helps the kick cut through a mix. */
  click: number
  /** 0-1, length of the body/sub amplitude envelope - from a tight hit to a long sub tail. Does not stretch CLICK or DUST. */
  decay: number
  /** 0-1, body/click tonal balance, not a single low-pass. Darker biases toward the body and softens the click; brighter opens both. */
  tone: number
  /** 0-1, waveshaper saturation with a compensating output trim so it reads as harmonics, not a level jump. */
  drive: number
  /** 0-1, seeded vinyl-texture layer (crackle + a faint noise floor). 0 builds no nodes at all - bit-identical to off. */
  dust: number
}

export type DrumPatch = DrumKickPatch

/**
 * One editable, project-persisted workbench - not a collection referenced by
 * id like SynthPatch/StringsPatch. Nothing on a pad ever points back at this;
 * ADD TO PAD renders it once and the result becomes an ordinary sample. See
 * docs/DECISIONS.md DEC-024.
 */
export interface DrumSynthState {
  selectedInstrument: DrumInstrumentType
  kick: DrumKickPatch
}
