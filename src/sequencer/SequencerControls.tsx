import { useEffect, useMemo, useRef, useState } from 'react'
import type { PatternGroup, PatternVariantName, StepPattern, StepShiftPattern } from '../patterns/patternTypes'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'

interface SequencerControlsProps {
  pattern: StepPattern
  shifts: StepShiftPattern
  pads: readonly Pick<PadState, 'id' | 'label' | 'fileName' | 'synthPatchId'>[]
  selectedPadId: PadState['id']
  group: PatternGroup
  selectedVariant: PatternVariantName
  playingStep: number | null
  onSelectPad: (padId: PadState['id']) => void
  onToggleStep: (padId: PadState['id'], stepIndex: number) => void
  onVelocityChange: (padId: PadState['id'], stepIndex: number, velocity: number) => void
  onShiftChange: (padId: PadState['id'], stepIndex: number, shift: number) => void
}

const displayId = 'seq-step-controls'

function isDimBeatGroup(stepIndex: number): boolean {
  return Math.floor(stepIndex / 4) % 2 === 1
}

export function SequencerControls({ pattern, shifts, pads, selectedPadId, group, selectedVariant, playingStep, onSelectPad, onToggleStep, onVelocityChange, onShiftChange }: SequencerControlsProps) {
  const [editedStep, setEditedStep] = useState({ padId: selectedPadId, stepIndex: 0 })
  const [stepPage, setStepPage] = useState<0 | 1>(0)
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  const hasOwnedDisplayRef = useRef(false)
  const editedPad = pads.find((pad) => pad.id === editedStep.padId) ?? pads[0]
  const velocity = pattern[editedPad.id][editedStep.stepIndex]
  const shift = shifts[editedPad.id][editedStep.stepIndex]
  /* App rebuilds its step handlers on every render, and claiming re-renders
     App. A tenant depending on them directly therefore got a new identity each
     time the claim effect ran, re-claimed, and spun - entering SEQ produced a
     burst of "Maximum update depth exceeded" every time. The handlers are read
     through refs instead, which keeps them out of the dependency list without
     the stale closure that simply dropping them would leave: a step edited
     after a bank or variant change would otherwise be written to whichever
     pattern was selected when the tenant was last built. Same shape as
     EffectDisplay and BusDisplay. */
  const onVelocityChangeRef = useRef(onVelocityChange)
  const onShiftChangeRef = useRef(onShiftChange)
  onVelocityChangeRef.current = onVelocityChange
  onShiftChangeRef.current = onShiftChange
  const tenant = useMemo<DisplayTenant>(() => stepTenant({
    pad: editedPad,
    stepIndex: editedStep.stepIndex,
    velocity,
    shift,
    onVelocityChange: (padId, stepIndex, nextVelocity) => onVelocityChangeRef.current(padId, stepIndex, nextVelocity),
    onShiftChange: (padId, stepIndex, nextShift) => onShiftChangeRef.current(padId, stepIndex, nextShift),
  }), [editedPad, editedStep.stepIndex, velocity, shift])
  const selectStep = (padId: PadState['id'], stepIndex: number) => { setDisplayActive(true); setEditedStep({ padId, stepIndex }); onToggleStep(padId, stepIndex) }
  const pageStartStep = stepPage * 8
  const pageSteps = Array.from({ length: 8 }, (_, offset) => pageStartStep + offset)

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

  // SEQ is deliberately just the pattern matrix. The selected step owns the
  // system display, where its musical detail stays next to playback controls.
  return <section className="sequencer" aria-label={`Sequencer, ${group.name} ${selectedVariant}`}>
    <div className="sequencer-step-pages" role="tablist" aria-label="Step range">
      <button className={stepPage === 0 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 0} onClick={() => setStepPage(0)}>01-08</button>
      <button className={stepPage === 1 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 1} onClick={() => setStepPage(1)}>09-16</button>
    </div>
    <div className="pattern-matrix" aria-label={`Pattern steps ${pageStartStep + 1} through ${pageStartStep + 8}`}>
      <div className="pattern-matrix-row pattern-matrix-header"><span>PAD</span>{pageSteps.map((stepIndex) => <span className={`${playingStep === stepIndex ? 'pattern-step-playing' : ''} ${isDimBeatGroup(stepIndex) ? 'pattern-step-beat-dim' : ''}`} key={stepIndex}>{stepIndex + 1}</span>)}</div>
      {pads.map((pad) => <div className="pattern-matrix-row" key={pad.id}>
        <button className={pad.id === selectedPadId ? 'pattern-pad-label pattern-pad-selected' : 'pattern-pad-label'} type="button" onClick={() => onSelectPad(pad.id)}>{pad.label}<small>{pad.synthPatchId ? 'MONOPOLY' : pad.fileName ?? 'EMPTY'}</small></button>
        {pageSteps.map((stepIndex) => {
          const stepVelocity = pattern[pad.id][stepIndex]
          return <button key={stepIndex} className={`step pattern-step ${stepVelocity ? 'step-active' : ''} ${stepVelocity === 1 ? 'step-full' : ''} ${editedStep.padId === pad.id && editedStep.stepIndex === stepIndex ? 'pattern-step-selected' : ''} ${playingStep === stepIndex ? 'pattern-step-playing' : ''} ${isDimBeatGroup(stepIndex) ? 'pattern-step-beat-dim' : ''}`} type="button" aria-label={`${pad.label}, step ${stepIndex + 1}`} aria-pressed={stepVelocity > 0} onClick={() => selectStep(pad.id, stepIndex)}><small>{stepVelocity ? `${Math.round(stepVelocity * 100)}%` : ''}</small></button>
        })}
      </div>)}
    </div>
  </section>
}

interface StepTenantProps {
  pad: Pick<PadState, 'id' | 'label'>
  stepIndex: number
  velocity: number
  shift: number
  onVelocityChange: (padId: PadState['id'], stepIndex: number, velocity: number) => void
  onShiftChange: (padId: PadState['id'], stepIndex: number, shift: number) => void
}

function stepTenant({ pad, stepIndex, velocity, shift, onVelocityChange, onShiftChange }: StepTenantProps): DisplayTenant {
  return {
    id: displayId,
    label: `${pad.label}, step ${stepIndex + 1}`,
    readout: `SEQ / ${pad.label} / STEP ${stepIndex + 1} / ${Math.round(velocity * 100)}%`,
    panel: <>
      <label className="display-param" htmlFor="seq-step-velocity">
        <span className="display-param-label">VELOCITY</span>
        <output htmlFor="seq-step-velocity">{Math.round(velocity * 100)}%</output>
        <input id="seq-step-velocity" type="range" min="0" max="1" step="0.01" value={velocity} onChange={(event) => onVelocityChange(pad.id, stepIndex, Number(event.target.value))} />
      </label>
      <label className="display-param" htmlFor="seq-step-shift">
        <span className="display-param-label">SHIFT</span>
        <output htmlFor="seq-step-shift">{Math.round(shift * 100)}%</output>
        <input id="seq-step-shift" type="range" min="-0.5" max="0.5" step="0.01" value={shift} onChange={(event) => onShiftChange(pad.id, stepIndex, Number(event.target.value))} />
      </label>
    </>,
  }
}
