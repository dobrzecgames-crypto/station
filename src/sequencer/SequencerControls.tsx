interface SequencerControlsProps {
  bpm: number
  isPlaying: boolean
  steps: boolean[]
  padLabel: string
  onBpmChange: (bpm: number) => void
  onToggleStep: (stepIndex: number) => void
  onTogglePlayback: () => void
}

export function SequencerControls({ bpm, isPlaying, steps, padLabel, onBpmChange, onToggleStep, onTogglePlayback }: SequencerControlsProps) {
  return (
    <section className="sequencer" aria-labelledby="sequencer-title">
      <div className="sequencer-heading">
        <div><p className="eyebrow">M4 / SEQUENCER</p><h2 id="sequencer-title">16-step pattern</h2></div>
        <button className="transport-button" type="button" onClick={onTogglePlayback}>{isPlaying ? 'STOP' : 'PLAY'}</button>
      </div>
      <label className="bpm-control" htmlFor="bpm">BPM <output>{bpm}</output><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} /></label>
      <p className="sequence-target">Pattern plays: {padLabel}</p>
      <div className="step-grid" aria-label="16 steps">
        {steps.map((isActive, index) => <button key={index} className={`step ${isActive ? 'step-active' : ''}`} type="button" aria-pressed={isActive} onClick={() => onToggleStep(index)}>{index + 1}</button>)}
      </div>
    </section>
  )
}
