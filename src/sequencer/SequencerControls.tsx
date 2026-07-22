interface SequencerControlsProps {
  bpm: number
  isPlaying: boolean
  steps: number[]
  swing: number
  padLabel: string
  loadedTrackCount: number
  onBpmChange: (bpm: number) => void
  onSwingChange: (swing: number) => void
  onToggleStep: (stepIndex: number) => void
  onTogglePlayback: () => void
}

export function SequencerControls({ bpm, isPlaying, steps, swing, padLabel, loadedTrackCount, onBpmChange, onSwingChange, onToggleStep, onTogglePlayback }: SequencerControlsProps) {
  return (
    <section className="sequencer" aria-labelledby="sequencer-title">
      <div className="sequencer-heading">
        <div><p className="eyebrow">M4 / SEQUENCER</p><h2 id="sequencer-title">16-step pattern</h2></div>
        <button className="transport-button" type="button" onClick={onTogglePlayback}>{isPlaying ? 'STOP' : 'PLAY'}</button>
      </div>
      <label className="bpm-control" htmlFor="bpm">BPM <output>{bpm}</output><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} /></label>
      <label className="bpm-control" htmlFor="swing">SWING <output>{Math.round(swing * 100)}%</output><input id="swing" type="range" min="0" max="0.5" step="0.01" value={swing} onChange={(event) => onSwingChange(Number(event.target.value))} /></label>
      <p className="sequence-target">Editing: {padLabel} · PLAY runs {loadedTrackCount} loaded pad{loadedTrackCount === 1 ? '' : 's'}</p>
      <div className="step-grid" aria-label="16 steps">
        {steps.map((velocity, index) => <button key={index} className={`step ${velocity ? 'step-active' : ''} ${velocity === 1 ? 'step-full' : ''}`} type="button" aria-pressed={velocity > 0} onClick={() => onToggleStep(index)}>{index + 1}<small>{velocity === 1 ? 'FULL' : velocity ? 'SOFT' : ''}</small></button>)}
      </div>
    </section>
  )
}
