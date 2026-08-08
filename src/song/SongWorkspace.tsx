import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import type { PatternClip } from './songTypes'

interface SongWorkspaceProps {
  groups: readonly PatternGroup[]
  clips: readonly PatternClip[]
  selectedGroupId: string
  selectedVariant: PatternVariantName
  activeSlot: number | null
  onPaintSlot: (groupId: string, variant: PatternVariantName, startSlot: number, shouldExist: boolean) => void
}

interface PaintStroke {
  groupId: string
  variant: PatternVariantName
  add: boolean
  pointerId: number
}

const SLOTS_PER_PAGE = 8

export function SongWorkspace({ groups, clips, selectedGroupId, selectedVariant, activeSlot, onPaintSlot }: SongWorkspaceProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const firstSlot = pageIndex * SLOTS_PER_PAGE + 1
  const visibleSlots = Array.from({ length: SLOTS_PER_PAGE }, (_, index) => firstSlot + index)
  const rows = groups.flatMap((group) => patternVariantNames.filter((name) => group.variants[name]).map((name) => ({ group, variant: name })))
  const trackTemplate = `repeat(${SLOTS_PER_PAGE}, minmax(0, 1fr))`
  const stroke = useRef<PaintStroke | null>(null)

  useEffect(() => {
    const endStroke = () => { stroke.current = null }
    window.addEventListener('pointerup', endStroke)
    window.addEventListener('pointercancel', endStroke)
    return () => {
      window.removeEventListener('pointerup', endStroke)
      window.removeEventListener('pointercancel', endStroke)
    }
  }, [])

  // Pointer events rather than mouse events, and the target is resolved by hit
  // testing rather than by mouseenter. A touch drag never fires enter on the
  // elements it passes over, so the old mouse-only version could only ever
  // paint one slot on a phone - which is the whole device this app now targets.
  const paintAt = (pointerId: number, clientX: number, clientY: number) => {
    const current = stroke.current
    if (!current || current.pointerId !== pointerId) return
    const slotElement = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-slot]')
    if (!slotElement) return
    if (slotElement.dataset.groupId !== current.groupId || slotElement.dataset.variant !== current.variant) return
    onPaintSlot(current.groupId, current.variant, Number(slotElement.dataset.slot), current.add)
  }

  const beginPaint = (event: ReactPointerEvent<HTMLElement>, groupId: string, variant: PatternVariantName, slot: number, filled: boolean) => {
    if (stroke.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    const add = !filled
    stroke.current = { groupId, variant, add, pointerId: event.pointerId }
    // Capture so the moves keep arriving here once the finger leaves this slot;
    // paintAt works out which slot is actually under the pointer.
    event.currentTarget.setPointerCapture(event.pointerId)
    onPaintSlot(groupId, variant, slot, add)
  }

  return <section className="song-workspace" aria-label="Song arrangement">
    <div className="arrangement-page-controls" role="group" aria-label="Song slot pages">
      <button className="mixer-toggle" type="button" disabled={pageIndex === 0} onClick={() => setPageIndex((current) => current - 1)}>←</button>
      <output className="arrangement-page-readout" aria-label={`Showing slots ${firstSlot} through ${firstSlot + SLOTS_PER_PAGE - 1}`}>{String(firstSlot).padStart(2, '0')}–{String(firstSlot + SLOTS_PER_PAGE - 1).padStart(2, '0')}</output>
      <button className="mixer-toggle" type="button" onClick={() => setPageIndex((current) => current + 1)}>→</button>
    </div>
    <div className="arrangement">
      <div className="arrangement-ruler">
        <span className="arrangement-lane-name" aria-hidden="true" />
        <div className="arrangement-track" style={{ gridTemplateColumns: trackTemplate }}>
          {visibleSlots.map((slot) => (
            <span key={slot} className={`arrangement-tick${activeSlot === slot ? ' arrangement-tick-playing' : ''}`}>{slot}</span>
          ))}
        </div>
      </div>

      {rows.map(({ group, variant }) => {
        const isCurrent = group.id === selectedGroupId && variant === selectedVariant
        const rowClips = clips.filter((clip) => clip.patternGroupId === group.id && clip.variant === variant)
        /* Bank number from the position in the list, matching the transport.
           This used to strip the prefix off the stored name, which meant the
           label depended on a string in saved project data - and would have
           printed the whole name for any group that was not called
           "Pattern N". */
        const shortLabel = `${groups.findIndex((item) => item.id === group.id) + 1}${variant}`
        return (
          <div className={`arrangement-lane${isCurrent ? ' arrangement-lane-current' : ''}`} key={`${group.id}-${variant}`}>
            {/* The lane for the pattern selected in SEQ is marked rather than
                announced - this replaces the "PLACE Pattern 1 A" line that
                used to say the same thing in words above the grid. */}
            <span className="arrangement-lane-name">{shortLabel}</span>
            <div className="arrangement-track" style={{ gridTemplateColumns: trackTemplate }}>
              {visibleSlots.map((slot) => {
                const filled = rowClips.some((clip) => clip.startSlot === slot)
                return (
                  <div
                    key={slot}
                    role="button"
                    tabIndex={-1}
                    aria-label={`${shortLabel}, slot ${slot}, ${filled ? 'filled' : 'empty'}`}
                    aria-pressed={filled}
                    data-slot={slot}
                    data-group-id={group.id}
                    data-variant={variant}
                    className={`arrangement-slot${filled ? ' arrangement-slot-filled' : ''}${activeSlot === slot ? ' arrangement-slot-playing' : ''}`}
                    onPointerDown={(event) => beginPaint(event, group.id, variant, slot, filled)}
                    onPointerMove={(event) => paintAt(event.pointerId, event.clientX, event.clientY)}
                    onPointerUp={(event) => { if (stroke.current?.pointerId === event.pointerId) stroke.current = null }}
                    onPointerCancel={(event) => { if (stroke.current?.pointerId === event.pointerId) stroke.current = null }}
                    onLostPointerCapture={(event) => { if (stroke.current?.pointerId === event.pointerId) stroke.current = null }}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
      </div>
  </section>
}
