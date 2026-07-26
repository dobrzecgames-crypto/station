import { useEffect, useMemo, useRef, useState } from 'react'
import type { PadState } from './types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'

interface PadDisplayLauncherProps {
  pad: PadState
  projectBusy: boolean
  projectKeyLabel: string
  onUpdate: (changes: Pick<PadState, 'volume' | 'pitchSemitones'>) => void
  onMapToProjectScale: () => void
  onEditSample: () => void
  onClear: () => void
}

const displayId = 'pad-controls'

/** Keeps per-pad sound settings in the shared display instead of under the pad grid. */
export function PadDisplayLauncher(props: PadDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  const hasOwnedDisplayRef = useRef(false)
  const tenant = useMemo<DisplayTenant>(() => padTenant(props), [props])

  useEffect(() => {
    setDisplayActive(true)
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

function padTenant(props: PadDisplayLauncherProps): DisplayTenant {
  const { pad } = props
  const updateVolume = (volume: number) => props.onUpdate({ volume, pitchSemitones: pad.pitchSemitones })
  const updatePitch = (pitchSemitones: number) => props.onUpdate({ volume: pad.volume, pitchSemitones })

  return {
    id: displayId,
    label: `${pad.label} sound controls`,
    readout: `PADS / ${pad.label} / ${pad.fileName ? 'LOADED' : 'EMPTY'}`,
    panel: <>
      <label className="display-param" htmlFor="pad-display-volume">
        <span className="display-param-label">VOLUME</span>
        <output htmlFor="pad-display-volume">{pad.volume.toFixed(2)}</output>
        <input id="pad-display-volume" type="range" min="0" max="1" step="0.01" value={pad.volume} onChange={(event) => updateVolume(Number(event.target.value))} />
      </label>
      <label className="display-param" htmlFor="pad-display-pitch">
        <span className="display-param-label">PITCH</span>
        <output htmlFor="pad-display-pitch">{formatPitch(pad.pitchSemitones)}</output>
        <input id="pad-display-pitch" type="range" min="-12" max="36" step="1" value={pad.pitchSemitones} onChange={(event) => updatePitch(Number(event.target.value))} />
      </label>
      <div className="display-param">
        <span className="display-param-label">PROJECT SCALE</span>
        <output>{props.projectKeyLabel}</output>
        <div className="display-actions">
          <button className="display-action" type="button" disabled={!pad.assetId || props.projectBusy} onClick={props.onMapToProjectScale}>MAP PADS</button>
          <button className="display-action" type="button" disabled={!pad.assetId} onClick={props.onEditSample}>EDIT SAMPLE</button>
          <button className="display-action display-action-danger" type="button" disabled={!pad.fileName} onClick={props.onClear}>CLEAR PAD</button>
        </div>
      </div>
    </>,
  }
}

function formatPitch(pitchSemitones: number): string {
  return `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`
}
