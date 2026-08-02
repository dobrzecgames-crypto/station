import type { ProjectKey } from '../music/scales.ts'
import type { PitchDetectorKind, TuneGravityDiagnosticDocument, TuneGravityParameters, TuneGravityShifter } from '../audio/tuneGravity/index.ts'

export interface TuneGravityWorkerRequest {
  jobId: number
  samples: ArrayBuffer
  sampleRate: number
  sourceChannelCount: number
  durationSeconds: number
  anonymousSourceId: string
  projectKey: ProjectKey
  parameters: Partial<TuneGravityParameters>
  detector?: PitchDetectorKind
  shifter?: TuneGravityShifter
}

export interface TuneGravityWorkerDiagnostics {
  processingMs: number
  voicedFrameFraction: number
  medianConfidence: number | null
  medianAbsoluteCorrectionCents: number | null
  maximumAbsoluteCorrectionCents: number | null
  lookaheadMs: number
}

export type TuneGravityWorkerResponse = {
  jobId: number
  ok: true
  output: ArrayBuffer
  diagnostics: TuneGravityWorkerDiagnostics
  report: TuneGravityDiagnosticDocument
} | {
  jobId: number
  ok: false
  message: string
}
