import { useState } from 'react'
import { delayDivisionBeats } from '../audio/effects'
import type { GroupPadReference } from '../audio/channelIdentity'
import type { PatternGroup } from '../patterns/patternTypes'
import type { PumpCurve } from '../audio/AudioEngine'
import type { PumpRoute } from '../project/ProjectState'
import './pump.css'

interface PumpScreenProps {
  patternGroups: readonly PatternGroup[]
  routes: readonly PumpRoute[]
  onAddRoute: (source: GroupPadReference, targetGroupId: string) => void
  onRemoveRoute: (routeId: string) => void
  onDepthChange: (routeId: string, depth: number) => void
  onLengthChange: (routeId: string, lengthBeats: number) => void
  onCurveChange: (routeId: string, curve: PumpCurve) => void
}

const lengthChoices = ['1/2', '1/4', '1/8', '1/16'] as const
const curveLabels: Record<PumpCurve, string> = { snap: 'PUNCH', smooth: 'GLIDE', swell: 'SMASH' }

function bankLabel(groupId: string, groups: readonly PatternGroup[]): string {
  const index = groups.findIndex((group) => group.id === groupId)
  return index >= 0 ? `BANK ${index + 1}` : 'BANK ?'
}

function sourcePadLabel(source: GroupPadReference, groups: readonly PatternGroup[]): string {
  const pad = groups.find((group) => group.id === source.patternGroupId)?.bank.pads.find((candidate) => candidate.id === source.padId)
  return pad?.label ?? source.padId
}

/**
 * The whole Pump routing surface: every sidechain link is one pad triggering
 * a whole Bank's ducking, listed here explicitly - FROM the trigger pad, TO
 * the Bank it pumps. Several routes can run at once, each independent.
 */
export function PumpScreen({ patternGroups, routes, onAddRoute, onRemoveRoute, onDepthChange, onLengthChange, onCurveChange }: PumpScreenProps) {
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [draftGroupId, setDraftGroupId] = useState(patternGroups[0]?.id ?? '')
  const [draftPadId, setDraftPadId] = useState(patternGroups[0]?.bank.pads[0]?.id ?? '')
  const [draftTargetGroupId, setDraftTargetGroupId] = useState(patternGroups[0]?.id ?? '')

  const draftPads = patternGroups.find((group) => group.id === draftGroupId)?.bank.pads ?? []

  const openCreator = () => {
    const firstGroup = patternGroups[0]
    setDraftGroupId(firstGroup?.id ?? '')
    setDraftPadId(firstGroup?.bank.pads[0]?.id ?? '')
    setDraftTargetGroupId(firstGroup?.id ?? '')
    setCreatorOpen(true)
  }

  const changeDraftGroup = (groupId: string) => {
    setDraftGroupId(groupId)
    setDraftPadId(patternGroups.find((group) => group.id === groupId)?.bank.pads[0]?.id ?? '')
  }

  const confirmCreator = () => {
    if (!draftGroupId || !draftPadId || !draftTargetGroupId) return
    onAddRoute({ patternGroupId: draftGroupId, padId: draftPadId }, draftTargetGroupId)
    setCreatorOpen(false)
  }

  return (
    <section className="pump-workspace" aria-label="Pump sidechain routing">
      <p className="eyebrow">PUMP</p>
      <h2>SIDECHAIN ROUTES</h2>
      <p className="intro">Each route ducks one whole Bank whenever a single pad you pick plays - on a pad, or from the sequencer. Add one route per trigger/target pair; they run independently and stack if they overlap.</p>

      {routes.length === 0 && !creatorOpen && <p className="pump-empty">No routes yet. Add one below.</p>}

      <div className="pump-route-list">
        {routes.map((route) => (
          <article className="pump-route" key={route.id}>
            <div className="pump-route-header">
              <span className="pump-route-endpoint pump-route-from">FROM <strong>{bankLabel(route.source.patternGroupId, patternGroups)} · {sourcePadLabel(route.source, patternGroups)}</strong></span>
              <span className="pump-route-arrow" aria-hidden="true">→</span>
              <span className="pump-route-endpoint pump-route-to">TO <strong>{bankLabel(route.targetGroupId, patternGroups)}</strong> (whole bank)</span>
              <button className="pump-route-remove" type="button" aria-label={`Remove route from ${sourcePadLabel(route.source, patternGroups)} to ${bankLabel(route.targetGroupId, patternGroups)}`} onClick={() => onRemoveRoute(route.id)}>✕</button>
            </div>
            <label className="display-param pump-route-depth" htmlFor={`pump-depth-${route.id}`}>
              <span className="display-param-label">DEPTH</span>
              <output htmlFor={`pump-depth-${route.id}`}>{Math.round(route.depth * 100)}%</output>
              <input id={`pump-depth-${route.id}`} type="range" min="0" max="1" step="0.01" value={route.depth} onChange={(event) => onDepthChange(route.id, Number(event.target.value))} />
            </label>
            <div className="pump-route-controls">
              <div className="pump-route-group">
                <span className="pump-route-group-label">LENGTH</span>
                <div className="pump-route-choices">
                  {lengthChoices.map((division) => (
                    <button
                      key={division}
                      type="button"
                      className={route.lengthBeats === delayDivisionBeats[division] ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'}
                      aria-pressed={route.lengthBeats === delayDivisionBeats[division]}
                      onClick={() => onLengthChange(route.id, delayDivisionBeats[division])}
                    >{division}</button>
                  ))}
                </div>
              </div>
              <div className="pump-route-group">
                <span className="pump-route-group-label">SHAPE</span>
                <div className="pump-route-choices">
                  {(Object.keys(curveLabels) as PumpCurve[]).map((curve) => (
                    <button
                      key={curve}
                      type="button"
                      className={route.curve === curve ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'}
                      aria-pressed={route.curve === curve}
                      onClick={() => onCurveChange(route.id, curve)}
                    >{curveLabels[curve]}</button>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!creatorOpen && <button className="mixer-toggle pump-add-route" type="button" onClick={openCreator} disabled={patternGroups.length === 0}>+ ADD ROUTE</button>}

      {creatorOpen && (
        <article className="pump-route pump-route-creator">
          <div className="pump-route-group">
            <span className="pump-route-group-label">FROM (single pad)</span>
            <div className="pump-route-selects">
              <select aria-label="Source Bank" value={draftGroupId} onChange={(event) => changeDraftGroup(event.target.value)}>
                {patternGroups.map((group, index) => <option key={group.id} value={group.id}>BANK {index + 1}</option>)}
              </select>
              <select aria-label="Source pad" value={draftPadId} onChange={(event) => setDraftPadId(event.target.value)}>
                {draftPads.map((pad) => <option key={pad.id} value={pad.id}>{pad.label}</option>)}
              </select>
            </div>
          </div>
          <div className="pump-route-group">
            <span className="pump-route-group-label">TO (whole bank)</span>
            <select aria-label="Target Bank" value={draftTargetGroupId} onChange={(event) => setDraftTargetGroupId(event.target.value)}>
              {patternGroups.map((group, index) => <option key={group.id} value={group.id}>BANK {index + 1}</option>)}
            </select>
          </div>
          <div className="project-workspace-actions">
            <button className="mixer-toggle" type="button" onClick={() => setCreatorOpen(false)}>CANCEL</button>
            <button className="mixer-toggle mixer-toggle-active" type="button" onClick={confirmCreator}>ADD ROUTE</button>
          </div>
        </article>
      )}
    </section>
  )
}
