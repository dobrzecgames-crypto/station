import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ChangeEvent as ReactChangeEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useSystemDisplay } from './systemDisplayContext'
import {
  COARSE_SENSITIVITY,
  FINE_SENSITIVITY,
  SPEED_CEILING,
  SPEED_FLOOR,
  clamp,
  roundToStep,
  smoothstep,
} from './useDragSlider'
import type { DragSliderInputProps } from './useDragSlider'

/**
 * The turning half of Station's drag mechanics: a control whose part is round
 * and therefore has to answer to a finger going round it. useDragSlider is the
 * straight-line half and stays the default; this is only for a knob.
 *
 * BASSIC learned the hard way why that matters. It was built with rotary pots
 * driven by a vertical drag - the convention in almost every touch synth - and
 * the shape promising one gesture while the control answered to another read as
 * broken under a thumb, however well the drag itself was tuned. The pots came
 * off. MONOGORG has exactly one knob, it is large, and it turns.
 *
 * Everything useDragSlider guarantees still holds here:
 *
 *  - grabbing never jumps the value to where the finger landed - the gesture
 *    starts from whatever the parameter already holds;
 *  - pointer capture (with a document-level fallback when the browser refuses
 *    the id) means the finger can orbit far outside the knob and keep control;
 *  - the value shows live on the System Display line, coalesced to one update
 *    per frame while onChange itself runs at full gesture resolution;
 *  - keyboard (arrow/Home/End) arrives outside a pointer gesture and keeps its
 *    native behaviour.
 *
 * Two things are specific to turning:
 *
 *  1. Precision comes from the radius, for free. The value follows the *angle*,
 *     so orbiting wide covers the same sweep with far more finger travel. No
 *     FINE mode and no perpendicular-drift rule are needed.
 *  2. There is a dead radius at the middle. Angle is meaningless at the centre
 *     of rotation - a finger crossing it flips 180 degrees in one event - so
 *     inside that radius the gesture falls back to useDragSlider's straight
 *     vertical model instead of throwing the value across the range.
 */
export interface RotaryDragOptions {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
  /** Degrees of rotation that cover the whole range - match the knob's printed sweep. */
  sweepDegrees?: number
  /** Shown on the System Display line while the knob is being turned, e.g. "DRIVE". Omit to skip Display integration entirely. */
  focusLabel?: string
  /** Formats a value for that Display line - mirror whatever expression the call site already feeds its own <output>. */
  formatValue?: (value: number) => string
}

/** A 270 degree throw, the same sweep the printed collar draws. */
const DEFAULT_SWEEP_DEGREES = 270
/** Fraction of the knob's radius inside which the angle is too unstable to use. */
const DEAD_RADIUS_FRACTION = .3
/** One move event may not turn the knob further than this. Anything larger is a
    finger crossing the centre, not a genuine sweep, and is dropped. */
const MAXIMUM_STEP_DEGREES = 90

interface RotaryState {
  pointerId: number
  preciseValue: number
  lastCommitted: number
  lastAngle: number
  centerX: number
  centerY: number
  radius: number
  lastY: number
  lastT: number
  cleanup: () => void
}

interface NativeChangeGuard {
  input: HTMLInputElement
  lastCommitted: number
  clearTimer: number | null
}

export function useRotaryDrag(options: RotaryDragOptions): { inputProps: DragSliderInputProps } {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const dragRef = useRef<RotaryState | null>(null)
  const nativeChangeGuardRef = useRef<NativeChangeGuard | null>(null)
  const { showFocus, releaseFocus } = useSystemDisplay()

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
    dragRef.current?.cleanup()
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
    const opts = optionsRef.current
    if (opts.disabled) return
    if (dragRef.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()
    const input = event.currentTarget
    input.focus()
    const previousGuard = nativeChangeGuardRef.current
    if (previousGuard?.clearTimer !== null && previousGuard?.clearTimer !== undefined) window.clearTimeout(previousGuard.clearTimer)
    nativeChangeGuardRef.current = null

    let captured = true
    try {
      input.setPointerCapture(event.pointerId)
    } catch {
      captured = false
    }
    const listenTarget: EventTarget = captured ? input : document

    const rect = input.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const initialRounded = roundToStep(clamp(opts.value, opts.min, opts.max), opts.min, opts.step)

    const state: RotaryState = {
      pointerId: event.pointerId,
      preciseValue: opts.value,
      lastCommitted: initialRounded,
      /* Screen y grows downward, so atan2 measured this way already increases
         clockwise - which is the direction a knob turns up. */
      lastAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
      centerX,
      centerY,
      radius: Math.max(rect.width, rect.height) / 2,
      lastY: event.clientY,
      lastT: event.timeStamp,
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
      const o = optionsRef.current
      const range = o.max - o.min
      const dx = moveEvent.clientX - state.centerX
      const dy = moveEvent.clientY - state.centerY
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      const distance = Math.hypot(dx, dy)
      const dtMs = Math.max(1, moveEvent.timeStamp - state.lastT)
      const verticalDelta = -(moveEvent.clientY - state.lastY)
      state.lastT = moveEvent.timeStamp
      state.lastY = moveEvent.clientY

      /* Near the centre the angle is noise, so the straight model takes over -
         same speed-blended sensitivity as every other Station control, so the
         two halves of the gesture do not feel like different instruments. The
         angle still gets recorded, or leaving the dead radius would count the
         whole crossing as one enormous sweep. */
      if (distance < state.radius * DEAD_RADIUS_FRACTION) {
        state.lastAngle = angle
        if (verticalDelta === 0) return
        const speed = Math.abs(verticalDelta) / dtMs
        const sensitivity = FINE_SENSITIVITY + (COARSE_SENSITIVITY - FINE_SENSITIVITY) * smoothstep(SPEED_FLOOR, SPEED_CEILING, speed)
        commit(state.preciseValue + verticalDelta * sensitivity * range)
        return
      }

      let delta = angle - state.lastAngle
      while (delta > 180) delta -= 360
      while (delta < -180) delta += 360
      state.lastAngle = angle
      if (delta === 0) return
      if (Math.abs(delta) > MAXIMUM_STEP_DEGREES) return

      commit(state.preciseValue + (delta / (o.sweepDegrees ?? DEFAULT_SWEEP_DEGREES)) * range)
    }

    const endDrag = () => {
      listenTarget.removeEventListener('pointermove', handleMove as EventListener)
      listenTarget.removeEventListener('pointerup', handleUp as EventListener)
      listenTarget.removeEventListener('pointercancel', handleUp as EventListener)
      if (captured) input.removeEventListener('lostpointercapture', handleUp as EventListener)
      if (dragRef.current === state) dragRef.current = null
      if (nativeChangeGuardRef.current === nativeGuard && nativeGuard.clearTimer === null) {
        nativeGuard.clearTimer = window.setTimeout(() => {
          if (nativeChangeGuardRef.current === nativeGuard) nativeChangeGuardRef.current = null
        }, 0)
      }
      if (optionsRef.current.focusLabel) {
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

    listenTarget.addEventListener('pointermove', handleMove as EventListener)
    listenTarget.addEventListener('pointerup', handleUp as EventListener)
    listenTarget.addEventListener('pointercancel', handleUp as EventListener)
    if (captured) input.addEventListener('lostpointercapture', handleUp as EventListener)

    if (opts.focusLabel) showFocus(`${opts.focusLabel} ${describe(initialRounded)}`)
  }, [releaseFocus, scheduleFocusUpdate, showFocus])

  const onChange = useCallback((event: ReactChangeEvent<HTMLInputElement>) => {
    const guard = nativeChangeGuardRef.current
    if (guard?.input === event.currentTarget) {
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
    event.preventDefault()
    event.currentTarget.value = String(guard.lastCommitted)
  }, [])

  const inputProps = useMemo<DragSliderInputProps>(() => ({ onPointerDown, onChange, onClick }), [onChange, onClick, onPointerDown])
  return { inputProps }
}
