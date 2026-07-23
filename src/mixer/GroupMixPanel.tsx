import type { EffectRackState } from '../audio/effects'
import type { PatternGroup } from '../patterns/patternTypes'
import { ContextPanel } from './ContextPanel'
import { EffectSlotList } from './EffectRackPanel'
import './groupMix.css'

interface FxContext {
  scope: 'group' | 'master'
  slotIndex: 0 | 1
}

interface GroupMixPanelProps {
  groups: readonly PatternGroup[]
  selectedGroup: PatternGroup
  master: { volume: number; muted: boolean }
  masterEffects: EffectRackState
  bpm: number
  activeFxContext: FxContext | null
  onGroupBusChange: (groupId: string, changes: { volume?: number; muted?: boolean; solo?: boolean }) => void
  onMasterChange: (changes: { volume?: number; muted?: boolean }) => void
  onGroupEffectsChange: (groupId: string, effects: EffectRackState) => void
  onMasterEffectsChange: (effects: EffectRackState) => void
  onOpenGroupSlot: (slotIndex: 0 | 1) => void
  onOpenMasterSlot: (slotIndex: 0 | 1) => void
  onCloseFx: () => void
}

export function GroupMixPanel({ groups, selectedGroup, master, masterEffects, bpm, activeFxContext, onGroupBusChange, onMasterChange, onGroupEffectsChange, onMasterEffectsChange, onOpenGroupSlot, onOpenMasterSlot, onCloseFx }: GroupMixPanelProps) {
  if (activeFxContext) {
    const isGroup = activeFxContext.scope === 'group'
    return <ContextPanel
      scopeLabel={isGroup ? `GROUP FX / ${selectedGroup.name}` : 'MASTER FX'}
      slotIndex={activeFxContext.slotIndex}
      rack={isGroup ? selectedGroup.effects : masterEffects}
      bpm={bpm}
      onChange={(effects) => isGroup ? onGroupEffectsChange(selectedGroup.id, effects) : onMasterEffectsChange(effects)}
      onClose={onCloseFx}
    />
  }

  return (
    <section className="mixer mix-context-host" aria-labelledby="fx-group-mixer-title">
      <div className="sequencer-heading">
        <div><p className="eyebrow">GROUP MIX</p><h2 id="fx-group-mixer-title">Pattern Group buses + Master</h2></div>
        <p className="mixer-summary">MUTE overrides SOLO</p>
      </div>
      <div className="mixer-grid">
        {groups.map((group) => <article className={group.id === selectedGroup.id ? 'mixer-channel mixer-channel-selected' : 'mixer-channel'} key={group.id}>
          <div className="mixer-channel-heading"><strong>{group.name}</strong><span className="sample-badge sample-loaded">GROUP</span></div>
          <p className="mixer-sample">16 PAD BANK</p>
          <label className="mixer-volume">VOL <output>{group.bus!.volume.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={group.bus!.volume} onChange={(event) => onGroupBusChange(group.id, { volume: Number(event.target.value) })} /></label>
          <div className="mixer-buttons"><button className={group.bus!.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={group.bus!.muted} onClick={() => onGroupBusChange(group.id, { muted: !group.bus!.muted })}>MUTE</button><button className={group.bus!.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={group.bus!.solo} onClick={() => onGroupBusChange(group.id, { solo: !group.bus!.solo })}>SOLO</button></div>
          {group.id === selectedGroup.id && <EffectSlotList title={`${group.name} FX`} rack={group.effects} onSelectSlot={onOpenGroupSlot} />}
        </article>)}
        <article className="mixer-channel">
          <div className="mixer-channel-heading"><strong>MASTER</strong><span className="sample-badge sample-loaded">OUT</span></div>
          <p className="mixer-sample">MAIN OUTPUT</p>
          <label className="mixer-volume">VOL <output>{master.volume.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={master.volume} onChange={(event) => onMasterChange({ volume: Number(event.target.value) })} /></label>
          <div className="mixer-buttons"><button className={master.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={master.muted} onClick={() => onMasterChange({ muted: !master.muted })}>MUTE</button></div>
          <EffectSlotList title="MASTER FX" rack={masterEffects} onSelectSlot={onOpenMasterSlot} />
        </article>
      </div>
    </section>
  )
}
