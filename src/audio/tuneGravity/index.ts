import type { ProjectKey } from '../../music/scales.ts'
import { createCorrectionPlan, resolveTuneGravityParameters } from './correctionPlan.ts'
import type { CorrectionFrame, TuneGravityParameters } from './correctionPlan.ts'
import { analyzePitch, defaultPitchDetectorOptions, resolvePitchDetectorOptions } from './pitchDetection.ts'
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
  detectorOptions: PitchDetectorOptions
  parameters: TuneGravityParameters
  detector: PitchDetectorOptions['detector']
  shifter: TuneGravityShifter
  projectKey: ProjectKey
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
  const detectorOptions = resolvePitchDetectorOptions(sampleRate, {
    ...options.detectorOptions,
    detector: options.detector ?? options.detectorOptions?.detector ?? defaultPitchDetectorOptions.detector,
  })
  const parameters = resolveTuneGravityParameters(options.parameters ?? {})
  const pitchFrames = analyzePitch(input, sampleRate, detectorOptions)
  const correctionPlan = createCorrectionPlan(
    pitchFrames,
    options.projectKey,
    sampleRate,
    detectorOptions.hopSize,
    parameters,
  )
  const gravity = parameters.gravity
  const shifter = options.shifter ?? 'tdPsola'
  const output = gravity <= 0
    ? new Float32Array(input)
    : shifter === 'granular'
      ? shiftPitchGranular(input, sampleRate, correctionPlan, detectorOptions)
      : shiftPitchTdPsola(input, sampleRate, correctionPlan, detectorOptions)
  const maximumPeriodSamples = Math.ceil(sampleRate / detectorOptions.minimumFrequencyHz)
  return {
    output,
    pitchFrames,
    correctionPlan,
    algorithmicLookaheadSamples: Math.ceil(detectorOptions.frameSize / 2) + maximumPeriodSamples,
    detectorOptions,
    parameters,
    detector: detectorOptions.detector,
    shifter,
    projectKey: { ...options.projectKey },
  }
}

export { analyzePitch, defaultPitchDetectorOptions, resolvePitchDetectorOptions } from './pitchDetection.ts'
export type { PitchDetectorKind, PitchDetectorOptions, PitchFrame } from './pitchDetection.ts'
export { createCorrectionPlan, defaultTuneGravityParameters, frequencyToMidi, midiToFrequency, nearestScaleMidi, resolveTuneGravityParameters, simpleAutoTuneParameters } from './correctionPlan.ts'
export type { CorrectionFrame, TuneGravityParameters } from './correctionPlan.ts'
export { shiftPitchGranular, shiftPitchTdPsola } from './pitchShifting.ts'
export type { PitchShiftOptions, TuneGravityShifter } from './pitchShifting.ts'
export { createAnonymousTuneGravitySourceId, createTuneGravityDiagnosticDocument, detectTuneGravityProblems, tuneGravityDiagnosticFormatVersion } from './diagnostics.ts'
export type {
  CreateTuneGravityDiagnosticOptions,
  TuneGravityDiagnosticDocument,
  TuneGravityDiagnosticFrame,
  TuneGravityDiagnosticProblem,
  TuneGravityDiagnosticProblemKind,
  TuneGravityDiagnosticRegion,
  TuneGravityDiagnosticRegionKind,
  TuneGravityDiagnosticSkipReason,
} from './diagnostics.ts'
export {
  comparisonVariantForBlindLabel,
  completeTuneGravityBlindSession,
  createDefaultTuneGravityRatings,
  createOriginalComparisonAudio,
  createTuneGravityBlindSession,
  exportTuneGravityListeningTest,
  revealTuneGravityBlindMapping,
  saveTuneGravityBlindEvaluation,
  tuneGravityComparisonVariantIds,
  tuneGravityListeningTestFormatVersion,
  tuneGravityProblemFlags,
  tuneGravityRatingKeys,
} from './listeningTest.ts'
export { createTuneGravityBenchmarkDocument, detectTuneGravityBrowserLabel, tuneGravityBenchmarkFormatVersion } from './benchmark.ts'
export type { CreateTuneGravityBenchmarkOptions, TuneGravityBenchmarkDocument, TuneGravityBenchmarkTimings } from './benchmark.ts'
export type {
  TuneGravityBlindEvaluation,
  TuneGravityBlindLabel,
  TuneGravityBlindSession,
  TuneGravityComparisonVariantId,
  TuneGravityListeningProblemFlag,
  TuneGravityListeningSettings,
  TuneGravityListeningTestExport,
  TuneGravityRatingKey,
  TuneGravityRatings,
} from './listeningTest.ts'
