import { noteNames, scaleDefinitions } from '../../music/scales.ts'
import type { ProjectKey } from '../../music/scales.ts'
import type { PitchFrame } from './pitchDetection.ts'

export interface TuneGravityParameters {
  gravity: number
  speed: number
  humanize: number
  maximumCorrectionCents: number
  confidenceThreshold: number
  switchHysteresisCents: number
  minimumTargetHoldMs: number
}

export interface CorrectionFrame extends PitchFrame {
  sourceMidi: number | null
  targetMidi: number | null
  correctionCents: number
  pitchRatio: number
  hysteresisState: 'inactive' | 'released' | 'stable' | 'candidate'
  pendingTargetMidi: number | null
  targetHoldMs: number
}

export const defaultTuneGravityParameters: TuneGravityParameters = {
  gravity: 0.65,
  speed: 0.55,
  humanize: 0.5,
  maximumCorrectionCents: 300,
  confidenceThreshold: 0.72,
  switchHysteresisCents: 18,
  minimumTargetHoldMs: 45,
}

/**
 * Turns pitch observations into a conservative correction trajectory. GRAVITY
 * controls actual pull/capture rather than a wet/dry mix; HUMANIZE preserves
 * short-period movement around a stable note center.
 */
export function createCorrectionPlan(
  pitchFrames: readonly PitchFrame[],
  projectKey: ProjectKey,
  sampleRate: number,
  hopSize: number,
  overrides: Partial<TuneGravityParameters> = {},
): CorrectionFrame[] {
  const parameters = resolveTuneGravityParameters(overrides)
  const hopSeconds = hopSize / sampleRate
  const minimumHoldFrames = Math.max(1, Math.ceil(parameters.minimumTargetHoldMs / 1000 / hopSeconds))
  const releaseFrames = Math.max(1, Math.ceil(0.12 / hopSeconds))
  const speedTimeConstant = 0.008 + 0.22 * (1 - parameters.speed) ** 2
  const correctionAlpha = 1 - Math.exp(-hopSeconds / speedTimeConstant)
  const centerAlpha = 1 - Math.exp(-hopSeconds / 0.18)

  let activeTarget: number | null = null
  let pendingTarget: number | null = null
  let pendingFrames = 0
  let stableFrames = 0
  let targetHoldFrames = 0
  let unvoicedFrames = releaseFrames
  let pitchCenter: number | null = null
  let smoothedCorrection = 0

  return pitchFrames.map((frame) => {
    const isReliable = frame.voiced && frame.frequencyHz !== null && frame.confidence >= parameters.confidenceThreshold
    if (!isReliable || frame.frequencyHz === null) {
      unvoicedFrames += 1
      smoothedCorrection += (0 - smoothedCorrection) * Math.min(1, correctionAlpha * 2)
      if (unvoicedFrames >= releaseFrames) {
        activeTarget = null
        pendingTarget = null
        pendingFrames = 0
        stableFrames = 0
        targetHoldFrames = 0
        pitchCenter = null
      }
      return {
        ...frame,
        sourceMidi: null,
        targetMidi: null,
        correctionCents: 0,
        pitchRatio: 1,
        hysteresisState: activeTarget === null ? 'inactive' : 'released',
        pendingTargetMidi: null,
        targetHoldMs: targetHoldFrames * hopSeconds * 1000,
      }
    }

    unvoicedFrames = 0
    const sourceMidi = frequencyToMidi(frame.frequencyHz)
    const nearestTarget = nearestScaleMidi(sourceMidi, projectKey)
    const previousActiveTarget = activeTarget
    if (activeTarget === null) {
      activeTarget = nearestTarget
      stableFrames = 1
      targetHoldFrames = 1
      pitchCenter = sourceMidi
    } else if (nearestTarget === activeTarget) {
      pendingTarget = null
      pendingFrames = 0
      stableFrames += 1
      targetHoldFrames += 1
    } else {
      const currentDistance = Math.abs(sourceMidi - activeTarget) * 100
      const candidateDistance = Math.abs(sourceMidi - nearestTarget) * 100
      const decisivelyCloser = currentDistance - candidateDistance >= parameters.switchHysteresisCents
      if (decisivelyCloser) {
        if (pendingTarget === nearestTarget) pendingFrames += 1
        else {
          pendingTarget = nearestTarget
          pendingFrames = 1
        }
        if (pendingFrames >= minimumHoldFrames) {
          activeTarget = nearestTarget
          pendingTarget = null
          pendingFrames = 0
          stableFrames = 1
          targetHoldFrames = 1
          pitchCenter = sourceMidi
        }
      } else {
        pendingTarget = null
        pendingFrames = 0
      }
    }

    if (activeTarget !== null && activeTarget === previousActiveTarget && nearestTarget !== activeTarget) targetHoldFrames += 1

    pitchCenter = pitchCenter === null ? sourceMidi : pitchCenter + (sourceMidi - pitchCenter) * centerAlpha
    const stableSeconds = stableFrames * hopSeconds
    const humanizeContext = parameters.humanize * smoothstep(0.1, 0.35, stableSeconds)
    const instantErrorSemitones = activeTarget - sourceMidi
    const centerErrorSemitones = activeTarget - pitchCenter
    const musicalErrorCents = lerp(instantErrorSemitones, centerErrorSemitones, humanizeContext) * 100
    const requestedCorrection = applyGravity(musicalErrorCents, parameters)
    smoothedCorrection += (requestedCorrection - smoothedCorrection) * correctionAlpha
    const correctionCents = clamp(smoothedCorrection, -parameters.maximumCorrectionCents, parameters.maximumCorrectionCents)

    return {
      ...frame,
      sourceMidi,
      targetMidi: activeTarget,
      correctionCents,
      pitchRatio: 2 ** (correctionCents / 1200),
      hysteresisState: pendingTarget === null ? 'stable' : 'candidate',
      pendingTargetMidi: pendingTarget,
      targetHoldMs: targetHoldFrames * hopSeconds * 1000,
    }
  })
}

export function frequencyToMidi(frequencyHz: number): number {
  return 69 + 12 * Math.log2(frequencyHz / 440)
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function nearestScaleMidi(sourceMidi: number, projectKey: ProjectKey): number {
  const rootPitchClass = noteNames.indexOf(projectKey.root)
  const allowed = new Set(scaleDefinitions[projectKey.scale].intervals.map((interval) => (rootPitchClass + interval) % 12))
  const center = Math.round(sourceMidi)
  let best = center
  let bestDistance = Number.POSITIVE_INFINITY
  for (let candidate = center - 12; candidate <= center + 12; candidate += 1) {
    const pitchClass = ((candidate % 12) + 12) % 12
    if (!allowed.has(pitchClass)) continue
    const distance = Math.abs(candidate - sourceMidi)
    if (distance < bestDistance || (distance === bestDistance && candidate < best)) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

function applyGravity(errorCents: number, parameters: TuneGravityParameters): number {
  if (parameters.gravity <= 0) return 0
  const magnitude = Math.abs(errorCents)
  const deadZoneCents = 16 * (1 - parameters.gravity) ** 2
  if (magnitude <= deadZoneCents) return 0
  const captureCents = 45 + parameters.gravity * 305
  const outsideCapture = Math.max(0, magnitude - captureCents)
  const distanceAttenuation = 1 - smoothstep(0, 180, outsideCapture)
  const pullStrength = parameters.gravity ** 0.72
  const correctedMagnitude = Math.max(0, magnitude - deadZoneCents) * pullStrength * distanceAttenuation
  return Math.sign(errorCents) * Math.min(parameters.maximumCorrectionCents, correctedMagnitude)
}

export function resolveTuneGravityParameters(overrides: Partial<TuneGravityParameters>): TuneGravityParameters {
  const parameters = { ...defaultTuneGravityParameters, ...overrides }
  parameters.gravity = clamp(parameters.gravity, 0, 1)
  parameters.speed = clamp(parameters.speed, 0, 1)
  parameters.humanize = clamp(parameters.humanize, 0, 1)
  parameters.maximumCorrectionCents = clamp(parameters.maximumCorrectionCents, 50, 400)
  parameters.confidenceThreshold = clamp(parameters.confidenceThreshold, 0, 1)
  parameters.switchHysteresisCents = clamp(parameters.switchHysteresisCents, 0, 100)
  parameters.minimumTargetHoldMs = clamp(parameters.minimumTargetHoldMs, 0, 250)
  return parameters
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

function lerp(first: number, second: number, amount: number): number {
  return first + (second - first) * amount
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
