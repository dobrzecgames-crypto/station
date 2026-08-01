import type { ProjectKey } from '../../music/scales.ts'
import { createCorrectionPlan } from './correctionPlan.ts'
import type { CorrectionFrame, TuneGravityParameters } from './correctionPlan.ts'
import { analyzePitch, defaultPitchDetectorOptions } from './pitchDetection.ts'
import type { PitchDetectorOptions, PitchFrame } from './pitchDetection.ts'
import { shiftPitchGranular, shiftPitchTdPsola } from './pitchShifting.ts'
import type { TuneGravityShifter } from './pitchShifting.ts'

export interface TuneGravityPrototypeOptions {
  projectKey: ProjectKey
  detector?: PitchDetectorOptions['detector']
  shifter?: TuneGravityShifter
  detectorOptions?: Partial<PitchDetectorOptions>
  parameters?: Partial<TuneGravityParameters>
}

export interface TuneGravityPrototypeResult {
  output: Float32Array
  pitchFrames: PitchFrame[]
  correctionPlan: CorrectionFrame[]
  algorithmicLookaheadSamples: number
}

/**
 * Isolated QUALITY-mode prototype. It intentionally has no AudioNode, project
 * persistence or rack/UI integration until real-vocal listening accepts the
 * detector and shifter combination.
 */
export function processTuneGravityOffline(
  input: Float32Array,
  sampleRate: number,
  options: TuneGravityPrototypeOptions,
): TuneGravityPrototypeResult {
  const detectorOptions = {
    ...defaultPitchDetectorOptions,
    ...options.detectorOptions,
    detector: options.detector ?? options.detectorOptions?.detector ?? defaultPitchDetectorOptions.detector,
  }
  const pitchFrames = analyzePitch(input, sampleRate, detectorOptions)
  const correctionPlan = createCorrectionPlan(
    pitchFrames,
    options.projectKey,
    sampleRate,
    detectorOptions.hopSize,
    options.parameters,
  )
  const gravity = options.parameters?.gravity ?? 0.65
  const output = gravity <= 0
    ? new Float32Array(input)
    : options.shifter === 'granular'
      ? shiftPitchGranular(input, sampleRate, correctionPlan, detectorOptions)
      : shiftPitchTdPsola(input, sampleRate, correctionPlan, detectorOptions)
  const maximumPeriodSamples = Math.ceil(sampleRate / detectorOptions.minimumFrequencyHz)
  return {
    output,
    pitchFrames,
    correctionPlan,
    algorithmicLookaheadSamples: Math.ceil(detectorOptions.frameSize / 2) + maximumPeriodSamples,
  }
}

export { analyzePitch, defaultPitchDetectorOptions } from './pitchDetection.ts'
export type { PitchDetectorKind, PitchDetectorOptions, PitchFrame } from './pitchDetection.ts'
export { createCorrectionPlan, defaultTuneGravityParameters, frequencyToMidi, midiToFrequency, nearestScaleMidi } from './correctionPlan.ts'
export type { CorrectionFrame, TuneGravityParameters } from './correctionPlan.ts'
export { shiftPitchGranular, shiftPitchTdPsola } from './pitchShifting.ts'
export type { PitchShiftOptions, TuneGravityShifter } from './pitchShifting.ts'
