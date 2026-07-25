import { useState } from 'react'
import type { PatternGroup, PatternVariantName, StepPattern, StepShiftPattern } from '../patterns/patternTypes'
import type { PadState } from '../pads/types'
import { Waveform } from '../sample-editor/Waveform'

interface SequencerControlsProps {
  pattern: StepPattern
  shifts: StepShiftPattern
  pads: readonly Pick<PadState, 'id' | 'label' | 'fileName'>[]
  selectedPadId: PadState['id']
  group: PatternGroup
  selectedVariant: PatternVariantName
  selectedPad: PadState
  selectedPeaks: readonly number[]
  playheadSeconds: number | null
  playingStep: number | null
  onSelectPad: (padId: PadState['id']) => void
  onToggleStep: (padId: PadState['id'], stepIndex: number) => void
  onVelocityChange: (padId: PadState['id'], stepIndex: number, velocity: number) => void
  onShiftChange: (padId: PadState['id'], stepIndex: number, shift: number) => void
}

function isDimBeatGroup(stepIndex: number): boolean {
  return Math.floor(stepIndex / 4) % 2 === 1
}

export function SequencerControls({ pattern, shifts, pads, selectedPadId, group, selectedVariant, selectedPad, selectedPeaks, playheadSeconds, playingStep, onSelectPad, onToggleStep, onVelocityChange, onShiftChange }: SequencerControlsProps) {
  const [editedStep, setEditedStep] = useState({ padId: selectedPadId, stepIndex: 0 })
  const editedPad = pads.find((pad) => pad.id === editedStep.padId) ?? pads[0]
  const velocity = pattern[editedPad.id][editedStep.stepIndex]
  const shift = shifts[editedPad.id][editedStep.stepIndex]
  const selectStep = (padId: PadState['id'], stepIndex: number) => { setEditedStep({ padId, stepIndex }); onToggleStep(padId, stepIndex) }

  // No heading here on purpose: the SEQ tab is already highlighted and the
  // transport shows which group and variant is selected, so a "Pattern 1 / A"
  // title only repeated what was on screen twice already.
  return <section className="sequencer" aria-label={`Sequencer, ${group.name} ${selectedVariant}`}>
    <div className="pattern-matrix" aria-label="16-step pattern matrix"><div className="pattern-matrix-row pattern-matrix-header"><span>PAD</span>{Array.from({ length: 16 }, (_, index) => <span className={`${playingStep === index ? 'pattern-step-playing' : ''} ${isDimBeatGroup(index) ? 'pattern-step-beat-dim' : ''}`} key={index}>{index + 1}</span>)}</div>{pads.map((pad) => <div className="pattern-matrix-row" key={pad.id}><button className={pad.id === selectedPadId ? 'pattern-pad-label pattern-pad-selected' : 'pattern-pad-label'} type="button" onClick={() => onSelectPad(pad.id)}>{pad.label}<small>{pad.fileName ?? 'EMPTY'}</small></button>{pattern[pad.id].map((stepVelocity, stepIndex) => <button key={stepIndex} className={`step pattern-step ${stepVelocity ? 'step-active' : ''} ${stepVelocity === 1 ? 'step-full' : ''} ${editedStep.padId === pad.id && editedStep.stepIndex === stepIndex ? 'pattern-step-selected' : ''} ${playingStep === stepIndex ? 'pattern-step-playing' : ''} ${isDimBeatGroup(stepIndex) ? 'pattern-step-beat-dim' : ''}`} type="button" aria-label={`${pad.label}, step ${stepIndex + 1}`} aria-pressed={stepVelocity > 0} onClick={() => selectStep(pad.id, stepIndex)}><small>{stepVelocity ? `${Math.round(stepVelocity * 100)}%` : ''}</small></button>)}</div>)}</div>
    {selectedPad.fileName && selectedPad.durationSeconds && <div className="sequencer-waveform"><p className="sequence-target">PLAYHEAD / {selectedPad.label} · {selectedPad.fileName}</p><Waveform peaks={selectedPeaks} durationSeconds={selectedPad.durationSeconds} region={selectedPad.region} slices={[]} activeSliceId={null} addingSlice={false} playheadSeconds={playheadSeconds} readOnly onRegionChange={() => undefined} onAddSlice={() => undefined} onMoveCut={() => undefined} onSelectSlice={() => undefined} /></div>}
    <div className="step-parameter-editor" aria-label="Selected step controls"><strong>{editedPad.label} · STEP {editedStep.stepIndex + 1}</strong><label>VELOCITY <output>{Math.round(velocity * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={velocity} onChange={(event) => onVelocityChange(editedPad.id, editedStep.stepIndex, Number(event.target.value))} /></label><label>SHIFT <output>{Math.round(shift * 100)}%</output><input type="range" min="-0.5" max="0.5" step="0.01" value={shift} onChange={(event) => onShiftChange(editedPad.id, editedStep.stepIndex, Number(event.target.value))} /></label></div>
  </section>
}
