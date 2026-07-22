import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine, AudioEngineStatus, SampleAssetId } from './audio/AudioEngine'
import { StepSequencer } from './audio/StepSequencer'
import { Mixer } from './mixer/Mixer'
import { createPadBank, padIdByKeyCode } from './pads/padBank'
import { PadEditor } from './pads/PadEditor'
import { PadGrid } from './pads/PadGrid'
import type { PadState, SamplePlaybackRegion, SampleSlice } from './pads/types'
import { SampleEditor } from './sample-editor/SampleEditor'
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

let nextAssetNumber = 1
let nextSliceNumber = 1

function createAssetId(padId: string): SampleAssetId {
  return `asset-${padId}-${nextAssetNumber++}`
}

function createSliceId(padId: string): string {
  return `slice-${padId}-${nextSliceNumber++}`
}

function clearPadAssignment(pad: PadState): PadState {
  return { ...pad, assetId: null, fileName: null, durationSeconds: null, region: { startSeconds: 0, endSeconds: 0 }, slices: [] }
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
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({})
  const [activeSliceId, setActiveSliceId] = useState<string | null>(null)
  const [addingSlice, setAddingSlice] = useState(false)
  const sequencerRef = useRef(new StepSequencer(audioEngine))
  const selectedPad = pads.find((pad) => pad.id === selectedPadId)!
  const audioReady = audioStatus === 'ready'
  const sequenceConfigRef = useRef({ bpm, swing, tracks: [] as { sampleId: string; assetId: SampleAssetId; steps: number[]; options: { pitchSemitones: number; startSeconds: number; endSeconds: number } }[] })

  sequenceConfigRef.current = {
    bpm,
    swing,
    tracks: pads.filter((pad): pad is PadState & { assetId: SampleAssetId } => pad.assetId !== null && audioEngine.hasSampleAsset(pad.assetId)).map((pad) => ({
      sampleId: pad.id,
      assetId: pad.assetId,
      steps: patterns[pad.id],
      options: { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds },
    })),
  }

  useEffect(() => {
    audioEngine.setPumpConfig({ sourceSampleId: pumpSourceId, targetSampleIds: pumpTargets, depth: pumpDepth, lengthSeconds: 60 / bpm * pumpLengthBeats, curve: pumpCurve })
  }, [audioEngine, bpm, pumpCurve, pumpDepth, pumpLengthBeats, pumpSourceId, pumpTargets])

  useEffect(() => () => sequencerRef.current.stop(), [])

  const triggerPad = (padId: PadState['id']) => {
    const pad = pads.find((candidate) => candidate.id === padId)
    setSelectedPadId(padId)
    setActiveSliceId(null)
    setAddingSlice(false)
    if (!pad || !pad.assetId || !audioReady || !audioEngine.hasSampleAsset(pad.assetId)) {
      return
    }
    audioEngine.triggerSample(padId, pad.assetId, { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds })
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

  const updateSelectedPad = (changes: Pick<PadState, 'volume' | 'pitchSemitones'>) => {
    setPads((currentPads) => currentPads.map((pad) => (pad.id === selectedPadId ? { ...pad, ...changes } : pad)))
    audioEngine.setChannelVolume(selectedPadId, changes.volume)
  }

  const updateChannelVolume = (padId: PadState['id'], volume: number) => {
    setPads((currentPads) => currentPads.map((pad) => (pad.id === padId ? { ...pad, volume } : pad)))
    audioEngine.setChannelVolume(padId, volume)
  }

  const updateChannelMuted = (padId: PadState['id'], muted: boolean) => {
    setPads((currentPads) => currentPads.map((pad) => (pad.id === padId ? { ...pad, muted } : pad)))
    audioEngine.setChannelMuted(padId, muted)
  }

  const updateChannelSolo = (padId: PadState['id'], solo: boolean) => {
    setPads((currentPads) => currentPads.map((pad) => (pad.id === padId ? { ...pad, solo } : pad)))
    audioEngine.setChannelSolo(padId, solo)
  }

  const loadSelectedPad = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    setErrorMessage(undefined)
    try {
      const assetId = createAssetId(selectedPadId)
      const loadedSample = await audioEngine.loadSample(assetId, file)
      const waveform = audioEngine.getWaveformPeaks(assetId) ?? []
      const previousAssetId = selectedPad.assetId
      if (previousAssetId) audioEngine.removeSampleAsset(previousAssetId)
      setPads((currentPads) => currentPads.map((pad) => {
        if (pad.id === selectedPadId) return { ...pad, assetId, fileName: loadedSample.filename, durationSeconds: loadedSample.durationSeconds, region: { startSeconds: 0, endSeconds: loadedSample.durationSeconds }, slices: [] }
        if (pad.assetId === previousAssetId) return clearPadAssignment(pad)
        return pad
      }))
      setWaveforms((currentWaveforms) => {
        const { [previousAssetId ?? '']: _, ...remainingWaveforms } = currentWaveforms
        return { ...remainingWaveforms, [assetId]: waveform }
      })
      setActiveSliceId(null)
      setAddingSlice(false)
    } catch (error) {
      setErrorMessage(toMessage(error))
    }
  }

  const clearSelectedPad = () => {
    const assetId = selectedPad.assetId
    const stillAssignedElsewhere = assetId ? pads.some((pad) => pad.id !== selectedPadId && pad.assetId === assetId) : false
    if (assetId && !stillAssignedElsewhere) audioEngine.removeSampleAsset(assetId)
    setPads((currentPads) => currentPads.map((pad) => (pad.id === selectedPadId ? clearPadAssignment(pad) : pad)))
    if (!stillAssignedElsewhere) setWaveforms((currentWaveforms) => {
      const { [assetId ?? '']: _, ...remainingWaveforms } = currentWaveforms
      return remainingWaveforms
    })
    setActiveSliceId(null)
    setAddingSlice(false)
    setActivePadId((currentPadId) => (currentPadId === selectedPadId ? null : currentPadId))
  }

  const updateSelectedRegion = (region: SamplePlaybackRegion) => {
    const durationSeconds = selectedPad.durationSeconds
    if (!durationSeconds) return
    const minimumLength = Math.min(0.01, durationSeconds)
    const startSeconds = Math.min(Math.max(0, region.startSeconds), durationSeconds - minimumLength)
    const endSeconds = Math.min(durationSeconds, Math.max(startSeconds + minimumLength, region.endSeconds))
    setPads((currentPads) => currentPads.map((pad) => (pad.id === selectedPadId ? { ...pad, region: { startSeconds, endSeconds } } : pad)))
  }

  const resetSelectedRegion = () => {
    if (!selectedPad.durationSeconds) return
    updateSelectedRegion({ startSeconds: 0, endSeconds: selectedPad.durationSeconds })
  }

  const addSlice = (timeSeconds: number) => {
    if (!selectedPad.assetId || !selectedPad.durationSeconds) return
    const minimumLength = Math.min(0.01, selectedPad.durationSeconds)
    const currentSlices = selectedPad.slices.length > 0 ? selectedPad.slices : [{ id: createSliceId(selectedPad.id), sourceAssetId: selectedPad.assetId, startSeconds: 0, endSeconds: selectedPad.durationSeconds }]
    if (currentSlices.length >= 16) return
    const splitIndex = currentSlices.findIndex((slice) => timeSeconds > slice.startSeconds + minimumLength && timeSeconds < slice.endSeconds - minimumLength)
    if (splitIndex < 0) return
    const slice = currentSlices[splitIndex]
    const newSlice: SampleSlice = { id: createSliceId(selectedPad.id), sourceAssetId: selectedPad.assetId, startSeconds: timeSeconds, endSeconds: slice.endSeconds }
    const nextSlices = currentSlices.flatMap((currentSlice, index) => index === splitIndex ? [{ ...currentSlice, endSeconds: timeSeconds }, newSlice] : [currentSlice])
    setPads((currentPads) => currentPads.map((pad) => pad.id === selectedPad.id ? { ...pad, slices: nextSlices } : pad))
    setActiveSliceId(newSlice.id)
  }

  const moveCut = (cutIndex: number, timeSeconds: number) => {
    const slices = selectedPad.slices
    const left = slices[cutIndex]
    const right = slices[cutIndex + 1]
    if (!left || !right) return
    const minimumLength = Math.min(0.01, selectedPad.durationSeconds ?? 0.01)
    const cutTime = Math.min(right.endSeconds - minimumLength, Math.max(left.startSeconds + minimumLength, timeSeconds))
    const nextSlices = slices.map((slice, index) => index === cutIndex ? { ...slice, endSeconds: cutTime } : index === cutIndex + 1 ? { ...slice, startSeconds: cutTime } : slice)
    setPads((currentPads) => currentPads.map((pad) => pad.id === selectedPad.id ? { ...pad, slices: nextSlices } : pad))
  }

  const removeActiveCut = () => {
    const activeIndex = selectedPad.slices.findIndex((slice) => slice.id === activeSliceId)
    if (selectedPad.slices.length < 2 || activeIndex < 0) return
    const cutIndex = activeIndex < selectedPad.slices.length - 1 ? activeIndex : activeIndex - 1
    const left = selectedPad.slices[cutIndex]
    const right = selectedPad.slices[cutIndex + 1]
    const nextSlices = selectedPad.slices.flatMap((slice, index) => index === cutIndex ? [{ ...left, endSeconds: right.endSeconds }] : index === cutIndex + 1 ? [] : [slice])
    setPads((currentPads) => currentPads.map((pad) => pad.id === selectedPad.id ? { ...pad, slices: nextSlices.length === 1 ? [] : nextSlices } : pad))
    setActiveSliceId(nextSlices.length === 1 ? null : left.id)
  }

  const clearSlices = () => {
    setPads((currentPads) => currentPads.map((pad) => pad.id === selectedPad.id ? { ...pad, slices: [] } : pad))
    setActiveSliceId(null)
    setAddingSlice(false)
  }

  const previewSlice = (slice: SampleSlice) => {
    if (!audioReady || !selectedPad.assetId || !audioEngine.hasSampleAsset(slice.sourceAssetId)) return
    audioEngine.triggerSample(selectedPad.id, slice.sourceAssetId, { pitchSemitones: selectedPad.pitchSemitones, startSeconds: slice.startSeconds, endSeconds: slice.endSeconds })
    setActiveSliceId(slice.id)
    setActivePadId(selectedPad.id)
  }

  const assignSlicesToPads = () => {
    if (!selectedPad.assetId || selectedPad.slices.length === 0 || !selectedPad.durationSeconds) return
    const startIndex = pads.findIndex((pad) => pad.id === selectedPad.id)
    const assignableSlices = selectedPad.slices.slice(0, pads.length - startIndex)
    const targetIds = new Set(pads.slice(startIndex, startIndex + assignableSlices.length).map((pad) => pad.id))
    const orphanedAssets = new Set(pads.filter((pad) => targetIds.has(pad.id) && pad.assetId && pad.assetId !== selectedPad.assetId).map((pad) => pad.assetId!).filter((assetId) => !pads.some((pad) => !targetIds.has(pad.id) && pad.assetId === assetId)))
    for (const assetId of orphanedAssets) audioEngine.removeSampleAsset(assetId)
    setWaveforms((currentWaveforms) => {
      const nextWaveforms = { ...currentWaveforms }
      for (const assetId of orphanedAssets) delete nextWaveforms[assetId]
      return nextWaveforms
    })
    setPads((currentPads) => currentPads.map((pad, index) => {
      const slice = assignableSlices[index - startIndex]
      if (!slice) return pad
      return { ...pad, assetId: slice.sourceAssetId, fileName: selectedPad.fileName, durationSeconds: selectedPad.durationSeconds, region: { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds }, slices: pad.id === selectedPad.id ? pad.slices : [] }
    }))
    setErrorMessage(selectedPad.slices.length > assignableSlices.length ? `Assigned ${assignableSlices.length} slices. ${selectedPad.slices.length - assignableSlices.length} did not fit in the 16-pad bank.` : undefined)
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
            <p className="eyebrow">STATION / M4</p>
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
          <Mixer pads={pads} pumpSourceId={pumpSourceId} pumpTargets={pumpTargets} onVolumeChange={updateChannelVolume} onMutedChange={updateChannelMuted} onSoloChange={updateChannelSolo} />
          <SampleEditor pad={selectedPad} peaks={selectedPad.assetId ? waveforms[selectedPad.assetId] ?? [] : []} audioReady={audioReady} onPreview={() => triggerPad(selectedPad.id)} onRegionChange={updateSelectedRegion} onResetRegion={resetSelectedRegion} activeSliceId={activeSliceId} addingSlice={addingSlice} onStartAddingSlice={() => setAddingSlice((current) => !current)} onAddSlice={addSlice} onMoveCut={moveCut} onSelectSlice={setActiveSliceId} onPreviewSlice={previewSlice} onRemoveActiveCut={removeActiveCut} onClearSlices={clearSlices} onAssignSlices={assignSlicesToPads} />
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
