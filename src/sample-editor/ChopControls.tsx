import type { SampleSlice } from '../pads/types'

interface ChopControlsProps {
  slices: readonly SampleSlice[]
  addingSlice: boolean
  disabled?: boolean
  /** Manual ADD SLICE stops here - shared with EQUAL/SMART (see maxChopSliceCount). */
  maxSliceCount: number
  onStartAdding: () => void
  onClearSlices: () => void
  onAssignSlices: () => void
  showAssign?: boolean
}

export function ChopControls({ slices, addingSlice, disabled = false, maxSliceCount, onStartAdding, onClearSlices, onAssignSlices, showAssign = true }: ChopControlsProps) {
  return (
    <section className="chop-controls" aria-labelledby="chop-title">
      {/* Slice selection and per-slice actions live on the waveform/pads and
          System Display. This row is only for editing the slice map itself,
          so a larger chop never grows a second, competing list underneath. */}
      <div className="chop-manual-toolbar">
        <p className="eyebrow" id="chop-title">MANUAL SLICES</p>
        <div className="chop-manual-actions">
          <button className={addingSlice ? 'transport-button chop-add-active' : 'transport-button'} type="button" disabled={disabled || slices.length >= maxSliceCount} aria-label={addingSlice ? 'Click waveform to add slice' : 'Add slice'} onClick={onStartAdding}>
            {addingSlice ? 'CLICK WAVEFORM' : '+ ADD'}
          </button>
          <button className="mixer-toggle" type="button" disabled={disabled || slices.length === 0} aria-label="Clear all slices" onClick={onClearSlices}>CLEAR</button>
          {showAssign && <button className="transport-button" type="button" disabled={disabled || slices.length === 0} onClick={onAssignSlices}>ASSIGN SLICES TO PADS</button>}
        </div>
      </div>
    </section>
  )
}
