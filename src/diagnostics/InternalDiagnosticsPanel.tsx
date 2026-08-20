import { useEffect, useRef, useState } from 'react'
import type { AudioEngine, AudioEngineDiagnostics } from '../audio/AudioEngine'
import type { StepSequencer, StepSequencerDiagnostics } from '../audio/StepSequencer'
import type { TimelineScheduler, TimelineSchedulerDiagnostics } from '../audio/TimelineScheduler'
import type { ProjectSaveSnapshot } from '../storage/ProjectSaveState'
import { browserStorageMonitor } from '../storage/BrowserStorageMonitor'
import type { BrowserStorageDiagnostics } from '../storage/BrowserStorageMonitor'
import { getStationDatabaseDiagnostics } from '../storage/StationDatabase'
import type { StationDatabaseDiagnostics } from '../storage/StationDatabase'
import {
  formatDiagnosticBytes,
  formatDiagnosticLatency,
  formatDiagnosticRatio,
  isInternalDiagnosticsEnabled,
} from './internalDiagnostics'

interface InternalDiagnosticsPanelProps {
  readonly audioEngine: AudioEngine
  readonly stepSequencer: StepSequencer
  readonly timelineScheduler: TimelineScheduler
  readonly projectId: string | null
  readonly projectSaveState: ProjectSaveSnapshot
  readonly transportMode: 'pattern' | 'song'
  readonly songSlot: number | null
  readonly patternSection: string
  readonly patternStep: number | null
  readonly tracksPlayheadBeat: number
  readonly rendering: boolean
  readonly renderProgress: number | null
}

interface InternalDiagnosticsSnapshot {
  readonly capturedAt: string
  readonly audio: AudioEngineDiagnostics
  readonly stepRunning: boolean
  readonly step: StepSequencerDiagnostics
  readonly timelineRunning: boolean
  readonly timeline: TimelineSchedulerDiagnostics
  readonly database: StationDatabaseDiagnostics
  readonly storage: BrowserStorageDiagnostics
  readonly projectId: string | null
  readonly save: ProjectSaveSnapshot
  readonly transportMode: 'pattern' | 'song'
  readonly songSlot: number | null
  readonly patternSection: string
  readonly patternStep: number | null
  readonly tracksPlayheadBeat: number
  readonly rendering: boolean
  readonly renderProgress: number | null
}

export function InternalDiagnosticsPanel(props: InternalDiagnosticsPanelProps) {
  if (!isInternalDiagnosticsEnabled(window.location.search)) return null
  return <ActiveInternalDiagnosticsPanel {...props} />
}

function ActiveInternalDiagnosticsPanel(props: InternalDiagnosticsPanelProps) {
  const latestPropsRef = useRef(props)
  latestPropsRef.current = props
  const [snapshot, setSnapshot] = useState(() => captureDiagnostics(props))

  useEffect(() => {
    const capture = () => setSnapshot(captureDiagnostics(latestPropsRef.current))
    capture()
    void browserStorageMonitor.refresh().then(capture)
    const runtimeTimer = window.setInterval(capture, 1000)
    const storageTimer = window.setInterval(() => { void browserStorageMonitor.refresh().then(capture) }, 30_000)
    return () => {
      window.clearInterval(runtimeTimer)
      window.clearInterval(storageTimer)
    }
  }, [])

  const synthVoices = snapshot.audio.voices.synth
    + snapshot.audio.voices.organicBass
    + snapshot.audio.voices.strings
    + snapshot.audio.voices.poly
  const transportPosition = snapshot.transportMode === 'song'
    ? `SONG SLOT ${snapshot.songSlot ?? '—'}`
    : `PATTERN ${snapshot.patternSection} / STEP ${snapshot.patternStep === null ? '—' : snapshot.patternStep + 1}`
  const renderState = snapshot.rendering
    ? `YES${snapshot.renderProgress === null ? '' : ` / ${Math.round(snapshot.renderProgress * 100)}%`}`
    : 'NO'

  return (
    <aside className="internal-diagnostics" aria-label="Station internal diagnostics" data-testid="station-diagnostics">
      <div className="internal-diagnostics-heading">
        <strong>STATION INTERNAL DIAGNOSTICS</strong>
        <span>1 HZ</span>
      </div>
      <DiagnosticGroup title="BUILD" rows={[
        ['SHA', __STATION_BUILD_SHA__],
        ['UPDATED', snapshot.capturedAt],
      ]} />
      <DiagnosticGroup title="AUDIO" rows={[
        ['ENGINE', snapshot.audio.status.toUpperCase()],
        ['CONTEXT', snapshot.audio.context.state.toUpperCase()],
        ['SAMPLE RATE', snapshot.audio.context.sampleRate ? `${snapshot.audio.context.sampleRate} Hz` : '—'],
        ['BASE LATENCY', formatDiagnosticLatency(snapshot.audio.context.baseLatency)],
        ['OUTPUT LATENCY', formatDiagnosticLatency(snapshot.audio.context.outputLatency)],
        ['ZOLA-X', snapshot.audio.optionalInstruments.zolaX.status.toUpperCase()],
      ]} />
      <DiagnosticGroup title="TRANSPORT" rows={[
        ['STEP SCHEDULER', snapshot.stepRunning ? 'RUNNING' : 'STOPPED'],
        ['TIMELINE', snapshot.timelineRunning ? 'RUNNING' : 'STOPPED'],
        ['POSITION', transportPosition],
        ['TRACK BEAT', snapshot.tracksPlayheadBeat.toFixed(2)],
        ['STEP LATE', `${snapshot.step.lateWakeCount} / MAX ${formatDiagnosticLatency(snapshot.step.maxLatenessSeconds)}`],
        ['TIMELINE LATE', `${snapshot.timeline.lateWakeCount} / MAX ${formatDiagnosticLatency(snapshot.timeline.maxLatenessSeconds)}`],
        ['EXPIRED', `STEPS ${snapshot.step.skippedExpiredStepCount} / EVENTS ${snapshot.step.skippedExpiredEventCount} / CLIPS ${snapshot.timeline.skippedExpiredClipCount}`],
      ]} />
      <DiagnosticGroup title="VOICES" rows={[
        ['TOTAL', String(snapshot.audio.voices.total)],
        ['SEQ SAMPLE', String(snapshot.audio.voices.sequencerSamples)],
        ['TIMELINE', String(snapshot.audio.voices.timelineSamples)],
        ['SYNTH', String(synthVoices)],
        ['MANUAL / PREVIEW', `${snapshot.audio.voices.manualSamples} / ${snapshot.audio.voices.previewSamples + snapshot.audio.voices.drumPreview}`],
      ]} />
      <DiagnosticGroup title="ASSETS / ROUTING" rows={[
        ['SAMPLES', String(snapshot.audio.assets.loadedSamples)],
        ['REVERSE / WAVEFORM', `${snapshot.audio.assets.reverseBuffers} / ${snapshot.audio.assets.waveformCaches}`],
        ['RUNTIME BLOBS', String(snapshot.audio.assets.runtimeBlobs)],
        ['CHANNELS / BUSES / FX', `${snapshot.audio.routing.channels} / ${snapshot.audio.routing.groupBuses} / ${snapshot.audio.routing.groupEffectRacks}`],
      ]} />
      <DiagnosticGroup title="PROJECT" rows={[
        ['ID', snapshot.projectId ?? 'UNSAVED'],
        ['SAVE', snapshot.save.status.toUpperCase()],
        ['REVISION', `${snapshot.save.savedRevision} / ${snapshot.save.revision}`],
        ['QUEUE', String(snapshot.save.queueDepth)],
        ['ERROR', snapshot.save.error ?? '—'],
      ]} />
      <DiagnosticGroup title="STORAGE" rows={[
        ['INDEXEDDB', snapshot.database.state.toUpperCase()],
        ['DB ERROR', snapshot.database.error ?? '—'],
        ['MONITOR', snapshot.storage.state.toUpperCase()],
        ['USAGE / QUOTA', `${formatDiagnosticBytes(snapshot.storage.usageBytes)} / ${formatDiagnosticBytes(snapshot.storage.quotaBytes)}`],
        ['PRESSURE', formatDiagnosticRatio(snapshot.storage.usageRatio)],
        ['PERSISTED', formatDiagnosticBoolean(snapshot.storage.persisted)],
      ]} />
      <DiagnosticGroup title="RENDER" rows={[[ 'ACTIVE', renderState ]]} />
    </aside>
  )
}

function captureDiagnostics(props: InternalDiagnosticsPanelProps): InternalDiagnosticsSnapshot {
  return {
    capturedAt: new Date().toISOString().slice(11, 19),
    audio: props.audioEngine.getDiagnostics(),
    stepRunning: props.stepSequencer.isRunning(),
    step: props.stepSequencer.getDiagnostics(),
    timelineRunning: props.timelineScheduler.isRunning(),
    timeline: props.timelineScheduler.getDiagnostics(),
    database: getStationDatabaseDiagnostics(),
    storage: browserStorageMonitor.getDiagnostics(),
    projectId: props.projectId,
    save: { ...props.projectSaveState },
    transportMode: props.transportMode,
    songSlot: props.songSlot,
    patternSection: props.patternSection,
    patternStep: props.patternStep,
    tracksPlayheadBeat: props.tracksPlayheadBeat,
    rendering: props.rendering,
    renderProgress: props.renderProgress,
  }
}

function DiagnosticGroup({ title, rows }: { readonly title: string; readonly rows: readonly (readonly [string, string])[] }) {
  return (
    <section className="internal-diagnostics-group">
      <h2>{title}</h2>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function formatDiagnosticBoolean(value: boolean | null): string {
  return value === null ? '—' : value ? 'YES' : 'NO'
}
