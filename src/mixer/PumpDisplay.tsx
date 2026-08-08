import { useEffect, useMemo, useRef, useState } from 'react'
import { delayDivisionBeats } from '../audio/effects'
import type { GroupPadReference } from '../audio/channelIdentity'
import type { PatternGroup } from '../patterns/patternTypes'
import type { PumpCurve } from '../audio/AudioEngine'
import type { PumpRoute } from '../project/ProjectState'
import { DisplayRange } from '../shell/displayControls'
import type { DisplayTenant } from '../shell/SystemDisplay'
import { useSystemDisplay } from '../shell/systemDisplayContext'
import '../pads/padBrowser.css'
import './pumpDisplay.css'

type PumpRouteChanges = Partial<Pick<PumpRoute, 'source' | 'targetGroupId' | 'depth' | 'lengthBeats' | 'curve'>>

interface PumpDisplayLauncherProps {
  patternGroups: readonly PatternGroup[]
  routes: readonly PumpRoute[]
  /** Returns the new route's id so the caller can jump straight into editing it. */
  onAddRoute: (source: GroupPadReference, targetGroupId: string) => string
  onRemoveRoute: (routeId: string) => void
  onUpdateRoute: (routeId: string, changes: PumpRouteChanges) => void
}

interface PumpHandlers {
  onAddRoute: (source: GroupPadReference, targetGroupId: string) => string
  onRemoveRoute: (routeId: string) => void
  onUpdateRoute: (routeId: string, changes: PumpRouteChanges) => void
}

const displayId = 'pump-controls'
const lengthChoices = ['1/2', '1/4', '1/8', '1/16'] as const
const curveLabels: Record<PumpCurve, string> = { snap: 'PUNCH', smooth: 'GLIDE', swell: 'SMASH' }

function bankLabel(groupId: string, groups: readonly PatternGroup[]): string {
  const index = groups.findIndex((group) => group.id === groupId)
  return index >= 0 ? `BANK ${index + 1}` : 'BANK ?'
}

function groupLabel(groupId: string, groups: readonly PatternGroup[]): string {
  const index = groups.findIndex((group) => group.id === groupId)
  return index >= 0 ? `GROUP ${index + 1}` : 'GROUP ?'
}

function sourcePadLabel(source: GroupPadReference, groups: readonly PatternGroup[]): string {
  const pad = groups.find((group) => group.id === source.patternGroupId)?.bank.pads.find((candidate) => candidate.id === source.padId)
  return pad?.label ?? source.padId
}

function stepId<T extends { id: string }>(items: readonly T[], currentId: string, delta: number): string {
  const index = items.findIndex((item) => item.id === currentId)
  const nextIndex = Math.min(items.length - 1, Math.max(0, index + delta))
  return items[nextIndex]?.id ?? currentId
}

/**
 * Pump's routing list and per-route editor, both living in the shared MIX
 * display - the same place BUS and FX already put their controls, instead of
 * a workspace of its own. The entry button sits ahead of the channel rails so
 * it is the first thing MIX shows, not something to scroll past.
 */
export function PumpDisplayLauncher(props: PumpDisplayLauncherProps) {
  const { claim, release, ownerId } = useSystemDisplay()
  const [open, setOpen] = useState(false)
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const hasOwnedDisplayRef = useRef(false)
  const editingRoute = props.routes.find((route) => route.id === editingRouteId) ?? null

  const latestPropsRef = useRef(props)
  latestPropsRef.current = props
  const handlers = useMemo<PumpHandlers>(() => ({
    onAddRoute: (source, targetGroupId) => latestPropsRef.current.onAddRoute(source, targetGroupId),
    onRemoveRoute: (routeId) => latestPropsRef.current.onRemoveRoute(routeId),
    onUpdateRoute: (routeId, changes) => latestPropsRef.current.onUpdateRoute(routeId, changes),
  }), [])

  const tenant = useMemo<DisplayTenant>(
    () => editingRoute
      ? routeEditorTenant(editingRoute, props.patternGroups, handlers, () => setEditingRouteId(null))
      : routeListTenant(props.routes, props.patternGroups, handlers, setEditingRouteId),
    [editingRoute, props.routes, props.patternGroups, handlers],
  )

  useEffect(() => {
    if (open) claim(tenant)
    else release(displayId)
  }, [open, tenant, claim, release])

  useEffect(() => () => release(displayId), [release])

  useEffect(() => {
    if (!open) {
      hasOwnedDisplayRef.current = false
      return
    }
    if (ownerId === displayId) {
      hasOwnedDisplayRef.current = true
      return
    }
    if (hasOwnedDisplayRef.current && ownerId !== null) setOpen(false)
  }, [open, ownerId])

  // Reopening always lands on the route list, not wherever it was left.
  const toggleOpen = () => setOpen((current) => {
    if (!current) setEditingRouteId(null)
    return !current
  })

  return <button className={open ? 'mix-pump-entry mix-pump-entry-active' : 'mix-pump-entry'} type="button" aria-pressed={open} onClick={toggleOpen}>
    <span className="mix-pump-entry-title">GRAVITY <small className="mix-pump-entry-kind">(sidechain)</small></span>
    <strong>{props.routes.length}</strong>
    <small>{props.routes.length === 1 ? 'ROUTE' : 'ROUTES'}</small>
  </button>
}

function routeListTenant(routes: readonly PumpRoute[], groups: readonly PatternGroup[], handlers: PumpHandlers, onOpenRoute: (routeId: string) => void): DisplayTenant {
  const addRoute = () => {
    const firstGroup = groups[0]
    const id = handlers.onAddRoute({ patternGroupId: firstGroup.id, padId: firstGroup.bank.pads[0].id }, firstGroup.id)
    onOpenRoute(id)
  }

  return {
    id: displayId,
    label: 'Gravity sidechain routes',
    readout: routes.length === 0 ? 'GRAVITY · NO ROUTES' : `GRAVITY · ${routes.length} ROUTE${routes.length === 1 ? '' : 'S'}`,
    panel: <>
      <div className="sample-browser-list">
        {routes.map((route) => (
          <div className="pump-route-row" key={route.id}>
            <button className="pump-route-open" type="button" onClick={() => onOpenRoute(route.id)}>
              {bankLabel(route.source.patternGroupId, groups)} · {sourcePadLabel(route.source, groups)} → {groupLabel(route.targetGroupId, groups)}
            </button>
            <button className="sample-browser-action" type="button" aria-label={`Remove route from ${sourcePadLabel(route.source, groups)} to ${groupLabel(route.targetGroupId, groups)}`} onClick={() => handlers.onRemoveRoute(route.id)}>✕</button>
          </div>
        ))}
        {routes.length === 0 && <p className="pump-route-empty">No routes yet. Add one below.</p>}
      </div>
      <button className="sample-browser-action pump-add-route-row" type="button" onClick={addRoute}>+ ADD ROUTE</button>
    </>,
  }
}

function routeEditorTenant(route: PumpRoute, groups: readonly PatternGroup[], handlers: PumpHandlers, onBack: () => void): DisplayTenant {
  const sourceGroup = groups.find((group) => group.id === route.source.patternGroupId) ?? groups[0]
  const sourcePads = sourceGroup.bank.pads
  const sourceGroupIndex = groups.findIndex((group) => group.id === route.source.patternGroupId)
  const sourcePadIndex = sourcePads.findIndex((pad) => pad.id === route.source.padId)
  const targetGroupIndex = groups.findIndex((group) => group.id === route.targetGroupId)

  const update = (changes: PumpRouteChanges) => handlers.onUpdateRoute(route.id, changes)
  const stepSourceGroup = (delta: number) => update({ source: { patternGroupId: stepId(groups, route.source.patternGroupId, delta), padId: route.source.padId } })
  const stepSourcePad = (delta: number) => update({ source: { patternGroupId: route.source.patternGroupId, padId: stepId(sourcePads, route.source.padId, delta) } })
  const stepTargetGroup = (delta: number) => update({ targetGroupId: stepId(groups, route.targetGroupId, delta) })
  const removeAndBack = () => { handlers.onRemoveRoute(route.id); onBack() }

  return {
    id: displayId,
    label: 'Gravity sidechain route',
    readout: `GRAVITY ROUTE · ${bankLabel(route.source.patternGroupId, groups)} · ${sourcePadLabel(route.source, groups)} → ${groupLabel(route.targetGroupId, groups)}`,
    panel: <>
      {/* Takes the folder row's place instead of stacking above it, matching
          how the pad sound screen returns to its browser. */}
      <div className="sample-browser-folder">
        <button className="sample-browser-folder-step" type="button" aria-label="Back to route list" onClick={onBack}>‹</button>
        <span>ROUTE</span>
        <span aria-hidden="true" />
      </div>
      <div className="sample-browser-folder">
        <button className="sample-browser-folder-step" type="button" aria-label="Previous source bank" disabled={sourceGroupIndex <= 0} onClick={() => stepSourceGroup(-1)}>‹</button>
        <span>FROM BANK / {bankLabel(route.source.patternGroupId, groups)}</span>
        <button className="sample-browser-folder-step" type="button" aria-label="Next source bank" disabled={sourceGroupIndex >= groups.length - 1} onClick={() => stepSourceGroup(1)}>›</button>
      </div>
      <div className="sample-browser-folder">
        <button className="sample-browser-folder-step" type="button" aria-label="Previous source pad" disabled={sourcePadIndex <= 0} onClick={() => stepSourcePad(-1)}>‹</button>
        <span>FROM PAD / {sourcePadLabel(route.source, groups)}</span>
        <button className="sample-browser-folder-step" type="button" aria-label="Next source pad" disabled={sourcePadIndex >= sourcePads.length - 1} onClick={() => stepSourcePad(1)}>›</button>
      </div>
      <div className="sample-browser-folder">
        <button className="sample-browser-folder-step" type="button" aria-label="Previous target group" disabled={targetGroupIndex <= 0} onClick={() => stepTargetGroup(-1)}>‹</button>
        <span>TO GROUP / {groupLabel(route.targetGroupId, groups)}</span>
        <button className="sample-browser-folder-step" type="button" aria-label="Next target group" disabled={targetGroupIndex >= groups.length - 1} onClick={() => stepTargetGroup(1)}>›</button>
      </div>
      <DisplayRange idPrefix="pump-route" label="DEPTH" formatValue={(value) => `${Math.round(value * 100)}%`} min="0" max="1" step="0.01" current={route.depth} onChange={(depth) => update({ depth })} />
      <div className="display-param">
        <span className="display-param-label">LENGTH</span>
        <div className="display-actions">
          {lengthChoices.map((division) => <button className={route.lengthBeats === delayDivisionBeats[division] ? 'display-action display-action-active' : 'display-action'} key={division} type="button" aria-pressed={route.lengthBeats === delayDivisionBeats[division]} onClick={() => update({ lengthBeats: delayDivisionBeats[division] })}>{division}</button>)}
        </div>
      </div>
      <div className="display-param">
        <span className="display-param-label">SHAPE</span>
        <div className="display-actions">
          {(Object.keys(curveLabels) as PumpCurve[]).map((curve) => <button className={route.curve === curve ? 'display-action display-action-active' : 'display-action'} key={curve} type="button" aria-pressed={route.curve === curve} onClick={() => update({ curve })}>{curveLabels[curve]}</button>)}
        </div>
      </div>
      <button className="display-action display-action-danger" type="button" onClick={removeAndBack}>REMOVE ROUTE</button>
    </>,
  }
}
