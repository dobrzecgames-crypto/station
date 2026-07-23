import type { ChangeEvent } from 'react'
import type { PadState } from './types'

interface PadEditorProps {
  pad: PadState
  audioReady: boolean
  projectBusy: boolean
  projectKeyLabel: string
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onUpdate: (changes: Pick<PadState, 'volume' | 'pitchSemitones'>) => void
  onMapToProjectScale: () => void
  onEditSample: () => void
  onClear: () => void
}

export function PadEditor({ pad, audioReady, projectBusy, projectKeyLabel, onImport, onUpdate, onMapToProjectScale, onEditSample, onClear }: PadEditorProps) {
  return (
    <aside className="pad-editor" aria-labelledby="pad-editor-title">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">SELECTED PAD</p>
          <h2 id="pad-editor-title">{pad.label}</h2>
        </div>
        <span className={pad.fileName ? 'sample-badge sample-loaded' : 'sample-badge'}>
          {pad.fileName ? 'LOADED' : 'EMPTY'}
        </span>
      </div>
      <p className="sample-details">
        {pad.fileName ? `${pad.fileName} · ${pad.durationSeconds?.toFixed(2)} s` : 'No sample loaded on this pad yet.'}
      </p>
      <label className="file-picker">
        <span>LOAD A SAMPLE</span>
        <span className="file-picker-button">CHOOSE WAV FILE<input type="file" accept="audio/wav,.wav" disabled={!audioReady} onChange={onImport} /></span>
      </label>
      <div className="parameter-control">
        <label htmlFor="pad-volume">Volume <output>{pad.volume.toFixed(2)}</output></label>
        <input id="pad-volume" type="range" min="0" max="1" step="0.01" value={pad.volume} onChange={(event) => onUpdate({ volume: Number(event.target.value), pitchSemitones: pad.pitchSemitones })} />
      </div>
      <div className="parameter-control">
        <label htmlFor="pad-pitch">Pitch <output>{pad.pitchSemitones > 0 ? '+' : ''}{pad.pitchSemitones} st</output></label>
        <input id="pad-pitch" type="range" min="-12" max="36" step="1" value={pad.pitchSemitones} onChange={(event) => onUpdate({ volume: pad.volume, pitchSemitones: Number(event.target.value) })} />
      </div>
      <button className="map-scale-button" type="button" disabled={!pad.assetId || projectBusy} onClick={onMapToProjectScale}>
        MAP TO PROJECT SCALE
      </button>
      <p className="project-key-summary">{projectKeyLabel}</p>
      <button className="mixer-toggle edit-sample-button" type="button" onClick={onEditSample}>
        EDIT SAMPLE
      </button>
      <button className="clear-button" type="button" disabled={!pad.fileName} onClick={onClear}>
        CLEAR PAD
      </button>
    </aside>
  )
}
