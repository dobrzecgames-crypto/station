import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioEngine, AudioEngineStatus, SampleAssetId } from './audio/AudioEngine'
import { createDefaultMasterEffectRack } from './audio/effects'
import type { EffectRackState } from './audio/effects'
import { createChannelId } from './audio/channelIdentity'
import { StepSequencer } from './audio/StepSequencer'
import type { StepSequencerConfig } from './audio/StepSequencer'
import { TimelineScheduler } from './audio/TimelineScheduler'
import type { TimelineSchedulerConfig } from './audio/TimelineScheduler'
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
import { ChordDisplayLauncher } from './pads/ChordDisplay'
import { ChordModeToggle } from './pads/ChordModeToggle'
import { PadGrid } from './pads/PadGrid'
import type { ChopSessionState, PadState, SamplePlaybackRegion, SampleSlice } from './pads/types'
import { SampleEditor } from './sample-editor/SampleEditor'
import { SequencerControls } from './sequencer/SequencerControls'
import { MainNavigation } from './shell/MainNavigation'
import type { MainView } from './shell/MainNavigation'
import { StationConfirm } from './shell/StationConfirm'
import { TransportBar } from './shell/TransportBar'
import { SystemDisplayProvider, useSystemDisplayHost } from './shell/systemDisplayContext'
import { applyKickPreset, applySnarePreset, createDefaultDrumSynthState } from './drumsynth/drumSynthOperations'
import type { KickPresetName, SnarePresetName } from './drumsynth/drumSynthOperations'
import type { DrumInstrumentType, DrumKickPatch, DrumSnarePatch, DrumSynthState } from './drumsynth/drumSynthTypes'
import { DrumSynthWorkspace } from './drumsynth/DrumSynthWorkspace'
import { renderKickToBuffer } from './drumsynth/renderKick'
import { renderSnareToBuffer } from './drumsynth/renderSnare'
import { collectReferencedAssetIds, createProjectState, projectSchemaVersion, validateProjectState } from './project/ProjectState'
import type { PumpRoute } from './project/ProjectState'
import { ProjectDisplayButton } from './project/ProjectDisplay'
import { renderSongToBuffer } from './project/renderSong'
import type { RenderSongResult } from './project/renderSong'
import { defaultProjectKey, formatProjectKey } from './music/scales'
import type { ProjectKey } from './music/scales'
import { chordRootMidiNote, formatChordAssignment, formatMidiNoteName, resolveChordMidiNotes } from './music/chords'
import { ChordPriority } from './music/chordPriority'
import { findProjectScaleMapConflicts, mapPadBankToProjectScale } from './music/scaleMapping'
import { projectRepository } from './storage/ProjectRepository'
import { defaultProjectId } from './storage/storageTypes'
import { addPatternGroup, clearVariant, createInitialPatternGroups, duplicateVariant, getVariant, getVariantLengths, getVariantShifts, patternStepCount, recordVariantStep, repairPatternGroupChords, setPatternGroupChordAssignment, setPatternGroupPadMode, setVariantStepLength, setVariantStepShift, setVariantStepVelocity, updateVariantStep } from './patterns/patternOperations'
import type { PadMode, PatternGroup, PatternVariantName } from './patterns/patternTypes'
import { addPatternClip, getLastOccupiedSlot, removeClipsForGroup, removeClipsForVariant, removePatternClip } from './song/songOperations'
import type { PatternClip, TransportMode } from './song/songTypes'
import { getPatternTracks, getSongTracksForSlot } from './song/songTracks'
import { SongWorkspace } from './song/SongWorkspace'
import { detectTransientCandidates, maxChopSliceCount } from './chop/autoChopOperations'
import type { SliceRegion, TransientCandidate } from './chop/autoChopOperations'
import { chopTestSamples } from './chop/chopTestSamples'
import type { ChopTestSample } from './chop/chopTestSamples'
import { detectTempo } from './chop/tempoDetection'
import type { TempoDetectionResult } from './chop/tempoDetection'
import { assignSynthSource, clearPadSource, createDefaultSynthPatch, getSynthPatch, maximumSynthMidiNote, minimumSynthMidiNote, removeUnreferencedSynthPatches, resolveSynthPadMidiNotes } from './synth/synthOperations'
import type { SynthPatch, SynthVoiceMode } from './synth/synthTypes'
import { SynthWorkspace } from './synth/SynthWorkspace'
import { SynthPicker } from './synth/SynthPicker'
import type { SynthPickerInstrument } from './synth/SynthPicker'
import { assignStringsSource, createDefaultStringsPatch, getStringsPatch, maximumStringsVoices, removeUnreferencedStringsPatches, resolveStringsPadMidiNotes } from './strings/stringsOperations'
import type { StringsPatch } from './strings/stringsTypes'
import { StringsWorkspace } from './strings/StringsWorkspace'
import {
  addAudioClip, addAudioTrack, collectAudioTrackAssetIds, createAudioClipFromImport, createAudioTrack,
  duplicateAudioClip, maximumClipFadeSeconds, moveAudioClip, moveAudioTrack, removeAudioClip, removeAudioTrack,
  setAudioTrackEffects, setAudioTrackGain, setAudioTrackMuted, setAudioTrackSolo, splitAudioClipAt,
  trimAudioClipEnd, trimAudioClipStart, updateAudioClip,
} from './tracks/tracksOperations'
import { toTimelineSchedulerClips } from './tracks/tracksScheduling'
import { snapBeatToGrid, secondsToBeats } from './tracks/timelineGrid'
import { maximumAudioTracks } from './tracks/tracksTypes'
import type { AudioTrack, TimelineGridDivision } from './tracks/tracksTypes'
import { TracksWorkspace } from './tracks/TracksWorkspace'
import { TracksArranger } from './tracks/TracksArranger'
import { TrackEditor } from './tracks/TrackEditor'
import type { TrackMonitorMode } from './tracks/TrackEditor'
import { useTracksViewState } from './tracks/useTracksViewState'
import { useTracksLayoutMode } from './tracks/useTracksLayoutMode'
import { useTracksHistory } from './tracks/useTracksHistory'
import './App.css'
// Loaded after App.css on purpose - the Lab Interface layer overrides the older
// visual passes wholesale. See docs/DESIGN_SYSTEM.md.
import './lab-interface.css'

interface AppProps { audioEngine: AudioEngine }
interface FxContext { scope: 'group' | 'track' | 'master'; slotIndex: 0 | 1 }
interface PendingConfirmation { message: string; confirmLabel: string; onConfirm: () => void }
interface WaveformPlayback { assetId: SampleAssetId; startedAt: number; startSeconds: number; endSeconds: number }
interface SequencerPlayhead { stepIndex: number; startsAt: number; durationSeconds: number }
/** Anchor for quantizing a live pad hit to the nearest step - refreshed every time step 0 of a loop is scheduled. */
interface RecordingGrid { startsAt: number; stepDurationSeconds: number }

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
function createStringsPatchId(): string { return `strings-patch-${createRuntimeId()}` }
function createAudioTrackId(): string { return `audio-track-${createRuntimeId()}` }
function createAudioClipId(): string { return `audio-clip-${createRuntimeId()}` }
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
  /** Which tab was active before TRACKS, so the wide arranger's manual exit
      button (a locked-orientation phone, a tablet, or a desktop has no
      "rotate back" to rely on) returns to it instead of a fixed default. */
  const previousMainViewRef = useRef<MainView>('pad')
  useEffect(() => {
    if (mainView !== 'tracks') previousMainViewRef.current = mainView
  }, [mainView])
  const [selectedPadId, setSelectedPadId] = useState<PadState['id']>('pad-01')
  const [activePadId, setActivePadId] = useState<PadState['id'] | null>(null)
  const [selectedLibrarySample, setSelectedLibrarySample] = useState<LibrarySample | null>(null)
  const [pendingDrumSound, setPendingDrumSound] = useState<{ blob: Blob; filename: string; durationSeconds: number; instrument: DrumInstrumentType } | null>(null)
  const [drumSoundRenderBusy, setDrumSoundRenderBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>()
  const [bpm, setBpm] = useState(120)
  const [swing, setSwing] = useState(0)
  const [transportSettingsOpen, setTransportSettingsOpen] = useState(false)
  // The display's ownership lives here because the display is in the transport
  // and the contexts that claim it are all over the workspace. setState is
  // stable, so claiming does not rebuild the api on every render.
  const { owner: displayOwner, focusReadout: displayFocusReadout, api: displayApi } = useSystemDisplayHost()
  const [master, setMaster] = useState({ volume: 1, muted: false })
  const [masterEffects, setMasterEffects] = useState<EffectRackState>(() => createDefaultMasterEffectRack())
  const [activeFxContext, setActiveFxContext] = useState<FxContext | null>(null)
  const [mixScope, setMixScope] = useState<MixScope>('group')
  const [mixTrackId, setMixTrackId] = useState<string | null>(null)
  const [mixClaimNonce, setMixClaimNonce] = useState(0)
  const [sampleEditorOpen, setSampleEditorOpen] = useState(false)
  /* Forces the SYNTH tab back to the instrument picker even though the selected pad
     already has a patch - set by "BACK TO SYNTHS", cleared whenever the tab is
     entered fresh from elsewhere so the entry rule (patch present -> its editor)
     can re-decide. */
  const [synthPickerForced, setSynthPickerForced] = useState(false)
  /* DRUM SYNTH's panel is pad-independent, unlike MONOPOLY/STRINGS - it is
     never derived from the selected pad, only from this flag. See
     synthShowsPicker and docs/DECISIONS.md DEC-024. */
  const [drumSynthPanelOpen, setDrumSynthPanelOpen] = useState(false)
  const [drumSynth, setDrumSynth] = useState<DrumSynthState>(() => createDefaultDrumSynthState())
  const [patternGroups, setPatternGroups] = useState<PatternGroup[]>(() => createInitialPatternGroups(createPadBank().map((pad) => pad.id)))
  const [selectedPatternGroupId, setSelectedPatternGroupId] = useState('pattern-group-1')
  const [selectedPatternVariant, setSelectedPatternVariant] = useState<PatternVariantName>('A')
  const [playlist, setPlaylist] = useState<PatternClip[]>([])
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  /** Paused/scrub position in beats - the live position while playing is
      derived from tracksPlaybackAnchorRef + visualAudioTime instead (see
      tracksLivePlayheadBeat below), and this is what stopPlayback freezes it
      into so PLAY resumes from where it left off. */
  const [tracksPlayheadBeat, setTracksPlayheadBeat] = useState(0)
  const [tracksSnapDivision, setTracksSnapDivision] = useState<TimelineGridDivision>('1/4')
  const [openTrackEditorId, setOpenTrackEditorId] = useState<string | null>(null)
  const [trackMonitorMode, setTrackMonitorMode] = useState<TrackMonitorMode>('all')
  /** Selection/zoom/scroll shared by TracksWorkspace (compact) and
      TracksArranger (wide) - lifted here so a device rotation swapping
      which one is mounted does not lose it. See docs/DECISIONS.md DEC-027. */
  const tracksViewState = useTracksViewState()
  /** 'compact' only for a phone-class viewport in portrait; every other
      case (phone landscape, tablet, desktop) is 'wide'. Only acted on below
      while mainView === 'tracks' - this hook itself never changes tabs. */
  const tracksLayoutMode = useTracksLayoutMode()
  const tracksHistory = useTracksHistory()
  /** Always-current mirror of audioTracks, assigned fresh every render (same
      shape as sequenceConfigRef/tracksSchedulerConfigRef below) - lets
      updateAudioTracks read the latest value imperatively without a nested
      setState-inside-setState (calling tracksHistory's setters from inside
      a setAudioTracks updater callback would run them during React's render
      phase instead of a plain event-handler call). */
  const audioTracksRef = useRef(audioTracks)
  audioTracksRef.current = audioTracks
  const [transportMode, setTransportMode] = useState<TransportMode>('pattern')
  const [loopSong, setLoopSong] = useState(false)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [playingSongSlot, setPlayingSongSlot] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const [countingIn, setCountingIn] = useState(false)
  const [pumpRoutes, setPumpRoutes] = useState<PumpRoute[]>([])
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({})
  const [chopAddingSlice, setChopAddingSlice] = useState(false)
  const [sourcePreviewing, setSourcePreviewing] = useState(false)
  const [cutOnPadTrigger, setCutOnPadTrigger] = useState(true)
  const [loadingChopTestId, setLoadingChopTestId] = useState<string | null>(null)
  /** The real-buffer transient/tempo scan for the currently loaded CHOP
      source (see the analysis effect below) - null until it finishes, and
      keyed by assetId so a stale result from a source the user has since
      replaced is never mistaken for the current one. */
  const [chopAnalysis, setChopAnalysis] = useState<{ assetId: SampleAssetId; candidates: TransientCandidate[]; tempo: TempoDetectionResult } | null>(null)
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
  const chordPriorityRef = useRef(new ChordPriority())
  const timelineSchedulerRef = useRef(new TimelineScheduler(audioEngine))
  /** Where TRACKS playback last began, in (timeline beat, AudioContext time)
      terms - lets the live playhead be derived each render (visualAudioTime
      already re-renders during playback, see DEC-004) instead of a second
      rAF loop, and lets stopPlayback freeze tracksPlayheadBeat at the right
      spot instead of resetting it. */
  const tracksPlaybackAnchorRef = useRef<{ startBeat: number; startedAt: number } | null>(null)
  const recordingGridRef = useRef<RecordingGrid | null>(null)
  /** Set right before a count-in's `start()` call, consumed by the first `onStepScheduled(0, ...)` that follows - the signal that recording should actually arm now that step 0 is truly about to sound. While it is set, the count-in is still running. */
  const pendingRecordingStartRef = useRef(false)
  /* Whether a hit should be captured, held in a ref rather than read off `recording`.
     Arming is decided inside the audio scheduler callback, so a state read would lag
     it by a render - long enough to silently drop the very first hit of a take. */
  const recordingArmedRef = useRef(false)
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
  const selectedStringsPatch = getStringsPatch(selectedGroup, selectedPad.stringsPatchId)
  const selectedStringsUsageCount = selectedStringsPatch ? pads.filter((pad) => pad.stringsPatchId === selectedStringsPatch.id).length : 0
  const selectedStringsBaseRange = selectedStringsPatch ? getSharedStringsPatchBaseMidiRange(selectedGroup, selectedStringsPatch.id) : [minimumSynthMidiNote, maximumSynthMidiNote] as const
  const chordModeAvailable = pads.every((pad) => pad.synthPatchId !== null && pad.synthPatchId === pads[0].synthPatchId)
    || pads.every((pad) => pad.stringsPatchId !== null && pad.stringsPatchId === pads[0].stringsPatchId)
  const audioReady = audioStatus === 'ready'
  const audioRecovering = audioStatus === 'suspended' || audioStatus === 'interrupted'
  const controlsAwake = audioReady && powerVisualPhase === 'on'
  const selectedPeaks = selectedPad.assetId ? waveforms[selectedPad.assetId] ?? [] : []
  const waveformPlayheadSeconds = waveformPlayback && visualAudioTime >= waveformPlayback.startedAt && visualAudioTime <= waveformPlayback.startedAt + waveformPlayback.endSeconds - waveformPlayback.startSeconds
    ? waveformPlayback.startSeconds + visualAudioTime - waveformPlayback.startedAt
    : null
  const playingStep = sequencerPlayhead && visualAudioTime >= sequencerPlayhead.startsAt && visualAudioTime < sequencerPlayhead.startsAt + sequencerPlayhead.durationSeconds
    ? sequencerPlayhead.stepIndex
    : null
  const selectedChordAssignment = selectedGroup.padMode === 'chords' ? selectedGroup.chordAssignments[pads.indexOf(selectedPad)] : null
  const chordLabels = selectedGroup.padMode === 'chords'
    ? Object.fromEntries(pads.map((pad, index) => {
        const assignment = selectedGroup.chordAssignments[index]
        return [pad.id, assignment ? { name: formatChordAssignment(selectedGroup, pad, assignment, projectKey), root: formatMidiNoteName(chordRootMidiNote(selectedGroup, pad, projectKey)) } : { name: '—', root: '' }]
      }))
    : undefined

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

  // This is only the console's visual power-up sequence. Once the machine has
  // completed it, a transient browser interruption keeps the panel lit while
  // audio controls wait for the real context to return to `running`.
  useEffect(() => {
    if (!audioReady) {
      if (powerVisualPhase === 'on' && (audioRecovering || audioStatus === 'starting')) return
      setPowerVisualPhase('off')
      return
    }
    if (powerVisualPhase === 'on') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPowerVisualPhase('on'); return }
    setPowerVisualPhase('display')
  }, [audioReady, audioRecovering, audioStatus, powerVisualPhase])

  useEffect(() => {
    if (!chopSession.assetId) return
    const waveform = audioEngine.getWaveformPeaks(chopSession.assetId)
    if (!waveform) return
    setWaveforms((current) => current[chopSession.assetId!] ? current : { ...current, [chopSession.assetId!]: waveform })
  }, [audioEngine, chopSession.assetId])

  /**
   * The real-buffer transient scan (and the tempo reading built from its
   * onsets) is real work - a linear pass over the decoded source plus an
   * O(onsetCount^2) interval histogram - so it runs here, off the render path,
   * instead of in a useMemo during ChopWorkspace's render. requestIdleCallback
   * (falling back to setTimeout for Safari, which lacks it) keeps it from
   * competing with anything time-critical; `cancelled` stops a slow run for a
   * source the user has since replaced from clobbering the new one's result.
   */
  useEffect(() => {
    const assetId = chopSession.assetId
    const durationSeconds = chopSession.durationSeconds
    if (!assetId || !durationSeconds) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      const buffer = audioEngine.getDecodedSampleAsset(assetId)
      const envelope = audioEngine.getAnalysisEnvelope(assetId)
      if (cancelled || !buffer || !envelope) return
      const candidates = detectTransientCandidates(envelope, buffer.duration, buffer.getChannelData(0), buffer.sampleRate)
      const tempo = detectTempo(candidates, buffer.duration)
      setChopAnalysis({ assetId, candidates, tempo })
    }
    const hasIdleCallback = 'requestIdleCallback' in window
    const idleHandle = hasIdleCallback ? window.requestIdleCallback(run) : window.setTimeout(run, 0)
    return () => {
      cancelled = true
      if (hasIdleCallback) window.cancelIdleCallback(idleHandle as number)
      else window.clearTimeout(idleHandle as number)
    }
  }, [audioEngine, chopSession.assetId, chopSession.durationSeconds])

  const chopAnalysisReady = chopAnalysis?.assetId === chopSession.assetId
  const chopCandidates = chopAnalysisReady ? chopAnalysis!.candidates : []
  const chopTempo = chopAnalysisReady ? chopAnalysis!.tempo : null
  // The one and only thing that ever changes the project's own tempo from a
  // detected reading - detectTempo itself never calls setBpm, only this does,
  // and only on an explicit APPLY click (see ChopDisplay.tsx).
  const applyDetectedTempo = () => { if (chopTempo?.bpm) setBpm(chopTempo.bpm) }

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
    /* A take is played against the click, so recording forces the metronome on for as
       long as it lasts and hands the setting back on punch-out. Without this the four
       count-in clicks stopped dead on the downbeat, exactly where the beat is needed.
       `countingIn` is part of it because `schedule` reads this config once per pass and
       only flips to `recording` partway through the very pass that places step 0 - drop
       it and the downbeat is the one click that goes missing. */
    metronomeEnabled: metronomeEnabled || recording || countingIn,
    mode: transportMode,
    loopSong,
    lastSongSlot: getLastOccupiedSlot(playlist),
    getTracksForSlot: (slot) => transportMode === 'song'
      ? getSongTracksForSlot(patternGroups, playlist, slot, hasSampleAsset, projectKey)
      : getPatternTracks(patternGroups, selectedPatternGroupId, selectedPatternVariant, hasSampleAsset, projectKey),
    onSongSlotChange: setPlayingSongSlot,
    onSongComplete: () => { setIsPlaying(false); setPlayingSongSlot(null); setSequencerPlayhead(null) },
    onStepScheduled: (stepIndex, scheduledTime, durationSeconds) => {
      if (stepIndex === 0) {
        recordingGridRef.current = { startsAt: scheduledTime, stepDurationSeconds: durationSeconds }
        if (pendingRecordingStartRef.current) {
          pendingRecordingStartRef.current = false
          setIsPlaying(true)
          setCountingIn(false)
          setRecording(true)
        }
      }
      setSequencerPlayhead({ stepIndex, startsAt: scheduledTime, durationSeconds })
    },
  }

  /** Same "assign a fresh object into a ref during render" shape as
      sequenceConfigRef just above - TimelineScheduler reads this through a
      stable closure, so it always sees the current audioTracks/bpm even
      though start() was called once, long before the latest edit. */
  const tracksSchedulerConfigRef = useRef<TimelineSchedulerConfig>({ bpm, getClips: () => [] })
  tracksSchedulerConfigRef.current = { bpm, getClips: () => toTimelineSchedulerClips(audioTracks, {}, bpm) }
  const tracksLivePlayheadBeat = isPlaying && tracksPlaybackAnchorRef.current
    ? Math.max(0, tracksPlaybackAnchorRef.current.startBeat + secondsToBeats(visualAudioTime - tracksPlaybackAnchorRef.current.startedAt, bpm))
    : tracksPlayheadBeat

  const showWaveformPlayback = (assetId: SampleAssetId, startSeconds: number, endSeconds: number, startedAt = audioEngine.getCurrentTime()) => {
    setWaveformPlayback({ assetId, startedAt, startSeconds, endSeconds })
  }

  useEffect(() => { audioEngine.setPumpRoutes(pumpRoutes.map((route) => ({ id: route.id, sourceChannelId: createChannelId(route.source), targetGroupId: route.targetGroupId, depth: route.depth, lengthSeconds: 60 / bpm * route.lengthBeats, curve: route.curve }))) }, [audioEngine, bpm, pumpRoutes])
  useEffect(() => { audioEngine.setBpm(bpm) }, [audioEngine, bpm])
  useEffect(() => { audioEngine.syncSynthPatches(patternGroups.flatMap((group) => group.synthPatches.map((patch) => ({ groupId: group.id, patch })))) }, [audioEngine, patternGroups])
  useEffect(() => { audioEngine.syncStringsPatches(patternGroups.flatMap((group) => group.stringsPatches.map((patch) => ({ groupId: group.id, patch })))) }, [audioEngine, patternGroups])
  useEffect(() => { audioEngine.setMasterEffects(masterEffects) }, [audioEngine, masterEffects])
  useEffect(() => { for (const group of patternGroups) audioEngine.setGroupEffects(group.id, group.effects) }, [audioEngine, patternGroups])
  useEffect(() => audioEngine.subscribeToStatus((status) => {
    setAudioStatus(status)
    if ((status === 'suspended' || status === 'interrupted') && sequencerRef.current.isRunning()) {
      sequencerRef.current.stop()
      audioEngine.stopSequencerVoices()
      recordingArmedRef.current = false
      pendingRecordingStartRef.current = false
      recordingGridRef.current = null
      setIsPlaying(false)
      setCountingIn(false)
      setRecording(false)
    }
  }), [audioEngine])
  useEffect(() => () => { sequencerRef.current.stop(); audioEngine.stopSequencerVoices() }, [audioEngine])

  const triggerPad = (padId: PadState['id']) => {
    const pad = pads.find((candidate) => candidate.id === padId)
    setSelectedPadId(padId)
    if (!pad || !audioReady) return
    const patch = getSynthPatch(selectedGroup, pad.synthPatchId)
    const padIndex = pads.indexOf(pad)
    const chordAssignment = selectedGroup.padMode === 'chords' ? selectedGroup.chordAssignments[padIndex] : null
    if (chordAssignment && (patch || pad.stringsPatchId)) {
      const { token, previousToken } = chordPriorityRef.current.press(selectedPatternGroupId, padId)
      if (previousToken) {
        audioEngine.releaseSynthPad(previousToken)
        audioEngine.releaseStringsPad(previousToken)
      }
      const notes = resolveChordMidiNotes(selectedGroup, pad, chordAssignment, projectKey)
      if (patch) audioEngine.triggerSynthChord(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), patch, notes, 1, token)
      else {
        const stringsPatch = getStringsPatch(selectedGroup, pad.stringsPatchId)
        if (stringsPatch) audioEngine.triggerStringsPad(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), stringsPatch, notes, 1, token)
      }
      setActivePadId(padId)
      recordPadHit(padId, audioEngine.getCurrentTime())
      return
    }
    if (patch) {
      audioEngine.triggerSynthPad(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), patch, resolveSynthPadMidiNotes(patch, pad), 1, manualPadToken(selectedPatternGroupId, padId))
      setActivePadId(padId)
      recordPadHit(padId, audioEngine.getCurrentTime())
      return
    }
    const stringsPatch = getStringsPatch(selectedGroup, pad.stringsPatchId)
    if (stringsPatch) {
      audioEngine.triggerStringsPad(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), stringsPatch, resolveStringsPadMidiNotes(stringsPatch, pad), 1, manualPadToken(selectedPatternGroupId, padId))
      setActivePadId(padId)
      recordPadHit(padId, audioEngine.getCurrentTime())
      return
    }
    if (!pad.assetId || !audioEngine.hasSampleAsset(pad.assetId)) return
    if (cutOnPadTrigger) audioEngine.stopManualVoices()
    const startedAt = audioEngine.getCurrentTime()
    audioEngine.triggerSample(selectedPatternGroupId, createChannelId({ patternGroupId: selectedPatternGroupId, padId }), pad.assetId, { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds, attackMs: pad.attackMs, releaseMs: pad.releaseMs, reversed: pad.reversed })
    showWaveformPlayback(pad.assetId, pad.region.startSeconds, pad.region.endSeconds, startedAt)
    setActivePadId(padId)
    recordPadHit(padId, startedAt)
  }

  const releasePad = (padId: PadState['id']) => {
    if (selectedGroup.padMode === 'chords') {
      const token = chordPriorityRef.current.release(padId)
      if (!token) return
      audioEngine.releaseSynthPad(token)
      audioEngine.releaseStringsPad(token)
      setActivePadId((current) => current === padId ? null : current)
      return
    }
    audioEngine.releaseSynthPad(manualPadToken(selectedPatternGroupId, padId))
    audioEngine.releaseStringsPad(manualPadToken(selectedPatternGroupId, padId))
    const releasedPad = pads.find((pad) => pad.id === padId)
    if (releasedPad?.synthPatchId || releasedPad?.stringsPatchId) setActivePadId((current) => current === padId ? null : current)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return
      /* DRUM SYNTH's panel is pad-independent, so the same physical pad keys
         preview the current kick instead while it is the active view - a
         one-shot fire, since the kick has no note-off/hold concept and no
         gate to release. This must stay a branch inside this single listener
         rather than a second one, or a keypress would double-fire both the
         preview and whichever pad happens to share that key. */
      if (mainView === 'synth' && drumSynthPanelOpen) {
        if (!padIdByKeyCode.has(event.code)) return
        event.preventDefault()
        previewDrumSynth()
        return
      }
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
    // `recording` and the selected variant are listed because the listener closes over
    // triggerPad -> recordPadHit: without them a key press while armed would write into
    // whichever variant was selected when this effect last ran, or not record at all.
  }, [pads, audioReady, cutOnPadTrigger, selectedPatternGroupId, selectedGroup, recording, selectedPatternVariant, mainView, drumSynthPanelOpen, drumSynth, projectKey])

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
    for (const track of audioTracks) for (const clip of track.clips) if (!assetReferences.has(clip.assetId)) assetReferences.set(clip.assetId, { filename: clip.fileName, durationSeconds: clip.assetDurationSeconds })
    return createProjectState({
      schemaVersion: projectSchemaVersion,
      projectKey,
      assets: [...assetReferences].map(([id, asset]) => ({ id, ...asset })),
      patternGroups,
      selectedPatternGroupId,
      selectedPatternVariant,
      playlist,
      audioTracks,
      transportMode,
      loopSong,
      bpm,
      swing,
      master,
      masterEffects,
      pumpRoutes,
      drumSynth,
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
    chordPriorityRef.current.clear()
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
      // A track is its own bus (groupId === channelId === track.id, see
      // tracks/tracksTypes.ts) - no per-channel loop needed, only the bus/FX
      // restoration Pattern Groups already get above.
      for (const track of state.audioTracks) syncTrackBusToEngine(track)
      audioEngine.syncSynthPatches(state.patternGroups.flatMap((group) => group.synthPatches.map((patch) => ({ groupId: group.id, patch }))))
      audioEngine.syncStringsPatches(state.patternGroups.flatMap((group) => group.stringsPatches.map((patch) => ({ groupId: group.id, patch }))))
      audioEngine.setPumpRoutes(state.pumpRoutes.map((route) => ({ id: route.id, sourceChannelId: createChannelId(route.source), targetGroupId: route.targetGroupId, depth: route.depth, lengthSeconds: 60 / state.bpm * route.lengthBeats, curve: route.curve })))
      setPatternGroups(state.patternGroups)
      setSelectedPatternGroupId(state.selectedPatternGroupId)
      setSelectedPatternVariant(state.selectedPatternVariant)
      setPlaylist(state.playlist)
      setAudioTracks(state.audioTracks)
      setTransportMode(state.transportMode)
      setLoopSong(state.loopSong)
      setPlayingSongSlot(null)
      setBpm(state.bpm)
      setSwing(state.swing)
      setMaster(state.master)
      setMasterEffects(state.masterEffects)
      setPumpRoutes(state.pumpRoutes)
      setProjectKey(state.projectKey)
      setDrumSynth(state.drumSynth)
      setWaveforms(nextWaveforms)
      setChopAddingSlice(false)
      setSelectedPadId('pad-01')
      setActivePadId(null)
      setPendingDrumSound(null)
      setDrumSynthPanelOpen(false)
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
  const updateSelectedSynthPatch = (patch: SynthPatch) => {
    setPatternGroups((groups) => groups.map((group) => group.id === selectedPatternGroupId ? { ...group, synthPatches: group.synthPatches.map((candidate) => candidate.id === patch.id ? patch : candidate) } : group))
  }
  const changeSelectedSynthMode = (mode: SynthVoiceMode, confirmed = false) => {
    if (!selectedSynthPatch || selectedSynthPatch.mode === mode) return
    const chordPads = pads.filter((pad) => pad.synthPatchId === selectedSynthPatch.id && pad.chordIntervals.length > 1)
    if (mode === 'mono' && chordPads.length > 0 && !confirmed) {
      requestConfirmation(`Switch this shared patch to MONO and reduce chords on ${chordPads.length} pad${chordPads.length === 1 ? '' : 's'} to their base notes?`, 'REDUCE', () => changeSelectedSynthMode(mode, true))
      return
    }
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
  const updateSelectedStringsPatch = (patch: StringsPatch) => {
    setPatternGroups((groups) => groups.map((group) => group.id === selectedPatternGroupId ? { ...group, stringsPatches: group.stringsPatches.map((candidate) => candidate.id === patch.id ? patch : candidate) } : group))
  }
  const updateSelectedStringsChord = (chordIntervals: number[]) => {
    if (!selectedStringsPatch) return
    const next = [...new Set(chordIntervals)]
    if (next.length < 1 || next.length > maximumStringsVoices || !next.includes(0) || next.some((interval) => !Number.isInteger(interval) || interval < -24 || interval > 24)) return
    const notes = next.map((interval) => selectedStringsPatch.baseMidiNote + selectedPad.pitchSemitones + interval)
    if (notes.some((note) => note < minimumSynthMidiNote || note > maximumSynthMidiNote)) { setErrorMessage('Chord notes must stay between C0 and C8.'); return }
    replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? { ...pad, chordIntervals: next } : pad) })
  }
  const updateDrumSynthKick = (kick: DrumKickPatch) => setDrumSynth((current) => ({ ...current, kick }))
  const updateDrumSynthSnare = (snare: DrumSnarePatch) => setDrumSynth((current) => ({ ...current, snare }))
  const applyDrumSynthKickPreset = (name: KickPresetName) => setDrumSynth((current) => ({ ...current, kick: applyKickPreset(current.kick, name) }))
  const applyDrumSynthSnarePreset = (name: SnarePresetName) => setDrumSynth((current) => ({ ...current, snare: applySnarePreset(current.snare, name) }))
  const selectDrumSynthInstrument = (instrument: DrumInstrumentType) => setDrumSynth((current) => ({ ...current, selectedInstrument: instrument }))
  const previewDrumSynth = () => {
    if (!audioReady) return
    audioEngine.previewDrumSound(drumSynth.selectedInstrument === 'kick' ? drumSynth.kick : drumSynth.snare)
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
    if (!assetId || assetIsReferencedByGroups(groups, audioTracks, assetId)) return
    audioEngine.removeSampleAsset(assetId)
    setWaveforms((current) => { const { [assetId]: _, ...remaining } = current; return remaining })
  }

  const loadLibrarySample = async (sample: LibrarySample, targetPadId: PadState['id'], confirmed = false): Promise<boolean> => {
    if (!audioReady || projectBusy || loadingLibrarySampleId) return false
    const targetPad = pads.find((pad) => pad.id === targetPadId)
    if (!targetPad) return false
    if ((targetPad.synthPatchId || targetPad.stringsPatchId) && !confirmed) {
      requestConfirmation(`Replace the ${targetPad.stringsPatchId ? 'STRINGS' : 'MONOPOLY'} source on ${targetPad.label} with ${sample.filename}?`, 'REPLACE', () => {
        void loadLibrarySample(sample, targetPadId, true).then((loaded) => {
          if (loaded) setSelectedLibrarySample(null)
        })
      })
      return false
    }
    setLoadingLibrarySampleId(sample.id)
    setErrorMessage(undefined)
    try {
      const response = await fetch(sample.url)
      if (!response.ok) throw new Error(`Could not load ${sample.filename} from the built-in library.`)
      const assetId = createAssetId(`library-${sample.id}-${targetPad.id}`)
      const loadedSample = await audioEngine.loadSampleBlob(assetId, await response.blob(), sample.filename)
      const waveform = audioEngine.getWaveformPeaks(assetId) ?? []
      const previousAssetId = targetPad.assetId
      const bank = { ...selectedGroup.bank, pads: pads.map((pad) => pad.id === targetPad.id ? { ...pad, assetId, fileName: loadedSample.filename, durationSeconds: loadedSample.durationSeconds, region: { startSeconds: 0, endSeconds: loadedSample.durationSeconds }, reversed: false, slices: [], chopSessionId: null, synthPatchId: null, stringsPatchId: null, chordIntervals: [0] } : pad) }
      const groups = patternGroups.map((group) => group.id === selectedPatternGroupId ? removeUnreferencedStringsPatches(removeUnreferencedSynthPatches({ ...group, bank })) : group)
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

  /* Renders the current DRUM SYNTH patch once, immediately - the armed buffer
     is ready the instant a pad is tapped, mirroring how a library sample is
     already fetched before it is dropped. Later knob edits have nothing left
     to act on: this WAV is a frozen, independent object from this point on. */
  const addDrumSoundToPad = async () => {
    if (!audioReady || projectBusy || drumSoundRenderBusy) return
    setDrumSoundRenderBusy(true)
    setErrorMessage(undefined)
    try {
      const instrument = drumSynth.selectedInstrument
      const buffer = instrument === 'kick'
        ? await renderKickToBuffer(drumSynth.kick, audioEngine.getSampleRate())
        : await renderSnareToBuffer(drumSynth.snare, audioEngine.getSampleRate())
      setPendingDrumSound({ blob: encodeWav(buffer), filename: instrument === 'kick' ? 'KICK.wav' : 'SNARE.wav', durationSeconds: buffer.duration, instrument })
      setSelectedLibrarySample(null)
      enterMainView('pad')
      setTransportNotice(`Tap a pad to place the ${instrument}.`)
    } catch (error) {
      setErrorMessage(toMessage(error))
    } finally {
      setDrumSoundRenderBusy(false)
    }
  }

  const dropDrumSoundOnPad = async (targetPadId: PadState['id'], confirmed = false): Promise<boolean> => {
    if (!audioReady || projectBusy) return false
    const sound = pendingDrumSound
    if (!sound) return false
    const targetPad = pads.find((pad) => pad.id === targetPadId)
    if (!targetPad) return false
    if ((targetPad.assetId || targetPad.synthPatchId || targetPad.stringsPatchId) && !confirmed) {
      requestConfirmation(`Replace the sound on ${targetPad.label} with this ${sound.instrument}?`, 'REPLACE', () => { void dropDrumSoundOnPad(targetPadId, true) })
      return false
    }
    setErrorMessage(undefined)
    try {
      const assetId = createAssetId(`drumsynth-${targetPad.id}`)
      const loadedSample = await audioEngine.loadSampleBlob(assetId, sound.blob, sound.filename)
      const waveform = audioEngine.getWaveformPeaks(assetId) ?? []
      const previousAssetId = targetPad.assetId
      const bank = { ...selectedGroup.bank, pads: pads.map((pad) => pad.id === targetPad.id ? { ...pad, assetId, fileName: loadedSample.filename, durationSeconds: loadedSample.durationSeconds, region: { startSeconds: 0, endSeconds: loadedSample.durationSeconds }, reversed: false, slices: [], chopSessionId: null, synthPatchId: null, stringsPatchId: null, chordIntervals: [0] } : pad) }
      const groups = patternGroups.map((group) => group.id === selectedPatternGroupId ? removeUnreferencedStringsPatches(removeUnreferencedSynthPatches({ ...group, bank })) : group)
      setPatternGroups(groups)
      setSelectedPadId(targetPad.id)
      setWaveforms((current) => ({ ...current, [assetId]: waveform }))
      const channelId = createChannelId({ patternGroupId: selectedPatternGroupId, padId: targetPad.id })
      audioEngine.setChannelVolume(selectedPatternGroupId, channelId, targetPad.volume)
      audioEngine.setChannelMuted(selectedPatternGroupId, channelId, targetPad.muted)
      audioEngine.setChannelSolo(selectedPatternGroupId, channelId, targetPad.solo)
      removeAssetIfUnused(previousAssetId, groups)
      setPendingDrumSound(null)
      setProjectMessage(`${sound.instrument === 'kick' ? 'Kick' : 'Snare'} placed on ${targetPad.label}.`)
      return true
    } catch (error) {
      setErrorMessage(toMessage(error))
      return false
    }
  }

  const dropArmedItemOnPad = (padId: PadState['id']) => {
    if (selectedLibrarySample) dropLibrarySampleOnPad(padId)
    else if (pendingDrumSound) void dropDrumSoundOnPad(padId)
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
    audioEngine.releaseSynthPad(manualPadToken(selectedPatternGroupId, selectedPadId))
    audioEngine.releaseStringsPad(manualPadToken(selectedPatternGroupId, selectedPadId))
    const bank = { ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? clearPadAssignment(pad) : pad) }
    const groups = patternGroups.map((group) => group.id === selectedPatternGroupId ? removeUnreferencedStringsPatches(removeUnreferencedSynthPatches({ ...group, bank })) : group)
    setPatternGroups(groups)
    removeAssetIfUnused(assetId, groups)
    setActivePadId((current) => current === selectedPadId ? null : current)
  }

  const mapSelectedPadToProjectScale = (confirmed = false) => {
    if (projectBusy || (!selectedPad.assetId && !selectedPad.synthPatchId && !selectedPad.stringsPatchId)) return
    const conflicts = findProjectScaleMapConflicts(pads, selectedPad.id)
    if (conflicts.length > 0 && !confirmed) {
      requestConfirmation(`Replace ${conflicts.length} occupied pad${conflicts.length === 1 ? '' : 's'} with the Project Scale map?`, 'REPLACE', () => mapSelectedPadToProjectScale(true))
      return
    }
    const result = mapPadBankToProjectScale(pads, selectedPad.id, projectKey)
    if (selectedSynthPatch && result.pads.some((pad) => pad.synthPatchId === selectedSynthPatch.id && resolveSynthPadMidiNotes(selectedSynthPatch, pad).some((note) => note < minimumSynthMidiNote || note > maximumSynthMidiNote))) {
      setErrorMessage('This Project Scale map would place MONOPOLY notes outside C0-C8.')
      return
    }
    if (selectedStringsPatch && result.pads.some((pad) => pad.stringsPatchId === selectedStringsPatch.id && resolveStringsPadMidiNotes(selectedStringsPatch, pad).some((note) => note < minimumSynthMidiNote || note > maximumSynthMidiNote))) {
      setErrorMessage('This Project Scale map would place STRINGS notes outside C0-C8.')
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
  /** A standalone, one-way override - the same shape as updateSelectedRegion
      above, and for the same reason: a pad with no live CHOP slice at all
      (a library sample, a rendered drum hit) still needs its own reverse
      toggle, and a pad that DOES come from a slice simply keeps this until the
      next time that slice's session is re-mapped, exactly like a hand-tuned
      region would. */
  const toggleSelectedPadReversed = () => {
    replaceActiveBank({ ...selectedGroup.bank, pads: pads.map((pad) => pad.id === selectedPadId ? { ...pad, reversed: !pad.reversed } : pad) })
  }

  const applyChopMapping = (nextSlices: SampleSlice[], nextSession: ChopSessionState, confirmed = false, onApplied?: () => void): boolean => {
    if (!chopSession.assetId || !chopSession.durationSeconds) return false
    const conflicts = pads.slice(0, nextSlices.length).filter((pad) => (pad.assetId || pad.synthPatchId || pad.stringsPatchId) && pad.chopSessionId !== chopSession.id)
    if (conflicts.length > 0 && !confirmed) {
      requestConfirmation(`Replace ${conflicts.length} occupied pad${conflicts.length === 1 ? '' : 's'} with live Chop slices?`, 'REPLACE', () => {
        applyChopMapping(nextSlices, nextSession, true, onApplied)
      })
      return false
    }
    const bank = { pads: pads.map((pad, index) => {
      const slice = nextSlices[index]
      // A pad already on this session keeps whatever pitch it has - re-slicing
      // must not undo a pad the user has since tuned by hand. A pad newly
      // joining starts from the session's current official pitch instead of 0.
      // Unlike pitch, reverse has no session-wide default to fall back to - it
      // is always this exact slice's own value, so it overwrites unconditionally
      // on every re-slice, the same way region does.
      if (slice) return { ...pad, assetId: chopSession.assetId!, fileName: chopSession.fileName, durationSeconds: chopSession.durationSeconds, region: { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds }, reversed: slice.reversed, slices: [], chopSessionId: chopSession.id, pitchSemitones: pad.chopSessionId === chopSession.id ? pad.pitchSemitones : chopSession.pitchSemitones, synthPatchId: null, stringsPatchId: null, chordIntervals: [0] }
      return pad.chopSessionId === chopSession.id ? clearPadAssignment(pad) : pad
    }), chopSession: nextSession }
    setPatternGroups((groups) => groups.map((group) => group.id === selectedPatternGroupId ? removeUnreferencedStringsPatches(removeUnreferencedSynthPatches({ ...group, bank })) : group))
    onApplied?.()
    return true
  }

  const applyAutoChopRegions = (regions: readonly SliceRegion[], onApplied?: () => void): boolean => {
    const nextSlices: SampleSlice[] = regions.map((region) => ({
      id: createSliceId(chopSession.id),
      sourceAssetId: chopSession.assetId!,
      startSeconds: region.startSeconds,
      endSeconds: region.endSeconds,
      // EQUAL/SMART always start fresh - neither attempts to preserve reverse
      // state across a full re-slice, matching how they already discard every
      // other prior per-slice detail.
      reversed: false,
    }))
    return applyChopMapping(nextSlices, { ...chopSession, slices: nextSlices, activeSliceId: nextSlices[0]?.id ?? null }, false, onApplied)
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

  const loadChopSourceBlob = async (blob: Blob, filename: string): Promise<boolean> => {
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
      return true
    } catch (error) {
      setErrorMessage(toMessage(error))
      return false
    }
  }

  const changeProjectKey = (nextProjectKey: ProjectKey) => {
    const activeToken = chordPriorityRef.current.clear()
    if (activeToken) {
      audioEngine.releaseSynthPad(activeToken)
      audioEngine.releaseStringsPad(activeToken)
    }
    setProjectKey(nextProjectKey)
    setPatternGroups((groups) => repairPatternGroupChords(groups, nextProjectKey))
  }

  const changePadMode = (mode: PadMode) => {
    if (mode === selectedGroup.padMode) return
    const activeToken = chordPriorityRef.current.clear()
    if (activeToken) {
      audioEngine.releaseSynthPad(activeToken)
      audioEngine.releaseStringsPad(activeToken)
    }
    setActivePadId(null)
    setPatternGroups((groups) => setPatternGroupPadMode(groups, selectedPatternGroupId, mode, projectKey))
  }

  const changeSelectedChordAssignment = (assignment: NonNullable<typeof selectedChordAssignment>) => {
    const padIndex = pads.findIndex((pad) => pad.id === selectedPadId)
    setPatternGroups((groups) => setPatternGroupChordAssignment(groups, selectedPatternGroupId, padIndex, assignment))
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

  const openLibrarySampleInChop = async (sample: LibrarySample) => {
    if (!audioReady || projectBusy || loadingLibrarySampleId) return
    setLoadingLibrarySampleId(sample.id)
    setErrorMessage(undefined)
    audioEngine.stopPreview()
    setPreviewingLibrarySampleId(null)
    try {
      const response = await fetch(sample.url)
      if (!response.ok) throw new Error(`Could not open ${sample.filename} in CHOP.`)
      if (!await loadChopSourceBlob(await response.blob(), sample.filename)) return
      setSelectedLibrarySample(null)
      setPendingDrumSound(null)
      setProjectMessage(`${sample.filename} opened in CHOP.`)
      enterMainView('chop')
    } catch (error) {
      setErrorMessage(toMessage(error))
    } finally {
      setLoadingLibrarySampleId(null)
    }
  }

  const addChopSlice = (timeSeconds: number) => {
    if (!chopSession.assetId || !chopSession.durationSeconds) return
    const minimumLength = Math.min(0.01, chopSession.durationSeconds)
    const currentSlices = chopSession.slices.length > 0 ? chopSession.slices : [{ id: createSliceId(chopSession.id), sourceAssetId: chopSession.assetId, startSeconds: 0, endSeconds: chopSession.durationSeconds, reversed: false }]
    if (currentSlices.length >= maxChopSliceCount) return
    const splitIndex = currentSlices.findIndex((slice) => timeSeconds > slice.startSeconds + minimumLength && timeSeconds < slice.endSeconds - minimumLength)
    if (splitIndex < 0) return
    const slice = currentSlices[splitIndex]
    // Both halves of a reversed slice are still reversed audio.
    const newSlice: SampleSlice = { id: createSliceId(chopSession.id), sourceAssetId: chopSession.assetId, startSeconds: timeSeconds, endSeconds: slice.endSeconds, reversed: slice.reversed }
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

  /** Flips one CHOP-session slice's reverse and re-runs the standard mapping,
      the same shape as moveChopCut - so a slice that's already on the pad
      grid picks the change up immediately, exactly like a moved boundary would. */
  const toggleChopSliceReversed = (sliceId: string) => {
    const nextSlices = chopSession.slices.map((slice) => slice.id === sliceId ? { ...slice, reversed: !slice.reversed } : slice)
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
      audioEngine.previewAsset(slice.sourceAssetId, { startSeconds: slice.startSeconds, endSeconds: slice.endSeconds, reversed: slice.reversed })
      showWaveformPlayback(slice.sourceAssetId, slice.startSeconds, slice.endSeconds, startedAt)
    }
    replaceActiveBank({ ...selectedGroup.bank, chopSession: { ...chopSession, activeSliceId: slice.id } })
  }
  // A slice beyond the pad grid (see maxChopSliceCount) has no pad to select,
  // but remains selectable on the waveform and editable in the System Display.
  const selectChopSlice = (sliceId: string) => { const index = chopSession.slices.findIndex((slice) => slice.id === sliceId); replaceActiveBank({ ...selectedGroup.bank, chopSession: { ...chopSession, activeSliceId: sliceId } }); if (index >= 0 && index < pads.length) setSelectedPadId(pads[index].id) }
  const selectChopSource = () => replaceActiveBank({ ...selectedGroup.bank, chopSession: { ...chopSession, activeSliceId: null } })
  const triggerChopPad = (padId: PadState['id']) => {
    const padIndex = pads.findIndex((pad) => pad.id === padId)
    const slice = chopSession.slices[padIndex]
    if (slice) selectChopSlice(slice.id)
    triggerPad(padId)
  }

  const selectedPattern = getVariant(patternGroups, selectedPatternGroupId, selectedPatternVariant)!
  const selectedPatternShifts = getVariantShifts(patternGroups, selectedPatternGroupId, selectedPatternVariant)!
  const selectedPatternLengths = getVariantLengths(patternGroups, selectedPatternGroupId, selectedPatternVariant)!
  const toggleStep = (padId: PadState['id'], stepIndex: number) => setPatternGroups((current) => updateVariantStep(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex))
  const setStepVelocity = (padId: PadState['id'], stepIndex: number, velocity: number) => setPatternGroups((current) => setVariantStepVelocity(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex, velocity))
  const setStepShift = (padId: PadState['id'], stepIndex: number, shift: number) => setPatternGroups((current) => setVariantStepShift(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex, shift))
  const setStepLength = (padId: PadState['id'], stepIndex: number, length: number) => setPatternGroups((current) => setVariantStepLength(current, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex, length))
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
  const duplicateCurrentVariant = (target: PatternVariantName, confirmed = false) => {
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const exists = Boolean(group.variants[target])
    if (exists && !confirmed) {
      requestConfirmation(`Overwrite BANK ${bankNumber(group.id)} PATTERN ${target} with PATTERN ${selectedPatternVariant}? Its pattern data will be replaced.`, 'OVERWRITE', () => duplicateCurrentVariant(target, true))
      return
    }
    try { setPatternGroups((current) => duplicateVariant(current, selectedPatternGroupId, selectedPatternVariant, target, exists)); setSelectedPatternVariant(target) } catch (error) { setErrorMessage(toMessage(error)) }
  }
  const clearCurrentVariant = (confirmed = false) => {
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const references = playlist.filter((clip) => clip.patternGroupId === group.id && clip.variant === selectedPatternVariant)
    const label = `BANK ${bankNumber(group.id)} PATTERN ${selectedPatternVariant}`
    const warning = references.length > 0 ? `Clear ${label}? This also removes ${references.length} Playlist clip${references.length === 1 ? '' : 's'} that reference it.` : `Clear ${label}?`
    if (!confirmed) {
      requestConfirmation(warning, 'CLEAR', () => clearCurrentVariant(true))
      return
    }
    setPatternGroups((current) => clearVariant(current, selectedPatternGroupId, selectedPatternVariant, pads.map((pad) => pad.id)))
    if (references.length > 0) setPlaylist((current) => removeClipsForVariant(current, group.id, selectedPatternVariant))
  }
  const deleteCurrentPatternGroup = (confirmed = false) => {
    if (patternGroups.length <= 1) return
    const group = patternGroups.find((item) => item.id === selectedPatternGroupId)!
    const references = playlist.filter((clip) => clip.patternGroupId === group.id)
    const warning = references.length > 0 ? `Delete BANK ${bankNumber(group.id)}? This also removes ${references.length} Playlist clip${references.length === 1 ? '' : 's'} that reference it.` : `Delete BANK ${bankNumber(group.id)}?`
    if (!confirmed) {
      requestConfirmation(warning, 'DELETE', () => deleteCurrentPatternGroup(true))
      return
    }
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
    const hasTrackContent = audioTracks.some((track) => track.clips.length > 0)
    if (sequenceConfigRef.current.getTracksForSlot(1).length === 0 && !pads.some((pad) => (pad.assetId && audioEngine.hasSampleAsset(pad.assetId)) || pad.synthPatchId || pad.stringsPatchId) && !metronomeEnabled && !hasTrackContent) { setErrorMessage('Load a sample or create a MONOPOLY or STRINGS patch first.'); return }
    sequencerRef.current.start(() => sequenceConfigRef.current)
    // TRACKS plays independently of PATTERN/SONG mode - it is arrangement
    // content, not another pattern to pick, so both schedulers always start
    // together from the same audio-clock instant. See docs/DECISIONS.md DEC-027.
    const tracksStartAt = audioEngine.getCurrentTime()
    tracksPlaybackAnchorRef.current = { startBeat: tracksPlayheadBeat, startedAt: tracksStartAt }
    timelineSchedulerRef.current.start(() => tracksSchedulerConfigRef.current, tracksPlayheadBeat, tracksStartAt)
    setIsPlaying(true)
  }
  const stopPlayback = () => {
    sequencerRef.current.stop()
    audioEngine.stopSequencerVoices()
    timelineSchedulerRef.current.stop()
    audioEngine.stopTimelineVoices()
    if (tracksPlaybackAnchorRef.current) {
      const anchor = tracksPlaybackAnchorRef.current
      setTracksPlayheadBeat(Math.max(0, anchor.startBeat + secondsToBeats(audioEngine.getCurrentTime() - anchor.startedAt, bpm)))
      tracksPlaybackAnchorRef.current = null
    }
    recordingArmedRef.current = false
    pendingRecordingStartRef.current = false
    recordingGridRef.current = null
    setIsPlaying(false)
    setPlayingSongSlot(null)
    setSequencerPlayhead(null)
    setCountingIn(false)
    setRecording(false)
  }

  /* ---- TRACKS ----
     A track is its own live engine bus (AudioEngine.setGroupVolume/Muted/
     Solo/Effects keyed by the track's own id - see tracks/tracksTypes.ts),
     so mute/solo/effects handlers push to the engine directly, the same
     shape as updateChannelVolume/updateGroupBus above. Clip edits (move,
     trim, gain, fade, pitch, reverse, loop) are not live engine state - like
     a Pad's region/pitch, they only matter the next time that clip is
     scheduled - so those only update audioTracks. */

  /** The one place that pushes a track's live engine bus state - used by
      every direct mute/solo/gain/effects handler below and by undo/redo,
      which need the exact same push after restoring an older/newer
      audioTracks snapshot. Previously inlined only in openProject. */
  const syncTrackBusToEngine = (track: AudioTrack) => {
    audioEngine.setGroupVolume(track.id, track.gain)
    audioEngine.setGroupMuted(track.id, track.muted)
    audioEngine.setGroupSolo(track.id, track.solo)
    audioEngine.setGroupEffects(track.id, track.effects)
  }

  /** Undo-tracked audioTracks updates - every clip/track edit that never
      touches asset decode/eviction (move, trim, split, duplicate, loop,
      reverse, gain, fade, pitch, mute, solo, reorder) goes through this
      instead of setAudioTracks directly. Reads the current value from
      audioTracksRef (not a setAudioTracks functional updater) specifically
      so recording history is a plain, top-level call, not nested inside
      another setState's callback. Import and delete deliberately call
      setAudioTracks directly and stay outside history - see
      useTracksHistory's docs. */
  const updateAudioTracks = (updater: (current: AudioTrack[]) => AudioTrack[]) => {
    const current = audioTracksRef.current
    const next = updater(current)
    tracksHistory.record(current)
    setAudioTracks(next)
  }

  const undoTracks = () => {
    const restored = tracksHistory.undo(audioTracksRef.current)
    if (!restored) return
    setAudioTracks(restored)
    for (const track of restored) syncTrackBusToEngine(track)
  }
  const redoTracks = () => {
    const restored = tracksHistory.redo(audioTracksRef.current)
    if (!restored) return
    setAudioTracks(restored)
    for (const track of restored) syncTrackBusToEngine(track)
  }

  const applyTrackMonitorMode = (track: AudioTrack, mode: TrackMonitorMode) => {
    if (mode === 'solo') { audioEngine.setGroupSolo(track.id, true); audioEngine.setGroupMuted(track.id, false) }
    else if (mode === 'mute') { audioEngine.setGroupMuted(track.id, true); audioEngine.setGroupSolo(track.id, false) }
    else { audioEngine.setGroupSolo(track.id, track.solo); audioEngine.setGroupMuted(track.id, track.muted) }
  }
  const openTrackEditor = (trackId: string) => { setOpenTrackEditorId(trackId); setTrackMonitorMode('all') }
  const closeTrackEditor = () => {
    const track = audioTracks.find((candidate) => candidate.id === openTrackEditorId)
    if (track) applyTrackMonitorMode(track, 'all')
    setOpenTrackEditorId(null)
    setTrackMonitorMode('all')
  }
  const changeTrackMonitorMode = (mode: TrackMonitorMode) => {
    const track = audioTracks.find((candidate) => candidate.id === openTrackEditorId)
    if (track) applyTrackMonitorMode(track, mode)
    setTrackMonitorMode(mode)
  }

  const seekTracksPlayhead = (beat: number) => {
    if (isPlaying) return
    setTracksPlayheadBeat(Math.max(0, beat))
  }

  const evictUnusedTrackAssets = (nextTracks: readonly AudioTrack[], candidateAssetIds: ReadonlySet<SampleAssetId>) => {
    for (const assetId of candidateAssetIds) {
      if (assetIsReferencedByGroups(patternGroups, nextTracks, assetId)) continue
      audioEngine.removeSampleAsset(assetId)
      setWaveforms((current) => { const { [assetId]: _removed, ...remaining } = current; return remaining })
    }
  }

  const importNewAudioTrack = async (file: File) => {
    if (audioTracks.length >= maximumAudioTracks) return
    setErrorMessage(undefined)
    try {
      const assetId = createAssetId('track')
      const loaded = await audioEngine.loadSampleBlob(assetId, file, file.name)
      const waveform = audioEngine.getWaveformPeaks(assetId) ?? []
      const trackId = createAudioTrackId()
      const track = { ...createAudioTrack(trackId, audioTracks.length), clips: [createAudioClipFromImport(createAudioClipId(), assetId, loaded.filename, loaded.durationSeconds, 0, bpm)] }
      setAudioTracks((current) => addAudioTrack(current, track))
      setWaveforms((current) => ({ ...current, [assetId]: waveform }))
      audioEngine.setGroupVolume(trackId, track.gain)
      audioEngine.setGroupMuted(trackId, track.muted)
      audioEngine.setGroupSolo(trackId, track.solo)
      audioEngine.setGroupEffects(trackId, track.effects)
    } catch (error) { setErrorMessage(toMessage(error)) }
  }

  const importClipToTrack = async (trackId: string, file: File) => {
    setErrorMessage(undefined)
    try {
      const assetId = createAssetId('track')
      const loaded = await audioEngine.loadSampleBlob(assetId, file, file.name)
      const waveform = audioEngine.getWaveformPeaks(assetId) ?? []
      const track = audioTracks.find((candidate) => candidate.id === trackId)
      const appendBeat = snapBeatToGrid(track ? track.clips.reduce((max, clip) => Math.max(max, clip.startBeat + clip.lengthBeats), 0) : 0, tracksSnapDivision)
      const clip = createAudioClipFromImport(createAudioClipId(), assetId, loaded.filename, loaded.durationSeconds, appendBeat, bpm)
      setAudioTracks((current) => addAudioClip(current, trackId, clip))
      setWaveforms((current) => ({ ...current, [assetId]: waveform }))
    } catch (error) { setErrorMessage(toMessage(error)) }
  }

  const requestRemoveTrack = (trackId: string) => {
    const track = audioTracks.find((candidate) => candidate.id === trackId)
    if (!track) return
    requestConfirmation(`Remove ${track.name}? Its clips will be deleted.`, 'REMOVE', () => {
      const removedAssetIds = new Set(track.clips.map((clip) => clip.assetId))
      const nextTracks = removeAudioTrack(audioTracks, trackId)
      setAudioTracks(nextTracks)
      if (openTrackEditorId === trackId) closeTrackEditor()
      evictUnusedTrackAssets(nextTracks, removedAssetIds)
    })
  }

  const moveTrackOrder = (trackId: string, direction: 'up' | 'down') => updateAudioTracks((current) => moveAudioTrack(current, trackId, direction))

  const setTrackMuted = (trackId: string, muted: boolean) => {
    updateAudioTracks((current) => setAudioTrackMuted(current, trackId, muted))
    audioEngine.setGroupMuted(trackId, muted)
  }
  const setTrackSolo = (trackId: string, solo: boolean) => {
    updateAudioTracks((current) => setAudioTrackSolo(current, trackId, solo))
    audioEngine.setGroupSolo(trackId, solo)
  }
  const setTrackGain = (trackId: string, gain: number) => {
    updateAudioTracks((current) => setAudioTrackGain(current, trackId, gain))
    audioEngine.setGroupVolume(trackId, gain)
  }
  /* Effects are not undo-tracked, matching every other FX rack in the app
     (Pattern Group/master FX have no undo either) - only clip/track
     arrangement edits are. */
  const setTrackEffects = (trackId: string, effects: EffectRackState) => {
    setAudioTracks((current) => setAudioTrackEffects(current, trackId, effects))
    audioEngine.setGroupEffects(trackId, effects)
  }

  const moveClip = (trackId: string, clipId: string, startBeat: number) => updateAudioTracks((current) => moveAudioClip(current, trackId, clipId, startBeat))
  const trimClipStart = (trackId: string, clipId: string, startBeat: number) => updateAudioTracks((current) => trimAudioClipStart(current, trackId, clipId, startBeat, bpm))
  const trimClipEnd = (trackId: string, clipId: string, endBeat: number) => {
    const track = audioTracks.find((candidate) => candidate.id === trackId)
    const clip = track?.clips.find((candidate) => candidate.id === clipId)
    if (!clip) return
    updateAudioTracks((current) => trimAudioClipEnd(current, trackId, clipId, endBeat, bpm, clip.assetDurationSeconds))
  }
  const splitClipAtPlayhead = (trackId: string, clipId: string) => updateAudioTracks((current) => splitAudioClipAt(current, trackId, clipId, tracksLivePlayheadBeat, createAudioClipId(), bpm))
  const duplicateClip = (trackId: string, clipId: string) => updateAudioTracks((current) => duplicateAudioClip(current, trackId, clipId, createAudioClipId()))
  const toggleClipLoop = (trackId: string, clipId: string) => updateAudioTracks((current) => {
    const clip = current.find((candidate) => candidate.id === trackId)?.clips.find((candidate) => candidate.id === clipId)
    return clip ? updateAudioClip(current, trackId, clipId, { loop: !clip.loop }) : current
  })
  const toggleClipReversed = (trackId: string, clipId: string) => updateAudioTracks((current) => {
    const clip = current.find((candidate) => candidate.id === trackId)?.clips.find((candidate) => candidate.id === clipId)
    return clip ? updateAudioClip(current, trackId, clipId, { reversed: !clip.reversed }) : current
  })
  const setClipGain = (trackId: string, clipId: string, gain: number) => updateAudioTracks((current) => updateAudioClip(current, trackId, clipId, { gain: Math.min(1, Math.max(0, gain)) }))
  const setClipFadeIn = (trackId: string, clipId: string, seconds: number) => updateAudioTracks((current) => updateAudioClip(current, trackId, clipId, { fadeInSeconds: Math.min(maximumClipFadeSeconds, Math.max(0, seconds)) }))
  const setClipFadeOut = (trackId: string, clipId: string, seconds: number) => updateAudioTracks((current) => updateAudioClip(current, trackId, clipId, { fadeOutSeconds: Math.min(maximumClipFadeSeconds, Math.max(0, seconds)) }))
  const setClipPitch = (trackId: string, clipId: string, semitones: number) => updateAudioTracks((current) => updateAudioClip(current, trackId, clipId, { pitchSemitones: semitones }))

  const requestRemoveClip = (trackId: string, clipId: string) => {
    const track = audioTracks.find((candidate) => candidate.id === trackId)
    const clip = track?.clips.find((candidate) => candidate.id === clipId)
    if (!track || !clip) return
    requestConfirmation(`Delete this clip from ${track.name}?`, 'DELETE', () => {
      const nextTracks = removeAudioClip(audioTracks, trackId, clipId)
      setAudioTracks(nextTracks)
      evictUnusedTrackAssets(nextTracks, new Set([clip.assetId]))
    })
  }
  /* Quantizes a live pad hit onto the pattern grid rather than recording audio - the
     step it lands on is whichever is nearest in real time to the loop's last step 0,
     wrapped modulo patternStepCount so a hit just before the next downbeat still
     resolves to the run-out step of the pattern that's actually playing. */
  const recordPadHit = (padId: PadState['id'], atTime: number) => {
    if (!recordingArmedRef.current) return
    const grid = recordingGridRef.current
    if (!grid) return
    const stepsFromZero = (atTime - grid.startsAt) / grid.stepDurationSeconds
    /* Still counting in: the grid points at a downbeat that has not arrived yet, so a
       hit lands here with a negative offset. Playing the downbeat a shade early is how
       people actually play it, and rounding already puts anything within half a step
       onto step 1 - only what falls further back is the player counting along rather
       than starting the take, and that is all this drops. */
    if (pendingRecordingStartRef.current && stepsFromZero <= -0.5) return
    const stepIndex = ((Math.round(stepsFromZero) % patternStepCount) + patternStepCount) % patternStepCount
    setPatternGroups((groups) => recordVariantStep(groups, selectedPatternGroupId, selectedPatternVariant, padId, stepIndex))
  }
  /* Already playing: arm immediately, punch-in style - the grid is already live, no
     count-in needed. Stopped: count in one bar of always-audible clicks at the current
     tempo, then arm once `onStepScheduled` reports step 0 has actually been scheduled
     (see the StepSequencer.start `startAt` handoff above `sequenceConfigRef`). */
  const startRecording = () => {
    if (transportMode === 'song') return
    if (isPlaying) { recordingArmedRef.current = true; setRecording(true); return }
    if (!audioReady) { setErrorMessage('Start audio before recording.'); return }
    if (sequenceConfigRef.current.getTracksForSlot(1).length === 0 && !pads.some((pad) => (pad.assetId && audioEngine.hasSampleAsset(pad.assetId)) || pad.synthPatchId || pad.stringsPatchId) && !metronomeEnabled) { setErrorMessage('Load a sample or create a MONOPOLY or STRINGS patch first.'); return }
    const beatSeconds = 60 / bpm
    const now = audioEngine.getCurrentTime()
    const startsAt = now + 4 * beatSeconds
    for (let click = 0; click < 4; click += 1) audioEngine.scheduleMetronome(now + click * beatSeconds, click === 0)
    /* The downbeat's timestamp is known the moment the count-in is scheduled, so the
       grid is published now rather than when step 0 comes round. That is what lets a
       hit played fractionally ahead of the beat still find a step to land on. */
    recordingGridRef.current = { startsAt, stepDurationSeconds: beatSeconds / 4 }
    recordingArmedRef.current = true
    pendingRecordingStartRef.current = true
    setCountingIn(true)
    sequencerRef.current.start(() => sequenceConfigRef.current, startsAt)
  }
  /* Mid count-in there is nothing audible yet to keep running, so this cancels
     outright. Mid recording, playback keeps going - this is a punch-out, not a stop. */
  const stopRecording = () => {
    recordingArmedRef.current = false
    if (countingIn) {
      sequencerRef.current.stop()
      pendingRecordingStartRef.current = false
      recordingGridRef.current = null
      setCountingIn(false)
      return
    }
    setRecording(false)
  }
  const toggleRecording = () => (recording || countingIn ? stopRecording() : startRecording())
  /* Recording targets one Pattern Group and variant, which SONG's playlist walk makes
     ambiguous - switching to SONG mid-take is treated as a hard stop first. */
  const changeTransportMode = (mode: TransportMode) => {
    if (mode === 'song' && (recording || countingIn)) stopPlayback()
    setTransportMode(mode)
  }
  const requestConfirmation = (message: string, confirmLabel: string, onConfirm: () => void) => {
    setPendingConfirmation({ message, confirmLabel, onConfirm })
  }
  const acceptConfirmation = () => {
    const action = pendingConfirmation?.onConfirm
    setPendingConfirmation(undefined)
    action?.()
  }
  const selectedPumpSourcePadIds = pumpRoutes.filter((route) => route.source.patternGroupId === selectedPatternGroupId).map((route) => route.source.padId)
  const selectPatternGroup = (groupId: string) => {
    if (groupId === selectedPatternGroupId) return
    audioEngine.stopManualVoices()
    chordPriorityRef.current.clear()
    audioEngine.stopPreview()
    setSourcePreviewing(false)
    setChopAddingSlice(false)
    setSelectedPatternGroupId(groupId)
    setSelectedPatternVariant('A')
  }
  const enterMainView = (view: MainView) => {
    // Entering SYNTH fresh re-derives picker-vs-editor from the selected pad's
    // patch (see synthShowsPicker below). Re-clicking SYNTH while already on it
    // must not override an explicit "BACK TO SYNTHS" click.
    if (view === 'synth' && mainView !== 'synth') setSynthPickerForced(false)
    workspaceRef.current?.scrollTo({ top: 0 })
    setMainView(view)
    setActiveFxContext(null)
    if (view !== 'pad') setSampleEditorOpen(false)
  }
  /* DRUM SYNTH never reaches this path - it has no pad-bound patch to create,
     so picking it only opens its own panel (see selectSynthInstrument). The
     narrower parameter type here makes routing it through the pattern-group-
     creating flow a compile error rather than a behaviour to remember. */
  const requestOpenInstrumentOnNewPattern = (instrument: Exclude<SynthPickerInstrument, 'drumsynth'>) => {
    const label = instrument === 'monopoly' ? 'MONOPOLY' : 'STRINGS'
    requestConfirmation(`Open ${label} on a new pattern? This creates a new Bank with PATTERN A - your current pattern stays untouched.`, 'OPEN ON NEW PATTERN', () => openInstrumentOnNewPattern(instrument))
  }
  const selectSynthInstrument = (instrument: SynthPickerInstrument) => {
    if (instrument === 'drumsynth') {
      setDrumSynthPanelOpen(true)
      setSynthPickerForced(false)
      return
    }
    requestOpenInstrumentOnNewPattern(instrument)
  }
  /* Picking an instrument in SYNTH must never touch the active pattern - it always
     creates a fresh Bank (Station's existing "new Pattern Group" mechanism) and
     assigns the instrument on that bank's first (always empty) pad, then spreads
     it across the rest of the bank via the same Project Scale mapping the
     MAP TO PROJECT SCALE button uses - a fresh instrument should be playable
     across the whole bank immediately, not just on one pad. If that mapping
     would push a note outside C0-C8 (an unusual bank size/scale combination),
     it silently falls back to the single pad rather than blocking creation. */
  const openInstrumentOnNewPattern = (instrument: Exclude<SynthPickerInstrument, 'drumsynth'>) => {
    let nextGroups: PatternGroup[]
    try {
      nextGroups = addPatternGroup(patternGroups, createPatternGroupId(), pads.map((pad) => pad.id))
    } catch (error) {
      setErrorMessage(toMessage(error))
      return
    }
    const newGroup = nextGroups.at(-1)!
    const targetPadId = newGroup.bank.pads[0].id
    let mappedPadCount = 1
    const finalGroups = nextGroups.map((group) => {
      if (group.id !== newGroup.id) return group
      if (instrument === 'monopoly') {
        const patch = createDefaultSynthPatch(createSynthPatchId())
        const assignedPads = group.bank.pads.map((pad) => pad.id === targetPadId ? assignSynthSource(pad, patch.id) : pad)
        const mapped = mapPadBankToProjectScale(assignedPads, targetPadId, projectKey)
        const inRange = mapped.pads.every((pad) => pad.synthPatchId !== patch.id || resolveSynthPadMidiNotes(patch, pad).every((note) => note >= minimumSynthMidiNote && note <= maximumSynthMidiNote))
        mappedPadCount = inRange ? mapped.mappedPadCount : 1
        return { ...group, bank: { ...group.bank, pads: inRange ? mapped.pads : assignedPads }, synthPatches: [patch] }
      }
      const patch = createDefaultStringsPatch(createStringsPatchId())
      const assignedPads = group.bank.pads.map((pad) => pad.id === targetPadId ? assignStringsSource(pad, patch.id) : pad)
      const mapped = mapPadBankToProjectScale(assignedPads, targetPadId, projectKey)
      const inRange = mapped.pads.every((pad) => pad.stringsPatchId !== patch.id || resolveStringsPadMidiNotes(patch, pad).every((note) => note >= minimumSynthMidiNote && note <= maximumSynthMidiNote))
      mappedPadCount = inRange ? mapped.mappedPadCount : 1
      return { ...group, bank: { ...group.bank, pads: inRange ? mapped.pads : assignedPads }, stringsPatches: [patch] }
    })
    audioEngine.stopManualVoices()
    audioEngine.stopPreview()
    setSourcePreviewing(false)
    setPatternGroups(finalGroups)
    setSelectedPatternGroupId(newGroup.id)
    setSelectedPatternVariant('A')
    setSelectedPadId(targetPadId)
    setSynthPickerForced(false)
    const label = instrument === 'monopoly' ? 'MONOPOLY' : 'STRINGS'
    setProjectMessage(mappedPadCount > 1 ? `${label} created and mapped across ${mappedPadCount} pads.` : `${label} created on a new pattern.`)
    enterMainView('synth')
  }
  const selectedMixTrack = mixTrackId ? audioTracks.find((track) => track.id === mixTrackId) : undefined
  const activeFxRack = activeFxContext?.scope === 'group' ? selectedGroup.effects : activeFxContext?.scope === 'track' ? selectedMixTrack?.effects : activeFxContext?.scope === 'master' ? masterEffects : undefined
  const updateActiveFxRack = (effects: EffectRackState) => {
    if (activeFxContext?.scope === 'group') updateGroupEffects(selectedPatternGroupId, effects)
    if (activeFxContext?.scope === 'track' && mixTrackId) setTrackEffects(mixTrackId, effects)
    if (activeFxContext?.scope === 'master') setMasterEffects(effects)
  }
  /* Which bus MIX is looking at. It used to be local state inside the BUS & FX
     disclosure; the display and the FX slots both need it now, so it lives
     here. */
  const mixBus = mixScope === 'master'
    ? { volume: master.volume, muted: master.muted }
    : mixScope === 'track'
      ? { volume: selectedMixTrack?.gain ?? 1, muted: selectedMixTrack?.muted ?? false, solo: selectedMixTrack?.solo ?? false }
      : { volume: selectedGroup.bus!.volume, muted: selectedGroup.bus!.muted, solo: selectedGroup.bus!.solo }
  const mixBusLabel = mixScope === 'master' ? 'MASTER' : mixScope === 'track' ? `T${audioTracks.findIndex((track) => track.id === mixTrackId) + 1}` : `G${patternGroups.findIndex((group) => group.id === selectedPatternGroupId) + 1}`
  const synthShowsPicker = synthPickerForced || (!drumSynthPanelOpen && !selectedSynthPatch && !selectedStringsPatch)
  // The SYNTH tab keeps STRINGS'/DRUM SYNTH's own accent colour while their editor is
  // actually on screen, and falls back to the shared SYNTH accent for the picker and MONOPOLY.
  const accentView = mainView === 'synth' && !synthShowsPicker && drumSynthPanelOpen ? 'drumsynth' : mainView === 'synth' && !synthShowsPicker && selectedStringsPatch ? 'strings' : mainView
  const editingTrack = openTrackEditorId ? audioTracks.find((track) => track.id === openTrackEditorId) : undefined
  return (
    <SystemDisplayProvider api={displayApi}>
    <main
      className="station-shell"
      data-view={accentView}
      data-powered={powerVisualPhase === 'off' ? 'off' : 'on'}
      data-power-phase={powerVisualPhase}
      onContextMenu={(event) => {
        const target = event.target
        const keepsNativeMenu = target instanceof Element && target.closest("input:not([type='range']), textarea, select, [contenteditable='true']")
        if (!keepsNativeMenu) event.preventDefault()
      }}
      onDragStart={(event) => {
        /* Inbound file drops do not fire dragstart in Station, so suppressing
           browser-originated drags here removes ghost images/text drags without
           affecting any WAV import path. A future intentional DOM drag can opt
           in explicitly instead of weakening the whole chassis. */
        const target = event.target
        const allowsNativeDrag = target instanceof Element && target.closest('[data-native-drag]')
        if (!allowsNativeDrag) event.preventDefault()
      }}
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
                {audioReady ? "AUDIO ON" : audioRecovering ? "AUDIO PAUSED" : audioStatus === "starting" ? "STARTING…" : "START AUDIO"}
              </button>
            </div>
            <TransportBar
              bpm={bpm}
              swing={swing}
              isPlaying={isPlaying}
              recording={recording}
              countingIn={countingIn}
              mode={transportMode}
              loopSong={loopSong}
              metronomeEnabled={metronomeEnabled}
              settingsOpen={transportSettingsOpen}
              statusMessage={transportNotice ?? projectMessage}
              errorMessage={errorMessage}
              focusReadout={displayFocusReadout}
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
              onModeChange={changeTransportMode}
              onRecordToggle={toggleRecording}
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
                onProjectKeyChange={changeProjectKey}
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
          <MainNavigation view={mainView} onViewChange={enterMainView} />
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
                tempo={chopTempo}
                onApplyTempo={applyDetectedTempo}
                slices={chopSession.slices}
                activeSliceId={chopSession.activeSliceId}
                onSelectSource={selectChopSource}
                onPreviewSlice={previewChopSlice}
                onToggleSliceReversed={toggleChopSliceReversed}
                onRemoveActiveCut={removeActiveChopCut}
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
                candidates={chopCandidates}
                analyzing={!chopAnalysisReady}
                onLoadSource={loadChopSource}
                testSamples={chopTestSamples}
                loadingTestId={loadingChopTestId}
                onLoadTestSample={(sample) => void loadChopTestSample(sample)}
                sourcePreviewing={sourcePreviewing}
                onPreviewSource={previewChopSource}
                onStopPreviewSource={stopChopSourcePreview}
                onTriggerPad={triggerChopPad}
                onReleasePad={releasePad}
                onFeedbackEnd={(padId) =>
                  setActivePadId((current) =>
                    current === padId ? null : current,
                  )
                }
                onAddSlice={addChopSlice}
                onMoveCut={moveChopCut}
                onSelectSlice={selectChopSlice}
                onToggleAdding={() => setChopAddingSlice((current) => !current)}
                onClearSlices={clearChopSlices}
                onApplyAutoChop={applyAutoChopRegions}
              />
            </>
          )}
          {mainView === "pad" && (
            <>
              {selectedGroup.padMode === 'chords' && selectedChordAssignment
                ? <ChordDisplayLauncher group={selectedGroup} pad={selectedPad} assignment={selectedChordAssignment} projectKey={projectKey} onAssignmentChange={changeSelectedChordAssignment} />
                : <PadDisplayLauncher
                    pad={selectedPad}
                    audioReady={audioReady}
                    projectBusy={projectBusy}
                    projectKeyLabel={formatProjectKey(projectKey)}
                    loadingLibrarySampleId={loadingLibrarySampleId}
                    previewingLibrarySampleId={previewingLibrarySampleId}
                    selectedLibrarySample={selectedLibrarySample}
                    onUpdate={updateSelectedPad}
                    onPreviewLibrarySample={previewLibrarySample}
                    onOpenLibrarySampleInChop={openLibrarySampleInChop}
                    onSelectedLibrarySampleChange={(sample) => { setSelectedLibrarySample(sample); setPendingDrumSound(null) }}
                    onMapToProjectScale={mapSelectedPadToProjectScale}
                    onEditSample={() => setSampleEditorOpen(true)}
                    onClear={clearSelectedPad}
                  />}
              <div className="instrument-layout">
                <div className="pad-workspace">
                  <div className="pad-grid-toolbar">
                    <ChordModeToggle enabled={selectedGroup.padMode === 'chords'} available={chordModeAvailable} onChange={(enabled) => changePadMode(enabled ? 'chords' : 'notes')} />
                  </div>
                  <PadGrid
                    pads={pads}
                    selectedPadId={selectedPadId}
                    activePadId={activePadId}
                    audioReady={audioReady}
                    dropSampleName={selectedLibrarySample?.filename ?? pendingDrumSound?.filename ?? null}
                    onTrigger={triggerPad}
                    onRelease={releasePad}
                    onDropSample={dropArmedItemOnPad}
                    onFeedbackEnd={(padId) => {
                      const pad = pads.find((candidate) => candidate.id === padId)
                      if (selectedGroup.padMode !== 'chords' && !pad?.synthPatchId && !pad?.stringsPatchId) setActivePadId((current) => current === padId ? null : current)
                    }}
                    chordLabels={chordLabels}
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
                    onToggleReversed={toggleSelectedPadReversed}
                    onClose={() => setSampleEditorOpen(false)}
                  />
                </div>
              )}
            </>
          )}
          {mainView === "synth" && synthShowsPicker && (
            <SynthPicker onSelect={selectSynthInstrument} />
          )}
          {mainView === "synth" && !synthShowsPicker && drumSynthPanelOpen && (
            <DrumSynthWorkspace
              drumSynth={drumSynth}
              audioReady={audioReady}
              projectBusy={projectBusy}
              onSelectInstrument={selectDrumSynthInstrument}
              onKickPatchChange={updateDrumSynthKick}
              onKickPreset={applyDrumSynthKickPreset}
              onSnarePatchChange={updateDrumSynthSnare}
              onSnarePreset={applyDrumSynthSnarePreset}
              onTrigger={previewDrumSynth}
              onAddToPad={addDrumSoundToPad}
              onBack={() => { setDrumSynthPanelOpen(false); setSynthPickerForced(true) }}
            />
          )}
          {mainView === "synth" && !synthShowsPicker && !drumSynthPanelOpen && selectedSynthPatch && (
            <SynthWorkspace
              pad={selectedPad}
              patch={selectedSynthPatch}
              usageCount={selectedSynthUsageCount}
              baseMidiRange={selectedSynthBaseRange}
              audioReady={audioReady}
              projectBusy={projectBusy}
              projectKeyLabel={formatProjectKey(projectKey)}
              onPatchChange={updateSelectedSynthPatch}
              onModeChange={changeSelectedSynthMode}
              onChordChange={updateSelectedChord}
              onPadPitchChange={(pitchSemitones) => updateSelectedPad({ volume: selectedPad.volume, pitchSemitones, attackMs: selectedPad.attackMs, releaseMs: selectedPad.releaseMs })}
              onTrigger={() => triggerPad(selectedPad.id)}
              onRelease={() => releasePad(selectedPad.id)}
              onMapToProjectScale={mapSelectedPadToProjectScale}
              onClear={clearSelectedPad}
              onBack={() => setSynthPickerForced(true)}
            />
          )}
          {mainView === "synth" && !synthShowsPicker && !drumSynthPanelOpen && selectedStringsPatch && (
            <StringsWorkspace
              pad={selectedPad}
              patch={selectedStringsPatch}
              usageCount={selectedStringsUsageCount}
              baseMidiRange={selectedStringsBaseRange}
              audioReady={audioReady}
              projectBusy={projectBusy}
              projectKeyLabel={formatProjectKey(projectKey)}
              onPatchChange={updateSelectedStringsPatch}
              onChordChange={updateSelectedStringsChord}
              onPadPitchChange={(pitchSemitones) => updateSelectedPad({ volume: selectedPad.volume, pitchSemitones, attackMs: selectedPad.attackMs, releaseMs: selectedPad.releaseMs })}
              onTrigger={() => triggerPad(selectedPad.id)}
              onRelease={() => releasePad(selectedPad.id)}
              onMapToProjectScale={mapSelectedPadToProjectScale}
              onClear={clearSelectedPad}
              onBack={() => setSynthPickerForced(true)}
            />
          )}
          {mainView === "seq" && (
            <SequencerControls
              pattern={selectedPattern}
              shifts={selectedPatternShifts}
              lengths={selectedPatternLengths}
              pads={pads.filter(
                (pad) => pad.fileName || pad.synthPatchId || pad.stringsPatchId || pad.id === selectedPad.id,
              )}
              selectedPadId={selectedPad.id}
              group={selectedGroup}
              selectedVariant={selectedPatternVariant}
              playingStep={playingStep}
              onSelectPad={triggerPad}
              onReleasePad={releasePad}
              onToggleStep={toggleStep}
              onVelocityChange={setStepVelocity}
              onShiftChange={setStepShift}
              onLengthChange={setStepLength}
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
          {mainView === "tracks" && tracksLayoutMode === "compact" && (
            <TracksWorkspace
              tracks={audioTracks}
              waveforms={waveforms}
              audioReady={audioReady}
              isPlaying={isPlaying}
              playheadBeat={tracksLivePlayheadBeat}
              snapDivision={tracksSnapDivision}
              maximumTracks={maximumAudioTracks}
              viewState={tracksViewState}
              onSnapDivisionChange={setTracksSnapDivision}
              onSeekPlayhead={seekTracksPlayhead}
              onImportNewTrack={(file) => void importNewAudioTrack(file)}
              onImportClipToTrack={(trackId, file) => void importClipToTrack(trackId, file)}
              onRequestRemoveTrack={requestRemoveTrack}
              onMoveTrackOrder={moveTrackOrder}
              onSetTrackMuted={setTrackMuted}
              onSetTrackSolo={setTrackSolo}
              onMoveClip={moveClip}
              onTrimClipStart={trimClipStart}
              onTrimClipEnd={trimClipEnd}
              onSplitClipAtPlayhead={splitClipAtPlayhead}
              onDuplicateClip={duplicateClip}
              onToggleClipLoop={toggleClipLoop}
              onRequestRemoveClip={requestRemoveClip}
              onOpenTrackEditor={openTrackEditor}
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
                tracks={audioTracks}
                selectedTrackId={mixTrackId}
                scope={mixScope}
                onSelectGroup={selectPatternGroup}
                onSelectTrack={setMixTrackId}
                onScopeChange={(scope) => {
                  setMixScope(scope)
                  if (scope === "track" && !mixTrackId) setMixTrackId(audioTracks[0]?.id ?? null)
                  setActiveFxContext(null)
                  setMixClaimNonce((nonce) => nonce + 1)
                }}
              />
              {/* Replaces the MIX readout that only ever held the line. The bus
                  stands down while an FX slot is open, so opening a slot from
                  here is not immediately undone by its own parent. */}
              {(mixScope !== "track" || selectedMixTrack) && (
                <BusDisplayLauncher
                  scopeLabel={mixBusLabel}
                  bus={mixBus}
                  rack={mixScope === "master" ? masterEffects : mixScope === "track" ? selectedMixTrack!.effects : selectedGroup.effects}
                  suspended={activeFxContext !== null}
                  claimNonce={mixClaimNonce}
                  onVolumeChange={(volume) =>
                    mixScope === "master"
                      ? updateMaster({ volume })
                      : mixScope === "track"
                        ? setTrackGain(mixTrackId!, volume)
                        : updateGroupBus(selectedPatternGroupId, { volume })
                  }
                  onMutedChange={(muted) =>
                    mixScope === "master"
                      ? updateMaster({ muted })
                      : mixScope === "track"
                        ? setTrackMuted(mixTrackId!, muted)
                        : updateGroupBus(selectedPatternGroupId, { muted })
                  }
                  onSoloChange={
                    mixScope === "master"
                      ? undefined
                      : mixScope === "track"
                        ? (solo) => setTrackSolo(mixTrackId!, solo)
                        : (solo) => updateGroupBus(selectedPatternGroupId, { solo })
                  }
                  onOpenSlot={(slotIndex) =>
                    setActiveFxContext({ scope: mixScope, slotIndex })
                  }
                />
              )}
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
      {/* TRACKS' wide layout - a fixed, full-viewport sibling of
          .station-panel, escaping the app-wide phone-width cap the same way
          TrackEditor already does. Orientation only ever picks between this
          and the compact TracksWorkspace above while mainView === 'tracks' -
          it never changes mainView itself. See docs/DECISIONS.md DEC-027. */}
      {mainView === "tracks" && tracksLayoutMode === "wide" && (
        <TracksArranger
          tracks={audioTracks}
          waveforms={waveforms}
          audioReady={audioReady}
          isPlaying={isPlaying}
          playheadBeat={tracksLivePlayheadBeat}
          bpm={bpm}
          snapDivision={tracksSnapDivision}
          maximumTracks={maximumAudioTracks}
          viewState={tracksViewState}
          canUndo={tracksHistory.canUndo}
          canRedo={tracksHistory.canRedo}
          onUndo={undoTracks}
          onRedo={redoTracks}
          onSnapDivisionChange={setTracksSnapDivision}
          onSeekPlayhead={seekTracksPlayhead}
          onPlay={startPlayback}
          onStop={stopPlayback}
          onImportNewTrack={(file) => void importNewAudioTrack(file)}
          onImportClipToTrack={(trackId, file) => void importClipToTrack(trackId, file)}
          onRequestRemoveTrack={requestRemoveTrack}
          onMoveTrackOrder={moveTrackOrder}
          onSetTrackMuted={setTrackMuted}
          onSetTrackSolo={setTrackSolo}
          onMoveClip={moveClip}
          onTrimClipStart={trimClipStart}
          onTrimClipEnd={trimClipEnd}
          onSplitClipAtPlayhead={splitClipAtPlayhead}
          onDuplicateClip={duplicateClip}
          onToggleClipLoop={toggleClipLoop}
          onRequestRemoveClip={requestRemoveClip}
          onOpenTrackEditor={openTrackEditor}
          onExit={() => setMainView(previousMainViewRef.current)}
        />
      )}
      {/* A fixed, full-viewport sibling of .station-panel, not a replacement
          for it - TracksWorkspace above stays mounted underneath the whole
          time this is open, which is what lets closing return to its exact
          prior scroll/zoom/selection state for free. See tracks/TrackEditor.tsx. */}
      {editingTrack && (
        <TrackEditor
          track={editingTrack}
          waveforms={waveforms}
          bpm={bpm}
          isPlaying={isPlaying}
          playheadBeat={tracksLivePlayheadBeat}
          snapDivision={tracksSnapDivision}
          onSnapDivisionChange={setTracksSnapDivision}
          monitorMode={trackMonitorMode}
          onMonitorModeChange={changeTrackMonitorMode}
          onMoveClip={(clipId, startBeat) => moveClip(editingTrack.id, clipId, startBeat)}
          onTrimClipStart={(clipId, startBeat) => trimClipStart(editingTrack.id, clipId, startBeat)}
          onTrimClipEnd={(clipId, endBeat) => trimClipEnd(editingTrack.id, clipId, endBeat)}
          onSplitClipAtPlayhead={(clipId) => splitClipAtPlayhead(editingTrack.id, clipId)}
          onDuplicateClip={(clipId) => duplicateClip(editingTrack.id, clipId)}
          onRequestRemoveClip={(clipId) => requestRemoveClip(editingTrack.id, clipId)}
          onToggleClipLoop={(clipId) => toggleClipLoop(editingTrack.id, clipId)}
          onSetClipGain={(clipId, gain) => setClipGain(editingTrack.id, clipId, gain)}
          onSetClipFadeIn={(clipId, seconds) => setClipFadeIn(editingTrack.id, clipId, seconds)}
          onSetClipFadeOut={(clipId, seconds) => setClipFadeOut(editingTrack.id, clipId, seconds)}
          onSetClipPitch={(clipId, semitones) => setClipPitch(editingTrack.id, clipId, semitones)}
          onToggleClipReversed={(clipId) => toggleClipReversed(editingTrack.id, clipId)}
          onSeekPlayhead={seekTracksPlayhead}
          onClose={closeTrackEditor}
        />
      )}
      {pendingConfirmation && (
        <StationConfirm
          message={pendingConfirmation.message}
          confirmLabel={pendingConfirmation.confirmLabel}
          onConfirm={acceptConfirmation}
          onCancel={() => setPendingConfirmation(undefined)}
        />
      )}
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
function assetIsReferencedByGroups(groups: readonly PatternGroup[], tracks: readonly AudioTrack[], assetId: SampleAssetId): boolean {
  return groups.some((group) => group.bank.pads.some((pad) => pad.assetId === assetId) || group.bank.chopSession.assetId === assetId) || collectAudioTrackAssetIds(tracks).has(assetId)
}
function manualPadToken(groupId: string, padId: PadState['id']): string {
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
function getSharedStringsPatchBaseMidiRange(group: PatternGroup, patchId: string): readonly [number, number] {
  let minimum = minimumSynthMidiNote
  let maximum = maximumSynthMidiNote
  for (const pad of group.bank.pads) {
    if (pad.stringsPatchId !== patchId) continue
    minimum = Math.max(minimum, minimumSynthMidiNote - pad.pitchSemitones - Math.min(...pad.chordIntervals))
    maximum = Math.min(maximum, maximumSynthMidiNote - pad.pitchSemitones - Math.max(...pad.chordIntervals))
  }
  return [minimum, maximum]
}
