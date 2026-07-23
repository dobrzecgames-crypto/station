import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine, AudioEngineStatus, SampleAssetId } from './audio/AudioEngine'
import { createChannelId, sameGroupPadReference } from './audio/channelIdentity'
import type { GroupPadReference } from './audio/channelIdentity'
import { StepSequencer } from './audio/StepSequencer'
import type { StepSequencerConfig, StepSequencerTrack } from './audio/StepSequencer'
import { ChopWorkspace } from './chop/ChopWorkspace'
import { Mixer } from './mixer/Mixer'
import { clonePadBank, createPadBank, padIdByKeyCode } from './pads/padBank'
import type { PadBankState } from './pads/padBank'
import { PadEditor } from './pads/PadEditor'
import { PadGrid } from './pads/PadGrid'
import type { ChopSessionState, PadState, SamplePlaybackRegion, SampleSlice } from './pads/types'
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

const statusLabels: Record<AudioEngineStatus, string> = { inactive: 'Audio inactive', starting: 'Starting audio…', ready: 'Audio ready', suspended: 'Audio suspended', error: 'Audio error' }
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
  const [selectedPadId, setSelectedPadId] = useState<PadState['id']>('pad-01')
  const [activePadId, setActivePadId] = useState<PadState['id'] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [bpm, setBpm] = useState(120)
  const [swing, setSwing] = useState(0)
  const [master, setMaster] = useState({ volume: 1, muted: false })
  const [patternGroups, setPatternGroups] = useState<PatternGroup[]>(() => createInitialPatternGroups(createPadBank().map((pad) => pad.id)))
  const [selectedPatternGroupId, setSelectedPatternGroupId] = useState('pattern-group-1')
  const [selectedPatternVariant, setSelectedPatternVariant] = useState<PatternVariantName>('A')
  const [playlist, setPlaylist] = useState<PatternClip[]>([])
  const [transportMode, setTransportMode] = useState<TransportMode>('pattern')
  const [loopSong, setLoopSong] = useState(false)
  const [playingSongSlot, setPlayingSongSlot] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pumpSource, setPumpSource] = useState<GroupPadReference | null>(null)
  const [pumpTargets, setPumpTargets] = useState<GroupPadReference[]>([])
  const [pumpDepth, setPumpDepth] = useState(0.5)
  const [pumpLengthBeats, setPumpLengthBeats] = useState(0.5)
  const [pumpCurve, setPumpCurve] = useState<'snap' | 'smooth' | 'swell'>('smooth')
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({})
  const [chopAddingSlice, setChopAddingSlice] = useState(false)
  const [sourcePreviewing, setSourcePreviewing] = useState(false)
  const [projectMessage, setProjectMessage] = useState<string>()
  const [projectBusy, setProjectBusy] = useState(false)
  const [projectKey, setProjectKey] = useState<ProjectKey>(defaultProjectKey)
  const sequencerRef = useRef(new StepSequencer(audioEngine))
  const selectedGroup = patternGroups.find((group) => group.id === selectedPatternGroupId)!
  const pads = selectedGroup.bank.pads
  const chopSession = selectedGroup.bank.chopSession
  const selectedPad = pads.find((pad) => pad.id === selectedPadId)!
  const audioReady = audioStatus === 'ready'
  const selectedPeaks = selectedPad.assetId ? waveforms[selectedPad.assetId] ?? [] : []
  const sequenceConfigRef = useRef<StepSequencerConfig>({ bpm, swing, mode: 'pattern', loopSong: false, lastSongSlot: null, getTracksForSlot: () => [] })

  sequenceConfigRef.current = {
    bpm,
    swing,
    mode: transportMode,
    loopSong,
    lastSongSlot: getLastOccupiedSlot(playlist),
    getTracksForSlot: (slot) => {
      const variants = transportMode === 'song'
        ? getActiveClipsForSlot(playlist, slot).map((clip) => ({ group: patternGroups.find((group) => group.id === clip.patternGroupId), steps: getVariant(patternGroups, clip.patternGroupId, clip.variant), shifts: getVariantShifts(patternGroups, clip.patternGroupId, clip.variant) })).filter((pattern): pattern is { group: PatternGroup; steps: NonNullable<typeof pattern.steps>; shifts: NonNullable<typeof pattern.shifts> } => Boolean(pattern.group && pattern.steps && pattern.shifts))
        : [{ group: selectedGroup, steps: getVariant(patternGroups, selectedPatternGroupId, selectedPatternVariant), shifts: getVariantShifts(patternGroups, selectedPatternGroupId, selectedPatternVariant) }].filter((pattern): pattern is { group: PatternGroup; steps: NonNullable<typeof pattern.steps>; shifts: NonNullable<typeof pattern.shifts> } => Boolean(pattern.steps && pattern.shifts))
      return variants.flatMap((pattern) => pattern.group.bank.pads.filter((pad): pad is PadState & { assetId: SampleAssetId } => pad.assetId !== null && audioEngine.hasSampleAsset(pad.assetId)).map<StepSequencerTrack>((pad) => ({ groupId: pattern.group.id, channelId: createChannelId({ patternGroupId: pattern.group.id, padId: pad.id }), assetId: pad.assetId, steps: pattern.steps[pad.id], shifts: pattern.shifts[pad.id], options: { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds } })))
    },
    onSongSlotChange: setPlayingSongSlot,
    onSongComplete: () => { setIsPlaying(false); setPlayingSongSlot(null) },
  }

  useEffect(() => { audioEngine.setPumpConfig({ sourceChannelId: pumpSource ? createChannelId(pumpSource) : null, targetChannelIds: pumpTargets.map(createChannelId), depth: pumpDepth, lengthSeconds: 60 / bpm * pumpLengthBeats, curve: pumpCurve }) }, [audioEngine, bpm, pumpCurve, pumpDepth, pumpLengthBeats, pumpSource, pumpTargets])
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
    audioEngine.triggerSample(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), pad.assetId, { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds })
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
    for (const group of patternGroups) {
      for (const pad of group.bank.pads) if (pad.assetId && pad.fileName && pad.durationSeconds) assetReferences.set(pad.assetId, { filename: pad.fileName, durationSeconds: pad.durationSeconds })
      const source = group.bank.chopSession
      if (source.assetId && source.fileName && source.durationSeconds) assetReferences.set(source.assetId, { filename: source.fileName, durationSeconds: source.durationSeconds })
    }
    return createProjectState({
      schemaVersion: projectSchemaVersion,
      projectKey,
      assets: [...assetReferences].map(([id, asset]) => ({ id, ...asset })),
      patternGroups,
      selectedPatternGroupId,
      selectedPatternVariant,
      playlist,
      transportMode,
      loopSong,
      bpm,
      swing,
      master,
      pump: { source: pumpSource, targets: pumpTargets, depth: pumpDepth, lengthBeats: pumpLengthBeats, curve: pumpCurve },
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
      for (const group of state.patternGroups) for (const pad of group.bank.pads) {
        const channelId = createChannelId({ patternGroupId: group.id, padId: pad.id })
        audioEngine.setChannelVolume(group.id, channelId, pad.volume)
        audioEngine.setChannelMuted(group.id, channelId, pad.muted)
        audioEngine.setChannelSolo(group.id, channelId, pad.solo)
      }
      for (const group of state.patternGroups) {
        audioEngine.setGroupVolume(group.id, group.bus!.volume)
        audioEngine.setGroupMuted(group.id, group.bus!.muted)
        audioEngine.setGroupSolo(group.id, group.bus!.solo)
      }
      audioEngine.setMasterVolume(state.master.volume)
      audioEngine.setMasterMuted(state.master.muted)
      audioEngine.setPumpConfig({ sourceChannelId: state.pump.source ? createChannelId(state.pump.source) : null, targetChannelIds: state.pump.targets.map(createChannelId), depth: state.pump.depth, lengthSeconds: 60 / state.bpm * state.pump.lengthBeats, curve: state.pump.curve })
      setPatternGroups(state.patternGroups)
      setSelectedPatternGroupId(state.selectedPatternGroupId)
      setSelectedPatternVariant(state.selectedPatternVariant)
      setPlaylist(state.playlist)
      setTransportMode(state.transportMode)
      setLoopSong(state.loopSong)
      setPlayingSongSlot(null)
      setBpm(state.bpm)
      setSwing(state.swing)
      setMaster(state.master)
      setPumpSource(state.pump.source)
      setPumpTargets(state.pump.targets)
      setPumpDepth(state.pump.depth)
      setPumpLengthBeats(state.pump.lengthBeats)
      setPumpCurve(state.pump.curve)
      setProjectKey(state.projectKey)
      setWaveforms(nextWaveforms)
      setChopAddingSlice(false)
      setSelectedPadId('pad-01')
      setActivePadId(null)
      setProjectMessage('Project opened.')
    } catch (error) {
      setProjectMessage(toMessage(error))
    } finally {
      setProjectBusy(false)
    }
  }

  const replaceActiveBank = (bank: PadBankState) => {
    setPatternGroups((groups) => groups.map((group) => group.id === selectedPatternGroupId ? { ...group, bank: clonePadBank(bank) } : group))
  }

  const updateSelectedPad = (changes: Pick<PadState, 'volume' | 'pitchSemitones'>) => {
    replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? { ...pad, ...changes } : pad) })
    audioEngine.setChannelVolume(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId: selectedPadId }), changes.volume)
  }
  const updateChannelVolume = (padId: PadState['id'], volume: number) => { replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === padId ? { ...pad, volume } : pad) }); audioEngine.setChannelVolume(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), volume) }
  const updateChannelMuted = (padId: PadState['id'], muted: boolean) => { replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === padId ? { ...pad, muted } : pad) }); audioEngine.setChannelMuted(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), muted) }
  const updateChannelSolo = (padId: PadState['id'], solo: boolean) => { replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === padId ? { ...pad, solo } : pad) }); audioEngine.setChannelSolo(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), solo) }
  const updateGroupBus = (groupId: string, changes: { volume?: number; muted?: boolean; solo?: boolean }) => {
    const group = patternGroups.find((item) => item.id === groupId)
    if (!group?.bus) return
    setPatternGroups((groups) => groups.map((item) => item.id === groupId ? { ...item, bus: { ...item.bus!, ...changes } } : item))
    if (changes.volume !== undefined) audioEngine.setGroupVolume(groupId, changes.volume)
    if (changes.muted !== undefined) audioEngine.setGroupMuted(groupId, changes.muted)
    if (changes.solo !== undefined) audioEngine.setGroupSolo(groupId, changes.solo)
  }
  const updateMaster = (changes: { volume?: number; muted?: boolean }) => {
    setMaster((current) => ({ ...current, ...changes }))
    if (changes.volume !== undefined) audioEngine.setMasterVolume(changes.volume)
    if (changes.muted !== undefined) audioEngine.setMasterMuted(changes.muted)
  }

  const groupsWithActiveBank = (bank: PadBankState) => patternGroups.map((group) => group.id === selectedPatternGroupId ? { ...group, bank } : group)
  const removeAssetIfUnused = (assetId: SampleAssetId | null, groups: readonly PatternGroup[]) => {
    if (!assetId || assetIsReferencedByGroups(groups, assetId)) return
    audioEngine.removeSampleAsset(assetId)
    setWaveforms((current) => { const { [assetId]: _, ...remaining } = current; return remaining })
  }

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
      const bank = { ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? { ...pad, assetId, fileName: loadedSample.filename, durationSeconds: loadedSample.durationSeconds, region: { startSeconds: 0, endSeconds: loadedSample.durationSeconds }, slices: [], chopSessionId: null } : pad) }
      const groups = groupsWithActiveBank(bank)
      setPatternGroups(groups)
      setWaveforms((current) => ({ ...current, [assetId]: waveform }))
      removeAssetIfUnused(previousAssetId, groups)
    } catch (error) { setErrorMessage(toMessage(error)) }
  }

  const clearSelectedPad = () => {
    const assetId = selectedPad.assetId
    const groups = groupsWithActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? clearPadAssignment(pad) : pad) })
    setPatternGroups(groups)
    removeAssetIfUnused(assetId, groups)
    setActivePadId((current) => current === selectedPadId ? null : current)
  }

  const mapSelectedPadToProjectScale = () => {
    if (projectBusy || !selectedPad.assetId) return
    const conflicts = findProjectScaleMapConflicts(pads, selectedPad.id)
    if (conflicts.length > 0 && !window.confirm(`Replace ${conflicts.length} occupied pad${conflicts.length === 1 ? '' : 's'} with the Project Scale map?`)) return
    const result = mapPadBankToProjectScale(pads, selectedPad.id, projectKey)
    replaceActiveBank({ ...selectedGroup.bank, pads: result.pads })
    setProjectMessage(`Mapped ${result.mappedPadCount} pad${result.mappedPadCount === 1 ? '' : 's'} to ${formatProjectKey(projectKey)}.`)
  }

  const updateSelectedRegion = (region: SamplePlaybackRegion) => {
    const durationSeconds = selectedPad.durationSeconds
    if (!durationSeconds) return
    const minimumLength = Math.min(0.01, durationSeconds)
    const startSeconds = Math.min(Math.max(0, region.startSeconds), durationSeconds - minimumLength)
    const endSeconds = Math.min(durationSeconds, Math.max(startSeconds + minimumLength, region.endSeconds))
    replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? { ...pad, region: { startSeconds, endSeconds } } : pad) })
  }
  const resetSelectedRegion = () => { if (selectedPad.durationSeconds) updateSelectedRegion({ startSeconds: 0, endSeconds: selectedPad.durationSeconds }) }

  const applyChopMapping = (nextSlices: SampleSlice[], nextSession: ChopSessionState): boolean => {
    if (!chopSession.assetId || !chopSession.durationSeconds) return false
    const conflicts = pads.slice(0, nextSlices.length).filter((pad) => pad.assetId && pad.chopSessionId !== chopSession.id)
    if (conflicts.length > 0 && !window.confirm(`Replace ${conflicts.length} occupied pad${conflicts.length === 1 ? '' : 's'} with live Chop slices?`)) return false
    const bank = { pads: pads.map((pad, index) => {
      const slice = nextSlices[index]
      if (slice) return { ...pad, assetId: chopSession.assetId!, fileName: chopSession.fileName, durationSeconds: chopSession.durationSeconds, region: { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds }, slices: [], chopSessionId: chopSession.id }
      return pad.chopSessionId === chopSession.id ? clearPadAssignment(pad) : pad
    }), chopSession: nextSession }
    replaceActiveBank(bank)
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
      const bank = { pads: pads.map((pad) => pad.chopSessionId === chopSession.id ? { ...pad, chopSessionId: null } : pad), chopSession: { id: createChopSessionId(), assetId, fileName: loaded.filename, durationSeconds: loaded.durationSeconds, slices: [], activeSliceId: null } }
      const groups = groupsWithActiveBank(bank)
      setPatternGroups(groups)
      setChopAddingSlice(false)
      removeAssetIfUnused(oldAssetId, groups)
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
    applyChopMapping(nextSlices, { ...chopSession, slices: nextSlices, activeSliceId: newSlice.id })
  }

  const moveChopCut = (cutIndex: number, timeSeconds: number) => {
    const left = chopSession.slices[cutIndex]
    const right = chopSession.slices[cutIndex + 1]
    if (!left || !right) return
    const minimumLength = Math.min(0.01, chopSession.durationSeconds ?? 0.01)
    const cutTime = Math.min(right.endSeconds - minimumLength, Math.max(left.startSeconds + minimumLength, timeSeconds))
    const nextSlices = chopSession.slices.map((slice, index) => index === cutIndex ? { ...slice, endSeconds: cutTime } : index === cutIndex + 1 ? { ...slice, startSeconds: cutTime } : slice)
    applyChopMapping(nextSlices, { ...chopSession, slices: nextSlices })
  }

  const removeActiveChopCut = () => {
    const activeIndex = chopSession.slices.findIndex((slice) => slice.id === chopSession.activeSliceId)
    if (chopSession.slices.length < 2 || activeIndex < 0) return
    const cutIndex = activeIndex < chopSession.slices.length - 1 ? activeIndex : activeIndex - 1
    const left = chopSession.slices[cutIndex]
    const right = chopSession.slices[cutIndex + 1]
    const merged = chopSession.slices.flatMap((slice, index) => index === cutIndex ? [{ ...left, endSeconds: right.endSeconds }] : index === cutIndex + 1 ? [] : [slice])
    const nextSlices = merged.length === 1 ? [] : merged
    applyChopMapping(nextSlices, { ...chopSession, slices: nextSlices, activeSliceId: nextSlices.length ? left.id : null })
  }

  const clearChopSlices = () => {
    if (applyChopMapping([], { ...chopSession, slices: [], activeSliceId: null })) setChopAddingSlice(false)
  }

  const previewChopSource = () => {
    if (!audioReady || !chopSession.assetId || sourcePreviewing) return
    setSourcePreviewing(true)
    audioEngine.previewAsset(chopSession.assetId, {}, () => setSourcePreviewing(false))
  }
  const stopChopSourcePreview = () => { audioEngine.stopPreview(); setSourcePreviewing(false) }
  const previewChopSlice = (slice: SampleSlice) => { if (audioReady) audioEngine.previewAsset(slice.sourceAssetId, { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds }); replaceActiveBank({ ...selectedGroup.bank, chopSession: { ...chopSession, activeSliceId: slice.id } }) }
  const selectChopSlice = (sliceId: string) => { const index = chopSession.slices.findIndex((slice) => slice.id === sliceId); replaceActiveBank({ ...selectedGroup.bank, chopSession: { ...chopSession, activeSliceId: sliceId } }); if (index >= 0) setSelectedPadId(pads[index].id) }

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
    setPumpSource((current) => current?.patternGroupId === group.id ? null : current)
    setPumpTargets((current) => current.filter((target) => target.patternGroupId !== group.id))
    for (const assetId of group.bank.pads.map((pad) => pad.assetId).concat(group.bank.chopSession.assetId ?? [])) removeAssetIfUnused(assetId, next)
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
  const selectedPadReference = { patternGroupId: selectedPatternGroupId, padId: selectedPad.id }
  const selectedPumpSourceId = pumpSource?.patternGroupId === selectedPatternGroupId ? pumpSource.padId : null
  const selectedPumpTargets = pumpTargets.filter((target) => target.patternGroupId === selectedPatternGroupId).map((target) => target.padId)

  return <main className="station-shell"><section className="station-panel" aria-labelledby="station-title">
    <header className="station-header"><div><p className="eyebrow">STATION / M4</p><h1 id="station-title">STATION</h1></div><MainNavigation view={mainView} onViewChange={setMainView} /><div className="audio-controls"><div className="status-row" role="status" aria-live="polite"><span className={`status-dot status-${audioStatus}`} aria-hidden="true" />{statusLabels[audioStatus]}</div><button className="start-button" type="button" onClick={() => void startAudio()} disabled={audioStatus === 'starting' || projectBusy}>{audioReady ? 'AUDIO READY' : 'START AUDIO'}</button><div className="project-controls"><button className="mixer-toggle" type="button" onClick={() => void saveProject()} disabled={projectBusy}>SAVE PROJECT</button><button className="mixer-toggle" type="button" onClick={() => void openProject()} disabled={!audioReady || projectBusy} title={audioReady ? 'Open the last saved project.' : 'Start audio before opening a project.'}>OPEN PROJECT</button></div></div></header>
    <TransportBar bpm={bpm} swing={swing} isPlaying={isPlaying} mode={transportMode} loopSong={loopSong} onBpmChange={setBpm} onSwingChange={setSwing} onModeChange={setTransportMode} onLoopSongChange={setLoopSong} onPlay={startPlayback} onStop={stopPlayback} />
    <ProjectKeyPanel projectKey={projectKey} disabled={projectBusy} onChange={setProjectKey} />
    {projectMessage && <p className="project-message" role="status">{projectMessage}</p>}
    {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
    {mainView === 'chop' && <ChopWorkspace pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} sourceFileName={chopSession.fileName} sourceDurationSeconds={chopSession.durationSeconds} peaks={chopSession.assetId ? waveforms[chopSession.assetId] ?? [] : []} slices={chopSession.slices} activeSliceId={chopSession.activeSliceId} addingSlice={chopAddingSlice} onLoadSource={(event) => void loadChopSource(event)} sourcePreviewing={sourcePreviewing} onPreviewSource={previewChopSource} onStopPreviewSource={stopChopSourcePreview} onTriggerPad={triggerPad} onFeedbackEnd={(padId) => setActivePadId((current) => current === padId ? null : current)} onAddSlice={addChopSlice} onMoveCut={moveChopCut} onSelectSlice={selectChopSlice} onPreviewSlice={previewChopSlice} onToggleAdding={() => setChopAddingSlice((current) => !current)} onRemoveActiveCut={removeActiveChopCut} onClearSlices={clearChopSlices} />}
    {mainView === 'pad' && <div className="instrument-layout"><PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} onTrigger={triggerPad} onFeedbackEnd={(padId) => setActivePadId((current) => current === padId ? null : current)} /><PadEditor pad={selectedPad} audioReady={audioReady} projectBusy={projectBusy} projectKeyLabel={formatProjectKey(projectKey)} onImport={(event) => void loadSelectedPad(event)} onUpdate={updateSelectedPad} onMapToProjectScale={mapSelectedPadToProjectScale} onClear={clearSelectedPad} /></div>}
    {mainView === 'seq' && <SequencerControls pattern={selectedPattern} shifts={selectedPatternShifts} pads={pads.filter((pad) => pad.fileName || pad.id === selectedPad.id)} selectedPadId={selectedPad.id} groups={patternGroups} selectedGroupId={selectedPatternGroupId} selectedVariant={selectedPatternVariant} onSelectPad={triggerPad} onSelectGroup={(groupId) => { audioEngine.stopPreview(); setSourcePreviewing(false); setChopAddingSlice(false); setSelectedPatternGroupId(groupId); setSelectedPatternVariant('A') }} onSelectVariant={setSelectedPatternVariant} onNewGroup={createNewPatternGroup} onDuplicateVariant={duplicateCurrentVariant} onClearVariant={clearCurrentVariant} onDeleteGroup={deleteCurrentPatternGroup} onToggleStep={toggleStep} onVelocityChange={setStepVelocity} onShiftChange={setStepShift} />}
    {mainView === 'song' && <SongWorkspace groups={patternGroups} clips={playlist} selectedGroupId={selectedPatternGroupId} selectedVariant={selectedPatternVariant} activeSlot={isPlaying && transportMode === 'song' ? playingSongSlot : null} onAddClip={addPlaylistClip} />}
    {mainView === 'sample' && <SampleEditor pad={selectedPad} peaks={selectedPeaks} audioReady={audioReady} onPreview={() => triggerPad(selectedPad.id)} onRegionChange={updateSelectedRegion} onResetRegion={resetSelectedRegion} />}
    {mainView === 'mix' && <><section className="mixer" aria-labelledby="group-mixer-title"><div className="sequencer-heading"><div><p className="eyebrow">GROUP MIX</p><h2 id="group-mixer-title">Pattern Group buses + Master</h2></div><p className="mixer-summary">MUTE overrides SOLO</p></div><div className="mixer-grid">{patternGroups.map((group) => <article className="mixer-channel" key={group.id}><div className="mixer-channel-heading"><strong>{group.name}</strong><span className="sample-badge sample-loaded">GROUP</span></div><p className="mixer-sample">16 PAD BANK</p><label className="mixer-volume">VOL <output>{group.bus!.volume.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={group.bus!.volume} onChange={(event) => updateGroupBus(group.id, { volume: Number(event.target.value) })} /></label><div className="mixer-buttons"><button className={group.bus!.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" onClick={() => updateGroupBus(group.id, { muted: !group.bus!.muted })}>MUTE</button><button className={group.bus!.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" onClick={() => updateGroupBus(group.id, { solo: !group.bus!.solo })}>SOLO</button></div></article>)}<article className="mixer-channel"><div className="mixer-channel-heading"><strong>MASTER</strong><span className="sample-badge sample-loaded">OUT</span></div><p className="mixer-sample">MAIN OUTPUT</p><label className="mixer-volume">VOL <output>{master.volume.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={master.volume} onChange={(event) => updateMaster({ volume: Number(event.target.value) })} /></label><div className="mixer-buttons"><button className={master.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" onClick={() => updateMaster({ muted: !master.muted })}>MUTE</button></div></article></div></section><section className="sequencer" aria-labelledby="pump-title"><p className="eyebrow">PAD MIX / {selectedGroup.name}</p><h2 id="pump-title">{sameGroupPadReference(pumpSource, selectedPadReference) ? 'Kick source selected' : 'Select kick source or target'}</h2><button className="transport-button" type="button" onClick={() => setPumpSource(selectedPadReference)}>SET {selectedPad.label} AS KICK</button><label className="file-picker"><span><input type="checkbox" checked={pumpTargets.some((target) => sameGroupPadReference(target, selectedPadReference))} onChange={() => setPumpTargets((targets) => targets.some((target) => sameGroupPadReference(target, selectedPadReference)) ? targets.filter((target) => !sameGroupPadReference(target, selectedPadReference)) : [...targets, selectedPadReference])} /> Pump selected pad</span></label><label className="bpm-control">DEPTH <output>{Math.round(pumpDepth * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={pumpDepth} onChange={(event) => setPumpDepth(Number(event.target.value))} /></label><label className="bpm-control">LENGTH <output>{pumpLengthBeats} beat</output><input type="range" min="0.25" max="1" step="0.25" value={pumpLengthBeats} onChange={(event) => setPumpLengthBeats(Number(event.target.value))} /></label><div className="pump-curves">{(['snap', 'smooth', 'swell'] as const).map((curve) => <button key={curve} className={`step ${pumpCurve === curve ? 'step-full' : ''}`} type="button" onClick={() => setPumpCurve(curve)}>{curve.toUpperCase()}</button>)}</div></section><Mixer pads={pads} pumpSourceId={selectedPumpSourceId} pumpTargets={selectedPumpTargets} onVolumeChange={updateChannelVolume} onMutedChange={updateChannelMuted} onSoloChange={updateChannelSolo} /></>}
  </section></main>
}

function isTypingTarget(target: EventTarget | null): boolean { return target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) }
function toMessage(error: unknown): string { return error instanceof Error ? error.message : 'An unexpected audio error occurred.' }
function assetIsReferencedByGroups(groups: readonly PatternGroup[], assetId: SampleAssetId): boolean {
  return groups.some((group) => group.bank.pads.some((pad) => pad.assetId === assetId) || group.bank.chopSession.assetId === assetId)
}
