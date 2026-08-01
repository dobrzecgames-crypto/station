import {
  analyzePitch,
  createCorrectionPlan,
  defaultPitchDetectorOptions,
  resolveTuneGravityParameters,
  shiftPitchGranular,
  shiftPitchTdPsola,
} from '../audio/tuneGravity/index.ts'
import type { TuneGravityBenchmarkWorkerRequest, TuneGravityBenchmarkWorkerResponse } from './tuneGravityBenchmarkWorkerProtocol.ts'

interface WorkerScope {
  onmessage: ((event: MessageEvent<TuneGravityBenchmarkWorkerRequest>) => void) | null
  postMessage(message: TuneGravityBenchmarkWorkerResponse): void
}

const workerScope = self as unknown as WorkerScope

workerScope.onmessage = (event) => {
  const request = event.data
  try {
    const input = new Float32Array(request.samples)
    const parameters = resolveTuneGravityParameters(request.parameters)
    const totalStarted = performance.now()

    const yinStarted = performance.now()
    const yinFrames = analyzePitch(input, request.sampleRate, { detector: 'yin' })
    const yinMs = performance.now() - yinStarted

    const mpmStarted = performance.now()
    analyzePitch(input, request.sampleRate, { detector: 'mpm' })
    const mpmMs = performance.now() - mpmStarted

    const plan = createCorrectionPlan(yinFrames, request.projectKey, request.sampleRate, defaultPitchDetectorOptions.hopSize, parameters)
    const tdPsolaStarted = performance.now()
    shiftPitchTdPsola(input, request.sampleRate, plan)
    const tdPsolaMs = performance.now() - tdPsolaStarted

    const granularStarted = performance.now()
    shiftPitchGranular(input, request.sampleRate, plan)
    const granularMs = performance.now() - granularStarted

    workerScope.postMessage({
      jobId: request.jobId,
      ok: true,
      timings: { yinMs, mpmMs, tdPsolaMs, granularMs, totalMs: performance.now() - totalStarted },
    })
  } catch (error) {
    workerScope.postMessage({
      jobId: request.jobId,
      ok: false,
      message: error instanceof Error ? error.message : 'Tune Gravity benchmark failed.',
    })
  }
}
