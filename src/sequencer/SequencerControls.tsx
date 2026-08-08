import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PatternGroup, PatternVariantName, StepPattern, StepShiftPattern, StepLengthPattern } from '../patterns/patternTypes'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { useDragSlider } from '../shell/useDragSlider'
import './sequencer.css'

interface SequencerControlsProps {
  pattern: StepPattern
  shifts: StepShiftPattern
  lengths: StepLengthPattern
  pads: readonly Pick<PadState, 'id' | 'label' | 'fileName' | 'synthPatchId' | 'stringsPatchId'>[]
  selectedPadId: PadState['id']
  group: PatternGroup
  selectedVariant: PatternVariantName
  playingStep: number | null
  onSelectPad: (padId: PadState['id']) => void
  onReleasePad: (padId: PadState['id']) => void
  onToggleStep: (padId: PadState['id'], stepIndex: number) => void
  onVelocityChange: (padId: PadState['id'], stepIndex: number, velocity: number) => void
  onShiftChange: (padId: PadState['id'], stepIndex: number, shift: number) => void
  onLengthChange: (padId: PadState['id'], stepIndex: number, length: number) => void
}

const displayId = 'seq-step-controls'

function isDimBeatGroup(stepIndex: number): boolean {
  return Math.floor(stepIndex / 4) % 2 === 1
}

/**
 * Which head (if any) owns each step - itself if active, an earlier step's
 * stretched span if covered, else none. A length of 0 (sample, still
 * unbounded from before this feature existed) never visually spans past its
 * own cell - there's no cell count to draw for "play to the end".
 */
function computeStepOwners(steps: readonly number[], lengths: readonly number[]): (number | null)[] {
  const owners: (number | null)[] = Array(steps.length).fill(null)
  for (let head = 0; head < steps.length; head += 1) {
    if (steps[head] <= 0) continue
    const span = lengths[head] > 0 ? Math.max(1, lengths[head]) : 1
    for (let offset = 0; offset < span && head + offset < steps.length; offset += 1) {
      if (owners[head + offset] === null) owners[head + offset] = head
    }
  }
  return owners
}

/** How far a head could stretch right before it would run into another step's own note. */
function maxAvailableLength(steps: readonly number[], headIndex: number): number {
  let span = 1
  for (let index = headIndex + 1; index < steps.length; index += 1) {
    if (steps[index] > 0) break
    span += 1
  }
  return span
}

export function SequencerControls({ pattern, shifts, lengths, pads, selectedPadId, group, selectedVariant, playingStep, onSelectPad, onReleasePad, onToggleStep, onVelocityChange, onShiftChange, onLengthChange }: SequencerControlsProps) {
  const [editedStep, setEditedStep] = useState({ padId: selectedPadId, stepIndex: 0 })
  const [stepPage, setStepPage] = useState<0 | 1>(0)
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  const hasOwnedDisplayRef = useRef(false)
  const editedPad = pads.find((pad) => pad.id === editedStep.padId) ?? pads[0]
  const velocity = pattern[editedPad.id][editedStep.stepIndex]
  const shift = shifts[editedPad.id][editedStep.stepIndex]
  const length = lengths[editedPad.id][editedStep.stepIndex]
  const maximumLength = velocity > 0 ? maxAvailableLength(pattern[editedPad.id], editedStep.stepIndex) : 1
  const visibleLength = Math.max(1, Math.min(maximumLength, length || 1))
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
  const onLengthChangeRef = useRef(onLengthChange)
  onVelocityChangeRef.current = onVelocityChange
  onShiftChangeRef.current = onShiftChange
  onLengthChangeRef.current = onLengthChange
  // stepTenant below is a plain function, not a component (it is built inside
  // useMemo) - it cannot call a hook itself, so the two drags are started here,
  // at the component's own top level, and handed down as plain handlers.
  const velocityDrag = useDragSlider({
    value: velocity,
    min: 0,
    max: 1,
    step: 0.01,
    onChange: (nextVelocity) => onVelocityChangeRef.current(editedPad.id, editedStep.stepIndex, nextVelocity),
    focusLabel: 'VELOCITY',
    formatValue: (value) => `${Math.round(value * 100)}%`,
  })
  const shiftDrag = useDragSlider({
    value: shift,
    min: -0.5,
    max: 0.5,
    step: 0.01,
    onChange: (nextShift) => onShiftChangeRef.current(editedPad.id, editedStep.stepIndex, nextShift),
    focusLabel: 'SHIFT',
    formatValue: (value) => `${Math.round(value * 100)}%`,
  })
  const lengthDrag = useDragSlider({
    value: visibleLength,
    min: 1,
    max: maximumLength,
    step: 1,
    disabled: maximumLength <= 1,
    onChange: (nextLength) => onLengthChangeRef.current(editedPad.id, editedStep.stepIndex, nextLength),
    focusLabel: 'LENGTH',
    formatValue: (value) => `${value} STEP${value === 1 ? '' : 'S'}`,
  })
  const tenant = useMemo<DisplayTenant>(() => stepTenant({
    pad: editedPad,
    stepIndex: editedStep.stepIndex,
    velocity,
    shift,
    length,
    onVelocityChange: (padId, stepIndex, nextVelocity) => onVelocityChangeRef.current(padId, stepIndex, nextVelocity),
    onShiftChange: (padId, stepIndex, nextShift) => onShiftChangeRef.current(padId, stepIndex, nextShift),
    onVelocityPointerDown: velocityDrag.onPointerDown,
    onShiftPointerDown: shiftDrag.onPointerDown,
  }), [editedPad, editedStep.stepIndex, velocity, shift, length, velocityDrag.onPointerDown, shiftDrag.onPointerDown])
  const selectStep = (padId: PadState['id'], stepIndex: number) => { setDisplayActive(true); setEditedStep({ padId, stepIndex }) }
  const pageStartStep = stepPage * 8
  const pageSteps = Array.from({ length: 8 }, (_, offset) => pageStartStep + offset)

  /** Empty cells create a one-step note; an existing head or tail selects its
      note. Length editing stays next to the grid in the inline control below,
      so neither action opens a modal or needs a double-tap gesture. */
  const handleStepClick = (padId: PadState['id'], stepIndex: number, headIndex: number | null) => {
    if (headIndex === null) {
      onToggleStep(padId, stepIndex)
      selectStep(padId, stepIndex)
      return
    }
    selectStep(padId, headIndex)
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
    <div className="sequencer-step-pages" role="tablist" aria-label="Step range">
      <button className={stepPage === 0 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 0} onClick={() => setStepPage(0)}>01-08</button>
      <button className={stepPage === 1 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 1} onClick={() => setStepPage(1)}>09-16</button>
    </div>
    {velocity > 0 && editedStep.stepIndex >= pageStartStep && editedStep.stepIndex < pageStartStep + 8 && (
      <div className="sequencer-length-editor" aria-label={`${editedPad.label}, step ${editedStep.stepIndex + 1} length`}>
        <label className="sequencer-length-slider" htmlFor="seq-inline-length">
          <span><strong>LENGTH</strong><small>{editedPad.label} / STEP {editedStep.stepIndex + 1}</small></span>
          <input id="seq-inline-length" type="range" min="1" max={maximumLength} step="1" value={visibleLength} disabled={maximumLength <= 1} onChange={(event) => onLengthChange(editedPad.id, editedStep.stepIndex, Number(event.target.value))} onPointerDown={lengthDrag.onPointerDown} />
          <output htmlFor="seq-inline-length">{visibleLength} STEP{visibleLength === 1 ? '' : 'S'}</output>
        </label>
        <button className="mixer-toggle sequencer-length-remove" type="button" onClick={() => onToggleStep(editedPad.id, editedStep.stepIndex)}>REMOVE</button>
      </div>
    )}
    <div className="pattern-matrix" aria-label={`Pattern steps ${pageStartStep + 1} through ${pageStartStep + 8}`}>
      <div className="pattern-matrix-row pattern-matrix-header"><span>PAD</span>{pageSteps.map((stepIndex) => <span className={`${playingStep === stepIndex ? 'pattern-step-playing' : ''} ${isDimBeatGroup(stepIndex) ? 'pattern-step-beat-dim' : ''}`} key={stepIndex}>{stepIndex + 1}</span>)}</div>
      {pads.map((pad) => {
        const steps = pattern[pad.id]
        const owners = computeStepOwners(steps, lengths[pad.id])
        return <div className="pattern-matrix-row" key={pad.id}>
          <button
            className={pad.id === selectedPadId ? 'pattern-pad-label pattern-pad-selected' : 'pattern-pad-label'}
            type="button"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onSelectPad(pad.id) }}
            onPointerUp={() => onReleasePad(pad.id)}
            onPointerCancel={() => onReleasePad(pad.id)}
            onLostPointerCapture={() => onReleasePad(pad.id)}
          >{pad.label}<small>{pad.synthPatchId ? 'MONOPOLY' : pad.stringsPatchId ? 'STRINGS' : pad.fileName ?? 'EMPTY'}</small></button>
          {pageSteps.map((stepIndex) => {
            const headIndex = owners[stepIndex]
            const headVelocity = headIndex === null ? 0 : steps[headIndex]
            const isTail = headIndex !== null && headIndex !== stepIndex
            const continues = headIndex !== null && owners[stepIndex + 1] === headIndex
            const className = [
              'step', 'pattern-step',
              headVelocity ? 'step-active' : '',
              headVelocity === 1 ? 'step-full' : '',
              isTail ? 'pattern-step-tail' : '',
              continues ? 'pattern-step-continues' : '',
              headIndex !== null && editedStep.padId === pad.id && editedStep.stepIndex === headIndex ? 'pattern-step-selected' : '',
              playingStep === stepIndex ? 'pattern-step-playing' : '',
              isDimBeatGroup(stepIndex) ? 'pattern-step-beat-dim' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={stepIndex}
                className={className}
                type="button"
                aria-label={`${pad.label}, step ${stepIndex + 1}${headIndex !== null ? `, select note starting at step ${headIndex + 1}` : ', add note'}`}
                aria-pressed={headIndex !== null}
                onClick={() => handleStepClick(pad.id, stepIndex, headIndex)}
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
