import { useEffect, useMemo, useRef } from 'react'
import { DisplayRange } from '../shell/displayControls'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import type { TempoDetectionResult } from './tempoDetection'

interface ChopDisplayLauncherProps {
  hasSource: boolean
  cutOnPadTrigger: boolean
  onCutOnPadTriggerChange: (enabled: boolean) => void
  sourcePitchSemitones: number
  onSourcePitchChange: (pitchSemitones: number) => void
  /** null until the source-load analysis finishes (see App.tsx) - distinct
      from a finished analysis that found no usable pulse (`tempo.bpm===null`). */
  tempo: TempoDetectionResult | null
  onApplyTempo: () => void
}

const displayId = 'chop-controls'

function formatSourcePitch(pitchSemitones: number): string {
  return `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`
}

/** Never a specific number presented as certain when it isn't one - a still-
    running analysis and a finished-but-pulseless one are shown as distinctly
    unusable, not as "0 BPM" or some other number that reads as a real result. */
function formatTempo(tempo: TempoDetectionResult | null): string {
  if (!tempo) return 'ANALYZING…'
  if (tempo.bpm === null) return 'NO CLEAR PULSE'
  return `${tempo.bpm} · ${tempo.confidence.toUpperCase()}`
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
  const onApplyTempoRef = useRef(props.onApplyTempo)
  onCutOnPadTriggerChangeRef.current = props.onCutOnPadTriggerChange
  onSourcePitchChangeRef.current = props.onSourcePitchChange
  onApplyTempoRef.current = props.onApplyTempo

  const tenant = useMemo<DisplayTenant>(() => chopTenant({
    hasSource: props.hasSource,
    cutOnPadTrigger: props.cutOnPadTrigger,
    sourcePitchSemitones: props.sourcePitchSemitones,
    tempo: props.tempo,
    onCutOnPadTriggerChange: (enabled) => onCutOnPadTriggerChangeRef.current(enabled),
    onSourcePitchChange: (pitchSemitones) => onSourcePitchChangeRef.current(pitchSemitones),
    onApplyTempo: () => onApplyTempoRef.current(),
  }), [props.hasSource, props.cutOnPadTrigger, props.sourcePitchSemitones, props.tempo])

  useEffect(() => { claim(tenant) }, [claim, tenant])
  useEffect(() => () => release(displayId), [release])

  return null
}

interface ChopTenantProps {
  hasSource: boolean
  cutOnPadTrigger: boolean
  sourcePitchSemitones: number
  tempo: TempoDetectionResult | null
  onCutOnPadTriggerChange: (enabled: boolean) => void
  onSourcePitchChange: (pitchSemitones: number) => void
  onApplyTempo: () => void
}

function chopTenant(props: ChopTenantProps): DisplayTenant {
  const { cutOnPadTrigger, sourcePitchSemitones, tempo } = props
  return {
    id: displayId,
    label: 'LASER',
    readout: `${cutOnPadTrigger ? 'ONE PAD' : 'ALL PADS'} · PITCH ${formatSourcePitch(sourcePitchSemitones)}${props.hasSource ? ` · BPM ${tempo?.bpm ?? '--'}` : ''}`,
    panel: <>
      <button className="display-toggle" type="button" role="switch" aria-label="ONE PAD AT A TIME" aria-checked={cutOnPadTrigger} onClick={() => props.onCutOnPadTriggerChange(!cutOnPadTrigger)}>
        <span className="display-param-label">ONE PAD AT A TIME</span>
        <span className="display-toggle-value" aria-hidden="true">{cutOnPadTrigger ? 'ON' : 'OFF'}</span>
      </button>
      {/* Seeds a pad's pitch only on the way onto the grid - a pad already cut
          keeps whatever pitch it has, so a later per-pad tweak in PAD survives
          further re-slicing. See applyChopMapping. */}
      <DisplayRange idPrefix="chop-display" label="SOURCE PITCH" formatValue={formatSourcePitch} min="-12" max="36" step="1" current={sourcePitchSemitones} disabled={!props.hasSource} onChange={props.onSourcePitchChange} />
      {/* Read-only until APPLY - detectTempo never sets the transport's BPM
          itself (see App.tsx's applyDetectedTempo), so a detected reading is
          only ever a suggestion the user commits to on purpose. */}
      <p className="display-param">
        <span className="display-param-label">DETECTED BPM</span>
        <output>{props.hasSource ? formatTempo(tempo) : '--'}</output>
      </p>
      <div className="display-actions">
        <button className="display-action" type="button" disabled={!tempo?.bpm} onClick={props.onApplyTempo}>APPLY BPM</button>
      </div>
    </>,
  }
}
