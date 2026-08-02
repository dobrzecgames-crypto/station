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
  const parameters = resolveTuneGravityParameters(options.parameters ?? {})
  const detectorOptions = resolvePitchDetectorOptions(sampleRate, {
    confidenceThreshold: parameters.confidenceThreshold,
    ...options.detectorOptions,
    detector: options.detector ?? options.detectorOptions?.detector ?? defaultPitchDetectorOptions.detector,
  })
  const pitchFrames = analyzePitch(input, sampleRate, detectorOptions)
  const rawCorrectionPlan = createCorrectionPlan(
    pitchFrames,
    options.projectKey,
    sampleRate,
    detectorOptions.hopSize,
    parameters,
  )
  const correctionPlan = isSimpleHardTune(parameters)
    ? backfillInitialHardTuneOnset(rawCorrectionPlan, detectorOptions.rmsThreshold, sampleRate, detectorOptions.hopSize)
    : rawCorrectionPlan
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

/**
 * The TUNE workspace renders offline, so the first reliable pitch observation
 * can safely cover a short aperiodic vocal onset that realtime detection would
 * otherwise pass through dry. The look-ahead is deliberately bounded and only
 * used by the fixed hard-tune preset; silence and later breaths stay untouched.
 */
function backfillInitialHardTuneOnset(
  plan: readonly CorrectionFrame[],
  rmsThreshold: number,
  sampleRate: number,
  hopSize: number,
): CorrectionFrame[] {
  const firstCorrectionIndex = plan.findIndex((frame) => frame.voiced && frame.frequencyHz !== null && Math.abs(frame.correctionCents) > 0.05)
  if (firstCorrectionIndex <= 0) return [...plan]

  const maximumLookAheadFrames = Math.ceil(0.75 * sampleRate / hopSize)
  const maximumQuietFrames = Math.max(1, Math.ceil(0.025 * sampleRate / hopSize))
  const earliestIndex = Math.max(0, firstCorrectionIndex - maximumLookAheadFrames)
  let onsetIndex = firstCorrectionIndex
  let quietFrames = 0
  for (let index = firstCorrectionIndex - 1; index >= earliestIndex; index -= 1) {
    if (plan[index]!.rms >= rmsThreshold) {
      onsetIndex = index
      quietFrames = 0
      continue
    }
    quietFrames += 1
    if (quietFrames > maximumQuietFrames) break
  }
  if (onsetIndex === firstCorrectionIndex) return [...plan]

  const anchor = plan[firstCorrectionIndex]!
  return plan.map((frame, index) => index >= onsetIndex && index < firstCorrectionIndex
    ? {
        ...frame,
        frequencyHz: anchor.frequencyHz,
        confidence: anchor.confidence,
        voiced: true,
        sourceMidi: anchor.sourceMidi,
        targetMidi: anchor.targetMidi,
        correctionCents: anchor.correctionCents,
        pitchRatio: anchor.pitchRatio,
        hysteresisState: 'stable',
        pendingTargetMidi: null,
        targetHoldMs: 0,
      }
    : frame)
}

function isSimpleHardTune(parameters: TuneGravityParameters): boolean {
  return parameters.gravity === 1
    && parameters.speed === 1
    && parameters.humanize === 0
    && parameters.switchHysteresisCents === 0
    && parameters.minimumTargetHoldMs === 0
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
