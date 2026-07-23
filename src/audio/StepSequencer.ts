import type { AudioEngine, ChannelId, GroupId, SampleAssetId, TriggerSampleOptions } from './AudioEngine'

export interface StepSequencerConfig {
  bpm: number
  swing: number
  metronomeEnabled: boolean
  mode: 'pattern' | 'song'
  loopSong: boolean
  lastSongSlot: number | null
  getTracksForSlot: (slot: number) => readonly StepSequencerTrack[]
  onStepScheduled?: (stepIndex: number, scheduledTime: number, durationSeconds: number) => void
  onSongSlotChange?: (slot: number) => void
  onSongComplete?: () => void
}

export interface StepSequencerTrack {
  groupId: GroupId
  channelId: ChannelId
  assetId: SampleAssetId
  steps: readonly number[]
  shifts: readonly number[]
  options: TriggerSampleOptions
}

export class StepSequencer {
  private readonly lookAheadSeconds = 0.1
  private readonly wakeIntervalMilliseconds = 25
  private timer: number | undefined
  private nextStepTime = 0
  private nextStepIndex = 0
  private currentSongSlot = 1
  private running = false

  constructor(private readonly audioEngine: AudioEngine) {}

  start(getConfig: () => StepSequencerConfig): void {
    if (this.running) return
    this.running = true
    this.nextStepIndex = 0
    this.currentSongSlot = 1
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
    if (this.nextStepTime < now - this.lookAheadSeconds) {
      this.nextStepIndex = 0
      this.nextStepTime = now
    }
    while (this.nextStepTime < now + this.lookAheadSeconds) {
      const scheduledTime = this.nextStepTime + (this.nextStepIndex % 2 === 1 ? stepDuration * config.swing * 0.5 : 0)
      config.onStepScheduled?.(this.nextStepIndex, scheduledTime, stepDuration)
      if (config.metronomeEnabled && this.nextStepIndex % 4 === 0) this.audioEngine.scheduleMetronome(scheduledTime, this.nextStepIndex === 0)
      if (config.mode === 'song' && this.nextStepIndex === 0) config.onSongSlotChange?.(this.currentSongSlot)
      const tracks = config.getTracksForSlot(config.mode === 'song' ? this.currentSongSlot : 1)
      for (const track of tracks) {
        const velocity = track.steps[this.nextStepIndex]
        const shift = track.shifts[this.nextStepIndex] ?? 0
        if (velocity > 0) this.audioEngine.scheduleSample(track.groupId, track.channelId, track.assetId, scheduledTime + shift * stepDuration, { ...track.options, gain: (track.options.gain ?? 1) * velocity }, 'sequencer')
      }
      const wasLastStep = this.nextStepIndex === 15
      this.nextStepIndex = (this.nextStepIndex + 1) % 16
      this.nextStepTime += stepDuration
      if (config.mode === 'song' && wasLastStep) {
        if (config.lastSongSlot === null || this.currentSongSlot >= config.lastSongSlot) {
          if (config.loopSong && config.lastSongSlot !== null) this.currentSongSlot = 1
          else {
            this.running = false
            this.timer = undefined
            config.onSongComplete?.()
            return
          }
        } else this.currentSongSlot += 1
      }
    }
    this.timer = window.setTimeout(() => this.schedule(getConfig), this.wakeIntervalMilliseconds)
  }
}
