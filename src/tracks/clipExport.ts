import type { AudioClip } from './tracksTypes'

export interface ClipExportRegion {
  startFrame: number
  endFrame: number
  filename: string
}

/**
 * Resolves a clip's non-destructive source region to whole PCM frames. The
 * export deliberately ignores timeline placement and clip processing: WAVES
 * sends the selected source material to LASER, not a rendered track bus.
 */
export function getClipExportRegion(clip: AudioClip, sampleRate: number, bufferLength: number): ClipExportRegion {
  const lastAvailableStartFrame = Math.max(0, bufferLength - 1)
  const startFrame = Math.min(lastAvailableStartFrame, Math.max(0, Math.round(clip.sourceOffsetSeconds * sampleRate)))
  const requestedEndFrame = Math.min(bufferLength, Math.max(0, Math.round(clip.sourceEndSeconds * sampleRate)))
  const endFrame = Math.min(bufferLength, Math.max(startFrame + 1, requestedEndFrame))
  const stem = clip.fileName.replace(/\.[^./\\]+$/, '').trim() || 'SAMPLE'
  return { startFrame, endFrame, filename: `${stem}-CUT.wav` }
}
