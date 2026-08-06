import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, UIEvent } from 'react'
import type { SampleAssetId } from '../audio/AudioEngine'
import { SnapGridSelect } from './SnapGridSelect'
import { trackAccentColor } from './trackAccent'
import { TrackClipWaveform } from './TrackClipWaveform'
import { TrackControls } from './TrackControls'
import { trackHeightLevels } from './tracksTypes'
import type { AudioClip, AudioTrack, TimelineGridDivision, TrackHeightLevel } from './tracksTypes'
import { useOutsideDismiss } from './useOutsideDismiss'
import { useTrackClipDrag } from './useTrackClipDrag'
import type { TracksViewState } from './useTracksViewState'
import './tracksWorkspace.css'
import './tracksArranger.css'

const barBeats = 4
const minimumVisibleBars = 16
const zoomStepPixelsPerBeat = 8
const minimumPixelsPerBeat = 10
const maximumPixelsPerBeat = 96

/** Short readouts for the TRACK SIZE group's live value - full level names
    (SMALL/MEDIUM) would not fit next to a pair of narrow +/- buttons in an
    already-tight toolbar. */
const trackHeightLevelLabels: Record<TrackHeightLevel, string> = {
  mini: 'MINI',
  small: 'SMALL',
  medium: 'MED',
  large: 'LARGE',
}

interface TracksArrangerProps {
  tracks: readonly AudioTrack[]
  waveforms: Readonly<Record<SampleAssetId, number[]>>
  audioReady: boolean
  isPlaying: boolean
  playheadBeat: number
  bpm: number
  snapDivision: TimelineGridDivision
  maximumTracks: number
  viewState: TracksViewState
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSnapDivisionChange: (division: TimelineGridDivision) => void
  onSeekPlayhead: (beat: number) => void
  onPlay: () => void
  onStop: () => void
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
  /** A physical rotation is the normal way out, but a locked-orientation
      phone, tablet or desktop needs a manual one too - see docs/DECISIONS.md
      DEC-027's addendum. Returns to whichever tab was active before TRACKS. */
  onExit: () => void
}

function regionFraction(clip: AudioClip): { start: number; end: number } {
  const duration = Math.max(clip.assetDurationSeconds, clip.sourceEndSeconds)
  return duration > 0 ? { start: clip.sourceOffsetSeconds / duration, end: clip.sourceEndSeconds / duration } : { start: 0, end: 1 }
}

function formatBarBeat(beat: number): string {
  const bar = Math.floor(beat / barBeats) + 1
  const beatInBar = Math.floor(beat % barBeats) + 1
  return `${bar}:${beatInBar}`
}

/**
 * TRACKS' wide layout - phone landscape, any tablet orientation, desktop.
 * Mounted by App.tsx as a `position: fixed` sibling of .station-panel, the
 * same escape from the app-wide phone-width cap (--station-app-width,
 * App.css) that TrackEditor already uses, so it fills the real viewport
 * width instead of being squeezed into a 430px column. Shares audioTracks,
 * view state (useTracksViewState) and gesture logic (useTrackClipDrag) with
 * TracksWorkspace - same data, same selection, same zoom, only the
 * arrangement of controls differs. See docs/DECISIONS.md DEC-027.
 */
export function TracksArranger({ tracks, waveforms, audioReady, isPlaying, playheadBeat, bpm, snapDivision, maximumTracks, viewState, canUndo, canRedo, onUndo, onRedo, onSnapDivisionChange, onSeekPlayhead, onPlay, onStop, onImportNewTrack, onImportClipToTrack, onRequestRemoveTrack, onMoveTrackOrder, onSetTrackMuted, onSetTrackSolo, onMoveClip, onTrimClipStart, onTrimClipEnd, onSplitClipAtPlayhead, onDuplicateClip, onToggleClipLoop, onRequestRemoveClip, onOpenTrackEditor, onExit }: TracksArrangerProps) {
  const { selection, setSelection, pixelsPerBeat, setPixelsPerBeat, trackHeightLevel, setTrackHeightLevel, scrollLeftRef } = viewState
  const scrollRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLDivElement>(null)
  const newTrackInputRef = useRef<HTMLInputElement>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)
  useOutsideDismiss(overflowRef, overflowOpen, () => setOverflowOpen(false))

  /** Written synchronously by changeTrackHeightLevel, just before the level
      state changes, and consumed once by the layout effect right after it
      commits - never meant to be read across more than one render, so a
      ref (not state) is correct here: writing it must not itself trigger a
      render. */
  const pendingVerticalRestoreRef = useRef<{ topRowIndex: number; withinRowFraction: number } | null>(null)

  const drag = useTrackClipDrag({
    pixelsPerBeat,
    snapDivision,
    isPlaying,
    scrollContainerRef: scrollRef,
    selection,
    onSelectionChange: setSelection,
    onOpenTrackEditor,
    onMoveClip,
    onTrimClipStart,
    onTrimClipEnd,
    onSeekPlayhead,
  })

  // Restore the shared horizontal scroll position on mount (e.g. arriving
  // here from the compact view after a rotation) - never re-decodes
  // anything, just a scrollLeft write.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollLeftRef.current
  }, [scrollLeftRef])

  /** Keeps the rail's track-name list and the timeline's stacked lanes
      scrolling together - both containers now genuinely scroll vertically
      (see tracksArranger.css's .tracks-arranger-scroll docs for the bug
      this replaces) and both share the same content height (ruler height +
      N rows, thanks to the rail's own ruler-height spacer below), so a
      direct same-value assignment keeps every row aligned with its lane
      regardless of which side the user actually scrolled. The inequality
      guard is what stops this from looping: writing scrollTop fires a
      native scroll event too, but by then the two are already equal, so
      the other handler's own guard is false and it does nothing. Mirrors
      TracksWorkspace.tsx's own handleStripScroll, just vertical and
      between exactly 2 elements instead of N. */
  const handleTimelineScroll = (event: UIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop
    scrollLeftRef.current = event.currentTarget.scrollLeft
    if (railRef.current && railRef.current.scrollTop !== nextScrollTop) railRef.current.scrollTop = nextScrollTop
  }

  const handleRailScroll = (event: UIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop
    if (scrollRef.current && scrollRef.current.scrollTop !== nextScrollTop) scrollRef.current.scrollTop = nextScrollTop
  }

  /** Changes the track-height level while keeping roughly the same rows in
      view. Measures which row is topmost (and how far into it) from
      actually rendered heights right before the level changes, rather than
      trusting a hardcoded copy of the CSS pixel ladder - that stays correct
      even under the @media(max-height:420px) safety net, which can quietly
      cap the "nominal" level height on a short viewport. The layout effect
      below re-applies the equivalent position once the new heights have
      committed. Touches only scrollTop on these two elements - playhead,
      horizontal scroll/zoom, selection and the audio engine are untouched. */
  const changeTrackHeightLevel = (nextLevel: TrackHeightLevel) => {
    const timeline = scrollRef.current
    const ruler = rulerRef.current
    if (timeline && ruler && tracks.length > 0) {
      const rulerHeight = ruler.offsetHeight
      const oldRowHeight = (timeline.scrollHeight - rulerHeight) / tracks.length
      if (oldRowHeight > 0) {
        const raw = Math.max(0, timeline.scrollTop - rulerHeight)
        const topRowIndex = Math.min(tracks.length - 1, Math.floor(raw / oldRowHeight))
        const withinRowFraction = (raw - topRowIndex * oldRowHeight) / oldRowHeight
        pendingVerticalRestoreRef.current = { topRowIndex, withinRowFraction }
      }
    }
    setTrackHeightLevel(nextLevel)
  }

  useLayoutEffect(() => {
    const pending = pendingVerticalRestoreRef.current
    pendingVerticalRestoreRef.current = null
    if (!pending) return
    const timeline = scrollRef.current
    const rail = railRef.current
    const ruler = rulerRef.current
    if (!timeline || !rail || !ruler || tracks.length === 0) return
    const rulerHeight = ruler.offsetHeight
    const newRowHeight = (timeline.scrollHeight - rulerHeight) / tracks.length
    if (newRowHeight <= 0) return
    const target = rulerHeight + (pending.topRowIndex + pending.withinRowFraction) * newRowHeight
    timeline.scrollTop = Math.max(0, Math.min(target, timeline.scrollHeight - timeline.clientHeight))
    rail.scrollTop = Math.max(0, Math.min(target, rail.scrollHeight - rail.clientHeight))
  }, [trackHeightLevel, tracks.length])

  const furthestBeat = tracks.reduce((max, track) => track.clips.reduce((trackMax, clip) => Math.max(trackMax, clip.startBeat + clip.lengthBeats), max), 0)
  const totalBeats = Math.max(minimumVisibleBars * barBeats, Math.ceil((furthestBeat + barBeats) / barBeats) * barBeats)
  const timelineWidth = totalBeats * pixelsPerBeat

  const selectedTrack = selection ? tracks.find((track) => track.id === selection.trackId) : undefined
  const selectedClip = selectedTrack?.clips.find((clip) => clip.id === selection!.clipId)
  const canSplitSelected = Boolean(selectedClip && playheadBeat > selectedClip.startBeat + 0.02 && playheadBeat < selectedClip.startBeat + selectedClip.lengthBeats - 0.02)

  const handleNewTrackFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImportNewTrack(file)
  }
  const zoomBy = (deltaPerBeat: number) => setPixelsPerBeat((current) => Math.min(maximumPixelsPerBeat, Math.max(minimumPixelsPerBeat, current + deltaPerBeat)))

  const trackHeightIndex = trackHeightLevels.indexOf(trackHeightLevel)
  const decreaseTrackHeight = () => changeTrackHeightLevel(trackHeightLevels[Math.max(0, trackHeightIndex - 1)])
  const increaseTrackHeight = () => changeTrackHeightLevel(trackHeightLevels[Math.min(trackHeightLevels.length - 1, trackHeightIndex + 1)])

  return (
    <section className="tracks-arranger" aria-label="Tracks, wide arranger" data-track-height={trackHeightLevel}>
      <div className="tracks-arranger-toolbar" role="toolbar" aria-label="Timeline tools">
        <button type="button" className="mixer-toggle transport-icon-button transport-play-button" aria-label="Play" disabled={!audioReady || isPlaying} onClick={onPlay} />
        <button type="button" className="mixer-toggle transport-icon-button transport-stop-button" aria-label="Stop" disabled={!isPlaying} onClick={onStop} />
        <output className="tracks-arranger-position">{formatBarBeat(playheadBeat)} <span className="tracks-arranger-bpm">{bpm} BPM</span></output>
        <SnapGridSelect value={snapDivision} onChange={onSnapDivisionChange} />
        <div className="tracks-arranger-history" role="group" aria-label="History">
          <button type="button" className="mixer-toggle" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>↺</button>
          <button type="button" className="mixer-toggle" aria-label="Redo" disabled={!canRedo} onClick={onRedo}>↻</button>
        </div>
        <div className="tracks-arranger-track-size" role="group" aria-label="Track height">
          <button type="button" className="mixer-toggle" aria-label="Decrease track height" disabled={trackHeightIndex <= 0} onClick={decreaseTrackHeight}>−</button>
          <output className="tracks-arranger-track-size-value">{trackHeightLevelLabels[trackHeightLevel]}</output>
          <button type="button" className="mixer-toggle" aria-label="Increase track height" disabled={trackHeightIndex >= trackHeightLevels.length - 1} onClick={increaseTrackHeight}>+</button>
        </div>
        <label className="file-picker-button tracks-add-track-button">
          + TRACK
          <input ref={newTrackInputRef} type="file" accept="audio/wav,.wav" disabled={!audioReady || tracks.length >= maximumTracks} onChange={handleNewTrackFile} />
        </label>
        <div className="tracks-arranger-overflow" ref={overflowRef}>
          <button type="button" className="mixer-toggle" aria-label="More timeline tools" aria-haspopup="true" aria-expanded={overflowOpen} onClick={() => setOverflowOpen((current) => !current)}>⋯</button>
          {overflowOpen && (
            <div className="tracks-arranger-overflow-menu">
              <span className="context-label">TIME ZOOM</span>
              <div className="tracks-arranger-zoom" role="group" aria-label="Zoom">
                <button type="button" className="mixer-toggle" aria-label="Zoom out" onClick={() => zoomBy(-zoomStepPixelsPerBeat)}>−</button>
                <button type="button" className="mixer-toggle" aria-label="Zoom in" onClick={() => zoomBy(zoomStepPixelsPerBeat)}>+</button>
              </div>
            </div>
          )}
        </div>
        <button type="button" className="mixer-toggle tracks-arranger-exit" aria-label="Back to Station" onClick={onExit}>✕ STATION</button>
      </div>

      {selection && selectedClip && (
        <div className="tracks-clip-actions" role="toolbar" aria-label="Selected clip">
          <span className="tracks-clip-actions-label">{selectedTrack?.name}</span>
          <button type="button" className="mixer-toggle" disabled={!canSplitSelected} onClick={() => onSplitClipAtPlayhead(selection.trackId, selection.clipId)}>SPLIT AT PLAYHEAD</button>
          <button type="button" className="mixer-toggle" onClick={() => onDuplicateClip(selection.trackId, selection.clipId)}>DUPLICATE</button>
          <button type="button" className={selectedClip.loop ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={selectedClip.loop} onClick={() => onToggleClipLoop(selection.trackId, selection.clipId)}>LOOP</button>
          <button type="button" className="mixer-toggle compact-danger" onClick={() => onRequestRemoveClip(selection.trackId, selection.clipId)}>DELETE</button>
          <button type="button" className="mixer-toggle" onClick={() => setSelection(null)}>CLOSE</button>
        </div>
      )}

      {tracks.length === 0 ? (
        <div className="chop-empty-state">
          <p className="sample-editor-empty">No tracks yet - import a WAV to create the first one.</p>
        </div>
      ) : (
        <div className="tracks-arranger-body">
          <div className="tracks-arranger-rail" ref={railRef} onScroll={handleRailScroll}>
            {/* Pixel-identical spacer to the real ruler below (same class),
                so the rail's content height (ruler + N rows) matches the
                timeline pane's exactly at every track-height level - without
                it, row i's name would never align with row i's lane (off by
                the ruler's own height). aria-hidden since it carries no
                track-list semantics of its own. */}
            <div className="tracks-ruler" aria-hidden="true" />
            {tracks.map((track) => (
              <div className="tracks-arranger-rail-row" key={track.id} style={{ '--tracks-row-accent': trackAccentColor(track.id) } as CSSProperties}>
                <button type="button" className="tracks-arranger-rail-name" title={track.name} onClick={() => onOpenTrackEditor(track.id)}>
                  {track.name}
                </button>
                <TrackControls track={track} audioReady={audioReady} onSetTrackMuted={onSetTrackMuted} onSetTrackSolo={onSetTrackSolo} onMoveTrackOrder={onMoveTrackOrder} onImportClipToTrack={onImportClipToTrack} onRequestRemoveTrack={onRequestRemoveTrack} />
              </div>
            ))}
          </div>

          <div className="tracks-timeline-scroll tracks-arranger-scroll" ref={scrollRef} onScroll={handleTimelineScroll}>
            <div className="tracks-timeline-inner" style={{ width: timelineWidth }}>
              <div className="tracks-ruler" ref={rulerRef} onPointerDown={drag.handleRulerPointerDown}>
                {Array.from({ length: totalBeats / barBeats + 1 }, (_, barIndex) => (
                  <span key={barIndex} className="tracks-ruler-mark" style={{ left: barIndex * barBeats * pixelsPerBeat }}>{barIndex + 1}</span>
                ))}
              </div>

              {tracks.map((track) => {
                const accent = trackAccentColor(track.id)
                return (
                  <div className="tracks-track-lane tracks-arranger-lane" key={track.id} onPointerDown={(event) => drag.checkDoubleTap(event, track.id)}>
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
                )
              })}

              <div className="tracks-playhead" style={{ left: playheadBeat * pixelsPerBeat }} aria-hidden="true" />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
