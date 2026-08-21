import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ChangeEvent as ReactChangeEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useSystemDisplay } from './systemDisplayContext'

/**
 * Relative-drag mechanics shared by every <input type="range"> in Station, touch,
 * mouse and pen alike through one Pointer Events code path. This is what replaced
 * SliderMagnifier's popup (shell/SliderMagnifier.tsx, deleted) - instead of swapping
 * the interaction for an enlarged control in a modal, the in-place slider itself now
 * behaves like a hardware groovebox fader:
 *
 *  - grabbing it never jumps the value to the tap position - the gesture starts from
 *    whatever the parameter already holds, and only the finger's own movement from
 *    there changes it (see commit/handleMove below);
 *  - a fast drag covers a lot of range, a slow one dials in fine detail, blended
 *    continuously by the pointer's own speed rather than a separate FINE mode;
 *  - drifting the finger perpendicular to the slider's axis sharpens precision
 *    further, continuously, with a floor so it never fully locks up;
 *  - pointer capture means the gesture keeps controlling this slider no matter how
 *    far off it the finger wanders, and no matter how far past the control's own
 *    (possibly tiny) visual width the finger travels;
 *  - the value shows live on the System Display's line (see systemDisplayContext's
 *    showFocus/releaseFocus) instead of in a dialog.
 *
 * A call site spreads `drag.inputProps` onto its existing <input type="range">.
 * The shared props own pointerdown and filter the native range input/change/click
 * events which some mobile browsers still emit for that same gesture. Keyboard
 * (arrow/Home/End) changes arrive outside a pointer gesture and keep their native
 * behaviour.
 */

export interface DragSliderOptions {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** 'vertical' negates the Y axis so up = increase, matching a fader read bottom-up. Default 'horizontal' (right = increase). */
  orientation?: 'horizontal' | 'vertical'
  disabled?: boolean
  /** Shown on the System Display line while this slider is being dragged, e.g. "FILTER". Omit to skip Display integration entirely. */
  focusLabel?: string
  /** Formats a value for that Display line - mirror whatever expression the call site already feeds its own <output>. The hook never invents formatting of its own (SYSTEM_DISPLAY.md rule 1). */
  formatValue?: (value: number) => string
}

export interface DragSliderInputProps {
  onPointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void
  onChange: (event: ReactChangeEvent<HTMLInputElement>) => void
  onClick: (event: ReactMouseEvent<HTMLInputElement>) => void
}

export interface DragSliderHandlers {
  inputProps: DragSliderInputProps
}

// --- Tuning constants ---------------------------------------------------
// Starting points, calibrated by rough feel rather than a spec - see the comment
// on each. Nothing about the mechanism below depends on these exact numbers.

/** Range-fraction moved per CSS px during a slow, deliberate drag - a whole slider's range takes a few hundred px of patient motion. */
export const FINE_SENSITIVITY = 0.00035
/** Range-fraction moved per CSS px during a brisk drag - calibrated so roughly 1cm (~38 CSS px) of fast motion covers ~20% of the range. */
export const COARSE_SENSITIVITY = 0.0053
/** Below this speed (px/ms) sensitivity is fully fine. */
export const SPEED_FLOOR = 0.05
/** Above this speed (px/ms) sensitivity is fully coarse. Between the two it blends continuously (smoothstep) - no discrete mode switch. */
export const SPEED_CEILING = 0.6
/** Perpendicular distance (px) the ultra-fine falloff decays over - see perpMultiplier in handleMove. */
const PERP_FALLOFF_PX = 35
/** Sensitivity never drops below this fraction of normal even far off-axis - a fully frozen slider would read as broken, not precise. */
const PERP_FLOOR = 0.07

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Decimal places implied by `step` (0.01 -> 2), so rounding to it never leaves float noise like 0.30000000000000004. */
function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0
  const text = step.toString()
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : text.length - dot - 1
}

export function roundToStep(value: number, min: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return value
  const steps = Math.round((value - min) / step)
  return Number((min + steps * step).toFixed(decimalsForStep(step)))
}

interface DragState {
  pointerId: number
  /** Full-precision accumulator, independent of `step` - so a slow drag whose
      per-tick delta is smaller than one step still accumulates instead of being
      rounded away to nothing on every single move event. Only what gets handed to
      onChange is step-rounded. */
  preciseValue: number
  lastCommitted: number
  lastX: number
  lastY: number
  lastT: number
  /** The slider's own cross-axis center in viewport px, captured once at drag
      start so the ultra-fine falloff (#5) measures distance from the control's
      real axis, not from wherever from the gesture happened to begin. */
  axisCenter: number
  cleanup: () => void
}

interface NativeChangeGuard {
  input: HTMLInputElement
  lastCommitted: number
  clearTimer: number | null
}

export function useDragSlider(options: DragSliderOptions): DragSliderHandlers {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const dragRef = useRef<DragState | null>(null)
  // A range input can keep running its own native gesture even after the custom
  // pointer path prevented pointerdown (notably WebKit range controls). Its final
  // input/change may be dispatched during pointerup and is calculated from the
  // release coordinate. Keep the last custom pointermove value around through the
  // release turn so that trailing native event cannot overwrite it.
  const nativeChangeGuardRef = useRef<NativeChangeGuard | null>(null)
  const { showFocus, releaseFocus } = useSystemDisplay()

  // Display re-renders the transport on every showFocus call (SYSTEM_DISPLAY.md
  // rule 6: "a claim on every pointermove would re-render on every frame"). Raw
  // pointermove can fire far faster than that, so the *readout text* is coalesced
  // to at most once per animation frame here - onChange itself is not throttled
  // (see handleMove), so audio parameters still update at full gesture resolution.
  const pendingFocusTextRef = useRef<string | null>(null)
  const focusRafRef = useRef<number | null>(null)
  const flushFocus = useCallback(() => {
    focusRafRef.current = null
    if (pendingFocusTextRef.current !== null) showFocus(pendingFocusTextRef.current)
  }, [showFocus])
  const scheduleFocusUpdate = useCallback((text: string) => {
    pendingFocusTextRef.current = text
    if (focusRafRef.current === null) focusRafRef.current = requestAnimationFrame(flushFocus)
  }, [flushFocus])

  useEffect(() => () => {
    if (focusRafRef.current !== null) cancelAnimationFrame(focusRafRef.current)
    if (nativeChangeGuardRef.current?.clearTimer !== null && nativeChangeGuardRef.current?.clearTimer !== undefined) {
      window.clearTimeout(nativeChangeGuardRef.current.clearTimer)
    }
    // A screen can unmount mid-drag (e.g. switching workspace tabs with a finger
    // still down) - no pointerup ever fires then, so without this the Display
    // would hold a stale readout forever instead of releasing it.
    dragRef.current?.cleanup()
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
    const opts = optionsRef.current
    if (opts.disabled) return
    // A second finger, or a right/middle mouse button, landing on a slider that is
    // already mid-drag should not fight the first gesture for control of it.
    if (dragRef.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    // Blocks the native jump-to-tap-position and native thumb drag - everything
    // from here is this hook's own relative model instead.
    event.preventDefault()
    const input = event.currentTarget
    input.focus()
    const previousGuard = nativeChangeGuardRef.current
    if (previousGuard?.clearTimer !== null && previousGuard?.clearTimer !== undefined) window.clearTimeout(previousGuard.clearTimer)
    nativeChangeGuardRef.current = null
    // A mobile native range can accept setPointerCapture() without throwing yet
    // fail to retain capture. Verify the result instead of treating a non-throw
    // as success; otherwise pointerup outside the input never reaches cleanup and
    // dragRef keeps rejecting every later pointerdown on this slider.
    let captured = false
    try {
      input.setPointerCapture(event.pointerId)
      captured = input.hasPointerCapture(event.pointerId)
    } catch { /* Document listeners remain the complete fallback. */ }
    const listenTarget: EventTarget = captured ? input : document

    const rect = input.getBoundingClientRect()
    const vertical = opts.orientation === 'vertical'
    const initialRounded = roundToStep(clamp(opts.value, opts.min, opts.max), opts.min, opts.step)

    const state: DragState = {
      pointerId: event.pointerId,
      preciseValue: opts.value,
      lastCommitted: initialRounded,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      axisCenter: vertical ? rect.left + rect.width / 2 : rect.top + rect.height / 2,
      cleanup: () => {},
    }
    dragRef.current = state
    const nativeGuard: NativeChangeGuard = { input, lastCommitted: initialRounded, clearTimer: null }
    nativeChangeGuardRef.current = nativeGuard

    const describe = (v: number) => {
      const o = optionsRef.current
      return o.formatValue ? o.formatValue(v) : String(v)
    }

    const commit = (nextPreciseRaw: number) => {
      const o = optionsRef.current
      state.preciseValue = clamp(nextPreciseRaw, o.min, o.max)
      const rounded = clamp(roundToStep(state.preciseValue, o.min, o.step), o.min, o.max)
      if (rounded !== state.lastCommitted) {
        state.lastCommitted = rounded
        nativeGuard.lastCommitted = rounded
        o.onChange(rounded)
      }
      if (o.focusLabel) scheduleFocusUpdate(`${o.focusLabel} ${describe(rounded)}`)
    }

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== state.pointerId) return
      // This active continuous control owns its drag. touch-action is the first
      // line of defence; cancelling the move is the local fallback for mobile
      // native range implementations that still attempt page panning.
      moveEvent.preventDefault()
      const o = optionsRef.current
      const dtMs = Math.max(1, moveEvent.timeStamp - state.lastT)
      const primaryDelta = vertical ? -(moveEvent.clientY - state.lastY) : (moveEvent.clientX - state.lastX)
      const crossPos = vertical ? moveEvent.clientX : moveEvent.clientY
      state.lastX = moveEvent.clientX
      state.lastY = moveEvent.clientY
      state.lastT = moveEvent.timeStamp
      if (primaryDelta === 0) return

      // Speed -> coarse/fine blend (#4). Computed from the *last tick's* motion,
      // not distance-from-gesture-start, so slowing down mid-drag gets finer
      // immediately rather than depending on the drag's average speed so far.
      const speed = Math.abs(primaryDelta) / dtMs
      const velocityT = smoothstep(SPEED_FLOOR, SPEED_CEILING, speed)
      const sensitivity = FINE_SENSITIVITY + (COARSE_SENSITIVITY - FINE_SENSITIVITY) * velocityT

      // Perpendicular distance -> ultra-fine (#5). Exponential falloff with a
      // floor: sensitivity keeps dropping the further off-axis the finger drifts,
      // but never hits a hard wall that would feel like the slider stopped
      // responding.
      const perpDistance = Math.abs(crossPos - state.axisCenter)
      const perpMultiplier = PERP_FLOOR + (1 - PERP_FLOOR) * Math.exp(-perpDistance / PERP_FALLOFF_PX)

      const range = o.max - o.min
      commit(state.preciseValue + primaryDelta * sensitivity * perpMultiplier * range)
    }

    let ended = false
    const endDrag = () => {
      if (ended) return
      ended = true
      listenTarget.removeEventListener('pointermove', handleMove as EventListener)
      document.removeEventListener('pointerup', handleUp as EventListener, true)
      document.removeEventListener('pointercancel', handleUp as EventListener, true)
      if (captured) input.removeEventListener('lostpointercapture', handleUp as EventListener)
      try {
        if (input.hasPointerCapture(state.pointerId)) input.releasePointerCapture(state.pointerId)
      } catch { /* Capture may already have been revoked by the browser. */ }
      if (dragRef.current === state) dragRef.current = null
      // Do not clear the native guard synchronously. A browser-native range
      // input/change/click generated by this release is allowed to finish first;
      // keyboard changes in the next task use the normal onChange path. A zero-
      // delay timer is deliberate here: background tabs may throttle or pause rAF.
      if (nativeChangeGuardRef.current === nativeGuard && nativeGuard.clearTimer === null) {
        nativeGuard.clearTimer = window.setTimeout(() => {
          if (nativeChangeGuardRef.current === nativeGuard) nativeChangeGuardRef.current = null
        }, 0)
      }
      if (optionsRef.current.focusLabel) {
        // A queued focus update must not run after releaseFocus and revive a
        // finished gesture. Flush the final committed value in the right order.
        if (focusRafRef.current !== null) cancelAnimationFrame(focusRafRef.current)
        focusRafRef.current = null
        pendingFocusTextRef.current = null
        const o = optionsRef.current
        showFocus(`${o.focusLabel} ${o.formatValue ? o.formatValue(state.lastCommitted) : String(state.lastCommitted)}`)
        releaseFocus()
      }
    }
    state.cleanup = endDrag

    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== state.pointerId) return
      endDrag()
    }

    // Captured moves stay on the input; uncaptured moves use the document. The
    // terminal listeners always use document capture so pointerup/pointercancel
    // remain observable even if capture is silently lost or another component
    // stops the event while it bubbles.
    listenTarget.addEventListener('pointermove', handleMove as EventListener)
    document.addEventListener('pointerup', handleUp as EventListener, true)
    document.addEventListener('pointercancel', handleUp as EventListener, true)
    // lostpointercapture only ever fires on an element that actually holds
    // capture - meaningless (and never firing) without it.
    if (captured) input.addEventListener('lostpointercapture', handleUp as EventListener)

    // Shown the instant the gesture starts (#8), even before any movement - a tap
    // that never moves leaves the value untouched but still confirms what it was.
    if (opts.focusLabel) showFocus(`${opts.focusLabel} ${describe(initialRounded)}`)
  }, [releaseFocus, scheduleFocusUpdate, showFocus])

  const onChange = useCallback((event: ReactChangeEvent<HTMLInputElement>) => {
    const guard = nativeChangeGuardRef.current
    if (guard?.input === event.currentTarget) {
      // React's range onChange is backed by native input/change events. During
      // our pointer gesture those events are duplicates, not a second source of
      // truth. Reasserting the committed value also prevents a one-frame native
      // thumb jump before the controlled React value is painted again.
      event.preventDefault()
      event.currentTarget.value = String(guard.lastCommitted)
      return
    }
    const nextValue = Number(event.currentTarget.value)
    if (Number.isFinite(nextValue)) optionsRef.current.onChange(nextValue)
  }, [])

  const onClick = useCallback((event: ReactMouseEvent<HTMLInputElement>) => {
    const guard = nativeChangeGuardRef.current
    if (guard?.input !== event.currentTarget) return
    // Touch/pointer release may synthesize a compatibility click. It must not
    // perform a second range-track calculation after pointerup ended the drag.
    event.preventDefault()
    event.currentTarget.value = String(guard.lastCommitted)
  }, [])

  const inputProps = useMemo<DragSliderInputProps>(() => ({ onPointerDown, onChange, onClick }), [onChange, onClick, onPointerDown])
  return { inputProps }
}
