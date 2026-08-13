import { useEffect, useRef } from 'react'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
import { UserSynthPresetControls } from '../synth-presets/UserSynthPresetControls'
import { StringsDisplayLauncher } from './StringsDisplay'
import { stringsCharacters, stringsOctaveLayers } from './stringsTypes'
import type { StringsOctaveLayer, StringsPatch } from './stringsTypes'
import './StringsWorkspace.css'

interface StringsWorkspaceProps {
  pad: PadState
  patch: StringsPatch | undefined
  usageCount: number
  baseMidiRange: readonly [number, number]
  audioReady: boolean
  projectBusy: boolean
  projectKeyLabel: string
  onPatchChange: (patch: StringsPatch) => void
  onChordChange: (intervals: number[]) => void
  onPadPitchChange: (pitchSemitones: number) => void
  onTrigger: () => void
  onRelease: () => void
  onMapToProjectScale: () => void
  onClear: () => void
  onBack: () => void
}

export function StringsWorkspace(props: StringsWorkspaceProps) {
  const { pad, patch } = props
  const onReleaseRef = useRef(props.onRelease)
  onReleaseRef.current = props.onRelease

  /* Defensive: Mono-3 relies solely on pointer-capture semantics and the
     app-level key listener to avoid hanging notes across a tab switch. This
     is a deliberate small addition for STRINGS only - if the workspace
     unmounts (tab or bank switch) while a pointer is still down on the
     audition button, the pad's manual voice is released rather than left
     ringing. Empty deps + a ref: this must run once, at genuine unmount,
     using whichever pad was last selected - not on every render. */
  useEffect(() => () => onReleaseRef.current(), [])

  if (!patch) return null

  const change = (changes: Partial<StringsPatch>) => props.onPatchChange({ ...patch, ...changes })

  return <>
    <StringsDisplayLauncher
      pad={pad}
      patch={patch}
      baseMidiRange={props.baseMidiRange}
      projectBusy={props.projectBusy}
      projectKeyLabel={props.projectKeyLabel}
      onPatchChange={props.onPatchChange}
      onChordChange={props.onChordChange}
      onPadPitchChange={props.onPadPitchChange}
      onMapToProjectScale={props.onMapToProjectScale}
      onClear={props.onClear}
    />

    <section className="strings-workspace" aria-label={`STRINGS editor for ${pad.label}`}>
      <div className="strings-back-row">
        <button className="mixer-toggle" type="button" onClick={props.onBack}>← BACK TO SYNTHS</button>
      </div>
      <header className="strings-heading">
        <div>
          <p className="eyebrow">STRINGS / {pad.label}</p>
          <h2>{patch.name}</h2>
          <p>{props.usageCount} PAD{props.usageCount === 1 ? '' : 'S'} SHARE PATCH</p>
        </div>
        <button
          className="strings-audition"
          type="button"
          disabled={!props.audioReady}
          aria-label="Hold to play STRINGS"
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

      <UserSynthPresetControls kind="strings" instrumentLabel="STRINGS" patch={patch} onApply={props.onPatchChange} />

      <div className="strings-starter-row">
        <InlineSelect
          label="CHARACTER"
          value={patch.character}
          options={stringsCharacters}
          onChange={(character) => change({ character })}
        />
        <InlineSelect
          label="OCTAVE LAYER"
          value={patch.octaveLayer}
          options={stringsOctaveLayers}
          labels={octaveLayerSelectLabels}
          onChange={(octaveLayer) => change({ octaveLayer })}
        />
      </div>
      <InlineRange
        label="OCTAVE MIX"
        value={patch.octaveLayerMix}
        min={0}
        max={1}
        step={0.01}
        disabled={patch.octaveLayer === 'off'}
        format={percent}
        onChange={(octaveLayerMix) => change({ octaveLayerMix })}
      />

      <p className="strings-display-hint">ATTACK / RELEASE / BRIGHTNESS / ENSEMBLE / VIBRATO / DETUNE / LEVEL / OCTAVE ARE IN THE SYSTEM DISPLAY — TAP MORE FOR BODY, MOTION, WIDTH, BOW, VIBRATO DELAY, WARMTH, SPACE</p>
    </section>
  </>
}

const octaveLayerSelectLabels: Partial<Record<StringsOctaveLayer, string>> = {
  off: 'OFF',
  down: '-1',
  up: '+1',
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** Mirrors MONOPOLY's own inline oscillator controls (SynthWorkspace.tsx) - the same compact label+control row, right in the main workspace rather than behind a tap into the System Display, for the handful of settings a player reaches for immediately after picking a sound. */
function InlineSelect<T extends string>({ label, value, options, labels, onChange }: {
  label: string
  value: T
  options: readonly T[]
  labels?: Partial<Record<T, string>>
  onChange: (value: T) => void
}) {
  return <label className="strings-inline-control strings-inline-select">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => <option value={option} key={option}>{labels?.[option] ?? option.toUpperCase()}</option>)}
    </select>
  </label>
}

function InlineRange({ label, value, min, max, step, disabled, format = percent, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  format?: (value: number) => string
  onChange: (value: number) => void
}) {
  const drag = useDragSlider({ value, min, max, step, disabled, onChange, focusLabel: label, formatValue: format })
  return <label className="strings-inline-control strings-inline-range">
    <span>{label}</span>
    <output>{format(value)}</output>
    <input type="range" value={value} min={min} max={max} step={step} disabled={disabled} {...drag.inputProps} />
  </label>
}
