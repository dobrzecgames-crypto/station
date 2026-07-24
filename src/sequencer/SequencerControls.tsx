import { useState } from 'react'
import { patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName, StepPattern, StepShiftPattern } from '../patterns/patternTypes'
import type { PadState } from '../pads/types'
import { Waveform } from '../sample-editor/Waveform'

interface SequencerControlsProps {
  pattern: StepPattern
  shifts: StepShiftPattern
  pads: readonly Pick<PadState, 'id' | 'label' | 'fileName'>[]
  selectedPadId: PadState['id']
  group: PatternGroup
  canDeleteGroup: boolean
  selectedVariant: PatternVariantName
  selectedPad: PadState
  selectedPeaks: readonly number[]
  playheadSeconds: number | null
  playingStep: number | null
  onSelectPad: (padId: PadState['id']) => void
  onNewGroup: () => void
  onDuplicateVariant: (target: PatternVariantName) => void
  onClearVariant: () => void
  onDeleteGroup: () => void
  onToggleStep: (padId: PadState['id'], stepIndex: number) => void
  onVelocityChange: (padId: PadState['id'], stepIndex: number, velocity: number) => void
  onShiftChange: (padId: PadState['id'], stepIndex: number, shift: number) => void
}

export function SequencerControls({ pattern, shifts, pads, selectedPadId, group, canDeleteGroup, selectedVariant, selectedPad, selectedPeaks, playheadSeconds, playingStep, onSelectPad, onNewGroup, onDuplicateVariant, onClearVariant, onDeleteGroup, onToggleStep, onVelocityChange, onShiftChange }: SequencerControlsProps) {
  const duplicateTargets = patternVariantNames.filter((variant) => variant !== selectedVariant)
  const [editedStep, setEditedStep] = useState({ padId: selectedPadId, stepIndex: 0 })
  const editedPad = pads.find((pad) => pad.id === editedStep.padId) ?? pads[0]
  const velocity = pattern[editedPad.id][editedStep.stepIndex]
  const shift = shifts[editedPad.id][editedStep.stepIndex]
  const selectStep = (padId: PadState['id'], stepIndex: number) => { setEditedStep({ padId, stepIndex }); onToggleStep(padId, stepIndex) }

  return <section className="sequencer" aria-labelledby="sequencer-title">
    <div className="sequencer-heading"><div><p className="eyebrow">SEQ</p><h2 id="sequencer-title">{group.name} / {selectedVariant}</h2></div></div>
    <div className="pattern-actions"><button className="transport-button" type="button" onClick={onNewGroup}>NEW GROUP</button><span className="sequence-target">DUPLICATE {selectedVariant} TO</span>{duplicateTargets.map((variant) => <button key={variant} className="mixer-toggle" type="button" onClick={() => onDuplicateVariant(variant)}>{variant}{group.variants[variant] ? ' (REPLACE)' : ''}</button>)}<button className="mixer-toggle" type="button" onClick={onClearVariant}>CLEAR {selectedVariant}</button><button className="clear-button compact-danger" type="button" disabled={!canDeleteGroup} onClick={onDeleteGroup}>DELETE GROUP</button></div>
    <div className="pattern-matrix" aria-label="16-step pattern matrix"><div className="pattern-matrix-row pattern-matrix-header"><span>PAD</span>{Array.from({ length: 16 }, (_, index) => <span className={playingStep === index ? 'pattern-step-playing' : ''} key={index}>{index + 1}</span>)}</div>{pads.map((pad) => <div className="pattern-matrix-row" key={pad.id}><button className={pad.id === selectedPadId ? 'pattern-pad-label pattern-pad-selected' : 'pattern-pad-label'} type="button" onClick={() => onSelectPad(pad.id)}>{pad.label}<small>{pad.fileName ?? 'EMPTY'}</small></button>{pattern[pad.id].map((stepVelocity, stepIndex) => <button key={stepIndex} className={`step pattern-step ${stepVelocity ? 'step-active' : ''} ${stepVelocity === 1 ? 'step-full' : ''} ${editedStep.padId === pad.id && editedStep.stepIndex === stepIndex ? 'pattern-step-selected' : ''} ${playingStep === stepIndex ? 'pattern-step-playing' : ''}`} type="button" aria-label={`${pad.label}, step ${stepIndex + 1}`} aria-pressed={stepVelocity > 0} onClick={() => selectStep(pad.id, stepIndex)}><small>{stepVelocity ? `${Math.round(stepVelocity * 100)}%` : ''}</small></button>)}</div>)}</div>
    {selectedPad.fileName && selectedPad.durationSeconds && <div className="sequencer-waveform"><p className="sequence-target">PLAYHEAD / {selectedPad.label} · {selectedPad.fileName}</p><Waveform peaks={selectedPeaks} durationSeconds={selectedPad.durationSeconds} region={selectedPad.region} slices={[]} activeSliceId={null} addingSlice={false} playheadSeconds={playheadSeconds} readOnly onRegionChange={() => undefined} onAddSlice={() => undefined} onMoveCut={() => undefined} onSelectSlice={() => undefined} /></div>}
    <div className="step-parameter-editor" aria-label="Selected step controls"><strong>{editedPad.label} · STEP {editedStep.stepIndex + 1}</strong><label>VELOCITY <output>{Math.round(velocity * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={velocity} onChange={(event) => onVelocityChange(editedPad.id, editedStep.stepIndex, Number(event.target.value))} /></label><label>SHIFT <output>{Math.round(shift * 100)}%</output><input type="range" min="-0.5" max="0.5" step="0.01" value={shift} onChange={(event) => onShiftChange(editedPad.id, editedStep.stepIndex, Number(event.target.value))} /></label></div>
  </section>
}
