/*
 * Tier-3 utility keys shared by the instrument workspaces.
 *
 * Both families paint the same key face (see .station-key in
 * layout-tiers.css) and differ only in mechanical state, which is the
 * distinction INTERFACE_BIBLE.md §3 asks for: a MOMENTARY key must never
 * look latched once its action is done, while a LATCH stays engaged for as
 * long as the surface it revealed is open.
 */

interface MomentaryKeyProps {
  label: string
  ariaLabel?: string
  disabled?: boolean
  onClick: () => void
}

export function MomentaryKey({ label, ariaLabel, disabled, onClick }: MomentaryKeyProps) {
  return <button
    className="station-key"
    data-tier="3"
    data-mechanism="momentary"
    type="button"
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onClick}
  ><span data-mechanism-face>{label}</span></button>
}

interface LatchKeyProps {
  label: string
  engaged: boolean
  ariaLabel?: string
  disabled?: boolean
  onClick: () => void
}

export function LatchKey({ label, engaged, ariaLabel, disabled, onClick }: LatchKeyProps) {
  return <button
    className={engaged ? 'station-key station-key-engaged' : 'station-key'}
    data-tier="3"
    data-mechanism="latch"
    data-engaged={engaged}
    aria-label={ariaLabel}
    aria-expanded={engaged}
    disabled={disabled}
    type="button"
    onClick={onClick}
  ><span data-mechanism-face>{label}</span></button>
}
