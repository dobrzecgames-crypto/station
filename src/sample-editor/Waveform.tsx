import { useEffect, useRef } from 'react'
import type { SamplePlaybackRegion, SampleSlice } from '../pads/types'

interface WaveformProps {
  peaks: readonly number[]
  durationSeconds: number
  region: SamplePlaybackRegion
  slices: readonly SampleSlice[]
  activeSliceId: string | null
  addingSlice: boolean
  onRegionChange: (region: SamplePlaybackRegion) => void
  onAddSlice: (timeSeconds: number) => void
  onMoveCut: (cutIndex: number, timeSeconds: number) => void
  onSelectSlice: (sliceId: string) => void
}

type DragState = { kind: 'start' | 'end' } | { kind: 'cut'; index: number } | null

export function Waveform({ peaks, durationSeconds, region, slices, activeSliceId, addingSlice, onRegionChange, onAddSlice, onMoveCut, onSelectSlice }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStateRef = useRef<DragState>(null)

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
      context.fillStyle = '#292d31'
      context.fillRect(0, 0, width, height)

      const startX = width * region.startSeconds / durationSeconds
      const endX = width * region.endSeconds / durationSeconds
      context.fillStyle = 'rgb(0 0 0 / 28%)'
      context.fillRect(0, 0, startX, height)
      context.fillRect(endX, 0, width - endX, height)

      const activeSlice = slices.find((slice) => slice.id === activeSliceId)
      if (activeSlice) {
        context.fillStyle = 'rgb(243 180 79 / 16%)'
        context.fillRect(width * activeSlice.startSeconds / durationSeconds, 0, width * (activeSlice.endSeconds - activeSlice.startSeconds) / durationSeconds, height)
      }

      const centerY = height / 2
      context.strokeStyle = '#75d28a'
      context.lineWidth = 1
      context.beginPath()
      peaks.forEach((peak, index) => {
        const x = index / Math.max(1, peaks.length - 1) * width
        const amplitude = Math.min(1, peak) * (height * 0.42)
        context.moveTo(x, centerY - amplitude)
        context.lineTo(x, centerY + amplitude)
      })
      context.stroke()

      context.strokeStyle = '#f3b44f'
      context.lineWidth = 2
      for (const x of [startX, endX]) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }

      context.strokeStyle = '#7bb7ff'
      context.fillStyle = '#d9ebff'
      context.font = '700 11px Inter, sans-serif'
      slices.forEach((slice, index) => {
        if (index < slices.length - 1) {
          const cutX = width * slice.endSeconds / durationSeconds
          context.beginPath()
          context.moveTo(cutX, 0)
          context.lineTo(cutX, height)
          context.stroke()
        }
        const labelX = width * ((slice.startSeconds + slice.endSeconds) / 2) / durationSeconds
        context.fillText(String(index + 1), labelX + 4, 14)
      })
    }

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)
    draw()
    return () => resizeObserver.disconnect()
  }, [activeSliceId, durationSeconds, peaks, region, slices])

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
    const minimumLength = Math.min(0.01, durationSeconds)

    if (dragState.kind === 'start') {
      onRegionChange({ startSeconds: Math.min(timeSeconds, region.endSeconds - minimumLength), endSeconds: region.endSeconds })
    } else if (dragState.kind === 'end') {
      onRegionChange({ startSeconds: region.startSeconds, endSeconds: Math.max(timeSeconds, region.startSeconds + minimumLength) })
    } else if (dragState.kind === 'cut') {
      onMoveCut(dragState.index, timeSeconds)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className={`waveform ${addingSlice ? 'waveform-adding-slice' : ''}`}
      role="img"
      aria-label="Sample waveform with playback handles and slice markers"
      onPointerDown={(event) => {
        const timeSeconds = timeFromPointer(event.clientX)
        if (timeSeconds === null) return
        const canvas = event.currentTarget
        const markerThreshold = durationSeconds * 12 / canvas.getBoundingClientRect().width
        const cutIndex = slices.slice(0, -1).findIndex((slice) => Math.abs(slice.endSeconds - timeSeconds) <= markerThreshold)
        if (cutIndex >= 0) {
          dragStateRef.current = { kind: 'cut', index: cutIndex }
          onSelectSlice(slices[cutIndex].id)
        } else if (addingSlice) {
          onAddSlice(timeSeconds)
          return
        } else {
          const matchingSlice = slices.find((slice) => timeSeconds >= slice.startSeconds && timeSeconds <= slice.endSeconds)
          if (matchingSlice) onSelectSlice(matchingSlice.id)
          if (Math.abs(timeSeconds - region.startSeconds) <= markerThreshold) dragStateRef.current = { kind: 'start' }
          else if (Math.abs(timeSeconds - region.endSeconds) <= markerThreshold) dragStateRef.current = { kind: 'end' }
          else return
        }
        canvas.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => updateFromPointer(event.clientX)}
      onPointerUp={() => { dragStateRef.current = null }}
      onPointerCancel={() => { dragStateRef.current = null }}
    />
  )
}
