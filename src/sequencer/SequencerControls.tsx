import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PatternGroup, PatternVariantName, StepPattern, StepShiftPattern, StepLengthPattern } from '../patterns/patternTypes'
import { getContiguousActiveStepRange, getStepEventOwners, getStepEventRange } from '../patterns/stepEvents.ts'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { useDragSlider } from '../shell/useDragSlider'
import './sequencer.css'

interface SequencerControlsProps {
  pattern: StepPattern
  shifts: StepShiftPattern
  lengths: StepLengthPattern
  pads: readonly Pick<PadState, 'id' | 'label' | 'fileName' | 'synthPatchId' | 'stringsPatchId' | 'organicBassPatchId'>[]
  selectedPadId: PadState['id']
  group: PatternGroup
  selectedVariant: PatternVariantName
  playingStep: number | null
  onSelectPad: (padId: PadState['id']) => void
  onReleasePad: (padId: PadState['id']) => void
  onToggleStep: (padId: PadState['id'], stepIndex: number) => void
  onVelocityChange: (padId: PadState['id'], stepIndex: number, velocity: number) => void
  onShiftChange: (padId: PadState['id'], stepIndex: number, shift: number) => void
  onMergeSteps: (padId: PadState['id'], stepIndex: number) => void
  onSplitStep: (padId: PadState['id'], stepIndex: number) => void
}

const displayId = 'seq-step-controls'

function isDimBeatGroup(stepIndex: number): boolean {
  return Math.floor(stepIndex / 4) % 2 === 1
}

export function SequencerControls({ pattern, shifts, lengths, pads, selectedPadId, group, selectedVariant, playingStep, onSelectPad, onReleasePad, onToggleStep, onVelocityChange, onShiftChange, onMergeSteps, onSplitStep }: SequencerControlsProps) {
  const [editedStep, setEditedStep] = useState({ padId: selectedPadId, stepIndex: 0 })
  const [stepPage, setStepPage] = useState<0 | 1>(0)
  const [mergeFeedbackId, setMergeFeedbackId] = useState(0)
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  const hasOwnedDisplayRef = useRef(false)
  const editedPad = pads.find((pad) => pad.id === editedStep.padId) ?? pads[0]
  const editedEvent = getStepEventRange(pattern[editedPad.id], lengths[editedPad.id], editedStep.stepIndex)
  const editedHeadIndex = editedEvent?.headIndex ?? editedStep.stepIndex
  const velocity = pattern[editedPad.id][editedHeadIndex]
  const shift = shifts[editedPad.id][editedHeadIndex]
  const length = editedEvent?.length ?? 1
  const activeRun = getContiguousActiveStepRange(pattern[editedPad.id], editedStep.stepIndex)
  const canMerge = !editedEvent?.merged && (activeRun?.length ?? 0) > 1
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
  // stepTenant below is a plain function, not a component (it is built inside
  // useMemo) - it cannot call a hook itself, so the two drags are started here,
  // at the component's own top level, and handed down as plain handlers.
  const velocityDrag = useDragSlider({
    value: velocity,
    min: 0,
    max: 1,
    step: 0.01,
    onChange: (nextVelocity) => onVelocityChangeRef.current(editedPad.id, editedHeadIndex, nextVelocity),
    focusLabel: 'VELOCITY',
    formatValue: (value) => `${Math.round(value * 100)}%`,
  })
  const shiftDrag = useDragSlider({
    value: shift,
    min: -0.5,
    max: 0.5,
    step: 0.01,
    onChange: (nextShift) => onShiftChangeRef.current(editedPad.id, editedHeadIndex, nextShift),
    focusLabel: 'SHIFT',
    formatValue: (value) => `${Math.round(value * 100)}%`,
  })
  const tenant = useMemo<DisplayTenant>(() => stepTenant({
    pad: editedPad,
    stepIndex: editedHeadIndex,
    velocity,
    shift,
    length,
    onVelocityChange: (padId, stepIndex, nextVelocity) => onVelocityChangeRef.current(padId, stepIndex, nextVelocity),
    onShiftChange: (padId, stepIndex, nextShift) => onShiftChangeRef.current(padId, stepIndex, nextShift),
    onVelocityPointerDown: velocityDrag.onPointerDown,
    onShiftPointerDown: shiftDrag.onPointerDown,
  }), [editedPad, editedHeadIndex, velocity, shift, length, velocityDrag.onPointerDown, shiftDrag.onPointerDown])
  const selectStep = (padId: PadState['id'], stepIndex: number) => { setDisplayActive(true); setEditedStep({ padId, stepIndex }) }
  const pageStartStep = stepPage * 8
  const pageSteps = Array.from({ length: 8 }, (_, offset) => pageStartStep + offset)

  /** Empty cells create one-step events. Any merged cell selects its owner. */
  const handleStepClick = (padId: PadState['id'], stepIndex: number, headIndex: number | null) => {
    if (headIndex === null) {
      onToggleStep(padId, stepIndex)
      selectStep(padId, stepIndex)
      return
    }
    selectStep(padId, stepIndex)
  }

  const handleStepDoubleClick = (padId: PadState['id'], headIndex: number | null) => {
    if (headIndex === null) return
    onToggleStep(padId, headIndex)
  }

  const handleMergeAction = () => {
    if (!editedEvent) return
    if (editedEvent.merged) onSplitStep(editedPad.id, editedHeadIndex)
    else if (canMerge) onMergeSteps(editedPad.id, editedHeadIndex)
    else return
    setMergeFeedbackId((current) => current + 1)
  }

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
    <div className="sequencer-toolbar">
      <div className="sequencer-step-pages" role="tablist" aria-label="Step range">
        <button className={stepPage === 0 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 0} onClick={() => setStepPage(0)}>01-08</button>
        <button className={stepPage === 1 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 1} onClick={() => setStepPage(1)}>09-16</button>
      </div>
      <span className="sequencer-toolbar-divider" aria-hidden="true" />
      <div className="sequencer-length-editor" aria-label={editedEvent ? `${editedPad.label}, event starting at step ${editedHeadIndex + 1}` : 'Step event actions'}>
        <button
          className="mixer-toggle sequencer-length-remove"
          type="button"
          disabled={!editedEvent}
          onClick={() => editedEvent && onToggleStep(editedPad.id, editedHeadIndex)}
        >REMOVE</button>
        {/* SCAL is a MOMENTARY action: the hard-plastic face depresses only while
            pressed. Its cool tool flash confirms a completed action without becoming
            a persistent latch state. */}
        <button
          className="sequencer-merge-action"
          type="button"
          data-mechanism="momentary"
          disabled={!editedEvent || (!editedEvent.merged && !canMerge)}
          onClick={handleMergeAction}
        >
          <span className="sequencer-merge-face" data-mechanism-face>
            {mergeFeedbackId > 0 && <i className="sequencer-merge-flash" key={mergeFeedbackId} aria-hidden="true" />}
            <strong>{editedEvent?.merged ? 'ROZDZIEL' : 'SCAL'}</strong>
            <small>{editedEvent ? `${editedPad.label} / ${editedEvent.merged ? `STEPS ${editedHeadIndex + 1}-${editedEvent.endIndex + 1}` : `STEP ${editedHeadIndex + 1}`}` : 'SELECT ACTIVE STEPS'}</small>
            {editedEvent && <span>{editedEvent.length} STEP{editedEvent.length === 1 ? '' : 'S'}</span>}
          </span>
        </button>
      </div>
    </div>
    <div className="pattern-matrix" aria-label={`Pattern steps ${pageStartStep + 1} through ${pageStartStep + 8}`}>
      <div className="pattern-matrix-row pattern-matrix-header"><span>PAD</span>{pageSteps.map((stepIndex) => <span className={`${playingStep === stepIndex ? 'pattern-step-playing' : ''} ${isDimBeatGroup(stepIndex) ? 'pattern-step-beat-dim' : ''}`} key={stepIndex}>{stepIndex + 1}</span>)}</div>
      {pads.map((pad) => {
        const steps = pattern[pad.id]
        const owners = getStepEventOwners(steps, lengths[pad.id])
        const selectedHeadIndex = editedStep.padId === pad.id ? getStepEventRange(steps, lengths[pad.id], editedStep.stepIndex)?.headIndex : undefined
        const padNumber = pad.label.replace(/^PAD\s+/, '')
        const sourceLabel = pad.synthPatchId ? 'MONOPOLY' : pad.stringsPatchId ? 'STRINGS' : pad.organicBassPatchId ? 'MONOGORG' : pad.fileName ?? 'EMPTY'
        return <div className="pattern-matrix-row" key={pad.id}>
          <button
            className={pad.id === selectedPadId ? 'pattern-pad-label pattern-pad-selected' : 'pattern-pad-label'}
            type="button"
            aria-label={`${pad.label}, ${sourceLabel}`}
            title={`${pad.label} · ${sourceLabel}`}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onSelectPad(pad.id) }}
            onPointerUp={() => onReleasePad(pad.id)}
            onPointerCancel={() => onReleasePad(pad.id)}
            onLostPointerCapture={() => onReleasePad(pad.id)}
          >{padNumber}</button>
          {pageSteps.map((stepIndex) => {
            const headIndex = owners[stepIndex]
            const headVelocity = headIndex === null ? 0 : steps[headIndex]
            const isTail = headIndex !== null && headIndex !== stepIndex
            const continues = headIndex !== null && owners[stepIndex + 1] === headIndex
            const isMerged = headIndex !== null && (lengths[pad.id][headIndex] ?? 1) > 1
            const isMergedEnd = isMerged && !continues
            const isSelectedEvent = headIndex !== null && selectedHeadIndex === headIndex
            const className = [
              'step', 'pattern-step',
              headVelocity ? 'step-active' : '',
              headVelocity === 1 ? 'step-full' : '',
              isTail ? 'pattern-step-tail' : '',
              continues ? 'pattern-step-continues' : '',
              isMerged ? 'pattern-step-merged' : '',
              isMerged && !isTail ? 'pattern-step-merged-start' : '',
              isMergedEnd ? 'pattern-step-merged-end' : '',
              isSelectedEvent && !isMerged ? 'pattern-step-selected' : '',
              isSelectedEvent && isMerged ? 'pattern-step-merged-selected' : '',
              playingStep === stepIndex ? 'pattern-step-playing' : '',
              isDimBeatGroup(stepIndex) ? 'pattern-step-beat-dim' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={stepIndex}
                className={className}
                type="button"
                aria-label={`${pad.label}, step ${stepIndex + 1}${headIndex !== null ? `, select event starting at step ${headIndex + 1}; double click to remove` : ', add step'}`}
                aria-pressed={headIndex !== null}
                onClick={() => handleStepClick(pad.id, stepIndex, headIndex)}
                onDoubleClick={() => handleStepDoubleClick(pad.id, headIndex)}
              ><small>{headIndex !== null && !isTail ? `${Math.round(headVelocity * 100)}%` : ''}</small></button>
            )
          })}
        </div>
      })}
    </div>
  </section>
}

interface StepTenantProps {
  pad: Pick<PadState, 'id' | 'label'>
  stepIndex: number
  velocity: number
  shift: number
  length: number
  onVelocityChange: (padId: PadState['id'], stepIndex: number, velocity: number) => void
  onShiftChange: (padId: PadState['id'], stepIndex: number, shift: number) => void
  /** Built by useDragSlider back in SequencerControls, which - unlike this
      plain object-returning function - is allowed to call hooks. */
  onVelocityPointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void
  onShiftPointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void
}

function stepTenant({ pad, stepIndex, velocity, shift, length, onVelocityChange, onShiftChange, onVelocityPointerDown, onShiftPointerDown }: StepTenantProps): DisplayTenant {
  const lengthLabel = length > 0 ? `${length} STEP${length === 1 ? '' : 'S'}` : 'FULL'
  return {
    id: displayId,
    label: `${pad.label}, step ${stepIndex + 1}`,
    readout: `SEQ / ${pad.label} / STEP ${stepIndex + 1} / ${Math.round(velocity * 100)}% / ${lengthLabel}`,
    panel: <>
      <label className="display-param" htmlFor="seq-step-velocity">
        <span className="display-param-label">VELOCITY</span>
        <output htmlFor="seq-step-velocity">{Math.round(velocity * 100)}%</output>
        <input id="seq-step-velocity" type="range" min="0" max="1" step="0.01" value={velocity} onChange={(event) => onVelocityChange(pad.id, stepIndex, Number(event.target.value))} onPointerDown={onVelocityPointerDown} />
      </label>
      <label className="display-param" htmlFor="seq-step-shift">
        <span className="display-param-label">SHIFT</span>
        <output htmlFor="seq-step-shift">{Math.round(shift * 100)}%</output>
        <input id="seq-step-shift" type="range" min="-0.5" max="0.5" step="0.01" value={shift} onChange={(event) => onShiftChange(pad.id, stepIndex, Number(event.target.value))} onPointerDown={onShiftPointerDown} />
      </label>
    </>,
  }
}
