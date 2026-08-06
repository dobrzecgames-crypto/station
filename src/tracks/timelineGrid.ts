import type { TimelineGridDivision } from './tracksTypes'

/**
 * Beats per grid unit, in the same 4/4-at-16th-notes space the sequencer
 * already uses (StepSequencer's stepDuration = 60/bpm/4, i.e. one step is a
 * quarter beat). "1 bar" = 4 beats = 16 steps, matching one pattern pass.
 */
export const timelineGridDivisionBeats: Record<Exclude<TimelineGridDivision, 'off'>, number> = {
  '1': 4,
  '1/2': 2,
  '1/4': 1,
  '1/8': 0.5,
  '1/16': 0.25,
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return beats * (60 / bpm)
}

export function secondsToBeats(seconds: number, bpm: number): number {
  return seconds / (60 / bpm)
}

/** Snaps a timeline position to the active grid division. OFF returns the
    position clamped to non-negative, unchanged otherwise - used identically
    for moving a clip, resizing it, cutting it, setting its loop length and
    (when snap is active) moving the playhead. */
export function snapBeatToGrid(beat: number, division: TimelineGridDivision): number {
  const clamped = Math.max(0, beat)
  if (division === 'off') return clamped
  const unit = timelineGridDivisionBeats[division]
  return Math.max(0, Math.round(clamped / unit) * unit)
}
