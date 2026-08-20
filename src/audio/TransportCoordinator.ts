import type { StepSequencerConfig } from './StepSequencer'
import type { TimelineSchedulerConfig } from './TimelineScheduler'

interface StepTransportScheduler {
  start(getConfig: () => StepSequencerConfig, startAt?: number): void
  stop(): void
  isRunning(): boolean
}

interface TimelineTransportScheduler {
  start(getConfig: () => TimelineSchedulerConfig, startBeat?: number, startAt?: number): void
  stop(): void
  isRunning(): boolean
}

interface TransportAudioOwner {
  getCurrentTime(): number
  stopSequencerVoices(): void
  stopTimelineVoices(): void
}

/**
 * Owns the normal Station transport boundary: StepSequencer and TRACKS start
 * against one AudioContext timestamp and always stop as one unit. Pattern
 * recording count-in deliberately remains a StepSequencer-only operation.
 */
export class TransportCoordinator {
  private readonly stepSequencer: StepTransportScheduler
  private readonly timelineScheduler: TimelineTransportScheduler
  private readonly audioOwner: TransportAudioOwner

  constructor(
    stepSequencer: StepTransportScheduler,
    timelineScheduler: TimelineTransportScheduler,
    audioOwner: TransportAudioOwner,
  ) {
    this.stepSequencer = stepSequencer
    this.timelineScheduler = timelineScheduler
    this.audioOwner = audioOwner
  }

  start(
    getStepConfig: () => StepSequencerConfig,
    getTimelineConfig: () => TimelineSchedulerConfig,
    timelineStartBeat = 0,
  ): number | null {
    const stepRunning = this.stepSequencer.isRunning()
    const timelineRunning = this.timelineScheduler.isRunning()
    if (stepRunning && timelineRunning) return null

    // Repair a partially running transport before starting a fresh pair.
    if (stepRunning || timelineRunning) this.stop()

    const startAt = this.audioOwner.getCurrentTime()
    try {
      // Timeline first means a synchronously completing one-slot SONG can
      // still stop both sides through its onSongComplete callback.
      this.timelineScheduler.start(getTimelineConfig, timelineStartBeat, startAt)
      this.stepSequencer.start(getStepConfig, startAt)
      return startAt
    } catch (error) {
      this.stop()
      throw error
    }
  }

  stop(): void {
    this.stepSequencer.stop()
    this.timelineScheduler.stop()
    this.audioOwner.stopSequencerVoices()
    this.audioOwner.stopTimelineVoices()
  }

  isRunning(): boolean {
    return this.stepSequencer.isRunning() || this.timelineScheduler.isRunning()
  }
}
