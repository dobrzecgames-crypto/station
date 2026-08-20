import { StationStorageError, toStationStorageError } from './storageErrors.ts'

const databaseName = 'station-projects'
const databaseVersion = 1

export const projectStoreName = 'projects'
export const assetStoreName = 'assets'
export const metadataStoreName = 'metadata'

let databasePromise: Promise<IDBDatabase> | undefined
let activeDatabase: IDBDatabase | undefined
let connectionState: StationDatabaseConnectionState = 'closed'
let connectionError: string | null = null

export type StationDatabaseConnectionState = 'closed' | 'opening' | 'open' | 'blocked' | 'error' | 'unavailable'

export interface StationDatabaseDiagnostics {
  state: StationDatabaseConnectionState
  error: string | null
}

export function openStationDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) {
    connectionState = 'unavailable'
    connectionError = 'Project storage is unavailable in this browser.'
    return Promise.reject(new StationStorageError('unavailable', connectionError))
  }
  if (databasePromise) return databasePromise

  connectionState = 'opening'
  connectionError = null
  let settled = false
  const attempt = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(projectStoreName)) database.createObjectStore(projectStoreName, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(assetStoreName)) database.createObjectStore(assetStoreName, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(metadataStoreName)) database.createObjectStore(metadataStoreName, { keyPath: 'key' })
    }
    request.onsuccess = () => {
      const database = request.result
      if (settled || databasePromise !== attempt) {
        database.close()
        return
      }
      settled = true
      activeDatabase = database
      connectionState = 'open'
      connectionError = null
      database.onversionchange = () => releaseDatabase(database, attempt)
      database.onclose = () => releaseDatabase(database, attempt)
      resolve(database)
    }
    request.onerror = () => {
      if (settled) return
      settled = true
      const error = toStationStorageError('Could not open project storage.', request.error)
      releaseFailedAttempt(attempt, 'error', error.message)
      reject(error)
    }
    request.onblocked = () => {
      if (settled) return
      settled = true
      const error = new StationStorageError('blocked', 'Project storage is blocked by another open Station tab.')
      releaseFailedAttempt(attempt, 'blocked', error.message)
      reject(error)
    }
  })
  databasePromise = attempt
  return attempt
}

export function closeStationDatabase(): void {
  const database = activeDatabase
  activeDatabase = undefined
  databasePromise = undefined
  connectionState = 'closed'
  connectionError = null
  database?.close()
}

export function getStationDatabaseDiagnostics(): StationDatabaseDiagnostics {
  return { state: connectionState, error: connectionError }
}

export function requestResult<T>(request: IDBRequest<T>, failureMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(toStationStorageError(failureMessage, request.error))
  })
}

export function transactionComplete(transaction: IDBTransaction, failureMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(toStationStorageError(failureMessage, transaction.error))
    transaction.onabort = () => reject(toStationStorageError(failureMessage, transaction.error))
  })
}

function releaseFailedAttempt(attempt: Promise<IDBDatabase>, state: 'blocked' | 'error', message: string): void {
  if (databasePromise === attempt) databasePromise = undefined
  connectionState = state
  connectionError = message
}

function releaseDatabase(database: IDBDatabase, attempt: Promise<IDBDatabase>): void {
  database.close()
  if (activeDatabase === database) activeDatabase = undefined
  if (databasePromise === attempt) databasePromise = undefined
  connectionState = 'closed'
  connectionError = null
}
