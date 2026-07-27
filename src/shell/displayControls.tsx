/* The parameter row every display tenant uses: name on the left, value on the
   right, control across the full width beneath them. It lived inside the FX
   tenant until the bus tenant needed the same row - see docs/SYSTEM_DISPLAY.md,
   which asks that anything added to the panel reuse this shape rather than
   invent a layout, so a delay and a bus read as the same instrument. */

interface DisplayRangeProps {
  label: string
  value: string
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

export function DisplayRange({ label, value, min, max, step, current, idPrefix, disabled, onChange }: DisplayRangeProps) {
  const id = `${idPrefix}-${label.toLowerCase().replaceAll(' ', '-')}`
  return <label className="display-param" htmlFor={id}>
    <span className="display-param-label">{label}</span>
    <output htmlFor={id}>{value}</output>
    <input id={id} type="range" min={min} max={max} step={step} disabled={disabled} value={current} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
}
