import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PadGrid } from '../pads/PadGrid'
import type { PadState, SampleSlice } from '../pads/types'
import { AutoChopControls } from '../sample-editor/AutoChopControls'
import { ChopControls } from '../sample-editor/ChopControls'
import { Waveform } from '../sample-editor/Waveform'
import { maxChopSliceCount, maxSmartSliceCount, smartSliceRegions } from './autoChopOperations'
import type { SliceRegion, TransientCandidate } from './autoChopOperations'
import type { ChopTestSample } from './chopTestSamples'

interface ChopWorkspaceProps {
  pads: PadState[]
  selectedPadId: string
  activePadId: string | null
  keyboardPressedPadIds: ReadonlySet<PadState['id']>
  audioReady: boolean
  sourceFileName: string | null
  sourceDurationSeconds: number | null
  peaks: readonly number[]
  playheadSeconds: number | null
  slices: readonly SampleSlice[]
  activeSliceId: string | null
  addingSlice: boolean
  /** Computed off the render path (see App.tsx's chop-analysis effect), not
      here - a real-buffer scan is too heavy to redo on every render. */
  candidates: readonly TransientCandidate[]
  analyzing: boolean
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
  onToggleAdding: () => void
  onClearSlices: () => void
  onApplyAutoChop: (regions: readonly SliceRegion[], onApplied?: () => void) => boolean
}

export function ChopWorkspace({ pads, selectedPadId, activePadId, keyboardPressedPadIds, audioReady, sourceFileName, sourceDurationSeconds, peaks, playheadSeconds, slices, activeSliceId, addingSlice, candidates, analyzing, onLoadSource, testSamples, loadingTestId, onLoadTestSample, sourcePreviewing, onPreviewSource, onStopPreviewSource, onTriggerPad, onReleasePad, onFeedbackEnd, onAddSlice, onMoveCut, onSelectSlice, onToggleAdding, onClearSlices, onApplyAutoChop }: ChopWorkspaceProps) {
  const hasSource = sourceFileName !== null && sourceDurationSeconds !== null
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  // Purely decorative: a brief brighter pulse on the laser(s) at whichever
  // cut times SET just committed. Never read by anything else - not the
  // slices themselves, not project data. Waveform.tsx owns the actual
  // animation timing (an eased ~300ms rAF ramp); this timeout just clears
  // the trigger prop afterward, with a safety margin so it never cuts the
  // animation off early even on a slow frame.
  const [flashCutTimes, setFlashCutTimes] = useState<readonly number[] | null>(null)
  const flashTimeoutRef = useRef<number | null>(null)
  useEffect(() => () => { if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current) }, [])

  const maxSmartCount = maxSmartSliceCount(candidates.length)
  const isPreviewing = previewCount !== null
  // Starts at the low end rather than defaulting to every detected transient,
  // so the slider reads as untouched instead of looking already dragged to max.
  const smartCount = previewCount ?? 1
  const previewRegions = isPreviewing && hasSource ? smartSliceRegions(candidates, smartCount, sourceDurationSeconds) : null
  const previewSlices = previewRegions?.map((region, index) => ({ id: `preview-${index}`, ...region }))

  const handleApplySmart = () => {
    if (!previewRegions) return
    const cutTimes = previewRegions.slice(0, -1).map((previewRegion) => previewRegion.endSeconds)
    if (onApplyAutoChop(previewRegions, () => setPreviewCount(null))) {
      setPreviewCount(null)
      setFlashCutTimes(cutTimes)
      if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = window.setTimeout(() => setFlashCutTimes(null), 400)
    }
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
      {/* No filename/duration heading above it - the waveform is the first
          thing shown, full stop. sourceFileName still drives hasSource and
          the file input above; it just isn't printed anywhere any more. */}
      <Waveform peaks={peaks} durationSeconds={sourceDurationSeconds} region={{ startSeconds: 0, endSeconds: sourceDurationSeconds }} slices={previewSlices ?? slices} activeSliceId={isPreviewing ? null : activeSliceId} addingSlice={addingSlice} playheadSeconds={playheadSeconds} readOnly={isPreviewing} cutMarkerStyle={isPreviewing ? 'laser' : 'default'} flashCutTimes={flashCutTimes} onRegionChange={() => undefined} onAddSlice={onAddSlice} onMoveCut={onMoveCut} onSelectSlice={onSelectSlice} sliceMarkersDraggable />
      <AutoChopControls
        maxSmartCount={maxSmartCount}
        smartCount={smartCount}
        isPreviewing={isPreviewing}
        analyzing={analyzing}
        onSmartCountChange={setPreviewCount}
        onApplySmart={handleApplySmart}
        onCancelSmart={() => setPreviewCount(null)}
      />
      {/* Icon-only like the transport's PLAY/STOP, but smaller and in CHOP's
          own plum rather than the module accent, so a source preview never
          reads as the transport's own play/stop repeated. Below CUT rather
          than right under the waveform - CUT is the primary thing you reach
          for after the waveform itself, source preview is secondary. */}
      <div className="source-preview-controls">
        <button className="chop-preview-button chop-preview-play" type="button" disabled={!audioReady || sourcePreviewing} aria-label="Preview source" onClick={onPreviewSource} />
        <button className="chop-preview-button chop-preview-stop" type="button" disabled={!sourcePreviewing} aria-label="Stop preview" onClick={onStopPreviewSource} />
      </div>
      <ChopControls slices={slices} addingSlice={addingSlice} disabled={isPreviewing} maxSliceCount={maxChopSliceCount} onStartAdding={onToggleAdding} onClearSlices={onClearSlices} onAssignSlices={() => undefined} showAssign={false} />
    </>}
    <div className="chop-pad-heading"><p className="eyebrow">LIVE SLICE MAP</p></div>
    <PadGrid pads={pads} selectedPadId={selectedPadId} activePadId={activePadId} keyboardPressedPadIds={keyboardPressedPadIds} audioReady={audioReady} onTrigger={onTriggerPad} onRelease={onReleasePad} onFeedbackEnd={onFeedbackEnd} />
  </section>
}
