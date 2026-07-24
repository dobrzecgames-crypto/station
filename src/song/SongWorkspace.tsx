import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, RefObject } from 'react'
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
  onAddClip: (groupId: string, variant: PatternVariantName, startSlot: number) => void
  onPaintSlot: (groupId: string, variant: PatternVariantName, startSlot: number, shouldExist: boolean) => void
}

interface PaintStroke {
  groupId: string
  variant: PatternVariantName
  add: boolean
}

export function SongWorkspace({ groups, clips, selectedGroupId, selectedVariant, activeSlot, onAddClip, onPaintSlot }: SongWorkspaceProps) {
  const lastSlot = getLastOccupiedSlot(clips)
  const visibleSlots = Array.from({ length: Math.max(8, (lastSlot ?? 0) + 4) }, (_, index) => index + 1)
  const [startSlotText, setStartSlotText] = useState('1')
  const startSlot = /^\d+$/.test(startSlotText) ? Number(startSlotText) : null
  const startSlotValid = startSlot !== null && startSlot >= 1
  const selectedGroup = groups.find((item) => item.id === selectedGroupId) ?? groups[0]
  const rows = groups.flatMap((item) => patternVariantNames.filter((name) => item.variants[name]).map((name) => ({ group: item, variant: name })))
  const selectedLabel = `${selectedGroup.name} ${selectedVariant}`
  const paintStroke = useRef<PaintStroke | null>(null)
  useEffect(() => {
    const endStroke = () => { paintStroke.current = null }
    window.addEventListener('mouseup', endStroke)
    return () => window.removeEventListener('mouseup', endStroke)
  }, [])
  return <section className="song-workspace" aria-labelledby="song-title"><div className="sequencer-heading"><div><p className="eyebrow">SONG</p><h2 id="song-title">Pattern Playlist</h2></div></div>
    <div className="song-add-controls"><strong>PLACE {selectedLabel}</strong><span className="song-current-note">Pick a different pattern in the SEQ tab first.</span><label>START SLOT <input type="text" inputMode="numeric" pattern="[0-9]*" value={startSlotText} onChange={(event) => setStartSlotText(event.target.value.replace(/\D/g, ''))} onBlur={() => { if (startSlotValid) setStartSlotText(String(startSlot)) }} /></label><button className="transport-button" type="button" disabled={!startSlotValid} onClick={() => onAddClip(selectedGroup.id, selectedVariant, startSlot!)}>ADD CLIP</button></div>
    <div className="playlist-scroll"><div className="playlist-grid" style={{ gridTemplateColumns: `110px repeat(${visibleSlots.length}, minmax(92px, 1fr))` }}><strong className="playlist-label">PATTERN ↓ / SLOT →</strong>{visibleSlots.map((slot) => <strong key={slot} className={activeSlot === slot ? 'playlist-slot active-song-slot' : 'playlist-slot'}>{slot}</strong>)}{rows.map(({ group, variant }) => <PlaylistRow key={`${group.id}-${variant}`} group={group} variant={variant} clips={clips} activeSlot={activeSlot} paintStroke={paintStroke} onPaintSlot={onPaintSlot} />)}</div></div>
  </section>
}

function PlaylistRow({ group, variant, clips, activeSlot, paintStroke, onPaintSlot }: { group: PatternGroup; variant: PatternVariantName; clips: readonly PatternClip[]; activeSlot: number | null; paintStroke: RefObject<PaintStroke | null>; onPaintSlot: (groupId: string, variant: PatternVariantName, startSlot: number, shouldExist: boolean) => void }) {
  const rowClips = clips.filter((clip) => clip.patternGroupId === group.id && clip.variant === variant)
  const lastSlot = getLastOccupiedSlot(clips) ?? 1
  const startPaint = (slot: number, hasClip: boolean) => {
    const add = !hasClip
    paintStroke.current = { groupId: group.id, variant, add }
    onPaintSlot(group.id, variant, slot, add)
  }
  const continuePaint = (slot: number, event: MouseEvent) => {
    const stroke = paintStroke.current
    if (!stroke || event.buttons !== 1 || stroke.groupId !== group.id || stroke.variant !== variant) return
    onPaintSlot(group.id, variant, slot, stroke.add)
  }
  return <><span className="playlist-label">{group.name.replace('Pattern ', '')}{variant}</span>{Array.from({ length: Math.max(8, lastSlot + 4) }, (_, index) => index + 1).map((slot) => { const slotClips = rowClips.filter((clip) => clip.startSlot === slot); return <div key={slot} className={activeSlot === slot ? 'playlist-cell active-song-slot' : 'playlist-cell'} onMouseDown={(event) => { event.preventDefault(); startPaint(slot, slotClips.length > 0) }} onMouseEnter={(event) => continuePaint(slot, event)}>{slotClips.map((clip) => <span key={clip.id} className="playlist-clip">{group.name.replace('Pattern ', '')}{variant}</span>)}</div> })}</>
}
