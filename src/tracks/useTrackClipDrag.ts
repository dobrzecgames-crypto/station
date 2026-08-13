import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { scaleStationUiPixels } from '../uiScale'
import { snapBeatToGrid } from './timelineGrid'
import type { TimelineGridDivision } from './tracksTypes'
import type { AudioClip, AudioTrack } from './tracksTypes'
import type { TracksSelection } from './useTracksViewState'

export const dragThresholdPixels = 6
const doubleTapThresholdMs = 350

type DragKind = 'move' | 'trim-start' | 'trim-end'
interface DragState { kind: DragKind; trackId: string; clipId: string; pointerId: number; startClientX: number; originClip: AudioClip; previewDeltaBeats: number }

export interface ClipDragPreview {
  /** True while this exact clip is the one being dragged/trimmed - callers
      use it to decide whether to read live drag state or the clip's own
      startBeat/lengthBeats. */
  isDragging: boolean
  displayStartBeat: number
  displayLengthBeats: number
}

interface UseTrackClipDragOptions {
  pixelsPerBeat: number
  snapDivision: TimelineGridDivision
  isPlaying: boolean
  scrollContainerRef: RefObject<HTMLDivElement | null>
  selection: TracksSelection | null
  onSelectionChange: (selection: TracksSelection | null) => void
  onOpenTrackEditor: (trackId: string) => void
  onMoveClip: (trackId: string, clipId: string, startBeat: number) => void
  onTrimClipStart: (trackId: string, clipId: string, startBeat: number) => void
  onTrimClipEnd: (trackId: string, clipId: string, endBeat: number) => void
  onSeekPlayhead: (beat: number) => void
}

/**
 * Clip drag/trim/select/double-tap/ruler-seek pointer handling, shared by
 * the compact TracksWorkspace and the wide TracksArranger - previously lived
 * only inside TracksWorkspace, including a real bug caught during browser
 * verification (event.currentTarget read lazily inside a setState updater,
 * where it is already null - a native DOM Event rule, not React pooling).
 * Extracted here so that fix exists in exactly one place instead of being
 * re-introduced by a second, independent implementation. See
 * docs/DECISIONS.md DEC-027.
 *
 * Drag vs. native horizontal scroll is disambiguated by touch target, not
 * gesture heuristics: a clip must carry touch-action:none and handle its own
 * pointer drag; empty lane/ruler space keeps the container's native scroll -
 * see tracksWorkspace.css/tracksArranger.css.
 */
export function useTrackClipDrag({ pixelsPerBeat, snapDivision, isPlaying, scrollContainerRef, selection, onSelectionChange, onOpenTrackEditor, onMoveClip, onTrimClipStart, onTrimClipEnd, onSeekPlayhead }: UseTrackClipDragOptions) {
  const dragThreshold = scaleStationUiPixels(dragThresholdPixels)
  const [drag, setDrag] = useState<DragState | null>(null)
  const lastTapRef = useRef<{ trackId: string; time: number } | null>(null)
  /** Always-current mirror of `drag`, assigned fresh every render - same
      shape and same reason as App.tsx's audioTracksRef. commitDrag needs
      drag's value at commit time but must not read it from inside a
      setDrag(current => ...) functional updater: that updater has to stay
      pure, and this one calls onMoveClip/onTrimClipStart/onTrimClipEnd -
      the caller's own state update, one component away - from inside it.
      React 18 StrictMode double-invokes updater functions in development
      specifically to catch this kind of impurity; the second, throwaway
      invocation still ran the real onMoveClip/onTrimClip* call, which React
      then rejected with "Cannot update a component while rendering a
      different component" and silently dropped, so a clip drag/trim never
      actually committed anything in dev mode. Reading the ref instead, and
      calling those callbacks in the handler body after a plain
      (non-functional) setDrag, sidesteps double-invocation entirely - a
      plain value passed to setState is never re-invoked to check purity,
      only a function is. */
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  const beatFromClientX = (clientX: number): number => {
    const container = scrollContainerRef.current
    if (!container) return 0
    const rect = container.getBoundingClientRect()
    return Math.max(0, (clientX - rect.left + container.scrollLeft) / pixelsPerBeat)
  }

  /** Shared by the lane background and a clip's own body (not its trim
      handles - a double-tap there has no meaning): double-tapping anywhere
      in a track's row opens its editor, on the clip itself or the empty
      space beside it alike. Returns true when it just consumed this tap as
      the second half of a double-tap, so the caller skips its normal
      single-tap behaviour (select/drag or seek). */
  const checkDoubleTap = (event: ReactPointerEvent<HTMLDivElement>, trackId: string): boolean => {
    const now = event.timeStamp
    const last = lastTapRef.current
    if (last && last.trackId === trackId && now - last.time < doubleTapThresholdMs) {
      lastTapRef.current = null
      onOpenTrackEditor(trackId)
      return true
    }
    lastTapRef.current = { trackId, time: now }
    return false
  }

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, kind: DragKind, track: AudioTrack, clip: AudioClip) => {
    event.stopPropagation()
    if (kind === 'move' && checkDoubleTap(event, track.id)) return
    onSelectionChange({ trackId: track.id, clipId: clip.id })
    setDrag({ kind, trackId: track.id, clipId: clip.id, pointerId: event.pointerId, startClientX: event.clientX, originClip: clip, previewDeltaBeats: 0 })
  }

  const updateDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    // event.currentTarget is only valid for the synchronous duration of this
    // handler (a native DOM Event rule, not React pooling), so it is
    // captured into a plain local here rather than read lazily below.
    // Reads dragRef instead of setDrag's functional-updater form - see
    // dragRef's docs above for why that form is unsafe here specifically.
    const target = event.currentTarget
    const pointerId = event.pointerId
    const clientX = event.clientX
    const current = dragRef.current
    if (!current || current.pointerId !== pointerId) return
    const deltaPixels = clientX - current.startClientX
    if (Math.abs(deltaPixels) >= dragThreshold && !target.hasPointerCapture(pointerId)) {
      try { target.setPointerCapture(pointerId) } catch { /* the pointer session may already have ended */ }
    }
    setDrag({ ...current, previewDeltaBeats: deltaPixels / pixelsPerBeat })
  }

  const commitDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = dragRef.current
    setDrag(null)
    if (!current || current.pointerId !== event.pointerId) return
    if (Math.abs(current.previewDeltaBeats) * pixelsPerBeat >= dragThreshold) {
      const division = snapDivision
      if (current.kind === 'move') {
        const nextStart = snapBeatToGrid(current.originClip.startBeat + current.previewDeltaBeats, division)
        onMoveClip(current.trackId, current.clipId, nextStart)
      } else if (current.kind === 'trim-start') {
        const nextStart = snapBeatToGrid(current.originClip.startBeat + current.previewDeltaBeats, division)
        onTrimClipStart(current.trackId, current.clipId, nextStart)
      } else {
        const originalEnd = current.originClip.startBeat + current.originClip.lengthBeats
        const nextEnd = snapBeatToGrid(originalEnd + current.previewDeltaBeats, division)
        onTrimClipEnd(current.trackId, current.clipId, nextEnd)
      }
    }
  }

  const cancelDrag = () => setDrag(null)

  const handleRulerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isPlaying) return
    onSeekPlayhead(snapBeatToGrid(beatFromClientX(event.clientX), snapDivision))
  }

  /** The position/length a clip should actually render at right now - either
      its own committed values, or a live preview while it is the clip being
      dragged/trimmed. Consolidates the same isDragging/previewStart/
      previewLength math both TracksWorkspace and TracksArranger need. */
  const previewFor = (clip: AudioClip): ClipDragPreview => {
    if (drag?.clipId !== clip.id) return { isDragging: false, displayStartBeat: clip.startBeat, displayLengthBeats: clip.lengthBeats }
    if (drag.kind === 'move') return { isDragging: true, displayStartBeat: clip.startBeat + drag.previewDeltaBeats, displayLengthBeats: clip.lengthBeats }
    if (drag.kind === 'trim-start') return { isDragging: true, displayStartBeat: clip.startBeat + drag.previewDeltaBeats, displayLengthBeats: clip.lengthBeats - drag.previewDeltaBeats }
    return { isDragging: true, displayStartBeat: clip.startBeat, displayLengthBeats: clip.lengthBeats + drag.previewDeltaBeats }
  }

  const isSelected = (clip: AudioClip): boolean => selection?.clipId === clip.id

  return { beatFromClientX, checkDoubleTap, beginDrag, updateDrag, commitDrag, cancelDrag, handleRulerPointerDown, previewFor, isSelected }
}
