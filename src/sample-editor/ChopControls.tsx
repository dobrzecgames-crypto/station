import type { SampleSlice } from '../pads/types'

interface ChopControlsProps {
  slices: readonly SampleSlice[]
  activeSliceId: string | null
  addingSlice: boolean
  disabled?: boolean
  /** Manual ADD SLICE stops here - shared with EQUAL/SMART (see maxChopSliceCount). */
  maxSliceCount: number
  /** Slices from index `mappedSliceCount` on have no pad waiting for them -
      CHOP no longer assumes a slice needs a spot on the (fixed, 16-pad) live
      grid, so they stay listed here for editing/preview only. */
  mappedSliceCount: number
  onStartAdding: () => void
  onSelectSlice: (sliceId: string) => void
  onPreviewSlice: (slice: SampleSlice) => void
  onToggleReversed: (sliceId: string) => void
  onRemoveActiveCut: () => void
  onClearSlices: () => void
  onAssignSlices: () => void
  showAssign?: boolean
}

export function ChopControls({ slices, activeSliceId, addingSlice, disabled = false, maxSliceCount, mappedSliceCount, onStartAdding, onSelectSlice, onPreviewSlice, onToggleReversed, onRemoveActiveCut, onClearSlices, onAssignSlices, showAssign = true }: ChopControlsProps) {
  return (
    <section className="chop-controls" aria-labelledby="chop-title">
      {/* One compact toolbar row instead of a heading block plus two
          full-width action rows - REMOVE/CLEAR keep their full meaning as
          aria-labels even though the visible text is now terse, the same
          trade the per-slice REV/PREVIEW buttons below already make. */}
      <div className="chop-manual-toolbar">
        <p className="eyebrow" id="chop-title">MANUAL SLICES</p>
        <div className="chop-manual-actions">
          <button className={addingSlice ? 'transport-button chop-add-active' : 'transport-button'} type="button" disabled={disabled || slices.length >= maxSliceCount} aria-label={addingSlice ? 'Click waveform to add slice' : 'Add slice'} onClick={onStartAdding}>
            {addingSlice ? 'CLICK WAVEFORM' : '+ ADD'}
          </button>
          <button className="mixer-toggle" type="button" disabled={disabled || slices.length < 2 || !activeSliceId} aria-label="Remove active cut" onClick={onRemoveActiveCut}>− REMOVE</button>
          <button className="mixer-toggle" type="button" disabled={disabled || slices.length === 0} aria-label="Clear all slices" onClick={onClearSlices}>CLEAR</button>
          {showAssign && <button className="transport-button" type="button" disabled={disabled || slices.length === 0} onClick={onAssignSlices}>ASSIGN SLICES TO PADS</button>}
        </div>
      </div>
      {slices.length > 0 && (
        <div className="slice-list" aria-label="Slice list">
          {slices.map((slice, index) => (
            <article className={slice.id === activeSliceId ? 'slice-item slice-item-active' : 'slice-item'} key={slice.id}>
              <button className="slice-select" type="button" disabled={disabled} onClick={() => onSelectSlice(slice.id)}>
                <strong>SLICE {index + 1}</strong><span>{slice.startSeconds.toFixed(3)} - {slice.endSeconds.toFixed(3)} s</span><small>{(slice.endSeconds - slice.startSeconds).toFixed(3)} s</small>
                {index >= mappedSliceCount && <small className="slice-unmapped">NO PAD</small>}
              </button>
              <button className={slice.reversed ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={disabled} aria-pressed={slice.reversed} aria-label={`Reverse slice ${index + 1}`} onClick={() => onToggleReversed(slice.id)}>REV</button>
              <button className="mixer-toggle" type="button" disabled={disabled} onClick={() => onPreviewSlice(slice)}>PREVIEW</button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
