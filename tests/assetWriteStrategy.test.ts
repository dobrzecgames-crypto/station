import assert from 'node:assert/strict'
import test from 'node:test'
import { writeMissingRuntimeAssets } from '../src/storage/assetWriteStrategy.ts'

interface FakeRequest<T> {
  result: T
  error: DOMException | null
  onsuccess: (() => void) | null
  onerror: (() => void) | null
}

function completedRequest<T>(result: T): IDBRequest<T> {
  const request: FakeRequest<T> = { result, error: null, onsuccess: null, onerror: null }
  queueMicrotask(() => request.onsuccess?.())
  return request as unknown as IDBRequest<T>
}

function fakeStore(existing: readonly string[]) {
  const keys = new Set(existing)
  const writes: unknown[] = []
  return {
    writes,
    store: {
      getKey: (id: IDBValidKey) => completedRequest<IDBValidKey | undefined>(keys.has(String(id)) ? id : undefined),
      put: (value: unknown) => {
        writes.push(value)
        return completedRequest<IDBValidKey>((value as { id: string }).id)
      },
    } as Pick<IDBObjectStore, 'getKey' | 'put'>,
  }
}

test('a manifest-only autosave does not rewrite existing WAV blobs', async () => {
  const target = fakeStore(['kick', 'snare'])
  const runtimeAssets = new Map([
    ['kick', { filename: 'kick.wav', blob: new Blob(['large kick data'], { type: 'audio/wav' }) }],
    ['snare', { filename: 'snare.wav', blob: new Blob(['large snare data'], { type: 'audio/wav' }) }],
  ])

  const writeCount = await writeMissingRuntimeAssets(target.store, ['kick', 'snare'], runtimeAssets)

  assert.equal(writeCount, 0)
  assert.deepEqual(target.writes, [])
})

test('only a newly introduced stable asset ID writes its WAV blob', async () => {
  const target = fakeStore(['kick'])
  const runtimeAssets = new Map([
    ['kick', { filename: 'kick.wav', blob: new Blob(['kick'], { type: 'audio/wav' }) }],
    ['hat', { filename: 'hat.wav', blob: new Blob(['hat'], { type: 'audio/wav' }) }],
  ])

  const writeCount = await writeMissingRuntimeAssets(target.store, ['kick', 'hat'], runtimeAssets)

  assert.equal(writeCount, 1)
  assert.deepEqual(target.writes, [{
    id: 'hat',
    filename: 'hat.wav',
    mimeType: 'audio/wav',
    size: 3,
    blob: runtimeAssets.get('hat')!.blob,
  }])
})
