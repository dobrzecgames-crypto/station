import type { AudioClip } from './tracksTypes'

const minimumSourceSeconds = 0.01

/** Pure source-selection math shared by the domain operation and tests. */
export function resolveClipSourceRegion(clip: AudioClip, startSeconds: number, endSeconds: number, sourceDurationSeconds: number, bpm: number): AudioClip {
  const maximumStart = Math.max(0, sourceDurationSeconds - minimumSourceSeconds)
  const start = Math.min(maximumStart, Math.max(0, startSeconds))
  const end = Math.min(sourceDurationSeconds, Math.max(start + minimumSourceSeconds, endSeconds))
  return {
    ...clip,
    sourceOffsetSeconds: start,
    sourceEndSeconds: end,
    lengthBeats: clip.loop ? clip.lengthBeats : (end - start) * bpm / 60,
  }
}
