import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName, StepPattern, StepShiftPattern, StepLengthPattern } from '../patterns/patternTypes'
import { getStepEventOwners, getStepEventRange } from '../patterns/stepEvents.ts'
import type { PadState } from '../pads/types'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import { useDragSlider } from '../shell/useDragSlider'
import { getStepPageEdgeContinuationTarget, getStepPageEdgeTarget, sequencerStepPageSize } from './stepPaging.ts'
import './sequencer.css'

interface SequencerControlsProps {
  pattern: StepPattern
  shifts: StepShiftPattern
  lengths: StepLengthPattern
  pads: readonly Pick<PadState, 'id' | 'label' | 'fileName' | 'synthPatchId' | 'stringsPatchId' | 'organicBassPatchId' | 'polyPatchId'>[]
  selectedPadId: PadState['id']
  group: PatternGroup
  selectedVariant: PatternVariantName
  playingStep: number | null
  onSelectPad: (padId: PadState['id']) => void
  onReleasePad: (padId: PadState['id']) => void
  onPaintStep: (padId: PadState['id'], stepIndex: number, shouldExist: boolean) => void
  onPaintStepSpan: (padId: PadState['id'], anchorIndex: number, endIndex: number) => void
  onVelocityChange: (padId: PadState['id'], stepIndex: number, velocity: number) => void
  onShiftChange: (padId: PadState['id'], stepIndex: number, shift: number) => void
}

interface StepPaintStroke {
  padId: PadState['id']
  add: boolean
  pointerId: number
  anchorStepIndex: number
  lastStepIndex: number
}

interface EdgePaintContinuation {
  edgeTarget: number
  direction: -1 | 1
  startedAt: number
  rowTop: number
  rowBottom: number
  boundaryX: number
}

const displayId = 'seq-step-controls'

function isDimBeatGroup(stepIndex: number): boolean {
  return Math.floor(stepIndex / 4) % 2 === 1
}

export function SequencerControls({ pattern, shifts, lengths, pads, selectedPadId, group, selectedVariant, playingStep, onSelectPad, onReleasePad, onPaintStep, onPaintStepSpan, onVelocityChange, onShiftChange }: SequencerControlsProps) {
  const [editedStep, setEditedStep] = useState({ padId: selectedPadId, stepIndex: 0 })
  const [stepPage, setStepPageState] = useState<0 | 1>(0)
  const stepPageRef = useRef<0 | 1>(0)
  const patternMatrixRef = useRef<HTMLDivElement | null>(null)
  const paintStroke = useRef<StepPaintStroke | null>(null)
  const edgePaintContinuation = useRef<EdgePaintContinuation | null>(null)
  const edgePaintFrame = useRef<number | null>(null)
  /* After an edge turn, the same screen coordinate belongs to the far end of
     the newly visible page. Keep that remapped cell gated while edge-hold
     continuation advances through the page in musical order. */
  const pendingPageEntryStep = useRef<number | null>(null)
  const { claim, release, ownerId } = useSystemDisplay()
  const [displayActive, setDisplayActive] = useState(true)
  const hasOwnedDisplayRef = useRef(false)
  const editedPad = pads.find((pad) => pad.id === editedStep.padId) ?? pads[0]
  const editedEvent = getStepEventRange(pattern[editedPad.id], lengths[editedPad.id], editedStep.stepIndex)
  const editedHeadIndex = editedEvent?.headIndex ?? editedStep.stepIndex
  const sectionStartStep = patternVariantNames.indexOf(selectedVariant) * 16
  const editedDisplayStepNumber = sectionStartStep + editedHeadIndex + 1
  const velocity = pattern[editedPad.id][editedHeadIndex]
  const shift = shifts[editedPad.id][editedHeadIndex]
  const length = editedEvent?.length ?? 1
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
    displayStepNumber: editedDisplayStepNumber,
    velocity,
    shift,
    length,
    onVelocityChange: (padId, stepIndex, nextVelocity) => onVelocityChangeRef.current(padId, stepIndex, nextVelocity),
    onShiftChange: (padId, stepIndex, nextShift) => onShiftChangeRef.current(padId, stepIndex, nextShift),
    onVelocityPointerDown: velocityDrag.onPointerDown,
    onShiftPointerDown: shiftDrag.onPointerDown,
  }), [editedPad, editedHeadIndex, editedDisplayStepNumber, velocity, shift, length, velocityDrag.onPointerDown, shiftDrag.onPointerDown])
  const selectStep = (padId: PadState['id'], stepIndex: number) => { setDisplayActive(true); setEditedStep({ padId, stepIndex }) }
  const showStepPage = (page: 0 | 1) => {
    stepPageRef.current = page
    setStepPageState(page)
  }
  const selectStepPage = (page: 0 | 1) => {
    pendingPageEntryStep.current = null
    showStepPage(page)
  }
  const pageStartStep = stepPage * sequencerStepPageSize
  const displayPageStartStep = sectionStartStep + pageStartStep
  const pageSteps = Array.from({ length: sequencerStepPageSize }, (_, offset) => pageStartStep + offset)

  const continuePaintAtStep = (stepIndex: number) => {
    const current = paintStroke.current
    if (!current || stepIndex === current.lastStepIndex) return
    const previousStepIndex = current.lastStepIndex
    current.lastStepIndex = stepIndex
    if (current.add) onPaintStepSpan(current.padId, current.anchorStepIndex, stepIndex)
    else {
      const eraseStart = Math.min(previousStepIndex, stepIndex)
      const eraseEnd = Math.max(previousStepIndex, stepIndex)
      for (let index = eraseStart; index <= eraseEnd; index += 1) onPaintStep(current.padId, index, false)
    }
    selectStep(current.padId, stepIndex)
  }

  const stopEdgePaintContinuation = () => {
    edgePaintContinuation.current = null
    if (edgePaintFrame.current !== null) cancelAnimationFrame(edgePaintFrame.current)
    edgePaintFrame.current = null
  }

  const runEdgePaintContinuation = (timestamp: number) => {
    const continuation = edgePaintContinuation.current
    if (!continuation || !paintStroke.current) {
      stopEdgePaintContinuation()
      return
    }
    const target = getStepPageEdgeContinuationTarget(continuation.edgeTarget, timestamp - continuation.startedAt)
    continuePaintAtStep(target)
    const finalTarget = continuation.direction > 0 ? (sequencerStepPageSize * 2) - 1 : 0
    if (target === finalTarget) {
      stopEdgePaintContinuation()
      return
    }
    edgePaintFrame.current = requestAnimationFrame(runEdgePaintContinuation)
  }

  const startEdgePaintContinuation = (edgeTarget: number, clientY: number, firstCell: DOMRect, lastCell: DOMRect) => {
    stopEdgePaintContinuation()
    const direction: -1 | 1 = edgeTarget >= sequencerStepPageSize ? 1 : -1
    edgePaintContinuation.current = {
      edgeTarget,
      direction,
      startedAt: performance.now(),
      rowTop: Math.min(firstCell.top, lastCell.top),
      rowBottom: Math.max(firstCell.bottom, lastCell.bottom),
      boundaryX: direction > 0 ? lastCell.left : firstCell.right,
    }
    if (clientY >= edgePaintContinuation.current.rowTop && clientY <= edgePaintContinuation.current.rowBottom) {
      edgePaintFrame.current = requestAnimationFrame(runEdgePaintContinuation)
    }
  }

  const paintAt = (pointerId: number, clientX: number, clientY: number) => {
    const current = paintStroke.current
    if (!current || current.pointerId !== pointerId) return
    const continuation = edgePaintContinuation.current
    if (continuation) {
      const stillAtEdge = continuation.direction > 0
        ? clientX >= continuation.boundaryX
        : clientX <= continuation.boundaryX
      if (stillAtEdge && clientY >= continuation.rowTop && clientY <= continuation.rowBottom) return
      stopEdgePaintContinuation()
    }
    const stepElement = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-sequencer-step]')
    const hoveredStepIndex = stepElement?.dataset.padId === current.padId ? Number(stepElement.dataset.stepIndex) : null
    const pendingEntry = pendingPageEntryStep.current
    if (pendingEntry !== null) {
      if (hoveredStepIndex === pendingEntry) pendingPageEntryStep.current = null
      return
    }

    const rowSteps = Array.from(patternMatrixRef.current?.querySelectorAll<HTMLElement>('[data-sequencer-step]') ?? [])
      .filter((element) => element.dataset.padId === current.padId)
    const firstCell = rowSteps[0]
    const lastCell = rowSteps[rowSteps.length - 1]
    if (firstCell && lastCell) {
      const firstBounds = firstCell.getBoundingClientRect()
      const lastBounds = lastCell.getBoundingClientRect()
      const edgeTarget = getStepPageEdgeTarget(stepPageRef.current, clientX, clientY, firstBounds, lastBounds)
      if (edgeTarget !== null) {
        pendingPageEntryStep.current = edgeTarget
        showStepPage(edgeTarget >= sequencerStepPageSize ? 1 : 0)
        continuePaintAtStep(edgeTarget)
        startEdgePaintContinuation(edgeTarget, clientY, firstBounds, lastBounds)
        return
      }
    }

    if (hoveredStepIndex === null || !Number.isInteger(hoveredStepIndex)) return
    continuePaintAtStep(hoveredStepIndex)
  }

  const beginPaint = (event: ReactPointerEvent<HTMLButtonElement>, padId: PadState['id'], stepIndex: number, filled: boolean) => {
    if (paintStroke.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    const add = !filled
    stopEdgePaintContinuation()
    pendingPageEntryStep.current = null
    paintStroke.current = { padId, add, pointerId: event.pointerId, anchorStepIndex: stepIndex, lastStepIndex: stepIndex }
    patternMatrixRef.current?.setPointerCapture(event.pointerId)
    if (add) onPaintStepSpan(padId, stepIndex, stepIndex)
    else onPaintStep(padId, stepIndex, false)
    selectStep(padId, stepIndex)
  }

  const endPaint = (pointerId?: number) => {
    if (pointerId !== undefined && paintStroke.current?.pointerId !== pointerId) return
    stopEdgePaintContinuation()
    paintStroke.current = null
    pendingPageEntryStep.current = null
  }

  useEffect(() => {
    const endStroke = () => endPaint()
    window.addEventListener('pointerup', endStroke)
    window.addEventListener('pointercancel', endStroke)
    return () => {
      window.removeEventListener('pointerup', endStroke)
      window.removeEventListener('pointercancel', endStroke)
    }
  }, [])

  useEffect(() => () => stopEdgePaintContinuation(), [])

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
        <button className={stepPage === 0 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 0} onClick={() => selectStepPage(0)}>{formatStepRange(sectionStartStep + 1, sectionStartStep + 8)}</button>
        <button className={stepPage === 1 ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" role="tab" aria-selected={stepPage === 1} onClick={() => selectStepPage(1)}>{formatStepRange(sectionStartStep + 9, sectionStartStep + 16)}</button>
      </div>
    </div>
    <div
      ref={patternMatrixRef}
      className="pattern-matrix"
      aria-label={`Pattern steps ${displayPageStartStep + 1} through ${displayPageStartStep + sequencerStepPageSize}`}
      onPointerMove={(event) => paintAt(event.pointerId, event.clientX, event.clientY)}
      onPointerUp={(event) => endPaint(event.pointerId)}
      onPointerCancel={(event) => endPaint(event.pointerId)}
      onLostPointerCapture={(event) => endPaint(event.pointerId)}
    >
      <div className="pattern-matrix-row pattern-matrix-header"><span>PAD</span>{pageSteps.map((stepIndex) => <span className={`${playingStep === stepIndex ? 'pattern-step-playing' : ''} ${isDimBeatGroup(stepIndex) ? 'pattern-step-beat-dim' : ''}`} key={stepIndex}>{sectionStartStep + stepIndex + 1}</span>)}</div>
      {pads.map((pad) => {
        const steps = pattern[pad.id]
        const owners = getStepEventOwners(steps, lengths[pad.id])
        const selectedHeadIndex = editedStep.padId === pad.id ? getStepEventRange(steps, lengths[pad.id], editedStep.stepIndex)?.headIndex : undefined
        const padNumber = pad.label.replace(/^PAD\s+/, '')
        const sourceLabel = pad.synthPatchId ? 'BASSIC' : pad.stringsPatchId ? 'STRINGS' : pad.organicBassPatchId ? 'MONOGORG' : pad.polyPatchId ? 'ZOLA-X' : pad.fileName ?? 'EMPTY'
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
                aria-label={`${pad.label}, step ${sectionStartStep + stepIndex + 1}, ${headIndex !== null ? 'active' : 'empty'}`}
                aria-pressed={headIndex !== null}
                data-sequencer-step
                data-pad-id={pad.id}
                data-step-index={stepIndex}
                onPointerDown={(event) => beginPaint(event, pad.id, stepIndex, headIndex !== null)}
                onClick={(event) => {
                  if (event.detail !== 0) return
                  onPaintStep(pad.id, stepIndex, headIndex === null)
                  selectStep(pad.id, stepIndex)
                }}
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
  displayStepNumber: number
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

function stepTenant({ pad, stepIndex, displayStepNumber, velocity, shift, length, onVelocityChange, onShiftChange, onVelocityPointerDown, onShiftPointerDown }: StepTenantProps): DisplayTenant {
  const lengthLabel = length > 0 ? `${length} STEP${length === 1 ? '' : 'S'}` : 'FULL'
  return {
    id: displayId,
    label: `${pad.label}, step ${displayStepNumber}`,
    readout: `SEQ / ${pad.label} / STEP ${displayStepNumber} / ${Math.round(velocity * 100)}% / ${lengthLabel}`,
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

function formatStepRange(start: number, end: number): string {
  return `${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}`
}
