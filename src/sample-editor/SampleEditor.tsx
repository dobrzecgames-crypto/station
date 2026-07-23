import type { PadState, SamplePlaybackRegion } from '../pads/types'
import { Waveform } from './Waveform'

interface SampleEditorProps {
  pad: PadState
  peaks: readonly number[]
  audioReady: boolean
  onPreview: () => void
  onRegionChange: (region: SamplePlaybackRegion) => void
  onResetRegion: () => void
}

export function SampleEditor({ pad, peaks, audioReady, onPreview, onRegionChange, onResetRegion }: SampleEditorProps) {
  if (!pad.fileName || !pad.durationSeconds) {
    return (
      <section className="sample-editor" aria-labelledby="sample-editor-title">
        <p className="eyebrow">SAMPLE</p>
        <h2 id="sample-editor-title">{pad.label}</h2>
        <p className="sample-editor-empty">EMPTY - assign a WAV to edit its playback region.</p>
      </section>
    )
  }

  const durationSeconds = pad.durationSeconds
  const minimumLength = Math.min(0.01, durationSeconds)
  const updateStart = (startSeconds: number) => onRegionChange({ startSeconds: Math.min(Math.max(0, startSeconds), pad.region.endSeconds - minimumLength), endSeconds: pad.region.endSeconds })
  const updateEnd = (endSeconds: number) => onRegionChange({ startSeconds: pad.region.startSeconds, endSeconds: Math.max(Math.min(durationSeconds, endSeconds), pad.region.startSeconds + minimumLength) })

  return (
    <section className="sample-editor" aria-labelledby="sample-editor-title">
      <div className="sequencer-heading">
        <div>
          <p className="eyebrow">SAMPLE</p>
          <h2 id="sample-editor-title">{pad.label}</h2>
        </div>
        <button className="transport-button" type="button" disabled={!audioReady} onClick={onPreview}>PREVIEW</button>
      </div>
      <p className="sample-editor-file" title={pad.fileName}>{pad.fileName} - {durationSeconds.toFixed(3)} s</p>
      {pad.chopSessionId && <p className="chop-managed-note">This pad is live-managed by the current Chop Session. A later marker edit can replace this region.</p>}
      <Waveform peaks={peaks} durationSeconds={durationSeconds} region={pad.region} slices={[]} activeSliceId={null} addingSlice={false} onRegionChange={onRegionChange} onAddSlice={() => undefined} onMoveCut={() => undefined} onSelectSlice={() => undefined} />
      <div className="region-controls">
        <label htmlFor="region-start">START <output>{pad.region.startSeconds.toFixed(3)} s</output>
          <input id="region-start" type="range" min="0" max={durationSeconds} step="0.001" value={pad.region.startSeconds} onChange={(event) => updateStart(Number(event.target.value))} />
        </label>
        <label htmlFor="region-end">END <output>{pad.region.endSeconds.toFixed(3)} s</output>
          <input id="region-end" type="range" min="0" max={durationSeconds} step="0.001" value={pad.region.endSeconds} onChange={(event) => updateEnd(Number(event.target.value))} />
        </label>
        <p className="region-length">REGION LENGTH <output>{(pad.region.endSeconds - pad.region.startSeconds).toFixed(3)} s</output></p>
        <button className="clear-button" type="button" onClick={onResetRegion}>RESET REGION</button>
      </div>
    </section>
  )
}
