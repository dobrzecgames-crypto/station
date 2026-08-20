export type OptionalAudioSubsystemStatus = 'idle' | 'initializing' | 'ready' | 'unavailable'

export interface OptionalAudioSubsystemDiagnostics {
  label: string
  status: OptionalAudioSubsystemStatus
  error: string | null
}

/** Isolates an optional audio capability from core AudioEngine startup. A
 * rejected load is recorded and resolves false; a later explicit retry may
 * recover instead of inheriting a cached rejected promise. */
export class OptionalAudioSubsystem {
  private readonly label: string
  private status: OptionalAudioSubsystemStatus = 'idle'
  private error: string | null = null
  private pending: Promise<boolean> | null = null
  private generation = 0

  constructor(label: string) {
    this.label = label
  }

  initialize(load: () => Promise<void>): Promise<boolean> {
    if (this.status === 'ready') return Promise.resolve(true)
    if (this.pending) return this.pending

    this.status = 'initializing'
    this.error = null
    const generation = this.generation
    const pending = Promise.resolve()
      .then(load)
      .then(() => {
        if (generation !== this.generation) return false
        this.status = 'ready'
        return true
      })
      .catch((error: unknown) => {
        if (generation !== this.generation) return false
        this.status = 'unavailable'
        this.error = error instanceof Error ? error.message : String(error)
        return false
      })
      .finally(() => { if (this.pending === pending) this.pending = null })
    this.pending = pending
    return pending
  }

  getDiagnostics(): OptionalAudioSubsystemDiagnostics {
    return { label: this.label, status: this.status, error: this.error }
  }

  reset(): void {
    this.generation += 1
    this.pending = null
    this.status = 'idle'
    this.error = null
  }
}
