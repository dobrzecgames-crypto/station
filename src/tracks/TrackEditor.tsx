import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { SampleAssetId } from '../audio/AudioEngine'
import { useDragSlider } from '../shell/useDragSlider'
import { maximumClipFadeSeconds } from './tracksOperations'
import { snapBeatToGrid } from './timelineGrid'
import { trackAccentColor } from './trackAccent'
import { TrackClipWaveform } from './TrackClipWaveform'
import { timelineGridDivisions } from './tracksTypes'
import type { AudioClip, AudioTrack, TimelineGridDivision } from './tracksTypes'
// Reuses .tracks-clip-handle/.tracks-clip-selected/.tracks-clip-label/
// .tracks-playhead/.tracks-ruler-mark/.tracks-snap-control/.tracks-clip/
// .tracks-timeline-scroll/.tracks-timeline-inner/.tracks-ruler/
// .tracks-track-lane/.tracks-clip-actions - global classes, imported
// explicitly here too so this component does not depend on TracksWorkspace
// having mounted first for its own styling. The TIMELINE sub-view below
// reuses these directly rather than DETAIL's own bigger .track-editor-clip
// styling, since it is deliberately the same compact look as the main
// TRACKS view, not a second precision surface.
import './tracksWorkspace.css'
import './trackEditor.css'

const minimumPixelsPerBeat = 8
const maximumPixelsPerBeat = 320
const defaultPixelsPerBeat = 48
const barBeats = 4
const dragThresholdPixels = 6
const minimumVisibleBars = 8
const doubleTapThresholdMs = 350

/** TIMELINE sub-view's own zoom bounds - an arrangement overview like
    TracksArranger's, not a precision surface like DETAIL, so it shares
    TracksArranger's more modest range rather than DETAIL's 8-320. */
const defaultTimelinePixelsPerBeat = 24
const minimumTimelinePixelsPerBeat = 10
const maximumTimelinePixelsPerBeat = 96
const timelineZoomStepPixelsPerBeat = 8

type EditorViewMode = 'detail' | 'timeline'

export type TrackMonitorMode = 'all' | 'solo' | 'mute'

interface TrackEditorProps {
  track: AudioTrack
  waveforms: Readonly<Record<SampleAssetId, number[]>>
  bpm: number
  isPlaying: boolean
  playheadBeat: number
  snapDivision: TimelineGridDivision
  onSnapDivisionChange: (division: TimelineGridDivision) => void
  monitorMode: TrackMonitorMode
  onMonitorModeChange: (mode: TrackMonitorMode) => void
  onMoveClip: (clipId: string, startBeat: number) => void
  onTrimClipStart: (clipId: string, startBeat: number) => void
  onTrimClipEnd: (clipId: string, endBeat: number) => void
  onSplitClipAtPlayhead: (clipId: string) => void
  onDuplicateClip: (clipId: string) => void
  onRequestRemoveClip: (clipId: string) => void
  onToggleClipLoop: (clipId: string) => void
  onSetClipGain: (clipId: string, gain: number) => void
  onSetClipFadeIn: (clipId: string, seconds: number) => void
  onSetClipFadeOut: (clipId: string, seconds: number) => void
  onSetClipPitch: (clipId: string, semitones: number) => void
  onToggleClipReversed: (clipId: string) => void
  onSeekPlayhead: (beat: number) => void
  onClose: () => void
}

type DragKind = 'move' | 'trim-start' | 'trim-end'
interface DragState { kind: DragKind; clipId: string; pointerId: number; startClientX: number; originClip: AudioClip; previewDeltaBeats: number; snapped: boolean }
interface PinchState { distance: number; pixelsPerBeat: number; anchorClientX: number; anchorScrollLeft: number }

function regionFraction(clip: AudioClip): { start: number; end: number } {
  const duration = Math.max(clip.assetDurationSeconds, clip.sourceEndSeconds)
  return duration > 0 ? { start: clip.sourceOffsetSeconds / duration, end: clip.sourceEndSeconds / duration } : { start: 0, end: 1 }
}

/**
 * The fullscreen single-track editor - a separate working context for one
 * track, not a zoomed-in TracksWorkspace: only this track's clips are shown,
 * large, with pinch-to-zoom and precise handles. Operates on the exact same
 * AudioTrack/AudioClip passed in from App.tsx's audioTracks state - no copy,
 * no separate editing buffer, so a change here is already the project's
 * data the instant its handler runs. See docs/DECISIONS.md DEC-027.
 *
 * Rendered by App.tsx as a fixed, full-viewport sibling of .station-panel
 * while TracksWorkspace stays mounted underneath - closing this never
 * touches TracksWorkspace's own scroll/selection state, which is how "return
 * to exactly where you left off" is satisfied without saving and restoring
 * it by hand.
 */
export function TrackEditor({ track, waveforms, bpm, isPlaying, playheadBeat, snapDivision, onSnapDivisionChange, monitorMode, onMonitorModeChange, onMoveClip, onTrimClipStart, onTrimClipEnd, onSplitClipAtPlayhead, onDuplicateClip, onRequestRemoveClip, onToggleClipLoop, onSetClipGain, onSetClipFadeIn, onSetClipFadeOut, onSetClipPitch, onToggleClipReversed, onSeekPlayhead, onClose }: TrackEditorProps) {
  const [viewMode, setViewMode] = useState<EditorViewMode>('detail')
  const [pixelsPerBeat, setPixelsPerBeat] = useState(defaultPixelsPerBeat)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(track.clips[0]?.id ?? null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activePointersRef = useRef(new Map<number, number>())
  const pinchStartRef = useRef<PinchState | null>(null)
  const panLastXRef = useRef<number | null>(null)
  /** Always-current mirror of `drag`, assigned fresh every render - the same
      shape App.tsx's audioTracksRef uses and for the same reason (see its
      docs): commitClipDrag needs drag's value at commit time but must not
      read it from inside a setDrag(current => ...) functional updater,
      since a functional updater has to stay pure and this one used to call
      onMoveClip/onTrimClipStart/onTrimClipEnd - a different component's
      (App's) state update - from inside it. React 18 StrictMode
      double-invokes updater functions in development to catch exactly this
      kind of impurity; the second, throwaway invocation still ran the real
      onMoveClip/onTrimClip* call, which React then rejected with "Cannot
      update a component while rendering a different component" and
      silently dropped - so a clip drag/trim in DETAIL never actually
      committed anything in dev mode. Reading the ref instead and calling
      those callbacks in the handler body, after a plain (non-functional)
      setDrag, sidesteps double-invocation entirely - a plain value passed
      to setState is never re-invoked to check purity, only a function is. */
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  /** TIMELINE sub-view's own zoom/scroll/drag - deliberately separate state
      from DETAIL's above, not a shared "current view" abstraction: the two
      are mutually exclusive surfaces with different gesture models (native
      pan-x scroll here vs. DETAIL's custom pinch/pan), and the brief is
      explicit that each view keeps its own zoom and scroll rather than one
      reset by the other. selectedClipId is the one piece of state both
      branches below actually share - see the two scroll-into-view effects
      further down. */
  const [timelinePixelsPerBeat, setTimelinePixelsPerBeat] = useState(defaultTimelinePixelsPerBeat)
  const [timelineDrag, setTimelineDrag] = useState<DragState | null>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const lastTimelineClipTapRef = useRef<{ clipId: string; time: number } | null>(null)
  /** Mirrors timelineDrag - see dragRef's docs just above; same fix, same
      reason, applied to TIMELINE's own drag state. */
  const timelineDragRef = useRef<DragState | null>(null)
  timelineDragRef.current = timelineDrag

  /** Raw scrollLeft for each view, surviving the view's own DOM node being
      unmounted and remounted - DETAIL's and TIMELINE's scroll strips live
      inside one `viewMode === 'detail' ? … : …` branch each (below), so
      switching views actually destroys and recreates whichever one you're
      leaving, and a fresh DOM node's native scrollLeft is always 0. These
      two refs are what "zachowaj pozycję czasu" (preserve the viewport's
      time position across a switch) actually rests on: registerDetailScroll/
      registerTimelineScroll write the last-known position back the instant
      the node reappears, in the same commit, before the browser paints a
      frame - the scroll-into-view effect below only has to correct for a
      selection that changed while its view was away, not reposition it
      from scratch every time. */
  const detailScrollLeftRef = useRef(0)
  const timelineScrollLeftRef = useRef(0)
  const registerDetailScroll = (element: HTMLDivElement | null) => {
    scrollRef.current = element
    if (element) element.scrollLeft = detailScrollLeftRef.current
  }
  const registerTimelineScroll = (element: HTMLDivElement | null) => {
    timelineScrollRef.current = element
    if (element) element.scrollLeft = timelineScrollLeftRef.current
  }

  const selectedClip = track.clips.find((clip) => clip.id === selectedClipId)
  // Hooks can't be called conditionally, but the four param sliders below only
  // render once a clip is selected - so each drag falls back to a harmless 0/
  // no-op when there is none, same shape as any other hook reading state that
  // might not exist yet.
  const gainDrag = useDragSlider({
    value: selectedClip?.gain ?? 0,
    min: 0,
    max: 1,
    step: 0.01,
    onChange: (value) => { if (selectedClip) onSetClipGain(selectedClip.id, value) },
    focusLabel: 'GAIN',
    formatValue: (value) => `${Math.round(value * 100)}%`,
  })
  const fadeInDrag = useDragSlider({
    value: selectedClip?.fadeInSeconds ?? 0,
    min: 0,
    max: maximumClipFadeSeconds,
    step: 0.05,
    onChange: (value) => { if (selectedClip) onSetClipFadeIn(selectedClip.id, value) },
    focusLabel: 'FADE IN',
    formatValue: (value) => `${value.toFixed(2)} s`,
  })
  const fadeOutDrag = useDragSlider({
    value: selectedClip?.fadeOutSeconds ?? 0,
    min: 0,
    max: maximumClipFadeSeconds,
    step: 0.05,
    onChange: (value) => { if (selectedClip) onSetClipFadeOut(selectedClip.id, value) },
    focusLabel: 'FADE OUT',
    formatValue: (value) => `${value.toFixed(2)} s`,
  })
  const pitchDrag = useDragSlider({
    value: selectedClip?.pitchSemitones ?? 0,
    min: -24,
    max: 24,
    step: 1,
    onChange: (value) => { if (selectedClip) onSetClipPitch(selectedClip.id, value) },
    focusLabel: 'PITCH',
    formatValue: (value) => `${value > 0 ? '+' : ''}${value} st`,
  })
  const canSplitSelected = Boolean(selectedClip && playheadBeat > selectedClip.startBeat + 0.02 && playheadBeat < selectedClip.startBeat + selectedClip.lengthBeats - 0.02)
  const furthestBeat = track.clips.reduce((max, clip) => Math.max(max, clip.startBeat + clip.lengthBeats), 0)
  const totalBeats = Math.max(minimumVisibleBars * barBeats, Math.ceil((furthestBeat + barBeats) / barBeats) * barBeats)
  const timelineWidth = totalBeats * pixelsPerBeat
  const timelineLaneWidth = totalBeats * timelinePixelsPerBeat
  const trackAccent = trackAccentColor(track.id)

  const beatFromClientX = (clientX: number): number => {
    const container = scrollRef.current
    if (!container) return 0
    const rect = container.getBoundingClientRect()
    return Math.max(0, (clientX - rect.left + container.scrollLeft) / pixelsPerBeat)
  }

  const timelineBeatFromClientX = (clientX: number): number => {
    const container = timelineScrollRef.current
    if (!container) return 0
    const rect = container.getBoundingClientRect()
    return Math.max(0, (clientX - rect.left + container.scrollLeft) / timelinePixelsPerBeat)
  }

  /** Entry point for both the TIMELINE clip list's double-tap and its
      explicit EDIT button - keeps the already-selected clip selected
      (DETAIL reads the same selectedClipId) and scrolls DETAIL's viewport
      to it once mounted, via the effect below. Never touches transport,
      playhead, undo or the audio engine - this is a UI-only mode switch. */
  const switchToDetailForClip = (clipId: string) => {
    setSelectedClipId(clipId)
    setViewMode('detail')
  }

  const checkTimelineDoubleTap = (event: ReactPointerEvent<HTMLDivElement>, clipId: string): boolean => {
    const now = event.timeStamp
    const last = lastTimelineClipTapRef.current
    if (last && last.clipId === clipId && now - last.time < doubleTapThresholdMs) {
      lastTimelineClipTapRef.current = null
      switchToDetailForClip(clipId)
      return true
    }
    lastTimelineClipTapRef.current = { clipId, time: now }
    return false
  }

  const beginTimelineClipDrag = (event: ReactPointerEvent<HTMLDivElement>, kind: DragKind, clip: AudioClip) => {
    event.stopPropagation()
    if (kind === 'move' && checkTimelineDoubleTap(event, clip.id)) return
    setSelectedClipId(clip.id)
    setTimelineDrag({ kind, clipId: clip.id, pointerId: event.pointerId, startClientX: event.clientX, originClip: clip, previewDeltaBeats: 0, snapped: snapDivision !== 'off' })
  }
  const updateTimelineClipDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const pointerId = event.pointerId
    const clientX = event.clientX
    const current = timelineDragRef.current
    if (!current || current.pointerId !== pointerId) return
    const deltaPixels = clientX - current.startClientX
    if (Math.abs(deltaPixels) >= dragThresholdPixels && !target.hasPointerCapture(pointerId)) {
      try { target.setPointerCapture(pointerId) } catch { /* the pointer session may already have ended */ }
    }
    setTimelineDrag({ ...current, previewDeltaBeats: deltaPixels / timelinePixelsPerBeat })
  }
  const commitTimelineClipDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = timelineDragRef.current
    setTimelineDrag(null)
    if (!current || current.pointerId !== event.pointerId) return
    if (Math.abs(current.previewDeltaBeats) * timelinePixelsPerBeat >= dragThresholdPixels) {
      const division = current.snapped ? snapDivision : 'off'
      if (current.kind === 'move') onMoveClip(current.clipId, snapBeatToGrid(current.originClip.startBeat + current.previewDeltaBeats, division))
      else if (current.kind === 'trim-start') onTrimClipStart(current.clipId, snapBeatToGrid(current.originClip.startBeat + current.previewDeltaBeats, division))
      else onTrimClipEnd(current.clipId, snapBeatToGrid(current.originClip.startBeat + current.originClip.lengthBeats + current.previewDeltaBeats, division))
    }
  }
  const handleTimelineRulerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isPlaying) return
    onSeekPlayhead(snapBeatToGrid(timelineBeatFromClientX(event.clientX), snapDivision))
  }
  const zoomTimeline = (deltaPerBeat: number) => setTimelinePixelsPerBeat((current) => Math.min(maximumTimelinePixelsPerBeat, Math.max(minimumTimelinePixelsPerBeat, current + deltaPerBeat)))

  /** Nudges the selected clip into view whenever a view becomes active -
      "switch to DETAIL keeps the viewport on the selected clip", "switch
      back to TIMELINE shows the selected clip" from the brief - but only
      as a fallback on top of registerDetailScroll/registerTimelineScroll's
      raw-position restore just above, which is what actually satisfies
      "zachowaj pozycję czasu" (preserve the viewport's time position) for
      the common case. Deliberately keyed on viewMode alone, not on
      selectedClipId or either zoom level: re-running this for every clip
      tap *within* an already-active view would fight the user's own
      scrolling, and a zoom change is never supposed to move the viewport on
      its own either. Checks for *any* overlap with the viewport, not full
      containment - a clip wider than the viewport (the common case at
      TIMELINE's overview zoom) can never be "fully" visible at all, so a
      fully-contained check would treat it as out of view and force a
      rescroll on every single switch, fighting the restore above instead
      of only backstopping it. */
  useEffect(() => {
    const clip = selectedClipId ? track.clips.find((candidate) => candidate.id === selectedClipId) : undefined
    if (!clip) return
    const container = viewMode === 'detail' ? scrollRef.current : timelineScrollRef.current
    const pxPerBeat = viewMode === 'detail' ? pixelsPerBeat : timelinePixelsPerBeat
    if (!container) return
    const clipLeft = clip.startBeat * pxPerBeat
    const clipRight = (clip.startBeat + clip.lengthBeats) * pxPerBeat
    const viewLeft = container.scrollLeft
    const viewRight = viewLeft + container.clientWidth
    const noOverlap = clipRight < viewLeft || clipLeft > viewRight
    if (noOverlap) container.scrollLeft = Math.max(0, clipLeft - 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  const beginClipDrag = (event: ReactPointerEvent<HTMLDivElement>, kind: DragKind, clip: AudioClip) => {
    event.stopPropagation()
    setSelectedClipId(clip.id)
    setDrag({ kind, clipId: clip.id, pointerId: event.pointerId, startClientX: event.clientX, originClip: clip, previewDeltaBeats: 0, snapped: snapDivision !== 'off' })
  }
  const updateClipDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    // See TracksWorkspace's updateDrag for why these are captured before
    // reading further: event.currentTarget is only valid synchronously.
    // Reads dragRef instead of using setDrag's functional-updater form - see
    // dragRef's docs above for why that form is unsafe here specifically.
    const target = event.currentTarget
    const pointerId = event.pointerId
    const clientX = event.clientX
    const current = dragRef.current
    if (!current || current.pointerId !== pointerId) return
    const deltaPixels = clientX - current.startClientX
    if (Math.abs(deltaPixels) >= dragThresholdPixels && !target.hasPointerCapture(pointerId)) {
      try { target.setPointerCapture(pointerId) } catch { /* the pointer session may already have ended */ }
    }
    setDrag({ ...current, previewDeltaBeats: deltaPixels / pixelsPerBeat })
  }
  const commitClipDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = dragRef.current
    setDrag(null)
    if (!current || current.pointerId !== event.pointerId) return
    if (Math.abs(current.previewDeltaBeats) * pixelsPerBeat >= dragThresholdPixels) {
      const division = current.snapped ? snapDivision : 'off'
      if (current.kind === 'move') onMoveClip(current.clipId, snapBeatToGrid(current.originClip.startBeat + current.previewDeltaBeats, division))
      else if (current.kind === 'trim-start') onTrimClipStart(current.clipId, snapBeatToGrid(current.originClip.startBeat + current.previewDeltaBeats, division))
      else onTrimClipEnd(current.clipId, snapBeatToGrid(current.originClip.startBeat + current.originClip.lengthBeats + current.previewDeltaBeats, division))
    }
  }

  /** The lane background (not a clip) handles single-finger pan and
      two-finger pinch-zoom itself - it runs with touch-action:none (see
      trackEditor.css) so the browser never intercepts either gesture, unlike
      TracksWorkspace's compact view which leans on native pan-x instead. */
  const handleLanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(event.pointerId, event.clientX)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (activePointersRef.current.size === 2) {
      const [xa, xb] = [...activePointersRef.current.values()]
      pinchStartRef.current = { distance: Math.max(1, Math.abs(xa - xb)), pixelsPerBeat, anchorClientX: (xa + xb) / 2, anchorScrollLeft: scrollRef.current?.scrollLeft ?? 0 }
      panLastXRef.current = null
    } else if (activePointersRef.current.size === 1) {
      panLastXRef.current = event.clientX
    }
  }
  const handleLanePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return
    activePointersRef.current.set(event.pointerId, event.clientX)
    const container = scrollRef.current
    if (activePointersRef.current.size >= 2 && pinchStartRef.current && container) {
      const [xa, xb] = [...activePointersRef.current.values()]
      const distance = Math.max(1, Math.abs(xa - xb))
      const nextPixelsPerBeat = Math.min(maximumPixelsPerBeat, Math.max(minimumPixelsPerBeat, pinchStartRef.current.pixelsPerBeat * (distance / pinchStartRef.current.distance)))
      const rect = container.getBoundingClientRect()
      const anchorBeat = (pinchStartRef.current.anchorClientX - rect.left + pinchStartRef.current.anchorScrollLeft) / pinchStartRef.current.pixelsPerBeat
      setPixelsPerBeat(nextPixelsPerBeat)
      container.scrollLeft = Math.max(0, anchorBeat * nextPixelsPerBeat - (pinchStartRef.current.anchorClientX - rect.left))
    } else if (activePointersRef.current.size === 1 && panLastXRef.current !== null && container) {
      container.scrollLeft = Math.max(0, container.scrollLeft - (event.clientX - panLastXRef.current))
      panLastXRef.current = event.clientX
    }
  }
  const endLanePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId)
    if (activePointersRef.current.size < 2) pinchStartRef.current = null
    if (activePointersRef.current.size === 0) panLastXRef.current = null
  }
  const handleLaneTap = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A pinch/pan already moved a pointer past the threshold - do not also
    // seek. Only a clean, single, near-stationary tap seeks the playhead.
    if (activePointersRef.current.size > 0 || isPlaying) return
    onSeekPlayhead(snapBeatToGrid(beatFromClientX(event.clientX), snapDivision))
  }

  const region = selectedClip ? regionFraction(selectedClip) : null

  return (
    <section className="track-editor" aria-label={`${track.name} editor`}>
      <header className="track-editor-header">
        <button type="button" className="mixer-toggle" onClick={onClose}>← TRACKS</button>
        <strong className="track-editor-title">{track.name}</strong>
        <button type="button" className="transport-button track-editor-done" onClick={onClose}>DONE</button>
      </header>

      <div className="track-editor-view-switch" role="group" aria-label="Editor view">
        <button type="button" className={viewMode === 'detail' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={viewMode === 'detail'} onClick={() => setViewMode('detail')}>DETAIL</button>
        <button type="button" className={viewMode === 'timeline' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={viewMode === 'timeline'} onClick={() => setViewMode('timeline')}>TIMELINE</button>
      </div>

      <div className="track-editor-monitor" role="group" aria-label="Monitoring">
        {(['all', 'solo', 'mute'] as const).map((mode) => (
          <button key={mode} type="button" className={monitorMode === mode ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={monitorMode === mode} onClick={() => onMonitorModeChange(mode)}>
            {mode === 'all' ? 'ALL' : mode === 'solo' ? 'SOLO' : 'MUTE TRACK'}
          </button>
        ))}
        <div className="tracks-snap-control" role="group" aria-label="Snap grid">
          <span className="context-label">SNAP</span>
          {timelineGridDivisions.map((division) => (
            <button key={division} type="button" className={snapDivision === division ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={snapDivision === division} onClick={() => onSnapDivisionChange(division)}>
              {division === 'off' ? 'OFF' : division === '1' ? '1 BAR' : division}
            </button>
          ))}
        </div>
        {viewMode === 'timeline' && (
          <div className="track-editor-timeline-zoom" role="group" aria-label="Timeline zoom">
            <button type="button" className="mixer-toggle" aria-label="Zoom out" onClick={() => zoomTimeline(-timelineZoomStepPixelsPerBeat)}>−</button>
            <button type="button" className="mixer-toggle" aria-label="Zoom in" onClick={() => zoomTimeline(timelineZoomStepPixelsPerBeat)}>+</button>
          </div>
        )}
      </div>

      {viewMode === 'detail' ? (
      <div className="track-editor-scroll" ref={registerDetailScroll} onScroll={(event) => { detailScrollLeftRef.current = event.currentTarget.scrollLeft }}>
        <div
          className="track-editor-lane"
          style={{ width: timelineWidth }}
          onPointerDown={(event) => { handleLanePointerDown(event); handleLaneTap(event) }}
          onPointerMove={handleLanePointerMove}
          onPointerUp={endLanePointer}
          onPointerCancel={endLanePointer}
        >
          <div className="track-editor-ruler">
            {Array.from({ length: totalBeats / barBeats + 1 }, (_, barIndex) => (
              <span key={barIndex} className="tracks-ruler-mark" style={{ left: barIndex * barBeats * pixelsPerBeat }}>{barIndex + 1}</span>
            ))}
          </div>
          {track.clips.map((clip) => {
            const isDragging = drag?.clipId === clip.id
            const previewLength = isDragging && drag.kind === 'trim-start' ? clip.lengthBeats - drag.previewDeltaBeats : isDragging && drag.kind === 'trim-end' ? clip.lengthBeats + drag.previewDeltaBeats : clip.lengthBeats
            const displayStart = isDragging && drag.kind !== 'trim-end' ? clip.startBeat + drag.previewDeltaBeats : clip.startBeat
            const clipRegion = regionFraction(clip)
            const isSelected = selectedClipId === clip.id
            return (
              <div
                key={clip.id}
                className={`track-editor-clip${isSelected ? ' tracks-clip-selected' : ''}`}
                style={{ left: Math.max(0, displayStart) * pixelsPerBeat, width: Math.max(0.1, previewLength) * pixelsPerBeat }}
                onPointerDown={(event) => beginClipDrag(event, 'move', clip)}
                onPointerMove={updateClipDrag}
                onPointerUp={commitClipDrag}
                onPointerCancel={commitClipDrag}
                onLostPointerCapture={() => setDrag(null)}
              >
                <TrackClipWaveform peaks={waveforms[clip.assetId] ?? []} regionStart={clipRegion.start} regionEnd={clipRegion.end} />
                <span className="tracks-clip-label">{clip.fileName}</span>
                <div className="tracks-clip-handle tracks-clip-handle-start track-editor-handle" onPointerDown={(event) => beginClipDrag(event, 'trim-start', clip)} onPointerMove={updateClipDrag} onPointerUp={commitClipDrag} onPointerCancel={commitClipDrag} onLostPointerCapture={() => setDrag(null)} />
                <div className="tracks-clip-handle tracks-clip-handle-end track-editor-handle" onPointerDown={(event) => beginClipDrag(event, 'trim-end', clip)} onPointerMove={updateClipDrag} onPointerUp={commitClipDrag} onPointerCancel={commitClipDrag} onLostPointerCapture={() => setDrag(null)} />
              </div>
            )
          })}
          <div className="tracks-playhead" style={{ left: playheadBeat * pixelsPerBeat }} aria-hidden="true" />
        </div>
      </div>
      ) : (
      <div className="track-editor-timeline">
        <div className="tracks-timeline-scroll" ref={registerTimelineScroll} onScroll={(event) => { timelineScrollLeftRef.current = event.currentTarget.scrollLeft }}>
          <div className="tracks-timeline-inner" style={{ width: timelineLaneWidth }}>
            <div className="tracks-ruler" onPointerDown={handleTimelineRulerPointerDown}>
              {Array.from({ length: totalBeats / barBeats + 1 }, (_, barIndex) => (
                <span key={barIndex} className="tracks-ruler-mark" style={{ left: barIndex * barBeats * timelinePixelsPerBeat }}>{barIndex + 1}</span>
              ))}
            </div>
            <div className="tracks-track-lane">
              {track.clips.map((clip) => {
                const isDragging = timelineDrag?.clipId === clip.id
                const previewLength = isDragging && timelineDrag.kind === 'trim-start' ? clip.lengthBeats - timelineDrag.previewDeltaBeats : isDragging && timelineDrag.kind === 'trim-end' ? clip.lengthBeats + timelineDrag.previewDeltaBeats : clip.lengthBeats
                const displayStart = isDragging && timelineDrag.kind !== 'trim-end' ? clip.startBeat + timelineDrag.previewDeltaBeats : clip.startBeat
                const clipRegion = regionFraction(clip)
                const isSelected = selectedClipId === clip.id
                return (
                  <div
                    key={clip.id}
                    className={`tracks-clip${isSelected ? ' tracks-clip-selected' : ''}${clip.loop ? ' tracks-clip-loop' : ''}`}
                    style={{ left: Math.max(0, displayStart) * timelinePixelsPerBeat, width: Math.max(0.1, previewLength) * timelinePixelsPerBeat, '--tracks-clip-accent': trackAccent } as CSSProperties}
                    onPointerDown={(event) => beginTimelineClipDrag(event, 'move', clip)}
                    onPointerMove={updateTimelineClipDrag}
                    onPointerUp={commitTimelineClipDrag}
                    onPointerCancel={commitTimelineClipDrag}
                    onLostPointerCapture={() => setTimelineDrag(null)}
                  >
                    <TrackClipWaveform peaks={waveforms[clip.assetId] ?? []} regionStart={clipRegion.start} regionEnd={clipRegion.end} color={trackAccent} />
                    <span className="tracks-clip-label">{clip.fileName}</span>
                    {isSelected && <>
                      <div className="tracks-clip-handle tracks-clip-handle-start" onPointerDown={(event) => beginTimelineClipDrag(event, 'trim-start', clip)} onPointerMove={updateTimelineClipDrag} onPointerUp={commitTimelineClipDrag} onPointerCancel={commitTimelineClipDrag} onLostPointerCapture={() => setTimelineDrag(null)} />
                      <div className="tracks-clip-handle tracks-clip-handle-end" onPointerDown={(event) => beginTimelineClipDrag(event, 'trim-end', clip)} onPointerMove={updateTimelineClipDrag} onPointerUp={commitTimelineClipDrag} onPointerCancel={commitTimelineClipDrag} onLostPointerCapture={() => setTimelineDrag(null)} />
                    </>}
                  </div>
                )
              })}
            </div>
            <div className="tracks-playhead" style={{ left: playheadBeat * timelinePixelsPerBeat }} aria-hidden="true" />
          </div>
        </div>
      </div>
      )}

      {viewMode === 'detail' ? (selectedClip && region ? (
        <div className="track-editor-params">
          <div className="track-editor-params-actions">
            <button type="button" className="mixer-toggle" disabled={!canSplitSelected} onClick={() => onSplitClipAtPlayhead(selectedClip.id)}>CUT AT PLAYHEAD</button>
            <button type="button" className="mixer-toggle" onClick={() => onDuplicateClip(selectedClip.id)}>DUPLICATE</button>
            <button type="button" className={selectedClip.loop ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={selectedClip.loop} onClick={() => onToggleClipLoop(selectedClip.id)}>LOOP</button>
            <button type="button" className={selectedClip.reversed ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={selectedClip.reversed} onClick={() => onToggleClipReversed(selectedClip.id)}>REVERSE</button>
            <button type="button" className="mixer-toggle compact-danger" onClick={() => onRequestRemoveClip(selectedClip.id)}>DELETE</button>
          </div>
          <label className="track-editor-param" htmlFor="track-editor-gain">
            <span>GAIN</span>
            <output htmlFor="track-editor-gain">{Math.round(selectedClip.gain * 100)}%</output>
            <input id="track-editor-gain" type="range" min="0" max="1" step="0.01" value={selectedClip.gain} onChange={(event) => onSetClipGain(selectedClip.id, Number(event.target.value))} onPointerDown={gainDrag.onPointerDown} />
          </label>
          <label className="track-editor-param" htmlFor="track-editor-fade-in">
            <span>FADE IN</span>
            <output htmlFor="track-editor-fade-in">{selectedClip.fadeInSeconds.toFixed(2)} s</output>
            <input id="track-editor-fade-in" type="range" min="0" max={maximumClipFadeSeconds} step="0.05" value={selectedClip.fadeInSeconds} onChange={(event) => onSetClipFadeIn(selectedClip.id, Number(event.target.value))} onPointerDown={fadeInDrag.onPointerDown} />
          </label>
          <label className="track-editor-param" htmlFor="track-editor-fade-out">
            <span>FADE OUT</span>
            <output htmlFor="track-editor-fade-out">{selectedClip.fadeOutSeconds.toFixed(2)} s</output>
            <input id="track-editor-fade-out" type="range" min="0" max={maximumClipFadeSeconds} step="0.05" value={selectedClip.fadeOutSeconds} onChange={(event) => onSetClipFadeOut(selectedClip.id, Number(event.target.value))} onPointerDown={fadeOutDrag.onPointerDown} />
          </label>
          <label className="track-editor-param" htmlFor="track-editor-pitch">
            <span>PITCH</span>
            <output htmlFor="track-editor-pitch">{selectedClip.pitchSemitones > 0 ? '+' : ''}{selectedClip.pitchSemitones} st</output>
            <input id="track-editor-pitch" type="range" min="-24" max="24" step="1" value={selectedClip.pitchSemitones} onChange={(event) => onSetClipPitch(selectedClip.id, Number(event.target.value))} onPointerDown={pitchDrag.onPointerDown} />
          </label>
        </div>
      ) : (
        <p className="track-editor-empty-hint">Tap a clip to edit it. Bpm {bpm} · {track.clips.length} clip{track.clips.length === 1 ? '' : 's'}.</p>
      )) : (selectedClip ? (
        <div className="tracks-clip-actions" role="toolbar" aria-label="Selected clip">
          <span className="tracks-clip-actions-label">{selectedClip.fileName}</span>
          <button type="button" className="mixer-toggle" disabled={!canSplitSelected} onClick={() => onSplitClipAtPlayhead(selectedClip.id)}>CUT AT PLAYHEAD</button>
          <button type="button" className="mixer-toggle" onClick={() => onDuplicateClip(selectedClip.id)}>DUPLICATE</button>
          <button type="button" className={selectedClip.loop ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} aria-pressed={selectedClip.loop} onClick={() => onToggleClipLoop(selectedClip.id)}>LOOP</button>
          <button type="button" className="mixer-toggle compact-danger" onClick={() => onRequestRemoveClip(selectedClip.id)}>DELETE</button>
          <button type="button" className="mixer-toggle" onClick={() => switchToDetailForClip(selectedClip.id)}>EDIT</button>
        </div>
      ) : (
        <p className="track-editor-empty-hint">Tap a clip to select it. Double-tap it, or EDIT, to open DETAIL. {track.clips.length} clip{track.clips.length === 1 ? '' : 's'}.</p>
      ))}
    </section>
  )
}
