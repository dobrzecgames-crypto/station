import { createUserSynthPreset, isUserSynthPreset } from './userSynthPresetCore.ts'
import type { UserSynthPreset, UserSynthPresetKind, UserSynthPresetPatchMap } from './userSynthPresetCore'

const databaseName = 'station-user-synth-presets'
const databaseVersion = 1
const presetStoreName = 'presets'

export class UserSynthPresetRepository {
  private databasePromise: Promise<IDBDatabase> | null = null

  async list<K extends UserSynthPresetKind>(kind: K): Promise<UserSynthPreset<K>[]> {
    const database = await this.openDatabase()
    const values = await requestResult<unknown[]>(database.transaction(presetStoreName, 'readonly').objectStore(presetStoreName).getAll())
    return values
      .filter((value): value is UserSynthPreset<K> => isUserSynthPreset(value) && value.kind === kind)
      .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt) || left.name.localeCompare(right.name))
  }

  async save<K extends UserSynthPresetKind>(kind: K, name: string, patch: UserSynthPresetPatchMap[K], replaceId?: string): Promise<UserSynthPreset<K>> {
    const existing = replaceId ? (await this.list(kind)).find((preset) => preset.id === replaceId) : undefined
    const now = new Date().toISOString()
    const preset = createUserSynthPreset({
      id: existing?.id ?? createPresetId(),
      kind,
      name,
      patch,
      now,
      createdAt: existing?.createdAt,
    })
    const database = await this.openDatabase()
    const transaction = database.transaction(presetStoreName, 'readwrite')
    transaction.objectStore(presetStoreName).put(preset)
    await transactionComplete(transaction)
    return preset
  }

  async delete(presetId: string): Promise<void> {
    const database = await this.openDatabase()
    const transaction = database.transaction(presetStoreName, 'readwrite')
    transaction.objectStore(presetStoreName).delete(presetId)
    await transactionComplete(transaction)
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(presetStoreName)) database.createObjectStore(presetStoreName, { keyPath: 'id' })
      }
      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => { database.close(); this.databasePromise = null }
        resolve(database)
      }
      request.onerror = () => { this.databasePromise = null; reject(request.error ?? new Error('Preset library could not be opened.')) }
      request.onblocked = () => { this.databasePromise = null; reject(new Error('Preset library upgrade is blocked by another Station tab.')) }
    })
    return this.databasePromise
  }
}

export const userSynthPresetRepository = new UserSynthPresetRepository()

function createPresetId(): string {
  if (typeof crypto.randomUUID === 'function') return `synth-preset-${crypto.randomUUID()}`
  const words = crypto.getRandomValues(new Uint32Array(4))
  return `synth-preset-${Array.from(words, (word) => word.toString(16).padStart(8, '0')).join('')}`
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Preset library request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Preset library transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Preset library transaction was cancelled.'))
  })
}
