import type { StringsCharacter, StringsPatch } from './stringsTypes'

export const maximumStringsVoices = 8

export function cloneStringsPatch(patch: StringsPatch): StringsPatch {
  return { ...patch, ampEnvelope: { ...patch.ampEnvelope } }
}

/** Musical log taper: BRIGHTNESS reads as a tone knob, not a raw Hz slider. */
export function stringsBrightnessToHz(brightness: number): number {
  const clamped = Math.min(1, Math.max(0, brightness))
  const minimumHz = 200
  const maximumHz = 8000
  return minimumHz * (maximumHz / minimumHz) ** clamped
}

/**
 * CHARACTER is a non-destructive macro: it never rewrites a patch's own
 * ENSEMBLE/VIBRATO/DETUNE/BRIGHTNESS/BODY/envelope fields. Instead the engine
 * combines the user's raw values with this bias at apply-time, so switching
 * CHARACTER back and forth is always fully reversible.
 */
export interface StringsCharacterBias {
  ensembleScale: number
  vibratoScale: number
  detuneScale: number
  brightnessBias: number
  attackScale: number
  releaseScale: number
  bodyBias: number
}

const neutralStringsCharacterBias: StringsCharacterBias = {
  ensembleScale: 1,
  vibratoScale: 1,
  detuneScale: 1,
  brightnessBias: 0,
  attackScale: 1,
  releaseScale: 1,
  bodyBias: 0,
}

const stringsCharacterBiases: Record<StringsCharacter, StringsCharacterBias> = {
  strings: neutralStringsCharacterBias,
  soft: { ensembleScale: 1.05, vibratoScale: 0.9, detuneScale: 0.7, brightnessBias: -0.12, attackScale: 1.6, releaseScale: 1.3, bodyBias: -0.1 },
  brass: { ensembleScale: 0.55, vibratoScale: 0.4, detuneScale: 0.85, brightnessBias: 0.1, attackScale: 0.4, releaseScale: 0.6, bodyBias: 0.15 },
}

export function stringsCharacterBias(character: StringsCharacter): StringsCharacterBias {
  return stringsCharacterBiases[character] ?? neutralStringsCharacterBias
}

/**
 * 0.5 (the default) reproduces the pre-BODY equal two-oscillator mix exactly;
 * below it thins toward a single-oscillator, hollower voice, above it it
 * leans hard into the detuned partner's presence. Widened from an earlier
 * 0.35-1.15 pass, which real playback testing showed was too narrow a swing
 * on a near-unison secondary oscillator to read as a clear difference.
 */
export function stringsBodyToOscillatorBGain(body: number): number {
  const clamped = Math.min(1, Math.max(0, body))
  return clamped <= 0.5 ? 0.15 + (clamped / 0.5) * 0.85 : 1 + ((clamped - 0.5) / 0.5) * 0.6
}

/** Reinforces BODY's oscillator-balance change with a modest brightness shift in the same direction - darker/hollower at low BODY, brighter at high - so the two mechanisms read as one clear timbral move instead of a subtle balance shift alone. Neutral at 0.5, matching the anchor above. */
export function stringsBodyToBrightnessBias(body: number): number {
  return (Math.min(1, Math.max(0, body)) - 0.5) * 0.3
}

/** Static pan magnitude for the ensemble's two taps. 1 (100%) reproduces the pre-WIDTH fixed +/-0.7 spread exactly, independent of ENSEMBLE's own wet/modulation amount. */
export function stringsWidthToPan(width: number): number {
  return Math.min(1, Math.max(0, width)) * 0.7
}

/**
 * Blended linear+quadratic taper: present from low settings rather than
 * staying near-silent until halfway up, while still never letting the layer
 * dominate the main voice even at 100%. A pure quadratic taper (mix^2 * 0.9)
 * put only 22% level at a 50% setting - too quiet to read as "on" in real
 * playback testing.
 */
export function stringsOctaveLayerMixToGain(mix: number): number {
  const clamped = Math.min(1, Math.max(0, mix))
  return clamped * 0.35 + clamped * clamped * 0.55
}

/** Hz swing at MOTION=1, scaled by the voice's own live cutoff so the wobble feels proportional across the BRIGHTNESS range instead of huge at a dark setting and inaudible at a bright one. */
export function stringsMotionFilterDepthHz(motion: number, cutoffHz: number): number {
  return Math.min(1, Math.max(0, motion)) * cutoffHz * 0.15
}

/** Pan drift added on top of WIDTH's static spread. Deliberately small at MOTION=1 so it reads as "alive", never as autopan. */
export function stringsMotionPanDepth(motion: number): number {
  return Math.min(1, Math.max(0, motion)) * 0.12
}

/** Quadratic taper: felt more than heard at low settings, still modest relative to the oscillators even at BOW=1. */
export function stringsBowToGain(bow: number): number {
  const clamped = Math.min(1, Math.max(0, bow))
  return clamped * clamped * 0.4
}

/** Mild concave taper so WARMTH's glue is already noticeable by the middle of the range, matching a saturation "feel" rather than a linear mix. The curve WARMTH blends into is fixed - only this wet amount moves. */
export function stringsWarmthWetGain(warmth: number): number {
  return Math.min(1, Math.max(0, warmth)) ** 0.7
}

/** 0.15-0.30 - always well short of runaway, SPACE only adds a little more sustain to the repeats as it opens up. */
export function stringsSpaceFeedback(space: number): number {
  return 0.15 + Math.min(1, Math.max(0, space)) * 0.15
}

/** Capped well under unity so SPACE adds a sense of distance without ever washing out the dry signal. */
export function stringsSpaceWet(space: number): number {
  return Math.min(1, Math.max(0, space)) * 0.35
}
