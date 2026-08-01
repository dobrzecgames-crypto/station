import type { ProjectKey } from '../../music/scales.ts'
import type { TuneGravityParameters } from './correctionPlan.ts'

export const tuneGravityBenchmarkFormatVersion = 1 as const

export interface TuneGravityBenchmarkTimings {
  yinMs: number | null
  mpmMs: number | null
  tdPsolaMs: number | null
  granularMs: number | null
  totalMs: number | null
}

export interface TuneGravityBenchmarkDocument {
  format: 'station-tune-gravity-quality-benchmark'
  version: typeof tuneGravityBenchmarkFormatVersion
  createdAt: string
  browser: {
    label: string
    userAgent: string
  }
  source: {
    anonymousId: string
    sampleRate: number
    durationSeconds: number
    sampleCount: number
  }
  settings: {
    projectKey: ProjectKey
    gravity: number
    speed: number
    humanize: number
  }
  timings: TuneGravityBenchmarkTimings
  processingToAudioRatio: number | null
  memory: {
    estimatedWorkingSetBytes: number
    measuredHeapBeforeBytes: number | null
    measuredHeapAfterBytes: number | null
  }
  lifecycle: {
    backgroundedDuringRun: boolean
    interrupted: boolean
    error: string | null
  }
}

export interface CreateTuneGravityBenchmarkOptions {
  anonymousSourceId: string
  sampleRate: number
  durationSeconds: number
  sampleCount: number
  projectKey: ProjectKey
  parameters: Pick<TuneGravityParameters, 'gravity' | 'speed' | 'humanize'>
  timings: TuneGravityBenchmarkTimings
  browserLabel: string
  userAgent: string
  backgroundedDuringRun: boolean
  interrupted?: boolean
  error?: string | null
  measuredHeapBeforeBytes?: number | null
  measuredHeapAfterBytes?: number | null
  createdAt?: string
}

export function createTuneGravityBenchmarkDocument(options: CreateTuneGravityBenchmarkOptions): TuneGravityBenchmarkDocument {
  validateTiming(options.timings.yinMs)
  validateTiming(options.timings.mpmMs)
  validateTiming(options.timings.tdPsolaMs)
  validateTiming(options.timings.granularMs)
  validateTiming(options.timings.totalMs)
  const estimatedWorkingSetBytes = options.sampleCount * (4 * 5 + 8 * 2)
  return {
    format: 'station-tune-gravity-quality-benchmark',
    version: tuneGravityBenchmarkFormatVersion,
    createdAt: options.createdAt ?? new Date().toISOString(),
    browser: { label: options.browserLabel, userAgent: options.userAgent },
    source: {
      anonymousId: options.anonymousSourceId,
      sampleRate: options.sampleRate,
      durationSeconds: options.durationSeconds,
      sampleCount: options.sampleCount,
    },
    settings: {
      projectKey: { ...options.projectKey },
      gravity: options.parameters.gravity,
      speed: options.parameters.speed,
      humanize: options.parameters.humanize,
    },
    timings: { ...options.timings },
    processingToAudioRatio: options.timings.totalMs === null || options.durationSeconds <= 0
      ? null
      : options.timings.totalMs / 1000 / options.durationSeconds,
    memory: {
      estimatedWorkingSetBytes,
      measuredHeapBeforeBytes: options.measuredHeapBeforeBytes ?? null,
      measuredHeapAfterBytes: options.measuredHeapAfterBytes ?? null,
    },
    lifecycle: {
      backgroundedDuringRun: options.backgroundedDuringRun,
      interrupted: options.interrupted ?? (options.error !== undefined && options.error !== null),
      error: options.error ?? null,
    },
  }
}

export function detectTuneGravityBrowserLabel(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'Microsoft Edge'
  if (/CriOS\//.test(userAgent)) return 'Chrome on iOS'
  if (/Chrome\//.test(userAgent)) return /Android/.test(userAgent) ? 'Chrome on Android' : 'Google Chrome'
  if (/FxiOS\//.test(userAgent)) return 'Firefox on iOS'
  if (/Firefox\//.test(userAgent)) return 'Mozilla Firefox'
  if (/Safari\//.test(userAgent) && /Mobile\//.test(userAgent)) return 'Safari on iOS'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return 'Unknown browser'
}

function validateTiming(value: number | null): void {
  if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('Tune Gravity benchmark timings must be non-negative finite numbers or null.')
}
