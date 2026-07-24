import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PadGrid } from '../pads/PadGrid'
import type { PadState, SampleSlice } from '../pads/types'
import { AutoChopControls } from '../sample-editor/AutoChopControls'
import { ChopControls } from '../sample-editor/ChopControls'
import { Waveform } from '../sample-editor/Waveform'
import { detectTransientCandidates, equalSliceRegions, maxSmartSliceCount, smartSliceRegions } from './autoChopOperations'
import type { SliceRegion } from './autoChopOperations'

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
  onApplyAutoChop: (regions: readonly SliceRegion[]) => boolean
}

export function ChopWorkspace({ pads, selectedPadId, activePadId, audioReady, sourceFileName, sourceDurationSeconds, peaks, playheadSeconds, slices, activeSliceId, addingSlice, onLoadSource, cutOnPadTrigger, onCutOnPadTriggerChange, loadingTest, onLoadTest, sourcePreviewing, onPreviewSource, onStopPreviewSource, onTriggerPad, onFeedbackEnd, onAddSlice, onMoveCut, onSelectSlice, onPreviewSlice, onToggleAdding, onRemoveActiveCut, onClearSlices, onApplyAutoChop }: ChopWorkspaceProps) {
  const hasSource = sourceFileName !== null && sourceDurationSeconds !== null
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const candidates = useMemo(
    () => (hasSource ? detectTransientCandidates(peaks, sourceDurationSeconds) : []),
    [hasSource, peaks, sourceDurationSeconds],
  )
  const maxSmartCount = maxSmartSliceCount(candidates.length)
  const isPreviewing = previewCount !== null
  const smartCount = previewCount ?? maxSmartCount
  const previewRegions = isPreviewing && hasSource ? smartSliceRegions(candidates, smartCount, sourceDurationSeconds) : null
  const previewSlices = previewRegions?.map((region, index) => ({ id: `preview-${index}`, ...region }))

  const handleEqualChop = (count: number) => {
    if (!hasSource) return
    setPreviewCount(null)
    onApplyAutoChop(equalSliceRegions(sourceDurationSeconds, count))
  }
  const handleApplySmart = () => {
    if (!previewRegions) return
    if (onApplyAutoChop(previewRegions)) setPreviewCount(null)
  }

  return <section className="chop-workspace" aria-labelledby="chop-workspace-title">
    <div className="sequencer-heading">
      <div><p className="eyebrow">CHOP WORKSPACE</p><h2 id="chop-workspace-title">Chop a sample onto your pads</h2></div>
      <div className="source-preview-controls"><button className="transport-button" type="button" disabled={!audioReady || !hasSource || sourcePreviewing} onClick={onPreviewSource}>PREVIEW</button><button className="mixer-toggle" type="button" disabled={!sourcePreviewing} onClick={onStopPreviewSource}>STOP PREVIEW</button></div>
    </div>
    <div className="chop-source-actions">
      <label className="file-picker chop-source-picker"><span>LOAD A SAMPLE</span><span className="file-picker-button">CHOOSE WAV FILE<input type="file" accept="audio/wav,.wav" disabled={!audioReady} onChange={onLoadSource} /></span></label>
      {!hasSource && <button className="mixer-toggle chop-test-button" type="button" disabled={!audioReady || loadingTest} onClick={onLoadTest}>{loadingTest ? 'LOADING…' : 'TRY THE TEST LOOP'}</button>}
    </div>
    <label className="chop-cut-toggle"><input type="checkbox" checked={cutOnPadTrigger} onChange={(event) => onCutOnPadTriggerChange(event.target.checked)} /><strong>ONE PAD AT A TIME</strong></label>
    {hasSource && <>
      <p className="sample-editor-file">{sourceFileName} - {sourceDurationSeconds.toFixed(3)} s</p>
      <Waveform peaks={peaks} durationSeconds={sourceDurationSeconds} region={{ startSeconds: 0, endSeconds: sourceDurationSeconds }} slices={previewSlices ?? slices} activeSliceId={isPreviewing ? null : activeSliceId} addingSlice={addingSlice} playheadSeconds={playheadSeconds} readOnly={isPreviewing} onRegionChange={() => undefined} onAddSlice={onAddSlice} onMoveCut={onMoveCut} onSelectSlice={onSelectSlice} sliceMarkersDraggable />
      <AutoChopControls
        maxSmartCount={maxSmartCount}
        smartCount={smartCount}
        isPreviewing={isPreviewing}
        onEqualChop={handleEqualChop}
        onSmartCountChange={setPreviewCount}
        onApplySmart={handleApplySmart}
        onCancelSmart={() => setPreviewCount(null)}
      />
      <ChopControls slices={slices} activeSliceId={activeSliceId} addingSlice={addingSlice} disabled={isPreviewing} onStartAdding={onToggleAdding} onSelectSlice={onSelectSlice} onPreviewSlice={onPreviewSlice} onRemoveActiveCut={onRemoveActiveCut} onClearSlices={onClearSlices} onAssignSlices={() => undefined} showAssign={false} />
    </>}
    <div className="chop-pad-heading"><p className="eyebrow">LIVE SLICE MAP</p></div>
    <PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} onTrigger={onTriggerPad} onFeedbackEnd={onFeedbackEnd} />
  </section>
}
