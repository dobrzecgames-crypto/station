import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import './sliderMagnifier.css'

/**
 * Every slider in Station is a native <input type="range"> a few pixels tall -
 * fine for a mouse, too thin to land precisely with a finger. Mounted once at
 * the app root, this listens for a touch tap landing on any of them, anywhere
 * in the app, and swaps the interaction for a thumb-sized control in a modal
 * instead of the sliver the workspace actually renders.
 *
 * It never needs to know what a given slider means: it reads the same label
 * and value text the small control already shows (via the <output> every
 * DisplayRange-style row already pairs with its <input>, see
 * shell/displayControls.tsx) and mirrors drags back onto the real element
 * through a dispatched native event, so the workspace's own onChange fires
 * exactly as if the tiny slider had been dragged by hand. No call site has to
 * opt in or change.
 */
export function SliderMagnifier() {
  const [target, setTarget] = useState<MagnifierTarget | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      const input = event.target
      if (!(input instanceof HTMLInputElement) || input.type !== 'range' || input.disabled) return
      // The dialog's own enlarged range is also an input[type="range"] - without
      // this guard every drag inside the magnifier immediately reopens (and
      // preventDefaults) itself, which is why dragging it did nothing.
      if (input.closest('.slider-magnifier-dialog')) return
      // Stops the native slider from jumping to the tap position or starting
      // its own drag - the real adjustment happens in the dialog instead.
      event.preventDefault()
      setTarget(describeSlider(input))
    }
    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
  }, [])

  if (!target) return null
  return <MagnifierDialog target={target} onClose={() => setTarget(null)} />
}

interface MagnifierTarget {
  input: HTMLInputElement
  label: string
  min: number
  max: number
  step: number
  output: HTMLOutputElement | null
}

function describeSlider(input: HTMLInputElement): MagnifierTarget {
  return {
    input,
    label: input.getAttribute('aria-label') ?? findLabelText(input),
    min: Number(input.min) || 0,
    max: Number(input.max) || 100,
    step: Number(input.step) || 1,
    output: findAssociatedOutput(input),
  }
}

/** Every hand-built slider row pairs the input with a <span> naming it, either
    wrapping it directly or via htmlFor - see the DisplayRange, TempoPanel,
    SoundControl and per-instrument inline-range shapes this mirrors. */
function findLabelText(input: HTMLInputElement): string {
  const label = input.closest('label') ?? (input.id ? document.querySelector(`label[for="${input.id}"]`) : null)
  const span = label?.querySelector('span')
  return span?.textContent?.trim() || label?.textContent?.trim() || 'VALUE'
}

/** Mirrors the mixer fader shape too, where the <output> is a sibling several
    levels up rather than inside the same <label> - see Mixer.tsx. */
function findAssociatedOutput(input: HTMLInputElement): HTMLOutputElement | null {
  if (input.id) {
    const linked = document.querySelector(`output[for="${input.id}"]`)
    if (linked instanceof HTMLOutputElement) return linked
  }
  let container = input.parentElement
  for (let depth = 0; depth < 6 && container; depth += 1) {
    const output = container.querySelector('output')
    if (output) return output
    container = container.parentElement
  }
  return null
}

/** The standard trick for making a React-controlled input notice a value set
    from outside React: writing straight to `.value` leaves React's tracker
    holding the old value, so its change detection sees no difference and
    drops the event. Going through the native setter first, then dispatching a
    real event, is indistinguishable from the user having dragged it by hand. */
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!

function MagnifierDialog({ target, onClose }: { target: MagnifierTarget; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(() => Number(target.input.value))
  const [valueText, setValueText] = useState(() => target.output?.textContent?.trim() || String(value))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  // The small slider's <output> already carries whatever formatting that
  // workspace uses - percent, seconds, semitones - so reading it back is
  // simpler than reimplementing those rules here. flushSync forces the real
  // component's re-render to happen (and land in the DOM) before it returns,
  // instead of on React's own batched schedule, so the number on screen
  // updates in the same tick as the drag rather than trailing behind it.
  const applyValue = (next: number) => {
    setValue(next)
    flushSync(() => {
      nativeInputValueSetter.call(target.input, String(next))
      target.input.dispatchEvent(new Event('input', { bubbles: true }))
      target.input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const text = target.output?.textContent?.trim()
    setValueText(text || String(next))
  }

  return (
    <dialog
      ref={dialogRef}
      className="slider-magnifier-dialog"
      aria-labelledby="slider-magnifier-label"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="slider-magnifier-frame">
        <p className="slider-magnifier-kicker">STATION / ADJUST</p>
        <h2 id="slider-magnifier-label">{target.label}</h2>
        <output className="slider-magnifier-value">{valueText}</output>
        <input
          type="range"
          autoFocus
          min={target.min}
          max={target.max}
          step={target.step}
          value={value}
          onChange={(event) => applyValue(Number(event.target.value))}
        />
        <button className="slider-magnifier-done" type="button" onClick={onClose}>DONE</button>
      </div>
    </dialog>
  )
}
