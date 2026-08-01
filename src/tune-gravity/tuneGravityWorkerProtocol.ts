import type { ProjectKey } from '../music/scales.ts'
import type { TuneGravityParameters } from '../audio/tuneGravity/index.ts'

export interface TuneGravityWorkerRequest {
  jobId: number
  samples: ArrayBuffer
  sampleRate: number
  projectKey: ProjectKey
  parameters: Pick<TuneGravityParameters, 'gravity' | 'speed' | 'humanize'>
}

export interface TuneGravityWorkerDiagnostics {
  processingMs: number
  voicedFrameFraction: number
  medianConfidence: number | null
  lookaheadMs: number
}

export type TuneGravityWorkerResponse = {
  jobId: number
  ok: true
  output: ArrayBuffer
  diagnostics: TuneGravityWorkerDiagnostics
} | {
  jobId: number
  ok: false
  message: string
}
