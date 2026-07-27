import { useEffect, useMemo, useRef, useState } from 'react'
import { availableEffects, getDelayTimeSeconds } from '../audio/effects'
import type { EffectRackState, EffectSlotState, EffectType } from '../audio/effects'
import { DisplayRange } from '../shell/displayControls'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'

interface EffectContext {
  scope: 'group' | 'master'
  slotIndex: 0 | 1
}

interface EffectDisplayLauncherProps {
  context: EffectContext | null
  scopeLabel?: string
  rack?: EffectRackState
  bpm: number
  onChange: (rack: EffectRackState) => void
  onClose: () => void
}

const displayId = 'effect-controls'
const selectableEffects = availableEffects
  .map((effect) => effect.type)
  .filter((type): type is Exclude<EffectType, 'none'> => type !== 'none')

/** Claims the shared display for one selected FX slot and keeps MIX uncluttered. */
export function EffectDisplayLauncher({ context, scopeLabel, rack, bpm, onChange, onClose }: EffectDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const onChangeRef = useRef(onChange)
  const onCloseRef = useRef(onClose)
  const hasOwnedDisplayRef = useRef(false)
  onChangeRef.current = onChange
  onCloseRef.current = onClose

  const slot = context && rack ? rack.slots[context.slotIndex] : undefined
  const tenant = useMemo(() => {
    if (!context || !rack || !slot || !scopeLabel) return null
    return effectTenant({
      scopeLabel,
      slotIndex: context.slotIndex,
      rack,
      bpm,
      onChange: (nextRack) => onChangeRef.current(nextRack),
      onClose: () => onCloseRef.current(),
    })
  }, [context?.scope, context?.slotIndex, rack, slot, scopeLabel, bpm])

  useEffect(() => {
    if (tenant) claim(tenant)
    else release(displayId)
  }, [tenant, claim, release])

  useEffect(() => () => release(displayId), [release])

  useEffect(() => {
    if (!tenant) {
      hasOwnedDisplayRef.current = false
      return
    }
    // The MIX overview can already own the display when an FX button is
    // clicked. Waiting until this tenant has owned it once prevents that
    // resting owner from cancelling the click before the FX claim is applied.
    if (ownerId === displayId) {
      hasOwnedDisplayRef.current = true
      return
    }
    if (hasOwnedDisplayRef.current && ownerId !== null) onCloseRef.current()
  }, [tenant, ownerId])

  return null
}

interface EffectTenantProps {
  scopeLabel: string
  slotIndex: 0 | 1
  rack: EffectRackState
  bpm: number
  onChange: (rack: EffectRackState) => void
  onClose: () => void
}

function effectTenant(props: EffectTenantProps): DisplayTenant {
  const slot = props.rack.slots[props.slotIndex]
  return {
    id: displayId,
    label: `${props.scopeLabel}, FX slot ${props.slotIndex + 1}`,
    readout: `${props.scopeLabel.toUpperCase()} · FX ${props.slotIndex + 1} · ${slot.type === 'none' ? 'EMPTY' : slot.type.toUpperCase()}`,
    panel: <EffectDisplayPanel {...props} />,
  }
}

function EffectDisplayPanel({ scopeLabel, slotIndex, rack, bpm, onChange, onClose }: EffectTenantProps) {
  const slot = rack.slots[slotIndex]
  const [showChooser, setShowChooser] = useState(slot.type === 'none')

  useEffect(() => {
    setShowChooser(slot.type === 'none')
  }, [slot.id, slot.type])

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

  return <>
    {!isEmpty && <button className="display-toggle" type="button" role="switch" aria-label={`${scopeLabel} FX slot ${slotIndex + 1}`} aria-checked={slot.enabled} onClick={toggleBypass}>
      <span className="display-param-label">{slot.type.toUpperCase()}</span>
      <span className="display-toggle-value" aria-hidden="true">{slot.enabled ? 'ON' : 'BYPASS'}</span>
    </button>}

    {(isEmpty || showChooser) && <div className="display-param">
      <span className="display-param-label">{isEmpty ? 'ADD EFFECT' : 'REPLACE'}</span>
      <div className="display-actions">
        {selectableEffects.map((type) => <button className="display-action" key={type} type="button" onClick={() => setEffect(type)}>{type.toUpperCase()}</button>)}
      </div>
    </div>}

    {!showChooser && slot.type === 'compressor' && <>
      <DisplayRange idPrefix="fx-display" label="THRESHOLD" value={`${slot.compressor.thresholdDb.toFixed(0)} dB`} min="-60" max="0" step="1" current={slot.compressor.thresholdDb} onChange={(value) => updateCompressor({ thresholdDb: value })} />
      <DisplayRange idPrefix="fx-display" label="RATIO" value={`${slot.compressor.ratio.toFixed(1)}:1`} min="1" max="12" step="0.1" current={slot.compressor.ratio} onChange={(value) => updateCompressor({ ratio: value })} />
      <DisplayRange idPrefix="fx-display" label="ATTACK" value={`${Math.round(slot.compressor.attackSeconds * 1000)} ms`} min="0.003" max="0.1" step="0.001" current={slot.compressor.attackSeconds} onChange={(value) => updateCompressor({ attackSeconds: value })} />
      <DisplayRange idPrefix="fx-display" label="RELEASE" value={`${Math.round(slot.compressor.releaseSeconds * 1000)} ms`} min="0.05" max="1" step="0.01" current={slot.compressor.releaseSeconds} onChange={(value) => updateCompressor({ releaseSeconds: value })} />
    </>}

    {!showChooser && slot.type === 'delay' && <>
      <button className="display-toggle" type="button" role="switch" aria-label="Delay sync" aria-checked={slot.delay.sync} onClick={() => updateDelay({ sync: !slot.delay.sync })}>
        <span className="display-param-label">SYNC</span>
        <span className="display-toggle-value" aria-hidden="true">{slot.delay.sync ? 'ON' : 'OFF'}</span>
      </button>
      <div className="display-param">
        <span className="display-param-label">DIVISION</span>
        <div className="display-actions">
          {(['1/2', '1/4', '1/8', '1/16'] as const).map((division) => <button className={slot.delay.division === division ? 'display-action display-action-active' : 'display-action'} key={division} type="button" disabled={!slot.delay.sync} aria-pressed={slot.delay.division === division} onClick={() => updateDelay({ division })}>{division}</button>)}
        </div>
      </div>
      <DisplayRange idPrefix="fx-display" label="TIME" value={`${Math.round(getDelayTimeSeconds(slot.delay, bpm) * 1000)} ms`} min="0.02" max={slot.delay.sync ? '2' : '1'} step="0.01" disabled={slot.delay.sync} current={slot.delay.sync ? getDelayTimeSeconds(slot.delay, bpm) : slot.delay.timeSeconds} onChange={(value) => updateDelay({ timeSeconds: value })} />
      <DisplayRange idPrefix="fx-display" label="FEEDBACK" value={`${Math.round(slot.delay.feedback * 100)}%`} min="0" max="0.85" step="0.01" current={slot.delay.feedback} onChange={(value) => updateDelay({ feedback: value })} />
      <DisplayRange idPrefix="fx-display" label="MIX" value={`${Math.round(slot.delay.mix * 100)}%`} min="0" max="0.5" step="0.01" current={slot.delay.mix} onChange={(value) => updateDelay({ mix: value })} />
    </>}

    {!showChooser && slot.type === 'eq' && <>
      <DisplayRange idPrefix="fx-display" label="LOW FREQ" value={`${Math.round(slot.eq.lowShelfFreqHz)} Hz`} min="40" max="500" step="1" current={slot.eq.lowShelfFreqHz} onChange={(value) => updateEQ({ lowShelfFreqHz: value })} />
      <DisplayRange idPrefix="fx-display" label="LOW GAIN" value={formatEqGain(slot.eq.lowShelfGainDb)} min="-15" max="15" step="0.1" current={slot.eq.lowShelfGainDb} onChange={(value) => updateEQ({ lowShelfGainDb: value })} />
      <DisplayRange idPrefix="fx-display" label="MID FREQ" value={`${Math.round(slot.eq.midFreqHz)} Hz`} min="200" max="6000" step="1" current={slot.eq.midFreqHz} onChange={(value) => updateEQ({ midFreqHz: value })} />
      <DisplayRange idPrefix="fx-display" label="MID GAIN" value={formatEqGain(slot.eq.midGainDb)} min="-15" max="15" step="0.1" current={slot.eq.midGainDb} onChange={(value) => updateEQ({ midGainDb: value })} />
      <DisplayRange idPrefix="fx-display" label="MID Q" value={slot.eq.midQ.toFixed(2)} min="0.4" max="4" step="0.1" current={slot.eq.midQ} onChange={(value) => updateEQ({ midQ: value })} />
      <DisplayRange idPrefix="fx-display" label="HIGH FREQ" value={`${Math.round(slot.eq.highShelfFreqHz)} Hz`} min="2000" max="12000" step="1" current={slot.eq.highShelfFreqHz} onChange={(value) => updateEQ({ highShelfFreqHz: value })} />
      <DisplayRange idPrefix="fx-display" label="HIGH GAIN" value={formatEqGain(slot.eq.highShelfGainDb)} min="-15" max="15" step="0.1" current={slot.eq.highShelfGainDb} onChange={(value) => updateEQ({ highShelfGainDb: value })} />
    </>}

    {!isEmpty && !showChooser && <div className="display-param">
      <span className="display-param-label">ACTIONS</span>
      <div className="display-actions">
        <button className="display-action" type="button" onClick={() => setShowChooser(true)}>REPLACE</button>
        <button className="display-action display-action-danger" type="button" onClick={removeEffect}>REMOVE</button>
        <button className="display-action" type="button" onClick={onClose}>CLOSE</button>
      </div>
    </div>}
  </>
}

function formatEqGain(gainDb: number): string {
  return `${gainDb > 0 ? '+' : ''}${gainDb.toFixed(1)} dB`
}
