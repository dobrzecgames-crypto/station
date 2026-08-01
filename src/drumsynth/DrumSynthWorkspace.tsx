import { kickDecayToSeconds, kickPresetNames, kickTuneToHz } from './drumSynthOperations'
import type { DrumKickPatch } from './drumSynthTypes'
import type { KickPresetName } from './drumSynthOperations'
import './DrumSynthWorkspace.css'

interface DrumSynthWorkspaceProps {
  patch: DrumKickPatch
  audioReady: boolean
  projectBusy: boolean
  onPatchChange: (patch: DrumKickPatch) => void
  onPreset: (name: KickPresetName) => void
  onTrigger: () => void
  onAddToPad: () => void
  onBack: () => void
}

/**
 * DRUM SYNTH's own full-page panel, in the same mainView==='synth' slot as
 * SynthWorkspace/StringsWorkspace but pad-independent - see App.tsx's
 * drumSynthPanelOpen gate. Unlike those two, every control lives directly on
 * this page rather than split into the shared System Display: eight flat
 * parameters have no natural FILTER/AMP/LFO grouping that would need a
 * separate screen, and the brief specifically asked for the primary controls
 * to stay reachable without scrolling into a shared, smaller panel.
 */
export function DrumSynthWorkspace(props: DrumSynthWorkspaceProps) {
  const { patch } = props
  const change = (changes: Partial<DrumKickPatch>) => props.onPatchChange({ ...patch, ...changes })
  const busy = props.projectBusy

  return (
    <section className="drumsynth-workspace" aria-label="DRUM SYNTH KICK editor">
      <div className="drumsynth-back-row">
        <button className="mixer-toggle" type="button" onClick={props.onBack}>← BACK TO SYNTHS</button>
      </div>
      <header className="drumsynth-heading">
        <div>
          <p className="eyebrow">DRUM SYNTH</p>
          <h2>KICK</h2>
        </div>
        <button
          className="drumsynth-trigger"
          type="button"
          disabled={!props.audioReady}
          aria-label="Trigger kick"
          title="Tap to trigger"
          onClick={props.onTrigger}
        />
      </header>

      <div className="drumsynth-preset-row" role="group" aria-label="Starting points">
        {kickPresetNames.map((name) => (
          <button key={name} type="button" className="drumsynth-preset-button" onClick={() => props.onPreset(name)}>{name}</button>
        ))}
      </div>

      <InlineRange label="TUNE" value={patch.tune} format={(value) => `${Math.round(kickTuneToHz(value))} Hz`} onChange={(tune) => change({ tune })} />
      <InlineRange label="PUNCH" value={patch.punch} format={percent} onChange={(punch) => change({ punch })} />
      <InlineRange label="BODY" value={patch.body} format={percent} onChange={(body) => change({ body })} />
      <InlineRange label="CLICK" value={patch.click} format={percent} onChange={(click) => change({ click })} />
      <InlineRange label="DECAY" value={patch.decay} format={(value) => `${kickDecayToSeconds(value).toFixed(2)} s`} onChange={(decay) => change({ decay })} />
      <InlineRange label="TONE" value={patch.tone} format={percent} onChange={(tone) => change({ tone })} />
      <InlineRange label="DRIVE" value={patch.drive} format={percent} onChange={(drive) => change({ drive })} />
      <InlineRange label="DUST" value={patch.dust} format={percent} dust onChange={(dust) => change({ dust })} />

      <button
        className="drumsynth-add-to-pad"
        type="button"
        disabled={!props.audioReady || busy}
        onClick={props.onAddToPad}
      >
        ADD TO PAD
      </button>
    </section>
  )
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function InlineRange({ label, value, format, dust, onChange }: {
  label: string
  value: number
  format: (value: number) => string
  dust?: boolean
  onChange: (value: number) => void
}) {
  return <label className={`drumsynth-inline-range${dust ? ' drumsynth-inline-range-dust' : ''}`}>
    <span>{label}</span>
    <output>{format(value)}</output>
    <input type="range" value={value} min={0} max={1} step={0.01} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
}
