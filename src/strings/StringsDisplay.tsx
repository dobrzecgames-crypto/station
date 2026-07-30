import { useEffect, useMemo, useRef, useState } from 'react'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { DisplayRange } from '../shell/displayControls'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { formatMidiNote, maximumChordInterval, minimumChordInterval } from '../synth/synthOperations'
import { maximumStringsVoices } from './stringsOperations'
import type { StringsPatch } from './stringsTypes'

type StringsDisplayPage = 'sound' | 'character' | 'pad'

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
const pages: readonly StringsDisplayPage[] = ['sound', 'character', 'pad']

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
        <DisplayRange label="ATTACK" value={formatSeconds(patch.ampEnvelope.attackSeconds)} min="0.01" max="5" step="0.01" current={patch.ampEnvelope.attackSeconds} idPrefix={displayId} onChange={(attackSeconds) => change({ ampEnvelope: { ...patch.ampEnvelope, attackSeconds } })} />
        <DisplayRange label="RELEASE" value={formatSeconds(patch.ampEnvelope.releaseSeconds)} min="0.05" max="8" step="0.05" current={patch.ampEnvelope.releaseSeconds} idPrefix={displayId} onChange={(releaseSeconds) => change({ ampEnvelope: { ...patch.ampEnvelope, releaseSeconds } })} />
        <DisplayRange label="BRIGHTNESS" value={`${Math.round(patch.brightness * 100)}%`} min="0" max="1" step="0.01" current={patch.brightness} idPrefix={displayId} onChange={(brightness) => change({ brightness })} />
        <DisplayRange label="LEVEL" value={`${Math.round(patch.level * 100)}%`} min="0" max="1" step="0.01" current={patch.level} idPrefix={displayId} onChange={(level) => change({ level })} />
      </>}

      {page === 'character' && <>
        <DisplayRange label="ENSEMBLE" value={`${Math.round(patch.ensemble * 100)}%`} min="0" max="1" step="0.01" current={patch.ensemble} idPrefix={displayId} onChange={(ensemble) => change({ ensemble })} />
        <DisplayRange label="VIBRATO" value={`${Math.round(patch.vibrato * 100)}%`} min="0" max="1" step="0.01" current={patch.vibrato} idPrefix={displayId} onChange={(vibrato) => change({ vibrato })} />
        <DisplayRange label="DETUNE" value={`${patch.detuneCents.toFixed(0)} ct`} min="0" max="40" step="1" current={patch.detuneCents} idPrefix={displayId} onChange={(detuneCents) => change({ detuneCents })} />
      </>}

      {page === 'pad' && <>
        <DisplayRange label="BASE NOTE" value={formatMidiNote(patch.baseMidiNote)} min={String(props.baseMidiRange[0])} max={String(props.baseMidiRange[1])} step="1" current={patch.baseMidiNote} idPrefix={displayId} onChange={(baseMidiNoteValue) => change({ baseMidiNote: baseMidiNoteValue })} />
        <DisplayRange label="GATE" value={`${Math.round(patch.gate * 100)}% step`} min="0.05" max="2" step="0.01" current={patch.gate} idPrefix={displayId} onChange={(gate) => change({ gate })} />
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
  }
}

function formatSeconds(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}
