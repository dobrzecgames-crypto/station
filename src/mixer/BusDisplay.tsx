import { useEffect, useMemo, useRef } from 'react'
import { effectTypeLabel } from '../audio/effects'
import type { EffectRackState, EffectSlotState } from '../audio/effects'
import { DisplayRange } from '../shell/displayControls'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'

export interface BusState {
  volume: number
  muted: boolean
  /** The master has no solo - there is nothing for it to be soloed against. */
  solo?: boolean
}

interface BusDisplayLauncherProps {
  /** Names the bus on the line, e.g. "G1" or "MASTER". */
  scopeLabel: string
  bus: BusState
  rack: EffectRackState
  /** True while an FX slot owns the display. The bus must not claim it back
      from the effect it just opened. */
  suspended: boolean
  /** Bumped when the user taps a mix target. Tapping one is a request to see
      that bus, so it takes the display back from whoever holds it - otherwise
      choosing a target while Pump is up lights the button and changes nothing
      on screen. */
  claimNonce: number
  onVolumeChange: (volume: number) => void
  onMutedChange: (muted: boolean) => void
  onSoloChange?: (solo: boolean) => void
  onOpenSlot: (slotIndex: 0 | 1) => void
  /** Creates a sidechain route and hands the display to its editor. The route
      controls themselves stay with Pump, rather than turning the bus screen
      into a second routing implementation. */
  onAddPumpRoute: () => void
}

const displayId = 'bus-controls'

function slotLabel(slot: EffectSlotState): string {
  if (slot.type === 'none') return 'EMPTY'
  return slot.enabled ? effectTypeLabel(slot.type) : `${effectTypeLabel(slot.type)} · BYPASS`
}

/* The line separates slots with the same dot the row label uses between an
   effect and its bypass state, so "DELAY · BYPASS · COMPRESSOR · BYPASS" reads
   as four things rather than two. The line names the effects; whether one is
   bypassed is on its own row, where there is room to say it. */
function slotReadout(slot: EffectSlotState): string {
  return slot.type === 'none' ? 'EMPTY' : effectTypeLabel(slot.type)
}

/** The selected mix target on the shared display: level, mute/solo, and both FX
 *  slots with what is in them.
 *
 *  This replaces a collapsed `<details>` in the workspace that held the same
 *  controls. Reaching a compressor's threshold from MIX used to mean opening
 *  that disclosure, choosing a target, tapping a slot and then choosing an
 *  effect - four taps, the first of which was hidden behind a triangle. The
 *  target row stays in the workspace because it is a choice between places;
 *  everything about the chosen place lives here. */
export function BusDisplayLauncher(props: BusDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const onVolumeChangeRef = useRef(props.onVolumeChange)
  const onMutedChangeRef = useRef(props.onMutedChange)
  const onSoloChangeRef = useRef(props.onSoloChange)
  const onOpenSlotRef = useRef(props.onOpenSlot)
  const onAddPumpRouteRef = useRef(props.onAddPumpRoute)
  onVolumeChangeRef.current = props.onVolumeChange
  onMutedChangeRef.current = props.onMutedChange
  onSoloChangeRef.current = props.onSoloChange
  onOpenSlotRef.current = props.onOpenSlot
  onAddPumpRouteRef.current = props.onAddPumpRoute

  /* App rebuilds its handlers every render, so the tenant is memoised on the
     values actually rendered and reaches the live handlers through refs.
     Depending on the props object would re-claim after every claim, because a
     claim updates App. */
  const tenant = useMemo<DisplayTenant>(() => busTenant({
    scopeLabel: props.scopeLabel,
    bus: props.bus,
    rack: props.rack,
    onVolumeChange: (volume) => onVolumeChangeRef.current(volume),
    onMutedChange: (muted) => onMutedChangeRef.current(muted),
    onSoloChange: onSoloChangeRef.current ? (solo: boolean) => onSoloChangeRef.current!(solo) : undefined,
    onOpenSlot: (slotIndex) => onOpenSlotRef.current(slotIndex),
    onAddPumpRoute: () => onAddPumpRouteRef.current(),
  }), [props.scopeLabel, props.bus.volume, props.bus.muted, props.bus.solo, props.rack])

  /* Resting behaviour is deferential: claim only when nothing else holds the
     display, because Pump and the FX slots are reached from here and must not
     be shoved aside by their own parent. An explicit tap on a target overrides
     that and takes the screen. */
  const claimNonceRef = useRef(props.claimNonce)
  useEffect(() => {
    const requested = claimNonceRef.current !== props.claimNonce
    claimNonceRef.current = props.claimNonce
    if (props.suspended) return
    if (requested || ownerId === null || ownerId === displayId) claim(tenant)
  }, [claim, ownerId, tenant, props.suspended, props.claimNonce])

  useEffect(() => () => release(displayId), [release])

  return null
}

interface BusTenantProps {
  scopeLabel: string
  bus: BusState
  rack: EffectRackState
  onVolumeChange: (volume: number) => void
  onMutedChange: (muted: boolean) => void
  onSoloChange?: (solo: boolean) => void
  onOpenSlot: (slotIndex: 0 | 1) => void
  onAddPumpRoute: () => void
}

function busTenant(props: BusTenantProps): DisplayTenant {
  const { bus, rack, scopeLabel } = props
  return {
    id: displayId,
    label: `${scopeLabel} bus`,
    readout: `${scopeLabel} BUS · ${rack.slots.map(slotReadout).join(' · ')}`,
    panel: <>
      <DisplayRange idPrefix="bus-display" label="VOL" formatValue={(value) => value.toFixed(2)} min="0" max="1" step="0.01" current={bus.volume} onChange={props.onVolumeChange} />
      <div className="display-param">
        <span className="display-param-label">OUTPUT</span>
        <div className="display-actions">
          <button className={bus.muted ? 'display-action display-action-active' : 'display-action'} type="button" aria-pressed={bus.muted} onClick={() => props.onMutedChange(!bus.muted)}>MUTE</button>
          {props.onSoloChange && <button className={bus.solo ? 'display-action display-action-active' : 'display-action'} type="button" aria-pressed={bus.solo} onClick={() => props.onSoloChange!(!bus.solo)}>SOLO</button>}
        </div>
      </div>
      {/* Both slots are named on the screen rather than hidden behind a tap, so
          the rack reads at a glance and opening one is a decision rather than a
          probe. The chevron marks the row as a way through, matching the pad
          browser's EDIT. */}
      {rack.slots.map((slot, index) => <button
        className="display-toggle"
        key={slot.id}
        type="button"
        aria-label={`${scopeLabel} FX slot ${index + 1}, ${slotLabel(slot)}`}
        onClick={() => props.onOpenSlot(index as 0 | 1)}
      >
        <span className="display-param-label">FX {index + 1}</span>
        <span className="display-toggle-value" aria-hidden="true">{slotLabel(slot)} ›</span>
      </button>)}
      <div className="display-actions">
        <button className="display-action" type="button" aria-label="Add sidechain route" onClick={props.onAddPumpRoute}>+ ADD ROUTE</button>
      </div>
    </>,
  }
}
