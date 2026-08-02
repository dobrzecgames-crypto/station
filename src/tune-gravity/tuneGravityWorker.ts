import { createTuneGravityDiagnosticDocument, processTuneGravityOffline } from '../audio/tuneGravity/index.ts'
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
      detector: request.detector ?? 'yin',
      shifter: request.shifter ?? 'tdPsola',
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
    const absoluteCorrections = result.correctionPlan
      .filter((frame) => frame.voiced && frame.targetMidi !== null)
      .map((frame) => Math.abs(frame.correctionCents))
      .sort((first, second) => first - second)
    const correctionMiddle = Math.floor(absoluteCorrections.length / 2)
    const medianAbsoluteCorrectionCents = absoluteCorrections.length === 0
      ? null
      : absoluteCorrections.length % 2 === 0
        ? (absoluteCorrections[correctionMiddle - 1]! + absoluteCorrections[correctionMiddle]!) / 2
        : absoluteCorrections[correctionMiddle]!
    const output = new Float32Array(result.output)
    const report = createTuneGravityDiagnosticDocument(result, {
      anonymousSourceId: request.anonymousSourceId,
      sampleRate: request.sampleRate,
      sourceChannelCount: request.sourceChannelCount,
      durationSeconds: request.durationSeconds,
      sampleCount: output.length,
    })
    workerScope.postMessage({
      jobId: request.jobId,
      ok: true,
      output: output.buffer,
      diagnostics: {
        processingMs: performance.now() - startedAt,
        voicedFrameFraction: result.pitchFrames.length > 0 ? voiced.length / result.pitchFrames.length : 0,
        medianConfidence,
        medianAbsoluteCorrectionCents,
        maximumAbsoluteCorrectionCents: absoluteCorrections.at(-1) ?? null,
        lookaheadMs: result.algorithmicLookaheadSamples / request.sampleRate * 1000,
      },
      report,
    }, [output.buffer])
  } catch (error) {
    workerScope.postMessage({
      jobId: request.jobId,
      ok: false,
      message: error instanceof Error ? error.message : 'Tune Gravity processing failed.',
    })
  }
}
