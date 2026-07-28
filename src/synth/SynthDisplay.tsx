import { useEffect, useMemo, useRef, useState } from 'react'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { DisplayRange } from '../shell/displayControls'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import {
  formatMidiNote,
  maximumChordInterval,
  maximumSynthVoices,
  minimumChordInterval,
} from './synthOperations'
import { synthLfoDivisions, synthVoiceModes, synthWaveforms } from './synthTypes'
import type { SynthPatch, SynthVoiceMode } from './synthTypes'

type SynthDisplayPage = 'filter' | 'amp' | 'lfo' | 'voice' | 'pad'

interface SynthDisplayLauncherProps {
  pad: PadState
  patch: SynthPatch
  baseMidiRange: readonly [number, number]
  projectBusy: boolean
  projectKeyLabel: string
  onPatchChange: (patch: SynthPatch) => void
  onModeChange: (mode: SynthVoiceMode) => void
  onChordChange: (intervals: number[]) => void
  onPadPitchChange: (pitchSemitones: number) => void
  onMapToProjectScale: () => void
  onClear: () => void
}

const displayId = 'synth-controls'
const pages: readonly SynthDisplayPage[] = ['filter', 'amp', 'lfo', 'voice', 'pad']

export function SynthDisplayLauncher(props: SynthDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [page, setPage] = useState<SynthDisplayPage>('filter')
  const [displayActive, setDisplayActive] = useState(true)
  const hasOwnedDisplayRef = useRef(false)
  const latestPropsRef = useRef(props)
  latestPropsRef.current = props

  const handlers = useMemo(() => ({
    onPatchChange: (patch: SynthPatch) => latestPropsRef.current.onPatchChange(patch),
    onModeChange: (mode: SynthVoiceMode) => latestPropsRef.current.onModeChange(mode),
    onChordChange: (intervals: number[]) => latestPropsRef.current.onChordChange(intervals),
    onPadPitchChange: (pitchSemitones: number) => latestPropsRef.current.onPadPitchChange(pitchSemitones),
    onMapToProjectScale: () => latestPropsRef.current.onMapToProjectScale(),
    onClear: () => latestPropsRef.current.onClear(),
  }), [])

  const tenant = useMemo<DisplayTenant>(() => synthTenant({
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
    setPage('filter')
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

interface SynthTenantProps extends SynthDisplayLauncherProps {
  page: SynthDisplayPage
  onPageChange: (page: SynthDisplayPage) => void
}

function synthTenant(props: SynthTenantProps): DisplayTenant {
  const { pad, patch, page } = props
  const change = (changes: Partial<SynthPatch>) => props.onPatchChange({ ...patch, ...changes })
  const baseMidiNote = patch.baseMidiNote + pad.pitchSemitones
  const minimumPadPitch = Math.max(-36, 12 - patch.baseMidiNote - Math.min(...pad.chordIntervals))
  const maximumPadPitch = Math.min(36, 108 - patch.baseMidiNote - Math.max(...pad.chordIntervals))

  return {
    id: displayId,
    label: `${pad.label} MONO-3 controls`,
    readout: synthReadout(page, patch, pad),
    panel: <>
      <nav className="synth-display-pages" aria-label="MONO-3 control pages">
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

      {page === 'filter' && <>
        <DisplayRange label="CUTOFF" value={formatFrequency(patch.filter.cutoffHz)} min="20" max="20000" step="1" current={patch.filter.cutoffHz} idPrefix={displayId} onChange={(cutoffHz) => change({ filter: { ...patch.filter, cutoffHz } })} />
        <DisplayRange label="RESONANCE" value={patch.filter.resonance.toFixed(1)} min="0" max="20" step="0.1" current={patch.filter.resonance} idPrefix={displayId} onChange={(resonance) => change({ filter: { ...patch.filter, resonance } })} />
        <DisplayRange label="ENV ATTACK" value={formatSeconds(patch.filter.envelopeAttackSeconds)} min="0" max="5" step="0.001" current={patch.filter.envelopeAttackSeconds} idPrefix={displayId} onChange={(envelopeAttackSeconds) => change({ filter: { ...patch.filter, envelopeAttackSeconds } })} />
        <DisplayRange label="ENV DECAY" value={formatSeconds(patch.filter.envelopeDecaySeconds)} min="0" max="5" step="0.001" current={patch.filter.envelopeDecaySeconds} idPrefix={displayId} onChange={(envelopeDecaySeconds) => change({ filter: { ...patch.filter, envelopeDecaySeconds } })} />
        <DisplayRange label="ENV AMOUNT" value={`${signed(patch.filter.envelopeAmountSemitones)} st`} min="-60" max="60" step="1" current={patch.filter.envelopeAmountSemitones} idPrefix={displayId} onChange={(envelopeAmountSemitones) => change({ filter: { ...patch.filter, envelopeAmountSemitones } })} />
      </>}

      {page === 'amp' && <>
        <DisplayRange label="ATTACK" value={formatSeconds(patch.ampEnvelope.attackSeconds)} min="0" max="5" step="0.001" current={patch.ampEnvelope.attackSeconds} idPrefix={displayId} onChange={(attackSeconds) => change({ ampEnvelope: { ...patch.ampEnvelope, attackSeconds } })} />
        <DisplayRange label="DECAY" value={formatSeconds(patch.ampEnvelope.decaySeconds)} min="0" max="5" step="0.001" current={patch.ampEnvelope.decaySeconds} idPrefix={displayId} onChange={(decaySeconds) => change({ ampEnvelope: { ...patch.ampEnvelope, decaySeconds } })} />
        <DisplayRange label="SUSTAIN" value={patch.ampEnvelope.sustain.toFixed(2)} min="0" max="1" step="0.01" current={patch.ampEnvelope.sustain} idPrefix={displayId} onChange={(sustain) => change({ ampEnvelope: { ...patch.ampEnvelope, sustain } })} />
        <DisplayRange label="RELEASE" value={formatSeconds(patch.ampEnvelope.releaseSeconds)} min="0.005" max="10" step="0.005" current={patch.ampEnvelope.releaseSeconds} idPrefix={displayId} onChange={(releaseSeconds) => change({ ampEnvelope: { ...patch.ampEnvelope, releaseSeconds } })} />
        <DisplayRange label="DRIVE" value={patch.drive.toFixed(2)} min="0" max="1" step="0.01" current={patch.drive} idPrefix={displayId} onChange={(drive) => change({ drive })} />
      </>}

      {page === 'lfo' && <>
        <DisplaySelect label="WAVE" value={patch.lfo.waveform} options={synthWaveforms} onChange={(waveform) => change({ lfo: { ...patch.lfo, waveform } })} />
        <DisplaySelect label="DIVISION" value={patch.lfo.division} options={synthLfoDivisions} onChange={(division) => change({ lfo: { ...patch.lfo, division } })} />
        <DisplayRange label="FILTER DEPTH" value={`${compact(patch.lfo.depthSemitones)} st`} min="0" max="48" step="0.5" current={patch.lfo.depthSemitones} idPrefix={displayId} onChange={(depthSemitones) => change({ lfo: { ...patch.lfo, depthSemitones } })} />
      </>}

      {page === 'voice' && <>
        <DisplaySelect label="MODE" value={patch.mode} options={synthVoiceModes} labels={{ mono: 'MONO', poly5: 'POLY 5' }} onChange={props.onModeChange} />
        <DisplayRange label="BASE NOTE" value={formatMidiNote(patch.baseMidiNote)} min={String(props.baseMidiRange[0])} max={String(props.baseMidiRange[1])} step="1" current={patch.baseMidiNote} idPrefix={displayId} onChange={(baseMidiNoteValue) => change({ baseMidiNote: baseMidiNoteValue })} />
        <DisplayRange label="PAD PITCH" value={`${signed(pad.pitchSemitones)} st`} min={String(minimumPadPitch)} max={String(maximumPadPitch)} step="1" current={pad.pitchSemitones} idPrefix={displayId} onChange={props.onPadPitchChange} />
        <DisplayRange label="GLIDE" value={formatSeconds(patch.glideSeconds)} min="0" max="2" step="0.005" current={patch.glideSeconds} idPrefix={displayId} onChange={(glideSeconds) => change({ glideSeconds })} />
        <DisplayRange label="GATE" value={`${Math.round(patch.gate * 100)}% step`} min="0.05" max="2" step="0.01" current={patch.gate} idPrefix={displayId} onChange={(gate) => change({ gate })} />
      </>}

      {page === 'pad' && <>
        <div className="synth-display-chord">
          <span>BASE</span>
          <strong>0 st / {formatMidiNote(baseMidiNote)}</strong>
        </div>
        {pad.chordIntervals.filter((interval) => interval !== 0).map((interval) => (
          <div className="synth-display-chord" key={interval}>
            <span>{signed(interval)} st / {formatMidiNote(baseMidiNote + interval)}</span>
            <button type="button" onClick={() => props.onChordChange(pad.chordIntervals.filter((candidate) => candidate !== interval))}>REMOVE</button>
          </div>
        ))}
        <div className="synth-display-add">
          <select
            aria-label="Chord interval to add"
            disabled={patch.mode === 'mono' || pad.chordIntervals.length >= maximumSynthVoices}
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
          <span>{patch.mode === 'mono' ? 'MONO / BASE ONLY' : `${pad.chordIntervals.length} / ${maximumSynthVoices} VOICES`}</span>
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

function DisplaySelect<T extends string>({ label, value, options, labels, onChange }: {
  label: string
  value: T
  options: readonly T[]
  labels?: Partial<Record<T, string>>
  onChange: (value: T) => void
}) {
  return <label className="synth-display-select-row">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => <option value={option} key={option}>{labels?.[option] ?? option.toUpperCase()}</option>)}
    </select>
  </label>
}

function synthReadout(page: SynthDisplayPage, patch: SynthPatch, pad: PadState): string {
  switch (page) {
    case 'filter': return `SYNTH / FILTER / ${formatFrequency(patch.filter.cutoffHz)}`
    case 'amp': return `SYNTH / AMP / A ${formatSeconds(patch.ampEnvelope.attackSeconds)}`
    case 'lfo': return `SYNTH / LFO / ${patch.lfo.division} / ${compact(patch.lfo.depthSemitones)} ST`
    case 'voice': return `SYNTH / ${patch.mode === 'mono' ? 'MONO' : 'POLY 5'} / ${formatMidiNote(patch.baseMidiNote + pad.pitchSemitones)}`
    case 'pad': return `SYNTH / ${pad.label} / ${pad.chordIntervals.length} NOTE${pad.chordIntervals.length === 1 ? '' : 'S'}`
  }
}

function formatFrequency(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} kHz` : `${Math.round(value)} Hz`
}

function formatSeconds(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`
}

function compact(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}
