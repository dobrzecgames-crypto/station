import { useState } from 'react'
import { cloneAudioTrack } from './tracksOperations'
import type { AudioTrack } from './tracksTypes'

const maximumHistoryDepth = 50

/**
 * Undo/redo for TRACKS clip/track edits - plain snapshots of AudioTrack[],
 * cheap given the data size (at most maximumAudioTracks tracks, a handful of
 * clips each). Deliberately excludes track/clip creation and deletion: a
 * delete already frees the underlying decoded asset in the engine
 * (App.tsx's evictUnusedTrackAssets, via AudioEngine.removeSampleAsset), so
 * undoing it would restore clip data pointing at an asset the engine no
 * longer holds - silent missing audio/waveform. Only App.tsx's
 * updateAudioTracks (used by edits that never touch asset lifecycle) calls
 * record(); import/delete call setAudioTracks directly and stay outside
 * history, matching how delete already has its own safety net
 * (StationConfirm) instead of an undo path. See docs/DECISIONS.md DEC-027.
 */
export function useTracksHistory() {
  const [past, setPast] = useState<AudioTrack[][]>([])
  const [future, setFuture] = useState<AudioTrack[][]>([])

  /** Call with the state as it was *before* the change that is about to be
      applied - typically right before the corresponding setAudioTracks. */
  const record = (previous: readonly AudioTrack[]): void => {
    setPast((current) => [...current.slice(-(maximumHistoryDepth - 1)), previous.map(cloneAudioTrack)])
    setFuture([])
  }

  /** Returns the snapshot to restore, or undefined when there is nothing to
      undo. `current` is pushed onto the redo stack so a following redo can
      return to it. */
  const undo = (current: readonly AudioTrack[]): AudioTrack[] | undefined => {
    const target = past.at(-1)
    if (!target) return undefined
    setPast((existing) => existing.slice(0, -1))
    setFuture((existing) => [...existing, current.map(cloneAudioTrack)])
    return target
  }

  const redo = (current: readonly AudioTrack[]): AudioTrack[] | undefined => {
    const target = future.at(-1)
    if (!target) return undefined
    setFuture((existing) => existing.slice(0, -1))
    setPast((existing) => [...existing, current.map(cloneAudioTrack)])
    return target
  }

  const clear = (): void => { setPast([]); setFuture([]) }

  return { canUndo: past.length > 0, canRedo: future.length > 0, record, undo, redo, clear }
}
