import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine, AudioEngineStatus } from './audio/AudioEngine'
import { StepSequencer } from './audio/StepSequencer'
import { createPadBank, padIdByKeyCode } from './pads/padBank'
import { PadEditor } from './pads/PadEditor'
import { PadGrid } from './pads/PadGrid'
import type { PadState } from './pads/types'
import { SequencerControls } from './sequencer/SequencerControls'
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
  const [pads, setPads] = useState<PadState[]>(createPadBank)
  const [selectedPadId, setSelectedPadId] = useState<PadState['id']>('pad-01')
  const [activePadId, setActivePadId] = useState<PadState['id'] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [bpm, setBpm] = useState(120)
  const [steps, setSteps] = useState<boolean[]>(() => Array(16).fill(false))
  const [isPlaying, setIsPlaying] = useState(false)
  const sequencerRef = useRef(new StepSequencer(audioEngine))
  const selectedPad = pads.find((pad) => pad.id === selectedPadId)!
  const audioReady = audioStatus === 'ready'

  useEffect(() => () => sequencerRef.current.stop(), [])

  const triggerPad = (padId: PadState['id']) => {
    const pad = pads.find((candidate) => candidate.id === padId)
    setSelectedPadId(padId)
    if (!pad || !audioReady || !audioEngine.hasSample(padId)) {
      return
    }
    audioEngine.triggerSample(padId, { gain: pad.gain, pitchSemitones: pad.pitchSemitones })
    setActivePadId(padId)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) {
        return
      }
      const padId = padIdByKeyCode.get(event.code)
      if (!padId) {
        return
      }
      event.preventDefault()
      triggerPad(padId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [audioEngine, pads, audioReady])

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

  const updateSelectedPad = (changes: Pick<PadState, 'gain' | 'pitchSemitones'>) => {
    setPads((currentPads) => currentPads.map((pad) => (pad.id === selectedPadId ? { ...pad, ...changes } : pad)))
  }

  const loadSelectedPad = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    setErrorMessage(undefined)
    try {
      const loadedSample = await audioEngine.loadSample(selectedPadId, file)
      setPads((currentPads) => currentPads.map((pad) => (pad.id === selectedPadId ? { ...pad, fileName: loadedSample.filename, durationSeconds: loadedSample.durationSeconds } : pad)))
    } catch (error) {
      setErrorMessage(toMessage(error))
    }
  }

  const clearSelectedPad = () => {
    audioEngine.removeSample(selectedPadId)
    setPads((currentPads) => currentPads.map((pad) => (pad.id === selectedPadId ? { ...pad, fileName: null, durationSeconds: null, gain: 1, pitchSemitones: 0 } : pad)))
    setActivePadId((currentPadId) => (currentPadId === selectedPadId ? null : currentPadId))
  }

  const toggleStep = (stepIndex: number) => {
    setSteps((currentSteps) => currentSteps.map((isActive, index) => index === stepIndex ? !isActive : isActive))
  }

  const togglePlayback = () => {
    if (isPlaying) {
      sequencerRef.current.stop()
      setIsPlaying(false)
      return
    }
    if (!audioReady || !audioEngine.hasSample(selectedPad.id)) {
      setErrorMessage('Assign a WAV to the selected pad before starting the sequencer.')
      return
    }
    sequencerRef.current.start({ bpm, sampleId: selectedPad.id, steps, options: { gain: selectedPad.gain, pitchSemitones: selectedPad.pitchSemitones } })
    setIsPlaying(true)
  }

  return (
    <main className="station-shell">
      <section className="station-panel" aria-labelledby="station-title">
        <header className="station-header">
          <div>
            <p className="eyebrow">STATION / M3</p>
            <h1 id="station-title">Pad instrument</h1>
            <p className="intro">Assign WAV samples, then play the 16-pad bank by pointer or keyboard.</p>
          </div>
          <div className="audio-controls">
            <div className="status-row" role="status" aria-live="polite">
              <span className={`status-dot status-${audioStatus}`} aria-hidden="true" />
              {statusLabels[audioStatus]}
            </div>
            <button className="start-button" type="button" onClick={() => void startAudio()} disabled={audioStatus === 'starting'}>
              {audioReady ? 'AUDIO READY' : 'START AUDIO'}
            </button>
          </div>
        </header>
        {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
        <div className="instrument-layout">
          <PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} onTrigger={triggerPad} onFeedbackEnd={(padId) => setActivePadId((currentPadId) => currentPadId === padId ? null : currentPadId)} />
          <PadEditor pad={selectedPad} audioReady={audioReady} onImport={(event) => void loadSelectedPad(event)} onUpdate={updateSelectedPad} onClear={clearSelectedPad} />
        </div>
        <SequencerControls bpm={bpm} isPlaying={isPlaying} steps={steps} padLabel={selectedPad.label} onBpmChange={setBpm} onToggleStep={toggleStep} onTogglePlayback={togglePlayback} />
      </section>
    </main>
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected audio error occurred.'
}
