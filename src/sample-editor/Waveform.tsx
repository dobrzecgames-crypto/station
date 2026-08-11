import { useEffect, useRef, useState } from 'react'
import { drawWaveformEnvelope } from '../canvas/waveformEnvelope'
import type { SamplePlaybackRegion, SampleSlice } from '../pads/types'

interface WaveformProps {
  peaks: readonly number[]
  durationSeconds: number
  region: SamplePlaybackRegion
  slices: readonly Pick<SampleSlice, 'id' | 'startSeconds' | 'endSeconds'>[]
  activeSliceId: string | null
  addingSlice: boolean
  onRegionChange: (region: SamplePlaybackRegion) => void
  onAddSlice: (timeSeconds: number) => void
  onMoveCut: (cutIndex: number, timeSeconds: number) => void
  onSelectSlice: (sliceId: string) => void
  sliceMarkersDraggable?: boolean
  playheadSeconds?: number | null
  readOnly?: boolean
  /**
   * Lets a drag that starts away from either boundary create a brand-new
   * playback region. Used by WAVES as a source-material selection surface;
   * the ordinary Sample Editor keeps its existing handle-only behaviour.
   */
  regionSelectionEnabled?: boolean
  /** CUT's preview draws its candidate cut boundaries here before SET
      commits them - 'laser' swaps the normal block-handle cut markers for a
      thin glowing line, since these aren't real cuts yet and (CUT being a
      slice-count, not a position) there can be several at once. */
  cutMarkerStyle?: 'default' | 'laser'
  /** Just-applied cut times (seconds) - animates a brief brighter pulse over
      their laser line, see FLASH_HOLD_MS/FLASH_DECAY_MS below. Caller clears
      this well after the animation settles (see ChopWorkspace.tsx); purely a
      decorative read of already-committed slices, not a data source. */
  flashCutTimes?: readonly number[] | null
}

const minimumSliceSeconds = 0.01
const markerHitWidthPixels = 18
/** SET's "cyk" - a brief brighter pulse on the laser(s) at the cut(s) just
    committed. Held at full intensity briefly, then eased out - not a single
    on/off flip, so it reads as a flash decaying rather than a UI blink.
    Total stays within the 250-400ms window this was speced to. */
const flashHoldMs = 100
const flashDecayMs = 200
const flashTotalMs = flashHoldMs + flashDecayMs

function flashIntensityAt(elapsedMs: number): number {
  if (elapsedMs <= flashHoldMs) return 1
  if (elapsedMs >= flashTotalMs) return 0
  return 1 - (elapsedMs - flashHoldMs) / flashDecayMs
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

type DragState = { kind: 'start' | 'end'; pointerId: number } | { kind: 'region'; anchorSeconds: number; pointerId: number } | { kind: 'cut'; index: number; pointerId: number } | null

interface WaveformColors {
  background: string
  outsideRegion: string
  activeSlice: string
  waveform: string
  waveformLight: string
  grid: string
  regionHandle: string
  cut: string
  activeCut: string
  handleEdge: string
  handleRib: string
  label: string
  activeLabel: string
  playhead: string
  laser: string
  laserGlow: string
  laserCore: string
  /** The SET flash's hottest moment - near-white, not another warm tone, so
      the peak genuinely reads as "bright/almost white" against the resting
      laser's gold. --station-text is the app's own ivory ("pure white is
      not a UI colour" per docs/COLOR_BIBLE.md), not a new colour. */
  flashCore: string
}

function getWaveformColors(canvas: HTMLCanvasElement): WaveformColors {
  const styles = getComputedStyle(canvas)
  const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    background: color('--waveform-background', '#090a10'),
    outsideRegion: color('--waveform-outside-region', 'rgb(0 0 0 / 28%)'),
    activeSlice: color('--waveform-active-slice', 'rgb(200 111 80 / 16%)'),
    waveform: color('--waveform-wave', '#b99a62'),
    waveformLight: color('--waveform-wave-light', '#d3b77e'),
    grid: color('--waveform-grid', 'rgb(238 228 214 / 14%)'),
    regionHandle: color('--waveform-region-handle', '#c86f50'),
    cut: color('--waveform-cut', '#b99a62'),
    activeCut: color('--waveform-active-cut', '#c86f50'),
    handleEdge: color('--waveform-handle-edge', '#090a10'),
    handleRib: color('--waveform-handle-rib', 'rgb(238 228 214 / 52%)'),
    label: color('--waveform-label', '#eee4d6'),
    activeLabel: color('--waveform-active-label', '#d3b77e'),
    playhead: color('--waveform-playhead', '#b5e0eb'),
    laser: color('--cut-laser', '#c86f50'),
    laserGlow: color('--cut-laser-glow', 'rgb(200 111 80 / 55%)'),
    laserCore: color('--cut-laser-core', '#ffcfb0'),
    flashCore: color('--station-text', '#eee4d6'),
  }
}

export function Waveform({ peaks, durationSeconds, region, slices, activeSliceId, addingSlice, onRegionChange, onAddSlice, onMoveCut, onSelectSlice, sliceMarkersDraggable = false, playheadSeconds = null, readOnly = false, regionSelectionEnabled = false, cutMarkerStyle = 'default', flashCutTimes = null }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStateRef = useRef<DragState>(null)
  const [draggingMarker, setDraggingMarker] = useState(false)
  // Driven by the rAF loop below, read fresh on every draw() call (including
  // ones triggered by ResizeObserver mid-flash) - not React state, since it
  // ticks up to ~60x/sec and has no business causing a re-render.
  const flashIntensityRef = useRef(0)

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
      const colors = getWaveformColors(canvas)

      context.setTransform(scale, 0, 0, scale, 0, 0)
      context.clearRect(0, 0, width, height)
      context.fillStyle = colors.background
      context.fillRect(0, 0, width, height)

      const startX = width * region.startSeconds / durationSeconds
      const endX = width * region.endSeconds / durationSeconds
      context.fillStyle = colors.outsideRegion
      context.fillRect(0, 0, startX, height)
      context.fillRect(endX, 0, width - endX, height)

      context.strokeStyle = colors.grid
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(0, height / 2)
      context.lineTo(width, height / 2)
      context.stroke()

      const activeSlice = slices.find((slice) => slice.id === activeSliceId)
      if (activeSlice) {
        context.fillStyle = colors.activeSlice
        context.fillRect(width * activeSlice.startSeconds / durationSeconds, 0, width * (activeSlice.endSeconds - activeSlice.startSeconds) / durationSeconds, height)
      }

      // Filled jagged silhouette (see drawWaveformEnvelope) - same "electric
      // signal" language TRACKS' clips use, with CHOP's own two-tone outline
      // gradient on top since this canvas also carries a grid, handles and
      // labels that a small TRACKS clip never has to share room with.
      const waveformGradient = context.createLinearGradient(0, 0, 0, height)
      waveformGradient.addColorStop(0, colors.waveformLight)
      waveformGradient.addColorStop(0.5, colors.waveform)
      waveformGradient.addColorStop(1, colors.waveformLight)
      // Denser points than the shared 6px default (TRACKS' tiny clips stay
      // there) - CHOP's canvas is wide enough to carry more texture without
      // smoothing back into a blob, and that's the detail/"life" this is
      // the main, zoomed-in view for.
      // A very slight dip in opacity while SET's flash is at its brightest -
      // "przygasa" is the word, a dip you feel more than see - so the flash
      // reads as the wave momentarily giving way to the cut, not a light
      // turning on next to an unrelated, unreactive wave.
      context.save()
      context.globalAlpha = 1 - flashIntensityRef.current * 0.15
      drawWaveformEnvelope(context, peaks, { width, height, amplitudeScale: 0.42, strokeStyle: waveformGradient, fillColor: colors.waveform, fillOpacityPercent: 30, lineWidth: 1.3, pointPixelSpacing: 3 })
      context.restore()

      if (playheadSeconds !== null && Number.isFinite(playheadSeconds)) {
        const playheadX = Math.min(width, Math.max(0, width * playheadSeconds / durationSeconds))
        context.strokeStyle = colors.playhead
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(playheadX, 0)
        context.lineTo(playheadX, height)
        context.stroke()
      }

      const drawHandle = (x: number, color: string) => {
        const left = Math.min(width - 10, Math.max(0, x - 5))
        context.fillStyle = colors.handleEdge
        context.fillRect(left - 1, 3, 12, 20)
        context.fillStyle = color
        context.fillRect(left, 4, 10, 18)
        context.fillStyle = colors.handleRib
        for (let rib = 0; rib < 3; rib += 1) context.fillRect(left + 2 + rib * 3, 8, 1, 10)
      }

      // A real bloom, not a hairline with a faint shadow: a wide, soft outer
      // pass in the glow colour first, then a thin sharp core on top in the
      // hot colour - the layering (not just shadowBlur alone) is what reads
      // as a lit beam rather than "a line that happens to have a shadow",
      // and staying thin keeps it a precise beam rather than a fat bar.
      // Small glowing lamps at the top and bottom edges, not a dark notch -
      // the beam reads as fired between two lit points rather than starting/
      // stopping mid-air. `intensity` (0 = resting, 1 = SET's peak flash)
      // scales every pass continuously rather than flipping between two
      // fixed looks, so the flash reads as decaying, not blinking off.
      const drawLaser = (x: number, intensity: number) => {
        const coreColor = intensity > 0.7 ? colors.flashCore : intensity > 0.25 ? colors.laserCore : colors.laser
        const dotColor = intensity > 0.5 ? colors.flashCore : colors.laserCore

        context.save()
        context.shadowColor = colors.laserGlow
        context.shadowBlur = lerp(12, 20, intensity)
        context.strokeStyle = colors.laserGlow
        context.lineWidth = lerp(2.4, 3.4, intensity)
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
        context.restore()

        context.save()
        context.shadowColor = colors.laserGlow
        context.shadowBlur = lerp(6, 10, intensity)
        context.strokeStyle = coreColor
        context.lineWidth = lerp(1.1, 1.6, intensity)
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
        context.restore()

        context.save()
        context.shadowColor = colors.laserGlow
        context.shadowBlur = lerp(9, 15, intensity)
        context.fillStyle = dotColor
        context.beginPath()
        context.arc(x, height / 2, lerp(2.2, 3.2, intensity), 0, Math.PI * 2)
        context.fill()
        context.restore()

        context.save()
        context.shadowColor = colors.laserGlow
        context.shadowBlur = lerp(8, 13, intensity)
        context.fillStyle = dotColor
        const lampRadius = lerp(2.3, 3.2, intensity)
        context.beginPath()
        context.arc(x, 3, lampRadius, 0, Math.PI * 2)
        context.fill()
        context.beginPath()
        context.arc(x, height - 3, lampRadius, 0, Math.PI * 2)
        context.fill()
        context.restore()
      }

      context.strokeStyle = colors.regionHandle
      context.lineWidth = 1
      for (const x of [startX, endX]) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
        // WAVES overlays larger DOM grips and START/END badges around this
        // canvas so both source edges stay unmistakable on touch screens.
        // The ordinary Sample Editor still uses the compact canvas handle.
        if (!regionSelectionEnabled) drawHandle(x, colors.regionHandle)
      }

      context.font = '700 11px Inter, sans-serif'
      const isLaserPreview = cutMarkerStyle === 'laser'
      slices.forEach((slice, index) => {
        if (index < slices.length - 1) {
          const cutX = width * slice.endSeconds / durationSeconds
          if (isLaserPreview) {
            drawLaser(cutX, 0)
          } else {
            const activeMarker = slice.id === activeSliceId || slices[index + 1].id === activeSliceId
            const markerColor = activeMarker ? colors.activeCut : colors.cut
            context.lineWidth = activeMarker ? 5 : 3
            context.strokeStyle = colors.handleEdge
            context.beginPath()
            context.moveTo(cutX, 0)
            context.lineTo(cutX, height)
            context.stroke()
            context.lineWidth = activeMarker ? 2 : 1
            context.strokeStyle = markerColor
            context.beginPath()
            context.moveTo(cutX, 0)
            context.lineTo(cutX, height)
            context.stroke()
            drawHandle(cutX, markerColor)
          }
        }
        const labelX = width * ((slice.startSeconds + slice.endSeconds) / 2) / durationSeconds
        context.fillStyle = slice.id === activeSliceId ? colors.activeLabel : colors.label
        context.fillText(String(index + 1), labelX + 4, 14)
      })

      if (flashCutTimes && flashCutTimes.length > 0) {
        flashCutTimes.forEach((timeSeconds) => drawLaser(width * timeSeconds / durationSeconds, flashIntensityRef.current))
      }
    }

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)

    // The flash is its own rAF loop, not React state ticking every frame -
    // draw() above always reads the current intensity from the ref, so a
    // ResizeObserver-triggered redraw mid-flash still shows the right frame.
    // prefers-reduced-motion swaps the eased ramp for a single short step
    // (still visible feedback, no continuous motion).
    let animationFrameId: number | null = null
    let reducedMotionTimeoutId: number | null = null
    if (flashCutTimes && flashCutTimes.length > 0) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        flashIntensityRef.current = 1
        draw()
        reducedMotionTimeoutId = window.setTimeout(() => {
          flashIntensityRef.current = 0
          draw()
        }, 150)
      } else {
        // Draw the first (peak) frame synchronously - otherwise the canvas
        // would show one frame (~16ms) of the old, pre-flash content while
        // waiting on the first rAF callback.
        flashIntensityRef.current = flashIntensityAt(0)
        draw()
        const startTime = performance.now()
        const tick = (now: number) => {
          const elapsed = now - startTime
          flashIntensityRef.current = flashIntensityAt(elapsed)
          draw()
          if (elapsed < flashTotalMs) animationFrameId = requestAnimationFrame(tick)
        }
        animationFrameId = requestAnimationFrame(tick)
      }
    } else {
      flashIntensityRef.current = 0
      draw()
    }

    return () => {
      resizeObserver.disconnect()
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
      if (reducedMotionTimeoutId !== null) window.clearTimeout(reducedMotionTimeoutId)
    }
  }, [activeSliceId, cutMarkerStyle, durationSeconds, flashCutTimes, peaks, playheadSeconds, region, regionSelectionEnabled, slices])

  const timeFromPointer = (clientX: number): number | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * durationSeconds
  }

  const updateFromPointer = (clientX: number) => {
    const timeSeconds = timeFromPointer(clientX)
    const dragState = dragStateRef.current
    if (timeSeconds === null || !dragState) return
    const minimumLength = Math.min(minimumSliceSeconds, durationSeconds)

    if (dragState.kind === 'start') {
      onRegionChange({ startSeconds: Math.min(timeSeconds, region.endSeconds - minimumLength), endSeconds: region.endSeconds })
    } else if (dragState.kind === 'end') {
      onRegionChange({ startSeconds: region.startSeconds, endSeconds: Math.max(timeSeconds, region.startSeconds + minimumLength) })
    } else if (dragState.kind === 'region') {
      const movingRight = timeSeconds >= dragState.anchorSeconds
      let startSeconds = Math.min(dragState.anchorSeconds, timeSeconds)
      let endSeconds = Math.max(dragState.anchorSeconds, timeSeconds)
      if (endSeconds - startSeconds < minimumLength) {
        if (movingRight) endSeconds = Math.min(durationSeconds, startSeconds + minimumLength)
        else startSeconds = Math.max(0, endSeconds - minimumLength)
      }
      onRegionChange({ startSeconds, endSeconds })
    } else if (dragState.kind === 'cut') {
      onMoveCut(dragState.index, timeSeconds)
    }
  }

  const stopDragging = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (event && dragStateRef.current?.pointerId === event.pointerId) {
      updateFromPointer(event.clientX)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragStateRef.current = null
    setDraggingMarker(false)
  }

  return (
    <canvas
      ref={canvasRef}
      className={`waveform ${addingSlice ? 'waveform-adding-slice' : ''} ${sliceMarkersDraggable ? 'waveform-slice-markers' : ''} ${regionSelectionEnabled ? 'waveform-region-selection' : ''} ${draggingMarker ? 'waveform-dragging-marker' : ''} ${readOnly ? 'waveform-readonly' : ''}`}
      role="img"
      aria-label={regionSelectionEnabled ? 'Source waveform. Drag across it to select the region sent to LASER.' : 'Sample waveform with playback handles and slice markers'}
      onPointerDown={(event) => {
        if (readOnly) return
        const timeSeconds = timeFromPointer(event.clientX)
        if (timeSeconds === null) return
        const canvas = event.currentTarget
        const markerThreshold = durationSeconds * markerHitWidthPixels / canvas.getBoundingClientRect().width
        const cutIndex = slices.slice(0, -1).findIndex((slice) => Math.abs(slice.endSeconds - timeSeconds) <= markerThreshold)
        if (cutIndex >= 0) {
          event.preventDefault()
          dragStateRef.current = { kind: 'cut', index: cutIndex, pointerId: event.pointerId }
          setDraggingMarker(true)
          onSelectSlice(slices[cutIndex].id)
        } else if (addingSlice) {
          event.preventDefault()
          onAddSlice(timeSeconds)
          return
        } else {
          const matchingSlice = slices.find((slice) => timeSeconds >= slice.startSeconds && timeSeconds <= slice.endSeconds)
          if (matchingSlice) onSelectSlice(matchingSlice.id)
          if (Math.abs(timeSeconds - region.startSeconds) <= markerThreshold) dragStateRef.current = { kind: 'start', pointerId: event.pointerId }
          else if (Math.abs(timeSeconds - region.endSeconds) <= markerThreshold) dragStateRef.current = { kind: 'end', pointerId: event.pointerId }
          else if (regionSelectionEnabled) dragStateRef.current = { kind: 'region', anchorSeconds: timeSeconds, pointerId: event.pointerId }
          else return
        }
        event.preventDefault()
        setDraggingMarker(true)
        canvas.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (dragStateRef.current?.pointerId !== event.pointerId) return
        event.preventDefault()
        updateFromPointer(event.clientX)
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={() => stopDragging()}
    />
  )
}
