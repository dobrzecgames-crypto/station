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
      <div className="mixer-grid">
        {pads.map((pad) => {
          const isPumpSource = pumpSourceId === pad.id
          const isPumpTarget = pumpTargets.includes(pad.id)
          return (
            <article className="mixer-channel" key={pad.id}>
              <div className="mixer-channel-heading">
                <strong>{pad.label}</strong>
                <span className={pad.fileName ? 'sample-badge sample-loaded' : 'sample-badge'}>{pad.fileName ? 'LOADED' : 'EMPTY'}</span>
              </div>
              <p className="mixer-sample" title={pad.fileName ?? undefined}>{pad.fileName ?? 'EMPTY'}</p>
              <p className="mixer-pump-status">{isPumpSource ? 'PUMP SOURCE' : isPumpTarget ? 'PUMP TARGET' : '-'}</p>
              <label className="mixer-volume" htmlFor={`volume-${pad.id}`}>VOL <output>{pad.volume.toFixed(2)}</output>
                <input id={`volume-${pad.id}`} type="range" min="0" max="1" step="0.01" value={pad.volume} onChange={(event) => onVolumeChange(pad.id, Number(event.target.value))} />
              </label>
              <div className="mixer-buttons">
                <button className={pad.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.muted} onClick={() => onMutedChange(pad.id, !pad.muted)}>MUTE</button>
                <button className={pad.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.solo} onClick={() => onSoloChange(pad.id, !pad.solo)}>SOLO</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
