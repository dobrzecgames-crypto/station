import { useEffect, useMemo, useRef, useState } from 'react'
import { delayDivisionBeats } from '../audio/effects'
import { sameGroupPadReference } from '../audio/channelIdentity'
import type { GroupPadReference } from '../audio/channelIdentity'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'

type PumpCurve = 'snap' | 'smooth' | 'swell'

interface PumpDisplayLauncherProps {
  patternGroupId: string
  padId: string
  padLabel: string
  source: GroupPadReference | null
  targets: readonly GroupPadReference[]
  depth: number
  lengthBeats: number
  curve: PumpCurve
  onSourceChange: (source: GroupPadReference) => void
  onTargetsChange: (update: (targets: GroupPadReference[]) => GroupPadReference[]) => void
  onDepthChange: (depth: number) => void
  onLengthChange: (beats: number) => void
  onCurveChange: (curve: PumpCurve) => void
}

const displayId = 'pump-controls'
const lengthChoices = ['1/2', '1/4', '1/8', '1/16'] as const
const curveLabels: Record<PumpCurve, string> = { snap: 'PUNCH', smooth: 'GLIDE', swell: 'SMASH' }

/** A compact MIX entry point that moves Pump controls into the shared display. */
export function PumpDisplayLauncher(props: PumpDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [open, setOpen] = useState(false)
  const hasOwnedDisplayRef = useRef(false)
  const selectedPad = useMemo<GroupPadReference>(() => ({ patternGroupId: props.patternGroupId, padId: props.padId }), [props.patternGroupId, props.padId])
  const isSource = sameGroupPadReference(props.source, selectedPad)
  const isTarget = props.targets.some((target) => sameGroupPadReference(target, selectedPad))

  const tenant = useMemo(() => pumpTenant({ ...props, selectedPad, isSource, isTarget }), [
    props.patternGroupId,
    props.padId,
    props.padLabel,
    props.source,
    props.targets,
    props.depth,
    props.lengthBeats,
    props.curve,
    props.onSourceChange,
    props.onTargetsChange,
    props.onDepthChange,
    props.onLengthChange,
    props.onCurveChange,
    selectedPad,
    isSource,
    isTarget,
  ])

  useEffect(() => {
    if (open) claim(tenant)
    else release(displayId)
  }, [open, tenant, claim, release])

  useEffect(() => () => release(displayId), [release])

  useEffect(() => {
    if (!open) {
      hasOwnedDisplayRef.current = false
      return
    }
    if (ownerId === displayId) {
      hasOwnedDisplayRef.current = true
      return
    }
    if (hasOwnedDisplayRef.current && ownerId !== null) setOpen(false)
  }, [open, ownerId])

  return <button className={open ? 'mix-pump-entry mix-pump-entry-active' : 'mix-pump-entry'} type="button" aria-pressed={open} onClick={() => setOpen((current) => !current)}>
    <span>PUMP</span>
    <strong>{isTarget ? 'ON' : 'OFF'}</strong>
    <small>{props.padLabel}</small>
  </button>
}

type PumpTenantProps = PumpDisplayLauncherProps & { selectedPad: GroupPadReference; isSource: boolean; isTarget: boolean }

function pumpTenant(props: PumpTenantProps): DisplayTenant {
  const toggleTarget = () => props.onTargetsChange((targets) => props.isTarget
    ? targets.filter((target) => !sameGroupPadReference(target, props.selectedPad))
    : [...targets, props.selectedPad],
  )

  return {
    id: displayId,
    label: 'Pump controls',
    readout: `PUMP · ${props.padLabel} · ${props.isTarget ? `${Math.round(props.depth * 100)}%` : 'OFF'}`,
    panel: <>
      <button className="display-toggle" type="button" aria-label={`Set ${props.padLabel} as kick source`} onClick={() => props.onSourceChange(props.selectedPad)}>
        <span className="display-param-label">KICK SOURCE</span>
        <span className="display-toggle-value">{props.isSource ? `${props.padLabel} ACTIVE` : `SET ${props.padLabel}`}</span>
      </button>
      <button className="display-toggle" type="button" role="switch" aria-label={`Pump ${props.padLabel}`} aria-checked={props.isTarget} onClick={toggleTarget}>
        <span className="display-param-label">PUMP THIS PAD</span>
        <span className="display-toggle-value" aria-hidden="true">{props.isTarget ? 'ON' : 'OFF'}</span>
      </button>
      <label className="display-param" htmlFor="pump-depth">
        <span className="display-param-label">DEPTH</span>
        <output htmlFor="pump-depth">{Math.round(props.depth * 100)}%</output>
        <input id="pump-depth" type="range" min="0" max="1" step="0.01" value={props.depth} onChange={(event) => props.onDepthChange(Number(event.target.value))} />
      </label>
      <div className="display-param">
        <span className="display-param-label">LENGTH</span>
        <div className="display-actions">
          {lengthChoices.map((division) => <button className={props.lengthBeats === delayDivisionBeats[division] ? 'display-action display-action-active' : 'display-action'} key={division} type="button" aria-pressed={props.lengthBeats === delayDivisionBeats[division]} onClick={() => props.onLengthChange(delayDivisionBeats[division])}>{division}</button>)}
        </div>
      </div>
      <div className="display-param">
        <span className="display-param-label">SHAPE</span>
        <div className="display-actions">
          {(Object.keys(curveLabels) as PumpCurve[]).map((curve) => <button className={props.curve === curve ? 'display-action display-action-active' : 'display-action'} key={curve} type="button" aria-pressed={props.curve === curve} onClick={() => props.onCurveChange(curve)}>{curveLabels[curve]}</button>)}
        </div>
      </div>
    </>,
  }
}
