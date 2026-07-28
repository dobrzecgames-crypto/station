import { useEffect, useMemo, useRef, useState } from 'react'
import { formatProjectKey, noteNames, scaleDefinitions, scaleIds } from '../music/scales'
import type { ProjectKey } from '../music/scales'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import type { RenderSongResult } from './renderSong'
import './projectDisplay.css'

interface ProjectDisplayButtonProps {
  projectKey: ProjectKey
  projectBusy: boolean
  audioReady: boolean
  renderProgress: number | null
  soloActive: boolean
  hotRender: RenderSongResult | null
  onProjectKeyChange: (projectKey: ProjectKey) => void
  onSave: () => void
  onOpen: () => void
  onRender: () => void
  onCancelRender: () => void
  onDownloadTrimmed: () => void
  onDownloadOriginal: () => void
}

const displayId = 'project-controls'

export function ProjectDisplayButton(props: ProjectDisplayButtonProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [active, setActive] = useState(false)
  const hasOwnedDisplayRef = useRef(false)
  const latestPropsRef = useRef(props)
  latestPropsRef.current = props

  const handlers = useMemo(() => ({
    onProjectKeyChange: (projectKey: ProjectKey) => latestPropsRef.current.onProjectKeyChange(projectKey),
    onSave: () => latestPropsRef.current.onSave(),
    onOpen: () => latestPropsRef.current.onOpen(),
    onRender: () => latestPropsRef.current.onRender(),
    onCancelRender: () => latestPropsRef.current.onCancelRender(),
    onDownloadTrimmed: () => latestPropsRef.current.onDownloadTrimmed(),
    onDownloadOriginal: () => latestPropsRef.current.onDownloadOriginal(),
  }), [])

  const tenant = useMemo<DisplayTenant>(() => projectTenant({ ...props, ...handlers }), [
    props.projectKey.root,
    props.projectKey.scale,
    props.projectBusy,
    props.audioReady,
    props.renderProgress,
    props.soloActive,
    props.hotRender,
    handlers,
  ])

  useEffect(() => {
    if (active) claim(tenant)
    else release(displayId)
  }, [active, tenant, claim, release])

  useEffect(() => () => release(displayId), [release])

  useEffect(() => {
    if (!active) {
      hasOwnedDisplayRef.current = false
      return
    }
    if (ownerId === displayId) {
      hasOwnedDisplayRef.current = true
      return
    }
    if (hasOwnedDisplayRef.current && ownerId !== null) setActive(false)
  }, [active, ownerId])

  return <button
    className={`mixer-toggle project-display-trigger${active ? ' mixer-toggle-active' : ''}`}
    type="button"
    aria-pressed={active}
    aria-label="Project controls"
    onClick={() => setActive((current) => !current)}
  >
    PROJECT
  </button>
}

function projectTenant(props: ProjectDisplayButtonProps): DisplayTenant {
  const renderBusy = props.renderProgress !== null
  const progressPercent = Math.round((props.renderProgress ?? 0) * 100)
  const hotPeak = props.hotRender?.peak ?? 0

  return {
    id: displayId,
    label: 'Project controls',
    readout: renderBusy ? `PROJECT / RENDER / ${progressPercent}%` : `PROJECT / ${formatProjectKey(props.projectKey)}`,
    panel: <>
      <label className="project-display-select">
        <span>ROOT</span>
        <select
          value={props.projectKey.root}
          disabled={props.projectBusy}
          onChange={(event) => props.onProjectKeyChange({ ...props.projectKey, root: event.target.value as ProjectKey['root'] })}
        >
          {noteNames.map((note) => <option key={note} value={note}>{note}</option>)}
        </select>
      </label>
      <label className="project-display-select">
        <span>SCALE</span>
        <select
          value={props.projectKey.scale}
          disabled={props.projectBusy}
          onChange={(event) => props.onProjectKeyChange({ ...props.projectKey, scale: event.target.value as ProjectKey['scale'] })}
        >
          {scaleIds.map((scaleId) => <option key={scaleId} value={scaleId}>{scaleDefinitions[scaleId].label}</option>)}
        </select>
      </label>
      <div className="display-param">
        <span className="display-param-label">PROJECT FILE</span>
        <div className="display-actions">
          <button className="display-action" type="button" disabled={props.projectBusy} onClick={props.onSave}>SAVE</button>
          <button className="display-action" type="button" disabled={!props.audioReady || props.projectBusy} onClick={props.onOpen}>OPEN</button>
        </div>
      </div>
      <div className="display-param">
        <span className="display-param-label">SONG FILE</span>
        <div className="display-actions">
          {renderBusy
            ? <button className="display-action display-action-danger" type="button" onClick={props.onCancelRender}>CANCEL</button>
            : <button className="display-action" type="button" disabled={!props.audioReady || props.projectBusy} onClick={props.onRender}>RENDER</button>}
        </div>
        {renderBusy && <div className="project-display-progress" aria-label={`Render progress ${progressPercent}%`}>
          <span style={{ width: `${progressPercent}%` }} />
        </div>}
      </div>
      {props.soloActive && !renderBusy && <p className="project-display-note">SOLO IS LATCHED / RENDER CONTAINS SOLOED CHANNELS ONLY</p>}
      {props.hotRender && <div className="project-display-result">
        <p>PEAK {formatDbfs(hotPeak)} / {props.hotRender.clippedSampleCount.toLocaleString()} CLIPPED SAMPLES</p>
        <div className="display-actions">
          <button className="display-action" type="button" onClick={props.onDownloadTrimmed}>TRIM {formatDb(trimGainFor(hotPeak))}</button>
          <button className="display-action" type="button" onClick={props.onDownloadOriginal}>1:1</button>
        </div>
      </div>}
    </>,
  }
}

function formatDbfs(peak: number): string {
  if (peak <= 0) return '-INF dBFS'
  return `${(20 * Math.log10(peak)).toFixed(1)} dBFS`
}

function formatDb(gain: number): string {
  if (gain <= 0) return '-INF dB'
  return `${(20 * Math.log10(gain)).toFixed(1)} dB`
}

function trimGainFor(peak: number): number {
  return peak > 1 ? 1 / peak : 1
}
