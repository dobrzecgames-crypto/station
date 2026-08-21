import assert from 'node:assert/strict'
import test from 'node:test'
import { StepSequencer } from '../src/audio/StepSequencer.ts'
import type { SequencerTicker, StepSequencerConfig, StepSequencerTrack } from '../src/audio/StepSequencer.ts'
import { TimelineScheduler } from '../src/audio/TimelineScheduler.ts'
import type { TimelineSchedulerClip, TimelineSchedulerConfig } from '../src/audio/TimelineScheduler.ts'
import type { ScheduleClipOptions } from '../src/audio/AudioEngine.ts'

test('25-70 ms wake delays preserve the next sequencer step without a reset', () => {
  for (const delaySeconds of [0.025, 0.07]) {
    const run = runStepSequencerAfter(delaySeconds)
    assert.equal(run.sequencer.getDiagnostics().lateWakeCount, 0)
    assert.deepEqual(run.scheduled.map((event) => event.step), delaySeconds === 0.07 ? [0, 1] : [0])
    assert.ok(run.scheduled.every((event) => event.when >= 0))
  }
})

test('150-2000 ms stalls advance the step cursor and never schedule expired starts', () => {
  const expectations = [
    { delay: 0.15, lastStep: 0, lastSection: 0, skipped: 1 },
    { delay: 0.5, lastStep: 4, lastSection: 0, skipped: 3 },
    { delay: 2, lastStep: 0, lastSection: 1, skipped: 15 },
  ]

  for (const expectation of expectations) {
    const run = runStepSequencerAfter(expectation.delay)
    const last = run.scheduled.at(-1)!
    const diagnostics = run.sequencer.getDiagnostics()
    assert.equal(last.step, expectation.lastStep)
    assert.equal(last.section, expectation.lastSection)
    assert.equal(diagnostics.skippedExpiredStepCount, expectation.skipped)
    assert.equal(diagnostics.lateWakeCount, 1)
    assert.ok(run.engine.samples.every((event) => event.when >= expectation.delay || event.when === 0))
  }
})

test('a stalled SONG advances to the coherent slot rather than restarting slot one', () => {
  const ticker = new ManualTicker()
  const engine = new SchedulerEngine()
  const sequencer = new StepSequencer(engine as never, ticker, 0.1)
  const slots: number[] = []
  const config: StepSequencerConfig = {
    bpm: 120, swing: 0, metronomeEnabled: false, mode: 'song', loopSong: false, lastSongSlot: 4,
    getTracksForSlot: (slot) => { slots.push(slot); return [sampleTrack(`slot-${slot}`)] },
  }
  sequencer.start(() => config)
  engine.now = 2
  ticker.run()

  assert.equal(engine.samples.at(-1)?.assetId, 'slot-2')
  assert.ok(slots.includes(2))
})

test('SONG completion reports the final audio-clock grid boundary, not planning time', () => {
  const ticker = new ManualTicker()
  const engine = new SchedulerEngine()
  engine.now = 5
  const sequencer = new StepSequencer(engine as never, ticker, 3)
  let completionTime: number | null = null
  const config: StepSequencerConfig = {
    bpm: 120, swing: 0, metronomeEnabled: false, mode: 'song', loopSong: false, lastSongSlot: 1,
    getTracksForSlot: () => [sampleTrack('one-slot')],
    onSongComplete: (when) => { completionTime = when },
  }

  sequencer.start(() => config, 5)

  assert.equal(engine.now, 5)
  assert.equal(completionTime, 7)
  assert.equal(engine.samples.at(-1)?.when, 6.875)
})

test('TimelineScheduler does not dump a transient whose start and end expired during a 150 ms stall', () => {
  const run = runTimelineAfter(0.15, [timelineClip('transient', 0.25, 0.04)])

  assert.equal(run.engine.clips.length, 0)
  assert.equal(run.scheduler.getDiagnostics().skippedExpiredClipCount, 1)
  assert.equal(run.scheduler.getDiagnostics().lateWakeCount, 1)
})

test('TimelineScheduler resumes a still-active clip at its rate-correct in-source offset', () => {
  const clip = { ...timelineClip('sustained', 0.25, 1), pitchSemitones: 12, tempoRate: 1.5 }
  const run = runTimelineAfter(0.15, [clip])
  const scheduled = run.engine.clips[0]

  assert.equal(scheduled.when, 0.15)
  assert.ok(Math.abs((scheduled.options.playbackOffsetSeconds ?? 0) - 0.075) < 1e-9)
  assert.ok(Math.abs(scheduled.options.lengthSeconds - 0.475) < 1e-9)
  assert.equal(scheduled.options.sourceOffsetSeconds, 0)
  assert.equal(scheduled.options.sourceEndSeconds, 4)
  assert.equal(run.scheduler.getDiagnostics().recoveredInProgressClipCount, 1)
})

test('TimelineScheduler never schedules past timestamps after 500-2000 ms stalls', () => {
  for (const delaySeconds of [0.5, 2]) {
    const clips = [
      timelineClip('early-a', 0.25, 0.05),
      timelineClip('early-b', 0.5, 0.05),
      timelineClip('boundary', delaySeconds * 2, 0.05),
    ]
    const run = runTimelineAfter(delaySeconds, clips)
    assert.ok(run.engine.clips.every((event) => event.when >= delaySeconds))
  }
})

test('TimelineScheduler keeps planning through a stamped stop boundary without starting beyond it', () => {
  const ticker = new ManualTicker()
  const engine = new SchedulerEngine()
  const scheduler = new TimelineScheduler(engine as never, ticker, 0.1)
  const config: TimelineSchedulerConfig = {
    bpm: 120,
    getClips: () => [timelineClip('last-valid', 0.3, 1), timelineClip('past-boundary', 0.45, 1)],
  }
  scheduler.start(() => config)
  scheduler.stopAt(0.2)

  engine.now = 0.1
  ticker.run()
  engine.now = 0.15
  ticker.run()

  assert.deepEqual(engine.clips.map((event) => event.assetId), ['last-valid'])
  assert.ok(engine.timelineStopsAt.length >= 2)
  assert.ok(engine.timelineStopsAt.every((when) => when === 0.2))
})

test('a live tempo change re-anchors the timeline instead of teleporting the playhead', () => {
  const ticker = new ManualTicker()
  const engine = new SchedulerEngine()
  const scheduler = new TimelineScheduler(engine as never, ticker, 0.1)
  let bpm = 120
  // One beat is 0.5 s at 120 bpm and 0.3 s at 200 bpm. After two seconds the
  // playhead is on beat 4; the clip two beats later must still be one second
  // away at 120 bpm, and 0.6 s away once the tempo doubles the rate.
  const config: TimelineSchedulerConfig = { bpm, getClips: () => [timelineClip('later', 6, 1)] }
  scheduler.start(() => ({ ...config, bpm }))

  engine.now = 2
  ticker.run()
  assert.deepEqual(engine.clips, [], 'beat 6 is not inside the look-ahead yet')

  bpm = 200
  scheduler.rebaseTempo(120, 2)
  ticker.run()
  assert.deepEqual(engine.clips, [], 'a tempo change alone must not bring beat 6 forward')

  // Beat 6 is two beats past the re-anchored beat 4: 0.6 s at 200 bpm.
  engine.now = 2.55
  ticker.run()
  const started = engine.clips.at(0)
  assert.ok(started, 'the clip must still start, one look-ahead before its own beat')
  assert.ok(Math.abs(started.when - 2.6) < 1e-6, `expected the clip at 2.6 s, got ${started.when}`)
})

test('rebaseTempo is inert while the timeline is stopped', () => {
  const ticker = new ManualTicker()
  const engine = new SchedulerEngine()
  const scheduler = new TimelineScheduler(engine as never, ticker, 0.1)

  scheduler.rebaseTempo(120, 4)

  assert.equal(scheduler.isRunning(), false)
  assert.deepEqual(engine.clips, [])
})

function runStepSequencerAfter(delaySeconds: number) {
  const ticker = new ManualTicker()
  const engine = new SchedulerEngine()
  const sequencer = new StepSequencer(engine as never, ticker, 0.1)
  const scheduled: Array<{ step: number; section: number; when: number }> = []
  const config: StepSequencerConfig = {
    bpm: 120,
    swing: 0,
    metronomeEnabled: false,
    mode: 'pattern',
    loopSong: false,
    lastSongSlot: null,
    getPatternSectionCount: () => 2,
    getTracksForSlot: () => [sampleTrack('sample')],
    onStepScheduled: (step, when, _duration, section) => scheduled.push({ step, section, when }),
  }
  sequencer.start(() => config)
  engine.now = delaySeconds
  ticker.run()
  return { engine, sequencer, scheduled }
}

function runTimelineAfter(delaySeconds: number, clips: TimelineSchedulerClip[]) {
  const ticker = new ManualTicker()
  const engine = new SchedulerEngine()
  const scheduler = new TimelineScheduler(engine as never, ticker, 0.1)
  const config: TimelineSchedulerConfig = { bpm: 120, getClips: () => clips }
  scheduler.start(() => config)
  engine.now = delaySeconds
  ticker.run()
  return { engine, scheduler }
}

function sampleTrack(assetId: string): StepSequencerTrack {
  return {
    source: 'sample', groupId: 'group', channelId: 'channel', assetId, options: {},
    steps: Array(16).fill(1), shifts: Array(16).fill(0), lengths: Array(16).fill(1),
  }
}

function timelineClip(clipId: string, startBeat: number, lengthBeats: number): TimelineSchedulerClip {
  return {
    trackId: 'track', clipId, assetId: clipId, startBeat, lengthBeats,
    sourceOffsetSeconds: 0, sourceEndSeconds: 4, gain: 1,
    fadeInSeconds: 0, fadeOutSeconds: 0, loop: false, reversed: false,
    pitchSemitones: 0, tempoRate: 1,
  }
}

class ManualTicker implements SequencerTicker {
  private callback?: () => void
  wake(callback: () => void): void { this.callback = callback }
  cancel(): void { this.callback = undefined }
  run(): void { const callback = this.callback; this.callback = undefined; callback?.() }
}

class SchedulerEngine {
  now = 0
  samples: Array<{ assetId: string; when: number }> = []
  clips: Array<{ assetId: string; when: number; options: ScheduleClipOptions }> = []
  timelineStopsAt: number[] = []
  getCurrentTime(): number { return this.now }
  scheduleSample(_groupId: string, _channelId: string, assetId: string, when: number): void { this.samples.push({ assetId, when }) }
  scheduleClip(_groupId: string, _channelId: string, assetId: string, when: number, options: ScheduleClipOptions): void { this.clips.push({ assetId, when, options }) }
  stopTimelineVoicesAt(when: number): void { this.timelineStopsAt.push(when) }
  scheduleMetronome(): void {}
  stopSequencerChokeGroupAt(): void {}
  releaseSequencerChordAt(): void {}
  scheduleSynthChord(): void {}
  scheduleSynthPad(): void {}
  scheduleOrganicBassPad(): void {}
  schedulePolyChord(): void {}
  schedulePolyPad(): void {}
}
