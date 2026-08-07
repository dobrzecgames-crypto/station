import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PatternGroup, PatternVariantName, StepPattern, StepShiftPattern, StepLengthPattern } from '../patterns/patternTypes'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { useDragSlider } from '../shell/useDragSlider'
// StepLengthDialog below reuses the enlarged-dialog styling that used to be
// shell/SliderMagnifier.tsx's alone (that component is gone - see
// useDragSlider.ts for what replaced it) - this is now the only importer of
// the stylesheet, so the import has to live here or the dialog goes unstyled.
import '../shell/sliderMagnifier.css'

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
/** A second tap landing on the same cell within this window counts as a
    double-tap; anything slower is two unrelated single taps, each a no-op. */
const doubleTapThresholdMs = 350

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

interface LengthDialogTarget {
  padId: PadState['id']
  stepIndex: number
}

export function SequencerControls({ pattern, shifts, lengths, pads, selectedPadId, group, selectedVariant, playingStep, onSelectPad, onReleasePad, onToggleStep, onVelocityChange, onShiftChange, onLengthChange }: SequencerControlsProps) {
  const [editedStep, setEditedStep] = useState({ padId: selectedPadId, stepIndex: 0 })
  const [stepPage, setStepPage] = useState<0 | 1>(0)
  const [lengthDialogTarget, setLengthDialogTarget] = useState<LengthDialogTarget | null>(null)
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  const hasOwnedDisplayRef = useRef(false)
  /** Identity + timestamp of the last tap on any cell, so the next pointerdown
      can tell a double-tap on the same cell from an unrelated single tap
      elsewhere - see handleStepPointerDown. */
  const lastTapRef = useRef<{ padId: PadState['id']; stepIndex: number; time: number } | null>(null)
  const editedPad = pads.find((pad) => pad.id === editedStep.padId) ?? pads[0]
  const velocity = pattern[editedPad.id][editedStep.stepIndex]
  const shift = shifts[editedPad.id][editedStep.stepIndex]
  const length = lengths[editedPad.id][editedStep.stepIndex]
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

  /**
   * A single tap does nothing. That is deliberate: a finger grazing a step
   * while scrolling past the matrix used to toggle or start resizing a note
   * by accident, and the run of ~40px cells a resize drag needed was exactly
   * as imprecise a target. Only a second tap landing on the same cell within
   * doubleTapThresholdMs counts as a real action:
   * - on an empty cell it places a one-step note and immediately opens the
   *   length dialog to dial in the exact length right there;
   * - on an existing note, anywhere across its span, it selects the note
   *   (so VELOCITY/SHIFT stay reachable from the system display exactly as
   *   before) and opens the same dialog to change its length or remove it.
   * There is no separate drag-to-resize gesture anymore - the dialog is the
   * only way to set a length now, on a new note or an existing one alike.
   */
  const handleStepPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, padId: PadState['id'], stepIndex: number, headIndex: number | null) => {
    event.preventDefault()
    const now = event.timeStamp
    const last = lastTapRef.current
    const isDoubleTap = last !== null && last.padId === padId && last.stepIndex === stepIndex && now - last.time < doubleTapThresholdMs
    if (!isDoubleTap) {
      lastTapRef.current = { padId, stepIndex, time: now }
      return
    }
    lastTapRef.current = null
    if (headIndex === null) {
      onToggleStep(padId, stepIndex)
      selectStep(padId, stepIndex)
      setLengthDialogTarget({ padId, stepIndex })
      return
    }
    selectStep(padId, headIndex)
    setLengthDialogTarget({ padId, stepIndex: headIndex })
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

  const dialogPad = lengthDialogTarget ? pads.find((pad) => pad.id === lengthDialogTarget.padId) : undefined
  const dialogMaxLength = lengthDialogTarget ? maxAvailableLength(pattern[lengthDialogTarget.padId], lengthDialogTarget.stepIndex) : 1
  const dialogLength = lengthDialogTarget ? Math.max(1, Math.min(dialogMaxLength, lengths[lengthDialogTarget.padId][lengthDialogTarget.stepIndex] || 1)) : 1

  // SEQ is deliberately just the pattern matrix. The selected step owns the
  // system display, where its musical detail stays next to playback controls.
  return <section className="sequencer" aria-label={`Sequencer, ${group.name} ${selectedVariant}`}>
    <div className="sequencer-step-pages" role="tablist" aria-label="Step range">
      <button className={stepPage === 0 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 0} onClick={() => setStepPage(0)}>01-08</button>
      <button className={stepPage === 1 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 1} onClick={() => setStepPage(1)}>09-16</button>
    </div>
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
                aria-label={`${pad.label}, step ${stepIndex + 1}${headIndex !== null ? ', double-tap to edit length' : ', double-tap to add'}`}
                aria-pressed={headIndex !== null}
                onPointerDown={(event) => handleStepPointerDown(event, pad.id, stepIndex, headIndex)}
              ><small>{headIndex !== null && !isTail ? `${Math.round(headVelocity * 100)}%` : ''}</small></button>
            )
          })}
        </div>
      })}
    </div>
    {lengthDialogTarget && dialogPad && (
      <StepLengthDialog
        padLabel={dialogPad.label}
        stepIndex={lengthDialogTarget.stepIndex}
        length={dialogLength}
        maxLength={dialogMaxLength}
        onLengthChange={(nextLength) => onLengthChange(lengthDialogTarget.padId, lengthDialogTarget.stepIndex, nextLength)}
        onRemove={() => {
          onToggleStep(lengthDialogTarget.padId, lengthDialogTarget.stepIndex)
          setLengthDialogTarget(null)
        }}
        onClose={() => setLengthDialogTarget(null)}
      />
    )}
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

interface StepLengthDialogProps {
  padLabel: string
  stepIndex: number
  length: number
  maxLength: number
  onLengthChange: (length: number) => void
  onRemove: () => void
  onClose: () => void
}

/** Enlarged-dialog language for the one thing on the step grid a native range
    input can't stand in for by itself - dragging a note across a run of ~40px
    cells asked for more precision than a touch screen gives. This drives
    onLengthChange directly rather than mirroring a hidden native slider: there
    is no small length input anywhere else for it to stay in sync with. Its
    slider still uses useDragSlider for the same relative-drag feel every other
    slider has, but skips that hook's focusLabel/Display integration - the big
    <output> two lines down already is this dialog's live value readout, so a
    second one on the transport line behind it would just say the same thing
    twice. */
function StepLengthDialog({ padLabel, stepIndex, length, maxLength, onLengthChange, onRemove, onClose }: StepLengthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const lengthDrag = useDragSlider({ value: length, min: 1, max: maxLength, step: 1, onChange: onLengthChange })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="slider-magnifier-dialog"
      aria-labelledby="seq-length-dialog-label"
      onCancel={(event) => { event.preventDefault(); onClose() }}
    >
      <div className="slider-magnifier-frame">
        <p className="slider-magnifier-kicker">SEQ / {padLabel} / STEP {stepIndex + 1}</p>
        <h2 id="seq-length-dialog-label">LENGTH</h2>
        <output className="slider-magnifier-value">{length} STEP{length === 1 ? '' : 'S'}</output>
        <input
          type="range"
          autoFocus
          min={1}
          max={maxLength}
          step={1}
          value={length}
          onChange={(event) => onLengthChange(Number(event.target.value))}
          onPointerDown={lengthDrag.onPointerDown}
        />
        <div className="slider-magnifier-actions">
          <button className="slider-magnifier-done slider-magnifier-remove" type="button" onClick={onRemove}>REMOVE</button>
          <button className="slider-magnifier-done" type="button" onClick={onClose}>DONE</button>
        </div>
      </div>
    </dialog>
  )
}
