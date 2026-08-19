import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
import { LatchKey, MomentaryKey } from '../shell/UtilityKey'
import { UserSynthPresetControls } from '../synth-presets/UserSynthPresetControls'
import { StringsDisplayLauncher } from './StringsDisplay'
import { stringsCharacters, stringsOctaveLayers, stringsOctaves } from './stringsTypes'
import type { StringsAmpEnvelope, StringsCharacter, StringsOctave, StringsOctaveLayer, StringsPatch } from './stringsTypes'
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

type StringsPage = 'envelope' | 'ensemble' | 'texture'
const pages: readonly StringsPage[] = ['envelope', 'ensemble', 'texture']
const pageLabels: Readonly<Record<StringsPage, string>> = { envelope: 'ENVELOPE', ensemble: 'ENSEMBLE', texture: 'TEXTURE' }

/**
 * STRINGS' own hardware, in BASSIC and DRUM SYNTH's own language rather than a
 * fourth invented one: a flush slide detent for a discrete choice (BASSIC's
 * octave switch), a wide low cap in a cut groove for a parameter that reads
 * best full width (BASSIC's fader), and a dense bay of vertical throws for a
 * page with several parameters compared at a glance (DRUM SYNTH's bank).
 * Nothing here is new material - see the maker/model rule in
 * StringsWorkspace.css. The one part neither of those instruments has is the
 * envelope screen: small and quiet, sized to ATTACK and RELEASE alone.
 */
export function StringsWorkspace(props: StringsWorkspaceProps) {
  const { pad, patch } = props
  const [patchPanelOpen, setPatchPanelOpen] = useState(false)
  const [page, setPage] = useState<StringsPage>('envelope')
  const onReleaseRef = useRef(props.onRelease)
  onReleaseRef.current = props.onRelease

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
      <header className="strings-heading">
        <p className="eyebrow">STRINGS / {pad.label} / {props.usageCount} PAD{props.usageCount === 1 ? '' : 'S'} SHARE PATCH</p>
        <div className="strings-heading-identity">
          <h2>{patch.name}</h2>
          <div className="strings-heading-keys">
            <MomentaryKey label="← SYNTHS" ariaLabel="Back to synths" onClick={props.onBack} />
            <LatchKey label="PATCH" engaged={patchPanelOpen} onClick={() => setPatchPanelOpen((current) => !current)} />
          </div>
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

      {patchPanelOpen && <div className="strings-patch-panel station-card" aria-label="STRINGS patch storage">
        <UserSynthPresetControls kind="strings" instrumentLabel="STRINGS" patch={patch} onApply={props.onPatchChange} />
      </div>}

      {/* Set-once macros stay off the pages entirely: nothing about the voice
          you picked should vanish because you flipped to TEXTURE. CHARACTER
          is the bigger of the two decisions, so it keeps the medium bank;
          OCTAVE and OCTAVE LAYER are the auxiliary pair and take the minor
          one - smaller, quieter, a bank-switch rather than a voice choice. */}
      <Detents<StringsCharacter> ariaLabel="Character" value={patch.character} options={stringsCharacters} onChange={(character) => change({ character })} />

      <div className="strings-macro-row">
        <Detents<StringsOctave> ariaLabel="Octave" value={patch.octave} options={stringsOctaves} format={signed} minor onChange={(octave) => change({ octave })} />
        <Detents<StringsOctaveLayer> ariaLabel="Octave layer" value={patch.octaveLayer} options={stringsOctaveLayers} format={octaveLayerLabel} minor onChange={(octaveLayer) => change({ octaveLayer })} />
      </div>

      <Fader
        label="OCTAVE MIX"
        position={patch.octaveLayerMix}
        step={0.01}
        format={percent}
        disabled={patch.octaveLayer === 'off'}
        onChange={(octaveLayerMix) => change({ octaveLayerMix })}
      />

      <nav className="strings-pages" aria-label="STRINGS control pages">
        {pages.map((candidate) => (
          <button key={candidate} type="button" aria-pressed={candidate === page} onClick={() => setPage(candidate)}>{pageLabels[candidate]}</button>
        ))}
      </nav>

      {page === 'envelope' && <>
        <div className="strings-screen">
          <svg viewBox="0 0 300 84" preserveAspectRatio="none" role="img" aria-label="Amplitude envelope shape">
            <path className="strings-screen-grid" d="M0 22H300M0 52H300" />
            <path className="strings-screen-trace" d={envelopePath(patch.ampEnvelope)} />
          </svg>
        </div>
        <div className="strings-fader-stack">
          <Fader label="ATTACK" position={secondsToPosition(patch.ampEnvelope.attackSeconds, attackRange)} step={0.004} format={(position) => formatSeconds(positionToSeconds(position, attackRange))} onChange={(position) => change({ ampEnvelope: { ...patch.ampEnvelope, attackSeconds: positionToSeconds(position, attackRange) } })} />
          <Fader label="RELEASE" position={secondsToPosition(patch.ampEnvelope.releaseSeconds, releaseRange)} step={0.004} format={(position) => formatSeconds(positionToSeconds(position, releaseRange))} onChange={(position) => change({ ampEnvelope: { ...patch.ampEnvelope, releaseSeconds: positionToSeconds(position, releaseRange) } })} />
        </div>
        <Section label="TONE">
          <div className="strings-fader-stack">
            <Fader label="BRIGHTNESS" position={patch.brightness} step={0.01} format={percent} onChange={(brightness) => change({ brightness })} />
            <Fader label="LEVEL" position={patch.level} step={0.01} format={percent} onChange={(level) => change({ level })} />
          </div>
        </Section>
      </>}

      {page === 'ensemble' && <Bay>
        <VFader label="ENSEMBLE" value={patch.ensemble} format={percent} onChange={(ensemble) => change({ ensemble })} />
        <VFader label="VIBRATO" value={patch.vibrato} format={percent} onChange={(vibrato) => change({ vibrato })} />
        <VFader label="DETUNE" value={patch.detuneCents / 40} format={() => `${patch.detuneCents.toFixed(0)} ct`} onChange={(position) => change({ detuneCents: Math.round(position * 40) })} />
        <VFader label="WIDTH" value={patch.width} format={percent} onChange={(width) => change({ width })} />
      </Bay>}

      {page === 'texture' && <Bay>
        <VFader label="BODY" value={patch.body} format={percent} onChange={(body) => change({ body })} />
        <VFader label="MOTION" value={patch.motion} format={percent} onChange={(motion) => change({ motion })} />
        <VFader label="BOW" value={patch.bow} format={percent} onChange={(bow) => change({ bow })} />
        <VFader label="VIB DELAY" value={patch.vibratoDelayMs / 2000} format={() => `${Math.round(patch.vibratoDelayMs)} ms`} onChange={(position) => change({ vibratoDelayMs: Math.round(position * 2000) })} />
        <VFader label="WARMTH" value={patch.warmth} format={percent} onChange={(warmth) => change({ warmth })} />
        <VFader label="SPACE" value={patch.space} format={percent} onChange={(space) => change({ space })} />
      </Bay>}
    </section>
  </>
}

/* ---- Amp envelope trace ----------------------------------------------------
   Same geometry ZOLA-X's envelope screen already uses - attack rising to a
   peak, decay settling to sustain, sustain holding, release falling away -
   scaled to a 300x84 box instead of a 640x180 one. DECAY and SUSTAIN have no
   control anywhere on STRINGS yet (the old display never exposed them
   either), so the shape uses the patch's stored values but only ATTACK and
   RELEASE get a fader below it. */
function envelopePath(envelope: StringsAmpEnvelope): string {
  const total = Math.max(.2, envelope.attackSeconds + envelope.decaySeconds + envelope.releaseSeconds)
  const attackX = Math.min(.34, .08 + envelope.attackSeconds / total * .36)
  const decayX = Math.min(.68, attackX + .1 + envelope.decaySeconds / total * .28)
  const releaseX = Math.max(.78, 1 - envelope.releaseSeconds / total * .18)
  const sustainY = 78 - envelope.sustain * 66
  return `M 4 78 L ${4 + attackX * 292} 6 L ${4 + decayX * 292} ${sustainY} L ${4 + releaseX * 292} ${sustainY} L 296 78`
}

/* ATTACK and RELEASE keep the same musical ranges the old display used, but a
   fader is a 0-1 position like every other one on this panel, not a raw
   second count - CUTOFF on BASSIC takes the identical approach for its own
   logarithmic law. */
const attackRange = { min: 0.01, max: 5 } as const
const releaseRange = { min: 0.05, max: 8 } as const

function secondsToPosition(seconds: number, range: { min: number; max: number }): number {
  return Math.min(1, Math.max(0, (seconds - range.min) / (range.max - range.min)))
}

function positionToSeconds(position: number, range: { min: number; max: number }): number {
  return range.min + position * (range.max - range.min)
}

/* ---- Section marking --------------------------------------------------- */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return <section className="strings-section">
    <h3 className="strings-legend"><span>{label}</span></h3>
    {children}
  </section>
}

function Bay({ children }: { children: ReactNode }) {
  return <div className="strings-bay">{children}</div>
}

/* ---- Detent switch -------------------------------------------------------
   BASSIC's octave switch, lifted whole: every position printed on the panel,
   the actuator resting under the engaged one, riding an engraved rail. */
function Detents<T extends string | number>({ ariaLabel, value, options, format, disabled, minor, onChange }: {
  ariaLabel: string
  value: T
  options: readonly T[]
  format?: (option: T) => string
  disabled?: boolean
  minor?: boolean
  onChange: (value: T) => void
}) {
  return <div className={minor ? 'strings-detents strings-detents-minor' : 'strings-detents'} data-count={options.length} role="group" aria-label={ariaLabel}>
    {options.map((option) => (
      <button
        key={option}
        type="button"
        className="strings-detent"
        aria-pressed={option === value}
        disabled={disabled}
        onClick={() => onChange(option)}
      >
        {format ? format(option) : String(option).toUpperCase()}
      </button>
    ))}
  </div>
}

/* ---- Horizontal fader ------------------------------------------------------
   BASSIC's own part: a wide low cap riding a groove cut the full width of the
   card. Used here for the handful of parameters that read best full width -
   paired with the envelope screen, or alone under OCTAVE LAYER. */
function Fader({ label, position, step, format, disabled, onChange }: {
  label: string
  position: number
  step: number
  format: (position: number) => string
  disabled?: boolean
  onChange: (position: number) => void
}) {
  const drag = useDragSlider({ value: position, min: 0, max: 1, step, disabled, onChange, focusLabel: label, formatValue: format })
  return <label className={disabled ? 'strings-fader strings-fader-disabled' : 'strings-fader'}>
    <span className="strings-fader-legend">{label}</span>
    <output>{format(position)}</output>
    <span className="strings-fader-slot" style={{ '--st-pos': position } as CSSProperties}>
      <input type="range" value={position} min={0} max={1} step={step} disabled={disabled} {...drag.inputProps} />
      <span className="strings-fader-cap" aria-hidden="true" />
    </span>
  </label>
}

/* ---- Vertical fader --------------------------------------------------------
   DRUM SYNTH's own part: a moulded cap standing in a cut slot, several to a
   bay, for a page where comparing a handful of parameters at a glance matters
   more than any one of them reading full width. */
function VFader({ label, value, format, onChange }: {
  label: string
  value: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  const drag = useDragSlider({ value, min: 0, max: 1, step: 0.01, orientation: 'vertical', onChange, focusLabel: label, formatValue: format })
  return <label className="strings-vfader">
    <span>{label}</span>
    <output>{format(value)}</output>
    <span className="strings-vfader-slot" style={{ '--st-pos': value } as CSSProperties}>
      <input type="range" value={value} min={0} max={1} step={0.01} {...drag.inputProps} />
      <span className="strings-vfader-cap" aria-hidden="true" />
    </span>
  </label>
}

const octaveLayerLabels: Readonly<Record<StringsOctaveLayer, string>> = { off: 'OFF', down: '-1', up: '+1' }
function octaveLayerLabel(value: StringsOctaveLayer): string {
  return octaveLayerLabels[value]
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}

function formatSeconds(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`
}
