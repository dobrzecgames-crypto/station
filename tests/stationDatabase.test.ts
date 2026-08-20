import assert from 'node:assert/strict'
import test from 'node:test'
import { closeStationDatabase, getStationDatabaseDiagnostics, openStationDatabase } from '../src/storage/StationDatabase.ts'

interface FakeOpenRequest {
  result: FakeDatabase
  error: DOMException | null
  onupgradeneeded: (() => void) | null
  onsuccess: (() => void) | null
  onerror: (() => void) | null
  onblocked: (() => void) | null
}

class FakeDatabase {
  closeCount = 0
  onversionchange: (() => void) | null = null
  onclose: (() => void) | null = null
  readonly objectStoreNames = { contains: () => true }

  createObjectStore(): void {}
  close(): void { this.closeCount += 1 }
}

function installFakeIndexedDb() {
  const requests: FakeOpenRequest[] = []
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      indexedDB: {
        open: () => {
          const request: FakeOpenRequest = {
            result: new FakeDatabase(),
            error: null,
            onupgradeneeded: null,
            onsuccess: null,
            onerror: null,
            onblocked: null,
          }
          requests.push(request)
          return request
        },
      },
    },
  })
  return {
    requests,
    restore: () => {
      closeStationDatabase()
      if (originalWindow === undefined) delete (globalThis as { window?: Window }).window
      else Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
    },
  }
}

test('a failed database open does not poison later retries', async () => {
  const fake = installFakeIndexedDb()
  try {
    const first = openStationDatabase()
    fake.requests[0].error = new DOMException('temporary browser failure', 'UnknownError')
    fake.requests[0].onerror?.()

    await assert.rejects(first, /Could not open project storage/)
    assert.equal(getStationDatabaseDiagnostics().state, 'error')

    const retry = openStationDatabase()
    assert.equal(fake.requests.length, 2)
    fake.requests[1].onsuccess?.()

    assert.equal(await retry, fake.requests[1].result)
    assert.equal(getStationDatabaseDiagnostics().state, 'open')
  } finally {
    fake.restore()
  }
})

test('a versionchange closes and releases the obsolete connection', async () => {
  const fake = installFakeIndexedDb()
  try {
    const first = openStationDatabase()
    fake.requests[0].onsuccess?.()
    await first

    fake.requests[0].result.onversionchange?.()
    assert.equal(fake.requests[0].result.closeCount, 1)
    assert.equal(getStationDatabaseDiagnostics().state, 'closed')

    const reopened = openStationDatabase()
    assert.equal(fake.requests.length, 2)
    fake.requests[1].onsuccess?.()
    await reopened
  } finally {
    fake.restore()
  }
})

test('a blocked open rejects, can retry, and closes a late stale success', async () => {
  const fake = installFakeIndexedDb()
  try {
    const blocked = openStationDatabase()
    fake.requests[0].onblocked?.()
    await assert.rejects(blocked, /blocked by another open Station tab/)
    assert.equal(getStationDatabaseDiagnostics().state, 'blocked')

    const retry = openStationDatabase()
    fake.requests[0].onsuccess?.()
    assert.equal(fake.requests[0].result.closeCount, 1)
    fake.requests[1].onsuccess?.()

    assert.equal(await retry, fake.requests[1].result)
    assert.equal(getStationDatabaseDiagnostics().state, 'open')
  } finally {
    fake.restore()
  }
})
