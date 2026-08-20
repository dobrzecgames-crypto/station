export type StationStorageErrorCode = 'quota' | 'blocked' | 'unavailable' | 'operation'

export class StationStorageError extends Error {
  readonly code: StationStorageErrorCode

  constructor(code: StationStorageErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = code === 'quota' ? 'QuotaExceededError' : 'StationStorageError'
    this.code = code
  }
}

export function toStationStorageError(message: string, cause?: unknown): StationStorageError {
  if (cause instanceof StationStorageError) return cause
  if (isQuotaExceededError(cause)) {
    return new StationStorageError(
      'quota',
      'Browser storage quota is full. This save was not committed; existing saved projects remain unchanged.',
      cause,
    )
  }
  const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : ''
  return new StationStorageError('operation', `${message}${detail}`.trim(), cause)
}

export function isQuotaExceededError(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current = error
  while (current && !seen.has(current)) {
    seen.add(current)
    if (current instanceof Error && (current.name === 'QuotaExceededError' || current.name === 'NS_ERROR_DOM_QUOTA_REACHED')) return true
    current = current instanceof Error ? current.cause : undefined
  }
  return false
}
