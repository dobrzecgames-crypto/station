import assert from 'node:assert/strict'
import test from 'node:test'
import { pruneRuntimeMap } from '../src/audio/runtimeLifecycle.ts'

test('project-era runtime maps stay bounded across 100 replacement cycles', () => {
  const resources = new Map<string, { disposed: boolean }>()
  let disposed = 0

  for (let cycle = 0; cycle < 100; cycle += 1) {
    const currentKeys = new Set([`project-${cycle}:group`, `project-${cycle}:track`])
    for (const key of currentKeys) resources.set(key, { disposed: false })
    pruneRuntimeMap(resources, currentKeys, (resource) => {
      assert.equal(resource.disposed, false)
      resource.disposed = true
      disposed += 1
    })
    assert.deepEqual(new Set(resources.keys()), currentKeys)
  }

  assert.equal(resources.size, 2)
  assert.equal(disposed, 198)
})

test('runtime pruning is idempotent and never disposes retained resources', () => {
  const retained = { disposed: false }
  const removed = { disposed: false }
  const resources = new Map([['retained', retained], ['removed', removed]])
  const retainedKeys = new Set(['retained'])
  const dispose = (resource: { disposed: boolean }) => { resource.disposed = true }

  assert.equal(pruneRuntimeMap(resources, retainedKeys, dispose), 1)
  assert.equal(pruneRuntimeMap(resources, retainedKeys, dispose), 0)
  assert.equal(retained.disposed, false)
  assert.equal(removed.disposed, true)
})
