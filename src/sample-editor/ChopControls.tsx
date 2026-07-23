import type { SampleSlice } from '../pads/types'

interface ChopControlsProps {
  slices: readonly SampleSlice[]
  activeSliceId: string | null
  addingSlice: boolean
  onStartAdding: () => void
  onSelectSlice: (sliceId: string) => void
  onPreviewSlice: (slice: SampleSlice) => void
  onRemoveActiveCut: () => void
  onClearSlices: () => void
  onAssignSlices: () => void
  showAssign?: boolean
}

export function ChopControls({ slices, activeSliceId, addingSlice, onStartAdding, onSelectSlice, onPreviewSlice, onRemoveActiveCut, onClearSlices, onAssignSlices, showAssign = true }: ChopControlsProps) {
  return (
    <section className="chop-controls" aria-labelledby="chop-title">
      <div className="sequencer-heading">
        <div>
          <p className="eyebrow">CHOP</p>
          <h3 id="chop-title">Manual slices</h3>
        </div>
        <button className={addingSlice ? 'transport-button chop-add-active' : 'transport-button'} type="button" disabled={slices.length >= 16} onClick={onStartAdding}>
          {addingSlice ? 'CLICK WAVEFORM' : 'ADD SLICE'}
        </button>
      </div>
      <p className="chop-help">{addingSlice ? 'Click anywhere on the waveform to add a slice. Click ADD SLICE again when you\'re done.' : slices.length ? `${slices.length} slice${slices.length === 1 ? '' : 's'} - drag the blue markers to move them.` : 'Click ADD SLICE, then click the waveform to create slices.'}</p>
      {slices.length > 0 && (
        <div className="slice-list" aria-label="Slice list">
          {slices.map((slice, index) => (
            <article className={slice.id === activeSliceId ? 'slice-item slice-item-active' : 'slice-item'} key={slice.id}>
              <button className="slice-select" type="button" onClick={() => onSelectSlice(slice.id)}>
                <strong>SLICE {index + 1}</strong><span>{slice.startSeconds.toFixed(3)} - {slice.endSeconds.toFixed(3)} s</span><small>{(slice.endSeconds - slice.startSeconds).toFixed(3)} s</small>
              </button>
              <button className="mixer-toggle" type="button" onClick={() => onPreviewSlice(slice)}>PREVIEW</button>
            </article>
          ))}
        </div>
      )}
      <div className="chop-actions">
        <button className="mixer-toggle" type="button" disabled={slices.length < 2 || !activeSliceId} onClick={onRemoveActiveCut}>REMOVE CUT</button>
        <button className="mixer-toggle" type="button" disabled={slices.length === 0} onClick={onClearSlices}>CLEAR SLICES</button>
        {showAssign && <button className="transport-button" type="button" disabled={slices.length === 0} onClick={onAssignSlices}>ASSIGN SLICES TO PADS</button>}
      </div>
    </section>
  )
}
