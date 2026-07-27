import { useEffect, useRef } from 'react'
import type { AudioEngine, ChannelId } from '../audio/AudioEngine'

const minimumDbfs = -60
const frameIntervalMs = 1000 / 30
const peakHoldMs = 900
const meterFallDbPerSecond = 36
const peakFallDbPerSecond = 18

interface ChannelMeterProps {
  audioEngine: AudioEngine
  channelId: ChannelId
  label: string
}

function clampDbfs(value: number): number {
  if (!Number.isFinite(value)) return minimumDbfs
  return Math.min(0, Math.max(minimumDbfs, value))
}

function toPercent(dbfs: number): string {
  return `${((clampDbfs(dbfs) - minimumDbfs) / -minimumDbfs) * 100}%`
}

/**
 * The browser animation here only paints the most recently measured engine
 * signal. It is never a clock for the audio engine or sequencer.
 */
export function ChannelMeter({ audioEngine, channelId, label }: ChannelMeterProps) {
  const meterRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const peakRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let animationFrame = 0
    let lastPaintAt = 0
    let displayedDbfs = minimumDbfs
    let peakDbfs = minimumDbfs
    let peakHeldUntil = 0

    const paint = (now: number) => {
      if (now - lastPaintAt >= frameIntervalMs) {
        const elapsedSeconds = lastPaintAt ? (now - lastPaintAt) / 1000 : 0
        lastPaintAt = now
        const sourceDbfs = clampDbfs(audioEngine.getChannelMeterReading(channelId).dbfs)
        displayedDbfs = sourceDbfs >= displayedDbfs
          ? sourceDbfs
          : Math.max(sourceDbfs, displayedDbfs - meterFallDbPerSecond * elapsedSeconds)

        if (sourceDbfs >= peakDbfs) {
          peakDbfs = sourceDbfs
          peakHeldUntil = now + peakHoldMs
        } else if (now > peakHeldUntil) {
          peakDbfs = Math.max(displayedDbfs, peakDbfs - peakFallDbPerSecond * elapsedSeconds)
        }

        const active = displayedDbfs > minimumDbfs + 3
        const roundedDbfs = Math.round(displayedDbfs)
        const meter = meterRef.current
        if (meter) {
          meter.dataset.active = active ? 'true' : 'false'
          meter.setAttribute('aria-valuenow', String(roundedDbfs))
          meter.setAttribute('aria-valuetext', active ? `${roundedDbfs} dBFS` : 'Silence')
        }
        if (fillRef.current) fillRef.current.style.height = toPercent(displayedDbfs)
        if (peakRef.current) {
          peakRef.current.style.bottom = toPercent(peakDbfs)
          /* A peak marker resting on the floor is not a reading, it is a bright
             line drawn across a silent channel - and with sixteen of them it
             read as damage to the rail rather than as a scale. It appears when
             there is something to mark. */
          peakRef.current.style.opacity = peakDbfs > minimumDbfs ? '1' : '0'
        }
      }
      animationFrame = window.requestAnimationFrame(paint)
    }

    animationFrame = window.requestAnimationFrame(paint)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [audioEngine, channelId])

  return (
    <div
      ref={meterRef}
      className="channel-meter"
      role="meter"
      aria-label={`${label} signal level`}
      aria-valuemin={minimumDbfs}
      aria-valuemax={0}
      aria-valuenow={minimumDbfs}
      aria-valuetext="Silence"
    >
      <span className="channel-meter-track" aria-hidden="true">
        <span ref={fillRef} className="channel-meter-fill" />
        <span ref={peakRef} className="channel-meter-peak" />
        {/* Every 12 dB, so the marks are evenly spaced down the rail and the
            bottom edge is the −60 dB floor. The scale used to skip −36, which
            left one gap twice as wide as the others and read as a slipped
            ruler rather than a scale. */}
        <span className="channel-meter-tick channel-meter-tick-zero" />
        <span className="channel-meter-tick channel-meter-tick-minus-12" />
        <span className="channel-meter-tick channel-meter-tick-minus-24" />
        <span className="channel-meter-tick channel-meter-tick-minus-36" />
        <span className="channel-meter-tick channel-meter-tick-minus-48" />
      </span>
    </div>
  )
}
