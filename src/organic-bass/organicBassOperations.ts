import type { PadState } from '../pads/types'
import type { PatternGroup } from '../patterns/patternTypes'
import type { OrganicBassPatch, OrganicBassPatchId } from './organicBassTypes'

export const minimumOrganicBassMidiNote = 12
export const maximumOrganicBassMidiNote = 96
export const organicBassMaximumDecaySeconds = 4
export const organicBassMaximumGlideSeconds = 0.55

export function createDefaultOrganicBassPatch(id: OrganicBassPatchId, name = 'MONOGORG'): OrganicBassPatch {
  return {
    id,
    name,
    baseMidiNote: 36,
    shape: 0.34,
    weight: 0.68,
    cutoff: 0.455,
    resonance: 0.16,
    contour: 0.46,
    attackSeconds: 0.008,
    decay: 0.46,
    drive: 0.28,
    glide: 0,
    gate: 0.9,
  }
}

export function cloneOrganicBassPatch(patch: OrganicBassPatch): OrganicBassPatch {
  return { ...patch }
}

export function assignOrganicBassSource(pad: PadState, patchId: OrganicBassPatchId): PadState {
  return {
    ...pad,
    assetId: null,
    fileName: null,
    durationSeconds: null,
    region: { startSeconds: 0, endSeconds: 0 },
    reversed: false,
    slices: [],
    chopSessionId: null,
    synthPatchId: null,
    stringsPatchId: null,
    organicBassPatchId: patchId,
    chordIntervals: [0],
  }
}

export function removeUnreferencedOrganicBassPatches(group: PatternGroup): PatternGroup {
  const referenced = new Set(group.bank.pads.flatMap((pad) => pad.organicBassPatchId ? [pad.organicBassPatchId] : []))
  return { ...group, organicBassPatches: group.organicBassPatches.filter((patch) => referenced.has(patch.id)).map(cloneOrganicBassPatch) }
}

export function getOrganicBassPatch(group: PatternGroup, patchId: OrganicBassPatchId | null): OrganicBassPatch | undefined {
  return patchId ? group.organicBassPatches.find((patch) => patch.id === patchId) : undefined
}

export function resolveOrganicBassPadMidiNote(patch: OrganicBassPatch, pad: Pick<PadState, 'pitchSemitones'>): number {
  return patch.baseMidiNote + pad.pitchSemitones
}

/** Logarithmic 55 Hz-5.2 kHz taper, concentrated where bass filtering is useful. */
export function organicBassCutoffHz(value: number): number {
  const normalized = clamp01(value)
  return 55 * (5200 / 55) ** normalized
}

/** 72% of the travel covers 60-900 ms; the short upper segment reaches four seconds. */
export function organicBassDecaySeconds(value: number): number {
  const normalized = clamp01(value)
  if (normalized <= 0.72) return 0.06 * (0.9 / 0.06) ** (normalized / 0.72)
  return 0.9 * (organicBassMaximumDecaySeconds / 0.9) ** ((normalized - 0.72) / 0.28)
}

/** Most of the physical travel stays in short portamento times. */
export function organicBassGlideSeconds(value: number): number {
  return organicBassMaximumGlideSeconds * clamp01(value) ** 2.2
}

export function organicBassContourSemitones(value: number): number {
  return clamp01(value) * 42
}

export function organicBassResonanceQ(value: number): number {
  return 0.55 + clamp01(value) ** 1.35 * 6.45
}

export interface OrganicBassEnvelopeShape {
  decaySeconds: number
  sustain: number
  releaseSeconds: number
}

export function organicBassEnvelopeShape(value: number): OrganicBassEnvelopeShape {
  const normalized = clamp01(value)
  const decaySeconds = organicBassDecaySeconds(normalized)
  const smooth = normalized * normalized * (3 - 2 * normalized)
  return {
    decaySeconds,
    sustain: 0.16 + smooth * 0.68,
    releaseSeconds: Math.min(0.48, Math.max(0.035, 0.035 + decaySeconds * 0.22)),
  }
}

export interface OrganicBassWeightMacro {
  mainGain: number
  bodyGain: number
  subGain: number
  inputDrive: number
  outputTrim: number
}

/** WEIGHT changes composition and filter pressure while normalizing the oscillator sum. */
export function organicBassWeightMacro(value: number): OrganicBassWeightMacro {
  const weight = clamp01(value)
  const rawMain = 0.76 - weight * 0.08
  const rawBody = 0.06 + weight * 0.34
  const rawSub = 0.03 + weight ** 1.25 * 0.47
  const normalizer = 0.92 / (rawMain + rawBody + rawSub)
  return {
    mainGain: rawMain * normalizer,
    bodyGain: rawBody * normalizer,
    subGain: rawSub * normalizer,
    inputDrive: 1 + weight * 0.55,
    outputTrim: 1 / (1 + weight * 0.16),
  }
}

export interface OrganicBassVelocityResponse {
  amplitude: number
  cutoffSemitones: number
  inputDrive: number
}

export function organicBassVelocityResponse(value: number): OrganicBassVelocityResponse {
  const velocity = clamp01(value)
  return {
    amplitude: 0.56 + velocity * 0.44,
    cutoffSemitones: 0.5 + velocity * 3.5,
    inputDrive: 1 + velocity * 0.18,
  }
}

/**
 * Phase-aligned harmonic morph: triangle -> rounded saw -> restrained
 * saw/pulse hybrid. It avoids switching native oscillator types and keeps the
 * bright end intentionally darker than a full-band digital saw.
 */
export function organicBassWaveCoefficients(value: number, harmonicCount = 24): { real: Float32Array; imag: Float32Array } {
  const shape = clamp01(value)
  const real = new Float32Array(harmonicCount + 1)
  const imag = new Float32Array(harmonicCount + 1)
  const firstStage = shape <= 0.55
  const mix = firstStage ? shape / 0.55 : (shape - 0.55) / 0.45
  for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
    const sign = harmonic % 2 === 1 ? 1 : -1
    const triangle = harmonic % 2 === 1 ? sign / (harmonic * harmonic) : 0
    const roundedSaw = sign / harmonic * Math.exp(-0.09 * (harmonic - 1))
    const restrainedSaw = sign / harmonic * Math.exp(-0.035 * (harmonic - 1))
    const pulse = harmonic % 2 === 1 ? sign / harmonic * Math.exp(-0.025 * (harmonic - 1)) : 0
    const bright = restrainedSaw * 0.72 + pulse * 0.28
    imag[harmonic] = firstStage
      ? triangle + (roundedSaw - triangle) * mix
      : roundedSaw + (bright - roundedSaw) * mix
  }
  return { real, imag }
}

export function clampOrganicBassPatch(patch: OrganicBassPatch): OrganicBassPatch {
  return {
    ...patch,
    baseMidiNote: Math.min(maximumOrganicBassMidiNote, Math.max(minimumOrganicBassMidiNote, Math.round(patch.baseMidiNote))),
    shape: clamp01(patch.shape),
    weight: clamp01(patch.weight),
    cutoff: clamp01(patch.cutoff),
    resonance: clamp01(patch.resonance),
    contour: clamp01(patch.contour),
    attackSeconds: Math.min(0.12, Math.max(0, patch.attackSeconds)),
    decay: clamp01(patch.decay),
    drive: clamp01(patch.drive),
    glide: clamp01(patch.glide),
    gate: Math.min(2, Math.max(0.05, patch.gate)),
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
