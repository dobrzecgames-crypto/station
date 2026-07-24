interface AutoChopControlsProps {
  maxSmartCount: number
  smartCount: number
  isPreviewing: boolean
  onEqualChop: (count: number) => void
  onSmartCountChange: (count: number) => void
  onApplySmart: () => void
  onCancelSmart: () => void
}

const equalPresets = [4, 8, 16]

export function AutoChopControls({ maxSmartCount, smartCount, isPreviewing, onEqualChop, onSmartCountChange, onApplySmart, onCancelSmart }: AutoChopControlsProps) {
  return (
    <section className="auto-chop-controls" aria-label="Automatic slicing">
      <p className="eyebrow">AUTO-SLICE</p>
      <div className="auto-chop-row">
        <span className="auto-chop-row-label">EQUAL</span>
        <div className="auto-chop-equal-buttons" role="group" aria-label="Slice into equal parts">
          {equalPresets.map((count) => (
            <button key={count} className="mixer-toggle" type="button" onClick={() => onEqualChop(count)}>{count}</button>
          ))}
        </div>
      </div>
      <div className="auto-chop-row">
        <label className="auto-chop-smart-slider" htmlFor="auto-chop-smart-count">
          SMART <output htmlFor="auto-chop-smart-count">{smartCount}</output>
          <input
            id="auto-chop-smart-count"
            type="range"
            min="1"
            max={maxSmartCount}
            step="1"
            value={smartCount}
            disabled={maxSmartCount <= 1}
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
