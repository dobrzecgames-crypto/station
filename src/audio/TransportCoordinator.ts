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
  stopAt(when: number): void
  isRunning(): boolean
}

interface TransportAudioOwner {
  getCurrentTime(): number
  stopSequencerVoices(): void
  stopTimelineVoices(): void
  scheduleAudioClockCallback(when: number, callback: () => void): () => void
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
  private pendingCompletionCancel: (() => void) | null = null

  constructor(
    stepSequencer: StepTransportScheduler,
    timelineScheduler: TimelineTransportScheduler,
    audioOwner: TransportAudioOwner,
  ) {
    this.stepSequencer = stepSequencer
    this.timelineScheduler = timelineScheduler
    this.audioOwner = audioOwner
  }

  /** `startAtOverride` lets a caller hand both schedulers an already-scheduled
      future timestamp - a recording count-in reaches its downbeat that way,
      instead of starting one scheduler on its own and leaving the other
      behind. */
  start(
    getStepConfig: () => StepSequencerConfig,
    getTimelineConfig: () => TimelineSchedulerConfig,
    timelineStartBeat = 0,
    startAtOverride?: number,
  ): number | null {
    const stepRunning = this.stepSequencer.isRunning()
    const timelineRunning = this.timelineScheduler.isRunning()
    if (stepRunning && timelineRunning) return null

    // Repair a partially running transport before starting a fresh pair.
    if (stepRunning || timelineRunning) this.stop()

    const startAt = startAtOverride ?? this.audioOwner.getCurrentTime()
    try {
      // Timeline first means even a one-slot SONG whose whole schedule is
      // planned synchronously can stamp its natural completion on both sides.
      this.timelineScheduler.start(getTimelineConfig, timelineStartBeat, startAt)
      this.stepSequencer.start(getStepConfig, startAt)
      return startAt
    } catch (error) {
      this.stop()
      throw error
    }
  }

  stop(): void {
    this.pendingCompletionCancel?.()
    this.pendingCompletionCancel = null
    this.stepSequencer.stop()
    this.timelineScheduler.stop()
    this.audioOwner.stopSequencerVoices()
    this.audioOwner.stopTimelineVoices()
  }

  isRunning(): boolean {
    return this.pendingCompletionCancel !== null || this.stepSequencer.isRunning() || this.timelineScheduler.isRunning()
  }

  /** Planning reaches the final SONG boundary before audio does. Stop future
      planning now, cut TRACKS at the stamped boundary, and finish UI state only
      when an audio-clock marker reaches it. Sequencer release tails are not a
      global STOP and are deliberately allowed to ring. */
  completeSong(completionTime: number, onComplete: () => void): void {
    if (this.pendingCompletionCancel) return
    this.timelineScheduler.stopAt(completionTime)
    this.pendingCompletionCancel = this.audioOwner.scheduleAudioClockCallback(completionTime, () => {
      this.timelineScheduler.stop()
      this.pendingCompletionCancel = null
      onComplete()
    })
  }
}
