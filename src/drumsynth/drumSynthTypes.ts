export const drumInstrumentTypes = ['kick', 'snare'] as const
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

export interface DrumSnarePatch {
  instrument: 'snare'
  /** 0-1, tonal body's settled pitch. Only the body follows this - RATTLE keeps its own character so a low TUNE never turns the snare into a tom. */
  tune: number
  /** 0-1, weight and physicality of the tonal body relative to RATTLE - not a volume knob on one oscillator. Even at max the snare keeps its noise identity. */
  body: number
  /** 0-1, hardness and immediacy of the first few milliseconds - a short broadband impulse fused with RATTLE's own onset, independent of both decays. */
  snap: number
  /** 0-1, amount and density of the seeded noise/rattle layer - the central part of the snare's identity, not a white-noise level fader. */
  rattle: number
  /** 0-1, length of the tonal body only - deliberately short-ranged so even at max it stays a knock, never a sustained note. */
  bodyDecay: number
  /** 0-1, length of the rattle layer, fully independent of bodyDecay - the parameter that decides tight/club vs wide/eventually-experimental. Not a reverb: no reflections, always a genuine decay to silence. */
  rattleDecay: number
  /** 0-1, tonal balance across body/snap/rattle together, not a single low-pass. */
  tone: number
  /** 0-1, seeded vinyl-texture layer, same core concept as KICK's DUST - 0 builds no nodes at all. Blends into the noise layer more naturally than in KICK, but never substitutes for RATTLE. */
  dust: number
}

export type DrumPatch = DrumKickPatch | DrumSnarePatch

/**
 * One editable, project-persisted workbench per instrument - not a collection
 * referenced by id like SynthPatch/StringsPatch. Nothing on a pad ever points
 * back at these; ADD TO PAD renders whichever is selected once and the result
 * becomes an ordinary sample. See docs/DECISIONS.md DEC-024/DEC-025.
 */
export interface DrumSynthState {
  selectedInstrument: DrumInstrumentType
  kick: DrumKickPatch
  snare: DrumSnarePatch
}

/** Shared by every drum voice module (kickVoice.ts, snareVoice.ts, ...) so AudioEngine can track and stop them uniformly regardless of instrument. */
export interface DrumVoiceHandle {
  /** Stops every scheduled node at or after `when` and disconnects the graph. Idempotent - safe to call again after the voice has already ended naturally. */
  stop(when?: number): void
}
