/**
 * Shared with TrackClipWaveform.tsx (TRACKS) and Waveform.tsx (CHOP/PAD) -
 * neither module owns the other, so this is its own small home rather than
 * living under sample-editor/ or tracks/. Draws the actual peaks shape only;
 * everything else each caller layers on top (grid, handles, labels, laser
 * markers, playhead) stays local to that caller.
 *
 * A filled silhouette, but traced through a deliberately small number of
 * grouped points (max within each group) rather than one point per raw
 * peak, with straight joins - not curved. Too few points and it reads as
 * blocky graph-paper squares; a raw point per peak smooths into the same
 * glowing mirrored blob every AI-generated music poster uses; a stroked,
 * unfilled trace through the same points reads as an EKG/vitals line, not a
 * waveform. This middle point - filled, but still visibly jagged rather
 * than smoothed - is the one that reads as an instrument's signal display.
 */
export interface WaveformEnvelopeOptions {
  x?: number
  y?: number
  width: number
  height: number
  /** Peak amplitude as a fraction of the half-height. Callers pick their own
      (TRACKS uses 0.45 for its compact clip view, CHOP 0.42 to leave a hair
      more headroom for its own centerline/grid). */
  amplitudeScale?: number
  /** Accepts a CanvasGradient too (CHOP outlines its silhouette with a
      light-mid-light vertical gradient). */
  strokeStyle: string | CanvasGradient
  /** CSS colour string used as the color-mix() basis for the translucent
      body fill. Omitted entirely skips the fill (outline-only). */
  fillColor?: string
  fillOpacityPercent?: number
  lineWidth?: number
  /** Target on-screen spacing between silhouette points, in px - the knob
      that controls how jagged vs. smooth the fill reads. */
  pointPixelSpacing?: number
}

export function drawWaveformEnvelope(context: CanvasRenderingContext2D, peaks: readonly number[], options: WaveformEnvelopeOptions): void {
  const { x = 0, y = 0, width, height, amplitudeScale = 0.45, strokeStyle, fillColor, fillOpacityPercent = 38, lineWidth = 1, pointPixelSpacing = 6 } = options
  if (peaks.length === 0 || width <= 0) return

  const centerY = y + height / 2
  const pointCount = Math.max(2, Math.min(peaks.length, Math.round(width / pointPixelSpacing)))
  const groupSize = peaks.length / pointCount
  const xAt = (index: number) => x + (pointCount > 1 ? (index / (pointCount - 1)) * width : width / 2)

  const amplitudes = Array.from({ length: pointCount }, (_, point) => {
    const start = Math.floor(point * groupSize)
    const end = Math.max(start + 1, Math.floor((point + 1) * groupSize))
    let peak = 0
    for (let index = start; index < end && index < peaks.length; index += 1) peak = Math.max(peak, peaks[index])
    // Never a fully-flat stretch, even for near-silence - a live signal
    // always shows a faint resting wobble, not a dead straight edge.
    return Math.max(1.5, Math.min(1, peak) * (height * amplitudeScale))
  })

  context.beginPath()
  amplitudes.forEach((amplitude, point) => {
    const px = xAt(point)
    if (point === 0) context.moveTo(px, centerY - amplitude); else context.lineTo(px, centerY - amplitude)
  })
  for (let point = amplitudes.length - 1; point >= 0; point -= 1) context.lineTo(xAt(point), centerY + amplitudes[point])
  context.closePath()

  if (fillColor) {
    context.fillStyle = `color-mix(in srgb, ${fillColor} ${fillOpacityPercent}%, transparent)`
    context.fill()
  }
  context.strokeStyle = strokeStyle
  context.lineWidth = lineWidth
  context.lineJoin = 'round'
  context.stroke()
}
