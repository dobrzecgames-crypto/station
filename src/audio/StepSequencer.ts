import type { AudioEngine, SampleId, TriggerSampleOptions } from './AudioEngine'

export interface StepSequencerConfig {
  bpm: number
  tracks: readonly StepSequencerTrack[]
}

export interface StepSequencerTrack {
  sampleId: SampleId
  steps: readonly boolean[]
  options: TriggerSampleOptions
}

export class StepSequencer {
  private readonly lookAheadSeconds = 0.1
  private readonly wakeIntervalMilliseconds = 25
  private timer: number | undefined
  private nextStepTime = 0
  private nextStepIndex = 0
  private running = false

  constructor(private readonly audioEngine: AudioEngine) {}

  start(config: StepSequencerConfig): void {
    if (this.running) return
    this.running = true
    this.nextStepIndex = 0
    this.nextStepTime = this.audioEngine.getCurrentTime()
    this.schedule(config)
  }

  stop(): void {
    this.running = false
    if (this.timer !== undefined) window.clearTimeout(this.timer)
    this.timer = undefined
  }

  isRunning(): boolean { return this.running }

  private schedule(config: StepSequencerConfig): void {
    if (!this.running) return
    const now = this.audioEngine.getCurrentTime()
    const stepDuration = 60 / config.bpm / 4
    while (this.nextStepTime < now + this.lookAheadSeconds) {
      for (const track of config.tracks) {
        if (track.steps[this.nextStepIndex]) this.audioEngine.scheduleSample(track.sampleId, this.nextStepTime, track.options)
      }
      this.nextStepIndex = (this.nextStepIndex + 1) % 16
      this.nextStepTime += stepDuration
    }
    this.timer = window.setTimeout(() => this.schedule(config), this.wakeIntervalMilliseconds)
  }
}
