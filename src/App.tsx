import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine, AudioEngineStatus } from './audio/AudioEngine'
import './App.css'

interface AppProps {
  audioEngine: AudioEngine
}

const statusLabels: Record<AudioEngineStatus, string> = {
  inactive: 'Audio inactive',
  starting: 'Starting audio…',
  ready: 'Audio ready',
  error: 'Audio error',
}

export function App({ audioEngine }: AppProps) {
  const [audioStatus, setAudioStatus] = useState<AudioEngineStatus>(audioEngine.getStatus())
  const [sampleName, setSampleName] = useState<string>()
  const [sampleDuration, setSampleDuration] = useState<number>()
  const [errorMessage, setErrorMessage] = useState<string>()

  const padIsReady = audioStatus === 'ready' && sampleName !== undefined

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyA' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      event.preventDefault()
      audioEngine.triggerSample()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [audioEngine])

  const startAudio = async () => {
    setErrorMessage(undefined)
    setAudioStatus('starting')

    try {
      await audioEngine.initialize()
      setAudioStatus(audioEngine.getStatus())
    } catch (error) {
      setAudioStatus(audioEngine.getStatus())
      setErrorMessage(toMessage(error))
    }
  }

  const loadSample = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setErrorMessage(undefined)

    try {
      const loadedSample = await audioEngine.loadSample(file)
      setSampleName(loadedSample.filename)
      setSampleDuration(loadedSample.durationSeconds)
    } catch (error) {
      setErrorMessage(toMessage(error))
    }
  }

  return (
    <main className="station-shell">
      <section className="station-panel" aria-labelledby="station-title">
        <p className="eyebrow">STATION / M1</p>
        <h1 id="station-title">Audio proof of concept</h1>
        <p className="intro">Load one WAV sample, then play it with the pad or the <kbd>A</kbd> key.</p>

        <div className="status-row" role="status" aria-live="polite">
          <span className={`status-dot status-${audioStatus}`} aria-hidden="true" />
          {statusLabels[audioStatus]}
        </div>

        <button className="start-button" type="button" onClick={() => void startAudio()} disabled={audioStatus === 'starting'}>
          {audioStatus === 'ready' ? 'AUDIO READY' : 'START AUDIO'}
        </button>

        <label className="file-picker">
          <span>WAV sample</span>
          <input type="file" accept="audio/wav,.wav" disabled={audioStatus !== 'ready'} onChange={(event) => void loadSample(event)} />
        </label>

        <p className="sample-status" aria-live="polite">
          {sampleName ? `${sampleName} · ${sampleDuration?.toFixed(2)} s` : 'No sample loaded'}
        </p>

        {errorMessage && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          className="pad"
          type="button"
          disabled={!padIsReady}
          onPointerDown={(event) => {
            event.preventDefault()
            audioEngine.triggerSample()
          }}
        >
          <span>PLAY SAMPLE</span>
          <kbd>A</kbd>
        </button>
      </section>
    </main>
  )
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected audio error occurred.'
}
