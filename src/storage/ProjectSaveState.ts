export type ProjectSaveStatus = 'saved' | 'saving' | 'dirty' | 'error'

export interface ProjectSaveSnapshot {
  status: ProjectSaveStatus
  dirty: boolean
  revision: number
  savedRevision: number
  queueDepth: number
  error: string | null
}

export interface ProjectSaveAttempt {
  readonly id: number
  readonly generation: number
  readonly revision: number
}

/** Tracks save completion against edit revisions so an older queued write can
 * never make a newer edit appear saved. The write queue itself remains owned
 * by App; this class contains no browser or React behavior. */
export class ProjectSaveStateTracker {
  private generation = 0
  private revision = 0
  private savedRevision = 0
  private attemptSerial = 0
  private readonly activeAttempts = new Map<number, ProjectSaveAttempt>()
  private error: string | null = null

  constructor(saved = true) {
    if (!saved) this.revision = 1
  }

  markDirty(): ProjectSaveSnapshot {
    this.revision += 1
    return this.getSnapshot()
  }

  beginSave(): ProjectSaveAttempt {
    const attempt = { id: ++this.attemptSerial, generation: this.generation, revision: this.revision }
    this.activeAttempts.set(attempt.id, attempt)
    this.error = null
    return attempt
  }

  succeed(attempt: ProjectSaveAttempt): ProjectSaveSnapshot {
    if (!this.finish(attempt)) return this.getSnapshot()
    this.savedRevision = Math.max(this.savedRevision, attempt.revision)
    return this.getSnapshot()
  }

  fail(attempt: ProjectSaveAttempt, error: unknown): ProjectSaveSnapshot {
    if (!this.finish(attempt)) return this.getSnapshot()
    if (attempt.revision === this.revision) this.error = toErrorMessage(error)
    return this.getSnapshot()
  }

  recordFailure(error: unknown): ProjectSaveSnapshot {
    this.error = toErrorMessage(error)
    return this.getSnapshot()
  }

  reset(saved: boolean): ProjectSaveSnapshot {
    this.generation += 1
    this.revision = saved ? 0 : 1
    this.savedRevision = 0
    this.activeAttempts.clear()
    this.error = null
    return this.getSnapshot()
  }

  getSnapshot(): ProjectSaveSnapshot {
    const dirty = this.savedRevision < this.revision
    const savingCurrentRevision = [...this.activeAttempts.values()].some((attempt) => attempt.revision === this.revision)
    const status: ProjectSaveStatus = this.error
      ? 'error'
      : savingCurrentRevision
        ? 'saving'
        : !dirty
          ? 'saved'
          : 'dirty'
    return {
      status,
      dirty,
      revision: this.revision,
      savedRevision: this.savedRevision,
      queueDepth: this.activeAttempts.size,
      error: this.error,
    }
  }

  private finish(attempt: ProjectSaveAttempt): boolean {
    if (attempt.generation !== this.generation || !this.activeAttempts.has(attempt.id)) return false
    this.activeAttempts.delete(attempt.id)
    return true
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
