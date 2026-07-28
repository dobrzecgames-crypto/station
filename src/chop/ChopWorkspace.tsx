import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PadGrid } from '../pads/PadGrid'
import type { PadState, SampleSlice } from '../pads/types'
import { AutoChopControls } from '../sample-editor/AutoChopControls'
import { ChopControls } from '../sample-editor/ChopControls'
import { Waveform } from '../sample-editor/Waveform'
import { detectTransientCandidates, equalSliceRegions, maxSmartSliceCount, smartSliceRegions } from './autoChopOperations'
import type { SliceRegion } from './autoChopOperations'
import type { ChopTestSample } from './chopTestSamples'

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
  testSamples: readonly ChopTestSample[]
  loadingTestId: string | null
  onLoadTestSample: (sample: ChopTestSample) => void
  sourcePreviewing: boolean
  onPreviewSource: () => void
  onStopPreviewSource: () => void
  onTriggerPad: (padId: PadState['id']) => void
  onReleasePad: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
  onAddSlice: (timeSeconds: number) => void
  onMoveCut: (cutIndex: number, timeSeconds: number) => void
  onSelectSlice: (sliceId: string) => void
  onPreviewSlice: (slice: SampleSlice) => void
  onToggleAdding: () => void
  onRemoveActiveCut: () => void
  onClearSlices: () => void
  onApplyAutoChop: (regions: readonly SliceRegion[], onApplied?: () => void) => boolean
}

export function ChopWorkspace({ pads, selectedPadId, activePadId, audioReady, sourceFileName, sourceDurationSeconds, peaks, playheadSeconds, slices, activeSliceId, addingSlice, onLoadSource, testSamples, loadingTestId, onLoadTestSample, sourcePreviewing, onPreviewSource, onStopPreviewSource, onTriggerPad, onReleasePad, onFeedbackEnd, onAddSlice, onMoveCut, onSelectSlice, onPreviewSlice, onToggleAdding, onRemoveActiveCut, onClearSlices, onApplyAutoChop }: ChopWorkspaceProps) {
  const hasSource = sourceFileName !== null && sourceDurationSeconds !== null
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const candidates = useMemo(
    () => (hasSource ? detectTransientCandidates(peaks, sourceDurationSeconds) : []),
    [hasSource, peaks, sourceDurationSeconds],
  )
  const maxSmartCount = maxSmartSliceCount(candidates.length)
  const isPreviewing = previewCount !== null
  // Starts at the low end rather than defaulting to every detected transient,
  // so the slider reads as untouched instead of looking already dragged to max.
  const smartCount = previewCount ?? 1
  const previewRegions = isPreviewing && hasSource ? smartSliceRegions(candidates, smartCount, sourceDurationSeconds) : null
  const previewSlices = previewRegions?.map((region, index) => ({ id: `preview-${index}`, ...region }))

  const handleEqualChop = (count: number) => {
    if (!hasSource) return
    setPreviewCount(null)
    onApplyAutoChop(equalSliceRegions(sourceDurationSeconds, count))
  }
  const handleApplySmart = () => {
    if (!previewRegions) return
    if (onApplyAutoChop(previewRegions, () => setPreviewCount(null))) setPreviewCount(null)
  }

  return <section className="chop-workspace" aria-label="Chop">
    {!hasSource ? (
      <div className="chop-empty-state">
        <label className="chop-empty-choose">
          <span className="file-picker-button chop-empty-choose-button">CHOOSE WAV FILE<input type="file" accept="audio/wav,.wav" disabled={!audioReady} onChange={onLoadSource} /></span>
        </label>
        <div className="chop-empty-samples">
          <span className="chop-empty-samples-label">OR TRY A SAMPLE</span>
          <div className="chop-empty-samples-buttons">
            {testSamples.map((sample) => (
              <button key={sample.id} className="mixer-toggle" type="button" disabled={!audioReady || loadingTestId !== null} onClick={() => onLoadTestSample(sample)}>
                {loadingTestId === sample.id ? '…' : sample.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    ) : <>
      <div className="sequencer-heading">
        <p className="sample-editor-file">{sourceFileName} - {sourceDurationSeconds.toFixed(3)} s</p>
        {/* Icon-only like the transport's PLAY/STOP, but smaller and in CHOP's
            own plum rather than the module accent, so a source preview never
            reads as the transport's own play/stop repeated. */}
        <div className="source-preview-controls">
          <button className="chop-preview-button chop-preview-play" type="button" disabled={!audioReady || sourcePreviewing} aria-label="Preview source" onClick={onPreviewSource} />
          <button className="chop-preview-button chop-preview-stop" type="button" disabled={!sourcePreviewing} aria-label="Stop preview" onClick={onStopPreviewSource} />
        </div>
      </div>
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
    <PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} audioReady={audioReady} onTrigger={onTriggerPad} onRelease={onReleasePad} onFeedbackEnd={onFeedbackEnd} />
  </section>
}
