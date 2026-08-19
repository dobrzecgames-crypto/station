import { useEffect, useMemo, useRef, useState } from 'react'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { DisplayRange } from '../shell/displayControls'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { formatMidiNote, maximumChordInterval, minimumChordInterval } from '../synth/synthOperations'
import { maximumStringsVoices } from './stringsOperations'
import type { StringsPatch } from './stringsTypes'

interface StringsDisplayLauncherProps {
  pad: PadState
  patch: StringsPatch
  baseMidiRange: readonly [number, number]
  projectBusy: boolean
  projectKeyLabel: string
  onPatchChange: (patch: StringsPatch) => void
  onChordChange: (intervals: number[]) => void
  onPadPitchChange: (pitchSemitones: number) => void
  onMapToProjectScale: () => void
  onClear: () => void
}

const displayId = 'strings-controls'

/**
 * STRINGS now keeps every sound parameter on its own panel (StringsWorkspace) -
 * OSC/ENV/ENSEMBLE/TEXTURE moved off this shared display in the own-hardware
 * pass. What is left here is pad and performance mapping: which MIDI note a
 * pad plays, how long a step gate holds it, and the chord voicing stacked on
 * top - the same kind of thing every instrument's pad keeps off its own
 * patch panel, not a sound parameter. No page nav is needed for one page.
 */
export function StringsDisplayLauncher(props: StringsDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  const hasOwnedDisplayRef = useRef(false)
  const latestPropsRef = useRef(props)
  latestPropsRef.current = props

  const handlers = useMemo(() => ({
    onPatchChange: (patch: StringsPatch) => latestPropsRef.current.onPatchChange(patch),
    onChordChange: (intervals: number[]) => latestPropsRef.current.onChordChange(intervals),
    onPadPitchChange: (pitchSemitones: number) => latestPropsRef.current.onPadPitchChange(pitchSemitones),
    onMapToProjectScale: () => latestPropsRef.current.onMapToProjectScale(),
    onClear: () => latestPropsRef.current.onClear(),
  }), [])

  const tenant = useMemo<DisplayTenant>(() => stringsTenant({ ...props, ...handlers }), [
    props.pad.id,
    props.pad.label,
    props.pad.pitchSemitones,
    props.pad.chordIntervals,
    props.patch,
    props.baseMidiRange[0],
    props.baseMidiRange[1],
    props.projectBusy,
    props.projectKeyLabel,
    handlers,
  ])

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

function stringsTenant(props: StringsDisplayLauncherProps): DisplayTenant {
  const { pad, patch } = props
  const change = (changes: Partial<StringsPatch>) => props.onPatchChange({ ...patch, ...changes })
  const baseMidiNote = patch.baseMidiNote + pad.pitchSemitones

  return {
    id: displayId,
    label: `${pad.label} STRINGS controls`,
    readout: `STRINGS / ${pad.label} / ${pad.chordIntervals.length} NOTE${pad.chordIntervals.length === 1 ? '' : 'S'}`,
    panel: <>
      <DisplayRange label="BASE NOTE" formatValue={formatMidiNote} min={String(props.baseMidiRange[0])} max={String(props.baseMidiRange[1])} step="1" current={patch.baseMidiNote} idPrefix={displayId} onChange={(baseMidiNoteValue) => change({ baseMidiNote: baseMidiNoteValue })} />
      <DisplayRange label="GATE" formatValue={(value) => `${Math.round(value * 100)}% step`} min="0.05" max="2" step="0.01" current={patch.gate} idPrefix={displayId} onChange={(gate) => change({ gate })} />
      <div className="strings-display-chord">
        <span>BASE</span>
        <strong>0 st / {formatMidiNote(baseMidiNote)}</strong>
      </div>
      {pad.chordIntervals.filter((interval) => interval !== 0).map((interval) => (
        <div className="strings-display-chord" key={interval}>
          <span>{signed(interval)} st / {formatMidiNote(baseMidiNote + interval)}</span>
          <button type="button" onClick={() => props.onChordChange(pad.chordIntervals.filter((candidate) => candidate !== interval))}>REMOVE</button>
        </div>
      ))}
      <div className="strings-display-add">
        <select
          aria-label="Chord interval to add"
          disabled={pad.chordIntervals.length >= maximumStringsVoices}
          value=""
          onChange={(event) => {
            const interval = Number(event.target.value)
            if (Number.isInteger(interval) && !pad.chordIntervals.includes(interval)) props.onChordChange([...pad.chordIntervals, interval])
          }}
        >
          <option value="">ADD INTERVAL...</option>
          {Array.from({ length: maximumChordInterval - minimumChordInterval + 1 }, (_unused, index) => minimumChordInterval + index)
            .filter((interval) => interval !== 0 && !pad.chordIntervals.includes(interval))
            .map((interval) => <option value={interval} key={interval}>{signed(interval)} st / {formatMidiNote(baseMidiNote + interval)}</option>)}
        </select>
        <span>{pad.chordIntervals.length} / {maximumStringsVoices} VOICES</span>
      </div>
      <div className="sound-tools-row">
        <span>SCALE / {props.projectKeyLabel}</span>
        <div>
          <button type="button" disabled={props.projectBusy} onClick={props.onMapToProjectScale}>MAP</button>
          <button type="button" onClick={props.onClear}>CLEAR</button>
        </div>
      </div>
    </>,
  }
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}
