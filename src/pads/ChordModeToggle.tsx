interface ChordModeToggleProps {
  enabled: boolean
  available: boolean
  onChange: (enabled: boolean) => void
}

export function ChordModeToggle({ enabled, available, onChange }: ChordModeToggleProps) {
  return <button
    className={`pad-chord-mode-toggle${enabled ? ' pad-chord-mode-toggle-active' : ''}`}
    type="button"
    role="switch"
    aria-label="SMART CHORDS"
    aria-checked={enabled}
    disabled={!enabled && !available}
    title={!enabled && !available ? 'SMART CHORDS requires one BASSIC or ZOLA-X instrument mapped across all 16 pads.' : undefined}
    onClick={() => onChange(!enabled)}
  >
    <span className="pad-chord-mode-led" aria-hidden="true" />
    <span>SMART CHORDS</span>
  </button>
}
