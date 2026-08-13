/* The parameter row every display tenant uses: name on the left, value on the
   right, control across the full width beneath them. It lived inside the FX
   tenant until the bus tenant needed the same row - see docs/SYSTEM_DISPLAY.md,
   which asks that anything added to the panel reuse this shape rather than
   invent a layout, so a delay and a bus read as the same instrument. */

import { useDragSlider } from './useDragSlider'

interface DisplayRangeProps {
  label: string
  /** Formats `current` - and any in-progress value while the slider is being
      dragged - for both this row's own <output> and the System Display's live
      focus readout (see useDragSlider). One formatter rather than a formatted
      string plus a separate function: the two could otherwise drift, one used
      for the resting value and the other for the value mid-drag. */
  formatValue: (value: number) => string
  min: string
  max: string
  step: string
  current: number
  /** Scopes the generated input id, so two tenants using the same label on one
      page do not end up sharing it. */
  idPrefix: string
  disabled?: boolean
  onChange: (value: number) => void
}

export function DisplayRange({ label, formatValue, min, max, step, current, idPrefix, disabled, onChange }: DisplayRangeProps) {
  const id = `${idPrefix}-${label.toLowerCase().replaceAll(' ', '-')}`
  const drag = useDragSlider({
    value: current,
    min: Number(min),
    max: Number(max),
    step: Number(step),
    disabled,
    onChange,
    focusLabel: label,
    formatValue,
  })
  return <label className="display-param" htmlFor={id}>
    <span className="display-param-label">{label}</span>
    <output htmlFor={id}>{formatValue(current)}</output>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={current}
      {...drag.inputProps}
    />
  </label>
}
