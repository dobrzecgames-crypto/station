import { useEffect, useRef, useState } from 'react'
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
}

const minimumSliceSeconds = 0.01
const markerHitWidthPixels = 18

type DragState = { kind: 'start' | 'end'; pointerId: number } | { kind: 'cut'; index: number; pointerId: number } | null

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
  }
}

export function Waveform({ peaks, durationSeconds, region, slices, activeSliceId, addingSlice, onRegionChange, onAddSlice, onMoveCut, onSelectSlice, sliceMarkersDraggable = false, playheadSeconds = null, readOnly = false }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStateRef = useRef<DragState>(null)
  const [draggingMarker, setDraggingMarker] = useState(false)

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

      const centerY = height / 2
      const waveformGradient = context.createLinearGradient(0, 0, 0, height)
      waveformGradient.addColorStop(0, colors.waveformLight)
      waveformGradient.addColorStop(0.5, colors.waveform)
      waveformGradient.addColorStop(1, colors.waveformLight)
      context.strokeStyle = waveformGradient
      context.lineWidth = 1
      context.beginPath()
      peaks.forEach((peak, index) => {
        const x = index / Math.max(1, peaks.length - 1) * width
        const amplitude = Math.min(1, peak) * (height * 0.42)
        context.moveTo(x, centerY - amplitude)
        context.lineTo(x, centerY + amplitude)
      })
      context.stroke()

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

      context.strokeStyle = colors.regionHandle
      context.lineWidth = 1
      for (const x of [startX, endX]) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
        drawHandle(x, colors.regionHandle)
      }

      context.font = '700 11px Inter, sans-serif'
      slices.forEach((slice, index) => {
        if (index < slices.length - 1) {
          const cutX = width * slice.endSeconds / durationSeconds
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
        const labelX = width * ((slice.startSeconds + slice.endSeconds) / 2) / durationSeconds
        context.fillStyle = slice.id === activeSliceId ? colors.activeLabel : colors.label
        context.fillText(String(index + 1), labelX + 4, 14)
      })
    }

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)
    draw()
    return () => resizeObserver.disconnect()
  }, [activeSliceId, durationSeconds, peaks, playheadSeconds, region, slices])

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
      className={`waveform ${addingSlice ? 'waveform-adding-slice' : ''} ${sliceMarkersDraggable ? 'waveform-slice-markers' : ''} ${draggingMarker ? 'waveform-dragging-marker' : ''} ${readOnly ? 'waveform-readonly' : ''}`}
      role="img"
      aria-label="Sample waveform with playback handles and slice markers"
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
          else return
        }
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
