interface ChordModeToggleProps {
  enabled: boolean
  available: boolean
  onChange: (enabled: boolean) => void
}

/** The bank's NOTES/CHORDS switch, in the same small hardware-pill language
    PAT/SONG and OVERDUB/REPLACE already use (.mixer-toggle) - a control next
    to the pad grid it governs, sized to its own label rather than a
    dedicated full-width row. Unavailable rather than absent when there's no
    eligible instrument to switch to chords. */
export function ChordModeToggle({ enabled, available, onChange }: ChordModeToggleProps) {
  return <button
    className={enabled ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'}
    type="button"
    role="switch"
    aria-label="SMART CHORDS"
    aria-checked={enabled}
    disabled={!enabled && !available}
    title={!enabled && !available ? 'SMART CHORDS requires one MONOPOLY or STRINGS instrument mapped across all 16 pads.' : undefined}
    onClick={() => onChange(!enabled)}
  >SMART CHORDS</button>
}
