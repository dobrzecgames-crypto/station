import type { PadState, SamplePlaybackRegion } from '../pads/types'
import { Waveform } from './Waveform'

interface SampleEditorProps {
  pad: PadState
  peaks: readonly number[]
  playheadSeconds: number | null
  audioReady: boolean
  onPreview: () => void
  onRegionChange: (region: SamplePlaybackRegion) => void
  onResetRegion: () => void
  onClose?: () => void
}

export function SampleEditor({ pad, peaks, playheadSeconds, audioReady, onPreview, onRegionChange, onResetRegion, onClose }: SampleEditorProps) {
  if (!pad.fileName || !pad.durationSeconds) {
    return (
      <section className="sample-editor" aria-labelledby="sample-editor-title">
        <p className="eyebrow">SAMPLE</p>
        <div className="sequencer-heading"><h2 id="sample-editor-title">{pad.label}</h2>{onClose && <button className="mixer-toggle" type="button" onClick={onClose}>CLOSE</button>}</div>
        <p className="sample-editor-empty">This pad is empty - load a sample first, then you can trim where it starts and stops.</p>
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
        <div className="sample-editor-actions"><button className="transport-button" type="button" disabled={!audioReady} onClick={onPreview}>PREVIEW</button>{onClose && <button className="mixer-toggle" type="button" onClick={onClose}>CLOSE</button>}</div>
      </div>
      <p className="sample-editor-file" title={pad.fileName}>{pad.fileName} - {durationSeconds.toFixed(3)} s</p>
      {pad.chopSessionId && <p className="chop-managed-note">This pad follows a slice from CHOP - moving that slice marker later will update it here too.</p>}
      <Waveform peaks={peaks} durationSeconds={durationSeconds} region={pad.region} slices={[]} activeSliceId={null} addingSlice={false} playheadSeconds={playheadSeconds} onRegionChange={onRegionChange} onAddSlice={() => undefined} onMoveCut={() => undefined} onSelectSlice={() => undefined} />
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
