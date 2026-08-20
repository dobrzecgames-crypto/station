import assert from 'node:assert/strict'
import test from 'node:test'
import { BrowserStorageMonitor } from '../src/storage/BrowserStorageMonitor.ts'
import { transactionComplete } from '../src/storage/StationDatabase.ts'
import { isQuotaExceededError, StationStorageError, toStationStorageError } from '../src/storage/storageErrors.ts'

test('quota errors remain distinctly classifiable through nested causes', () => {
  const quota = new DOMException('disk full', 'QuotaExceededError')
  const wrapped = new Error('transaction aborted', { cause: quota })

  assert.equal(isQuotaExceededError(wrapped), true)
  const classified = toStationStorageError('save failed', wrapped)
  assert.equal(classified.code, 'quota')
  assert.equal(classified.name, 'QuotaExceededError')
  assert.match(classified.message, /save was not committed/)
})

test('transaction abort preserves quota classification instead of generic failure', async () => {
  const transaction = {
    error: new DOMException('capacity reached', 'QuotaExceededError'),
    oncomplete: null,
    onerror: null,
    onabort: null,
  } as unknown as IDBTransaction
  const completion = transactionComplete(transaction, 'Project save did not complete.')
  transaction.onabort?.(new Event('abort'))

  await assert.rejects(completion, (error: unknown) => error instanceof StationStorageError && error.code === 'quota')
})

test('storage diagnostics report pressure and request persistence only once', async () => {
  let persistenceRequests = 0
  const storage = {
    estimate: async () => ({ usage: 250, quota: 1000 }),
    persisted: async () => true,
    persist: async () => { persistenceRequests += 1; return true },
  } as StorageManager
  const monitor = new BrowserStorageMonitor(() => storage)

  const first = await monitor.requestPersistenceAfterExplicitSave()
  const second = await monitor.requestPersistenceAfterExplicitSave()

  assert.equal(persistenceRequests, 1)
  assert.deepEqual(first, {
    state: 'ready',
    usageBytes: 250,
    quotaBytes: 1000,
    usageRatio: 0.25,
    persisted: true,
    persistenceRequested: true,
    persistenceGranted: true,
    error: null,
  })
  assert.deepEqual(second, first)
})

test('unsupported browser storage APIs degrade to unavailable diagnostics', async () => {
  const monitor = new BrowserStorageMonitor(() => undefined)
  assert.equal((await monitor.refresh()).state, 'unavailable')
})
