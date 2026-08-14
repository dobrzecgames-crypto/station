import { useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { scaleStationUiPixels } from '../uiScale'
import type { TrackHeightLevel } from './tracksTypes'

export interface TracksSelection { trackId: string; clipId: string }

export const defaultPixelsPerBeat = 24
export const defaultTrackHeightLevel: TrackHeightLevel = 'medium'

export interface TracksViewState {
  selection: TracksSelection | null
  setSelection: Dispatch<SetStateAction<TracksSelection | null>>
  pixelsPerBeat: number
  setPixelsPerBeat: Dispatch<SetStateAction<number>>
  /** Wide-arranger-only visual density (see tracksTypes.ts) - lifted up here
      rather than owned by TracksArranger itself for the exact same reason as
      pixelsPerBeat: TracksWorkspace simply never reads it, but it still
      needs to survive TracksArranger unmounting/remounting across a
      device-rotation layout swap and Track Editor open/close. */
  trackHeightLevel: TrackHeightLevel
  setTrackHeightLevel: Dispatch<SetStateAction<TrackHeightLevel>>
  /** Plain refs, not state: a scroll position only needs to be handed off at
      the moment a layout swap mounts/unmounts a component, never re-rendered
      per pixel of scroll - each view reads it once on mount to restore its
      container's scrollLeft/scrollTop and writes it back on its own
      onScroll, the same shape a class component's instance field would use. */
  scrollLeftRef: MutableRefObject<number>
  trackListScrollTopRef: MutableRefObject<number>
}

/**
 * UI-only TRACKS view state - which clip is selected, how zoomed in, how far
 * scrolled. Lifted out of TracksWorkspace/TracksArranger's own component
 * state (where it lived before the wide-arranger orientation feature) so it
 * survives switching between those two components on device rotation - see
 * useTracksLayoutMode. Never touches audioTracks or the audio engine, only
 * presentation, which is exactly why rotation can freely swap which
 * component is mounted without restarting anything audio-related. See
 * docs/DECISIONS.md DEC-027.
 */
export function useTracksViewState(): TracksViewState {
  const [selection, setSelection] = useState<TracksSelection | null>(null)
  const [pixelsPerBeat, setPixelsPerBeat] = useState(() => scaleStationUiPixels(defaultPixelsPerBeat))
  const [trackHeightLevel, setTrackHeightLevel] = useState<TrackHeightLevel>(defaultTrackHeightLevel)
  const scrollLeftRef = useRef(0)
  const trackListScrollTopRef = useRef(0)
  return { selection, setSelection, pixelsPerBeat, setPixelsPerBeat, trackHeightLevel, setTrackHeightLevel, scrollLeftRef, trackListScrollTopRef }
}
