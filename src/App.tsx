import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine, AudioEngineStatus, SampleAssetId } from './audio/AudioEngine'
import { StepSequencer } from './audio/StepSequencer'
import { ChopWorkspace } from './chop/ChopWorkspace'
import { Mixer } from './mixer/Mixer'
import { createPadBank, padIdByKeyCode } from './pads/padBank'
import { PadEditor } from './pads/PadEditor'
import { PadGrid } from './pads/PadGrid'
import type { PadState, SamplePlaybackRegion, SampleSlice } from './pads/types'
import { SampleEditor } from './sample-editor/SampleEditor'
import { SequencerControls } from './sequencer/SequencerControls'
import { MainNavigation } from './shell/MainNavigation'
import type { MainView } from './shell/MainNavigation'
import { TransportBar } from './shell/TransportBar'
import './App.css'

interface AppProps { audioEngine: AudioEngine }

interface ChopSession {
  id: string
  assetId: SampleAssetId | null
  fileName: string | null
  durationSeconds: number | null
  peaks: number[]
  slices: SampleSlice[]
  activeSliceId: string | null
  addingSlice: boolean
}

const statusLabels: Record<AudioEngineStatus, string> = { inactive: 'Audio inactive', starting: 'Starting audio…', ready: 'Audio ready', error: 'Audio error' }
const emptyChopSession = (): ChopSession => ({ id: '', assetId: null, fileName: null, durationSeconds: null, peaks: [], slices: [], activeSliceId: null, addingSlice: false })
let nextAssetNumber = 1
let nextSliceNumber = 1
let nextChopSessionNumber = 1

function createAssetId(scope: string): SampleAssetId { return `asset-${scope}-${nextAssetNumber++}` }
function createSliceId(scope: string): string { return `slice-${scope}-${nextSliceNumber++}` }
function clearPadAssignment(pad: PadState): PadState {
  return { ...pad, assetId: null, fileName: null, durationSeconds: null, region: { startSeconds: 0, endSeconds: 0 }, slices: [], chopSessionId: null }
}

export function App({ audioEngine }: AppProps) {
  const [audioStatus, setAudioStatus] = useState<AudioEngineStatus>(audioEngine.getStatus())
  const [mainView, setMainView] = useState<MainView>('chop')
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
  const [chopSession, setChopSession] = useState<ChopSession>(emptyChopSession)
  const [sourcePreviewing, setSourcePreviewing] = useState(false)
  const sequencerRef = useRef(new StepSequencer(audioEngine))
  const selectedPad = pads.find((pad) => pad.id === selectedPadId)!
  const audioReady = audioStatus === 'ready'
  const selectedPeaks = selectedPad.assetId === chopSession.assetId ? chopSession.peaks : selectedPad.assetId ? waveforms[selectedPad.assetId] ?? [] : []
  const sequenceConfigRef = useRef({ bpm, swing, tracks: [] as { sampleId: string; assetId: SampleAssetId; steps: number[]; options: { pitchSemitones: number; startSeconds: number; endSeconds: number } }[] })

  sequenceConfigRef.current = {
    bpm,
    swing,
    tracks: pads.filter((pad): pad is PadState & { assetId: SampleAssetId } => pad.assetId !== null && audioEngine.hasSampleAsset(pad.assetId)).map((pad) => ({ sampleId: pad.id, assetId: pad.assetId, steps: patterns[pad.id], options: { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds } })),
  }

  useEffect(() => { audioEngine.setPumpConfig({ sourceSampleId: pumpSourceId, targetSampleIds: pumpTargets, depth: pumpDepth, lengthSeconds: 60 / bpm * pumpLengthBeats, curve: pumpCurve }) }, [audioEngine, bpm, pumpCurve, pumpDepth, pumpLengthBeats, pumpSourceId, pumpTargets])
  useEffect(() => () => sequencerRef.current.stop(), [])

  const triggerPad = (padId: PadState['id']) => {
    const pad = pads.find((candidate) => candidate.id === padId)
    setSelectedPadId(padId)
    if (!pad || !pad.assetId || !audioReady || !audioEngine.hasSampleAsset(pad.assetId)) return
    audioEngine.triggerSample(padId, pad.assetId, { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds })
    setActivePadId(padId)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return
      const padId = padIdByKeyCode.get(event.code)
      if (!padId) return
      event.preventDefault()
      triggerPad(padId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pads, audioReady])

  const startAudio = async () => {
    setErrorMessage(undefined)
    setAudioStatus('starting')
    try { await audioEngine.initialize(); setAudioStatus(audioEngine.getStatus()) } catch (error) { setAudioStatus(audioEngine.getStatus()); setErrorMessage(toMessage(error)) }
  }

  const updateSelectedPad = (changes: Pick<PadState, 'volume' | 'pitchSemitones'>) => {
    setPads((currentPads) => currentPads.map((pad) => pad.id === selectedPadId ? { ...pad, ...changes } : pad))
    audioEngine.setChannelVolume(selectedPadId, changes.volume)
  }
  const updateChannelVolume = (padId: PadState['id'], volume: number) => { setPads((currentPads) => currentPads.map((pad) => pad.id === padId ? { ...pad, volume } : pad)); audioEngine.setChannelVolume(padId, volume) }
  const updateChannelMuted = (padId: PadState['id'], muted: boolean) => { setPads((currentPads) => currentPads.map((pad) => pad.id === padId ? { ...pad, muted } : pad)); audioEngine.setChannelMuted(padId, muted) }
  const updateChannelSolo = (padId: PadState['id'], solo: boolean) => { setPads((currentPads) => currentPads.map((pad) => pad.id === padId ? { ...pad, solo } : pad)); audioEngine.setChannelSolo(padId, solo) }

  const loadSelectedPad = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setErrorMessage(undefined)
    try {
      const assetId = createAssetId(selectedPadId)
      const loadedSample = await audioEngine.loadSample(assetId, file)
      const waveform = audioEngine.getWaveformPeaks(assetId) ?? []
      const previousAssetId = selectedPad.assetId
      setPads((currentPads) => currentPads.map((pad) => pad.id === selectedPadId ? { ...pad, assetId, fileName: loadedSample.filename, durationSeconds: loadedSample.durationSeconds, region: { startSeconds: 0, endSeconds: loadedSample.durationSeconds }, slices: [], chopSessionId: null } : pad))
      setWaveforms((current) => ({ ...current, [assetId]: waveform }))
      if (previousAssetId && !pads.some((pad) => pad.id !== selectedPadId && pad.assetId === previousAssetId) && previousAssetId !== chopSession.assetId) {
        audioEngine.removeSampleAsset(previousAssetId)
        setWaveforms((current) => { const { [previousAssetId]: _, ...remaining } = current; return remaining })
      }
    } catch (error) { setErrorMessage(toMessage(error)) }
  }

  const clearSelectedPad = () => {
    const assetId = selectedPad.assetId
    const stillAssignedElsewhere = assetId ? pads.some((pad) => pad.id !== selectedPadId && pad.assetId === assetId) : false
    if (assetId && !stillAssignedElsewhere && assetId !== chopSession.assetId) audioEngine.removeSampleAsset(assetId)
    setPads((currentPads) => currentPads.map((pad) => pad.id === selectedPadId ? clearPadAssignment(pad) : pad))
    if (assetId && !stillAssignedElsewhere && assetId !== chopSession.assetId) setWaveforms((current) => { const { [assetId]: _, ...remaining } = current; return remaining })
    setActivePadId((current) => current === selectedPadId ? null : current)
  }

  const updateSelectedRegion = (region: SamplePlaybackRegion) => {
    const durationSeconds = selectedPad.durationSeconds
    if (!durationSeconds) return
    const minimumLength = Math.min(0.01, durationSeconds)
    const startSeconds = Math.min(Math.max(0, region.startSeconds), durationSeconds - minimumLength)
    const endSeconds = Math.min(durationSeconds, Math.max(startSeconds + minimumLength, region.endSeconds))
    setPads((currentPads) => currentPads.map((pad) => pad.id === selectedPadId ? { ...pad, region: { startSeconds, endSeconds } } : pad))
  }
  const resetSelectedRegion = () => { if (selectedPad.durationSeconds) updateSelectedRegion({ startSeconds: 0, endSeconds: selectedPad.durationSeconds }) }

  const applyChopMapping = (nextSlices: SampleSlice[]): boolean => {
    if (!chopSession.assetId || !chopSession.durationSeconds) return false
    const conflicts = pads.slice(0, nextSlices.length).filter((pad) => pad.assetId && pad.chopSessionId !== chopSession.id)
    if (conflicts.length > 0 && !window.confirm(`Replace ${conflicts.length} occupied pad${conflicts.length === 1 ? '' : 's'} with live Chop slices?`)) return false
    setPads((currentPads) => currentPads.map((pad, index) => {
      const slice = nextSlices[index]
      if (slice) return { ...pad, assetId: chopSession.assetId!, fileName: chopSession.fileName, durationSeconds: chopSession.durationSeconds, region: { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds }, slices: [], chopSessionId: chopSession.id }
      return pad.chopSessionId === chopSession.id ? clearPadAssignment(pad) : pad
    }))
    return true
  }

  const loadChopSource = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setErrorMessage(undefined)
    audioEngine.stopPreview()
    setSourcePreviewing(false)
    try {
      const assetId = createAssetId('chop')
      const loaded = await audioEngine.loadSample(assetId, file)
      const oldAssetId = chopSession.assetId
      setPads((currentPads) => currentPads.map((pad) => pad.chopSessionId === chopSession.id ? { ...pad, chopSessionId: null } : pad))
      setChopSession({ id: `chop-session-${nextChopSessionNumber++}`, assetId, fileName: loaded.filename, durationSeconds: loaded.durationSeconds, peaks: audioEngine.getWaveformPeaks(assetId) ?? [], slices: [], activeSliceId: null, addingSlice: false })
      if (oldAssetId && !pads.some((pad) => pad.assetId === oldAssetId)) audioEngine.removeSampleAsset(oldAssetId)
    } catch (error) { setErrorMessage(toMessage(error)) }
  }

  const addChopSlice = (timeSeconds: number) => {
    if (!chopSession.assetId || !chopSession.durationSeconds) return
    const minimumLength = Math.min(0.01, chopSession.durationSeconds)
    const currentSlices = chopSession.slices.length > 0 ? chopSession.slices : [{ id: createSliceId(chopSession.id), sourceAssetId: chopSession.assetId, startSeconds: 0, endSeconds: chopSession.durationSeconds }]
    if (currentSlices.length >= 16) return
    const splitIndex = currentSlices.findIndex((slice) => timeSeconds > slice.startSeconds + minimumLength && timeSeconds < slice.endSeconds - minimumLength)
    if (splitIndex < 0) return
    const slice = currentSlices[splitIndex]
    const newSlice: SampleSlice = { id: createSliceId(chopSession.id), sourceAssetId: chopSession.assetId, startSeconds: timeSeconds, endSeconds: slice.endSeconds }
    const nextSlices = currentSlices.flatMap((currentSlice, index) => index === splitIndex ? [{ ...currentSlice, endSeconds: timeSeconds }, newSlice] : [currentSlice])
    if (!applyChopMapping(nextSlices)) return
    setChopSession((current) => ({ ...current, slices: nextSlices, activeSliceId: newSlice.id }))
  }

  const moveChopCut = (cutIndex: number, timeSeconds: number) => {
    const left = chopSession.slices[cutIndex]
    const right = chopSession.slices[cutIndex + 1]
    if (!left || !right) return
    const minimumLength = Math.min(0.01, chopSession.durationSeconds ?? 0.01)
    const cutTime = Math.min(right.endSeconds - minimumLength, Math.max(left.startSeconds + minimumLength, timeSeconds))
    const nextSlices = chopSession.slices.map((slice, index) => index === cutIndex ? { ...slice, endSeconds: cutTime } : index === cutIndex + 1 ? { ...slice, startSeconds: cutTime } : slice)
    if (!applyChopMapping(nextSlices)) return
    setChopSession((current) => ({ ...current, slices: nextSlices }))
  }

  const removeActiveChopCut = () => {
    const activeIndex = chopSession.slices.findIndex((slice) => slice.id === chopSession.activeSliceId)
    if (chopSession.slices.length < 2 || activeIndex < 0) return
    const cutIndex = activeIndex < chopSession.slices.length - 1 ? activeIndex : activeIndex - 1
    const left = chopSession.slices[cutIndex]
    const right = chopSession.slices[cutIndex + 1]
    const merged = chopSession.slices.flatMap((slice, index) => index === cutIndex ? [{ ...left, endSeconds: right.endSeconds }] : index === cutIndex + 1 ? [] : [slice])
    const nextSlices = merged.length === 1 ? [] : merged
    if (!applyChopMapping(nextSlices)) return
    setChopSession((current) => ({ ...current, slices: nextSlices, activeSliceId: nextSlices.length ? left.id : null }))
  }

  const clearChopSlices = () => {
    if (!applyChopMapping([])) return
    setChopSession((current) => ({ ...current, slices: [], activeSliceId: null, addingSlice: false }))
  }

  const previewChopSource = () => {
    if (!audioReady || !chopSession.assetId || sourcePreviewing) return
    setSourcePreviewing(true)
    audioEngine.previewAsset(chopSession.assetId, {}, () => setSourcePreviewing(false))
  }
  const stopChopSourcePreview = () => { audioEngine.stopPreview(); setSourcePreviewing(false) }
  const previewChopSlice = (slice: SampleSlice) => { if (audioReady) audioEngine.previewAsset(slice.sourceAssetId, { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds }); setChopSession((current) => ({ ...current, activeSliceId: slice.id })) }
  const selectChopSlice = (sliceId: string) => { const index = chopSession.slices.findIndex((slice) => slice.id === sliceId); setChopSession((current) => ({ ...current, activeSliceId: sliceId })); if (index >= 0) setSelectedPadId(pads[index].id) }

  const toggleStep = (stepIndex: number) => setPatterns((current) => ({ ...current, [selectedPad.id]: current[selectedPad.id].map((velocity, index) => index === stepIndex ? velocity === 0 ? 0.6 : velocity === 0.6 ? 1 : 0 : velocity) }))
  const startPlayback = () => {
    if (isPlaying) return
    if (!audioReady || sequenceConfigRef.current.tracks.length === 0) { setErrorMessage('Assign a WAV to at least one pad before starting the sequencer.'); return }
    sequencerRef.current.start(() => sequenceConfigRef.current)
    setIsPlaying(true)
  }
  const stopPlayback = () => { sequencerRef.current.stop(); setIsPlaying(false) }

  return <main className="station-shell"><section className="station-panel" aria-labelledby="station-title">
    <header className="station-header"><div><p className="eyebrow">STATION / M4</p><h1 id="station-title">STATION</h1></div><MainNavigation view={mainView} onViewChange={setMainView} /><div className="audio-controls"><div className="status-row" role="status" aria-live="polite"><span className={`status-dot status-${audioStatus}`} aria-hidden="true" />{statusLabels[audioStatus]}</div><button className="start-button" type="button" onClick={() => void startAudio()} disabled={audioStatus === 'starting'}>{audioReady ? 'AUDIO READY' : 'START AUDIO'}</button></div></header>
    <TransportBar bpm={bpm} swing={swing} isPlaying={isPlaying} onBpmChange={setBpm} onSwingChange={setSwing} onPlay={startPlayback} onStop={stopPlayback} />
    {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
    {mainView === 'chop' && <ChopWorkspace pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} sourceFileName={chopSession.fileName} sourceDurationSeconds={chopSession.durationSeconds} peaks={chopSession.peaks} slices={chopSession.slices} activeSliceId={chopSession.activeSliceId} addingSlice={chopSession.addingSlice} onLoadSource={(event) => void loadChopSource(event)} sourcePreviewing={sourcePreviewing} onPreviewSource={previewChopSource} onStopPreviewSource={stopChopSourcePreview} onTriggerPad={triggerPad} onFeedbackEnd={(padId) => setActivePadId((current) => current === padId ? null : current)} onAddSlice={addChopSlice} onMoveCut={moveChopCut} onSelectSlice={selectChopSlice} onPreviewSlice={previewChopSlice} onToggleAdding={() => setChopSession((current) => ({ ...current, addingSlice: !current.addingSlice }))} onRemoveActiveCut={removeActiveChopCut} onClearSlices={clearChopSlices} />}
    {mainView === 'pad' && <div className="instrument-layout"><PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} onTrigger={triggerPad} onFeedbackEnd={(padId) => setActivePadId((current) => current === padId ? null : current)} /><PadEditor pad={selectedPad} audioReady={audioReady} onImport={(event) => void loadSelectedPad(event)} onUpdate={updateSelectedPad} onClear={clearSelectedPad} /></div>}
    {mainView === 'seq' && <SequencerControls steps={patterns[selectedPad.id]} padLabel={selectedPad.label} loadedTrackCount={pads.filter((pad) => pad.fileName).length} onToggleStep={toggleStep} />}
    {mainView === 'sample' && <SampleEditor pad={selectedPad} peaks={selectedPeaks} audioReady={audioReady} onPreview={() => triggerPad(selectedPad.id)} onRegionChange={updateSelectedRegion} onResetRegion={resetSelectedRegion} />}
    {mainView === 'mix' && <><section className="sequencer" aria-labelledby="pump-title"><p className="eyebrow">BASIC PUMP</p><h2 id="pump-title">{pumpSourceId === selectedPad.id ? 'Kick source selected' : 'Select kick source or target'}</h2><button className="transport-button" type="button" onClick={() => setPumpSourceId(selectedPad.id)}>SET {selectedPad.label} AS KICK</button><label className="file-picker"><span><input type="checkbox" checked={pumpTargets.includes(selectedPad.id)} onChange={() => setPumpTargets((targets) => targets.includes(selectedPad.id) ? targets.filter((id) => id !== selectedPad.id) : [...targets, selectedPad.id])} /> Pump selected pad</span></label><label className="bpm-control">DEPTH <output>{Math.round(pumpDepth * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={pumpDepth} onChange={(event) => setPumpDepth(Number(event.target.value))} /></label><label className="bpm-control">LENGTH <output>{pumpLengthBeats} beat</output><input type="range" min="0.25" max="1" step="0.25" value={pumpLengthBeats} onChange={(event) => setPumpLengthBeats(Number(event.target.value))} /></label><div className="pump-curves">{(['snap', 'smooth', 'swell'] as const).map((curve) => <button key={curve} className={`step ${pumpCurve === curve ? 'step-full' : ''}`} type="button" onClick={() => setPumpCurve(curve)}>{curve.toUpperCase()}</button>)}</div></section><Mixer pads={pads} pumpSourceId={pumpSourceId} pumpTargets={pumpTargets} onVolumeChange={updateChannelVolume} onMutedChange={updateChannelMuted} onSoloChange={updateChannelSolo} /></>}
  </section></main>
}

function isTypingTarget(target: EventTarget | null): boolean { return target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) }
function toMessage(error: unknown): string { return error instanceof Error ? error.message : 'An unexpected audio error occurred.' }
