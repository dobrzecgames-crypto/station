import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine } from '../audio/AudioEngine.ts'
import { formatProjectKey } from '../music/scales.ts'
import type { ProjectKey } from '../music/scales.ts'
import { ProjectKeyPanel } from '../project/ProjectKeyPanel.tsx'
import type { TuneGravityWorkerDiagnostics, TuneGravityWorkerResponse } from './tuneGravityWorkerProtocol.ts'
import './TuneGravityWorkspace.css'

const maximumTuneGravitySeconds = 30

interface TuneGravitySource {
  filename: string
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
  durationSeconds: number
  sourceChannelCount: number
}

interface TuneGravityWorkspaceProps {
  audioEngine: AudioEngine
  audioReady: boolean
  projectKey: ProjectKey
  onProjectKeyChange: (projectKey: ProjectKey) => void
}

export function TuneGravityWorkspace({ audioEngine, audioReady, projectKey, onProjectKeyChange }: TuneGravityWorkspaceProps) {
  const [source, setSource] = useState<TuneGravitySource | null>(null)
  const [tuned, setTuned] = useState<Float32Array<ArrayBuffer> | null>(null)
  const [gravity, setGravity] = useState(0.72)
  const [speed, setSpeed] = useState(0.7)
  const [humanize, setHumanize] = useState(0.48)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const [auditioning, setAuditioning] = useState<'original' | 'tuned' | null>(null)
  const [diagnostics, setDiagnostics] = useState<TuneGravityWorkerDiagnostics | null>(null)
  const [message, setMessage] = useState('Load a short mono vocal or record one with the microphone.')
  const workerRef = useRef<Worker | null>(null)
  const jobIdRef = useRef(0)
  const recordingRef = useRef(false)
  const recordingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setTuned(null)
    setDiagnostics(null)
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
    setSource({ filename, ...decoded })
    setTuned(null)
    setDiagnostics(null)
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

  const processVocal = () => {
    if (!source || processing) return
    workerRef.current?.terminate()
    const worker = new Worker(new URL('./tuneGravityWorker.ts', import.meta.url), { type: 'module' })
    const jobId = jobIdRef.current + 1
    jobIdRef.current = jobId
    workerRef.current = worker
    setProcessing(true)
    setTuned(null)
    setDiagnostics(null)
    setMessage(`Analysing pitch and applying ${formatProjectKey(projectKey)}…`)
    worker.onmessage = (event: MessageEvent<TuneGravityWorkerResponse>) => {
      if (event.data.jobId !== jobId) return
      worker.terminate()
      workerRef.current = null
      setProcessing(false)
      if (!event.data.ok) {
        setMessage(event.data.message)
        return
      }
      setTuned(new Float32Array(event.data.output))
      setDiagnostics(event.data.diagnostics)
      setMessage('Tuned version ready. Compare ORIGINAL and TUNED by ear.')
    }
    worker.onerror = () => {
      worker.terminate()
      workerRef.current = null
      setProcessing(false)
      setMessage('Tune Gravity worker failed. Try a shorter WAV file.')
    }
    const samples = new Float32Array(source.samples)
    worker.postMessage({
      jobId,
      samples: samples.buffer,
      sampleRate: source.sampleRate,
      projectKey,
      parameters: { gravity, speed, humanize },
    }, [samples.buffer])
  }

  const audition = (version: 'original' | 'tuned') => {
    if (!source || !audioReady) return
    const samples = version === 'original' ? source.samples : tuned
    if (!samples) return
    setAuditioning(version)
    audioEngine.previewMonoSamples(samples, source.sampleRate, () => setAuditioning(null))
  }

  const stopAudition = () => {
    audioEngine.stopPreview()
    setAuditioning(null)
  }

  const downloadTuned = () => {
    if (!source || !tuned) return
    const blob = encodeMonoWav(tuned, source.sampleRate)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = source.filename.replace(/\.wav$/i, '') + '-TUNE-GRAVITY.wav'
    link.click()
    URL.revokeObjectURL(url)
  }

  const busy = loading || processing || recording
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

    <button className="transport-button tune-gravity-process" type="button" disabled={!source || busy} onClick={processVocal}>{processing ? 'PROCESSING OFFLINE…' : 'APPLY TUNE GRAVITY'}</button>

    <div className="tune-gravity-audition" aria-label="A/B vocal comparison">
      <button className={auditioning === 'original' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!source || busy} onClick={() => audition('original')}>▶ ORIGINAL</button>
      <button className={auditioning === 'tuned' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!tuned || busy} onClick={() => audition('tuned')}>▶ TUNED</button>
      <button className="mixer-toggle" type="button" disabled={!auditioning} onClick={stopAudition}>■ STOP</button>
    </div>

    {diagnostics && <dl className="tune-gravity-diagnostics">
      <div><dt>PROCESS</dt><dd>{(diagnostics.processingMs / 1000).toFixed(2)} s</dd></div>
      <div><dt>VOICED</dt><dd>{Math.round(diagnostics.voicedFrameFraction * 100)}%</dd></div>
      <div><dt>CONF</dt><dd>{diagnostics.medianConfidence === null ? '—' : Math.round(diagnostics.medianConfidence * 100) + '%'}</dd></div>
      <div><dt>LOOKAHEAD</dt><dd>{diagnostics.lookaheadMs.toFixed(1)} ms</dd></div>
    </dl>}

    <button className="clear-button tune-gravity-download" type="button" disabled={!tuned || busy} onClick={downloadTuned}>DOWNLOAD TUNED WAV</button>
    <p className="tune-gravity-warning">Listen for metallic tone, wrong octave jumps, damaged consonants and changed vocal identity. This test does not mark the effect as finished.</p>
  </section>
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
