import { useEffect, useRef } from 'react'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
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

export function OrganicBassWorkspace(props: OrganicBassWorkspaceProps) {
  const { pad, patch } = props
  const onReleaseRef = useRef(props.onRelease)
  onReleaseRef.current = props.onRelease
  useEffect(() => () => onReleaseRef.current(), [])
  const change = (changes: Partial<OrganicBassPatch>) => props.onPatchChange({ ...patch, ...changes })

  return (
    <section className="organic-bass-workspace" aria-label={`MONOGORG editor for ${pad.label}`}>
      <div className="organic-bass-back-row">
        <button className="mixer-toggle" type="button" onClick={props.onBack}>← BACK TO SYNTHS</button>
      </div>

      <header className="organic-bass-heading">
        <div>
          <p className="eyebrow">MONOGORG / {pad.label}</p>
          <h2>{patch.name}</h2>
          <p>{props.usageCount} PAD{props.usageCount === 1 ? '' : 'S'} SHARE PATCH / MONO</p>
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

      <div className="organic-bass-controls">
        <BassControl label="SHAPE" value={patch.shape} format={percent} onChange={(shape) => change({ shape })} />
        <BassControl label="WEIGHT" value={patch.weight} format={percent} onChange={(weight) => change({ weight })} />
        <BassControl label="CUTOFF" value={patch.cutoff} format={(value) => formatFrequency(organicBassCutoffHz(value))} onChange={(cutoff) => change({ cutoff })} />
        <BassControl label="RESO" value={patch.resonance} format={percent} onChange={(resonance) => change({ resonance })} />
        <BassControl label="CONTOUR" value={patch.contour} format={percent} onChange={(contour) => change({ contour })} />
        <BassControl label="ATTACK" value={patch.attackSeconds} min={0} max={0.12} step={0.001} format={formatSeconds} onChange={(attackSeconds) => change({ attackSeconds })} />
        <BassControl label="DECAY" value={patch.decay} format={(value) => formatSeconds(organicBassDecaySeconds(value))} onChange={(decay) => change({ decay })} />
        <BassControl label="DRIVE" value={patch.drive} format={percent} onChange={(drive) => change({ drive })} />
        <BassControl label="GLIDE" value={patch.glide} format={(value) => formatSeconds(organicBassGlideSeconds(value))} onChange={(glide) => change({ glide })} />
      </div>

      <div className="organic-bass-tools sound-tools-row">
        <span>SCALE / {props.projectKeyLabel}</span>
        <div>
          <button type="button" disabled={props.projectBusy} onClick={props.onMapToProjectScale}>MAP</button>
          <button type="button" onClick={props.onClear}>CLEAR</button>
        </div>
      </div>
      <p className="organic-bass-note">SHAPE → WEIGHT → DRIVE → 4-POLE FILTER / LEGATO READY</p>
    </section>
  )
}

function BassControl({ label, value, min = 0, max = 1, step = 0.01, format, onChange }: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  const drag = useDragSlider({ value, min, max, step, onChange, focusLabel: label, formatValue: format })
  return (
    <label className="organic-bass-control">
      <span>{label}</span>
      <output>{format(value)}</output>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} onPointerDown={drag.onPointerDown} />
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
