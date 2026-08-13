import type { PadState, SamplePlaybackRegion } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
import { Waveform } from './Waveform'

interface SampleEditorProps {
  pad: PadState
  peaks: readonly number[]
  playheadSeconds: number | null
  audioReady: boolean
  onPreview: () => void
  onRegionChange: (region: SamplePlaybackRegion) => void
  onResetRegion: () => void
  onToggleReversed: () => void
  onClose?: () => void
}

export function SampleEditor({ pad, peaks, playheadSeconds, audioReady, onPreview, onRegionChange, onResetRegion, onToggleReversed, onClose }: SampleEditorProps) {
  // Hooks have to run unconditionally, ahead of the "no sample yet" early
  // return below - pad.durationSeconds is undefined until one loads, so these
  // fall back to a 0-length range that render path never shows a slider for.
  const durationSeconds = pad.durationSeconds ?? 0
  const minimumLength = Math.min(0.01, durationSeconds)
  const updateStart = (startSeconds: number) => onRegionChange({ startSeconds: Math.min(Math.max(0, startSeconds), pad.region.endSeconds - minimumLength), endSeconds: pad.region.endSeconds })
  const updateEnd = (endSeconds: number) => onRegionChange({ startSeconds: pad.region.startSeconds, endSeconds: Math.max(Math.min(durationSeconds, endSeconds), pad.region.startSeconds + minimumLength) })
  const startDrag = useDragSlider({ value: pad.region.startSeconds, min: 0, max: durationSeconds, step: 0.001, onChange: updateStart, focusLabel: 'START', formatValue: (value) => `${value.toFixed(3)} s` })
  const endDrag = useDragSlider({ value: pad.region.endSeconds, min: 0, max: durationSeconds, step: 0.001, onChange: updateEnd, focusLabel: 'END', formatValue: (value) => `${value.toFixed(3)} s` })

  if (!pad.fileName || !pad.durationSeconds) {
    return (
      <section className="sample-editor" aria-labelledby="sample-editor-title">
        <p className="eyebrow">SAMPLE</p>
        <div className="sequencer-heading"><h2 id="sample-editor-title">{pad.label}</h2>{onClose && <button className="mixer-toggle" type="button" onClick={onClose}>CLOSE</button>}</div>
        <p className="sample-editor-empty">No sample loaded on this pad yet.</p>
      </section>
    )
  }

  return (
    <section className="sample-editor" aria-labelledby="sample-editor-title">
      <div className="sequencer-heading">
        <div>
          <p className="eyebrow">SAMPLE</p>
          <h2 id="sample-editor-title">{pad.label}</h2>
        </div>
        <div className="sample-editor-actions"><button className="transport-button" type="button" disabled={!audioReady} onClick={onPreview}>PREVIEW</button>{onClose && <button className="mixer-toggle" type="button" onClick={onClose}>CLOSE</button>}</div>
      </div>
      <p className="sample-editor-file" title={pad.fileName}>{pad.fileName} - {durationSeconds.toFixed(3)} s</p>
      {pad.chopSessionId && <p className="chop-managed-note">Linked to a CHOP slice — edits there update this region and reverse state too.</p>}
      <Waveform peaks={peaks} durationSeconds={durationSeconds} region={pad.region} slices={[]} activeSliceId={null} addingSlice={false} playheadSeconds={playheadSeconds} onRegionChange={onRegionChange} onAddSlice={() => undefined} onMoveCut={() => undefined} onSelectSlice={() => undefined} />
      <div className="region-controls">
        <label htmlFor="region-start">START <output>{pad.region.startSeconds.toFixed(3)} s</output>
          <input id="region-start" type="range" min="0" max={durationSeconds} step="0.001" value={pad.region.startSeconds} {...startDrag.inputProps} />
        </label>
        <label htmlFor="region-end">END <output>{pad.region.endSeconds.toFixed(3)} s</output>
          <input id="region-end" type="range" min="0" max={durationSeconds} step="0.001" value={pad.region.endSeconds} {...endDrag.inputProps} />
        </label>
        <p className="region-length">REGION LENGTH <output>{(pad.region.endSeconds - pad.region.startSeconds).toFixed(3)} s</output></p>
        <button className={pad.reversed ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.reversed} onClick={onToggleReversed}>REVERSE</button>
        <button className="clear-button" type="button" onClick={onResetRegion}>RESET REGION</button>
      </div>
    </section>
  )
}
