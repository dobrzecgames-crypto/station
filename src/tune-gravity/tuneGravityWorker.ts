import { processTuneGravityOffline } from '../audio/tuneGravity/index.ts'
import type { TuneGravityWorkerRequest, TuneGravityWorkerResponse } from './tuneGravityWorkerProtocol.ts'

interface WorkerScope {
  onmessage: ((event: MessageEvent<TuneGravityWorkerRequest>) => void) | null
  postMessage(message: TuneGravityWorkerResponse, transfer?: Transferable[]): void
}

const workerScope = self as unknown as WorkerScope

workerScope.onmessage = (event) => {
  const request = event.data
  try {
    const startedAt = performance.now()
    const result = processTuneGravityOffline(new Float32Array(request.samples), request.sampleRate, {
      projectKey: request.projectKey,
      detector: 'yin',
      shifter: 'tdPsola',
      parameters: request.parameters,
    })
    const voiced = result.pitchFrames.filter((frame) => frame.voiced)
    const confidences = voiced.map((frame) => frame.confidence).sort((first, second) => first - second)
    const middle = Math.floor(confidences.length / 2)
    const medianConfidence = confidences.length === 0
      ? null
      : confidences.length % 2 === 0
        ? (confidences[middle - 1]! + confidences[middle]!) / 2
        : confidences[middle]!
    const output = new Float32Array(result.output)
    workerScope.postMessage({
      jobId: request.jobId,
      ok: true,
      output: output.buffer,
      diagnostics: {
        processingMs: performance.now() - startedAt,
        voicedFrameFraction: result.pitchFrames.length > 0 ? voiced.length / result.pitchFrames.length : 0,
        medianConfidence,
        lookaheadMs: result.algorithmicLookaheadSamples / request.sampleRate * 1000,
      },
    }, [output.buffer])
  } catch (error) {
    workerScope.postMessage({
      jobId: request.jobId,
      ok: false,
      message: error instanceof Error ? error.message : 'Tune Gravity processing failed.',
    })
  }
}
