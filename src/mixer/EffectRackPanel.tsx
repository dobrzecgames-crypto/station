import { availableEffects, getDelayTimeSeconds } from '../audio/effects'
import type { EffectRackState, EffectSlotState } from '../audio/effects'

interface EffectRackPanelProps {
  title: string
  rack: EffectRackState
  bpm: number
  onChange: (rack: EffectRackState) => void
}

export function EffectRackPanel({ title, rack, bpm, onChange }: EffectRackPanelProps) {
  const updateSlot = (index: number, changes: Partial<EffectSlotState>) => {
    onChange({ slots: rack.slots.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...changes, compressor: { ...slot.compressor }, delay: { ...slot.delay } } : { ...slot, compressor: { ...slot.compressor }, delay: { ...slot.delay } }) as EffectRackState['slots'] })
  }
  const updateCompressor = (index: number, changes: Partial<EffectSlotState['compressor']>) => {
    const slot = rack.slots[index]
    updateSlot(index, { compressor: { ...slot.compressor, ...changes } })
  }
  const updateDelay = (index: number, changes: Partial<EffectSlotState['delay']>) => {
    const slot = rack.slots[index]
    updateSlot(index, { delay: { ...slot.delay, ...changes } })
  }

  return <section className="mixer effect-rack" aria-label={title}><p className="eyebrow">{title}</p><div className="effect-rack-slots">{rack.slots.map((slot, index) => {
    const delayTimeSeconds = getDelayTimeSeconds(slot.delay, bpm)
    return <article className={slot.type === 'none' || !slot.enabled ? 'mixer-channel master-effect-bypassed' : 'mixer-channel'} key={slot.id}><div className="mixer-channel-heading"><strong>SLOT {index + 1}</strong><span className={slot.type === 'none' ? 'sample-badge' : 'sample-badge sample-loaded'}>{slot.type.toUpperCase()}</span></div><div className="master-delay-divisions">{availableEffects.map((effect) => <button className={slot.type === effect.type ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} key={effect.type} type="button" aria-pressed={slot.type === effect.type} onClick={() => updateSlot(index, { type: effect.type })}>{effect.label}</button>)}</div>{slot.type === 'compressor' && <><div className="mixer-buttons"><button className={slot.enabled ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={slot.enabled} onClick={() => updateSlot(index, { enabled: !slot.enabled })}>ENABLED</button></div><label className="mixer-volume">THRESHOLD <output>{slot.compressor.thresholdDb.toFixed(0)} dB</output><input type="range" min="-60" max="0" step="1" value={slot.compressor.thresholdDb} onChange={(event) => updateCompressor(index, { thresholdDb: Number(event.target.value) })} /></label><label className="mixer-volume">RATIO <output>{slot.compressor.ratio.toFixed(1)}:1</output><input type="range" min="1" max="12" step="0.1" value={slot.compressor.ratio} onChange={(event) => updateCompressor(index, { ratio: Number(event.target.value) })} /></label><label className="mixer-volume">ATTACK <output>{Math.round(slot.compressor.attackSeconds * 1000)} ms</output><input type="range" min="0.003" max="0.1" step="0.001" value={slot.compressor.attackSeconds} onChange={(event) => updateCompressor(index, { attackSeconds: Number(event.target.value) })} /></label><label className="mixer-volume">RELEASE <output>{Math.round(slot.compressor.releaseSeconds * 1000)} ms</output><input type="range" min="0.05" max="1" step="0.01" value={slot.compressor.releaseSeconds} onChange={(event) => updateCompressor(index, { releaseSeconds: Number(event.target.value) })} /></label></>}{slot.type === 'delay' && <><div className="mixer-buttons"><button className={slot.enabled ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={slot.enabled} onClick={() => updateSlot(index, { enabled: !slot.enabled })}>ENABLED</button><button className={slot.delay.sync ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={slot.delay.sync} onClick={() => updateDelay(index, { sync: !slot.delay.sync })}>SYNC</button></div><div className="master-delay-divisions">{(['1/2', '1/4', '1/8', '1/16'] as const).map((division) => <button className={slot.delay.division === division ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} key={division} type="button" disabled={!slot.delay.sync} aria-pressed={slot.delay.division === division} onClick={() => updateDelay(index, { division })}>{division}</button>)}</div><label className="mixer-volume">TIME <output>{Math.round(delayTimeSeconds * 1000)} ms</output><input type="range" min="0.02" max={slot.delay.sync ? '2' : '1'} step="0.01" disabled={slot.delay.sync} value={slot.delay.sync ? delayTimeSeconds : slot.delay.timeSeconds} onChange={(event) => updateDelay(index, { timeSeconds: Number(event.target.value) })} /></label><label className="mixer-volume">FEEDBACK <output>{Math.round(slot.delay.feedback * 100)}%</output><input type="range" min="0" max="0.85" step="0.01" value={slot.delay.feedback} onChange={(event) => updateDelay(index, { feedback: Number(event.target.value) })} /></label><label className="mixer-volume">MIX <output>{Math.round(slot.delay.mix * 100)}%</output><input type="range" min="0" max="0.5" step="0.01" value={slot.delay.mix} onChange={(event) => updateDelay(index, { mix: Number(event.target.value) })} /></label></>}</article>
  })}</div></section>
}
