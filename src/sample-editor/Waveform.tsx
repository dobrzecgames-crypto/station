import { useEffect, useRef } from 'react'
import type { SamplePlaybackRegion } from '../pads/types'

interface WaveformProps {
  peaks: readonly number[]
  durationSeconds: number
  region: SamplePlaybackRegion
  onRegionChange: (region: SamplePlaybackRegion) => void
}

type DragHandle = 'start' | 'end' | null

export function Waveform({ peaks, durationSeconds, region, onRegionChange }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragHandleRef = useRef<DragHandle>(null)

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
    }

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)
    draw()
    return () => resizeObserver.disconnect()
  }, [durationSeconds, peaks, region])

  const updateFromPointer = (clientX: number) => {
    const canvas = canvasRef.current
    const dragHandle = dragHandleRef.current
    if (!canvas || !dragHandle) return
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const position = ratio * durationSeconds
    const minimumLength = Math.min(0.01, durationSeconds)

    if (dragHandle === 'start') {
      onRegionChange({ startSeconds: Math.min(position, region.endSeconds - minimumLength), endSeconds: region.endSeconds })
    } else {
      onRegionChange({ startSeconds: region.startSeconds, endSeconds: Math.max(position, region.startSeconds + minimumLength) })
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="waveform"
      role="img"
      aria-label="Sample waveform with draggable start and end handles"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const position = (event.clientX - rect.left) / rect.width * durationSeconds
        dragHandleRef.current = Math.abs(position - region.startSeconds) <= Math.abs(position - region.endSeconds) ? 'start' : 'end'
        event.currentTarget.setPointerCapture(event.pointerId)
        updateFromPointer(event.clientX)
      }}
      onPointerMove={(event) => updateFromPointer(event.clientX)}
      onPointerUp={() => { dragHandleRef.current = null }}
      onPointerCancel={() => { dragHandleRef.current = null }}
    />
  )
}
