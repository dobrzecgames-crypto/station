import assert from 'node:assert/strict'
import test from 'node:test'
import { TransportCoordinator } from '../src/audio/TransportCoordinator.ts'

test('normal transport starts both schedulers at one audio-clock timestamp', () => {
  const step = new FakeStepScheduler()
  const timeline = new FakeTimelineScheduler()
  const audio = new FakeTransportAudio()
  audio.now = 12.5
  const transport = new TransportCoordinator(step, timeline, audio)

  const startedAt = transport.start(stepConfig, timelineConfig, 24)

  assert.equal(startedAt, 12.5)
  assert.deepEqual(step.starts, [12.5])
  assert.deepEqual(timeline.starts, [{ beat: 24, at: 12.5 }])
  assert.equal(transport.isRunning(), true)
})

test('global stop is idempotent and always stops both schedulers and owned voices', () => {
  const step = new FakeStepScheduler()
  const timeline = new FakeTimelineScheduler()
  const audio = new FakeTransportAudio()
  const transport = new TransportCoordinator(step, timeline, audio)
  transport.start(stepConfig, timelineConfig)

  transport.stop()
  transport.stop()

  assert.equal(step.running, false)
  assert.equal(timeline.running, false)
  assert.equal(step.stopCalls, 2)
  assert.equal(timeline.stopCalls, 2)
  assert.equal(audio.sequencerStopCalls, 2)
  assert.equal(audio.timelineStopCalls, 2)
  assert.equal(transport.isRunning(), false)
})

test('a partially running transport is repaired before a fresh paired start', () => {
  const step = new FakeStepScheduler()
  const timeline = new FakeTimelineScheduler()
  const audio = new FakeTransportAudio()
  const transport = new TransportCoordinator(step, timeline, audio)
  timeline.running = true

  transport.start(stepConfig, timelineConfig, 8)

  assert.equal(step.running, true)
  assert.equal(timeline.running, true)
  assert.equal(audio.sequencerStopCalls, 1)
  assert.equal(audio.timelineStopCalls, 1)
  assert.deepEqual(timeline.starts, [{ beat: 8, at: 0 }])
})

test('a failed partial start rolls both schedulers and voice owners back to stopped', () => {
  const step = new FakeStepScheduler()
  const timeline = new FakeTimelineScheduler()
  const audio = new FakeTransportAudio()
  const transport = new TransportCoordinator(step, timeline, audio)
  step.startError = new Error('step start failed')

  assert.throws(() => transport.start(stepConfig, timelineConfig), /step start failed/)
  assert.equal(step.running, false)
  assert.equal(timeline.running, false)
  assert.equal(audio.sequencerStopCalls, 1)
  assert.equal(audio.timelineStopCalls, 1)
})

test('natural SONG completion waits for the audio-clock boundary and preserves sequencer tails', () => {
  const step = new FakeStepScheduler()
  const timeline = new FakeTimelineScheduler()
  const audio = new FakeTransportAudio()
  const transport = new TransportCoordinator(step, timeline, audio)
  transport.start(stepConfig, timelineConfig)
  step.running = false
  let completions = 0

  transport.completeSong(4, () => { completions += 1 })

  assert.equal(timeline.running, true)
  assert.deepEqual(timeline.stopBoundaries, [4])
  assert.equal(audio.sequencerStopCalls, 0)
  assert.equal(transport.isRunning(), true)
  audio.fireClockCallback()
  assert.equal(completions, 1)
  assert.equal(timeline.running, false)
  assert.equal(transport.isRunning(), false)
})

test('manual STOP cancels a pending natural-completion callback', () => {
  const step = new FakeStepScheduler()
  const timeline = new FakeTimelineScheduler()
  const audio = new FakeTransportAudio()
  const transport = new TransportCoordinator(step, timeline, audio)
  transport.start(stepConfig, timelineConfig)
  step.running = false
  let completions = 0
  transport.completeSong(4, () => { completions += 1 })

  transport.stop()
  audio.fireClockCallback()

  assert.equal(completions, 0)
  assert.equal(audio.clockCallbackCancelCalls, 1)
  assert.equal(audio.sequencerStopCalls, 1)
  assert.equal(audio.timelineStopCalls, 1)
})

test('a recording count-in starts both schedulers on its own future downbeat', () => {
  const step = new FakeStepScheduler()
  const timeline = new FakeTimelineScheduler()
  const audio = new FakeTransportAudio()
  audio.now = 3
  const transport = new TransportCoordinator(step, timeline, audio)

  const startedAt = transport.start(stepConfig, timelineConfig, 6, 5)

  assert.equal(startedAt, 5)
  assert.deepEqual(step.starts, [5])
  assert.deepEqual(timeline.starts, [{ beat: 6, at: 5 }])
})

test('PLAY during a running count-in is a no-op instead of restarting the step sequencer', () => {
  const step = new FakeStepScheduler()
  const timeline = new FakeTimelineScheduler()
  const audio = new FakeTransportAudio()
  const transport = new TransportCoordinator(step, timeline, audio)
  transport.start(stepConfig, timelineConfig, 0, 5)

  const secondStart = transport.start(stepConfig, timelineConfig, 0)

  assert.equal(secondStart, null)
  assert.deepEqual(step.starts, [5], 'the count-in downbeat must survive a second PLAY')
  assert.deepEqual(timeline.starts, [{ beat: 0, at: 5 }])
  assert.equal(step.stopCalls, 0)
  assert.equal(audio.sequencerStopCalls, 0)
})

const stepConfig = () => ({
  bpm: 120,
  swing: 0,
  metronomeEnabled: false,
  mode: 'pattern' as const,
  loopSong: false,
  lastSongSlot: null,
  getTracksForSlot: () => [],
})

const timelineConfig = () => ({ bpm: 120, getClips: () => [] })

class FakeStepScheduler {
  running = false
  starts: number[] = []
  stopCalls = 0
  startError: Error | null = null

  start(_getConfig: typeof stepConfig, startAt = -1): void {
    if (this.startError) throw this.startError
    this.running = true
    this.starts.push(startAt)
  }

  stop(): void { this.running = false; this.stopCalls += 1 }
  isRunning(): boolean { return this.running }
}

class FakeTimelineScheduler {
  running = false
  starts: Array<{ beat: number; at: number }> = []
  stopCalls = 0
  stopBoundaries: number[] = []

  start(_getConfig: typeof timelineConfig, startBeat = 0, startAt = -1): void {
    this.running = true
    this.starts.push({ beat: startBeat, at: startAt })
  }

  stop(): void { this.running = false; this.stopCalls += 1 }
  stopAt(when: number): void { this.stopBoundaries.push(when) }
  isRunning(): boolean { return this.running }
}

class FakeTransportAudio {
  now = 0
  sequencerStopCalls = 0
  timelineStopCalls = 0
  clockCallbackCancelCalls = 0
  private clockCallback: (() => void) | null = null
  private clockCallbackActive = false
  getCurrentTime(): number { return this.now }
  stopSequencerVoices(): void { this.sequencerStopCalls += 1 }
  stopTimelineVoices(): void { this.timelineStopCalls += 1 }
  scheduleAudioClockCallback(_when: number, callback: () => void): () => void {
    this.clockCallback = callback
    this.clockCallbackActive = true
    return () => { this.clockCallbackActive = false; this.clockCallbackCancelCalls += 1 }
  }
  fireClockCallback(): void {
    if (this.clockCallbackActive) this.clockCallback?.()
    this.clockCallbackActive = false
  }
}
