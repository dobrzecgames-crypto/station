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
  const [swing, setSwing] = useState(0)
  const [patterns, setPatterns] = useState<Record<PadState['id'], number[]>>(() => Object.fromEntries(createPadBank().map((pad) => [pad.id, Array(16).fill(0)])))
  const [isPlaying, setIsPlaying] = useState(false)
  const [pumpSourceId, setPumpSourceId] = useState<string | null>(null)
  const [pumpTargets, setPumpTargets] = useState<string[]>([])
  const [pumpDepth, setPumpDepth] = useState(0.5)
  const [pumpLengthBeats, setPumpLengthBeats] = useState(0.5)
  const [pumpCurve, setPumpCurve] = useState<'snap' | 'smooth' | 'swell'>('smooth')
  const sequencerRef = useRef(new StepSequencer(audioEngine))
  const selectedPad = pads.find((pad) => pad.id === selectedPadId)!
  const audioReady = audioStatus === 'ready'
  const sequenceConfigRef = useRef({ bpm, swing, tracks: [] as { sampleId: string; steps: number[]; options: { gain: number; pitchSemitones: number } }[] })

  sequenceConfigRef.current = {
    bpm,
    swing,
    tracks: pads.filter((pad) => audioEngine.hasSample(pad.id)).map((pad) => ({
      sampleId: pad.id,
      steps: patterns[pad.id],
      options: { gain: pad.gain, pitchSemitones: pad.pitchSemitones },
    })),
  }

  useEffect(() => {
    audioEngine.setPumpConfig({ sourceSampleId: pumpSourceId, targetSampleIds: pumpTargets, depth: pumpDepth, lengthSeconds: 60 / bpm * pumpLengthBeats, curve: pumpCurve })
  }, [audioEngine, bpm, pumpCurve, pumpDepth, pumpLengthBeats, pumpSourceId, pumpTargets])

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
    setPatterns((currentPatterns) => ({
      ...currentPatterns,
      [selectedPad.id]: currentPatterns[selectedPad.id].map((velocity, index) => index === stepIndex ? velocity === 0 ? 0.6 : velocity === 0.6 ? 1 : 0 : velocity),
    }))
  }

  const togglePlayback = () => {
    if (isPlaying) {
      sequencerRef.current.stop()
      setIsPlaying(false)
      return
    }
    if (!audioReady || sequenceConfigRef.current.tracks.length === 0) {
      setErrorMessage('Assign a WAV to at least one pad before starting the sequencer.')
      return
    }
    sequencerRef.current.start(() => sequenceConfigRef.current)
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
          <SequencerControls bpm={bpm} swing={swing} isPlaying={isPlaying} steps={patterns[selectedPad.id]} padLabel={selectedPad.label} loadedTrackCount={pads.filter((pad) => pad.fileName).length} onBpmChange={setBpm} onSwingChange={setSwing} onToggleStep={toggleStep} onTogglePlayback={togglePlayback} />
          <section className="sequencer" aria-labelledby="pump-title">
            <p className="eyebrow">BASIC PUMP</p><h2 id="pump-title">{pumpSourceId === selectedPad.id ? 'Kick source selected' : 'Select kick source or target'}</h2>
            <button className="transport-button" type="button" onClick={() => setPumpSourceId(selectedPad.id)}>SET {selectedPad.label} AS KICK</button>
            <label className="file-picker"><span><input type="checkbox" checked={pumpTargets.includes(selectedPad.id)} onChange={() => setPumpTargets((targets) => targets.includes(selectedPad.id) ? targets.filter((id) => id !== selectedPad.id) : [...targets, selectedPad.id])} /> Pump selected pad</span></label>
            <label className="bpm-control">DEPTH <output>{Math.round(pumpDepth * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={pumpDepth} onChange={(event) => setPumpDepth(Number(event.target.value))} /></label>
            <label className="bpm-control">LENGTH <output>{pumpLengthBeats} beat</output><input type="range" min="0.25" max="1" step="0.25" value={pumpLengthBeats} onChange={(event) => setPumpLengthBeats(Number(event.target.value))} /></label>
            <div className="pump-curves">{(['snap', 'smooth', 'swell'] as const).map((curve) => <button key={curve} className={`step ${pumpCurve === curve ? 'step-full' : ''}`} type="button" onClick={() => setPumpCurve(curve)}>{curve.toUpperCase()}</button>)}</div>
          </section>
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
