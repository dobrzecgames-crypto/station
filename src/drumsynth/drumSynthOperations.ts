import type { DrumKickPatch, DrumSynthState } from './drumSynthTypes'

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function createDefaultDrumKickPatch(): DrumKickPatch {
  return { instrument: 'kick', tune: 0.28, punch: 0.55, body: 0.55, click: 0.45, decay: 0.4, tone: 0.5, drive: 0.2, dust: 0 }
}

export function createDefaultDrumSynthState(): DrumSynthState {
  return { selectedInstrument: 'kick', kick: createDefaultDrumKickPatch() }
}

export function cloneDrumKickPatch(patch: DrumKickPatch): DrumKickPatch {
  return { ...patch }
}

export const kickPresetNames = ['DEEP', 'TIGHT', 'HARD', 'SUB', 'CLICKY'] as const
export type KickPresetName = typeof kickPresetNames[number]

const kickPresets: Record<KickPresetName, Omit<DrumKickPatch, 'instrument'>> = {
  DEEP: { tune: 0.15, punch: 0.35, body: 0.75, click: 0.25, decay: 0.65, tone: 0.35, drive: 0.15, dust: 0.1 },
  TIGHT: { tune: 0.35, punch: 0.55, body: 0.4, click: 0.4, decay: 0.2, tone: 0.55, drive: 0.2, dust: 0.05 },
  HARD: { tune: 0.3, punch: 0.85, body: 0.6, click: 0.65, decay: 0.35, tone: 0.6, drive: 0.55, dust: 0.15 },
  SUB: { tune: 0.05, punch: 0.2, body: 0.85, click: 0.1, decay: 0.8, tone: 0.25, drive: 0.1, dust: 0 },
  CLICKY: { tune: 0.4, punch: 0.6, body: 0.3, click: 0.8, decay: 0.15, tone: 0.7, drive: 0.25, dust: 0.2 },
}

/** Presets are starting points only: applying one spreads its values onto the current patch, which stays freely editable afterward - no separate "active preset" state is tracked. */
export function applyKickPreset(patch: DrumKickPatch, name: KickPresetName): DrumKickPatch {
  const values = kickPresets[name]
  return values ? { ...patch, ...values } : patch
}

/** Musical log taper, same shape as STRINGS' brightness curve: TUNE reads as a pitch knob, not a raw Hz slider. This is the frequency the pitch envelope resolves to, not its starting point. */
export function kickTuneToHz(tune: number): number {
  const minimumHz = 30
  const maximumHz = 200
  return minimumHz * (maximumHz / minimumHz) ** clamp01(tune)
}

export interface KickPitchEnvelope {
  /** Multiplies the settled TUNE frequency to get the oscillator's starting frequency at note-on. */
  startMultiplier: number
  /** Exponential ramp time from the start frequency down to TUNE. */
  dropSeconds: number
}

/**
 * PUNCH drives only the pitch envelope's overshoot and speed - no gain node is
 * touched by this parameter at all, so "not just loudness" holds by
 * construction. At 0 the oscillator starts exactly at TUNE (no sweep); higher
 * values start further above it and snap back slightly faster, reading as a
 * bigger, more electronic transient.
 */
export function kickPunchToPitchEnvelope(punch: number): KickPitchEnvelope {
  const clamped = clamp01(punch)
  return { startMultiplier: 1 + clamped * 7, dropSeconds: 0.07 - clamped * 0.05 }
}

/**
 * BODY crossfades the sub-octave layer against the main oscillator instead of
 * summing them outright, so thickness increases without the peak growing
 * unchecked - main gain only dips modestly as the sub layer comes up.
 */
export function kickBodyToMainGain(body: number): number {
  return 0.75 - clamp01(body) * 0.25
}

export function kickBodyToSubGain(body: number): number {
  const clamped = clamp01(body)
  return clamped * clamped * 0.55
}

/** Present from low settings rather than staying near-silent until halfway up, capped well under the body layer even at 100%. */
export function kickClickToGain(click: number): number {
  return clamp01(click) ** 0.6 * 0.25
}

/** Exponential taper: a tight, punchy hit up to a long sub tail. Governs only the body/sub amplitude envelope. */
export function kickDecayToSeconds(decay: number): number {
  const minimumSeconds = 0.07
  const maximumSeconds = 2.2
  return minimumSeconds * (maximumSeconds / minimumSeconds) ** clamp01(decay)
}

export interface KickToneShape {
  /** Low-pass cutoff over the body path. */
  bodyLowpassHz: number
  /** Band-pass center over the click path. */
  clickBandpassHz: number
  clickBandwidthQ: number
  /** -1 (fully dark) .. 1 (fully bright). Only ever attenuates the de-emphasised side, never boosts either above its own level. */
  bodyClickBalance: number
}

/**
 * TONE is not a single low-pass: one value reshapes two independent filters
 * plus a bounded body/click trim, so darker genuinely reads as softer/more
 * massive (click's band narrows, body stays fuller) and brighter reads as
 * more definition (click's band opens, body's ceiling opens) rather than one
 * uniform dulling.
 */
export function kickToneToShape(tone: number): KickToneShape {
  const clamped = clamp01(tone)
  return {
    bodyLowpassHz: 300 * (9000 / 300) ** clamped,
    clickBandpassHz: 800 * (7000 / 800) ** clamped,
    clickBandwidthQ: 0.7 + clamped * 0.5,
    bodyClickBalance: (clamped - 0.5) * 2,
  }
}

/** Same rational-saturator shape already proven in MONOPOLY - unity gain at full scale by construction. */
export function kickDriveCurve(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024)
  const amount = clamp01(drive) * 10
  for (let index = 0; index < curve.length; index += 1) {
    const input = (index * 2) / (curve.length - 1) - 1
    curve[index] = ((1 + amount) * input) / (1 + amount * Math.abs(input))
  }
  return curve
}

/** Saturation raises perceived loudness even at a peak-bounded curve, so DRIVE trims the output back slightly as it rises - it should read as harmonics/aggression, not a level jump. */
export function kickDriveCompensationGain(drive: number): number {
  return 1 - clamp01(drive) * 0.2
}

export interface KickDustShape {
  crackleCount: number
  crackleGain: number
  noiseFloorGain: number
  /**
   * Not a self-imposed low ceiling: DRIVE's WaveShaper curve always evaluates
   * to exactly +/-1 at its domain edges regardless of drive amount (a spec
   * guarantee - out-of-range input holds at the curve's boundary sample), so
   * the voice is clip-safe by construction all the way up to `outputTrim`.
   * That headroom belongs to DUST actually being heard, not to a cautious cap.
   */
  outputGain: number
}

/**
 * Convex (`presence`) rather than linear: keeps DUST 1-25% close to the spec's
 * "barely audible", but lets 60-100% land as clearly, unmistakably worn
 * rather than merely "a bit less clean" - the two ends of the range need
 * different slopes, not one straight line between them.
 */
export function kickDustToShape(dust: number): KickDustShape {
  const clamped = clamp01(dust)
  const presence = clamped ** 1.25
  return {
    crackleCount: Math.round(presence * 18),
    crackleGain: 0.35 + presence * 0.75,
    noiseFloorGain: clamped * 0.04,
    outputGain: 0.22 + presence * 0.7,
  }
}

/** A floor under DECAY keeps crackle audible even on a very tight, short kick - vinyl surface noise reads as its own layer, not as something borrowed from the body's own envelope length. */
export function kickDustDurationSeconds(decaySeconds: number): number {
  return Math.max(0.08, Math.min(decaySeconds, 0.45))
}

/** Longest of the body/sub decay, the click tail and (if built) the DUST tail, plus a small safety margin - far simpler than the whole-song render's tail math since there is no delay/reverb tail in this voice. */
export function estimateKickRenderSeconds(patch: DrumKickPatch): number {
  const decaySeconds = kickDecayToSeconds(patch.decay)
  const clickTailSeconds = 0.02
  const dustTailSeconds = patch.dust > 0 ? kickDustDurationSeconds(decaySeconds) : 0
  const safetyMarginSeconds = 0.15
  return Math.min(3.5, Math.max(decaySeconds, clickTailSeconds, dustTailSeconds) + safetyMarginSeconds)
}
