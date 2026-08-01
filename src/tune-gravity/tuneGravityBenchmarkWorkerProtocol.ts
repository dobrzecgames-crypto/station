import type { ProjectKey } from '../music/scales.ts'
import type { TuneGravityParameters } from '../audio/tuneGravity/index.ts'

export interface TuneGravityBenchmarkWorkerRequest {
  jobId: number
  samples: ArrayBuffer
  sampleRate: number
  projectKey: ProjectKey
  parameters: Pick<TuneGravityParameters, 'gravity' | 'speed' | 'humanize'>
}

export type TuneGravityBenchmarkWorkerResponse = {
  jobId: number
  ok: true
  timings: {
    yinMs: number
    mpmMs: number
    tdPsolaMs: number
    granularMs: number
    totalMs: number
  }
} | {
  jobId: number
  ok: false
  message: string
}
