import { maxChopSliceCount } from '../chop/autoChopOperations'

interface AutoChopControlsProps {
  maxSmartCount: number
  smartCount: number
  isPreviewing: boolean
  /** True while the real-buffer transient/tempo scan (see App.tsx) is still
      running - SMART has nothing to preview yet, so its slider stays put
      instead of flashing a misleading "1 of 1" before real candidates land. */
  analyzing: boolean
  onEqualChop: (count: number) => void
  onSmartCountChange: (count: number) => void
  onApplySmart: () => void
  onCancelSmart: () => void
}

const equalPresets = [4, 8, 16, maxChopSliceCount]

export function AutoChopControls({ maxSmartCount, smartCount, isPreviewing, analyzing, onEqualChop, onSmartCountChange, onApplySmart, onCancelSmart }: AutoChopControlsProps) {
  return (
    <section className="auto-chop-controls" aria-label="Automatic slicing">
      <div className="auto-chop-equal-row">
        <p className="eyebrow">AUTO / EQUAL</p>
        <div className="auto-chop-equal-buttons" role="group" aria-label="Slice into equal parts">
          {equalPresets.map((count) => (
            <button key={count} className="mixer-toggle" type="button" onClick={() => onEqualChop(count)}>{count}</button>
          ))}
        </div>
      </div>
      <div className="auto-chop-smart-row">
        <label className="auto-chop-smart-slider" htmlFor="auto-chop-smart-count">
          <span>SMART</span><output htmlFor="auto-chop-smart-count">{analyzing ? '…' : smartCount}</output>
          <input
            id="auto-chop-smart-count"
            type="range"
            min="1"
            max={maxSmartCount}
            step="1"
            value={smartCount}
            disabled={analyzing || maxSmartCount <= 1}
            onChange={(event) => onSmartCountChange(Number(event.target.value))}
          />
        </label>
        <div className="auto-chop-smart-actions">
          {isPreviewing && <button className="mixer-toggle" type="button" onClick={onCancelSmart}>CANCEL</button>}
          <button className="transport-button" type="button" disabled={!isPreviewing} onClick={onApplySmart}>APPLY</button>
        </div>
      </div>
    </section>
  )
}
