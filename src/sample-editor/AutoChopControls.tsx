import { useEffect, useRef, useState } from 'react'

interface AutoChopControlsProps {
  maxSmartCount: number
  smartCount: number
  isPreviewing: boolean
  /** True while the real-buffer transient/tempo scan (see App.tsx) is still
      running - CUT has nothing to preview yet, so its slider stays put
      instead of flashing a misleading "1 of 1" before real candidates land. */
  analyzing: boolean
  onSmartCountChange: (count: number) => void
  onApplySmart: () => void
  onCancelSmart: () => void
}

/** How long the beam stays in its brighter "moving" state after the last
    change - not a continuous animation, just a short settle-down window. */
const movingSettleMs = 220

export function AutoChopControls({ maxSmartCount, smartCount, isPreviewing, analyzing, onSmartCountChange, onApplySmart, onCancelSmart }: AutoChopControlsProps) {
  const [moving, setMoving] = useState(false)
  const movingTimeoutRef = useRef<number | null>(null)
  useEffect(() => () => { if (movingTimeoutRef.current !== null) window.clearTimeout(movingTimeoutRef.current) }, [])

  const handleSmartCountChange = (count: number) => {
    onSmartCountChange(count)
    setMoving(true)
    if (movingTimeoutRef.current !== null) window.clearTimeout(movingTimeoutRef.current)
    movingTimeoutRef.current = window.setTimeout(() => setMoving(false), movingSettleMs)
  }

  // 1..maxSmartCount mapped to 0-100% along the track - the same value the
  // native input already renders itself at, just mirrored onto the overlay.
  const headPercent = maxSmartCount > 1 ? ((smartCount - 1) / (maxSmartCount - 1)) * 100 : 0

  return (
    <section className="auto-chop-controls" aria-label="Automatic slicing">
      <div className="auto-chop-smart-row">
        <label className="auto-chop-smart-slider" htmlFor="auto-chop-smart-count">
          <span>CUT</span><output htmlFor="auto-chop-smart-count">{analyzing ? '…' : smartCount}</output>
          {/* The real input stays exactly what it was - same id, type, min/max/
              step/value/onChange - so SliderMagnifier (global touch listener on
              every input[type=range], see shell/SliderMagnifier.tsx) keeps
              working unchanged. Only its own paint becomes invisible (see CSS);
              the head+beam is a decorative, pointer-events:none SVG mirroring
              the same value on top, never a replacement for the control. */}
          <span className="cut-laser-track">
            <input
              id="auto-chop-smart-count"
              type="range"
              min="1"
              max={maxSmartCount}
              step="1"
              value={smartCount}
              disabled={analyzing || maxSmartCount <= 1}
              onChange={(event) => handleSmartCountChange(Number(event.target.value))}
            />
            <svg
              className={moving ? 'cut-laser-head cut-laser-head-moving' : 'cut-laser-head'}
              style={{ left: `${headPercent}%` }}
              viewBox="0 0 14 26"
              aria-hidden="true"
              focusable="false"
            >
              <line className="cut-laser-beam" x1="7" y1="7" x2="7" y2="26" />
              <path className="cut-laser-emitter" d="M2 0 H12 L9.5 7 H4.5 Z" />
              <line className="cut-laser-slit" x1="7" y1="1.5" x2="7" y2="5.5" />
            </svg>
          </span>
        </label>
        <div className="auto-chop-smart-actions">
          {isPreviewing && <button className="mixer-toggle" type="button" onClick={onCancelSmart}>CANCEL</button>}
          <button className="transport-button" type="button" disabled={!isPreviewing} onClick={onApplySmart}>SET</button>
        </div>
      </div>
    </section>
  )
}
