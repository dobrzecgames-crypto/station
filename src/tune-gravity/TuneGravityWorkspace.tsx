import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine } from '../audio/AudioEngine.ts'
import { simpleAutoTuneParameters } from '../audio/tuneGravity/index.ts'
import type { ProjectKey } from '../music/scales.ts'
import { formatProjectKey } from '../music/scales.ts'
import { ProjectKeyPanel } from '../project/ProjectKeyPanel.tsx'
import type { TuneGravityWorkerResponse } from './tuneGravityWorkerProtocol.ts'
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

export function TuneGravityWorkspace({ audioEngine, audioReady, projectKey, onProjectKeyChange }: TuneGravityWorkspaceProps) {
  const [source, setSource] = useState<TuneGravitySource | null>(null)
  const [tunedAudio, setTunedAudio] = useState<Float32Array<ArrayBuffer> | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const [auditioning, setAuditioning] = useState<'original' | 'autotune' | null>(null)
  const [message, setMessage] = useState('Load a short vocal or record one with the microphone.')
  const workerRef = useRef<Worker | null>(null)
  const jobIdRef = useRef(0)
  const recordingRef = useRef(false)
  const recordingTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    workerRef.current?.terminate()
    audioEngine.stopPreview()
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current)
    if (recordingRef.current) audioEngine.cancelMicrophoneRecording()
  }, [audioEngine])

  const resetResult = () => {
    setTunedAudio(null)
    setAuditioning(null)
    audioEngine.stopPreview()
  }

  const loadVocal = async (blob: Blob, filename: string) => {
    if (!audioReady) throw new Error('Press START AUDIO before loading a vocal.')
    const supportedExtension = /\.(wav|m4a)$/i.test(filename)
    const supportedMime = ['audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'].includes(blob.type)
    if (!supportedExtension && !supportedMime) throw new Error('TUNE accepts WAV and M4A voice recordings.')
    const decoded = await audioEngine.decodeMonoAudioBlob(blob)
    if (decoded.durationSeconds > maximumTuneGravitySeconds) throw new Error(`Use a vocal phrase no longer than ${maximumTuneGravitySeconds} seconds.`)
    if (decoded.durationSeconds < 0.12) throw new Error('The vocal is too short to analyse.')
    setSource({
      filename,
      ...decoded,
      anonymousId: createAnonymousSourceId(decoded.samples, decoded.sampleRate),
    })
    resetResult()
    setMessage(`${filename} ready • ${decoded.durationSeconds.toFixed(1)} sec. Choose the key, then press AUTOTUNE.`)
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
    resetResult()
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
    resetResult()
    setMessage(`Applying AutoTune in ${formatProjectKey(projectKey)}…`)
    try {
      const response = await processInWorker(source, projectKey)
      setTunedAudio(new Float32Array(response.output))
      const voicedPercent = Math.round(response.diagnostics.voicedFrameFraction * 100)
      setMessage(voicedPercent < 10
        ? 'AutoTune finished, but very little stable vocal pitch was detected. Try a cleaner solo vocal.'
        : `AutoTune ready • ${voicedPercent}% of the phrase detected as pitched vocal.`)
    } catch (error) {
      setMessage(toMessage(error))
    } finally {
      workerRef.current?.terminate()
      workerRef.current = null
      setProcessing(false)
    }
  }

  const processInWorker = (currentSource: TuneGravitySource, currentKey: ProjectKey): Promise<Extract<TuneGravityWorkerResponse, { ok: true }>> => {
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
        resolve(event.data)
      }
      worker.onerror = () => {
        worker.terminate()
        workerRef.current = null
        reject(new Error('AutoTune processing failed. Try a shorter WAV file.'))
      }
      const samples = new Float32Array(currentSource.samples)
      worker.postMessage({
        jobId,
        samples: samples.buffer,
        sampleRate: currentSource.sampleRate,
        sourceChannelCount: currentSource.sourceChannelCount,
        durationSeconds: currentSource.durationSeconds,
        anonymousSourceId: currentSource.anonymousId,
        projectKey: currentKey,
        parameters: simpleAutoTuneParameters,
        detector: 'yin',
        shifter: 'tdPsola',
      }, [samples.buffer])
    })
  }

  const audition = (kind: 'original' | 'autotune') => {
    if (!source || !audioReady) return
    const samples = kind === 'original' ? source.samples : tunedAudio
    if (!samples) return
    setAuditioning(kind)
    audioEngine.previewMonoSamples(samples, source.sampleRate, () => setAuditioning(null))
  }

  const stopAudition = () => {
    audioEngine.stopPreview()
    setAuditioning(null)
  }

  const changeProjectKey = (nextKey: ProjectKey) => {
    onProjectKeyChange(nextKey)
    resetResult()
    if (source) setMessage(`Key changed to ${formatProjectKey(nextKey)}. Press AUTOTUNE again.`)
  }

  const downloadTuned = () => {
    if (!source || !tunedAudio) return
    const url = URL.createObjectURL(encodeMonoWav(tunedAudio, source.sampleRate))
    const link = document.createElement('a')
    link.href = url
    link.download = source.filename.replace(/\.(wav|m4a)$/i, '') + '-AUTOTUNE.wav'
    link.click()
    URL.revokeObjectURL(url)
  }

  const busy = loading || processing || recording
  return <section className="tune-gravity-workspace" aria-labelledby="tune-gravity-title">
    <header className="tune-gravity-heading">
      <div>
        <p className="eyebrow">VOCAL PITCH</p>
        <h2 id="tune-gravity-title">AUTOTUNE</h2>
      </div>
      <span className="tune-gravity-badge">MONO • MAX {maximumTuneGravitySeconds} SEC</span>
    </header>

    <p className="tune-gravity-message" role="status">{message}</p>

    <div className="tune-gravity-source-actions">
      <label className="file-picker-button tune-gravity-file-button">
        {loading ? 'LOADING…' : 'LOAD VOCAL'}
        <input type="file" accept=".wav,.m4a,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a" disabled={busy || !audioReady} onChange={(event) => void chooseFile(event)} />
      </label>
      <button className={recording ? 'transport-button tune-record-active' : 'transport-button'} type="button" disabled={loading || processing || !audioReady} onClick={() => recording ? void stopRecording() : void startRecording()}>{recording ? 'STOP & USE TAKE' : 'RECORD VOCAL'}</button>
    </div>

    {recording && <div className="tune-record-meter" aria-label="Microphone input level"><span style={{ width: `${Math.round(microphoneLevel * 100)}%` }} /></div>}

    <ProjectKeyPanel projectKey={projectKey} disabled={busy} onChange={changeProjectKey} />

    <button className="transport-button tune-gravity-process" type="button" disabled={!source || busy} onClick={() => void processVocal()}>{processing ? 'TUNING…' : 'AUTOTUNE'}</button>

    {source && <div className="tune-labeled-comparison" aria-label="Original and AutoTune playback">
      <p className="eyebrow">LISTEN</p>
      <div className="tune-labeled-players">
        <button className={auditioning === 'original' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={busy} onClick={() => audition('original')}>▶ ORIGINAL</button>
        <button className={auditioning === 'autotune' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!tunedAudio || busy} onClick={() => audition('autotune')}>▶ AUTOTUNE</button>
        <button className="mixer-toggle" type="button" disabled={!auditioning} onClick={stopAudition}>■ STOP</button>
      </div>
    </div>}

    {tunedAudio && <button className="clear-button tune-gravity-download" type="button" disabled={busy} onClick={downloadTuned}>DOWNLOAD AUTOTUNE WAV</button>}
  </section>
}

function createAnonymousSourceId(samples: Float32Array, sampleRate: number): string {
  let hash = 2166136261
  const stride = Math.max(1, Math.floor(samples.length / 4096))
  for (let index = 0; index < samples.length; index += stride) {
    const quantized = Math.round((samples[index] ?? 0) * 32767)
    hash ^= quantized & 0xffff
    hash = Math.imul(hash, 16777619)
  }
  hash ^= samples.length
  hash = Math.imul(hash, 16777619)
  hash ^= sampleRate
  return `tg-${(hash >>> 0).toString(16).padStart(8, '0')}`
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
  return error instanceof Error ? error.message : 'AutoTune could not complete that action.'
}
