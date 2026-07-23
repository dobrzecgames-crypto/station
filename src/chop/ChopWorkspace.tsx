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

export function ChopWorkspace({ pads, selectedPadId, activePadId, audioReady, sourceFileName, sourceDurationSeconds, peaks, playheadSeconds, slices, activeSliceId, addingSlice, onLoadSource, sourcePreviewing, onPreviewSource, onStopPreviewSource, onTriggerPad, onFeedbackEnd, onAddSlice, onMoveCut, onSelectSlice, onPreviewSlice, onToggleAdding, onRemoveActiveCut, onClearSlices }: ChopWorkspaceProps) {
  const hasSource = sourceFileName !== null && sourceDurationSeconds !== null

  return <section className="chop-workspace" aria-labelledby="chop-workspace-title">
    <div className="sequencer-heading">
      <div><p className="eyebrow">CHOP WORKSPACE</p><h2 id="chop-workspace-title">Source sample to live pads</h2></div>
      <div className="source-preview-controls"><button className="transport-button" type="button" disabled={!audioReady || !hasSource || sourcePreviewing} onClick={onPreviewSource}>PLAY SOURCE</button><button className="mixer-toggle" type="button" disabled={!sourcePreviewing} onClick={onStopPreviewSource}>STOP SOURCE</button></div>
    </div>
    <label className="file-picker chop-source-picker"><span>LOAD SOURCE SAMPLE</span><input type="file" accept="audio/wav,.wav" disabled={!audioReady} onChange={onLoadSource} /></label>
    {!hasSource ? <p className="sample-editor-empty">Load a WAV source. It will not occupy any pad until you add slices.</p> : <>
      <p className="sample-editor-file">{sourceFileName} - {sourceDurationSeconds.toFixed(3)} s</p>
      <Waveform peaks={peaks} durationSeconds={sourceDurationSeconds} region={{ startSeconds: 0, endSeconds: sourceDurationSeconds }} slices={slices} activeSliceId={activeSliceId} addingSlice={addingSlice} playheadSeconds={playheadSeconds} onRegionChange={() => undefined} onAddSlice={onAddSlice} onMoveCut={onMoveCut} onSelectSlice={onSelectSlice} sliceMarkersDraggable />
      <ChopControls slices={slices} activeSliceId={activeSliceId} addingSlice={addingSlice} onStartAdding={onToggleAdding} onSelectSlice={onSelectSlice} onPreviewSlice={onPreviewSlice} onRemoveActiveCut={onRemoveActiveCut} onClearSlices={onClearSlices} onAssignSlices={() => undefined} showAssign={false} />
    </>}
    <div className="chop-pad-heading"><p className="eyebrow">LIVE SLICE MAP</p><p>Slice 1 maps to PAD 01, slice 2 to PAD 02, and so on.</p></div>
    <PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} onTrigger={onTriggerPad} onFeedbackEnd={onFeedbackEnd} />
  </section>
}
