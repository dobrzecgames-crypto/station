import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AudioTrack } from './tracksTypes'

interface TrackControlsProps {
  track: AudioTrack
  audioReady: boolean
  onSetTrackMuted: (trackId: string, muted: boolean) => void
  onSetTrackSolo: (trackId: string, solo: boolean) => void
  onMoveTrackOrder: (trackId: string, direction: 'up' | 'down') => void
  onImportClipToTrack: (trackId: string, file: File) => void
  onRequestRemoveTrack: (trackId: string) => void
}

/**
 * Per-track control cluster, shared by the compact TracksWorkspace header
 * and the wide TracksArranger rail - previously two separate copies of a
 * fixed 6-button block (M/S/reorder-up/reorder-down/add-clip/remove) that
 * was on screen at full size for every track, all the time. M and S are the
 * controls reached for mid-playback, so they stay put; the other four are
 * one-off setup/structure actions (reorder, import a clip, remove the
 * track) and collapse behind a single small "more" toggle instead - three
 * small buttons at rest, not six.
 */
export function TrackControls({ track, audioReady, onSetTrackMuted, onSetTrackSolo, onMoveTrackOrder, onImportClipToTrack, onRequestRemoveTrack }: TrackControlsProps) {
  const [expanded, setExpanded] = useState(false)
  const addClipInputRef = useRef<HTMLInputElement>(null)

  const handleAddClipFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImportClipToTrack(track.id, file)
  }

  if (!expanded) {
    return (
      <div className="tracks-controls-row">
        <button type="button" className={track.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={track.muted} aria-label={`${track.name} mute`} onClick={() => onSetTrackMuted(track.id, !track.muted)}>M</button>
        <button type="button" className={track.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={track.solo} aria-label={`${track.name} solo`} onClick={() => onSetTrackSolo(track.id, !track.solo)}>S</button>
        <button type="button" className="mixer-toggle" aria-label={`More actions for ${track.name}`} aria-expanded={false} onClick={() => setExpanded(true)}>⋮</button>
      </div>
    )
  }

  return (
    <div className="tracks-controls-row">
      <button type="button" className="mixer-toggle" aria-label={`Close ${track.name} actions`} aria-expanded={true} onClick={() => setExpanded(false)}>◂</button>
      <button type="button" className="mixer-toggle" aria-label={`Move ${track.name} up`} onClick={() => onMoveTrackOrder(track.id, 'up')}>▲</button>
      <button type="button" className="mixer-toggle" aria-label={`Move ${track.name} down`} onClick={() => onMoveTrackOrder(track.id, 'down')}>▼</button>
      <label className="tracks-add-clip-button mixer-toggle" title={`Import audio onto ${track.name}`}>
        +
        <input type="file" accept="audio/wav,.wav" disabled={!audioReady} onChange={handleAddClipFile} ref={addClipInputRef} />
      </label>
      <button type="button" className="mixer-toggle compact-danger" aria-label={`Remove ${track.name}`} onClick={() => onRequestRemoveTrack(track.id)}>✕</button>
    </div>
  )
}
