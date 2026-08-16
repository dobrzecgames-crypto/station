import type { CSSProperties } from 'react'
import { useDragSlider } from '../shell/useDragSlider'
import { MomentaryKey } from '../shell/UtilityKey'
import { kickDecayToSeconds, kickTuneToHz, snareBodyDecayToSeconds, snareRattleDecayToSeconds, snareTuneToHz } from './drumSynthOperations'
import type { KickPresetName, SnarePresetName } from './drumSynthOperations'
import type { DrumInstrumentType, DrumKickPatch, DrumSnarePatch, DrumSynthState } from './drumSynthTypes'
import './DrumSynthWorkspace.css'

interface DrumSynthWorkspaceProps {
  drumSynth: DrumSynthState
  audioReady: boolean
  projectBusy: boolean
  onSelectInstrument: (instrument: DrumInstrumentType) => void
  onKickPatchChange: (patch: DrumKickPatch) => void
  onKickPreset: (name: KickPresetName) => void
  onSnarePatchChange: (patch: DrumSnarePatch) => void
  onSnarePreset: (name: SnarePresetName) => void
  onTrigger: () => void
  onAddToPad: () => void
  onBack: () => void
}

/**
 * DRUM SYNTH's own full-page panel, in the same mainView==='synth' slot as
 * SynthWorkspace/StringsWorkspace but pad-independent - see App.tsx's
 * drumSynthPanelOpen gate. Unlike those two, every control lives directly on
 * this page rather than split into the shared System Display: eight flat
 * parameters per voice have no natural FILTER/AMP/LFO grouping that would
 * need a separate screen, and the brief specifically asked for the primary
 * controls to stay reachable without scrolling into a shared, smaller panel.
 *
 * Holds both patches (kick and snare) at once and switches which controls
 * render - switching voices is non-destructive, nothing is lost.
 */
export function DrumSynthWorkspace(props: DrumSynthWorkspaceProps) {
  const { drumSynth } = props
  const isSnare = drumSynth.selectedInstrument === 'snare'
  const busy = props.projectBusy

  return (
    <section className="drumsynth-workspace" aria-label={`DRUM SYNTH ${isSnare ? 'SNARE' : 'KICK'} editor`}>
      {isSnare ? (
        <SnareControls patch={drumSynth.snare} onPatchChange={props.onSnarePatchChange} />
      ) : (
        <KickControls patch={drumSynth.kick} onPatchChange={props.onKickPatchChange} />
      )}

      {/* Everything that is not a parameter sits on one line under the bank:
          the machine's name, the voice selector that also states which voice
          is loaded, the audition trigger and the way out. */}
      <footer className="drumsynth-footer">
        <p className="eyebrow">DRUM SYNTH</p>
        <div className="drumsynth-instrument-switch" role="group" aria-label="Choose a drum voice">
          <button type="button" className="drumsynth-instrument-button" aria-pressed={!isSnare} onClick={() => props.onSelectInstrument('kick')}>KICK</button>
          <button type="button" className="drumsynth-instrument-button" aria-pressed={isSnare} onClick={() => props.onSelectInstrument('snare')}>SNARE</button>
        </div>
        <MomentaryKey label="← SYNTHS" ariaLabel="Back to synths" onClick={props.onBack} />
        <button
          className="drumsynth-trigger"
          type="button"
          disabled={!props.audioReady}
          aria-label={`Trigger ${isSnare ? 'snare' : 'kick'}`}
          title="Tap to trigger"
          onClick={props.onTrigger}
        />
      </footer>

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

function KickControls({ patch, onPatchChange }: {
  patch: DrumKickPatch
  onPatchChange: (patch: DrumKickPatch) => void
}) {
  const change = (changes: Partial<DrumKickPatch>) => onPatchChange({ ...patch, ...changes })
  return <div className="drumsynth-controls">
      <div className="drumsynth-bay">
      <InlineRange label="TUNE" value={patch.tune} format={(value) => `${Math.round(kickTuneToHz(value))} Hz`} onChange={(tune) => change({ tune })} />
      <InlineRange label="PUNCH" value={patch.punch} format={percent} onChange={(punch) => change({ punch })} />
      <InlineRange label="BODY" value={patch.body} format={percent} onChange={(body) => change({ body })} />
      <InlineRange label="CLICK" value={patch.click} format={percent} onChange={(click) => change({ click })} />
      <InlineRange label="DECAY" value={patch.decay} format={(value) => `${kickDecayToSeconds(value).toFixed(2)} s`} onChange={(decay) => change({ decay })} />
      <InlineRange label="TONE" value={patch.tone} format={percent} onChange={(tone) => change({ tone })} />
      <InlineRange label="DRIVE" value={patch.drive} format={percent} onChange={(drive) => change({ drive })} />
      <InlineRange label="DUST" value={patch.dust} format={percent} dust onChange={(dust) => change({ dust })} />
      </div>
  </div>
}

function SnareControls({ patch, onPatchChange }: {
  patch: DrumSnarePatch
  onPatchChange: (patch: DrumSnarePatch) => void
}) {
  const change = (changes: Partial<DrumSnarePatch>) => onPatchChange({ ...patch, ...changes })
  return <div className="drumsynth-controls">
      <div className="drumsynth-bay">
      <InlineRange label="TUNE" value={patch.tune} format={(value) => `${Math.round(snareTuneToHz(value))} Hz`} onChange={(tune) => change({ tune })} />
      <InlineRange label="BODY" value={patch.body} format={percent} onChange={(body) => change({ body })} />
      <InlineRange label="SNAP" value={patch.snap} format={percent} onChange={(snap) => change({ snap })} />
      <InlineRange label="RATTLE" value={patch.rattle} format={percent} onChange={(rattle) => change({ rattle })} />
      <InlineRange label="BODY DECAY" value={patch.bodyDecay} format={(value) => `${snareBodyDecayToSeconds(value).toFixed(2)} s`} onChange={(bodyDecay) => change({ bodyDecay })} />
      <InlineRange label="RATTLE DECAY" value={patch.rattleDecay} format={(value) => `${snareRattleDecayToSeconds(value).toFixed(2)} s`} onChange={(rattleDecay) => change({ rattleDecay })} />
      <InlineRange label="TONE" value={patch.tone} format={percent} onChange={(tone) => change({ tone })} />
      <InlineRange label="DUST" value={patch.dust} format={percent} dust onChange={(dust) => change({ dust })} />
      </div>
  </div>
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
  /* The cap travels up and down, so the drag has to as well. Without this the
     hook keeps its horizontal default and a vertical fader only responds to
     sideways movement - MIX declares the same thing for its strip faders. */
  const drag = useDragSlider({ value, min: 0, max: 1, step: 0.01, orientation: "vertical", onChange, focusLabel: label, formatValue: format })
  return <label className={dust ? 'drumsynth-fader drumsynth-fader-dust' : 'drumsynth-fader'}>
    <span>{label}</span>
    <output>{format(value)}</output>
    <span className="drumsynth-fader-slot" style={{ '--ds-pos': value } as CSSProperties}>
      <input type="range" value={value} min={0} max={1} step={0.01} {...drag.inputProps} />
      <span className="drumsynth-fader-cap" aria-hidden="true" />
    </span>
  </label>
}
