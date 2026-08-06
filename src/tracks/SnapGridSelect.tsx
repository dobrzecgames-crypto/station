import { useRef, useState } from 'react'
import { timelineGridDivisions } from './tracksTypes'
import type { TimelineGridDivision } from './tracksTypes'
import { useOutsideDismiss } from './useOutsideDismiss'

interface SnapGridSelectProps {
  value: TimelineGridDivision
  onChange: (division: TimelineGridDivision) => void
}

function divisionLabel(division: TimelineGridDivision): string {
  return division === 'off' ? 'OFF' : division === '1' ? '1 BAR' : division
}

/**
 * Replaces a row of six always-visible snap-division buttons (only one of
 * which is ever active) with a single closed-by-default selector - see
 * docs/DECISIONS.md DEC-027's third addendum. Opens one column of options
 * below the trigger, never a full-screen sheet, so most of the timeline
 * stays visible underneath; closes on selecting an option, on a pointerdown
 * outside itself, or Escape (useOutsideDismiss). Styled entirely by
 * tracksArranger.css's .tracks-snap-select* rules - like TrackControls.tsx,
 * this component carries no stylesheet of its own and relies on its parent
 * (TracksArranger) having already imported the one that defines its classes.
 */
export function SnapGridSelect({ value, onChange }: SnapGridSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useOutsideDismiss(containerRef, open, () => setOpen(false))

  return (
    <div className="tracks-snap-select" ref={containerRef}>
      <button type="button" className="mixer-toggle tracks-snap-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        SNAP {divisionLabel(value)} <span className="tracks-snap-select-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="tracks-snap-select-menu" role="listbox" aria-label="Snap grid">
          {timelineGridDivisions.map((division) => (
            <button
              key={division}
              type="button"
              role="option"
              aria-selected={value === division}
              className={value === division ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'}
              onClick={() => { onChange(division); setOpen(false) }}
            >
              {divisionLabel(division)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
