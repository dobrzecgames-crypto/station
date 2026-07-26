import { useState } from 'react'
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
  const [scope, setScope] = useState<'group' | 'master'>('group')

  return <details className="mix-routing" aria-label="Bus and effects">
    <summary>BUS &amp; FX</summary>
    <section className="mixer mix-context-host mix-routing-content" aria-label="Bus and effects controls">
      <div className="mix-routing-targets" role="group" aria-label="Mix target">
        {groups.map((group, index) => <button className={scope === 'group' && group.id === selectedGroup.id ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} key={group.id} type="button" aria-pressed={scope === 'group' && group.id === selectedGroup.id} onClick={() => { setScope('group'); onSelectGroup(group.id) }}>G{index + 1}</button>)}
        <button className={scope === 'master' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={scope === 'master'} onClick={() => setScope('master')}>MASTER</button>
      </div>

      {scope === 'group' ? (
        <section className="mix-routing-target" aria-label={`${selectedGroup.name} bus`}>
          <div className="mix-routing-target-header"><p className="eyebrow">{selectedGroup.name.toUpperCase()} BUS</p><div className="mix-routing-buttons"><button className={selectedGroup.bus!.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={selectedGroup.bus!.muted} onClick={() => onGroupBusChange(selectedGroup.id, { muted: !selectedGroup.bus!.muted })}>M</button><button className={selectedGroup.bus!.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={selectedGroup.bus!.solo} onClick={() => onGroupBusChange(selectedGroup.id, { solo: !selectedGroup.bus!.solo })}>S</button></div></div>
          <label className="mix-routing-volume">VOL <output>{selectedGroup.bus!.volume.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={selectedGroup.bus!.volume} onChange={(event) => onGroupBusChange(selectedGroup.id, { volume: Number(event.target.value) })} /></label>
          <EffectSlotList title={`${selectedGroup.name} FX`} rack={selectedGroup.effects} onSelectSlot={onOpenGroupSlot} />
        </section>
      ) : (
        <section className="mix-routing-target" aria-label="Master bus">
          <div className="mix-routing-target-header"><p className="eyebrow">MASTER BUS</p><div className="mix-routing-buttons"><button className={master.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={master.muted} onClick={() => onMasterChange({ muted: !master.muted })}>M</button></div></div>
          <label className="mix-routing-volume">VOL <output>{master.volume.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={master.volume} onChange={(event) => onMasterChange({ volume: Number(event.target.value) })} /></label>
          <EffectSlotList title="MASTER FX" rack={masterEffects} onSelectSlot={onOpenMasterSlot} />
        </section>
      )}
    </section>
  </details>
}
