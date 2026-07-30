import { useEffect, useRef } from 'react'
import type { PadState } from '../pads/types'
import { StringsDisplayLauncher } from './StringsDisplay'
import { applyStringsPreset, stringsPresetNames } from './stringsOperations'
import type { StringsPatch } from './stringsTypes'
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

      <div className="strings-presets" role="group" aria-label="STRINGS presets">
        {stringsPresetNames.map((name) => (
          <button
            key={name}
            type="button"
            className={patch.name === name ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'}
            onClick={() => props.onPatchChange(applyStringsPreset(patch, name))}
          >
            {name}
          </button>
        ))}
      </div>

      <p className="strings-display-hint">ATTACK / RELEASE / BRIGHTNESS / ENSEMBLE / VIBRATO / DETUNE / LEVEL ARE IN THE SYSTEM DISPLAY</p>
    </section>
  </>
}
