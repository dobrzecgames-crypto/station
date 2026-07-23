import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine, AudioEngineStatus, SampleAssetId } from './audio/AudioEngine'
import { StepSequencer } from './audio/StepSequencer'
import type { StepSequencerConfig, StepSequencerTrack } from './audio/StepSequencer'
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
import { collectReferencedAssetIds, createProjectState, projectSchemaVersion, validateProjectState } from './project/ProjectState'
import { ProjectKeyPanel } from './project/ProjectKeyPanel'
import { defaultProjectKey, formatProjectKey } from './music/scales'
import type { ProjectKey } from './music/scales'
import { findProjectScaleMapConflicts, mapPadBankToProjectScale } from './music/scaleMapping'
import { projectRepository } from './storage/ProjectRepository'
import { defaultProjectId } from './storage/storageTypes'
import { addPatternGroup, clearVariant, createInitialPatternGroups, duplicateVariant, getVariant, getVariantShifts, setVariantStepShift, setVariantStepVelocity, updateVariantStep } from './patterns/patternOperations'
import type { PatternGroup, PatternVariantName } from './patterns/patternTypes'
import { addPatternClip, getActiveClipsForSlot, getLastOccupiedSlot, removeClipsForGroup, removeClipsForVariant } from './song/songOperations'
import type { PatternClip, TransportMode } from './song/songTypes'
import { SongWorkspace } from './song/SongWorkspace'
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

const statusLabels: Record<AudioEngineStatus, string> = { inactive: 'Audio inactive', starting: 'Starting audio…', ready: 'Audio ready', suspended: 'Audio suspended', error: 'Audio error' }
const emptyChopSession = (): ChopSession => ({ id: '', assetId: null, fileName: null, durationSeconds: null, peaks: [], slices: [], activeSliceId: null, addingSlice: false })
function createAssetId(scope: string): SampleAssetId { return `asset-${scope}-${crypto.randomUUID()}` }
function createSliceId(scope: string): string { return `slice-${scope}-${crypto.randomUUID()}` }
function createChopSessionId(): string { return `chop-session-${crypto.randomUUID()}` }
function createPatternGroupId(): string { return `pattern-group-${crypto.randomUUID()}` }
function createPatternClipId(): string { return `pattern-clip-${crypto.randomUUID()}` }
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
  const [patternGroups, setPatternGroups] = useState<PatternGroup[]>(() => createInitialPatternGroups(createPadBank().map((pad) => pad.id)))
  const [selectedPatternGroupId, setSelectedPatternGroupId] = useState('pattern-group-1')
  const [selectedPatternVariant, setSelectedPatternVariant] = useState<PatternVariantName>('A')
  const [playlist, setPlaylist] = useState<PatternClip[]>([])
  const [transportMode, setTransportMode] = useState<TransportMode>('pattern')
  const [loopSong, setLoopSong] = useState(false)
  const [playingSongSlot, setPlayingSongSlot] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pumpSourceId, setPumpSourceId] = useState<string | null>(null)
  const [pumpTargets, setPumpTargets] = useState<string[]>([])
  const [pumpDepth, setPumpDepth] = useState(0.5)
  const [pumpLengthBeats, setPumpLengthBeats] = useState(0.5)
  const [pumpCurve, setPumpCurve] = useState<'snap' | 'smooth' | 'swell'>('smooth')
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({})
  const [chopSession, setChopSession] = useState<ChopSession>(emptyChopSession)
  const [sourcePreviewing, setSourcePreviewing] = useState(false)
  const [projectMessage, setProjectMessage] = useState<string>()
  const [projectBusy, setProjectBusy] = useState(false)
  const [projectKey, setProjectKey] = useState<ProjectKey>(defaultProjectKey)
  const sequencerRef = useRef(new StepSequencer(audioEngine))
  const selectedPad = pads.find((pad) => pad.id === selectedPadId)!
  const audioReady = audioStatus === 'ready'
  const selectedPeaks = selectedPad.assetId === chopSession.assetId ? chopSession.peaks : selectedPad.assetId ? waveforms[selectedPad.assetId] ?? [] : []
  const sequenceConfigRef = useRef<StepSequencerConfig>({ bpm, swing, mode: 'pattern', loopSong: false, lastSongSlot: null, getTracksForSlot: () => [] })

  sequenceConfigRef.current = {
    bpm,
    swing,
    mode: transportMode,
    loopSong,
    lastSongSlot: getLastOccupiedSlot(playlist),
    getTracksForSlot: (slot) => {
      const variants = transportMode === 'song'
        ? getActiveClipsForSlot(playlist, slot).map((clip) => ({ steps: getVariant(patternGroups, clip.patternGroupId, clip.variant), shifts: getVariantShifts(patternGroups, clip.patternGroupId, clip.variant) })).filter((pattern): pattern is { steps: NonNullable<typeof pattern.steps>; shifts: NonNullable<typeof pattern.shifts> } => Boolean(pattern.steps && pattern.shifts))
        : [{ steps: getVariant(patternGroups, selectedPatternGroupId, selectedPatternVariant), shifts: getVariantShifts(patternGroups, selectedPatternGroupId, selectedPatternVariant) }].filter((pattern): pattern is { steps: NonNullable<typeof pattern.steps>; shifts: NonNullable<typeof pattern.shifts> } => Boolean(pattern.steps && pattern.shifts))
      return variants.flatMap((pattern) => pads.filter((pad): pad is PadState & { assetId: SampleAssetId } => pad.assetId !== null && audioEngine.hasSampleAsset(pad.assetId)).map<StepSequencerTrack>((pad) => ({ sampleId: pad.id, assetId: pad.assetId, steps: pattern.steps[pad.id], shifts: pattern.shifts[pad.id], options: { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds } })))
    },
    onSongSlotChange: setPlayingSongSlot,
    onSongComplete: () => { setIsPlaying(false); setPlayingSongSlot(null) },
  }

  useEffect(() => { audioEngine.setPumpConfig({ sourceSampleId: pumpSourceId, targetSampleIds: pumpTargets, depth: pumpDepth, lengthSeconds: 60 / bpm * pumpLengthBeats, curve: pumpCurve }) }, [audioEngine, bpm, pumpCurve, pumpDepth, pumpLengthBeats, pumpSourceId, pumpTargets])
  useEffect(() => audioEngine.subscribeToStatus((status) => {
    setAudioStatus(status)
    if (status === 'suspended' && sequencerRef.current.isRunning()) {
      sequencerRef.current.stop()
      audioEngine.stopSequencerVoices()
      setIsPlaying(false)
    }
  }), [audioEngine])
  useEffect(() => () => { sequencerRef.current.stop(); audioEngine.stopSequencerVoices() }, [audioEngine])

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

  const createCurrentProjectState = () => {
    const assetReferences = new Map<SampleAssetId, { filename: string; durationSeconds: number }>()
    for (const pad of pads) if (pad.assetId && pad.fileName && pad.durationSeconds) assetReferences.set(pad.assetId, { filename: pad.fileName, durationSeconds: pad.durationSeconds })
    if (chopSession.assetId && chopSession.fileName && chopSession.durationSeconds) assetReferences.set(chopSession.assetId, { filename: chopSession.fileName, durationSeconds: chopSession.durationSeconds })
    return createProjectState({
      schemaVersion: projectSchemaVersion,
      projectKey,
      assets: [...assetReferences].map(([id, asset]) => ({ id, ...asset })),
      pads,
      patternGroups,
      selectedPatternGroupId,
      selectedPatternVariant,
      playlist,
      transportMode,
      loopSong,
      bpm,
      swing,
      pump: { sourcePadId: pumpSourceId, targetPadIds: pumpTargets, depth: pumpDepth, lengthBeats: pumpLengthBeats, curve: pumpCurve },
      chopSession: { id: chopSession.id, assetId: chopSession.assetId, fileName: chopSession.fileName, durationSeconds: chopSession.durationSeconds, slices: chopSession.slices, activeSliceId: chopSession.activeSliceId },
    })
  }

  const saveProject = async () => {
    if (projectBusy) return
    setProjectBusy(true)
    setProjectMessage(undefined)
    try {
      const snapshot = createCurrentProjectState()
      const validationErrors = validateProjectState(snapshot)
      if (validationErrors.length > 0) throw new Error(`Project cannot be saved: ${validationErrors[0]}`)
      const runtimeAssets = new Map<SampleAssetId, NonNullable<ReturnType<AudioEngine['getRuntimeSampleAsset']>>>()
      for (const assetId of collectReferencedAssetIds(snapshot)) {
        const asset = audioEngine.getRuntimeSampleAsset(assetId)
        if (!asset) throw new Error('Project cannot be saved because a referenced WAV is unavailable.')
        runtimeAssets.set(assetId, asset)
      }
      await projectRepository.saveProject(defaultProjectId, snapshot, runtimeAssets)
      setProjectMessage('Project saved.')
    } catch (error) {
      setProjectMessage(toMessage(error))
    } finally {
      setProjectBusy(false)
    }
  }

  const openProject = async () => {
    if (projectBusy) return
    if (!audioReady) { setProjectMessage('Start audio before opening a project.'); return }
    setProjectBusy(true)
    setProjectMessage(undefined)
    stopPlayback()
    audioEngine.stopPreview()
    setSourcePreviewing(false)
    try {
      const loadedProject = await projectRepository.loadLastProject()
      const nextWaveforms: Record<string, number[]> = {}
      for (const asset of loadedProject.assets) {
        await audioEngine.loadSampleBlob(asset.id, asset.blob, asset.filename)
        nextWaveforms[asset.id] = audioEngine.getWaveformPeaks(asset.id) ?? []
      }
      const state = loadedProject.state
      const openedAssetIds = new Set(loadedProject.assets.map((asset) => asset.id))
      for (const assetId of audioEngine.getSampleAssetIds()) if (!openedAssetIds.has(assetId)) audioEngine.removeSampleAsset(assetId)
      const nextChopSession: ChopSession = {
        id: state.chopSession.id,
        assetId: state.chopSession.assetId,
        fileName: state.chopSession.fileName,
        durationSeconds: state.chopSession.durationSeconds,
        peaks: state.chopSession.assetId ? nextWaveforms[state.chopSession.assetId] ?? [] : [],
        slices: state.chopSession.slices,
        activeSliceId: state.chopSession.activeSliceId,
        addingSlice: false,
      }
      for (const pad of state.pads) {
        audioEngine.setChannelVolume(pad.id, pad.volume)
        audioEngine.setChannelMuted(pad.id, pad.muted)
        audioEngine.setChannelSolo(pad.id, pad.solo)
      }
      audioEngine.setPumpConfig({ sourceSampleId: state.pump.sourcePadId, targetSampleIds: state.pump.targetPadIds, depth: state.pump.depth, lengthSeconds: 60 / state.bpm * state.pump.lengthBeats, curve: state.pump.curve })
      setPads(state.pads)
      setPatternGroups(state.patternGroups)
      setSelectedPatternGroupId(state.selectedPatternGroupId)
      setSelectedPatternVariant(state.selectedPatternVariant)
      setPlaylist(state.playlist)
      setTransportMode(state.transportMode)
      setLoopSong(state.loopSong)
      setPlayingSongSlot(null)
      setBpm(state.bpm)
      setSwing(state.swing)
      setPumpSourceId(state.pump.sourcePadId)
      setPumpTargets(state.pump.targetPadIds)
      setPumpDepth(state.pump.depth)
      setPumpLengthBeats(state.pump.lengthBeats)
      setPumpCurve(state.pump.curve)
      setProjectKey(state.projectKey)
      setWaveforms(nextWaveforms)
      setChopSession(nextChopSession)
      setSelectedPadId('pad-01')
      setActivePadId(null)
      setProjectMessage('Project opened.')
    } catch (error) {
      setProjectMessage(toMessage(error))
    } finally {
      setProjectBusy(false)
    }
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

  const mapSelectedPadToProjectScale = () => {
    if (projectBusy || !selectedPad.assetId) return
    const conflicts = findProjectScaleMapConflicts(pads, selectedPad.id)
    if (conflicts.length > 0 && !window.confirm(`Replace ${conflicts.length} occupied pad${conflicts.length === 1 ? '' : 's'} with the Project Scale map?`)) return
    const result = mapPadBankToProjectScale(pads, selectedPad.id, projectKey)
    setPads(result.pads)
    setProjectMessage(`Mapped ${result.mappedPadCount} pad${result.mappedPadCount === 1 ? '' : 's'} to ${formatProjectKey(projectKey)}.`)
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
      setChopSession({ id: createChopSessionId(), assetId, fileName: loaded.filename, durationSeconds: loaded.durationSeconds, peaks: audioEngine.getWaveformPeaks(assetId) ?? [], slices: [], activeSliceId: null, addingSlice: false })
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

  const selectedPattern = getVariant(patternGroups, selectedPatternGroupId, selectedPatternVariant)!
  const selectedPatternShifts = getVariantShifts(patternGroups, selectedPatternGroupId, selectedPatternVariant)!
  const toggleStep = (padId: PadState['id'], stepIndex: number) => setPatternGroups((current) => updateVariantStep(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex))
  const setStepVelocity = (padId: PadState['id'], stepIndex: number, velocity: number) => setPatternGroups((current) => setVariantStepVelocity(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex, velocity))
  const setStepShift = (padId: PadState['id'], stepIndex: number, shift: number) => setPatternGroups((current) => setVariantStepShift(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex, shift))
  const createNewPatternGroup = () => {
    try {
      const next = addPatternGroup(patternGroups, createPatternGroupId(), pads.map((pad) => pad.id))
      setPatternGroups(next)
      setSelectedPatternGroupId(next.at(-1)!.id)
      setSelectedPatternVariant('A')
    } catch (error) { setProjectMessage(toMessage(error)) }
  }
  const duplicateCurrentVariant = (target: PatternVariantName) => {
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const exists = Boolean(group.variants[target])
    if (exists && !window.confirm(`Overwrite ${group.name}${target} with ${group.name}${selectedPatternVariant}? Its pattern data will be replaced.`)) return
    try { setPatternGroups((current) => duplicateVariant(current, selectedPatternGroupId, selectedPatternVariant, target, exists)); setSelectedPatternVariant(target) } catch (error) { setProjectMessage(toMessage(error)) }
  }
  const clearCurrentVariant = () => {
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const references = playlist.filter((clip) => clip.patternGroupId === group.id && clip.variant === selectedPatternVariant)
    const warning = references.length > 0 ? `Clear ${group.name}${selectedPatternVariant}? This also removes ${references.length} Playlist clip${references.length === 1 ? '' : 's'} that reference it.` : `Clear ${group.name}${selectedPatternVariant}?`
    if (!window.confirm(warning)) return
    setPatternGroups((current) => clearVariant(current, selectedPatternGroupId, selectedPatternVariant, pads.map((pad) => pad.id)))
    if (references.length > 0) setPlaylist((current) => removeClipsForVariant(current, group.id, selectedPatternVariant))
  }
  const deleteCurrentPatternGroup = () => {
    if (patternGroups.length <= 1) return
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const references = playlist.filter((clip) => clip.patternGroupId === group.id)
    const warning = references.length > 0 ? `Delete ${group.name}? This also removes ${references.length} Playlist clip${references.length === 1 ? '' : 's'} that reference it.` : `Delete ${group.name}?`
    if (!window.confirm(warning)) return
    const next = patternGroups.filter((item) => item.id !== group.id)
    setPatternGroups(next)
    setPlaylist((current) => removeClipsForGroup(current, group.id))
    setSelectedPatternGroupId(next[0].id)
    setSelectedPatternVariant('A')
  }
  const addPlaylistClip = (groupId: string, variant: PatternVariantName, startSlot: number) => setPlaylist((current) => addPatternClip(current, { id: createPatternClipId(), patternGroupId: groupId, variant, startSlot }))
  const startPlayback = () => {
    if (isPlaying) return
    if (!audioReady) { setErrorMessage('Start audio before playing the sequencer.'); return }
    if (transportMode === 'song' && playlist.length === 0) { setErrorMessage('Add at least one Pattern Clip before playing SONG.'); return }
    if (sequenceConfigRef.current.getTracksForSlot(transportMode === 'song' ? 1 : 1).length === 0 && !pads.some((pad) => pad.assetId && audioEngine.hasSampleAsset(pad.assetId))) { setErrorMessage('Assign a WAV to at least one pad before starting the sequencer.'); return }
    sequencerRef.current.start(() => sequenceConfigRef.current)
    setIsPlaying(true)
  }
  const stopPlayback = () => { sequencerRef.current.stop(); audioEngine.stopSequencerVoices(); setIsPlaying(false); setPlayingSongSlot(null) }

  return <main className="station-shell"><section className="station-panel" aria-labelledby="station-title">
    <header className="station-header"><div><p className="eyebrow">STATION / M4</p><h1 id="station-title">STATION</h1></div><MainNavigation view={mainView} onViewChange={setMainView} /><div className="audio-controls"><div className="status-row" role="status" aria-live="polite"><span className={`status-dot status-${audioStatus}`} aria-hidden="true" />{statusLabels[audioStatus]}</div><button className="start-button" type="button" onClick={() => void startAudio()} disabled={audioStatus === 'starting' || projectBusy}>{audioReady ? 'AUDIO READY' : 'START AUDIO'}</button><div className="project-controls"><button className="mixer-toggle" type="button" onClick={() => void saveProject()} disabled={projectBusy}>SAVE PROJECT</button><button className="mixer-toggle" type="button" onClick={() => void openProject()} disabled={!audioReady || projectBusy} title={audioReady ? 'Open the last saved project.' : 'Start audio before opening a project.'}>OPEN PROJECT</button></div></div></header>
    <TransportBar bpm={bpm} swing={swing} isPlaying={isPlaying} mode={transportMode} loopSong={loopSong} onBpmChange={setBpm} onSwingChange={setSwing} onModeChange={setTransportMode} onLoopSongChange={setLoopSong} onPlay={startPlayback} onStop={stopPlayback} />
    <ProjectKeyPanel projectKey={projectKey} disabled={projectBusy} onChange={setProjectKey} />
    {projectMessage && <p className="project-message" role="status">{projectMessage}</p>}
    {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
    {mainView === 'chop' && <ChopWorkspace pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} sourceFileName={chopSession.fileName} sourceDurationSeconds={chopSession.durationSeconds} peaks={chopSession.peaks} slices={chopSession.slices} activeSliceId={chopSession.activeSliceId} addingSlice={chopSession.addingSlice} onLoadSource={(event) => void loadChopSource(event)} sourcePreviewing={sourcePreviewing} onPreviewSource={previewChopSource} onStopPreviewSource={stopChopSourcePreview} onTriggerPad={triggerPad} onFeedbackEnd={(padId) => setActivePadId((current) => current === padId ? null : current)} onAddSlice={addChopSlice} onMoveCut={moveChopCut} onSelectSlice={selectChopSlice} onPreviewSlice={previewChopSlice} onToggleAdding={() => setChopSession((current) => ({ ...current, addingSlice: !current.addingSlice }))} onRemoveActiveCut={removeActiveChopCut} onClearSlices={clearChopSlices} />}
    {mainView === 'pad' && <div className="instrument-layout"><PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} onTrigger={triggerPad} onFeedbackEnd={(padId) => setActivePadId((current) => current === padId ? null : current)} /><PadEditor pad={selectedPad} audioReady={audioReady} projectBusy={projectBusy} projectKeyLabel={formatProjectKey(projectKey)} onImport={(event) => void loadSelectedPad(event)} onUpdate={updateSelectedPad} onMapToProjectScale={mapSelectedPadToProjectScale} onClear={clearSelectedPad} /></div>}
    {mainView === 'seq' && <SequencerControls pattern={selectedPattern} shifts={selectedPatternShifts} pads={pads.filter((pad) => pad.fileName || pad.id === selectedPad.id)} selectedPadId={selectedPad.id} groups={patternGroups} selectedGroupId={selectedPatternGroupId} selectedVariant={selectedPatternVariant} onSelectPad={triggerPad} onSelectGroup={(groupId) => { setSelectedPatternGroupId(groupId); setSelectedPatternVariant('A') }} onSelectVariant={setSelectedPatternVariant} onNewGroup={createNewPatternGroup} onDuplicateVariant={duplicateCurrentVariant} onClearVariant={clearCurrentVariant} onDeleteGroup={deleteCurrentPatternGroup} onToggleStep={toggleStep} onVelocityChange={setStepVelocity} onShiftChange={setStepShift} />}
    {mainView === 'song' && <SongWorkspace groups={patternGroups} clips={playlist} selectedGroupId={selectedPatternGroupId} selectedVariant={selectedPatternVariant} activeSlot={isPlaying && transportMode === 'song' ? playingSongSlot : null} onAddClip={addPlaylistClip} />}
    {mainView === 'sample' && <SampleEditor pad={selectedPad} peaks={selectedPeaks} audioReady={audioReady} onPreview={() => triggerPad(selectedPad.id)} onRegionChange={updateSelectedRegion} onResetRegion={resetSelectedRegion} />}
    {mainView === 'mix' && <><section className="sequencer" aria-labelledby="pump-title"><p className="eyebrow">BASIC PUMP</p><h2 id="pump-title">{pumpSourceId === selectedPad.id ? 'Kick source selected' : 'Select kick source or target'}</h2><button className="transport-button" type="button" onClick={() => setPumpSourceId(selectedPad.id)}>SET {selectedPad.label} AS KICK</button><label className="file-picker"><span><input type="checkbox" checked={pumpTargets.includes(selectedPad.id)} onChange={() => setPumpTargets((targets) => targets.includes(selectedPad.id) ? targets.filter((id) => id !== selectedPad.id) : [...targets, selectedPad.id])} /> Pump selected pad</span></label><label className="bpm-control">DEPTH <output>{Math.round(pumpDepth * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={pumpDepth} onChange={(event) => setPumpDepth(Number(event.target.value))} /></label><label className="bpm-control">LENGTH <output>{pumpLengthBeats} beat</output><input type="range" min="0.25" max="1" step="0.25" value={pumpLengthBeats} onChange={(event) => setPumpLengthBeats(Number(event.target.value))} /></label><div className="pump-curves">{(['snap', 'smooth', 'swell'] as const).map((curve) => <button key={curve} className={`step ${pumpCurve === curve ? 'step-full' : ''}`} type="button" onClick={() => setPumpCurve(curve)}>{curve.toUpperCase()}</button>)}</div></section><Mixer pads={pads} pumpSourceId={pumpSourceId} pumpTargets={pumpTargets} onVolumeChange={updateChannelVolume} onMutedChange={updateChannelMuted} onSoloChange={updateChannelSolo} /></>}
  </section></main>
}

function isTypingTarget(target: EventTarget | null): boolean { return target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) }
function toMessage(error: unknown): string { return error instanceof Error ? error.message : 'An unexpected audio error occurred.' }
