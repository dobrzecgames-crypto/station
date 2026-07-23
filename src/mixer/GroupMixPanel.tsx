import type { EffectRackState } from '../audio/effects'
import type { PatternGroup } from '../patterns/patternTypes'
import { EffectSlotList } from './EffectRackPanel'
import './groupMix.css'

interface GroupMixPanelProps {
  groups: readonly PatternGroup[]
  selectedGroup: PatternGroup
  master: { volume: number; muted: boolean }
  masterEffects: EffectRackState
  onSelectGroup: (groupId: string) => void
  onGroupBusChange: (groupId: string, changes: { volume?: number; muted?: boolean; solo?: boolean }) => void
  onMasterChange: (changes: { volume?: number; muted?: boolean }) => void
  onOpenGroupSlot: (slotIndex: 0 | 1) => void
  onOpenMasterSlot: (slotIndex: 0 | 1) => void
}

export function GroupMixPanel({ groups, selectedGroup, master, masterEffects, onSelectGroup, onGroupBusChange, onMasterChange, onOpenGroupSlot, onOpenMasterSlot }: GroupMixPanelProps) {
  return <section className="mixer mix-context-host" aria-labelledby="fx-group-mixer-title">
      <div className="sequencer-heading">
        <div><p className="eyebrow">MIX</p><h2 id="fx-group-mixer-title">{selectedGroup.name} mix</h2></div>
        <p className="mixer-summary">MUTE overrides SOLO</p>
      </div>
      <div className="group-strip" role="list" aria-label="Pattern group buses">
        {groups.map((group, index) => <button className={group.id === selectedGroup.id ? 'group-strip-button group-strip-selected' : 'group-strip-button'} key={group.id} type="button" aria-pressed={group.id === selectedGroup.id} onClick={() => onSelectGroup(group.id)}>G{index + 1}</button>)}
        <span className="group-strip-divider" aria-hidden="true" />
        <span className="group-strip-master">MASTER</span>
      </div>
      <div className="mix-bus-grid">
        <section className="mix-bus-card" aria-label={`${selectedGroup.name} bus`}>
          <p className="eyebrow">{selectedGroup.name.toUpperCase()} BUS</p>
          <label className="mixer-volume">VOL <output>{selectedGroup.bus!.volume.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={selectedGroup.bus!.volume} onChange={(event) => onGroupBusChange(selectedGroup.id, { volume: Number(event.target.value) })} /></label>
          <div className="mixer-buttons"><button className={selectedGroup.bus!.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={selectedGroup.bus!.muted} onClick={() => onGroupBusChange(selectedGroup.id, { muted: !selectedGroup.bus!.muted })}>MUTE</button><button className={selectedGroup.bus!.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={selectedGroup.bus!.solo} onClick={() => onGroupBusChange(selectedGroup.id, { solo: !selectedGroup.bus!.solo })}>SOLO</button></div>
          <EffectSlotList title={`${selectedGroup.name} FX`} rack={selectedGroup.effects} onSelectSlot={onOpenGroupSlot} />
        </section>
        <section className="mix-bus-card" aria-label="Master bus">
          <p className="eyebrow">MASTER</p>
          <label className="mixer-volume">VOL <output>{master.volume.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={master.volume} onChange={(event) => onMasterChange({ volume: Number(event.target.value) })} /></label>
          <div className="mixer-buttons"><button className={master.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={master.muted} onClick={() => onMasterChange({ muted: !master.muted })}>MUTE</button></div>
          <EffectSlotList title="MASTER FX" rack={masterEffects} onSelectSlot={onOpenMasterSlot} />
        </section>
      </div>
    </section>
}
