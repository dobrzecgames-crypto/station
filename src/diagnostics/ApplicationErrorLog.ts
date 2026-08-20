export type ApplicationErrorSource = 'react' | 'window-error' | 'unhandled-rejection'

export interface ApplicationErrorEntry {
  readonly timestamp: string
  readonly source: ApplicationErrorSource
  readonly name: string
  readonly message: string
  readonly stack: string | null
}

interface NormalizedError {
  readonly name: string
  readonly message: string
  readonly stack: string | null
}

export class ApplicationErrorLog {
  private readonly entries: ApplicationErrorEntry[] = []
  private readonly maximumEntries: number
  private readonly now: () => Date

  constructor(
    maximumEntries = 20,
    now: () => Date = () => new Date(),
  ) {
    this.maximumEntries = maximumEntries
    this.now = now
  }

  record(source: ApplicationErrorSource, value: unknown): ApplicationErrorEntry {
    const normalized = normalizeError(value)
    const entry: ApplicationErrorEntry = {
      timestamp: this.now().toISOString(),
      source,
      ...normalized,
    }
    this.entries.push(entry)
    const overflow = this.entries.length - Math.max(1, this.maximumEntries)
    if (overflow > 0) this.entries.splice(0, overflow)
    return entry
  }

  getEntries(): readonly ApplicationErrorEntry[] {
    return this.entries.map((entry) => ({ ...entry }))
  }
}

export const applicationErrorLog = new ApplicationErrorLog()

export function installGlobalErrorHandlers(
  target: Window,
  log: ApplicationErrorLog = applicationErrorLog,
): () => void {
  const onError = (event: ErrorEvent) => {
    log.record('window-error', event.error ?? event.message)
  }
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    log.record('unhandled-rejection', event.reason)
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onUnhandledRejection)

  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}

export function formatApplicationErrorReport(
  entries: readonly ApplicationErrorEntry[],
  componentStack?: string,
): string {
  const lines = ['STATION LOCAL ERROR REPORT']
  if (entries.length === 0) lines.push('', 'No error entry was captured.')

  entries.forEach((entry, index) => {
    lines.push(
      '',
      `ERROR ${index + 1}`,
      `TIME: ${entry.timestamp}`,
      `SOURCE: ${entry.source}`,
      `TYPE: ${entry.name}`,
      `MESSAGE: ${entry.message}`,
    )
    if (entry.stack) lines.push('STACK:', entry.stack)
  })

  if (componentStack?.trim()) lines.push('', 'REACT COMPONENT STACK:', componentStack.trim())
  return lines.join('\n')
}

function normalizeError(value: unknown): NormalizedError {
  if (value instanceof Error) {
    return {
      name: value.name || 'Error',
      message: value.message || 'No error message was provided.',
      stack: value.stack ?? null,
    }
  }
  if (typeof value === 'string') return { name: 'Error', message: value, stack: null }

  let message = 'Unknown error value.'
  try {
    const serialized = JSON.stringify(value)
    if (serialized) message = serialized
  } catch {
    message = String(value)
  }
  return { name: 'NonErrorRejection', message, stack: null }
}
