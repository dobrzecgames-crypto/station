export type BrowserStorageMonitorState = 'idle' | 'ready' | 'unavailable' | 'error'

export interface BrowserStorageDiagnostics {
  state: BrowserStorageMonitorState
  usageBytes: number | null
  quotaBytes: number | null
  usageRatio: number | null
  persisted: boolean | null
  persistenceRequested: boolean
  persistenceGranted: boolean | null
  error: string | null
}

type StorageProvider = () => StorageManager | undefined

export class BrowserStorageMonitor {
  private readonly storageProvider: StorageProvider
  private diagnostics: BrowserStorageDiagnostics = emptyDiagnostics()
  private persistenceRequestMade = false

  constructor(storageProvider: StorageProvider = defaultStorageProvider) {
    this.storageProvider = storageProvider
  }

  async refresh(): Promise<BrowserStorageDiagnostics> {
    const storage = this.storageProvider()
    if (!storage || typeof storage.estimate !== 'function') {
      this.diagnostics = { ...this.diagnostics, state: 'unavailable', error: null }
      return this.getDiagnostics()
    }
    try {
      const estimate = await storage.estimate()
      const usageBytes = finiteNumber(estimate.usage)
      const quotaBytes = finiteNumber(estimate.quota)
      const persisted = typeof storage.persisted === 'function' ? await storage.persisted() : null
      this.diagnostics = {
        ...this.diagnostics,
        state: 'ready',
        usageBytes,
        quotaBytes,
        usageRatio: usageBytes !== null && quotaBytes !== null && quotaBytes > 0 ? usageBytes / quotaBytes : null,
        persisted,
        error: null,
      }
    } catch (error) {
      this.diagnostics = { ...this.diagnostics, state: 'error', error: error instanceof Error ? error.message : String(error) }
    }
    return this.getDiagnostics()
  }

  async requestPersistenceAfterExplicitSave(): Promise<BrowserStorageDiagnostics> {
    const storage = this.storageProvider()
    if (!this.persistenceRequestMade) {
      this.persistenceRequestMade = true
      this.diagnostics = { ...this.diagnostics, persistenceRequested: true }
      if (storage && typeof storage.persist === 'function') {
        try {
          const granted = await storage.persist()
          this.diagnostics = { ...this.diagnostics, persistenceGranted: granted, error: null }
        } catch (error) {
          this.diagnostics = { ...this.diagnostics, state: 'error', error: error instanceof Error ? error.message : String(error) }
          return this.getDiagnostics()
        }
      }
    }
    return this.refresh()
  }

  getDiagnostics(): BrowserStorageDiagnostics {
    return { ...this.diagnostics }
  }
}

export const browserStorageMonitor = new BrowserStorageMonitor()

function defaultStorageProvider(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

function emptyDiagnostics(): BrowserStorageDiagnostics {
  return {
    state: 'idle',
    usageBytes: null,
    quotaBytes: null,
    usageRatio: null,
    persisted: null,
    persistenceRequested: false,
    persistenceGranted: null,
    error: null,
  }
}

function finiteNumber(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
