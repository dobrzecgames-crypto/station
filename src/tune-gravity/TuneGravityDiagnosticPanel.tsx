import { useEffect, useRef } from 'react'
import type { TuneGravityDiagnosticDocument } from '../audio/tuneGravity/index.ts'

interface TuneGravityDiagnosticPanelProps {
  samples: Float32Array
  report: TuneGravityDiagnosticDocument
}

export function TuneGravityDiagnosticPanel({ samples, report }: TuneGravityDiagnosticPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const width = Math.max(640, Math.round(canvas.clientWidth * window.devicePixelRatio))
    const height = Math.round(260 * window.devicePixelRatio)
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return
    drawTimeline(context, width, height, samples, report)
  }, [samples, report])

  const problemCounts = new Map<string, number>()
  for (const problem of report.problems) problemCounts.set(problem.kind, (problemCounts.get(problem.kind) ?? 0) + 1)

  return <section className="tune-diagnostic-panel" aria-labelledby="tune-diagnostic-title">
    <header>
      <div>
        <p className="eyebrow">SYNCHRONISED ANALYSIS</p>
        <h3 id="tune-diagnostic-title">DIAGNOSTIC TIMELINE</h3>
      </div>
      <span>{report.frames.length} FRAMES • {report.regions.length} REGIONS</span>
    </header>
    <div className="tune-diagnostic-scroll">
      <canvas ref={canvasRef} role="img" aria-label="Waveform, detected pitch, target note, confidence and diagnostic warnings over time" />
    </div>
    <div className="tune-diagnostic-legend" aria-label="Timeline legend">
      <span className="waveform">WAVEFORM</span><span className="pitch">F0</span><span className="target">TARGET</span><span className="confidence">CONFIDENCE</span><span className="problem">PROBLEM</span>
    </div>
    {problemCounts.size > 0
      ? <ul className="tune-diagnostic-problems">{[...problemCounts].map(([kind, count]) => <li key={kind}><strong>{kind.toUpperCase().replaceAll('-', ' ')}</strong><span>{count}</span></li>)}</ul>
      : <p className="tune-diagnostic-clear">No heuristic warnings in this analysis. This is not proof of clean audio.</p>}
  </section>
}

function drawTimeline(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  samples: Float32Array,
  report: TuneGravityDiagnosticDocument,
): void {
  context.fillStyle = '#101212'
  context.fillRect(0, 0, width, height)
  const top = height * 0.08
  const waveformMid = height * 0.27
  const waveformAmplitude = height * 0.16
  const pitchTop = height * 0.48
  const pitchBottom = height * 0.84
  const confidenceTop = height * 0.9
  const duration = Math.max(0.001, report.source.durationSeconds)

  context.strokeStyle = 'rgba(181, 186, 181, .18)'
  context.lineWidth = Math.max(1, window.devicePixelRatio)
  for (let division = 0; division <= Math.ceil(duration); division += 1) {
    const x = division / duration * width
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }

  context.strokeStyle = '#777f7d'
  context.beginPath()
  for (let x = 0; x < width; x += 1) {
    const start = Math.floor(x / width * samples.length)
    const end = Math.max(start + 1, Math.floor((x + 1) / width * samples.length))
    let peak = 0
    for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(samples[index] ?? 0))
    const y = waveformMid - peak * waveformAmplitude
    if (x === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  for (let x = width - 1; x >= 0; x -= 1) {
    const start = Math.floor(x / width * samples.length)
    const end = Math.max(start + 1, Math.floor((x + 1) / width * samples.length))
    let peak = 0
    for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(samples[index] ?? 0))
    context.lineTo(x, waveformMid + peak * waveformAmplitude)
  }
  context.closePath()
  context.fillStyle = 'rgba(181, 186, 181, .22)'
  context.fill()

  const midiValues = report.frames.flatMap((frame) => [frame.detectedMidi, frame.targetMidi]).filter((value): value is number => value !== null)
  const minimumMidi = midiValues.length === 0 ? 36 : Math.floor(Math.min(...midiValues) - 1)
  const maximumMidi = midiValues.length === 0 ? 84 : Math.ceil(Math.max(...midiValues) + 1)
  const midiToY = (midi: number) => pitchBottom - (midi - minimumMidi) / Math.max(1, maximumMidi - minimumMidi) * (pitchBottom - pitchTop)
  const timeToX = (seconds: number) => seconds / duration * width

  for (const region of report.regions) {
    if (region.kind !== 'unvoiced' && region.kind !== 'uncertain') continue
    context.fillStyle = region.kind === 'unvoiced' ? 'rgba(120, 125, 124, .08)' : 'rgba(215, 214, 155, .08)'
    context.fillRect(timeToX(region.startSeconds), pitchTop, timeToX(region.endSeconds - region.startSeconds), pitchBottom - pitchTop)
  }

  drawFrameLine(context, report, timeToX, midiToY, (frame) => frame.detectedMidi, '#87cdd0')
  drawFrameLine(context, report, timeToX, midiToY, (frame) => frame.targetMidi, '#d7d69b')

  for (const frame of report.frames) {
    const x = timeToX(frame.timestampSeconds)
    context.fillStyle = `rgba(181, 199, 118, ${Math.max(0, Math.min(1, frame.confidence))})`
    context.fillRect(x, confidenceTop, Math.max(1, width / Math.max(1, report.frames.length) + 1), (height - confidenceTop) * frame.confidence)
  }

  context.strokeStyle = '#d07c72'
  context.lineWidth = Math.max(1, window.devicePixelRatio)
  for (const problem of report.problems) {
    const x = timeToX(problem.timestampSeconds)
    context.beginPath()
    context.moveTo(x, top)
    context.lineTo(x, height)
    context.stroke()
  }
}

function drawFrameLine(
  context: CanvasRenderingContext2D,
  report: TuneGravityDiagnosticDocument,
  timeToX: (seconds: number) => number,
  midiToY: (midi: number) => number,
  valueFor: (frame: TuneGravityDiagnosticDocument['frames'][number]) => number | null,
  colour: string,
): void {
  context.strokeStyle = colour
  context.lineWidth = Math.max(1.25, window.devicePixelRatio * 1.25)
  context.beginPath()
  let drawing = false
  for (const frame of report.frames) {
    const value = valueFor(frame)
    if (value === null) {
      drawing = false
      continue
    }
    const x = timeToX(frame.timestampSeconds)
    const y = midiToY(value)
    if (!drawing) context.moveTo(x, y)
    else context.lineTo(x, y)
    drawing = true
  }
  context.stroke()
}
