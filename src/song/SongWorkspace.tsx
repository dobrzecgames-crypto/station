import { useState } from 'react'
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
}

export function SongWorkspace({ groups, clips, selectedGroupId, selectedVariant, activeSlot, onAddClip }: SongWorkspaceProps) {
  const lastSlot = getLastOccupiedSlot(clips)
  const visibleSlots = Array.from({ length: Math.max(8, (lastSlot ?? 0) + 4) }, (_, index) => index + 1)
  const [startSlot, setStartSlot] = useState(1)
  const selectedGroup = groups.find((item) => item.id === selectedGroupId) ?? groups[0]
  const rows = groups.flatMap((item) => patternVariantNames.filter((name) => item.variants[name]).map((name) => ({ group: item, variant: name })))
  const selectedLabel = `${selectedGroup.name} ${selectedVariant}`
  return <section className="song-workspace" aria-labelledby="song-title"><div className="sequencer-heading"><div><p className="eyebrow">SONG</p><h2 id="song-title">Pattern Playlist</h2></div><p className="sequence-target">Rows are patterns. Columns are time slots. Matching columns play together.</p></div>
    <div className="song-add-controls"><strong>PLACE {selectedLabel}</strong><span className="song-current-note">Change the current pattern in SEQ.</span><label>START SLOT <input type="number" min="1" step="1" value={startSlot} onChange={(event) => setStartSlot(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></label><button className="transport-button" type="button" onClick={() => onAddClip(selectedGroup.id, selectedVariant, startSlot)}>ADD CLIP</button></div>
    <div className="playlist-scroll"><div className="playlist-grid" style={{ gridTemplateColumns: `110px repeat(${visibleSlots.length}, minmax(92px, 1fr))` }}><strong className="playlist-label">PATTERN ↓ / SLOT →</strong>{visibleSlots.map((slot) => <strong key={slot} className={activeSlot === slot ? 'playlist-slot active-song-slot' : 'playlist-slot'}>{slot}</strong>)}{rows.map(({ group, variant }) => <PlaylistRow key={`${group.id}-${variant}`} group={group} variant={variant} clips={clips} activeSlot={activeSlot} />)}</div></div>
    <p className="sequence-target">Playlist end: {lastSlot ?? 'empty'}. Add a clip at any positive slot; Station does not impose a short song-length limit.</p>
  </section>
}

function PlaylistRow({ group, variant, clips, activeSlot }: { group: PatternGroup; variant: PatternVariantName; clips: readonly PatternClip[]; activeSlot: number | null }) {
  const rowClips = clips.filter((clip) => clip.patternGroupId === group.id && clip.variant === variant)
  const lastSlot = getLastOccupiedSlot(clips) ?? 1
  return <><span className="playlist-label">{group.name.replace('Pattern ', '')}{variant}</span>{Array.from({ length: Math.max(8, lastSlot + 4) }, (_, index) => index + 1).map((slot) => { const slotClips = rowClips.filter((clip) => clip.startSlot === slot); return <div key={slot} className={activeSlot === slot ? 'playlist-cell active-song-slot' : 'playlist-cell'}>{slotClips.map((clip) => <span key={clip.id} className="playlist-clip">{group.name.replace('Pattern ', '')}{variant}</span>)}</div> })}</>
}
