import { useEffect, useMemo, useRef, useState } from 'react'
import type { PadState } from './types'
import { builtInLibrary, libraryCategories } from '../library/builtInLibrary'
import type { LibrarySample } from '../library/builtInLibrary'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import './padBrowser.css'

interface PadDisplayLauncherProps {
  pad: PadState
  audioReady: boolean
  projectBusy: boolean
  projectKeyLabel: string
  loadingLibrarySampleId: string | null
  previewingLibrarySampleId: string | null
  selectedLibrarySample: LibrarySample | null
  onUpdate: (changes: Pick<PadState, 'volume' | 'pitchSemitones' | 'attackMs' | 'releaseMs'>) => void
  onPreviewLibrarySample: (sample: LibrarySample) => Promise<void>
  onSelectedLibrarySampleChange: (sample: LibrarySample | null) => void
  onMapToProjectScale: () => void
  onEditSample: () => void
  onClear: () => void
}

const displayId = 'pad-controls'

/** Keeps per-pad sound settings in the shared display instead of under the pad grid. */
export function PadDisplayLauncher(props: PadDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  const [displayPage, setDisplayPage] = useState<'browser' | 'sound'>('browser')
  const [categoryIndex, setCategoryIndex] = useState(0)
  const hasOwnedDisplayRef = useRef(false)
  const category = libraryCategories[categoryIndex]
  const categorySamples = builtInLibrary.filter((sample) => sample.category === category)
  const selectLibrarySample = (sample: LibrarySample) => props.onSelectedLibrarySampleChange(
    props.selectedLibrarySample?.id === sample.id ? null : sample,
  )
  // App recreates its event handlers on each render. Depending on the whole
  // props object would therefore re-claim the display after the claim itself
  // updates App, creating a render loop. These are the values rendered here.
  const tenant = useMemo<DisplayTenant>(() => padTenant(props, {
    displayPage,
    category,
    categoryIndex,
    categorySamples,
    onOpenSampleBrowser: () => setDisplayPage('browser'),
    onOpenSoundControls: () => setDisplayPage('sound'),
    onPreviousCategory: () => setCategoryIndex((index) => Math.max(0, index - 1)),
    onNextCategory: () => setCategoryIndex((index) => Math.min(libraryCategories.length - 1, index + 1)),
    onSelectLibrarySample: selectLibrarySample,
  }), [
    props.pad.id,
    props.pad.label,
    props.pad.fileName,
    props.pad.volume,
    props.pad.pitchSemitones,
    props.pad.attackMs,
    props.pad.releaseMs,
    props.pad.assetId,
    props.audioReady,
    props.projectBusy,
    props.projectKeyLabel,
    props.loadingLibrarySampleId,
    props.previewingLibrarySampleId,
    props.selectedLibrarySample?.id,
    displayPage,
    category,
    categoryIndex,
  ])

  useEffect(() => {
    setDisplayActive(true)
    setDisplayPage('browser')
  }, [props.pad.id])

  useEffect(() => {
    if (displayActive) claim(tenant)
    else release(displayId)
  }, [displayActive, tenant, claim, release])

  useEffect(() => () => release(displayId), [release])

  useEffect(() => {
    if (!displayActive) {
      hasOwnedDisplayRef.current = false
      return
    }
    if (ownerId === displayId) {
      hasOwnedDisplayRef.current = true
      return
    }
    if (hasOwnedDisplayRef.current && ownerId !== null) setDisplayActive(false)
  }, [displayActive, ownerId])

  return null
}

interface DisplayPageState {
  displayPage: 'browser' | 'sound'
  category: string
  categoryIndex: number
  categorySamples: LibrarySample[]
  onOpenSampleBrowser: () => void
  onOpenSoundControls: () => void
  onPreviousCategory: () => void
  onNextCategory: () => void
  onSelectLibrarySample: (sample: LibrarySample) => void
}

function padTenant(props: PadDisplayLauncherProps, sampleBrowser: DisplayPageState): DisplayTenant {
  const { pad } = props
  const update = (changes: Partial<Pick<PadState, 'volume' | 'pitchSemitones' | 'attackMs' | 'releaseMs'>>) => props.onUpdate({
    volume: changes.volume ?? pad.volume,
    pitchSemitones: changes.pitchSemitones ?? pad.pitchSemitones,
    attackMs: changes.attackMs ?? pad.attackMs,
    releaseMs: changes.releaseMs ?? pad.releaseMs,
  })

  if (sampleBrowser.displayPage === 'browser') return {
    id: displayId,
    label: `${pad.label} sample browser`,
    readout: 'BROWSE SAMPLES',
    panel: <>
      <div className="sample-browser-page-nav">
        <button className="sample-browser-folder-step" type="button" aria-label="Previous display page" disabled>‹</button>
        <span>BROWSE SAMPLES</span>
        <button className="sample-browser-folder-step" type="button" aria-label="Open sound controls" onClick={sampleBrowser.onOpenSoundControls}>›</button>
        <output>1 / 2</output>
      </div>
      <div className="sample-browser-folder">
        <button className="sample-browser-folder-step" type="button" aria-label="Previous folder" disabled={sampleBrowser.categoryIndex <= 0} onClick={sampleBrowser.onPreviousCategory}>‹</button>
        <span>FOLDER / {sampleBrowser.category}</span>
        <button className="sample-browser-folder-step" type="button" aria-label="Next folder" disabled={sampleBrowser.categoryIndex >= libraryCategories.length - 1} onClick={sampleBrowser.onNextCategory}>›</button>
      </div>
      <div className="sample-browser-list">
        {sampleBrowser.categorySamples.map((sample) => <div className="sample-browser-row" key={sample.id}>
          <span>{sample.filename.replace('.wav', '')}</span>
          <button className="sample-browser-action" type="button" disabled={!props.audioReady || props.projectBusy || props.loadingLibrarySampleId !== null} onClick={() => void props.onPreviewLibrarySample(sample)}>{props.previewingLibrarySampleId === sample.id ? 'STOP' : 'PLAY'}</button>
          <button className="sample-browser-action" type="button" disabled={!props.audioReady || props.projectBusy || props.loadingLibrarySampleId !== null} aria-pressed={props.selectedLibrarySample?.id === sample.id} onClick={() => sampleBrowser.onSelectLibrarySample(sample)}>SELECT</button>
        </div>)}
      </div>
    </>,
  }

  return {
    id: displayId,
    label: `${pad.label} sound controls`,
    readout: 'SOUND',
    panel: <>
      <div className="sample-browser-page-nav">
        <button className="sample-browser-folder-step" type="button" aria-label="Open sample browser" onClick={sampleBrowser.onOpenSampleBrowser}>‹</button>
        <span>SOUND</span>
        <button className="sample-browser-folder-step" type="button" aria-label="Next display page" disabled>›</button>
        <output>2 / 2</output>
      </div>
      <SoundControl id="pad-display-volume" label="VOLUME" value={pad.volume.toFixed(2)} min="0" max="1" step="0.01" current={pad.volume} onChange={(value) => update({ volume: value })} />
      <SoundControl id="pad-display-pitch" label="PITCH" value={formatPitch(pad.pitchSemitones)} min="-12" max="36" step="1" current={pad.pitchSemitones} onChange={(value) => update({ pitchSemitones: value })} />
      <SoundControl id="pad-display-attack" label="ATTACK" value={`${pad.attackMs} ms`} min="0" max="250" step="1" current={pad.attackMs} onChange={(value) => update({ attackMs: value })} />
      <SoundControl id="pad-display-release" label="RELEASE" value={`${pad.releaseMs} ms`} min="4" max="120" step="1" current={pad.releaseMs} onChange={(value) => update({ releaseMs: value })} />
      <div className="sound-tools-row">
        <span>SCALE / {props.projectKeyLabel}</span>
        <div>
          <button type="button" disabled={!pad.assetId || props.projectBusy} aria-label="Map pads to project scale" onClick={props.onMapToProjectScale}>MAP</button>
          <button type="button" disabled={!pad.assetId} aria-label="Edit sample" onClick={props.onEditSample}>EDIT</button>
          <button type="button" disabled={!pad.fileName} aria-label="Clear pad" onClick={props.onClear}>CLEAR</button>
        </div>
      </div>
    </>,
  }
}

function SoundControl(props: { id: string; label: string; value: string; min: string; max: string; step: string; current: number; onChange: (value: number) => void }) {
  return <label className="sound-control" htmlFor={props.id}>
    <span>{props.label}</span>
    <input id={props.id} type="range" min={props.min} max={props.max} step={props.step} value={props.current} onChange={(event) => props.onChange(Number(event.target.value))} />
    <output htmlFor={props.id}>{props.value}</output>
  </label>
}

function formatPitch(pitchSemitones: number): string {
  return `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`
}
