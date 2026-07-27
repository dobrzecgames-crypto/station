import { useEffect, useMemo, useRef } from 'react'
import { DisplayRange } from '../shell/displayControls'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'

interface ChopDisplayLauncherProps {
  hasSource: boolean
  cutOnPadTrigger: boolean
  onCutOnPadTriggerChange: (enabled: boolean) => void
  sourcePitchSemitones: number
  onSourcePitchChange: (pitchSemitones: number) => void
}

const displayId = 'chop-controls'

function formatSourcePitch(pitchSemitones: number): string {
  return `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`
}

/** CHOP's own settings on the shared display, the same way MIX reaches the bus
 *  and PAD reaches its sound controls, rather than a toggle and a slider built
 *  to fit the workspace panel on their own.
 *
 *  claims unconditionally while the CHOP tab is open - nothing else in this
 *  workspace competes for the screen the way an FX slot competes with its bus. */
export function ChopDisplayLauncher(props: ChopDisplayLauncherProps) {
  const { claim, release } = useSystemDisplay()
  const onCutOnPadTriggerChangeRef = useRef(props.onCutOnPadTriggerChange)
  const onSourcePitchChangeRef = useRef(props.onSourcePitchChange)
  onCutOnPadTriggerChangeRef.current = props.onCutOnPadTriggerChange
  onSourcePitchChangeRef.current = props.onSourcePitchChange

  const tenant = useMemo<DisplayTenant>(() => chopTenant({
    hasSource: props.hasSource,
    cutOnPadTrigger: props.cutOnPadTrigger,
    sourcePitchSemitones: props.sourcePitchSemitones,
    onCutOnPadTriggerChange: (enabled) => onCutOnPadTriggerChangeRef.current(enabled),
    onSourcePitchChange: (pitchSemitones) => onSourcePitchChangeRef.current(pitchSemitones),
  }), [props.hasSource, props.cutOnPadTrigger, props.sourcePitchSemitones])

  useEffect(() => { claim(tenant) }, [claim, tenant])
  useEffect(() => () => release(displayId), [release])

  return null
}

interface ChopTenantProps {
  hasSource: boolean
  cutOnPadTrigger: boolean
  sourcePitchSemitones: number
  onCutOnPadTriggerChange: (enabled: boolean) => void
  onSourcePitchChange: (pitchSemitones: number) => void
}

function chopTenant(props: ChopTenantProps): DisplayTenant {
  const { cutOnPadTrigger, sourcePitchSemitones } = props
  return {
    id: displayId,
    label: 'CHOP',
    readout: `${cutOnPadTrigger ? 'ONE PAD' : 'ALL PADS'} · PITCH ${formatSourcePitch(sourcePitchSemitones)}`,
    panel: <>
      <button className="display-toggle" type="button" role="switch" aria-label="ONE PAD AT A TIME" aria-checked={cutOnPadTrigger} onClick={() => props.onCutOnPadTriggerChange(!cutOnPadTrigger)}>
        <span className="display-param-label">ONE PAD AT A TIME</span>
        <span className="display-toggle-value" aria-hidden="true">{cutOnPadTrigger ? 'ON' : 'OFF'}</span>
      </button>
      {/* Seeds a pad's pitch only on the way onto the grid - a pad already cut
          keeps whatever pitch it has, so a later per-pad tweak in PAD survives
          further re-slicing. See applyChopMapping. */}
      <DisplayRange idPrefix="chop-display" label="SOURCE PITCH" value={formatSourcePitch(sourcePitchSemitones)} min="-12" max="36" step="1" current={sourcePitchSemitones} disabled={!props.hasSource} onChange={props.onSourcePitchChange} />
    </>,
  }
}
