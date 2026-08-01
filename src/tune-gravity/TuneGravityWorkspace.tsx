import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine } from '../audio/AudioEngine.ts'
import { comparisonVariantForBlindLabel, createAnonymousTuneGravitySourceId, createOriginalComparisonAudio, createTuneGravityBenchmarkDocument, createTuneGravityBlindSession, detectTuneGravityBrowserLabel } from '../audio/tuneGravity/index.ts'
import type { PitchDetectorKind, TuneGravityBenchmarkDocument, TuneGravityBlindLabel, TuneGravityBlindSession, TuneGravityComparisonVariantId, TuneGravityDiagnosticDocument, TuneGravityShifter } from '../audio/tuneGravity/index.ts'
import { formatProjectKey } from '../music/scales.ts'
import type { ProjectKey } from '../music/scales.ts'
import { ProjectKeyPanel } from '../project/ProjectKeyPanel.tsx'
import type { TuneGravityWorkerDiagnostics, TuneGravityWorkerResponse } from './tuneGravityWorkerProtocol.ts'
import { TuneGravityDiagnosticPanel } from './TuneGravityDiagnosticPanel.tsx'
import { TuneGravityBlindTestPanel } from './TuneGravityBlindTestPanel.tsx'
import { TuneGravityBenchmarkPanel } from './TuneGravityBenchmarkPanel.tsx'
import type { TuneGravityBenchmarkWorkerResponse } from './tuneGravityBenchmarkWorkerProtocol.ts'
import './TuneGravityWorkspace.css'

const maximumTuneGravitySeconds = 30

interface TuneGravitySource {
  filename: string
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
  durationSeconds: number
  sourceChannelCount: number
  anonymousId: string
}

interface TuneGravityWorkspaceProps {
  audioEngine: AudioEngine
  audioReady: boolean
  projectKey: ProjectKey
  onProjectKeyChange: (projectKey: ProjectKey) => void
}

interface ProcessedTuneGravityVariant {
  samples: Float32Array<ArrayBuffer>
  diagnostics: TuneGravityWorkerDiagnostics
  report: TuneGravityDiagnosticDocument
}

export function TuneGravityWorkspace({ audioEngine, audioReady, projectKey, onProjectKeyChange }: TuneGravityWorkspaceProps) {
  const [source, setSource] = useState<TuneGravitySource | null>(null)
  const [comparisonAudio, setComparisonAudio] = useState<Partial<Record<TuneGravityComparisonVariantId, Float32Array<ArrayBuffer>>>>({})
  const [gravity, setGravity] = useState(0.72)
  const [speed, setSpeed] = useState(0.7)
  const [humanize, setHumanize] = useState(0.48)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const [auditioning, setAuditioning] = useState<TuneGravityComparisonVariantId | TuneGravityBlindLabel | null>(null)
  const [diagnostics, setDiagnostics] = useState<TuneGravityWorkerDiagnostics | null>(null)
  const [diagnosticReport, setDiagnosticReport] = useState<TuneGravityDiagnosticDocument | null>(null)
  const [blindSession, setBlindSession] = useState<TuneGravityBlindSession | null>(null)
  const [benchmarking, setBenchmarking] = useState(false)
  const [benchmarkReport, setBenchmarkReport] = useState<TuneGravityBenchmarkDocument | null>(null)
  const [message, setMessage] = useState('Load a short mono vocal or record one with the microphone.')
  const workerRef = useRef<Worker | null>(null)
  const jobIdRef = useRef(0)
  const recordingRef = useRef(false)
  const recordingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setComparisonAudio({})
    setDiagnostics(null)
    setDiagnosticReport(null)
    setBlindSession(null)
    setBenchmarkReport(null)
    setAuditioning(null)
    audioEngine.stopPreview()
  }, [audioEngine, gravity, speed, humanize, projectKey.root, projectKey.scale])

  useEffect(() => () => {
    workerRef.current?.terminate()
    audioEngine.stopPreview()
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current)
    if (recordingRef.current) audioEngine.cancelMicrophoneRecording()
  }, [audioEngine])

  const loadVocal = async (blob: Blob, filename: string) => {
    if (!audioReady) throw new Error('Press START AUDIO before loading a vocal.')
    if (!/\.wav$/i.test(filename) && blob.type !== 'audio/wav' && blob.type !== 'audio/x-wav') throw new Error('Tune Gravity currently accepts WAV files only.')
    const decoded = await audioEngine.decodeMonoAudioBlob(blob)
    if (decoded.durationSeconds > maximumTuneGravitySeconds) throw new Error(`Use a vocal phrase no longer than ${maximumTuneGravitySeconds} seconds.`)
    if (decoded.durationSeconds < 0.12) throw new Error('The vocal is too short to analyse.')
    setSource({ filename, ...decoded, anonymousId: createAnonymousTuneGravitySourceId(decoded.samples, decoded.sampleRate) })
    setComparisonAudio({})
    setDiagnostics(null)
    setDiagnosticReport(null)
    setBlindSession(null)
    setBenchmarkReport(null)
    setMessage(`${filename} ready • ${decoded.durationSeconds.toFixed(1)} sec • ${decoded.sourceChannelCount === 1 ? 'MONO' : `${decoded.sourceChannelCount}CH → MONO`}`)
  }

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLoading(true)
    try {
      await loadVocal(file, file.name)
    } catch (error) {
      setMessage(toMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const stopRecording = async () => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setRecording(false)
    setMicrophoneLevel(0)
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current)
    recordingTimerRef.current = null
    setLoading(true)
    try {
      const recordingBlob = await audioEngine.stopMicrophoneRecording()
      const wavBlob = await audioEngine.microphoneRecordingToWav(recordingBlob)
      await loadVocal(wavBlob, `TUNE-TAKE-${Date.now()}.wav`)
    } catch (error) {
      setMessage(toMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    if (!audioReady) {
      setMessage('Press START AUDIO before recording.')
      return
    }
    audioEngine.stopPreview()
    setAuditioning(null)
    try {
      await audioEngine.startMicrophoneRecording(setMicrophoneLevel)
      recordingRef.current = true
      setRecording(true)
      setMessage(`Recording vocal • maximum ${maximumTuneGravitySeconds} seconds`)
      recordingTimerRef.current = window.setTimeout(() => { void stopRecording() }, maximumTuneGravitySeconds * 1000)
    } catch (error) {
      setMessage(toMessage(error))
    }
  }

  const processVocal = async () => {
    if (!source || processing) return
    setProcessing(true)
    setComparisonAudio({})
    setDiagnostics(null)
    setDiagnosticReport(null)
    setBlindSession(null)
    setAuditioning(null)
    audioEngine.stopPreview()
    try {
      const configurations: ReadonlyArray<{ id: TuneGravityComparisonVariantId; detector: PitchDetectorKind; shifter: TuneGravityShifter }> = [
        { id: 'yin-td-psola', detector: 'yin', shifter: 'tdPsola' },
        { id: 'yin-granular', detector: 'yin', shifter: 'granular' },
        { id: 'mpm-td-psola', detector: 'mpm', shifter: 'tdPsola' },
      ]
      const rendered: Partial<Record<TuneGravityComparisonVariantId, Float32Array<ArrayBuffer>>> = {
        original: createOriginalComparisonAudio(source.samples) as Float32Array<ArrayBuffer>,
      }
      let primary: ProcessedTuneGravityVariant | null = null
      for (const [index, configuration] of configurations.entries()) {
        setMessage(`Generating blind test variant ${index + 1} of ${configurations.length} for ${formatProjectKey(projectKey)}…`)
        const result = await processVariant(configuration.detector, configuration.shifter)
        rendered[configuration.id] = result.samples
        if (configuration.id === 'yin-td-psola') primary = result
      }
      if (!primary) throw new Error('The primary Tune Gravity diagnostic variant was not generated.')
      setComparisonAudio(rendered)
      setDiagnostics(primary.diagnostics)
      setDiagnosticReport(primary.report)
      setBlindSession(createTuneGravityBlindSession(
        source.anonymousId,
        { projectKey, gravity, speed, humanize },
        Date.now() >>> 0,
      ))
      setMessage('Blind comparison ready. Rate A–D before revealing the algorithms.')
    } catch (error) {
      setMessage(toMessage(error))
    } finally {
      workerRef.current?.terminate()
      workerRef.current = null
      setProcessing(false)
    }
  }

  const processVariant = (detector: PitchDetectorKind, shifter: TuneGravityShifter): Promise<ProcessedTuneGravityVariant> => {
    if (!source) return Promise.reject(new Error('Load a vocal before processing.'))
    workerRef.current?.terminate()
    const worker = new Worker(new URL('./tuneGravityWorker.ts', import.meta.url), { type: 'module' })
    const jobId = jobIdRef.current + 1
    jobIdRef.current = jobId
    workerRef.current = worker
    return new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<TuneGravityWorkerResponse>) => {
        if (event.data.jobId !== jobId) return
        worker.terminate()
        workerRef.current = null
        if (!event.data.ok) {
          reject(new Error(event.data.message))
          return
        }
        resolve({ samples: new Float32Array(event.data.output), diagnostics: event.data.diagnostics, report: event.data.report })
      }
      worker.onerror = () => {
        worker.terminate()
        workerRef.current = null
        reject(new Error('Tune Gravity worker failed. Try a shorter WAV file.'))
      }
      const samples = new Float32Array(source.samples)
      worker.postMessage({
        jobId,
        samples: samples.buffer,
        sampleRate: source.sampleRate,
        sourceChannelCount: source.sourceChannelCount,
        durationSeconds: source.durationSeconds,
        anonymousSourceId: source.anonymousId,
        projectKey,
        parameters: { gravity, speed, humanize },
        detector,
        shifter,
      }, [samples.buffer])
    })
  }

  const auditionVariant = (variant: TuneGravityComparisonVariantId, displayId: TuneGravityComparisonVariantId | TuneGravityBlindLabel = variant) => {
    if (!source || !audioReady) return
    const samples = comparisonAudio[variant]
    if (!samples) return
    setAuditioning(displayId)
    audioEngine.previewMonoSamples(samples, source.sampleRate, () => setAuditioning(null))
  }

  const stopAudition = () => {
    audioEngine.stopPreview()
    setAuditioning(null)
  }

  const downloadTuned = () => {
    const tuned = comparisonAudio['yin-td-psola']
    if (!source || !tuned) return
    const blob = encodeMonoWav(tuned, source.sampleRate)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = source.filename.replace(/\.wav$/i, '') + '-TUNE-GRAVITY.wav'
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadDiagnostics = () => {
    if (!source || !diagnosticReport) return
    downloadJson(diagnosticReport, source.filename.replace(/\.wav$/i, '') + '-TUNE-DIAGNOSTICS.json')
  }

  const runBenchmark = async () => {
    if (!source || benchmarking) return
    setBenchmarking(true)
    setBenchmarkReport(null)
    setMessage('Running QUALITY benchmark. Keep this tab visible until it finishes.')
    let backgroundedDuringRun = document.hidden
    const markBackgrounded = () => { if (document.hidden) backgroundedDuringRun = true }
    document.addEventListener('visibilitychange', markBackgrounded)
    const measuredHeapBeforeBytes = readMeasuredHeapBytes()
    try {
      const timings = await runBenchmarkWorker()
      const report = createTuneGravityBenchmarkDocument({
        anonymousSourceId: source.anonymousId,
        sampleRate: source.sampleRate,
        durationSeconds: source.durationSeconds,
        sampleCount: source.samples.length,
        projectKey,
        parameters: { gravity, speed, humanize },
        timings,
        browserLabel: detectTuneGravityBrowserLabel(navigator.userAgent),
        userAgent: navigator.userAgent,
        backgroundedDuringRun,
        measuredHeapBeforeBytes,
        measuredHeapAfterBytes: readMeasuredHeapBytes(),
      })
      setBenchmarkReport(report)
      setMessage(`QUALITY benchmark complete: ${report.processingToAudioRatio?.toFixed(2) ?? '—'}× audio duration.`)
    } catch (error) {
      const errorMessage = toMessage(error)
      setBenchmarkReport(createTuneGravityBenchmarkDocument({
        anonymousSourceId: source.anonymousId,
        sampleRate: source.sampleRate,
        durationSeconds: source.durationSeconds,
        sampleCount: source.samples.length,
        projectKey,
        parameters: { gravity, speed, humanize },
        timings: { yinMs: null, mpmMs: null, tdPsolaMs: null, granularMs: null, totalMs: null },
        browserLabel: detectTuneGravityBrowserLabel(navigator.userAgent),
        userAgent: navigator.userAgent,
        backgroundedDuringRun,
        interrupted: true,
        error: errorMessage,
        measuredHeapBeforeBytes,
        measuredHeapAfterBytes: readMeasuredHeapBytes(),
      }))
      setMessage(errorMessage)
    } finally {
      document.removeEventListener('visibilitychange', markBackgrounded)
      workerRef.current?.terminate()
      workerRef.current = null
      setBenchmarking(false)
    }
  }

  const runBenchmarkWorker = (): Promise<{ yinMs: number; mpmMs: number; tdPsolaMs: number; granularMs: number; totalMs: number }> => {
    if (!source) return Promise.reject(new Error('Load a vocal before benchmarking.'))
    workerRef.current?.terminate()
    const worker = new Worker(new URL('./tuneGravityBenchmarkWorker.ts', import.meta.url), { type: 'module' })
    const jobId = jobIdRef.current + 1
    jobIdRef.current = jobId
    workerRef.current = worker
    return new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<TuneGravityBenchmarkWorkerResponse>) => {
        if (event.data.jobId !== jobId) return
        worker.terminate()
        workerRef.current = null
        if (event.data.ok) resolve(event.data.timings)
        else reject(new Error(event.data.message))
      }
      worker.onerror = () => {
        worker.terminate()
        workerRef.current = null
        reject(new Error('Tune Gravity benchmark worker failed.'))
      }
      const samples = new Float32Array(source.samples)
      worker.postMessage({ jobId, samples: samples.buffer, sampleRate: source.sampleRate, projectKey, parameters: { gravity, speed, humanize } }, [samples.buffer])
    })
  }

  const copyBenchmark = async () => {
    if (!benchmarkReport) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(benchmarkReport, null, 2))
      setMessage('Benchmark JSON copied to clipboard.')
    } catch {
      setMessage('Clipboard access was denied. Use EXPORT BENCHMARK JSON instead.')
    }
  }

  const busy = loading || processing || recording || benchmarking
  const blindComplete = blindSession?.completedAt !== null && blindSession !== null
  return <section className="tune-gravity-workspace" aria-labelledby="tune-gravity-title">
    <header className="tune-gravity-heading">
      <div>
        <p className="eyebrow">VOCAL PITCH • QUALITY PROTOTYPE</p>
        <h2 id="tune-gravity-title">TUNE GRAVITY</h2>
      </div>
      <span className="tune-gravity-badge">MONO • MAX {maximumTuneGravitySeconds} SEC</span>
    </header>

    <p className="tune-gravity-message" role="status">{message}</p>

    <div className="tune-gravity-source-actions">
      <label className="file-picker-button tune-gravity-file-button">
        {loading ? 'LOADING…' : 'LOAD VOCAL WAV'}
        <input type="file" accept=".wav,audio/wav,audio/x-wav" disabled={busy || !audioReady} onChange={(event) => void chooseFile(event)} />
      </label>
      <button className={recording ? 'transport-button tune-record-active' : 'transport-button'} type="button" disabled={loading || processing || !audioReady} onClick={() => recording ? void stopRecording() : void startRecording()}>{recording ? 'STOP & USE TAKE' : 'RECORD VOCAL'}</button>
    </div>

    {recording && <div className="tune-record-meter" aria-label="Microphone input level"><span style={{ width: `${Math.round(microphoneLevel * 100)}%` }} /></div>}

    <ProjectKeyPanel projectKey={projectKey} disabled={busy} onChange={onProjectKeyChange} />

    <div className="tune-gravity-controls">
      <TuneSlider label="GRAVITY" value={gravity} disabled={busy} onChange={setGravity} low="SUBTLE" high="HARD" />
      <TuneSlider label="SPEED" value={speed} disabled={busy} onChange={setSpeed} low="NATURAL" high="FAST" />
      <TuneSlider label="HUMANIZE" value={humanize} disabled={busy} onChange={setHumanize} low="TIGHT" high="VIBRATO" />
    </div>

    <button className="transport-button tune-gravity-process" type="button" disabled={!source || busy} onClick={() => void processVocal()}>{processing ? 'GENERATING VARIANTS…' : 'GENERATE BLIND TEST SET'}</button>

    {blindSession && <TuneGravityBlindTestPanel
      session={blindSession}
      auditioningLabel={auditioning === 'A' || auditioning === 'B' || auditioning === 'C' || auditioning === 'D' ? auditioning : null}
      disabled={busy}
      onAudition={(label) => auditionVariant(comparisonVariantForBlindLabel(blindSession, label), label)}
      onStop={stopAudition}
      onChange={setBlindSession}
    />}

    {blindComplete && <div className="tune-labeled-comparison" aria-label="Revealed algorithm comparison">
      <p className="eyebrow">REVEALED ALGORITHM PLAYBACK</p>
      <div className="tune-labeled-players">
        {(['original', 'yin-td-psola', 'yin-granular', 'mpm-td-psola'] as const).map((variant) => <button key={variant} className={auditioning === variant ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!comparisonAudio[variant] || busy} onClick={() => auditionVariant(variant)}>▶ {comparisonVariantLabel(variant)}</button>)}
        <button className="mixer-toggle" type="button" disabled={!auditioning} onClick={stopAudition}>■ STOP</button>
      </div>
    </div>}

    {diagnostics && <dl className="tune-gravity-diagnostics">
      <div><dt>PROCESS</dt><dd>{(diagnostics.processingMs / 1000).toFixed(2)} s</dd></div>
      <div><dt>VOICED</dt><dd>{Math.round(diagnostics.voicedFrameFraction * 100)}%</dd></div>
      <div><dt>CONF</dt><dd>{diagnostics.medianConfidence === null ? '—' : Math.round(diagnostics.medianConfidence * 100) + '%'}</dd></div>
      <div><dt>LOOKAHEAD</dt><dd>{diagnostics.lookaheadMs.toFixed(1)} ms</dd></div>
    </dl>}

    {source && diagnosticReport && blindComplete && <TuneGravityDiagnosticPanel samples={source.samples} report={diagnosticReport} />}

    {blindComplete && <div className="tune-gravity-downloads">
      <button className="clear-button tune-gravity-download" type="button" disabled={!comparisonAudio['yin-td-psola'] || busy} onClick={downloadTuned}>DOWNLOAD YIN + TD-PSOLA WAV</button>
      <button className="clear-button tune-gravity-download" type="button" disabled={!diagnosticReport || busy} onClick={downloadDiagnostics}>EXPORT DIAGNOSTIC JSON</button>
    </div>}
    {source && <TuneGravityBenchmarkPanel
      report={benchmarkReport}
      running={benchmarking}
      disabled={loading || processing || recording}
      onRun={() => void runBenchmark()}
      onCopy={() => void copyBenchmark()}
      onExport={() => { if (benchmarkReport) downloadJson(benchmarkReport, `${source.anonymousId}-QUALITY-BENCHMARK.json`) }}
    />}
    <p className="tune-gravity-warning">Listen for metallic tone, wrong octave jumps, damaged consonants and changed vocal identity. This test does not mark the effect as finished.</p>
  </section>
}

function comparisonVariantLabel(variant: TuneGravityComparisonVariantId): string {
  if (variant === 'original') return 'ORIGINAL'
  if (variant === 'yin-td-psola') return 'YIN + TD-PSOLA'
  if (variant === 'yin-granular') return 'YIN + GRANULAR'
  return 'MPM + TD-PSOLA'
}

function TuneSlider({ label, value, disabled, onChange, low, high }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void; low: string; high: string }) {
  return <label className="tune-gravity-slider">
    <span>{label}</span><output>{Math.round(value * 100)}%</output>
    <input type="range" min="0" max="1" step="0.01" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    <small><span>{low}</span><span>{high}</span></small>
  </label>
}

function encodeMonoWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.min(1, Math.max(-1, samples[index]!))
    view.setInt16(44 + index * 2, Math.round(sample < 0 ? sample * 32768 : sample * 32767), true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Tune Gravity could not complete that action.'
}

function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function readMeasuredHeapBytes(): number | null {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory
  return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null
}
