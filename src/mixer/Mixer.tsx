import type { PadState } from '../pads/types'

interface MixerProps {
  pads: readonly PadState[]
  pumpSourceId: string | null
  pumpTargets: readonly string[]
  onVolumeChange: (padId: PadState['id'], volume: number) => void
  onMutedChange: (padId: PadState['id'], muted: boolean) => void
  onSoloChange: (padId: PadState['id'], solo: boolean) => void
}

export function Mixer({ pads, pumpSourceId, pumpTargets, onVolumeChange, onMutedChange, onSoloChange }: MixerProps) {
  return (
    <section className="mixer" aria-labelledby="mixer-title">
      <div className="sequencer-heading">
        <div>
          <p className="eyebrow">MIX</p>
          <h2 id="mixer-title">16 channel mixer</h2>
        </div>
        <p className="mixer-summary">MUTE overrides SOLO</p>
      </div>
      <div className="mixer-strips">
        {pads.map((pad) => {
          const isPumpSource = pumpSourceId === pad.id
          const isPumpTarget = pumpTargets.includes(pad.id)
          return (
            <article className="mixer-strip" key={pad.id}>
              <strong className="mixer-strip-label">{pad.label.replace('PAD ', '')}</strong>
              <span
                className={pad.fileName ? 'mixer-strip-status mixer-strip-status-loaded' : 'mixer-strip-status'}
                title={pad.fileName ?? undefined}
                aria-label={pad.fileName ? `${pad.fileName} loaded` : 'Empty'}
              />
              <span
                className={`mixer-strip-pump ${isPumpSource ? 'mixer-strip-pump-source' : isPumpTarget ? 'mixer-strip-pump-target' : ''}`}
                aria-hidden={!isPumpSource && !isPumpTarget}
                aria-label={isPumpSource ? 'Pump source' : isPumpTarget ? 'Pump target' : undefined}
              />
              <div className="mixer-strip-fader">
                <input aria-label={`${pad.label} volume`} type="range" min="0" max="1" step="0.01" value={pad.volume} onChange={(event) => onVolumeChange(pad.id, Number(event.target.value))} />
              </div>
              <output>{pad.volume.toFixed(2)}</output>
              <div className="mixer-strip-buttons">
                <button className={pad.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.muted} aria-label={`${pad.label} mute`} onClick={() => onMutedChange(pad.id, !pad.muted)}>M</button>
                <button className={pad.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.solo} aria-label={`${pad.label} solo`} onClick={() => onSoloChange(pad.id, !pad.solo)}>S</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
