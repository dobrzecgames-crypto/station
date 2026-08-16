import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
import { useRotaryDrag } from '../shell/useRotaryDrag'
import { LatchKey, MomentaryKey } from '../shell/UtilityKey'
import { UserSynthPresetControls } from '../synth-presets/UserSynthPresetControls'
import { organicBassCutoffHz, organicBassDecaySeconds, organicBassGlideSeconds } from './organicBassOperations'
import type { OrganicBassPatch } from './organicBassTypes'
import './OrganicBassWorkspace.css'

interface OrganicBassWorkspaceProps {
  pad: PadState
  patch: OrganicBassPatch
  usageCount: number
  audioReady: boolean
  projectBusy: boolean
  projectKeyLabel: string
  onPatchChange: (patch: OrganicBassPatch) => void
  onTrigger: () => void
  onRelease: () => void
  onMapToProjectScale: () => void
  onClear: () => void
  onBack: () => void
}

/**
 * MONOGORG's own control surface, and the third construction in the range:
 * DRUM SYNTH is a bank of vertical throws in a raised bay, BASSIC is grooves cut
 * across a one-piece face, and this is a soft dark plate with inlaid channels -
 * flush, no cap standing proud of the surface - and one large turning knob.
 *
 * DRIVE leads the panel. It is the character control and the one you reach for
 * while playing, so it takes the top of the plate rather than its place in the
 * signal chain. Being the one round part here, and a big one, it can afford the
 * gesture its shape promises - see useRotaryDrag.
 */
export function OrganicBassWorkspace(props: OrganicBassWorkspaceProps) {
  const { pad, patch } = props
  const [patchPanelOpen, setPatchPanelOpen] = useState(false)
  const onReleaseRef = useRef(props.onRelease)
  onReleaseRef.current = props.onRelease
  useEffect(() => () => onReleaseRef.current(), [])
  const change = (changes: Partial<OrganicBassPatch>) => props.onPatchChange({ ...patch, ...changes })

  return (
    <section className="organic-bass-workspace" aria-label={`MONOGORG editor for ${pad.label}`}>
      <header className="organic-bass-heading">
        <p className="eyebrow">{pad.label} / {props.usageCount} PAD{props.usageCount === 1 ? '' : 'S'} SHARE PATCH / MONO</p>
        <div className="organic-bass-heading-identity">
          <div className="organic-bass-nameplate">
            <span className="organic-bass-nameplate-mark" aria-hidden="true">GORG</span>
            <h2>{patch.name}</h2>
          </div>
          <div className="organic-bass-heading-keys">
            <MomentaryKey label="← SYNTHS" ariaLabel="Back to synths" onClick={props.onBack} />
            <LatchKey label="PATCH" engaged={patchPanelOpen} onClick={() => setPatchPanelOpen((current) => !current)} />
          </div>
        </div>
        <button
          className="organic-bass-audition"
          type="button"
          disabled={!props.audioReady}
          aria-label="Hold to play MONOGORG"
          title="Hold to play"
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            props.onTrigger()
          }}
          onPointerUp={props.onRelease}
          onPointerCancel={props.onRelease}
          onLostPointerCapture={props.onRelease}
        />
      </header>

      {patchPanelOpen && <div className="organic-bass-patch-panel station-card" aria-label="MONOGORG patch storage">
        <UserSynthPresetControls kind="monogorg" instrumentLabel="MONOGORG" patch={patch} onApply={props.onPatchChange} />
      </div>}

      <div className="mg-drive">
        <DriveKnob value={patch.drive} onChange={(drive) => change({ drive })} />
      </div>

      <Stage>
        <Channel stage="TONE" label="SHAPE" value={patch.shape} format={percent} onChange={(shape) => change({ shape })} />
        <Channel label="WEIGHT" value={patch.weight} format={percent} onChange={(weight) => change({ weight })} />
      </Stage>

      <Stage>
        <Channel stage="FILTER" label="CUTOFF" value={patch.cutoff} format={(value) => formatFrequency(organicBassCutoffHz(value))} onChange={(cutoff) => change({ cutoff })} />
        <Channel label="RESO" value={patch.resonance} format={percent} onChange={(resonance) => change({ resonance })} />
        <Channel label="CONTOUR" value={patch.contour} format={percent} onChange={(contour) => change({ contour })} />
      </Stage>

      <Stage>
        <Channel stage="ENV" label="ATTACK" value={patch.attackSeconds} min={0} max={0.12} step={0.001} format={formatSeconds} onChange={(attackSeconds) => change({ attackSeconds })} />
        <Channel label="DECAY" value={patch.decay} format={(value) => formatSeconds(organicBassDecaySeconds(value))} onChange={(decay) => change({ decay })} />
        <Channel label="GLIDE" value={patch.glide} format={(value) => formatSeconds(organicBassGlideSeconds(value))} onChange={(glide) => change({ glide })} />
      </Stage>

      <div className="organic-bass-tools sound-tools-row">
        <span>SCALE / {props.projectKeyLabel}</span>
        <div>
          <button type="button" disabled={props.projectBusy} onClick={props.onMapToProjectScale}>MAP</button>
          <button type="button" onClick={props.onClear}>CLEAR</button>
        </div>
      </div>
    </section>
  )
}

function Stage({ children }: { children: ReactNode }) {
  return <div className="mg-stage-group">{children}</div>
}

/**
 * One inlaid channel: the stage name in the left margin (printed once per group,
 * the way a rack panel annotates its sections), then the parameter's own name,
 * the channel, and the value.
 *
 * The whole row is the hit target, not just the channel - a 350px by 34px band
 * for a thumb, against the 109px slider this replaced. The drag stays relative,
 * so landing anywhere on the row never jumps the value to that spot.
 */
function Channel({ stage, label, value, min = 0, max = 1, step = 0.01, format, onChange }: {
  stage?: string
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  const drag = useDragSlider({ value, min, max, step, onChange, focusLabel: label, formatValue: format })
  const position = (value - min) / (max - min)
  return (
    <label className="mg-channel">
      <input type="range" value={value} min={min} max={max} step={step} {...drag.inputProps} />
      <span className="mg-stage">{stage ?? ''}</span>
      <span className="mg-channel-legend">{label}</span>
      <span className="mg-channel-slot" style={{ '--mg-pos': position } as CSSProperties} aria-hidden="true" />
      <output>{format(value)}</output>
    </label>
  )
}

/**
 * The one round part on the plate. It turns with the finger (useRotaryDrag), so
 * its shape and its gesture finally agree; the printed collar fills as it goes
 * because a knob with no travel indication is a knob you have to read twice.
 */
function DriveKnob({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const drag = useRotaryDrag({ value, min: 0, max: 1, step: 0.01, onChange, focusLabel: 'DRIVE', formatValue: percent })
  return (
    <label className="mg-knob">
      <span className="mg-knob-seat" style={{ '--mg-pos': value } as CSSProperties}>
        <input type="range" value={value} min={0} max={1} step={0.01} {...drag.inputProps} />
        <span className="mg-knob-body" aria-hidden="true"><span className="mg-knob-pointer" /></span>
      </span>
      <span className="mg-knob-legend">DRIVE</span>
      <output>{percent(value)}</output>
    </label>
  )
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatFrequency(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 3000 ? 1 : 2)} kHz` : `${Math.round(value)} Hz`
}

function formatSeconds(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`
}
