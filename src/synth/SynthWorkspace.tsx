import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
import { LatchKey, MomentaryKey } from '../shell/UtilityKey'
import { UserSynthPresetControls } from '../synth-presets/UserSynthPresetControls'
import { SynthDisplayLauncher } from './SynthDisplay'
import { subWaveforms, synthWaveforms } from './synthTypes'
import type { SubWaveform, SynthPatch, SynthVoiceMode, SynthWaveform } from './synthTypes'
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

/**
 * BASSIC's own control surface: grooves cut across a one-piece face with wide
 * low caps riding along them, waveform keycaps that print the wave rather than
 * name it, and slide switches for the octave. Nothing here is shared hardware -
 * see the maker/model rule at the top of SynthWorkspace.css.
 *
 * This panel was built with rotary pots first, and they were wrong: a round
 * part promises a turning gesture and answered to a straight drag, which reads
 * as broken under a thumb no matter how the drag is tuned. A part that travels
 * along a line says what it does.
 *
 * Composition follows the signal path rather than the data shape: the two full
 * oscillators stand side by side, the sub is the half voice it actually is, the
 * three levels meet in one MIX section because balancing them is one decision,
 * and the filter - the thing that makes a bass a bass - is the bottom section.
 * FILTER ENV, AMP, LFO, VOICE and PAD stay in the shared System Display.
 */
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
        <p className="eyebrow">{pad.label} / {props.usageCount} PAD{props.usageCount === 1 ? '' : 'S'} SHARE PATCH</p>
        <div className="synth-heading-identity">
          <div className="synth-nameplate">
            <span className="synth-nameplate-mark" aria-hidden="true">3</span>
            <h2>{patchName}</h2>
          </div>
          <div className="synth-heading-keys">
            <MomentaryKey label="← SYNTHS" ariaLabel="Back to synths" onClick={props.onBack} />
            <LatchKey label="PATCH" engaged={patchPanelOpen} onClick={() => setPatchPanelOpen((current) => !current)} />
          </div>
        </div>
        <button
          className="synth-audition"
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

      <div className="bassic-osc-bay">
        <OscillatorColumn label="OSC 1" oscillator={patch.oscillator1} onChange={(changes) => changeOscillator('oscillator1', changes)} />
        <OscillatorColumn label="OSC 2" oscillator={patch.oscillator2} onChange={(changes) => changeOscillator('oscillator2', changes)} />
      </div>

      {/* The sub has one waveform pair and one octave pair and no detune of its
          own, so it gets a half-height strip rather than a third column with a
          hole in it. Its two switch groups sit under the two columns above. */}
      <Section label="SUB">
        <div className="bassic-osc-bay">
          <WaveKeys
            ariaLabel="Sub waveform"
            value={patch.sub.waveform}
            options={subWaveforms}
            onChange={(waveform) => change({ sub: { ...patch.sub, waveform } })}
          />
          <DetentSwitch
            ariaLabel="Sub octave"
            value={String(patch.sub.octave)}
            options={subOctaves}
            onChange={(octave) => change({ sub: { ...patch.sub, octave: Number(octave) as -1 | -2 } })}
          />
        </div>
      </Section>

      {/* Three levels stacked full width rather than side by side: it is the
          one comparison you make while playing, and a groove the width of the
          panel is 350px of throw where a third of a row was 113px. */}
      <Section label="MIX">
        <div className="bassic-fader-stack">
          <Fader label="OSC 1" position={patch.oscillator1.level} step={0.01} format={formatLevel} onChange={(position) => changeOscillator('oscillator1', { level: roundLevel(position) })} />
          <Fader label="OSC 2" position={patch.oscillator2.level} step={0.01} format={formatLevel} onChange={(position) => changeOscillator('oscillator2', { level: roundLevel(position) })} />
          <Fader label="SUB" position={patch.sub.level} step={0.01} format={formatLevel} onChange={(position) => change({ sub: { ...patch.sub, level: roundLevel(position) } })} />
        </div>
      </Section>

      {/* CUTOFF turns on a logarithmic law rather than the linear one the
          Display page uses: 20 Hz to 20 kHz spread evenly puts every usable
          bass setting inside the first one per cent of the throw. The stored
          value is the same hertz either way, so the two controls stay in
          step - only the feel of the knob is local to this panel. */}
      <Section label="FILTER">
        <div className="bassic-fader-stack">
          <Fader
            label="CUTOFF"
            position={cutoffToPosition(patch.filter.cutoffHz)}
            step={0.004}
            format={(position) => formatFrequency(positionToCutoff(position))}
            onChange={(position) => change({ filter: { ...patch.filter, cutoffHz: Math.round(positionToCutoff(position)) } })}
          />
          <Fader
            label="RESONANCE"
            position={patch.filter.resonance / maximumResonance}
            step={0.005}
            format={(position) => (position * maximumResonance).toFixed(1)}
            onChange={(position) => change({ filter: { ...patch.filter, resonance: Number((position * maximumResonance).toFixed(1)) } })}
          />
        </div>
      </Section>

      <p className="synth-display-hint">FILTER ENV · AMP · LFO · VOICE · PAD → DISPLAY</p>
    </section>
  </>
}

/* Lowest pitch at the left, the way the octave reads on a keyboard. */
const octaves = ['-2', '-1', '0', '1', '2'] as const
const octaveLabels: Partial<Record<typeof octaves[number], string>> = {
  '-2': '-2',
  '-1': '-1',
  '0': '0',
  '1': '+1',
  '2': '+2',
}
const subOctaves = ['-2', '-1'] as const

const minimumCutoffHz = 20
const maximumCutoffHz = 20000
const maximumResonance = 20

function cutoffToPosition(hz: number): number {
  const clamped = Math.min(Math.max(hz, minimumCutoffHz), maximumCutoffHz)
  return Math.log(clamped / minimumCutoffHz) / Math.log(maximumCutoffHz / minimumCutoffHz)
}

function positionToCutoff(position: number): number {
  return minimumCutoffHz * Math.pow(maximumCutoffHz / minimumCutoffHz, position)
}

function OscillatorColumn({ label, oscillator, onChange }: {
  label: string
  oscillator: SynthPatch['oscillator1']
  onChange: (changes: Partial<SynthPatch['oscillator1']>) => void
}) {
  return <Section label={label}>
    <div className="bassic-osc-column">
      <WaveKeys
        ariaLabel={`${label} waveform`}
        value={oscillator.waveform}
        options={synthWaveforms}
        onChange={(waveform) => onChange({ waveform })}
      />
      <DetentSwitch
        ariaLabel={`${label} octave`}
        value={String(oscillator.octave) as typeof octaves[number]}
        options={octaves}
        labels={octaveLabels}
        onChange={(octave) => onChange({ octave: Number(octave) })}
      />
      <Fader
        label="DETUNE"
        bipolar
        position={(oscillator.detuneCents + 50) / 100}
        step={0.01}
        format={formatDetune}
        onChange={(position) => onChange({ detuneCents: Math.round(position * 100 - 50) })}
      />
    </div>
  </Section>
}

/* The legend and the rule it runs into are one line, not a separator with its
   own clearance above and below (R7) - an engraved score across the panel is
   how hardware marks a section, and it costs no height. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return <section className="bassic-section">
    <h3 className="bassic-legend"><span>{label}</span></h3>
    {children}
  </section>
}

/* A waveform is a shape before it is a word, so the keys print the shape. Four
   glyph caps also replace a dropdown that hid three of its four options. */
function WaveKeys<T extends SynthWaveform | SubWaveform>({ ariaLabel, value, options, onChange }: {
  ariaLabel: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return <div className="bassic-wave-keys" role="group" aria-label={ariaLabel}>
    {options.map((option) => (
      <button
        key={option}
        type="button"
        className="bassic-wave-key"
        aria-pressed={option === value}
        aria-label={option.toUpperCase()}
        title={option.toUpperCase()}
        onClick={() => onChange(option)}
      >
        <svg className="bassic-wave-glyph" viewBox="0 0 16 12" aria-hidden="true" focusable="false">
          <path d={wavePaths[option]} />
        </svg>
      </button>
    ))}
  </div>
}

const wavePaths: Record<SynthWaveform, string> = {
  sine: 'M1 6 q3 -4.5 6 0 t6 0',
  triangle: 'M1 10 L4 2 L8 10 L12 2 L15 8',
  sawtooth: 'M1 10 L7 2 L7 10 L13 2 L13 10',
  square: 'M1 10 L4 10 L4 2 L8 2 L8 10 L12 10 L12 2 L15 2',
}

/* A slide switch, not a dropdown and not a pair of caps in a well: the
   positions are printed on the panel and the actuator sits under the engaged
   one. Every position is visible without opening anything. */
function DetentSwitch<T extends string>({ ariaLabel, value, options, labels, onChange }: {
  ariaLabel: string
  value: T
  options: readonly T[]
  labels?: Partial<Record<T, string>>
  onChange: (value: T) => void
}) {
  return <div className="bassic-detents" role="group" aria-label={ariaLabel}>
    {options.map((option) => (
      <button
        key={option}
        type="button"
        className="bassic-detent"
        aria-pressed={option === value}
        onClick={() => onChange(option)}
      >
        {labels?.[option] ?? option}
      </button>
    ))}
  </div>
}

/**
 * The linear pot this panel is built from. Everything it shows is driven from
 * one normalised 0-1 position, so a groove can carry a logarithmic parameter as
 * easily as a linear one; the call site owns the law and the formatting.
 *
 * Two things learned on DRUM SYNTH's faders apply here as well. The native
 * control paints nothing - it is a transparent hit target over a real DOM part
 * positioned from a custom property - and its geometry is declared under
 * .station-shell so the shared range height in layout-tiers.css, which loads
 * last, cannot shrink the target back down.
 */
function Fader({ label, position, step, format, bipolar, onChange }: {
  label: string
  position: number
  step: number
  format: (position: number) => string
  bipolar?: boolean
  onChange: (position: number) => void
}) {
  /* Horizontal, the hook's default: the cap travels left to right and so does
     the thumb. DRUM SYNTH has to declare 'vertical' for the same reason. */
  const drag = useDragSlider({ value: position, min: 0, max: 1, step, onChange, focusLabel: label, formatValue: format })
  return <label className={bipolar ? 'bassic-fader bassic-fader-bipolar' : 'bassic-fader'}>
    <span className="bassic-fader-legend">{label}</span>
    <output>{format(position)}</output>
    <span className="bassic-fader-slot" style={{ '--bs-pos': position } as CSSProperties}>
      <input type="range" value={position} min={0} max={1} step={step} {...drag.inputProps} />
      <span className="bassic-fader-cap" aria-hidden="true" />
    </span>
  </label>
}

function formatLevel(position: number): string {
  return position.toFixed(2)
}

function roundLevel(position: number): number {
  return Math.round(position * 100) / 100
}

function formatDetune(position: number): string {
  const cents = Math.round(position * 100 - 50)
  return `${cents > 0 ? '+' : ''}${cents} ct`
}

function formatFrequency(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz` : `${Math.round(hz)} Hz`
}
