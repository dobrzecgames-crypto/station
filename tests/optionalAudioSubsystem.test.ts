import assert from 'node:assert/strict'
import test from 'node:test'
import { OptionalAudioSubsystem } from '../src/audio/OptionalAudioSubsystem.ts'

test('optional audio failure is captured without rejecting core startup', async () => {
  const subsystem = new OptionalAudioSubsystem('ZOLA-X AudioWorklet')

  const available = await subsystem.initialize(async () => { throw new Error('worklet module blocked') })

  assert.equal(available, false)
  assert.deepEqual(subsystem.getDiagnostics(), {
    label: 'ZOLA-X AudioWorklet',
    status: 'unavailable',
    error: 'worklet module blocked',
  })
})

test('a synchronous module-registration throw is isolated too', async () => {
  const subsystem = new OptionalAudioSubsystem('ZOLA-X AudioWorklet')

  const available = await subsystem.initialize(() => { throw new Error('synchronous browser failure') })

  assert.equal(available, false)
  assert.equal(subsystem.getDiagnostics().status, 'unavailable')
  assert.equal(subsystem.getDiagnostics().error, 'synchronous browser failure')
})

test('a failed optional audio load can retry without a poisoned rejected promise', async () => {
  const subsystem = new OptionalAudioSubsystem('ZOLA-X AudioWorklet')
  let attempts = 0
  const load = async () => {
    attempts += 1
    if (attempts === 1) throw new Error('temporary failure')
  }

  assert.equal(await subsystem.initialize(load), false)
  assert.equal(await subsystem.initialize(load), true)
  assert.equal(attempts, 2)
  assert.equal(subsystem.getDiagnostics().status, 'ready')
  assert.equal(subsystem.getDiagnostics().error, null)
})

test('concurrent optional audio initialization shares one in-flight load', async () => {
  const subsystem = new OptionalAudioSubsystem('ZOLA-X AudioWorklet')
  let resolveLoad!: () => void
  let attempts = 0
  const load = () => {
    attempts += 1
    return new Promise<void>((resolve) => { resolveLoad = resolve })
  }

  const first = subsystem.initialize(load)
  const second = subsystem.initialize(load)
  await Promise.resolve()
  resolveLoad()

  assert.equal(await first, true)
  assert.equal(await second, true)
  assert.equal(attempts, 1)
})

test('reset ignores an optional load that completes after disposal', async () => {
  const subsystem = new OptionalAudioSubsystem('ZOLA-X AudioWorklet')
  let resolveLoad!: () => void
  const result = subsystem.initialize(() => new Promise<void>((resolve) => { resolveLoad = resolve }))
  await Promise.resolve()

  subsystem.reset()
  resolveLoad()

  assert.equal(await result, false)
  assert.equal(subsystem.getDiagnostics().status, 'idle')
})
