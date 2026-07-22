import type { ChangeEvent } from 'react'
import type { PadState } from './types'

interface PadEditorProps {
  pad: PadState
  audioReady: boolean
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onUpdate: (changes: Pick<PadState, 'gain' | 'pitchSemitones'>) => void
  onClear: () => void
}

export function PadEditor({ pad, audioReady, onImport, onUpdate, onClear }: PadEditorProps) {
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
        {pad.fileName ? `${pad.fileName} · ${pad.durationSeconds?.toFixed(2)} s` : 'No WAV sample assigned to this pad.'}
      </p>
      <label className="file-picker">
        <span>Assign WAV</span>
        <input type="file" accept="audio/wav,.wav" disabled={!audioReady} onChange={onImport} />
      </label>
      <div className="parameter-control">
        <label htmlFor="pad-gain">Gain <output>{pad.gain.toFixed(2)}</output></label>
        <input id="pad-gain" type="range" min="0" max="1" step="0.01" value={pad.gain} onChange={(event) => onUpdate({ gain: Number(event.target.value), pitchSemitones: pad.pitchSemitones })} />
      </div>
      <div className="parameter-control">
        <label htmlFor="pad-pitch">Pitch <output>{pad.pitchSemitones > 0 ? '+' : ''}{pad.pitchSemitones} st</output></label>
        <input id="pad-pitch" type="range" min="-12" max="12" step="1" value={pad.pitchSemitones} onChange={(event) => onUpdate({ gain: pad.gain, pitchSemitones: Number(event.target.value) })} />
      </div>
      <button className="clear-button" type="button" disabled={!pad.fileName} onClick={onClear}>
        CLEAR PAD
      </button>
    </aside>
  )
}
