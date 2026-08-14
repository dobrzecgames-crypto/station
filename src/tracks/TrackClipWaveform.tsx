import { useEffect, useRef } from 'react'
import { drawWaveformEnvelope } from '../canvas/waveformEnvelope'
import { scaleStationUiPixels } from '../uiScale'

interface TrackClipWaveformProps {
  /** Full-asset peaks cache from AudioEngine.getWaveformPeaks - the same
      cache CHOP/pad waveforms already draw from, never re-decoded here. */
  peaks: readonly number[]
  /** The clip's source region, normalized 0-1 against the asset's full
      duration, so only the slice of source audio this clip actually plays
      is drawn - not the whole imported file. */
  regionStart: number
  regionEnd: number
  /** Per-track accent (see trackAccent.ts) for the TRACKS overview, where
      every clip on a given track should read as the same color. Falls back
      to the shared --waveform-wave custom property when omitted, which is
      what the fullscreen Track Editor still uses. */
  color?: string
}

function waveformColor(canvas: HTMLCanvasElement): string {
  return getComputedStyle(canvas).getPropertyValue('--waveform-wave').trim() || '#b99a62'
}

/**
 * A small, per-clip canvas - simplified on purpose (single-color, no grid,
 * no handles) for the compact TRACKS view and reused, uncropped by a parent
 * container's small height, for the detailed Track Editor. One canvas per
 * clip keeps redraw scoped to a clip whose own width or region actually
 * changed - repositioning a clip via CSS left/width never touches this.
 */
export function TrackClipWaveform({ peaks, regionStart, regionEnd, color }: TrackClipWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const width = Math.max(1, Math.floor(canvas.clientWidth))
      const height = Math.max(1, Math.floor(canvas.clientHeight))
      const scale = window.devicePixelRatio || 1
      canvas.width = Math.floor(width * scale)
      canvas.height = Math.floor(height * scale)
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(scale, 0, 0, scale, 0, 0)
      context.clearRect(0, 0, width, height)
      if (peaks.length === 0) return

      const startIndex = Math.max(0, Math.floor(regionStart * peaks.length))
      const endIndex = Math.min(peaks.length, Math.max(startIndex + 1, Math.ceil(regionEnd * peaks.length)))
      const slice = peaks.slice(startIndex, endIndex)
      const strokeColor = color ?? waveformColor(canvas)

      drawWaveformEnvelope(context, slice, { width, height, strokeStyle: strokeColor, fillColor: strokeColor, pointPixelSpacing: scaleStationUiPixels(6) })
    }

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)
    draw()
    return () => resizeObserver.disconnect()
  }, [peaks, regionStart, regionEnd, color])

  return <canvas ref={canvasRef} className="track-clip-waveform" aria-hidden="true" />
}
