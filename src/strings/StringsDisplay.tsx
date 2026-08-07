import { useEffect, useMemo, useRef, useState } from 'react'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { DisplayRange } from '../shell/displayControls'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { formatMidiNote, maximumChordInterval, minimumChordInterval } from '../synth/synthOperations'
import { maximumStringsVoices } from './stringsOperations'
import { stringsOctaves } from './stringsTypes'
import type { StringsPatch } from './stringsTypes'

type StringsDisplayPage = 'sound' | 'character' | 'pad' | 'more'

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
const pages: readonly StringsDisplayPage[] = ['sound', 'character', 'pad', 'more']

export function StringsDisplayLauncher(props: StringsDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [page, setPage] = useState<StringsDisplayPage>('sound')
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

  const tenant = useMemo<DisplayTenant>(() => stringsTenant({
    ...props,
    ...handlers,
    page,
    onPageChange: setPage,
  }), [
    props.pad.id,
    props.pad.label,
    props.pad.pitchSemitones,
    props.pad.chordIntervals,
    props.patch,
    props.baseMidiRange[0],
    props.baseMidiRange[1],
    props.projectBusy,
    props.projectKeyLabel,
    page,
    handlers,
  ])

  useEffect(() => {
    setDisplayActive(true)
    setPage('sound')
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

interface StringsTenantProps extends StringsDisplayLauncherProps {
  page: StringsDisplayPage
  onPageChange: (page: StringsDisplayPage) => void
}

function stringsTenant(props: StringsTenantProps): DisplayTenant {
  const { pad, patch, page } = props
  const change = (changes: Partial<StringsPatch>) => props.onPatchChange({ ...patch, ...changes })
  const baseMidiNote = patch.baseMidiNote + pad.pitchSemitones

  return {
    id: displayId,
    label: `${pad.label} STRINGS controls`,
    readout: stringsReadout(page, patch, pad),
    panel: <>
      <nav className="strings-display-pages" aria-label="STRINGS control pages">
        {pages.map((candidate) => (
          <button
            type="button"
            key={candidate}
            aria-pressed={candidate === page}
            onClick={() => props.onPageChange(candidate)}
          >
            {candidate.toUpperCase()}
          </button>
        ))}
      </nav>

      {page === 'sound' && <>
        <SegmentedSwitch label="OCTAVE" value={patch.octave} options={stringsOctaves} format={signed} onChange={(octave) => change({ octave })} />
        <DisplayRange label="ATTACK" formatValue={formatSeconds} min="0.01" max="5" step="0.01" current={patch.ampEnvelope.attackSeconds} idPrefix={displayId} onChange={(attackSeconds) => change({ ampEnvelope: { ...patch.ampEnvelope, attackSeconds } })} />
        <DisplayRange label="RELEASE" formatValue={formatSeconds} min="0.05" max="8" step="0.05" current={patch.ampEnvelope.releaseSeconds} idPrefix={displayId} onChange={(releaseSeconds) => change({ ampEnvelope: { ...patch.ampEnvelope, releaseSeconds } })} />
        <DisplayRange label="BRIGHTNESS" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.brightness} idPrefix={displayId} onChange={(brightness) => change({ brightness })} />
        <DisplayRange label="LEVEL" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.level} idPrefix={displayId} onChange={(level) => change({ level })} />
      </>}

      {page === 'character' && <>
        <DisplayRange label="ENSEMBLE" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.ensemble} idPrefix={displayId} onChange={(ensemble) => change({ ensemble })} />
        <DisplayRange label="VIBRATO" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.vibrato} idPrefix={displayId} onChange={(vibrato) => change({ vibrato })} />
        <DisplayRange label="DETUNE" formatValue={(value) => `${value.toFixed(0)} ct`} min="0" max="40" step="1" current={patch.detuneCents} idPrefix={displayId} onChange={(detuneCents) => change({ detuneCents })} />
      </>}

      {page === 'more' && <>
        <DisplayRange label="BODY" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.body} idPrefix={displayId} onChange={(body) => change({ body })} />
        <DisplayRange label="MOTION" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.motion} idPrefix={displayId} onChange={(motion) => change({ motion })} />
        <DisplayRange label="WIDTH" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.width} idPrefix={displayId} onChange={(width) => change({ width })} />
        <DisplayRange label="BOW" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.bow} idPrefix={displayId} onChange={(bow) => change({ bow })} />
        <DisplayRange label="VIBRATO DELAY" formatValue={(value) => `${Math.round(value)} ms`} min="0" max="2000" step="10" current={patch.vibratoDelayMs} idPrefix={displayId} onChange={(vibratoDelayMs) => change({ vibratoDelayMs })} />
        <DisplayRange label="WARMTH" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.warmth} idPrefix={displayId} onChange={(warmth) => change({ warmth })} />
        <DisplayRange label="SPACE" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={patch.space} idPrefix={displayId} onChange={(space) => change({ space })} />
      </>}

      {page === 'pad' && <>
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
      </>}
    </>,
  }
}

function stringsReadout(page: StringsDisplayPage, patch: StringsPatch, pad: PadState): string {
  switch (page) {
    case 'sound': return `STRINGS / ${formatSeconds(patch.ampEnvelope.attackSeconds)} ATK / ${Math.round(patch.brightness * 100)}% BRIGHT`
    case 'character': return `STRINGS / ENSEMBLE ${Math.round(patch.ensemble * 100)}% / VIBRATO ${Math.round(patch.vibrato * 100)}%`
    case 'pad': return `STRINGS / ${pad.label} / ${pad.chordIntervals.length} NOTE${pad.chordIntervals.length === 1 ? '' : 'S'}`
    case 'more': return `STRINGS / BODY ${Math.round(patch.body * 100)}% / WIDTH ${Math.round(patch.width * 100)}%`
  }
}

function formatSeconds(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}

/** Reuses the page nav's own segmented-button look for any discrete (not continuous) STRINGS parameter - OCTAVE, OCTAVE LAYER, CHARACTER. */
function SegmentedSwitch<T extends string | number>({ label, value, options, format, disabled, onChange }: {
  label: string
  value: T
  options: readonly T[]
  format?: (option: T) => string
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return <div className="strings-display-switch">
    <span className="strings-display-switch-label">{label}</span>
    <div className="strings-display-switch-options" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option}
          aria-pressed={option === value}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {format ? format(option) : String(option).toUpperCase()}
        </button>
      ))}
    </div>
  </div>
}
