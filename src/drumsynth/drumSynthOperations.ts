import type { DrumKickPatch, DrumSnarePatch, DrumSynthState } from './drumSynthTypes'

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

// ---------------------------------------------------------------------------
// KICK
// ---------------------------------------------------------------------------

export function createDefaultDrumKickPatch(): DrumKickPatch {
  return { instrument: 'kick', tune: 0.28, punch: 0.55, body: 0.55, click: 0.45, decay: 0.4, tone: 0.5, drive: 0.2, dust: 0 }
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

/** Same rational-saturator shape already proven in MONOPOLY - unity gain at full scale by construction, for any `amount`. Shared by KICK's user-facing DRIVE and SNARE's fixed internal saturation. */
export function saturatorCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024)
  for (let index = 0; index < curve.length; index += 1) {
    const input = (index * 2) / (curve.length - 1) - 1
    curve[index] = ((1 + amount) * input) / (1 + amount * Math.abs(input))
  }
  return curve
}

export function kickDriveCurve(drive: number): Float32Array<ArrayBuffer> {
  return saturatorCurve(clamp01(drive) * 10)
}

/** Saturation raises perceived loudness even at a peak-bounded curve, so DRIVE trims the output back slightly as it rises - it should read as harmonics/aggression, not a level jump. */
export function kickDriveCompensationGain(drive: number): number {
  return 1 - clamp01(drive) * 0.2
}

// ---------------------------------------------------------------------------
// DUST - shared by every drum voice, not just KICK
// ---------------------------------------------------------------------------

export interface DustShape {
  crackleCount: number
  crackleGain: number
  noiseFloorGain: number
  /**
   * Not a self-imposed low ceiling: the saturator curve always evaluates to
   * exactly +/-1 at its domain edges regardless of amount (a WaveShaper spec
   * guarantee - out-of-range input holds at the curve's boundary sample), so
   * every voice is clip-safe by construction all the way up to its own
   * `outputTrim`. That headroom belongs to DUST actually being heard, not to
   * a cautious cap.
   */
  outputGain: number
}

/**
 * Convex (`presence`) rather than linear: keeps DUST 1-25% close to the spec's
 * "barely audible", but lets 60-100% land as clearly, unmistakably worn
 * rather than merely "a bit less clean" - the two ends of the range need
 * different slopes, not one straight line between them. Shared unchanged by
 * KICK and SNARE - same core concept, same curve; each voice's own summing
 * context is what naturally gives DUST a different final character.
 */
export function dustToShape(dust: number): DustShape {
  const clamped = clamp01(dust)
  const presence = clamped ** 1.25
  return {
    crackleCount: Math.round(presence * 18),
    crackleGain: 0.35 + presence * 0.75,
    noiseFloorGain: clamped * 0.04,
    outputGain: 0.22 + presence * 0.7,
  }
}

/** A floor keeps crackle audible even on a very short hit - vinyl surface noise reads as its own layer, not as something borrowed from the voice's own envelope length. */
export function dustDurationSeconds(referenceDecaySeconds: number): number {
  return Math.max(0.08, Math.min(referenceDecaySeconds, 0.45))
}

/** Longest of the body/sub decay, the click tail and (if built) the DUST tail, plus a small safety margin - far simpler than the whole-song render's tail math since there is no delay/reverb tail in this voice. */
export function estimateKickRenderSeconds(patch: DrumKickPatch): number {
  const decaySeconds = kickDecayToSeconds(patch.decay)
  const clickTailSeconds = 0.02
  const dustTailSeconds = patch.dust > 0 ? dustDurationSeconds(decaySeconds) : 0
  const safetyMarginSeconds = 0.15
  return Math.min(3.5, Math.max(decaySeconds, clickTailSeconds, dustTailSeconds) + safetyMarginSeconds)
}

// ---------------------------------------------------------------------------
// SNARE
// ---------------------------------------------------------------------------

export function createDefaultDrumSnarePatch(): DrumSnarePatch {
  return { instrument: 'snare', tune: 0.45, body: 0.5, snap: 0.55, rattle: 0.55, bodyDecay: 0.35, rattleDecay: 0.4, tone: 0.5, dust: 0 }
}

export function cloneDrumSnarePatch(patch: DrumSnarePatch): DrumSnarePatch {
  return { ...patch }
}

export const snarePresetNames = ['TIGHT', 'DEEP', 'CRISP', 'WIDE', 'RUST'] as const
export type SnarePresetName = typeof snarePresetNames[number]

const snarePresets: Record<SnarePresetName, Omit<DrumSnarePatch, 'instrument'>> = {
  TIGHT: { tune: 0.6, body: 0.35, snap: 0.6, rattle: 0.4, bodyDecay: 0.2, rattleDecay: 0.2, tone: 0.6, dust: 0 },
  DEEP: { tune: 0.25, body: 0.65, snap: 0.4, rattle: 0.45, bodyDecay: 0.4, rattleDecay: 0.35, tone: 0.35, dust: 0.05 },
  CRISP: { tune: 0.55, body: 0.3, snap: 0.75, rattle: 0.5, bodyDecay: 0.25, rattleDecay: 0.3, tone: 0.7, dust: 0 },
  WIDE: { tune: 0.4, body: 0.45, snap: 0.45, rattle: 0.65, bodyDecay: 0.35, rattleDecay: 0.75, tone: 0.5, dust: 0.1 },
  RUST: { tune: 0.35, body: 0.4, snap: 0.5, rattle: 0.7, bodyDecay: 0.3, rattleDecay: 0.55, tone: 0.45, dust: 0.55 },
}

/** Presets are starting points only: applying one spreads its values onto the current patch, which stays freely editable afterward - no separate "active preset" state is tracked. */
export function applySnarePreset(patch: DrumSnarePatch, name: SnarePresetName): DrumSnarePatch {
  const values = snarePresets[name]
  return values ? { ...patch, ...values } : patch
}

/** Musical log taper for the tonal body's settled pitch. Only the body follows this - RATTLE keeps its own character regardless (see snareRattleToShape's own, much smaller TUNE bias), so a low TUNE darkens the knock without turning the whole snare into a tom. */
export function snareTuneToHz(tune: number): number {
  const minimumHz = 120
  const maximumHz = 420
  return minimumHz * (maximumHz / minimumHz) ** clamp01(tune)
}

/** Fixed interval between the two body oscillators, not a user parameter. Gives the classic "two-tone" electronic snare knock - a single oscillator reads as a tom or a mini-kick, which the brief explicitly warns against. */
export const snareBodyToneRatio = 1.5

/** Lower TUNE carries more low-frequency energy than higher TUNE at the same gain, which reads as louder rather than just deeper - this pulls the body back slightly as TUNE falls so perceived level stays roughly steady across the range. */
export function snareTuneLevelCompensation(tune: number): number {
  return 0.85 + clamp01(tune) * 0.15
}

export interface SnareBodyShape {
  gain: number
  /** 0-1, mix bias toward the lower (ratio) oscillator as BODY rises - adds perceived mass rather than just level. */
  lowToneBias: number
}

/**
 * BODY is presence/mass, not a volume fader on one oscillator: raising it
 * increases overall body gain AND biases the mix toward the lower body
 * oscillator (more low-mid girth). The matching pull-back on RATTLE lives in
 * snareRattleMutualTrim, not here - BODY's own shape never reads RATTLE.
 */
export function snareBodyToShape(body: number): SnareBodyShape {
  const clamped = clamp01(body)
  return { gain: 0.32 + clamped * 0.4, lowToneBias: clamped * 0.3 }
}

/** Mutual, one-directional ducking - raising RATTLE or SNAP pulls BODY back a little, never the reverse of silencing them: "raising one layer gently pulls the others back" from the brief, not a boost above any layer's own level. */
export function snareBodyMutualTrim(rattle: number, snap: number): number {
  return 1 - clamp01(rattle) * 0.15 - clamp01(snap) * 0.05
}

/** The matching half of snareBodyMutualTrim: a strong BODY pulls RATTLE back slightly so an extreme setting still leaves the other layer audible, never silent. */
export function snareRattleMutualTrim(body: number): number {
  return 1 - clamp01(body) * 0.15
}

export interface SnareSnapShape {
  gain: number
}

/** SNAP is the first few milliseconds' hardness only, never tied to either DECAY. Present from low settings so a player reaches for it before the halfway mark, capped well under the body/rattle layers even at 100%. */
export function snareSnapToShape(snap: number): SnareSnapShape {
  return { gain: clamp01(snap) ** 0.6 * 0.55 }
}

export interface SnareRattleShape {
  broadbandGain: number
  resonantGain: number
  resonantHz: number
  resonantQ: number
  /** Depth of a slow, seeded gain wobble baked into the noise buffer - reads as a genuinely busier, more irregular texture rather than a smooth, static hiss. */
  irregularityDepth: number
}

/**
 * RATTLE is not a white-noise level fader: as it rises, the mix leans further
 * toward the resonant "spring" band (resonantGain grows faster than
 * broadbandGain, a convex taper) and the baked-in amplitude irregularity
 * deepens - a genuinely busier, more metallic texture, not just a louder
 * hiss. TUNE only subtly biases the resonant center, enough that the layers
 * still read as one instrument without RATTLE following TUNE the way BODY does.
 */
export function snareRattleToShape(rattle: number, tune: number): SnareRattleShape {
  const clamped = clamp01(rattle)
  return {
    broadbandGain: 0.18 + clamped * 0.5,
    resonantGain: clamped ** 1.4 * 0.6,
    resonantHz: 2200 + clamp01(tune) * 1400,
    resonantQ: 2.5,
    irregularityDepth: clamped * 0.4,
  }
}

/** Short-ranged and precise through the tight/mid zone on purpose: even at max this stays a knock, never a sustained note (see DrumSnarePatch.bodyDecay). */
export function snareBodyDecayToSeconds(bodyDecay: number): number {
  const minimumSeconds = 0.03
  const maximumSeconds = 0.35
  return minimumSeconds * (maximumSeconds / minimumSeconds) ** clamp01(bodyDecay)
}

/** Independent of bodyDecay and much wider-ranged - the parameter that actually decides tight/club vs wide/experimental. Always a genuine decay to silence, never a reverb tail: no reflections, no lingering floor. */
export function snareRattleDecayToSeconds(rattleDecay: number): number {
  const minimumSeconds = 0.05
  const maximumSeconds = 1.3
  return minimumSeconds * (maximumSeconds / minimumSeconds) ** clamp01(rattleDecay)
}

export interface SnareToneShape {
  /** Low-pass over the tonal body. */
  bodyLowpassHz: number
  /** High-pass "brightness" over RATTLE's broadband component. */
  rattleBrightnessHz: number
  /** Band-pass center over SNAP. */
  snapBandpassHz: number
  /** Brighter reads as slightly louder even at unchanged per-layer gains; this compensates it back down a touch, never boosts. */
  levelCompensation: number
}

/**
 * TONE reshapes body, snap and rattle together rather than filtering the
 * whole mix: darker biases toward the body and softens both snap and rattle;
 * brighter opens all three at once, reading as one coherent timbral move
 * instead of a single uniform dulling.
 */
export function snareToneToShape(tone: number): SnareToneShape {
  const clamped = clamp01(tone)
  return {
    bodyLowpassHz: 500 * (6000 / 500) ** clamped,
    rattleBrightnessHz: 800 * (4000 / 800) ** clamped,
    snapBandpassHz: 1200 * (6000 / 1200) ** clamped,
    levelCompensation: 1 - clamped * 0.12,
  }
}

export function estimateSnareRenderSeconds(patch: DrumSnarePatch): number {
  const bodyDecaySeconds = snareBodyDecayToSeconds(patch.bodyDecay)
  const rattleDecaySeconds = snareRattleDecayToSeconds(patch.rattleDecay)
  const snapTailSeconds = 0.02
  const dustTailSeconds = patch.dust > 0 ? dustDurationSeconds(rattleDecaySeconds) : 0
  const safetyMarginSeconds = 0.15
  return Math.min(3.5, Math.max(bodyDecaySeconds, rattleDecaySeconds, snapTailSeconds, dustTailSeconds) + safetyMarginSeconds)
}

// ---------------------------------------------------------------------------
// DrumSynthState
// ---------------------------------------------------------------------------

export function createDefaultDrumSynthState(): DrumSynthState {
  return { selectedInstrument: 'kick', kick: createDefaultDrumKickPatch(), snare: createDefaultDrumSnarePatch() }
}
