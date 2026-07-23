import type { EffectRackState, EffectSlotState } from '../audio/effects'

interface EffectRackPanelProps {
  title: string
  rack: EffectRackState
  onSelectSlot: (slotIndex: 0 | 1) => void
}

function getSlotLabel(slot: EffectSlotState): string {
  return slot.type === 'none' ? '+ ADD EFFECT' : slot.type.toUpperCase()
}

function getSlotStatus(slot: EffectSlotState): string {
  return slot.type === 'none' ? 'EMPTY' : slot.enabled ? 'ON' : 'BYPASS'
}

export function EffectRackPanel({ title, rack, onSelectSlot }: EffectRackPanelProps) {
  return (
    <section className="mixer effect-rack" aria-label={title}>
      <p className="eyebrow">{title}</p>
      <p className="effect-rack-signal-flow" aria-hidden="true">INPUT → FX 1 → FX 2 → OUTPUT</p>
      <div className="effect-rack-slots">
        {rack.slots.map((slot, index) => {
          const slotIndex = index as 0 | 1
          const isEmpty = slot.type === 'none'
          return (
            <button
              aria-label={`${title}, FX slot ${index + 1}, ${getSlotLabel(slot)}, ${getSlotStatus(slot)}`}
              className={`effect-slot-card${isEmpty ? ' effect-slot-empty' : ''}${!isEmpty && !slot.enabled ? ' master-effect-bypassed' : ''}`}
              key={slot.id}
              type="button"
              onClick={() => onSelectSlot(slotIndex)}
            >
              <span>FX {index + 1}</span>
              <strong>{getSlotLabel(slot)}</strong>
              <small>{getSlotStatus(slot)}</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function EffectSlotList({ title, rack, onSelectSlot }: EffectRackPanelProps) {
  return (
    <div className="effect-slot-list" aria-label={title}>
      {rack.slots.map((slot, index) => {
        const slotIndex = index as 0 | 1
        const isEmpty = slot.type === 'none'
        return (
          <div className="effect-slot-control" key={slot.id}>
            <button
              aria-label={`${title}, FX slot ${index + 1}, ${getSlotLabel(slot)}, ${getSlotStatus(slot)}`}
              className={`effect-slot-button${isEmpty ? ' effect-slot-empty' : ''}${!isEmpty && !slot.enabled ? ' master-effect-bypassed' : ''}`}
              type="button"
              onClick={() => onSelectSlot(slotIndex)}
            >
              <span>FX {index + 1}</span>
              <strong>{getSlotLabel(slot)}</strong>
              <small>{getSlotStatus(slot)}</small>
            </button>
            {!isEmpty && <label className="effect-slot-amount">AMOUNT <input type="range" min="0" max="1" step="0.01" value="0.5" disabled aria-label={`${slot.type} amount preview`} /><output>PREVIEW</output></label>}
          </div>
        )
      })}
    </div>
  )
}
