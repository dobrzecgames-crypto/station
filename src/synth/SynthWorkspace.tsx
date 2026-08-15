import { useState } from 'react'
import type { ReactNode } from 'react'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
import { LatchKey, MomentaryKey } from '../shell/UtilityKey'
import { UserSynthPresetControls } from '../synth-presets/UserSynthPresetControls'
import { SynthDisplayLauncher } from './SynthDisplay'
import { subWaveforms, synthWaveforms } from './synthTypes'
import type { SynthPatch, SynthVoiceMode } from './synthTypes'
import './SynthWorkspace.css'

interface SynthWorkspaceProps {
  pad: PadState
  patch: SynthPatch | undefined
  usageCount: number
  baseMidiRange: readonly [number, number]
  audioReady: boolean
  projectBusy: boolean
  projectKeyLabel: string
  onPatchChange: (patch: SynthPatch) => void
  onModeChange: (mode: SynthVoiceMode) => void
  onChordChange: (intervals: number[]) => void
  onPadPitchChange: (pitchSemitones: number) => void
  onTrigger: () => void
  onRelease: () => void
  onMapToProjectScale: () => void
  onClear: () => void
  onBack: () => void
}

export function SynthWorkspace(props: SynthWorkspaceProps) {
  const { pad, patch } = props
  const [patchPanelOpen, setPatchPanelOpen] = useState(false)

  if (!patch) return null

  const patchName = patch.name === 'MONO-3' || patch.name === 'MONOPOLY' ? 'BASSIC' : patch.name
  const change = (changes: Partial<SynthPatch>) => props.onPatchChange({ ...patch, ...changes })
  const changeOscillator = (key: 'oscillator1' | 'oscillator2', changes: Partial<SynthPatch['oscillator1']>) => {
    change({ [key]: { ...patch[key], ...changes } })
  }

  return <>
    <SynthDisplayLauncher
      pad={pad}
      patch={patch}
      baseMidiRange={props.baseMidiRange}
      projectBusy={props.projectBusy}
      projectKeyLabel={props.projectKeyLabel}
      onPatchChange={props.onPatchChange}
      onModeChange={props.onModeChange}
      onChordChange={props.onChordChange}
      onPadPitchChange={props.onPadPitchChange}
      onMapToProjectScale={props.onMapToProjectScale}
      onClear={props.onClear}
    />

    <section className="synth-workspace" aria-label={`BASSIC editor for ${pad.label}`}>
      <header className="synth-heading">
        <p className="eyebrow">BASSIC / {pad.label} / {props.usageCount} PAD{props.usageCount === 1 ? '' : 'S'} SHARE PATCH</p>
        <div className="synth-heading-identity">
          <h2>{patchName}</h2>
          <div className="synth-heading-keys">
            <MomentaryKey label="← SYNTHS" ariaLabel="Back to synths" onClick={props.onBack} />
            <LatchKey label="PATCH" engaged={patchPanelOpen} onClick={() => setPatchPanelOpen((current) => !current)} />
          </div>
        </div>
        <button
          className="chop-preview-button chop-preview-play synth-audition"
          type="button"
          disabled={!props.audioReady}
          aria-label="Hold to play synth"
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

      {patchPanelOpen && <div className="synth-patch-panel station-card" aria-label="BASSIC patch storage">
        <UserSynthPresetControls kind="basic" instrumentLabel="BASSIC" patch={patch} onApply={props.onPatchChange} />
      </div>}

      <div className="synth-oscillators">
        <OscillatorRow
          label="OSC 1"
          selects={<>
            <InlineSelect label="WAVE" hideLabel value={patch.oscillator1.waveform} options={synthWaveforms} onChange={(waveform) => changeOscillator('oscillator1', { waveform })} />
            <InlineSelect label="OCT" value={String(patch.oscillator1.octave) as typeof octaves[number]} options={octaves} labels={octaveLabels} onChange={(octave) => changeOscillator('oscillator1', { octave: Number(octave) })} />
          </>}
          ranges={<>
            <InlineRange label="DETUNE" value={patch.oscillator1.detuneCents} min={-50} max={50} step={1} format={(value) => `${signed(value)} ct`} onChange={(detuneCents) => changeOscillator('oscillator1', { detuneCents })} />
            <InlineRange label="LEVEL" value={patch.oscillator1.level} min={0} max={1} step={0.01} onChange={(level) => changeOscillator('oscillator1', { level })} />
          </>}
        />

        <OscillatorRow
          label="OSC 2"
          selects={<>
            <InlineSelect label="WAVE" hideLabel value={patch.oscillator2.waveform} options={synthWaveforms} onChange={(waveform) => changeOscillator('oscillator2', { waveform })} />
            <InlineSelect label="OCT" value={String(patch.oscillator2.octave) as typeof octaves[number]} options={octaves} labels={octaveLabels} onChange={(octave) => changeOscillator('oscillator2', { octave: Number(octave) })} />
          </>}
          ranges={<>
            <InlineRange label="DETUNE" value={patch.oscillator2.detuneCents} min={-50} max={50} step={1} format={(value) => `${signed(value)} ct`} onChange={(detuneCents) => changeOscillator('oscillator2', { detuneCents })} />
            <InlineRange label="LEVEL" value={patch.oscillator2.level} min={0} max={1} step={0.01} onChange={(level) => changeOscillator('oscillator2', { level })} />
          </>}
        />

        {/* SUB carries one level instead of two, so its three controls share a
            single row rather than leaving half of a second one empty. */}
        <OscillatorRow
          label="SUB"
          sub
          selects={<>
            <InlineSelect label="WAVE" hideLabel value={patch.sub.waveform} options={subWaveforms} onChange={(waveform) => change({ sub: { ...patch.sub, waveform } })} />
            <InlineSelect label="OCT" value={String(patch.sub.octave) as typeof subOctaves[number]} options={subOctaves} onChange={(octave) => change({ sub: { ...patch.sub, octave: Number(octave) as -1 | -2 } })} />
            <InlineRange label="LEVEL" value={patch.sub.level} min={0} max={1} step={0.01} onChange={(level) => change({ sub: { ...patch.sub, level } })} />
          </>}
        />
      </div>

      <p className="synth-display-hint">FILTER / AMP / LFO / VOICE / PAD ARE IN THE SYSTEM DISPLAY</p>
    </section>
  </>
}

const octaves = ['2', '1', '0', '-1', '-2'] as const
const octaveLabels: Partial<Record<typeof octaves[number], string>> = {
  '-2': '-2',
  '-1': '-1',
  '0': '0',
  '1': '+1',
  '2': '+2',
}
const subOctaves = ['-1', '-2'] as const

function OscillatorRow({ label, sub = false, selects, ranges }: { label: string; sub?: boolean; selects: ReactNode; ranges?: ReactNode }) {
  return <div className={`synth-oscillator-row${sub ? ' synth-oscillator-row-sub' : ''}`}>
    <div className="synth-oscillator-selects"><strong>{label}</strong>{selects}</div>
    {ranges ? <div className="synth-oscillator-ranges">{ranges}</div> : null}
  </div>
}

/* A waveform dropdown already reads SAWTOOTH or TRIANGLE, so its printed
 *  legend says nothing the control does not. hideLabel drops the line and
 *  moves the name onto the select for assistive tech. */
function InlineSelect<T extends string>({ label, value, options, labels, hideLabel, onChange }: {
  label: string
  value: T
  options: readonly T[]
  labels?: Partial<Record<T, string>>
  hideLabel?: boolean
  onChange: (value: T) => void
}) {
  return <label className={hideLabel ? "synth-inline-control synth-inline-select synth-inline-select-bare" : "synth-inline-control synth-inline-select"}>
    {hideLabel ? null : <span>{label}</span>}
    <select aria-label={hideLabel ? label : undefined} value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => <option value={option} key={option}>{labels?.[option] ?? option.toUpperCase()}</option>)}
    </select>
  </label>
}

function InlineRange({ label, value, min, max, step, format = compact, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (value: number) => string
  onChange: (value: number) => void
}) {
  const drag = useDragSlider({ value, min, max, step, onChange, focusLabel: label, formatValue: format })
  return <label className="synth-inline-control synth-inline-range">
    <span>{label}</span>
    <output>{format(value)}</output>
    <input type="range" value={value} min={min} max={max} step={step} {...drag.inputProps} />
  </label>
}

function compact(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}
