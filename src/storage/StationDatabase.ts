const databaseName = 'station-projects'
const databaseVersion = 1

export const projectStoreName = 'projects'
export const assetStoreName = 'assets'
export const metadataStoreName = 'metadata'

let databasePromise: Promise<IDBDatabase> | undefined

export function openStationDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) return Promise.reject(new Error('Project storage is unavailable in this browser.'))
  databasePromise ??= new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(projectStoreName)) database.createObjectStore(projectStoreName, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(assetStoreName)) database.createObjectStore(assetStoreName, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(metadataStoreName)) database.createObjectStore(metadataStoreName, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Could not open project storage.'))
    request.onblocked = () => reject(new Error('Project storage is blocked by another open Station tab.'))
  })
  return databasePromise
}

export function requestResult<T>(request: IDBRequest<T>, failureMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error(failureMessage))
  })
}

export function transactionComplete(transaction: IDBTransaction, failureMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(new Error(failureMessage))
    transaction.onabort = () => reject(new Error(failureMessage))
  })
}
