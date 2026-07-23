interface SequencerControlsProps {
  steps: number[]
  padLabel: string
  loadedTrackCount: number
  onToggleStep: (stepIndex: number) => void
}

export function SequencerControls({ steps, padLabel, loadedTrackCount, onToggleStep }: SequencerControlsProps) {
  return (
    <section className="sequencer" aria-labelledby="sequencer-title">
      <div className="sequencer-heading">
        <div><p className="eyebrow">SEQ</p><h2 id="sequencer-title">16-step pattern</h2></div>
      </div>
      <p className="sequence-target">Editing: {padLabel} · PLAY runs {loadedTrackCount} loaded pad{loadedTrackCount === 1 ? '' : 's'}</p>
      <div className="step-grid" aria-label="16 steps">
        {steps.map((velocity, index) => <button key={index} className={`step ${velocity ? 'step-active' : ''} ${velocity === 1 ? 'step-full' : ''}`} type="button" aria-pressed={velocity > 0} onClick={() => onToggleStep(index)}>{index + 1}<small>{velocity === 1 ? 'FULL' : velocity ? 'SOFT' : ''}</small></button>)}
      </div>
    </section>
  )
}
