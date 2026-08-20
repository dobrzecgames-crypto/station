import assert from 'node:assert/strict'
import test from 'node:test'
import { ProjectSaveStateTracker } from '../src/storage/ProjectSaveState.ts'

test('an older save completion cannot mark a newer edit as saved', () => {
  const tracker = new ProjectSaveStateTracker()
  tracker.markDirty()
  const first = tracker.beginSave()
  tracker.markDirty()

  assert.equal(tracker.getSnapshot().status, 'dirty')
  const second = tracker.beginSave()
  assert.equal(tracker.getSnapshot().status, 'saving')

  tracker.succeed(first)
  assert.equal(tracker.getSnapshot().status, 'saving')
  tracker.succeed(second)
  assert.deepEqual(tracker.getSnapshot(), {
    status: 'saved',
    dirty: false,
    revision: 2,
    savedRevision: 2,
    queueDepth: 0,
    error: null,
  })
})

test('a failed latest save remains dirty and visibly in error until retry', () => {
  const tracker = new ProjectSaveStateTracker()
  tracker.markDirty()
  const failed = tracker.beginSave()
  tracker.fail(failed, new Error('disk full'))

  assert.deepEqual(tracker.getSnapshot(), {
    status: 'error',
    dirty: true,
    revision: 1,
    savedRevision: 0,
    queueDepth: 0,
    error: 'disk full',
  })

  const retry = tracker.beginSave()
  assert.equal(tracker.getSnapshot().status, 'saving')
  tracker.succeed(retry)
  assert.equal(tracker.getSnapshot().status, 'saved')
})

test('reset invalidates completion from a project that is no longer active', () => {
  const tracker = new ProjectSaveStateTracker()
  tracker.markDirty()
  const stale = tracker.beginSave()

  tracker.reset(true)
  tracker.fail(stale, new Error('old project failed late'))

  assert.equal(tracker.getSnapshot().status, 'saved')
  assert.equal(tracker.getSnapshot().error, null)
})
