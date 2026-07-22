import type { AudioEngine, SampleAssetId, SampleId, TriggerSampleOptions } from './AudioEngine'

export interface StepSequencerConfig {
  bpm: number
  swing: number
  tracks: readonly StepSequencerTrack[]
}

export interface StepSequencerTrack {
  sampleId: SampleId
  assetId: SampleAssetId
  steps: readonly number[]
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

  start(getConfig: () => StepSequencerConfig): void {
    if (this.running) return
    this.running = true
    this.nextStepIndex = 0
    this.nextStepTime = this.audioEngine.getCurrentTime()
    this.schedule(getConfig)
  }

  stop(): void {
    this.running = false
    if (this.timer !== undefined) window.clearTimeout(this.timer)
    this.timer = undefined
  }

  isRunning(): boolean { return this.running }

  private schedule(getConfig: () => StepSequencerConfig): void {
    if (!this.running) return
    const config = getConfig()
    const now = this.audioEngine.getCurrentTime()
    const stepDuration = 60 / config.bpm / 4
    while (this.nextStepTime < now + this.lookAheadSeconds) {
      const scheduledTime = this.nextStepTime + (this.nextStepIndex % 2 === 1 ? stepDuration * config.swing * 0.5 : 0)
      for (const track of config.tracks) {
        const velocity = track.steps[this.nextStepIndex]
        if (velocity > 0) this.audioEngine.scheduleSample(track.sampleId, track.assetId, scheduledTime, { ...track.options, gain: (track.options.gain ?? 1) * velocity })
      }
      this.nextStepIndex = (this.nextStepIndex + 1) % 16
      this.nextStepTime += stepDuration
    }
    this.timer = window.setTimeout(() => this.schedule(getConfig), this.wakeIntervalMilliseconds)
  }
}
