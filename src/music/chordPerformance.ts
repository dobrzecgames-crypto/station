import type { ChordVoice } from './chords'

export interface ChordPerformanceSettings {
  strum: number
  dynamics: number
  humanize: number
}

export interface PerformedChordVoice extends ChordVoice {
  delaySeconds: number
  performanceVelocity: number
}

export const defaultChordPerformance: Readonly<ChordPerformanceSettings> = {
  strum: 5,
  dynamics: 65,
  humanize: 8,
}

export const maximumStrumSweepSeconds = 0.072
export const maximumHumanTimingSeconds = 0.004
export const maximumHumanVelocityVariation = 0.04

export function normalizeChordPerformance(value: unknown): ChordPerformanceSettings {
  if (!value || typeof value !== 'object') return { ...defaultChordPerformance }
  const candidate = value as Partial<ChordPerformanceSettings>
  return {
    strum: candidate.strum === undefined ? defaultChordPerformance.strum : candidate.strum,
    dynamics: candidate.dynamics === undefined ? defaultChordPerformance.dynamics : candidate.dynamics,
    humanize: candidate.humanize === undefined ? defaultChordPerformance.humanize : candidate.humanize,
  }
}

export function clampChordPerformance(value: ChordPerformanceSettings): ChordPerformanceSettings {
  return {
    strum: clampAmount(value.strum, defaultChordPerformance.strum),
    dynamics: clampAmount(value.dynamics, defaultChordPerformance.dynamics),
    humanize: clampAmount(value.humanize, defaultChordPerformance.humanize),
  }
}

export function performChordVoices(
  voices: readonly ChordVoice[],
  settings: ChordPerformanceSettings,
  occurrence: number,
  eventDurationSeconds?: number,
): PerformedChordVoice[] {
  const normalized = clampChordPerformance(settings)
  const dynamics = normalized.dynamics / 100
  const humanize = normalized.humanize / 100
  const ordered = [...voices].sort((left, right) => left.midiNote - right.midiNote || left.interval - right.interval)
  const requestedSweep = maximumStrumSweepSeconds * (normalized.strum / 100) ** 1.2
  const durationLimit = Number.isFinite(eventDurationSeconds) ? Math.max(0, eventDurationSeconds!) * 0.35 : maximumStrumSweepSeconds
  const sweep = Math.min(maximumStrumSweepSeconds, requestedSweep, durationLimit)
  const gap = ordered.length > 1 ? sweep / (ordered.length - 1) : 0
  const timingRange = maximumHumanTimingSeconds * humanize
  const preserveStrumOrder = gap >= timingRange * 2

  let previousDelay = 0
  return ordered.map((voice, index) => {
    const strumDelay = gap * index
    const timingVariation = signedVariation(occurrence, index, 1) * timingRange
    let delaySeconds = clamp(strumDelay + timingVariation, 0, maximumStrumSweepSeconds + maximumHumanTimingSeconds)
    if (preserveStrumOrder) delaySeconds = Math.max(previousDelay, delaySeconds)
    previousDelay = delaySeconds

    const harmonicWeight = 1 + (voice.harmonicVelocity - 1) * dynamics
    const humanVelocity = 1 + signedVariation(occurrence, index, 2) * maximumHumanVelocityVariation * humanize
    return {
      ...voice,
      delaySeconds: round(delaySeconds, 6),
      performanceVelocity: round(clamp(harmonicWeight * humanVelocity, 0.55, 1), 4),
    }
  })
}

export function isPendingChordVoice(startsAt: number, releaseAt: number): boolean {
  return startsAt >= releaseAt
}

function clampAmount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(clamp(value, 0, 100)) : fallback
}

function signedVariation(occurrence: number, voiceIndex: number, lane: number): number {
  let value = (Math.trunc(occurrence) + 1) ^ Math.imul(voiceIndex + 11, 0x9e3779b1) ^ Math.imul(lane + 17, 0x85ebca6b)
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  value = (value ^ (value >>> 16)) >>> 0
  return value / 0xffffffff * 2 - 1
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals))
}
