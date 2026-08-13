import { useEffect, useMemo, useRef, useState } from 'react'
import type { PadState } from './types'
import { builtInLibrary, libraryCategories } from '../library/builtInLibrary'
import type { LibrarySample } from '../library/builtInLibrary'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { useDragSlider } from '../shell/useDragSlider'
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
  onOpenLibrarySampleInChop: (sample: LibrarySample) => Promise<void>
  onSelectedLibrarySampleChange: (sample: LibrarySample | null) => void
  onMapToProjectScale: () => void
  onEditSample: () => void
  onClear: () => void
}

const displayId = 'pad-controls'

/** The library sample currently sitting on a pad, matched on the filename the
    loader copies across. Null for anything the built-in library did not put
    there - a chopped slice or a file the user opened. */
function loadedLibrarySample(pad: PadState): LibrarySample | null {
  if (!pad.fileName) return null
  return builtInLibrary.find((sample) => sample.filename === pad.fileName) ?? null
}

/** Keeps per-pad sound settings in the shared display instead of under the pad grid. */
export function PadDisplayLauncher(props: PadDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  /* The sound controls used to be a second display page reached through a
     `‹ 1 / 2 ›` pager. That pager was a whole row of chrome whose only job was
     to say a second page existed, and nothing on the first page hinted at what
     was on it. Now the controls hang off the row of the sample that is actually
     on this pad, so the way in is the thing being edited. */
  const [soundOpen, setSoundOpen] = useState(false)
  const [categoryIndex, setCategoryIndex] = useState(0)
  const hasOwnedDisplayRef = useRef(false)
  const category = libraryCategories[categoryIndex]
  const categorySamples = builtInLibrary.filter((sample) => sample.category === category)
  const padSample = loadedLibrarySample(props.pad)
  /* App recreates its event handlers on each render. Depending on the whole
     props object would therefore re-claim the display after the claim itself
     updates App, creating a render loop, so the dependency list below carries
     only the values rendered here. Leaving the handlers out of it is not enough
     on its own: the tenant would keep calling whichever copy existed when it
     was last built. onClear and onMapToProjectScale close over the whole
     pattern group list, and MAP rewrites the other pads without touching any of
     those dependencies - a CLEAR afterwards would put the bank back as it stood
     before the mapping. Calling through a ref keeps them current. Same shape as
     EffectDisplay and BusDisplay. */
  const latestPropsRef = useRef(props)
  latestPropsRef.current = props
  const handlers = useMemo(() => ({
    onUpdate: (changes: Pick<PadState, 'volume' | 'pitchSemitones' | 'attackMs' | 'releaseMs'>) => latestPropsRef.current.onUpdate(changes),
    onPreviewLibrarySample: (sample: LibrarySample) => latestPropsRef.current.onPreviewLibrarySample(sample),
    onOpenLibrarySampleInChop: (sample: LibrarySample) => latestPropsRef.current.onOpenLibrarySampleInChop(sample),
    onSelectedLibrarySampleChange: (sample: LibrarySample | null) => latestPropsRef.current.onSelectedLibrarySampleChange(sample),
    onMapToProjectScale: () => latestPropsRef.current.onMapToProjectScale(),
    onEditSample: () => latestPropsRef.current.onEditSample(),
    onClear: () => latestPropsRef.current.onClear(),
  }), [])
  const selectLibrarySample = (sample: LibrarySample) => handlers.onSelectedLibrarySampleChange(
    latestPropsRef.current.selectedLibrarySample?.id === sample.id ? null : sample,
  )
  const tenant = useMemo<DisplayTenant>(() => padTenant({ ...props, ...handlers }, {
    category,
    categoryIndex,
    categorySamples,
    padSample,
    soundOpen,
    onToggleSound: () => setSoundOpen((open) => !open),
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
    soundOpen,
    category,
    categoryIndex,
    padSample,
    handlers,
  ])

  /* Switching pads lands you in the folder the pad's own sound came from, so
     the row carrying EDIT is on screen instead of three folders away. A pad
     holding a chop or an opened file has no folder to follow - that one keeps
     whichever folder was already open and reaches its controls through the
     pinned row below the list. */
  useEffect(() => {
    setDisplayActive(true)
    setSoundOpen(false)
    const sample = loadedLibrarySample(props.pad)
    if (sample) setCategoryIndex(libraryCategories.indexOf(sample.category))
  }, [props.pad.id])

  /* CLEAR empties the pad from the sound screen itself, which leaves that
     screen describing a sound that is gone. Fall back to the browser instead of
     stranding it. */
  useEffect(() => {
    if (!props.pad.fileName) setSoundOpen(false)
  }, [props.pad.fileName])

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
  category: string
  categoryIndex: number
  categorySamples: LibrarySample[]
  /** The library sample on this pad, or null when nothing from the library is. */
  padSample: LibrarySample | null
  soundOpen: boolean
  onToggleSound: () => void
  onPreviousCategory: () => void
  onNextCategory: () => void
  onSelectLibrarySample: (sample: LibrarySample) => void
}

function padTenant(props: PadDisplayLauncherProps, browser: DisplayPageState): DisplayTenant {
  const { pad } = props
  const update = (changes: Partial<Pick<PadState, 'volume' | 'pitchSemitones' | 'attackMs' | 'releaseMs'>>) => props.onUpdate({
    volume: changes.volume ?? pad.volume,
    pitchSemitones: changes.pitchSemitones ?? pad.pitchSemitones,
    attackMs: changes.attackMs ?? pad.attackMs,
    releaseMs: changes.releaseMs ?? pad.releaseMs,
  })

  /* The sound screen. Still a second screen rather than rows unfolded into the
     list: shaping an envelope is its own job, and doing it with the browser
     still under your thumb leaves neither enough room. What went away is the
     `‹ 1 / 2 ›` pager that used to sit above both screens - a row of chrome
     whose only content was the news that a second screen existed. EDIT is the
     way in now, and it appears only on a sample that is really on the pad,
     because that is the only sound there is anything to shape. */
  if (browser.soundOpen && pad.fileName) return {
    id: displayId,
    label: `${pad.label} sound controls`,
    readout: `SOUND / ${trimExtension(pad.fileName)}`,
    panel: <>
      {/* Takes the folder row's place rather than stacking on top of it, so
          both screens carry exactly one row of chrome. */}
      <div className="sample-browser-folder">
        <button className="sample-browser-folder-step" type="button" aria-label="Back to sample browser" onClick={browser.onToggleSound}>‹</button>
        <span>{pad.label} / {trimExtension(pad.fileName)}</span>
        <span aria-hidden="true" />
      </div>
      <SoundControl id="pad-display-volume" label="VOLUME" formatValue={(value) => value.toFixed(2)} min="0" max="1" step="0.01" current={pad.volume} onChange={(value) => update({ volume: value })} />
      <SoundControl id="pad-display-pitch" label="PITCH" formatValue={formatPitch} min="-12" max="36" step="1" current={pad.pitchSemitones} onChange={(value) => update({ pitchSemitones: value })} />
      <SoundControl id="pad-display-attack" label="ATTACK" formatValue={(value) => `${value} ms`} min="0" max="250" step="1" current={pad.attackMs} onChange={(value) => update({ attackMs: value })} />
      <SoundControl id="pad-display-release" label="RELEASE" formatValue={(value) => `${value} ms`} min="4" max="120" step="1" current={pad.releaseMs} onChange={(value) => update({ releaseMs: value })} />
      <div className="sound-tools-row">
        <span>SCALE / {props.projectKeyLabel}</span>
        <div>
          <button type="button" disabled={!pad.assetId || props.projectBusy} aria-label="Map pads to project scale" onClick={props.onMapToProjectScale}>MAP</button>
          {/* Was also called EDIT, which left two of them one tap apart once
              EDIT became the way onto this screen. This one opens the start/end
              region, so it says what it does. */}
          <button type="button" disabled={!pad.assetId} aria-label="Trim sample region" onClick={props.onEditSample}>TRIM</button>
          <button type="button" disabled={!pad.fileName} aria-label="Clear pad" onClick={props.onClear}>CLEAR</button>
        </div>
      </div>
    </>,
  }

  const editButton = <button
    className="sample-browser-action"
    type="button"
    aria-label={`Sound controls for ${pad.label}`}
    onClick={browser.onToggleSound}
  >EDIT</button>

  /* The pad's own sound has to stay reachable whatever the list is showing.
     Two ways it drops out of the list: the pad holds something the library
     never had - a chopped slice, a file opened from disk - or it holds a
     library sample from a folder you have since browsed away from. Either way
     it gets a row under the list, and only then. Without this, stepping from
     KICK to SNARE took the open envelope off screen while the line still read
     SOUND / Kick 02. */
  const padSampleInList = browser.padSample != null && browser.categorySamples.some((sample) => sample.id === browser.padSample!.id)
  const showsPinnedRow = pad.fileName != null && !padSampleInList

  return {
    id: displayId,
    label: `${pad.label} sample browser`,
    readout: 'BROWSE SAMPLES',
    panel: <>
      <div className="sample-browser-folder">
        <button className="sample-browser-folder-step" type="button" aria-label="Previous folder" disabled={browser.categoryIndex <= 0} onClick={browser.onPreviousCategory}>‹</button>
        <span>FOLDER / {browser.category}</span>
        <button className="sample-browser-folder-step" type="button" aria-label="Next folder" disabled={browser.categoryIndex >= libraryCategories.length - 1} onClick={browser.onNextCategory}>›</button>
      </div>
      <div className="sample-browser-list">
        {browser.categorySamples.map((sample) => {
          const isOnPad = browser.padSample?.id === sample.id
          return <div className={isOnPad ? 'sample-browser-row sample-browser-row-loaded' : 'sample-browser-row'} key={sample.id}>
            <span>{trimExtension(sample.filename)}</span>
            <button className="sample-browser-action" type="button" disabled={!props.audioReady || props.projectBusy || props.loadingLibrarySampleId !== null} onClick={() => void props.onPreviewLibrarySample(sample)}>{props.previewingLibrarySampleId === sample.id ? 'STOP' : 'PLAY'}</button>
            {/* The sample already on this pad has nothing to arm - the useful
                move on it is shaping what you hear, so its second button is the
                way onto the sound screen rather than a SELECT that changes
                nothing. */}
            {sample.category === 'BREAKS'
              ? <button className="sample-browser-action" type="button" disabled={!props.audioReady || props.projectBusy || props.loadingLibrarySampleId !== null} onClick={() => void props.onOpenLibrarySampleInChop(sample)}>{props.loadingLibrarySampleId === sample.id ? 'OPENING…' : 'CHOP'}</button>
              : isOnPad ? editButton : <button className="sample-browser-action" type="button" disabled={!props.audioReady || props.projectBusy || props.loadingLibrarySampleId !== null} aria-pressed={props.selectedLibrarySample?.id === sample.id} onClick={() => browser.onSelectLibrarySample(sample)}>SELECT</button>}
          </div>
        })}
        {showsPinnedRow && <div className="sample-browser-row sample-browser-row-loaded">
          <span>{trimExtension(pad.fileName!)}</span>
          <span className="sample-browser-origin">ON PAD</span>
          {editButton}
        </div>}
      </div>
    </>,
  }
}

function SoundControl(props: { id: string; label: string; formatValue: (value: number) => string; min: string; max: string; step: string; current: number; onChange: (value: number) => void }) {
  const drag = useDragSlider({
    value: props.current,
    min: Number(props.min),
    max: Number(props.max),
    step: Number(props.step),
    onChange: props.onChange,
    focusLabel: props.label,
    formatValue: props.formatValue,
  })
  return <label className="sound-control" htmlFor={props.id}>
    <span>{props.label}</span>
    <input id={props.id} type="range" min={props.min} max={props.max} step={props.step} value={props.current} {...drag.inputProps} />
    <output htmlFor={props.id}>{props.formatValue(props.current)}</output>
  </label>
}

function trimExtension(filename: string): string {
  return filename.replace(/\.wav$/i, '')
}

function formatPitch(pitchSemitones: number): string {
  return `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`
}
