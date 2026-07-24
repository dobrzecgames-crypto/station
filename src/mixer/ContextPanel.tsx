import { useEffect, useState } from 'react'
import { availableEffects, getDelayTimeSeconds } from '../audio/effects'
import type { EffectRackState, EffectSlotState, EffectType } from '../audio/effects'

interface ContextPanelProps {
  scopeLabel?: string
  slotIndex?: 0 | 1
  rack?: EffectRackState
  bpm: number
  onChange: (rack: EffectRackState) => void
  onClose: () => void
}

const selectableEffects = availableEffects
  .map((effect) => effect.type)
  .filter((type): type is Exclude<EffectType, 'none'> => type !== 'none')

function formatEqGain(gainDb: number): string {
  return `${gainDb > 0 ? '+' : ''}${gainDb.toFixed(1)} dB`
}

export function ContextPanel({ scopeLabel, slotIndex, rack, bpm, onChange, onClose }: ContextPanelProps) {
  const slot = rack && slotIndex !== undefined ? rack.slots[slotIndex] : undefined
  const [showChooser, setShowChooser] = useState(slot?.type === 'none')

  useEffect(() => {
    setShowChooser(slot?.type === 'none')
  }, [slot?.id, slot?.type])

  useEffect(() => {
    if (!slot) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, slot])

  if (!slot || slotIndex === undefined || !rack || !scopeLabel) {
    return <section className="context-panel context-panel-closed" aria-hidden="true" />
  }

  const updateSlot = (changes: Partial<EffectSlotState>) => {
    onChange({
      slots: rack.slots.map((candidate, index) => index === slotIndex
        ? { ...candidate, ...changes, compressor: { ...candidate.compressor, ...changes.compressor }, delay: { ...candidate.delay, ...changes.delay }, eq: { ...candidate.eq, ...changes.eq } }
        : { ...candidate, compressor: { ...candidate.compressor }, delay: { ...candidate.delay }, eq: { ...candidate.eq } },
      ) as EffectRackState['slots'],
    })
  }
  const updateCompressor = (changes: Partial<EffectSlotState['compressor']>) => updateSlot({ compressor: { ...slot.compressor, ...changes } })
  const updateDelay = (changes: Partial<EffectSlotState['delay']>) => updateSlot({ delay: { ...slot.delay, ...changes } })
  const updateEQ = (changes: Partial<EffectSlotState['eq']>) => updateSlot({ eq: { ...slot.eq, ...changes } })
  const setEffect = (type: Exclude<EffectType, 'none'>) => {
    updateSlot({
      type,
      enabled: true,
      compressor: { ...slot.compressor, enabled: type === 'compressor' ? true : slot.compressor.enabled },
      delay: { ...slot.delay, enabled: type === 'delay' ? true : slot.delay.enabled },
      eq: { ...slot.eq, enabled: type === 'eq' ? true : slot.eq.enabled },
    })
    setShowChooser(false)
  }
  const toggleBypass = () => {
    const enabled = !slot.enabled
    updateSlot({
      enabled,
      compressor: { ...slot.compressor, enabled: slot.type === 'compressor' ? enabled : slot.compressor.enabled },
      delay: { ...slot.delay, enabled: slot.type === 'delay' ? enabled : slot.delay.enabled },
      eq: { ...slot.eq, enabled: slot.type === 'eq' ? enabled : slot.eq.enabled },
    })
  }
  const removeEffect = () => updateSlot({ type: 'none', enabled: false })
  const isEmpty = slot.type === 'none'
  const panelMode = isEmpty || showChooser ? 'compact' : 'expanded'
  const effectName = isEmpty ? 'ADD EFFECT' : slot.type.toUpperCase()

  return (
    <section className={`context-panel context-panel-${panelMode}`} aria-label={`${scopeLabel}, FX slot ${slotIndex + 1}`}>
      <div className="context-panel-header">
        <div>
          <p className="eyebrow">{scopeLabel} / FX SLOT {slotIndex + 1}</p>
          <h2>{effectName}</h2>
        </div>
        <div className="context-panel-actions">
          {!isEmpty && <><span className={slot.enabled ? 'sample-badge sample-loaded' : 'sample-badge'}>{slot.enabled ? 'ON' : 'BYPASS'}</span><button className="mixer-toggle" type="button" aria-pressed={slot.enabled} onClick={toggleBypass}>{slot.enabled ? 'BYPASS' : 'ENABLE'}</button></>}
          <button className="mixer-toggle" type="button" aria-label="Close FX context panel" onClick={onClose}>CLOSE</button>
        </div>
      </div>

      {showChooser && <div className="context-panel-chooser" aria-label="Add or replace effect">
        {selectableEffects.map((type) => <button className="mixer-toggle" key={type} type="button" onClick={() => setEffect(type)}>{type.toUpperCase()}</button>)}
      </div>}

      {!showChooser && slot.type === 'compressor' && <div className="context-panel-controls">
        <label className="mixer-volume">THRESHOLD <output>{slot.compressor.thresholdDb.toFixed(0)} dB</output><input type="range" min="-60" max="0" step="1" value={slot.compressor.thresholdDb} onChange={(event) => updateCompressor({ thresholdDb: Number(event.target.value) })} /></label>
        <label className="mixer-volume">RATIO <output>{slot.compressor.ratio.toFixed(1)}:1</output><input type="range" min="1" max="12" step="0.1" value={slot.compressor.ratio} onChange={(event) => updateCompressor({ ratio: Number(event.target.value) })} /></label>
        <label className="mixer-volume">ATTACK <output>{Math.round(slot.compressor.attackSeconds * 1000)} ms</output><input type="range" min="0.003" max="0.1" step="0.001" value={slot.compressor.attackSeconds} onChange={(event) => updateCompressor({ attackSeconds: Number(event.target.value) })} /></label>
        <label className="mixer-volume">RELEASE <output>{Math.round(slot.compressor.releaseSeconds * 1000)} ms</output><input type="range" min="0.05" max="1" step="0.01" value={slot.compressor.releaseSeconds} onChange={(event) => updateCompressor({ releaseSeconds: Number(event.target.value) })} /></label>
      </div>}

      {!showChooser && slot.type === 'delay' && <div className="context-panel-controls">
        <div className="mixer-buttons"><button className={slot.delay.sync ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={slot.delay.sync} onClick={() => updateDelay({ sync: !slot.delay.sync })}>SYNC</button></div>
        <div className="master-delay-divisions">{(['1/2', '1/4', '1/8', '1/16'] as const).map((division) => <button className={slot.delay.division === division ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} key={division} type="button" disabled={!slot.delay.sync} aria-pressed={slot.delay.division === division} onClick={() => updateDelay({ division })}>{division}</button>)}</div>
        <label className="mixer-volume">TIME <output>{Math.round(getDelayTimeSeconds(slot.delay, bpm) * 1000)} ms</output><input type="range" min="0.02" max={slot.delay.sync ? '2' : '1'} step="0.01" disabled={slot.delay.sync} value={slot.delay.sync ? getDelayTimeSeconds(slot.delay, bpm) : slot.delay.timeSeconds} onChange={(event) => updateDelay({ timeSeconds: Number(event.target.value) })} /></label>
        <label className="mixer-volume">FEEDBACK <output>{Math.round(slot.delay.feedback * 100)}%</output><input type="range" min="0" max="0.85" step="0.01" value={slot.delay.feedback} onChange={(event) => updateDelay({ feedback: Number(event.target.value) })} /></label>
        <label className="mixer-volume">MIX <output>{Math.round(slot.delay.mix * 100)}%</output><input type="range" min="0" max="0.5" step="0.01" value={slot.delay.mix} onChange={(event) => updateDelay({ mix: Number(event.target.value) })} /></label>
      </div>}

      {!showChooser && slot.type === 'eq' && <div className="context-panel-controls">
        <p className="eyebrow eq-band-label">LOW SHELF</p>
        <label className="mixer-volume">FREQ <output>{Math.round(slot.eq.lowShelfFreqHz)} Hz</output><input type="range" min="40" max="500" step="1" value={slot.eq.lowShelfFreqHz} onChange={(event) => updateEQ({ lowShelfFreqHz: Number(event.target.value) })} /></label>
        <label className="mixer-volume">GAIN <output>{formatEqGain(slot.eq.lowShelfGainDb)}</output><input type="range" min="-15" max="15" step="0.1" value={slot.eq.lowShelfGainDb} onChange={(event) => updateEQ({ lowShelfGainDb: Number(event.target.value) })} /></label>
        <p className="eyebrow eq-band-label">MID PEAK</p>
        <label className="mixer-volume">FREQ <output>{Math.round(slot.eq.midFreqHz)} Hz</output><input type="range" min="200" max="6000" step="1" value={slot.eq.midFreqHz} onChange={(event) => updateEQ({ midFreqHz: Number(event.target.value) })} /></label>
        <label className="mixer-volume">GAIN <output>{formatEqGain(slot.eq.midGainDb)}</output><input type="range" min="-15" max="15" step="0.1" value={slot.eq.midGainDb} onChange={(event) => updateEQ({ midGainDb: Number(event.target.value) })} /></label>
        <label className="mixer-volume">Q <output>{slot.eq.midQ.toFixed(2)}</output><input type="range" min="0.4" max="4" step="0.1" value={slot.eq.midQ} onChange={(event) => updateEQ({ midQ: Number(event.target.value) })} /></label>
        <p className="eyebrow eq-band-label">HIGH SHELF</p>
        <label className="mixer-volume">FREQ <output>{Math.round(slot.eq.highShelfFreqHz)} Hz</output><input type="range" min="2000" max="12000" step="1" value={slot.eq.highShelfFreqHz} onChange={(event) => updateEQ({ highShelfFreqHz: Number(event.target.value) })} /></label>
        <label className="mixer-volume">GAIN <output>{formatEqGain(slot.eq.highShelfGainDb)}</output><input type="range" min="-15" max="15" step="0.1" value={slot.eq.highShelfGainDb} onChange={(event) => updateEQ({ highShelfGainDb: Number(event.target.value) })} /></label>
      </div>}

      {!showChooser && <div className="context-panel-footer"><button className="mixer-toggle" type="button" onClick={() => setShowChooser(true)}>REPLACE</button><button className="mixer-toggle context-panel-remove" type="button" onClick={removeEffect}>REMOVE</button></div>}
    </section>
  )
}
