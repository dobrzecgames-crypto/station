import type { ChangeEvent } from 'react'
import { PadGrid } from '../pads/PadGrid'
import type { PadState, SampleSlice } from '../pads/types'
import { ChopControls } from '../sample-editor/ChopControls'
import { Waveform } from '../sample-editor/Waveform'

interface ChopWorkspaceProps {
  pads: PadState[]
  selectedPadId: string
  activePadId: string | null
  audioReady: boolean
  sourceFileName: string | null
  sourceDurationSeconds: number | null
  peaks: readonly number[]
  playheadSeconds: number | null
  slices: readonly SampleSlice[]
  activeSliceId: string | null
  addingSlice: boolean
  onLoadSource: (event: ChangeEvent<HTMLInputElement>) => void
  cutOnPadTrigger: boolean
  onCutOnPadTriggerChange: (enabled: boolean) => void
  loadingTest: boolean
  onLoadTest: () => void
  sourcePreviewing: boolean
  onPreviewSource: () => void
  onStopPreviewSource: () => void
  onTriggerPad: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
  onAddSlice: (timeSeconds: number) => void
  onMoveCut: (cutIndex: number, timeSeconds: number) => void
  onSelectSlice: (sliceId: string) => void
  onPreviewSlice: (slice: SampleSlice) => void
  onToggleAdding: () => void
  onRemoveActiveCut: () => void
  onClearSlices: () => void
}

export function ChopWorkspace({ pads, selectedPadId, activePadId, audioReady, sourceFileName, sourceDurationSeconds, peaks, playheadSeconds, slices, activeSliceId, addingSlice, onLoadSource, cutOnPadTrigger, onCutOnPadTriggerChange, loadingTest, onLoadTest, sourcePreviewing, onPreviewSource, onStopPreviewSource, onTriggerPad, onFeedbackEnd, onAddSlice, onMoveCut, onSelectSlice, onPreviewSlice, onToggleAdding, onRemoveActiveCut, onClearSlices }: ChopWorkspaceProps) {
  const hasSource = sourceFileName !== null && sourceDurationSeconds !== null

  return <section className="chop-workspace" aria-labelledby="chop-workspace-title">
    <div className="sequencer-heading">
      <div><p className="eyebrow">CHOP WORKSPACE</p><h2 id="chop-workspace-title">Chop a sample onto your pads</h2></div>
      <div className="source-preview-controls"><button className="transport-button" type="button" disabled={!audioReady || !hasSource || sourcePreviewing} onClick={onPreviewSource}>PREVIEW</button><button className="mixer-toggle" type="button" disabled={!sourcePreviewing} onClick={onStopPreviewSource}>STOP PREVIEW</button></div>
    </div>
    <div className="chop-source-actions">
      <label className="file-picker chop-source-picker"><span>LOAD A SAMPLE</span><span className="file-picker-button">CHOOSE WAV FILE<input type="file" accept="audio/wav,.wav" disabled={!audioReady} onChange={onLoadSource} /></span></label>
      {!hasSource && <button className="mixer-toggle chop-test-button" type="button" disabled={!audioReady || loadingTest} onClick={onLoadTest}>{loadingTest ? 'LOADING…' : 'TRY THE TEST LOOP'}</button>}
    </div>
    <label className="chop-cut-toggle"><input type="checkbox" checked={cutOnPadTrigger} onChange={(event) => onCutOnPadTriggerChange(event.target.checked)} /><span><strong>ONE PAD AT A TIME</strong><small>Playing a new pad stops the one before it, instead of letting them overlap.</small></span></label>
    {!hasSource ? <p className="sample-editor-empty">Load the test loop or your own WAV file. It won't take up a pad until you add slices.</p> : <>
      <p className="sample-editor-file">{sourceFileName} - {sourceDurationSeconds.toFixed(3)} s</p>
      <Waveform peaks={peaks} durationSeconds={sourceDurationSeconds} region={{ startSeconds: 0, endSeconds: sourceDurationSeconds }} slices={slices} activeSliceId={activeSliceId} addingSlice={addingSlice} playheadSeconds={playheadSeconds} onRegionChange={() => undefined} onAddSlice={onAddSlice} onMoveCut={onMoveCut} onSelectSlice={onSelectSlice} sliceMarkersDraggable />
      <ChopControls slices={slices} activeSliceId={activeSliceId} addingSlice={addingSlice} onStartAdding={onToggleAdding} onSelectSlice={onSelectSlice} onPreviewSlice={onPreviewSlice} onRemoveActiveCut={onRemoveActiveCut} onClearSlices={onClearSlices} onAssignSlices={() => undefined} showAssign={false} />
    </>}
    <div className="chop-pad-heading"><p className="eyebrow">LIVE SLICE MAP</p></div>
    <PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} onTrigger={onTriggerPad} onFeedbackEnd={onFeedbackEnd} />
  </section>
}
