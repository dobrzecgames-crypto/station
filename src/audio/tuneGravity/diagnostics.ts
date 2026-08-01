import { noteNames } from '../../music/scales.ts'
import type { TuneGravityPrototypeResult } from './index.ts'
import { midiToFrequency } from './correctionPlan.ts'

export const tuneGravityDiagnosticFormatVersion = 1 as const

export type TuneGravityDiagnosticSkipReason =
  | 'low-rms'
  | 'low-confidence'
  | 'no-f0'
  | 'no-target'
  | 'gravity-zero'
  | 'within-dead-zone'

export type TuneGravityDiagnosticRegionKind = 'voiced' | 'unvoiced' | 'stable-note' | 'transition' | 'uncertain'

export type TuneGravityDiagnosticProblemKind =
  | 'possible-octave-error'
  | 'sudden-f0-jump'
  | 'note-chatter'
  | 'large-correction'
  | 'low-confidence'
  | 'voiced-unvoiced-chatter'

export interface TuneGravityDiagnosticFrame {
  frameIndex: number
  timestampSeconds: number
  centerSample: number
  rms: number
  detectedFrequencyHz: number | null
  confidence: number
  voiced: boolean
  detectedMidi: number | null
  detectedCents: number | null
  targetMidi: number | null
  targetNote: string | null
  targetFrequencyHz: number | null
  correctionCents: number
  correctionRatio: number
  correctionSkipped: boolean
  skipReason: TuneGravityDiagnosticSkipReason | null
  hysteresisState: 'inactive' | 'released' | 'stable' | 'candidate'
  pendingTargetMidi: number | null
  targetHoldMs: number
}

export interface TuneGravityDiagnosticRegion {
  id: string
  kind: TuneGravityDiagnosticRegionKind
  startSeconds: number
  endSeconds: number
  startFrame: number
  endFrame: number
  medianFrequencyHz: number | null
  medianConfidence: number
  targetMidi: number | null
  targetNote: string | null
  meanCorrectionCents: number
  maximumAbsoluteCorrectionCents: number
}

export interface TuneGravityDiagnosticProblem {
  kind: TuneGravityDiagnosticProblemKind
  frameIndex: number
  timestampSeconds: number
  severity: 'info' | 'warning'
  detail: string
}

export interface TuneGravityDiagnosticDocument {
  format: 'station-tune-gravity-diagnostic'
  version: typeof tuneGravityDiagnosticFormatVersion
  createdAt: string
  source: {
    anonymousId: string
    sampleRate: number
    sourceChannelCount: number
    durationSeconds: number
    sampleCount: number
  }
  analysis: {
    detector: TuneGravityPrototypeResult['detector']
    shifter: TuneGravityPrototypeResult['shifter']
    projectKey: TuneGravityPrototypeResult['projectKey']['root']
    projectScale: TuneGravityPrototypeResult['projectKey']['scale']
    gravity: number
    speed: number
    humanize: number
    confidenceThreshold: number
    rmsThreshold: number
    minimumFrequencyHz: number
    maximumFrequencyHz: number
    frameSize: number
    hopSize: number
    algorithmicLookaheadSamples: number
  }
  summary: {
    frameCount: number
    voicedFrameCount: number
    voicedFrameFraction: number
    medianConfidence: number | null
    problemCount: number
  }
  frames: TuneGravityDiagnosticFrame[]
  regions: TuneGravityDiagnosticRegion[]
  problems: TuneGravityDiagnosticProblem[]
}

export interface CreateTuneGravityDiagnosticOptions {
  anonymousSourceId: string
  sampleRate: number
  sourceChannelCount: number
  durationSeconds: number
  sampleCount: number
  createdAt?: string
}

export function createAnonymousTuneGravitySourceId(samples: Float32Array, sampleRate: number): string {
  let hash = 0x811c9dc5
  const stride = Math.max(1, Math.floor(samples.length / 512))
  for (let index = 0; index < samples.length; index += stride) {
    const quantized = Math.round(Math.max(-1, Math.min(1, samples[index]!)) * 32767)
    hash ^= quantized & 0xff
    hash = Math.imul(hash, 0x01000193)
    hash ^= quantized >>> 8 & 0xff
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= samples.length
  hash = Math.imul(hash, 0x01000193)
  hash ^= sampleRate
  return `tg-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function createTuneGravityDiagnosticDocument(
  result: TuneGravityPrototypeResult,
  options: CreateTuneGravityDiagnosticOptions,
): TuneGravityDiagnosticDocument {
  const frames = result.correctionPlan.map((frame): TuneGravityDiagnosticFrame => {
    const skipReason = diagnosticSkipReason(frame, result)
    return {
      frameIndex: frame.frameIndex,
      timestampSeconds: frame.timeSeconds,
      centerSample: frame.centerSample,
      rms: frame.rms,
      detectedFrequencyHz: frame.frequencyHz,
      confidence: frame.confidence,
      voiced: frame.voiced,
      detectedMidi: frame.sourceMidi,
      detectedCents: frame.sourceMidi === null ? null : (frame.sourceMidi - Math.round(frame.sourceMidi)) * 100,
      targetMidi: frame.targetMidi,
      targetNote: midiNoteName(frame.targetMidi),
      targetFrequencyHz: frame.targetMidi === null ? null : midiToFrequency(frame.targetMidi),
      correctionCents: frame.correctionCents,
      correctionRatio: frame.pitchRatio,
      correctionSkipped: skipReason !== null,
      skipReason,
      hysteresisState: frame.hysteresisState,
      pendingTargetMidi: frame.pendingTargetMidi,
      targetHoldMs: frame.targetHoldMs,
    }
  })
  const regions = createDiagnosticRegions(frames, result.detectorOptions.hopSize / options.sampleRate)
  const problems = detectTuneGravityProblems(frames, result.detectorOptions.confidenceThreshold)
  const voicedConfidences = frames.filter((frame) => frame.voiced).map((frame) => frame.confidence)

  return {
    format: 'station-tune-gravity-diagnostic',
    version: tuneGravityDiagnosticFormatVersion,
    createdAt: options.createdAt ?? new Date().toISOString(),
    source: {
      anonymousId: options.anonymousSourceId,
      sampleRate: options.sampleRate,
      sourceChannelCount: options.sourceChannelCount,
      durationSeconds: options.durationSeconds,
      sampleCount: options.sampleCount,
    },
    analysis: {
      detector: result.detector,
      shifter: result.shifter,
      projectKey: result.projectKey.root,
      projectScale: result.projectKey.scale,
      gravity: result.parameters.gravity,
      speed: result.parameters.speed,
      humanize: result.parameters.humanize,
      confidenceThreshold: result.detectorOptions.confidenceThreshold,
      rmsThreshold: result.detectorOptions.rmsThreshold,
      minimumFrequencyHz: result.detectorOptions.minimumFrequencyHz,
      maximumFrequencyHz: result.detectorOptions.maximumFrequencyHz,
      frameSize: result.detectorOptions.frameSize,
      hopSize: result.detectorOptions.hopSize,
      algorithmicLookaheadSamples: result.algorithmicLookaheadSamples,
    },
    summary: {
      frameCount: frames.length,
      voicedFrameCount: voicedConfidences.length,
      voicedFrameFraction: frames.length === 0 ? 0 : voicedConfidences.length / frames.length,
      medianConfidence: medianOrNull(voicedConfidences),
      problemCount: problems.length,
    },
    frames,
    regions,
    problems,
  }
}

export function detectTuneGravityProblems(
  frames: readonly TuneGravityDiagnosticFrame[],
  confidenceThreshold = 0.72,
): TuneGravityDiagnosticProblem[] {
  const problems: TuneGravityDiagnosticProblem[] = []
  const add = (kind: TuneGravityDiagnosticProblemKind, frame: TuneGravityDiagnosticFrame, severity: 'info' | 'warning', detail: string) => {
    if (problems.some((problem) => problem.kind === kind && problem.frameIndex === frame.frameIndex)) return
    problems.push({ kind, frameIndex: frame.frameIndex, timestampSeconds: frame.timestampSeconds, severity, detail })
  }

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!
    const previous = frames[index - 1]
    if (frame.voiced && frame.confidence < confidenceThreshold + 0.06) add('low-confidence', frame, 'info', `Confidence ${frame.confidence.toFixed(2)} is close to the voiced threshold.`)
    if (Math.abs(frame.correctionCents) >= 200) add('large-correction', frame, 'warning', `Correction reaches ${Math.round(frame.correctionCents)} cents.`)
    if (previous?.detectedMidi !== null && previous?.detectedMidi !== undefined && frame.detectedMidi !== null) {
      const jump = Math.abs(frame.detectedMidi - previous.detectedMidi)
      if (jump >= 5) add('sudden-f0-jump', frame, 'warning', `Detected F0 jumps by ${jump.toFixed(1)} semitones.`)
    }

    if (index >= 2 && index + 2 < frames.length && frame.detectedMidi !== null && frame.confidence >= confidenceThreshold) {
      const neighborMidi = [frames[index - 2]!, frames[index - 1]!, frames[index + 1]!, frames[index + 2]!]
        .map((neighbor) => neighbor.detectedMidi)
        .filter((value): value is number => value !== null)
      const neighborMedian = medianOrNull(neighborMidi)
      if (neighborMedian !== null) {
        const octaveDistance = Math.abs(frame.detectedMidi - neighborMedian)
        const neighborRms = medianOrNull([frames[index - 1]!.rms, frames[index + 1]!.rms]) ?? frame.rms
        const rmsStable = neighborRms <= 1e-9 || Math.abs(frame.rms - neighborRms) / neighborRms < 0.45
        if (Math.abs(octaveDistance - 12) <= 0.8 && rmsStable) add('possible-octave-error', frame, 'warning', `Short F0 value is ${octaveDistance.toFixed(1)} semitones from its neighbours.`)
      }
    }

    const recent = frames.slice(Math.max(0, index - 9), index + 1)
    const targetChanges = countChanges(recent.map((candidate) => candidate.targetMidi))
    if (targetChanges >= 2) add('note-chatter', frame, 'warning', `${targetChanges} target-note changes occurred in a short window.`)
    const voicedChanges = countChanges(recent.map((candidate) => candidate.voiced))
    if (voicedChanges >= 3) add('voiced-unvoiced-chatter', frame, 'warning', `${voicedChanges} voiced/unvoiced changes occurred in a short window.`)
  }
  return problems
}

function diagnosticSkipReason(
  frame: TuneGravityPrototypeResult['correctionPlan'][number],
  result: TuneGravityPrototypeResult,
): TuneGravityDiagnosticSkipReason | null {
  if (frame.rms < result.detectorOptions.rmsThreshold) return 'low-rms'
  if (!frame.voiced && frame.confidence < result.detectorOptions.confidenceThreshold) return 'low-confidence'
  if (frame.frequencyHz === null || frame.sourceMidi === null) return 'no-f0'
  if (frame.targetMidi === null) return 'no-target'
  if (result.parameters.gravity <= 0) return 'gravity-zero'
  if (Math.abs(frame.correctionCents) <= 0.05) return 'within-dead-zone'
  return null
}

function createDiagnosticRegions(
  frames: readonly TuneGravityDiagnosticFrame[],
  hopSeconds: number,
): TuneGravityDiagnosticRegion[] {
  if (frames.length === 0) return []
  const regions: TuneGravityDiagnosticRegion[] = []
  let start = 0
  let kind = classifyFrame(frames, 0)
  for (let index = 1; index <= frames.length; index += 1) {
    const nextKind = index < frames.length ? classifyFrame(frames, index) : null
    if (nextKind === kind) continue
    const slice = frames.slice(start, index)
    const targetMidi = modeOrNull(slice.map((frame) => frame.targetMidi).filter((value): value is number => value !== null))
    const corrections = slice.map((frame) => frame.correctionCents)
    regions.push({
      id: `region-${String(regions.length + 1).padStart(4, '0')}`,
      kind,
      startSeconds: Math.max(0, slice[0]!.timestampSeconds - hopSeconds / 2),
      endSeconds: slice[slice.length - 1]!.timestampSeconds + hopSeconds / 2,
      startFrame: slice[0]!.frameIndex,
      endFrame: slice[slice.length - 1]!.frameIndex,
      medianFrequencyHz: medianOrNull(slice.map((frame) => frame.detectedFrequencyHz).filter((value): value is number => value !== null)),
      medianConfidence: medianOrNull(slice.map((frame) => frame.confidence)) ?? 0,
      targetMidi,
      targetNote: midiNoteName(targetMidi),
      meanCorrectionCents: corrections.reduce((sum, value) => sum + value, 0) / corrections.length,
      maximumAbsoluteCorrectionCents: Math.max(...corrections.map(Math.abs)),
    })
    start = index
    if (nextKind !== null) kind = nextKind
  }
  return regions
}

function classifyFrame(frames: readonly TuneGravityDiagnosticFrame[], index: number): TuneGravityDiagnosticRegionKind {
  const frame = frames[index]!
  if (!frame.voiced || frame.detectedFrequencyHz === null) return 'unvoiced'
  if (frame.confidence < 0.78) return 'uncertain'
  const previous = frames[index - 1]
  const targetChanged = previous?.targetMidi !== null && previous?.targetMidi !== undefined && frame.targetMidi !== previous.targetMidi
  const pitchMoved = previous?.detectedMidi !== null && previous?.detectedMidi !== undefined && frame.detectedMidi !== null && Math.abs(frame.detectedMidi - previous.detectedMidi) > 0.5
  if (frame.hysteresisState === 'candidate' || targetChanged || pitchMoved) return 'transition'
  if (frame.targetHoldMs >= 120) return 'stable-note'
  return 'voiced'
}

function midiNoteName(midi: number | null): string | null {
  if (midi === null || !Number.isFinite(midi)) return null
  const rounded = Math.round(midi)
  const pitchClass = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return `${noteNames[pitchClass]}${octave}`
}

function countChanges<T>(values: readonly T[]): number {
  let changes = 0
  for (let index = 1; index < values.length; index += 1) if (values[index] !== values[index - 1]) changes += 1
  return changes
}

function medianOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

function modeOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((first, second) => second[1] - first[1] || first[0] - second[0])[0]![0]
}
