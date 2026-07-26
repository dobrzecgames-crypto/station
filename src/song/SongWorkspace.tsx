import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import { getLastOccupiedSlot } from './songOperations'
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
}

const SLOTS_PER_BAR = 4
const MIN_VISIBLE_SLOTS = 16

export function SongWorkspace({ groups, clips, selectedGroupId, selectedVariant, activeSlot, onPaintSlot }: SongWorkspaceProps) {
  const lastSlot = getLastOccupiedSlot(clips)
  const visibleSlots = Array.from({ length: Math.max(MIN_VISIBLE_SLOTS, (lastSlot ?? 0) + SLOTS_PER_BAR) }, (_, index) => index + 1)
  const rows = groups.flatMap((group) => patternVariantNames.filter((name) => group.variants[name]).map((name) => ({ group, variant: name })))
  const trackTemplate = `repeat(${visibleSlots.length}, minmax(30px, 1fr))`
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
  const paintAt = (clientX: number, clientY: number) => {
    const current = stroke.current
    if (!current) return
    const slotElement = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-slot]')
    if (!slotElement) return
    if (slotElement.dataset.groupId !== current.groupId || slotElement.dataset.variant !== current.variant) return
    onPaintSlot(current.groupId, current.variant, Number(slotElement.dataset.slot), current.add)
  }

  const beginPaint = (event: ReactPointerEvent<HTMLElement>, groupId: string, variant: PatternVariantName, slot: number, filled: boolean) => {
    event.preventDefault()
    const add = !filled
    stroke.current = { groupId, variant, add }
    // Capture so the moves keep arriving here once the finger leaves this slot;
    // paintAt works out which slot is actually under the pointer.
    event.currentTarget.setPointerCapture(event.pointerId)
    onPaintSlot(groupId, variant, slot, add)
  }

  return <section className="song-workspace" aria-label="Song arrangement">
    <div className="arrangement-scroll">
      <div className="arrangement">
        <div className="arrangement-ruler">
          <span className="arrangement-lane-name" aria-hidden="true" />
          <div className="arrangement-track" style={{ gridTemplateColumns: trackTemplate }}>
            {visibleSlots.map((slot) => (
              <span
                key={slot}
                className={`arrangement-tick${(slot - 1) % SLOTS_PER_BAR === 0 ? ' arrangement-tick-bar' : ''}${activeSlot === slot ? ' arrangement-tick-playing' : ''}`}
              >
                {(slot - 1) % SLOTS_PER_BAR === 0 ? slot : ''}
              </span>
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
                  // Every other bar sits a shade darker, the same trick the step
                  // matrix uses, so the eye counts bars instead of slots.
                  const dimBar = Math.floor((slot - 1) / SLOTS_PER_BAR) % 2 === 1
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
                      className={`arrangement-slot${filled ? ' arrangement-slot-filled' : ''}${(slot - 1) % SLOTS_PER_BAR === 0 ? ' arrangement-slot-bar' : ''}${dimBar ? ' arrangement-slot-bar-dim' : ''}${activeSlot === slot ? ' arrangement-slot-playing' : ''}`}
                      onPointerDown={(event) => beginPaint(event, group.id, variant, slot, filled)}
                      onPointerMove={(event) => paintAt(event.clientX, event.clientY)}
                      onPointerUp={() => { stroke.current = null }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  </section>
}
