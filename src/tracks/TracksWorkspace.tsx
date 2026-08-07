import { useRef } from 'react'
import type { ChangeEvent, CSSProperties, UIEvent } from 'react'
import type { SampleAssetId } from '../audio/AudioEngine'
import { SnapGridSelect } from './SnapGridSelect'
import { trackAccentColor } from './trackAccent'
import { TrackClipWaveform } from './TrackClipWaveform'
import { TrackControls } from './TrackControls'
import type { AudioClip, AudioTrack, TimelineGridDivision } from './tracksTypes'
import { useTrackClipDrag } from './useTrackClipDrag'
import type { TracksViewState } from './useTracksViewState'
import './tracksWorkspace.css'

const barBeats = 4
/** How far past the last clip's own end an empty track still renders, so
    there is always somewhere to drop a new clip and the ruler doesn't end
    mid-arrangement. */
const minimumVisibleBars = 16

interface TracksWorkspaceProps {
  tracks: readonly AudioTrack[]
  waveforms: Readonly<Record<SampleAssetId, number[]>>
  audioReady: boolean
  isPlaying: boolean
  playheadBeat: number
  snapDivision: TimelineGridDivision
  maximumTracks: number
  /** Selection/zoom/scroll, lifted above both TracksWorkspace and
      TracksArranger so a device rotation swapping which one is mounted does
      not lose it - see useTracksViewState. */
  viewState: TracksViewState
  onSnapDivisionChange: (division: TimelineGridDivision) => void
  onSeekPlayhead: (beat: number) => void
  onImportNewTrack: (file: File) => void
  onImportClipToTrack: (trackId: string, file: File) => void
  onRequestRemoveTrack: (trackId: string) => void
  onMoveTrackOrder: (trackId: string, direction: 'up' | 'down') => void
  onSetTrackMuted: (trackId: string, muted: boolean) => void
  onSetTrackSolo: (trackId: string, solo: boolean) => void
  onMoveClip: (trackId: string, clipId: string, startBeat: number) => void
  onTrimClipStart: (trackId: string, clipId: string, startBeat: number) => void
  onTrimClipEnd: (trackId: string, clipId: string, endBeat: number) => void
  onSplitClipAtPlayhead: (trackId: string, clipId: string) => void
  onDuplicateClip: (trackId: string, clipId: string) => void
  onToggleClipLoop: (trackId: string, clipId: string) => void
  onRequestRemoveClip: (trackId: string, clipId: string) => void
  onOpenTrackEditor: (trackId: string) => void
}

function regionFraction(clip: AudioClip): { start: number; end: number } {
  const duration = Math.max(clip.assetDurationSeconds, clip.sourceEndSeconds)
  return duration > 0 ? { start: clip.sourceOffsetSeconds / duration, end: clip.sourceEndSeconds / duration } : { start: 0, end: 1 }
}

/**
 * The compact TRACKS view: every track at once, low and simplified, for
 * arranging structure - not precise waveform editing (that is the fullscreen
 * Track Editor, opened via the header button or a double-tap here). Shown
 * only for a phone-class viewport in portrait - see useTracksLayoutMode;
 * everything else gets TracksArranger instead, sharing the same gesture
 * logic (useTrackClipDrag) and view state (useTracksViewState).
 */
export function TracksWorkspace({ tracks, waveforms, audioReady, isPlaying, playheadBeat, snapDivision, maximumTracks, viewState, onSnapDivisionChange, onSeekPlayhead, onImportNewTrack, onImportClipToTrack, onRequestRemoveTrack, onMoveTrackOrder, onSetTrackMuted, onSetTrackSolo, onMoveClip, onTrimClipStart, onTrimClipEnd, onSplitClipAtPlayhead, onDuplicateClip, onToggleClipLoop, onRequestRemoveClip, onOpenTrackEditor }: TracksWorkspaceProps) {
  const { selection, setSelection, pixelsPerBeat, scrollLeftRef } = viewState
  const newTrackInputRef = useRef<HTMLInputElement>(null)

  /** Each track card owns its own horizontally-scrolling strip (so its
      header can sit above a full-width timeline instead of beside a
      cramped one - see docs/DECISIONS.md DEC-027's addendum for why a
      single shared strip couldn't do that: a header can't opt out of its
      own ancestor's horizontal scroll). All strips are kept at the same
      scrollLeft by hand instead of relying on a single native scroll
      container - registerStrip seeds a newly (re)mounted strip from the
      last known shared position, handleStripScroll fans a scroll on any
      one strip out to every other. scrollLeftRef itself is unchanged from
      before (see useTracksViewState) - still one shared value, still
      restored across a rotation to/from the wide arranger, just now
      written/read by N containers instead of one. */
  const stripsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const primaryStripRef = useRef<HTMLDivElement | null>(null)

  const registerStrip = (trackId: string) => (element: HTMLDivElement | null) => {
    if (element) {
      stripsRef.current.set(trackId, element)
      primaryStripRef.current = element // any live strip works - see beatFromClientX's use in useTrackClipDrag; they all stay at the same scrollLeft by construction
      element.scrollLeft = scrollLeftRef.current
    } else {
      stripsRef.current.delete(trackId)
    }
  }

  const handleStripScroll = (trackId: string) => (event: UIEvent<HTMLDivElement>) => {
    const nextScrollLeft = event.currentTarget.scrollLeft
    scrollLeftRef.current = nextScrollLeft
    stripsRef.current.forEach((element, id) => {
      if (id !== trackId && element.scrollLeft !== nextScrollLeft) element.scrollLeft = nextScrollLeft
    })
  }

  const drag = useTrackClipDrag({
    pixelsPerBeat,
    snapDivision,
    isPlaying,
    scrollContainerRef: primaryStripRef,
    selection,
    onSelectionChange: setSelection,
    onOpenTrackEditor,
    onMoveClip,
    onTrimClipStart,
    onTrimClipEnd,
    onSeekPlayhead,
  })

  const furthestBeat = tracks.reduce((max, track) => track.clips.reduce((trackMax, clip) => Math.max(trackMax, clip.startBeat + clip.lengthBeats), max), 0)
  const totalBeats = Math.max(minimumVisibleBars * barBeats, Math.ceil((furthestBeat + barBeats) / barBeats) * barBeats)
  const timelineWidth = totalBeats * pixelsPerBeat

  const selectedClip = selection ? tracks.find((track) => track.id === selection.trackId)?.clips.find((clip) => clip.id === selection.clipId) : undefined
  const canSplitSelected = Boolean(selectedClip && playheadBeat > selectedClip.startBeat + 0.02 && playheadBeat < selectedClip.startBeat + selectedClip.lengthBeats - 0.02)

  const handleNewTrackFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImportNewTrack(file)
  }

  // Every card draws its own ruler now (one shared ruler above a single
  // strip doesn't work once each track owns its own scroll position) - see
  // registerStrip's docs above.
  const rulerMarks = Array.from({ length: totalBeats / barBeats + 1 }, (_, barIndex) => (
    <span key={barIndex} className="tracks-ruler-mark" style={{ left: barIndex * barBeats * pixelsPerBeat }}>{barIndex + 1}</span>
  ))

  return (
    <section className="tracks-workspace" aria-label="Tracks">
      <div className="tracks-toolbar">
        <label className="tracks-add-track-button">
          + ADD TRACK
          <input ref={newTrackInputRef} type="file" accept="audio/wav,.wav" disabled={!audioReady || tracks.length >= maximumTracks} onChange={handleNewTrackFile} />
        </label>
        <SnapGridSelect value={snapDivision} onChange={onSnapDivisionChange} />
      </div>

      {tracks.length > 0 && (
        <div className="tracks-row-list">
          {tracks.map((track) => {
            const accent = trackAccentColor(track.id)
            const isTrackSelected = selection?.trackId === track.id
            return (
              <div className="tracks-row" key={track.id} style={{ '--tracks-row-accent': accent } as CSSProperties}>
                <div className={isTrackSelected ? 'tracks-row-header tracks-row-selected' : 'tracks-row-header'}>
                  <strong className="tracks-row-name" title={track.name}>{track.name}</strong>
                  <TrackControls
                    track={track}
                    audioReady={audioReady}
                    selectedClip={isTrackSelected ? (selectedClip ?? null) : null}
                    canSplitSelectedClip={isTrackSelected && canSplitSelected}
                    onSetTrackMuted={onSetTrackMuted}
                    onSetTrackSolo={onSetTrackSolo}
                    onMoveTrackOrder={onMoveTrackOrder}
                    onImportClipToTrack={onImportClipToTrack}
                    onRequestRemoveTrack={onRequestRemoveTrack}
                    onSplitClipAtPlayhead={onSplitClipAtPlayhead}
                    onDuplicateClip={onDuplicateClip}
                    onToggleClipLoop={onToggleClipLoop}
                    onRequestRemoveClip={onRequestRemoveClip}
                    onOpenTrackEditor={onOpenTrackEditor}
                  />
                </div>

                <div className="tracks-timeline-scroll" ref={registerStrip(track.id)} onScroll={handleStripScroll(track.id)}>
                  <div className="tracks-timeline-inner" style={{ width: timelineWidth }}>
                    <div className="tracks-ruler" onPointerDown={drag.handleRulerPointerDown}>
                      {rulerMarks}
                    </div>

                    <div className="tracks-track-lane" onPointerDown={(event) => drag.checkDoubleTap(event, track.id)}>
                      {track.clips.map((clip) => {
                        const preview = drag.previewFor(clip)
                        const region = regionFraction(clip)
                        const isSelected = drag.isSelected(clip)
                        return (
                          <div
                            key={clip.id}
                            className={`tracks-clip${isSelected ? ' tracks-clip-selected' : ''}${clip.loop ? ' tracks-clip-loop' : ''}`}
                            style={{ left: Math.max(0, preview.displayStartBeat) * pixelsPerBeat, width: Math.max(0.1, preview.displayLengthBeats) * pixelsPerBeat, '--tracks-clip-accent': accent } as CSSProperties}
                            onPointerDown={(event) => drag.beginDrag(event, 'move', track, clip)}
                            onPointerMove={drag.updateDrag}
                            onPointerUp={drag.commitDrag}
                            onPointerCancel={drag.commitDrag}
                            onLostPointerCapture={drag.cancelDrag}
                          >
                            <TrackClipWaveform peaks={waveforms[clip.assetId] ?? []} regionStart={region.start} regionEnd={region.end} color={accent} />
                            <span className="tracks-clip-label">{clip.fileName}</span>
                            {isSelected && <>
                              <div className="tracks-clip-handle tracks-clip-handle-start" onPointerDown={(event) => drag.beginDrag(event, 'trim-start', track, clip)} onPointerMove={drag.updateDrag} onPointerUp={drag.commitDrag} onPointerCancel={drag.commitDrag} onLostPointerCapture={drag.cancelDrag} />
                              <div className="tracks-clip-handle tracks-clip-handle-end" onPointerDown={(event) => drag.beginDrag(event, 'trim-end', track, clip)} onPointerMove={drag.updateDrag} onPointerUp={drag.commitDrag} onPointerCancel={drag.commitDrag} onLostPointerCapture={drag.cancelDrag} />
                            </>}
                          </div>
                        )
                      })}
                    </div>

                    <div className="tracks-playhead" style={{ left: playheadBeat * pixelsPerBeat }} aria-hidden="true" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
