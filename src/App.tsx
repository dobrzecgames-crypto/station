import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine, AudioEngineStatus, SampleAssetId } from './audio/AudioEngine'
import { createDefaultMasterEffectRack } from './audio/effects'
import type { EffectRackState } from './audio/effects'
import { createChannelId } from './audio/channelIdentity'
import { StepSequencer } from './audio/StepSequencer'
import type { StepSequencerConfig } from './audio/StepSequencer'
import { encodeWav } from './audio/wavEncoder'
import { ChopDisplayLauncher } from './chop/ChopDisplay'
import { ChopWorkspace } from './chop/ChopWorkspace'
import type { LibrarySample } from './library/builtInLibrary'
import { Mixer } from './mixer/Mixer'
import { BusDisplayLauncher } from './mixer/BusDisplay'
import { MixTargetSelector } from './mixer/GroupMixPanel'
import type { MixScope } from './mixer/GroupMixPanel'
import { EffectDisplayLauncher } from './mixer/EffectDisplay'
import { PumpDisplayLauncher } from './mixer/PumpDisplay'
import { clonePadBank, createPadBank, padIdByKeyCode } from './pads/padBank'
import type { PadBankState } from './pads/padBank'
import { PadDisplayLauncher } from './pads/PadDisplay'
import { PadGrid } from './pads/PadGrid'
import type { ChopSessionState, PadState, SamplePlaybackRegion, SampleSlice } from './pads/types'
import { SampleEditor } from './sample-editor/SampleEditor'
import { SequencerControls } from './sequencer/SequencerControls'
import { MainNavigation } from './shell/MainNavigation'
import type { MainView } from './shell/MainNavigation'
import { TransportBar } from './shell/TransportBar'
import { SystemDisplayProvider, useSystemDisplayHost } from './shell/systemDisplayContext'
import { collectReferencedAssetIds, createProjectState, projectSchemaVersion, validateProjectState } from './project/ProjectState'
import type { PumpRoute } from './project/ProjectState'
import { ProjectDisplayButton } from './project/ProjectDisplay'
import { renderSongToBuffer } from './project/renderSong'
import type { RenderSongResult } from './project/renderSong'
import { defaultProjectKey, formatProjectKey } from './music/scales'
import type { ProjectKey } from './music/scales'
import { findProjectScaleMapConflicts, mapPadBankToProjectScale } from './music/scaleMapping'
import { projectRepository } from './storage/ProjectRepository'
import { defaultProjectId } from './storage/storageTypes'
import { addPatternGroup, clearVariant, createInitialPatternGroups, duplicateVariant, getVariant, getVariantShifts, setVariantStepShift, setVariantStepVelocity, updateVariantStep } from './patterns/patternOperations'
import type { PatternGroup, PatternVariantName } from './patterns/patternTypes'
import { addPatternClip, getLastOccupiedSlot, removeClipsForGroup, removeClipsForVariant, removePatternClip } from './song/songOperations'
import type { PatternClip, TransportMode } from './song/songTypes'
import { getPatternTracks, getSongTracksForSlot } from './song/songTracks'
import { SongWorkspace } from './song/SongWorkspace'
import type { SliceRegion } from './chop/autoChopOperations'
import { chopTestSamples } from './chop/chopTestSamples'
import type { ChopTestSample } from './chop/chopTestSamples'
import { assignSynthSource, clearPadSource, createDefaultSynthPatch, getSynthPatch, maximumSynthMidiNote, minimumSynthMidiNote, removeUnreferencedSynthPatches, resolveSynthPadMidiNotes } from './synth/synthOperations'
import type { SynthPatch, SynthVoiceMode } from './synth/synthTypes'
import { SynthWorkspace } from './synth/SynthWorkspace'
import './App.css'
// Loaded after App.css on purpose - the Lab Interface layer overrides the older
// visual passes wholesale. See docs/DESIGN_SYSTEM.md.
import './lab-interface.css'

interface AppProps { audioEngine: AudioEngine }
interface FxContext { scope: 'group' | 'master'; slotIndex: 0 | 1 }
interface WaveformPlayback { assetId: SampleAssetId; startedAt: number; startSeconds: number; endSeconds: number }
interface SequencerPlayhead { stepIndex: number; startsAt: number; durationSeconds: number }

const emptySongPlaylistNotice = 'Add at least one Pattern Clip before playing SONG.'

function createRuntimeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createAssetId(scope: string): SampleAssetId { return `asset-${scope}-${createRuntimeId()}` }
function createSliceId(scope: string): string { return `slice-${scope}-${createRuntimeId()}` }
function createChopSessionId(): string { return `chop-session-${createRuntimeId()}` }
function createPatternGroupId(): string { return `pattern-group-${createRuntimeId()}` }
function createPatternClipId(): string { return `pattern-clip-${createRuntimeId()}` }
function createPumpRouteId(): string { return `pump-route-${createRuntimeId()}` }
function createSynthPatchId(): string { return `synth-patch-${createRuntimeId()}` }
function clearPadAssignment(pad: PadState): PadState {
  return clearPadSource(pad)
}

export function App({ audioEngine }: AppProps) {
  const [audioStatus, setAudioStatus] = useState<AudioEngineStatus>(audioEngine.getStatus())
  const [powerVisualPhase, setPowerVisualPhase] = useState<'off' | 'display' | 'on'>(audioEngine.getStatus() === 'ready' ? 'display' : 'off')
  // A powered-on Station should present its playable surface first. CHOP has
  // no useful empty state until a source is loaded, while the pad deck still
  // reads immediately as an instrument.
  const [mainView, setMainView] = useState<MainView>('pad')
  const [selectedPadId, setSelectedPadId] = useState<PadState['id']>('pad-01')
  const [activePadId, setActivePadId] = useState<PadState['id'] | null>(null)
  const [selectedLibrarySample, setSelectedLibrarySample] = useState<LibrarySample | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [bpm, setBpm] = useState(120)
  const [swing, setSwing] = useState(0)
  const [transportSettingsOpen, setTransportSettingsOpen] = useState(false)
  // The display's ownership lives here because the display is in the transport
  // and the contexts that claim it are all over the workspace. setState is
  // stable, so claiming does not rebuild the api on every render.
  const { owner: displayOwner, api: displayApi } = useSystemDisplayHost()
  const [master, setMaster] = useState({ volume: 1, muted: false })
  const [masterEffects, setMasterEffects] = useState<EffectRackState>(() => createDefaultMasterEffectRack())
  const [activeFxContext, setActiveFxContext] = useState<FxContext | null>(null)
  const [mixScope, setMixScope] = useState<MixScope>('group')
  const [mixClaimNonce, setMixClaimNonce] = useState(0)
  const [sampleEditorOpen, setSampleEditorOpen] = useState(false)
  const [patternGroups, setPatternGroups] = useState<PatternGroup[]>(() => createInitialPatternGroups(createPadBank().map((pad) => pad.id)))
  const [selectedPatternGroupId, setSelectedPatternGroupId] = useState('pattern-group-1')
  const [selectedPatternVariant, setSelectedPatternVariant] = useState<PatternVariantName>('A')
  const [playlist, setPlaylist] = useState<PatternClip[]>([])
  const [transportMode, setTransportMode] = useState<TransportMode>('pattern')
  const [loopSong, setLoopSong] = useState(false)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [playingSongSlot, setPlayingSongSlot] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pumpRoutes, setPumpRoutes] = useState<PumpRoute[]>([])
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({})
  const [chopAddingSlice, setChopAddingSlice] = useState(false)
  const [sourcePreviewing, setSourcePreviewing] = useState(false)
  const [cutOnPadTrigger, setCutOnPadTrigger] = useState(true)
  const [loadingChopTestId, setLoadingChopTestId] = useState<string | null>(null)
  const [projectMessage, setProjectMessage] = useState<string>()
  const [transportNotice, setTransportNotice] = useState<string>()
  const [projectBusy, setProjectBusy] = useState(false)
  const [renderProgress, setRenderProgress] = useState<number | null>(null)
  const [hotRender, setHotRender] = useState<{ result: RenderSongResult; filename: string } | null>(null)
  const [projectKey, setProjectKey] = useState<ProjectKey>(defaultProjectKey)
  const [loadingLibrarySampleId, setLoadingLibrarySampleId] = useState<string | null>(null)
  const [previewingLibrarySampleId, setPreviewingLibrarySampleId] = useState<string | null>(null)
  const [waveformPlayback, setWaveformPlayback] = useState<WaveformPlayback | null>(null)
  const [sequencerPlayhead, setSequencerPlayhead] = useState<SequencerPlayhead | null>(null)
  const [visualAudioTime, setVisualAudioTime] = useState(0)
  const sequencerRef = useRef(new StepSequencer(audioEngine))
  const renderAbortRef = useRef<AbortController | null>(null)
  const renderBusy = renderProgress !== null
  /* SOLO is honoured by the render, so a render started with one latched
     silently drops every other channel. The panel says so before it happens. */
  const soloActive = patternGroups.some((group) => group.bus?.solo || group.bank.pads.some((pad) => pad.solo))
  const workspaceRef = useRef<HTMLDivElement>(null)
  const selectedGroup = patternGroups.find((group) => group.id === selectedPatternGroupId)!
  const pads = selectedGroup.bank.pads
  const chopSession = selectedGroup.bank.chopSession
  const selectedPad = pads.find((pad) => pad.id === selectedPadId)!
  const selectedSynthPatch = getSynthPatch(selectedGroup, selectedPad.synthPatchId)
  const selectedSynthUsageCount = selectedSynthPatch ? pads.filter((pad) => pad.synthPatchId === selectedSynthPatch.id).length : 0
  const selectedSynthBaseRange = selectedSynthPatch ? getSharedPatchBaseMidiRange(selectedGroup, selectedSynthPatch.id) : [minimumSynthMidiNote, maximumSynthMidiNote] as const
  const audioReady = audioStatus === 'ready'
  const controlsAwake = audioReady && powerVisualPhase === 'on'
  const selectedPeaks = selectedPad.assetId ? waveforms[selectedPad.assetId] ?? [] : []
  const waveformPlayheadSeconds = waveformPlayback && visualAudioTime >= waveformPlayback.startedAt && visualAudioTime <= waveformPlayback.startedAt + waveformPlayback.endSeconds - waveformPlayback.startSeconds
    ? waveformPlayback.startSeconds + visualAudioTime - waveformPlayback.startedAt
    : null
  const playingStep = sequencerPlayhead && visualAudioTime >= sequencerPlayhead.startsAt && visualAudioTime < sequencerPlayhead.startsAt + sequencerPlayhead.durationSeconds
    ? sequencerPlayhead.stepIndex
    : null

  // Display messages are transient: the transport returns to its tempo
  // readout without requiring a separate corrective action.
  useEffect(() => {
    if (!projectMessage) return
    const timer = window.setTimeout(() => setProjectMessage(undefined), 4000)
    return () => window.clearTimeout(timer)
  }, [projectMessage])

  useEffect(() => {
    if (!errorMessage) return
    const timer = window.setTimeout(() => setErrorMessage(undefined), 2000)
    return () => window.clearTimeout(timer)
  }, [errorMessage])

  useEffect(() => {
    if (!transportNotice) return
    const timer = window.setTimeout(() => setTransportNotice(undefined), 2000)
    return () => window.clearTimeout(timer)
  }, [transportNotice])

  // This is only the console's visual power-up sequence. Web Audio is ready
  // before the phase changes, and neither playback nor scheduling reads it.
  useEffect(() => {
    if (!audioReady) { setPowerVisualPhase('off'); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPowerVisualPhase('on'); return }
    setPowerVisualPhase('display')
  }, [audioReady])

  useEffect(() => {
    if (!chopSession.assetId) return
    const waveform = audioEngine.getWaveformPeaks(chopSession.assetId)
    if (!waveform) return
    setWaveforms((current) => current[chopSession.assetId!] ? current : { ...current, [chopSession.assetId!]: waveform })
  }, [audioEngine, chopSession.assetId])

  useEffect(() => {
    if (!isPlaying && !waveformPlayback) return
    let frameId = 0
    const updateVisualTime = () => {
      const now = audioEngine.getCurrentTime()
      setVisualAudioTime(now)
      if (waveformPlayback && now >= waveformPlayback.startedAt + waveformPlayback.endSeconds - waveformPlayback.startSeconds) setWaveformPlayback(null)
      frameId = window.requestAnimationFrame(updateVisualTime)
    }
    updateVisualTime()
    return () => window.cancelAnimationFrame(frameId)
  }, [audioEngine, isPlaying, waveformPlayback])

  const hasSampleAsset = (assetId: SampleAssetId) => audioEngine.hasSampleAsset(assetId)

  const sequenceConfigRef = useRef<StepSequencerConfig>({ bpm, swing, metronomeEnabled: false, mode: 'pattern', loopSong: false, lastSongSlot: null, getTracksForSlot: () => [] })

  sequenceConfigRef.current = {
    bpm,
    swing,
    metronomeEnabled,
    mode: transportMode,
    loopSong,
    lastSongSlot: getLastOccupiedSlot(playlist),
    getTracksForSlot: (slot) => transportMode === 'song'
      ? getSongTracksForSlot(patternGroups, playlist, slot, hasSampleAsset)
      : getPatternTracks(patternGroups, selectedPatternGroupId, selectedPatternVariant, hasSampleAsset),
    onSongSlotChange: setPlayingSongSlot,
    onSongComplete: () => { setIsPlaying(false); setPlayingSongSlot(null); setSequencerPlayhead(null) },
    onStepScheduled: (stepIndex, scheduledTime, durationSeconds) => setSequencerPlayhead({ stepIndex, startsAt: scheduledTime, durationSeconds }),
  }

  const showWaveformPlayback = (assetId: SampleAssetId, startSeconds: number, endSeconds: number, startedAt = audioEngine.getCurrentTime()) => {
    setWaveformPlayback({ assetId, startedAt, startSeconds, endSeconds })
  }

  useEffect(() => { audioEngine.setPumpRoutes(pumpRoutes.map((route) => ({ id: route.id, sourceChannelId: createChannelId(route.source), targetGroupId: route.targetGroupId, depth: route.depth, lengthSeconds: 60 / bpm * route.lengthBeats, curve: route.curve }))) }, [audioEngine, bpm, pumpRoutes])
  useEffect(() => { audioEngine.setBpm(bpm) }, [audioEngine, bpm])
  useEffect(() => { audioEngine.syncSynthPatches(patternGroups.flatMap((group) => group.synthPatches.map((patch) => ({ groupId: group.id, patch })))) }, [audioEngine, patternGroups])
  useEffect(() => { audioEngine.setMasterEffects(masterEffects) }, [audioEngine, masterEffects])
  useEffect(() => { for (const group of patternGroups) audioEngine.setGroupEffects(group.id, group.effects) }, [audioEngine, patternGroups])
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
    if (!pad || !audioReady) return
    const patch = getSynthPatch(selectedGroup, pad.synthPatchId)
    if (patch) {
      audioEngine.triggerSynthPad(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), patch, resolveSynthPadMidiNotes(patch, pad), 1, synthManualToken(selectedPatternGroupId, padId))
      setActivePadId(padId)
      return
    }
    if (!pad.assetId || !audioEngine.hasSampleAsset(pad.assetId)) return
    if (cutOnPadTrigger) audioEngine.stopManualVoices()
    const startedAt = audioEngine.getCurrentTime()
    audioEngine.triggerSample(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), pad.assetId, { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds, attackMs: pad.attackMs, releaseMs: pad.releaseMs })
    showWaveformPlayback(pad.assetId, pad.region.startSeconds, pad.region.endSeconds, startedAt)
    setActivePadId(padId)
  }

  const releasePad = (padId: PadState['id']) => {
    audioEngine.releaseSynthPad(synthManualToken(selectedPatternGroupId, padId))
    if (pads.find((pad) => pad.id === padId)?.synthPatchId) setActivePadId((current) => current === padId ? null : current)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return
      const padId = padIdByKeyCode.get(event.code)
      if (!padId) return
      event.preventDefault()
      triggerPad(padId)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const padId = padIdByKeyCode.get(event.code)
      if (!padId) return
      releasePad(padId)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [pads, audioReady, cutOnPadTrigger, selectedPatternGroupId, selectedGroup])

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
      masterEffects,
      pumpRoutes,
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
      setErrorMessage(toMessage(error))
    } finally {
      setProjectBusy(false)
    }
  }

  /* Renders the SONG playlist offline and hands the user a WAV. The transport
     mode does not matter: a render is always the song, from slot one to the
     last occupied one, in a single pass. */
  const renderSong = async () => {
    if (renderBusy || projectBusy) return
    if (!audioReady) { setErrorMessage('Start audio before rendering.'); return }
    if (playlist.length === 0) { setTransportNotice(emptySongPlaylistNotice); return }
    if (isPlaying) { setErrorMessage('Stop the sequencer before rendering.'); return }
    const controller = new AbortController()
    renderAbortRef.current = controller
    setHotRender(null)
    setProjectMessage(undefined)
    setRenderProgress(0)
    try {
      const result = await renderSongToBuffer({ state: createCurrentProjectState(), liveEngine: audioEngine, signal: controller.signal, onProgress: setRenderProgress })
      const filename = createRenderFilename(bpm)
      // A render that passed full scale is not downloaded behind the user's
      // back: they choose between the mix as monitored and a trimmed copy.
      if (result.peak > 1) { setHotRender({ result, filename }); return }
      downloadBlob(encodeWav(result.buffer, { startFrame: result.startFrame }), filename)
      setProjectMessage(`Rendered ${formatRenderDuration(renderedSeconds(result))}, peak ${formatDbfs(result.peak)}.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setProjectMessage('Render cancelled.')
      else setErrorMessage(toMessage(error))
    } finally {
      renderAbortRef.current = null
      setRenderProgress(null)
    }
  }

  const downloadRender = (trimmed: boolean) => {
    if (!hotRender) return
    const { result, filename } = hotRender
    const gain = trimmed ? trimGainFor(result.peak) : 1
    downloadBlob(encodeWav(result.buffer, { startFrame: result.startFrame, gain }), filename)
    setHotRender(null)
    setProjectMessage(trimmed ? `Rendered with a ${formatDb(gain)} trim.` : `Rendered 1:1, ${result.clippedSampleCount.toLocaleString()} samples clipped.`)
  }

  const openProject = async () => {
    if (projectBusy) return
    if (!audioReady) { setErrorMessage('Start audio before opening a project.'); return }
    setProjectBusy(true)
    setProjectMessage(undefined)
    stopPlayback()
    audioEngine.stopManualVoices()
    audioEngine.stopPreview()
    setSourcePreviewing(false)
    setPreviewingLibrarySampleId(null)
    setWaveformPlayback(null)
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
      audioEngine.setBpm(state.bpm)
      audioEngine.setMasterEffects(state.masterEffects)
      for (const group of state.patternGroups) audioEngine.setGroupEffects(group.id, group.effects)
      audioEngine.syncSynthPatches(state.patternGroups.flatMap((group) => group.synthPatches.map((patch) => ({ groupId: group.id, patch }))))
      audioEngine.setPumpRoutes(state.pumpRoutes.map((route) => ({ id: route.id, sourceChannelId: createChannelId(route.source), targetGroupId: route.targetGroupId, depth: route.depth, lengthSeconds: 60 / state.bpm * route.lengthBeats, curve: route.curve })))
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
      setMasterEffects(state.masterEffects)
      setPumpRoutes(state.pumpRoutes)
      setProjectKey(state.projectKey)
      setWaveforms(nextWaveforms)
      setChopAddingSlice(false)
      setSelectedPadId('pad-01')
      setActivePadId(null)
      setProjectMessage('Project opened.')
    } catch (error) {
      setErrorMessage(toMessage(error))
    } finally {
      setProjectBusy(false)
    }
  }

  const replaceActiveBank = (bank: PadBankState) => {
    setPatternGroups((groups) => groups.map((group) => group.id === selectedPatternGroupId ? { ...group, bank: clonePadBank(bank) } : group))
  }

  const updateSelectedPad = (changes: Pick<PadState, 'volume' | 'pitchSemitones' | 'attackMs' | 'releaseMs'>) => {
    replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? { ...pad, ...changes } : pad) })
    if (changes.volume !== selectedPad.volume) audioEngine.setChannelVolume(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId: selectedPadId }), changes.volume)
  }
  const createSynthForSelectedPad = () => {
    if (selectedPad.assetId && !window.confirm(`Replace the sample on ${selectedPad.label} with a MONO-3 patch?`)) return
    const patch = createDefaultSynthPatch(createSynthPatchId())
    const bank = { ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? assignSynthSource(pad, patch.id) : pad) }
    const groups = patternGroups.map((group) => group.id === selectedPatternGroupId ? removeUnreferencedSynthPatches({ ...group, bank, synthPatches: [...group.synthPatches, patch] }) : group)
    const previousAssetId = selectedPad.assetId
    setPatternGroups(groups)
    removeAssetIfUnused(previousAssetId, groups)
    setProjectMessage(`MONO-3 created on ${selectedPad.label}.`)
  }
  const updateSelectedSynthPatch = (patch: SynthPatch) => {
    setPatternGroups((groups) => groups.map((group) => group.id === selectedPatternGroupId ? { ...group, synthPatches: group.synthPatches.map((candidate) => candidate.id === patch.id ? patch : candidate) } : group))
  }
  const changeSelectedSynthMode = (mode: SynthVoiceMode) => {
    if (!selectedSynthPatch || selectedSynthPatch.mode === mode) return
    const chordPads = pads.filter((pad) => pad.synthPatchId === selectedSynthPatch.id && pad.chordIntervals.length > 1)
    if (mode === 'mono' && chordPads.length > 0 && !window.confirm(`Switch this shared patch to MONO and reduce chords on ${chordPads.length} pad${chordPads.length === 1 ? '' : 's'} to their base notes?`)) return
    setPatternGroups((groups) => groups.map((group) => {
      if (group.id !== selectedPatternGroupId) return group
      return {
        ...group,
        synthPatches: group.synthPatches.map((patch) => patch.id === selectedSynthPatch.id ? { ...patch, mode } : patch),
        bank: mode === 'mono' ? { ...group.bank, pads: group.bank.pads.map((pad) => pad.synthPatchId === selectedSynthPatch.id ? { ...pad, chordIntervals: [0] } : pad) } : group.bank,
      }
    }))
  }
  const updateSelectedChord = (chordIntervals: number[]) => {
    if (!selectedSynthPatch || selectedSynthPatch.mode !== 'poly5') return
    const next = [...new Set(chordIntervals)]
    if (next.length < 1 || next.length > 5 || !next.includes(0) || next.some((interval) => !Number.isInteger(interval) || interval < -24 || interval > 24)) return
    const notes = next.map((interval) => selectedSynthPatch.baseMidiNote + selectedPad.pitchSemitones + interval)
    if (notes.some((note) => note < minimumSynthMidiNote || note > maximumSynthMidiNote)) { setErrorMessage('Chord notes must stay between C0 and C8.'); return }
    replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? { ...pad, chordIntervals: next } : pad) })
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
  const updateGroupEffects = (groupId: string, effects: EffectRackState) => {
    setPatternGroups((groups) => groups.map((group) => group.id === groupId ? { ...group, effects } : group))
    audioEngine.setGroupEffects(groupId, effects)
  }
  const groupsWithActiveBank = (bank: PadBankState) => patternGroups.map((group) => group.id === selectedPatternGroupId ? { ...group, bank } : group)
  const removeAssetIfUnused = (assetId: SampleAssetId | null, groups: readonly PatternGroup[]) => {
    if (!assetId || assetIsReferencedByGroups(groups, assetId)) return
    audioEngine.removeSampleAsset(assetId)
    setWaveforms((current) => { const { [assetId]: _, ...remaining } = current; return remaining })
  }

  const loadLibrarySample = async (sample: LibrarySample, targetPadId: PadState['id']): Promise<boolean> => {
    if (!audioReady || projectBusy || loadingLibrarySampleId) return false
    const targetPad = pads.find((pad) => pad.id === targetPadId)
    if (!targetPad) return false
    if (targetPad.synthPatchId && !window.confirm(`Replace the MONO-3 source on ${targetPad.label} with ${sample.filename}?`)) return false
    setLoadingLibrarySampleId(sample.id)
    setErrorMessage(undefined)
    try {
      const response = await fetch(sample.url)
      if (!response.ok) throw new Error(`Could not load ${sample.filename} from the built-in library.`)
      const assetId = createAssetId(`library-${sample.id}-${targetPad.id}`)
      const loadedSample = await audioEngine.loadSampleBlob(assetId, await response.blob(), sample.filename)
      const waveform = audioEngine.getWaveformPeaks(assetId) ?? []
      const previousAssetId = targetPad.assetId
      const bank = { ...selectedGroup.bank, pads: pads.map((pad) => pad.id === targetPad.id ? { ...pad, assetId, fileName: loadedSample.filename, durationSeconds: loadedSample.durationSeconds, region: { startSeconds: 0, endSeconds: loadedSample.durationSeconds }, slices: [], chopSessionId: null, synthPatchId: null, chordIntervals: [0] } : pad) }
      const groups = patternGroups.map((group) => group.id === selectedPatternGroupId ? removeUnreferencedSynthPatches({ ...group, bank }) : group)
      setPatternGroups(groups)
      setSelectedPadId(targetPad.id)
      setWaveforms((current) => ({ ...current, [assetId]: waveform }))
      const channelId = createChannelId({ patternGroupId: selectedPatternGroupId, padId: targetPad.id })
      audioEngine.setChannelVolume(selectedPatternGroupId, channelId, targetPad.volume)
      audioEngine.setChannelMuted(selectedPatternGroupId, channelId, targetPad.muted)
      audioEngine.setChannelSolo(selectedPatternGroupId, channelId, targetPad.solo)
      removeAssetIfUnused(previousAssetId, groups)
      setProjectMessage(`${sample.filename} loaded to ${targetPad.label}.`)
      return true
    } catch (error) {
      setErrorMessage(toMessage(error))
      return false
    } finally { setLoadingLibrarySampleId(null) }
  }

  const dropLibrarySampleOnPad = (padId: PadState['id']) => {
    const sample = selectedLibrarySample
    if (!sample) return
    void loadLibrarySample(sample, padId).then((loaded) => {
      if (loaded) setSelectedLibrarySample(null)
    })
  }

  const previewLibrarySample = async (sample: LibrarySample) => {
    if (!audioReady || projectBusy || loadingLibrarySampleId) return
    if (previewingLibrarySampleId === sample.id) {
      audioEngine.stopPreview()
      setPreviewingLibrarySampleId(null)
      return
    }
    audioEngine.stopPreview()
    setSourcePreviewing(false)
    setPreviewingLibrarySampleId(sample.id)
    setErrorMessage(undefined)
    try {
      const previewAssetId = `library-preview-${sample.id}`
      if (!audioEngine.hasSampleAsset(previewAssetId)) {
        const response = await fetch(sample.url)
        if (!response.ok) throw new Error(`Could not preview ${sample.filename} from the built-in library.`)
        await audioEngine.loadSampleBlob(previewAssetId, await response.blob(), sample.filename)
      }
      audioEngine.previewAsset(previewAssetId, {}, () => setPreviewingLibrarySampleId(null))
    } catch (error) {
      setErrorMessage(toMessage(error))
      setPreviewingLibrarySampleId(null)
    }
  }

  const clearSelectedPad = () => {
    const assetId = selectedPad.assetId
    audioEngine.releaseSynthPad(synthManualToken(selectedPatternGroupId, selectedPadId))
    const bank = { ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? clearPadAssignment(pad) : pad) }
    const groups = patternGroups.map((group) => group.id === selectedPatternGroupId ? removeUnreferencedSynthPatches({ ...group, bank }) : group)
    setPatternGroups(groups)
    removeAssetIfUnused(assetId, groups)
    setActivePadId((current) => current === selectedPadId ? null : current)
  }

  const mapSelectedPadToProjectScale = () => {
    if (projectBusy || (!selectedPad.assetId && !selectedPad.synthPatchId)) return
    const conflicts = findProjectScaleMapConflicts(pads, selectedPad.id)
    if (conflicts.length > 0 && !window.confirm(`Replace ${conflicts.length} occupied pad${conflicts.length === 1 ? '' : 's'} with the Project Scale map?`)) return
    const result = mapPadBankToProjectScale(pads, selectedPad.id, projectKey)
    if (selectedSynthPatch && result.pads.some((pad) => pad.synthPatchId === selectedSynthPatch.id && resolveSynthPadMidiNotes(selectedSynthPatch, pad).some((note) => note < minimumSynthMidiNote || note > maximumSynthMidiNote))) {
      setErrorMessage('This Project Scale map would place MONO-3 notes outside C0-C8.')
      return
    }
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
    const conflicts = pads.slice(0, nextSlices.length).filter((pad) => (pad.assetId || pad.synthPatchId) && pad.chopSessionId !== chopSession.id)
    if (conflicts.length > 0 && !window.confirm(`Replace ${conflicts.length} occupied pad${conflicts.length === 1 ? '' : 's'} with live Chop slices?`)) return false
    const bank = { pads: pads.map((pad, index) => {
      const slice = nextSlices[index]
      // A pad already on this session keeps whatever pitch it has - re-slicing
      // must not undo a pad the user has since tuned by hand. A pad newly
      // joining starts from the session's current official pitch instead of 0.
      if (slice) return { ...pad, assetId: chopSession.assetId!, fileName: chopSession.fileName, durationSeconds: chopSession.durationSeconds, region: { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds }, slices: [], chopSessionId: chopSession.id, pitchSemitones: pad.chopSessionId === chopSession.id ? pad.pitchSemitones : chopSession.pitchSemitones, synthPatchId: null, chordIntervals: [0] }
      return pad.chopSessionId === chopSession.id ? clearPadAssignment(pad) : pad
    }), chopSession: nextSession }
    setPatternGroups((groups) => groups.map((group) => group.id === selectedPatternGroupId ? removeUnreferencedSynthPatches({ ...group, bank }) : group))
    return true
  }

  const applyAutoChopRegions = (regions: readonly SliceRegion[]): boolean => {
    const nextSlices: SampleSlice[] = regions.map((region) => ({
      id: createSliceId(chopSession.id),
      sourceAssetId: chopSession.assetId!,
      startSeconds: region.startSeconds,
      endSeconds: region.endSeconds,
    }))
    return applyChopMapping(nextSlices, { ...chopSession, slices: nextSlices, activeSliceId: nextSlices[0]?.id ?? null })
  }

  /* The "official" pitch for this source: setting it here pushes to every pad
     already cut from this session, so a dozen pads do not need retuning by
     hand one at a time. It stays a starting point, not a leash - a pad can
     still be pitched further on its own afterward, and that later, individual
     choice is what applyChopMapping preserves on the next re-slice. */
  const setSourcePitch = (pitchSemitones: number) => {
    // A pad still sitting at the session's old pitch is following along and
    // moves with it. A pad already pulled away to its own value has made a
    // deliberate choice, and nudging the session control again must not
    // quietly overwrite it.
    const previousPitch = chopSession.pitchSemitones
    replaceActiveBank({
      pads: pads.map((pad) => pad.chopSessionId === chopSession.id && pad.pitchSemitones === previousPitch ? { ...pad, pitchSemitones } : pad),
      chopSession: { ...chopSession, pitchSemitones },
    })
  }

  const loadChopSourceBlob = async (blob: Blob, filename: string) => {
    setErrorMessage(undefined)
    audioEngine.stopPreview()
    setSourcePreviewing(false)
    try {
      const assetId = createAssetId('chop')
      const loaded = await audioEngine.loadSampleBlob(assetId, blob, filename)
      const waveform = audioEngine.getWaveformPeaks(assetId) ?? []
      const oldAssetId = chopSession.assetId
      const bank = { pads: pads.map((pad) => pad.chopSessionId === chopSession.id ? { ...pad, chopSessionId: null } : pad), chopSession: { id: createChopSessionId(), assetId, fileName: loaded.filename, durationSeconds: loaded.durationSeconds, slices: [], activeSliceId: null, pitchSemitones: 0 } }
      const groups = groupsWithActiveBank(bank)
      setPatternGroups(groups)
      setWaveforms((current) => ({ ...current, [assetId]: waveform }))
      setChopAddingSlice(false)
      removeAssetIfUnused(oldAssetId, groups)
    } catch (error) { setErrorMessage(toMessage(error)) }
  }

  const loadChopSource = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void loadChopSourceBlob(file, file.name)
  }

  const loadChopTestSample = async (sample: ChopTestSample) => {
    if (!audioReady || loadingChopTestId) return
    setLoadingChopTestId(sample.id)
    try {
      const response = await fetch(sample.url)
      if (!response.ok) throw new Error(`Unable to load ${sample.filename}.`)
      await loadChopSourceBlob(await response.blob(), sample.filename)
    } catch (error) {
      setErrorMessage(toMessage(error))
    } finally {
      setLoadingChopTestId(null)
    }
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
    const startedAt = audioEngine.getCurrentTime()
    audioEngine.previewAsset(chopSession.assetId, {}, () => setSourcePreviewing(false))
    showWaveformPlayback(chopSession.assetId, 0, chopSession.durationSeconds ?? 0, startedAt)
  }
  const stopChopSourcePreview = () => { audioEngine.stopPreview(); setSourcePreviewing(false); setWaveformPlayback(null) }
  const previewChopSlice = (slice: SampleSlice) => {
    if (audioReady) {
      const startedAt = audioEngine.getCurrentTime()
      audioEngine.previewAsset(slice.sourceAssetId, { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds })
      showWaveformPlayback(slice.sourceAssetId, slice.startSeconds, slice.endSeconds, startedAt)
    }
    replaceActiveBank({ ...selectedGroup.bank, chopSession: { ...chopSession, activeSliceId: slice.id } })
  }
  const selectChopSlice = (sliceId: string) => { const index = chopSession.slices.findIndex((slice) => slice.id === sliceId); replaceActiveBank({ ...selectedGroup.bank, chopSession: { ...chopSession, activeSliceId: sliceId } }); if (index >= 0) setSelectedPadId(pads[index].id) }

  const selectedPattern = getVariant(patternGroups, selectedPatternGroupId, selectedPatternVariant)!
  const selectedPatternShifts = getVariantShifts(patternGroups, selectedPatternGroupId, selectedPatternVariant)!
  const toggleStep = (padId: PadState['id'], stepIndex: number) => setPatternGroups((current) => updateVariantStep(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex))
  const setStepVelocity = (padId: PadState['id'], stepIndex: number, velocity: number) => setPatternGroups((current) => setVariantStepVelocity(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex, velocity))
  const setStepShift = (padId: PadState['id'], stepIndex: number, shift: number) => setPatternGroups((current) => setVariantStepShift(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex, shift))
  /* Identity comes from the position in the list, not from the stored `name`.
     A group is called "Pattern 1" in saved projects, which is the word this UI
     now uses for the variants inside it - renaming the stored value would split
     old saves from new ones for a label, so the label is derived instead. */
  const bankNumber = (groupId: string) => patternGroups.findIndex((group) => group.id === groupId) + 1
  const createNewPatternGroup = () => {
    try {
      const next = addPatternGroup(patternGroups, createPatternGroupId(), pads.map((pad) => pad.id))
      setPatternGroups(next)
      setSelectedPatternGroupId(next.at(-1)!.id)
      setSelectedPatternVariant('A')
    } catch (error) { setErrorMessage(toMessage(error)) }
  }
  /* An empty slot in the pattern row is a thing you can make, not a thing that
     is broken. clearVariant already writes an empty pattern and its shifts, so
     creating one and clearing one are the same operation - the difference is
     only whether anything was there, and that decides whether we ask first. */
  const createPatternVariant = (variant: PatternVariantName) => {
    setPatternGroups((current) => clearVariant(current, selectedPatternGroupId, variant, pads.map((pad) => pad.id)))
    setSelectedPatternVariant(variant)
  }
  const duplicateCurrentVariant = (target: PatternVariantName) => {
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const exists = Boolean(group.variants[target])
    if (exists && !window.confirm(`Overwrite BANK ${bankNumber(group.id)} PATTERN ${target} with PATTERN ${selectedPatternVariant}? Its pattern data will be replaced.`)) return
    try { setPatternGroups((current) => duplicateVariant(current, selectedPatternGroupId, selectedPatternVariant, target, exists)); setSelectedPatternVariant(target) } catch (error) { setErrorMessage(toMessage(error)) }
  }
  const clearCurrentVariant = () => {
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const references = playlist.filter((clip) => clip.patternGroupId === group.id && clip.variant === selectedPatternVariant)
    const label = `BANK ${bankNumber(group.id)} PATTERN ${selectedPatternVariant}`
    const warning = references.length > 0 ? `Clear ${label}? This also removes ${references.length} Playlist clip${references.length === 1 ? '' : 's'} that reference it.` : `Clear ${label}?`
    if (!window.confirm(warning)) return
    setPatternGroups((current) => clearVariant(current, selectedPatternGroupId, selectedPatternVariant, pads.map((pad) => pad.id)))
    if (references.length > 0) setPlaylist((current) => removeClipsForVariant(current, group.id, selectedPatternVariant))
  }
  const deleteCurrentPatternGroup = () => {
    if (patternGroups.length <= 1) return
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const references = playlist.filter((clip) => clip.patternGroupId === group.id)
    const warning = references.length > 0 ? `Delete BANK ${bankNumber(group.id)}? This also removes ${references.length} Playlist clip${references.length === 1 ? '' : 's'} that reference it.` : `Delete BANK ${bankNumber(group.id)}?`
    if (!window.confirm(warning)) return
    const next = patternGroups.filter((item) => item.id !== group.id)
    setPatternGroups(next)
    setPlaylist((current) => removeClipsForGroup(current, group.id))
    setPumpRoutes((current) => current.filter((route) => route.source.patternGroupId !== group.id && route.targetGroupId !== group.id))
    for (const assetId of group.bank.pads.map((pad) => pad.assetId).concat(group.bank.chopSession.assetId ?? [])) removeAssetIfUnused(assetId, next)
    setSelectedPatternGroupId(next[0].id)
    setSelectedPatternVariant('A')
  }
  // paintPlaylistSlot with shouldExist:true covers what the old addPlaylistClip
  // did, and dedupes on top, so SONG has one placement path instead of two.
  const paintPlaylistSlot = (groupId: string, variant: PatternVariantName, startSlot: number, shouldExist: boolean) => setPlaylist((current) => {
    const existing = current.find((clip) => clip.patternGroupId === groupId && clip.variant === variant && clip.startSlot === startSlot)
    if (shouldExist) return existing ? current : addPatternClip(current, { id: createPatternClipId(), patternGroupId: groupId, variant, startSlot })
    return existing ? removePatternClip(current, existing.id) : current
  })
  const startPlayback = () => {
    if (isPlaying) return
    if (!audioReady) { setErrorMessage('Start audio before playing the sequencer.'); return }
    if (transportMode === 'song' && playlist.length === 0) { setTransportNotice(emptySongPlaylistNotice); return }
    if (sequenceConfigRef.current.getTracksForSlot(1).length === 0 && !pads.some((pad) => (pad.assetId && audioEngine.hasSampleAsset(pad.assetId)) || pad.synthPatchId) && !metronomeEnabled) { setErrorMessage('Load a sample or create a MONO-3 patch first.'); return }
    sequencerRef.current.start(() => sequenceConfigRef.current)
    setIsPlaying(true)
  }
  const stopPlayback = () => { sequencerRef.current.stop(); audioEngine.stopSequencerVoices(); setIsPlaying(false); setPlayingSongSlot(null); setSequencerPlayhead(null) }
  const selectedPumpSourcePadIds = pumpRoutes.filter((route) => route.source.patternGroupId === selectedPatternGroupId).map((route) => route.source.padId)
  const selectPatternGroup = (groupId: string) => {
    if (groupId === selectedPatternGroupId) return
    audioEngine.stopManualVoices()
    audioEngine.stopPreview()
    setSourcePreviewing(false)
    setChopAddingSlice(false)
    setSelectedPatternGroupId(groupId)
    setSelectedPatternVariant('A')
  }
  const changeMainView = (view: MainView) => {
    workspaceRef.current?.scrollTo({ top: 0 })
    setMainView(view)
    setActiveFxContext(null)
    if (view !== 'pad') setSampleEditorOpen(false)
  }
  const activeFxRack = activeFxContext?.scope === 'group' ? selectedGroup.effects : activeFxContext?.scope === 'master' ? masterEffects : undefined
  const updateActiveFxRack = (effects: EffectRackState) => {
    if (activeFxContext?.scope === 'group') updateGroupEffects(selectedPatternGroupId, effects)
    if (activeFxContext?.scope === 'master') setMasterEffects(effects)
  }
  /* Which bus MIX is looking at. It used to be local state inside the BUS & FX
     disclosure; the display and the FX slots both need it now, so it lives
     here. */
  const mixBus = mixScope === 'master'
    ? { volume: master.volume, muted: master.muted }
    : { volume: selectedGroup.bus!.volume, muted: selectedGroup.bus!.muted, solo: selectedGroup.bus!.solo }
  const mixBusLabel = mixScope === 'master' ? 'MASTER' : `G${patternGroups.findIndex((group) => group.id === selectedPatternGroupId) + 1}`
  return (
    <SystemDisplayProvider api={displayApi}>
    <main
      className="station-shell"
      data-view={mainView}
      data-powered={audioReady ? 'on' : 'off'}
      data-power-phase={powerVisualPhase}
      onAnimationEnd={(event) => {
        if (event.animationName === 'system-display-power-on' && audioReady) setPowerVisualPhase('on')
      }}
    >
      <section className="station-panel" aria-labelledby="station-title">
        <header className="station-header">
          <div className="station-branding">
            <p className="eyebrow">STATION / M4</p>
            <h1 id="station-title">STATION</h1>
          </div>
          <div className="header-transport-slot">
            <div className="header-secondary-row" hidden>
              <button className="header-audio-button" type="button" onClick={() => void startAudio()} disabled={audioStatus === "starting" || projectBusy}>
                <span className={`status-dot status-${audioStatus}`} aria-hidden="true" />
                {audioReady ? "AUDIO ON" : audioStatus === "starting" ? "STARTING…" : "START AUDIO"}
              </button>
            </div>
            <TransportBar
              bpm={bpm}
              swing={swing}
              isPlaying={isPlaying}
              mode={transportMode}
              loopSong={loopSong}
              metronomeEnabled={metronomeEnabled}
              settingsOpen={transportSettingsOpen}
              statusMessage={transportNotice ?? projectMessage}
              errorMessage={errorMessage}
              displayOwner={displayOwner}
              audioStatus={audioStatus}
              audioDisabled={audioStatus === 'starting' || projectBusy}
              controlsAwake={controlsAwake}
              onStartAudio={() => void startAudio()}
              onSettingsOpenChange={setTransportSettingsOpen}
              groups={patternGroups}
              selectedGroupId={selectedPatternGroupId}
              selectedVariant={selectedPatternVariant}
              onBpmChange={setBpm}
              onSwingChange={setSwing}
              onModeChange={setTransportMode}
              onLoopSongChange={setLoopSong}
              onMetronomeEnabledChange={setMetronomeEnabled}
              onGroupChange={selectPatternGroup}
              onVariantChange={setSelectedPatternVariant}
              onGroupCreate={createNewPatternGroup}
              onVariantCreate={createPatternVariant}
              onVariantDuplicate={duplicateCurrentVariant}
              onVariantClear={clearCurrentVariant}
              onGroupDelete={deleteCurrentPatternGroup}
              projectControl={<ProjectDisplayButton
                projectKey={projectKey}
                projectBusy={projectBusy}
                audioReady={audioReady}
                renderProgress={renderProgress}
                soloActive={soloActive}
                hotRender={hotRender?.result ?? null}
                onProjectKeyChange={setProjectKey}
                onSave={() => void saveProject()}
                onOpen={() => void openProject()}
                onRender={() => void renderSong()}
                onCancelRender={() => renderAbortRef.current?.abort()}
                onDownloadTrimmed={() => downloadRender(true)}
                onDownloadOriginal={() => downloadRender(false)}
              />}
              onPlay={startPlayback}
              onStop={stopPlayback}
            />
          </div>
          <MainNavigation view={mainView} onViewChange={changeMainView} />
        </header>
        {/* Messages used to render here, in a bar wedged between the header and
            the workspace, which read as belonging to whichever panel was open.
            They all go to the transport display now - one place, always the
            same place. See TransportBar. */}
        <div ref={workspaceRef} className="station-workspace">
          {mainView === "chop" && (
            <>
              <ChopDisplayLauncher
                hasSource={chopSession.assetId !== null}
                cutOnPadTrigger={cutOnPadTrigger}
                onCutOnPadTriggerChange={setCutOnPadTrigger}
                sourcePitchSemitones={chopSession.pitchSemitones}
                onSourcePitchChange={setSourcePitch}
              />
              <ChopWorkspace
                pads={pads}
                selectedPadId={selectedPadId}
                activePadId={activePadId}
                audioReady={controlsAwake}
                sourceFileName={chopSession.fileName}
                sourceDurationSeconds={chopSession.durationSeconds}
                peaks={
                  chopSession.assetId
                    ? (waveforms[chopSession.assetId] ?? [])
                    : []
                }
                playheadSeconds={
                  waveformPlayback?.assetId === chopSession.assetId
                    ? waveformPlayheadSeconds
                    : null
                }
                slices={chopSession.slices}
                activeSliceId={chopSession.activeSliceId}
                addingSlice={chopAddingSlice}
                onLoadSource={loadChopSource}
                testSamples={chopTestSamples}
                loadingTestId={loadingChopTestId}
                onLoadTestSample={(sample) => void loadChopTestSample(sample)}
                sourcePreviewing={sourcePreviewing}
                onPreviewSource={previewChopSource}
                onStopPreviewSource={stopChopSourcePreview}
                onTriggerPad={triggerPad}
                onReleasePad={releasePad}
                onFeedbackEnd={(padId) =>
                  setActivePadId((current) =>
                    current === padId ? null : current,
                  )
                }
                onAddSlice={addChopSlice}
                onMoveCut={moveChopCut}
                onSelectSlice={selectChopSlice}
                onPreviewSlice={previewChopSlice}
                onToggleAdding={() => setChopAddingSlice((current) => !current)}
                onRemoveActiveCut={removeActiveChopCut}
                onClearSlices={clearChopSlices}
                onApplyAutoChop={applyAutoChopRegions}
              />
            </>
          )}
          {mainView === "pad" && (
            <>
              <PadDisplayLauncher
                pad={selectedPad}
                audioReady={audioReady}
                projectBusy={projectBusy}
                projectKeyLabel={formatProjectKey(projectKey)}
                loadingLibrarySampleId={loadingLibrarySampleId}
                previewingLibrarySampleId={previewingLibrarySampleId}
                selectedLibrarySample={selectedLibrarySample}
                onUpdate={updateSelectedPad}
                onPreviewLibrarySample={previewLibrarySample}
                onSelectedLibrarySampleChange={setSelectedLibrarySample}
                onMapToProjectScale={mapSelectedPadToProjectScale}
                onEditSample={() => setSampleEditorOpen(true)}
                onClear={clearSelectedPad}
              />
              <div className="instrument-layout">
                <div className="pad-workspace">
                  <PadGrid
                    pads={pads}
                    selectedPadId={selectedPadId}
                    activePadId={activePadId}
                    audioReady={audioReady}
                    dropSample={selectedLibrarySample}
                    onTrigger={triggerPad}
                    onRelease={releasePad}
                    onDropSample={dropLibrarySampleOnPad}
                    onFeedbackEnd={(padId) => {
                      if (!pads.find((pad) => pad.id === padId)?.synthPatchId) setActivePadId((current) => current === padId ? null : current)
                    }}
                  />
                </div>
              </div>
              {sampleEditorOpen && (
                <div className="contextual-sample-editor">
                  <SampleEditor
                    pad={selectedPad}
                    peaks={selectedPeaks}
                    playheadSeconds={
                      waveformPlayback?.assetId === selectedPad.assetId
                        ? waveformPlayheadSeconds
                        : null
                    }
                    audioReady={audioReady}
                    onPreview={() => triggerPad(selectedPad.id)}
                    onRegionChange={updateSelectedRegion}
                    onResetRegion={resetSelectedRegion}
                    onClose={() => setSampleEditorOpen(false)}
                  />
                </div>
              )}
            </>
          )}
          {mainView === "synth" && (
            <SynthWorkspace
              pad={selectedPad}
              patch={selectedSynthPatch}
              usageCount={selectedSynthUsageCount}
              baseMidiRange={selectedSynthBaseRange}
              audioReady={audioReady}
              projectBusy={projectBusy}
              projectKeyLabel={formatProjectKey(projectKey)}
              onCreate={createSynthForSelectedPad}
              onPatchChange={updateSelectedSynthPatch}
              onModeChange={changeSelectedSynthMode}
              onChordChange={updateSelectedChord}
              onPadPitchChange={(pitchSemitones) => updateSelectedPad({ volume: selectedPad.volume, pitchSemitones, attackMs: selectedPad.attackMs, releaseMs: selectedPad.releaseMs })}
              onTrigger={() => triggerPad(selectedPad.id)}
              onRelease={() => releasePad(selectedPad.id)}
              onMapToProjectScale={mapSelectedPadToProjectScale}
              onClear={clearSelectedPad}
            />
          )}
          {mainView === "seq" && (
            <SequencerControls
              pattern={selectedPattern}
              shifts={selectedPatternShifts}
              pads={pads.filter(
                (pad) => pad.fileName || pad.synthPatchId || pad.id === selectedPad.id,
              )}
              selectedPadId={selectedPad.id}
              group={selectedGroup}
              selectedVariant={selectedPatternVariant}
              playingStep={playingStep}
              onSelectPad={triggerPad}
              onToggleStep={toggleStep}
              onVelocityChange={setStepVelocity}
              onShiftChange={setStepShift}
            />
          )}
          {mainView === "song" && (
            <SongWorkspace
              groups={patternGroups}
              clips={playlist}
              selectedGroupId={selectedPatternGroupId}
              selectedVariant={selectedPatternVariant}
              activeSlot={
                isPlaying && transportMode === "song" ? playingSongSlot : null
              }
              onPaintSlot={paintPlaylistSlot}
            />
          )}
          {mainView === "mix" && (
            <>
              {/* First thing in MIX, ahead of the channel rails, so the entry
                  point into Pump's routes is never something you have to
                  scroll to find. */}
              <PumpDisplayLauncher
                patternGroups={patternGroups}
                routes={pumpRoutes}
                onAddRoute={(source, targetGroupId) => {
                  const id = createPumpRouteId()
                  setPumpRoutes((current) => [...current, { id, source, targetGroupId, depth: 0.9, lengthBeats: 0.5, curve: 'smooth' }])
                  return id
                }}
                onRemoveRoute={(routeId) => setPumpRoutes((current) => current.filter((route) => route.id !== routeId))}
                onUpdateRoute={(routeId, changes) => setPumpRoutes((current) => current.map((route) => route.id === routeId ? { ...route, ...changes } : route))}
              />
              <Mixer
                audioEngine={audioEngine}
                patternGroupId={selectedPatternGroupId}
                pads={pads}
                pumpSourcePadIds={selectedPumpSourcePadIds}
                onVolumeChange={updateChannelVolume}
                onMutedChange={updateChannelMuted}
                onSoloChange={updateChannelSolo}
              />
              <MixTargetSelector
                groups={patternGroups}
                selectedGroup={selectedGroup}
                scope={mixScope}
                onSelectGroup={selectPatternGroup}
                onScopeChange={(scope) => {
                  setMixScope(scope)
                  setActiveFxContext(null)
                  setMixClaimNonce((nonce) => nonce + 1)
                }}
              />
              {/* Replaces the MIX readout that only ever held the line. The bus
                  stands down while an FX slot is open, so opening a slot from
                  here is not immediately undone by its own parent. */}
              <BusDisplayLauncher
                scopeLabel={mixBusLabel}
                bus={mixBus}
                rack={mixScope === "master" ? masterEffects : selectedGroup.effects}
                suspended={activeFxContext !== null}
                claimNonce={mixClaimNonce}
                onVolumeChange={(volume) =>
                  mixScope === "master"
                    ? updateMaster({ volume })
                    : updateGroupBus(selectedPatternGroupId, { volume })
                }
                onMutedChange={(muted) =>
                  mixScope === "master"
                    ? updateMaster({ muted })
                    : updateGroupBus(selectedPatternGroupId, { muted })
                }
                onSoloChange={
                  mixScope === "master"
                    ? undefined
                    : (solo) => updateGroupBus(selectedPatternGroupId, { solo })
                }
                onOpenSlot={(slotIndex) =>
                  setActiveFxContext({ scope: mixScope, slotIndex })
                }
              />
              <EffectDisplayLauncher
                context={activeFxContext}
                scopeLabel={activeFxContext ? mixBusLabel : undefined}
                rack={activeFxRack}
                bpm={bpm}
                onChange={updateActiveFxRack}
                onClose={() => setActiveFxContext(null)}
              />
            </>
          )}
        </div>
      </section>
    </main>
    </SystemDisplayProvider>
  );
}

function isTypingTarget(target: EventTarget | null): boolean { return target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) }
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Chrome on Android needs the URL to outlive the click, so it is released on
  // the next task rather than immediately.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
function createRenderFilename(bpm: number): string {
  const now = new Date()
  const stamp = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('')
  const time = [now.getHours(), now.getMinutes()].map((part) => String(part).padStart(2, '0')).join('')
  return `station-${stamp}-${time}-${Math.round(bpm)}bpm.wav`
}
function formatRenderDuration(seconds: number): string {
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
function renderedSeconds(result: RenderSongResult): number {
  return (result.buffer.length - result.startFrame) / result.buffer.sampleRate
}
function formatDbfs(peak: number): string {
  if (peak <= 0) return '-∞ dBFS'
  const db = 20 * Math.log10(peak)
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dBFS`
}
function formatDb(gain: number): string {
  return `${(20 * Math.log10(gain)).toFixed(1)} dB`
}
/* Brings an over-hot render to -0.3 dBFS with one multiplication. It is a level
   change and nothing else - no dynamics, so nothing about the mix moves
   relative to itself. */
function trimGainFor(peak: number): number {
  return 10 ** (-0.3 / 20) / peak
}
function toMessage(error: unknown): string { return error instanceof Error ? error.message : 'An unexpected audio error occurred.' }
function assetIsReferencedByGroups(groups: readonly PatternGroup[], assetId: SampleAssetId): boolean {
  return groups.some((group) => group.bank.pads.some((pad) => pad.assetId === assetId) || group.bank.chopSession.assetId === assetId)
}
function synthManualToken(groupId: string, padId: PadState['id']): string {
  return `manual:${groupId}:${padId}`
}
function getSharedPatchBaseMidiRange(group: PatternGroup, patchId: string): readonly [number, number] {
  let minimum = minimumSynthMidiNote
  let maximum = maximumSynthMidiNote
  for (const pad of group.bank.pads) {
    if (pad.synthPatchId !== patchId) continue
    minimum = Math.max(minimum, minimumSynthMidiNote - pad.pitchSemitones - Math.min(...pad.chordIntervals))
    maximum = Math.min(maximum, maximumSynthMidiNote - pad.pitchSemitones - Math.max(...pad.chordIntervals))
  }
  return [minimum, maximum]
}
