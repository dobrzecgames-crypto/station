import type { AudioEngine, GroupId, SampleAssetId } from './AudioEngine'
import { createTimeoutTicker } from './StepSequencer.ts'
import type { SequencerTicker } from './StepSequencer.ts'

/**
 * Everything TimelineScheduler needs to schedule one clip, in the engine's
 * own vocabulary - deliberately not tracks/tracksTypes.ts's AudioClip.
 * Mirrors how StepSequencer defines its own StepSequencerTrack rather than
 * depending on PatternGroup/PadState: audio/ stays decoupled from the
 * persisted shapes in tracks/, which instead depends on audio/. The
 * conversion from AudioTrack/AudioClip to this shape lives in tracks/ (see
 * the Stage 2 UI wiring), the same role song/songTracks.ts already plays
 * for PatternGroup -> StepSequencerTrack.
 */
export interface TimelineSchedulerClip {
  trackId: GroupId
  clipId: string
  assetId: SampleAssetId
  startBeat: number
  lengthBeats: number
  sourceOffsetSeconds: number
  sourceEndSeconds: number
  gain: number
  fadeInSeconds: number
  fadeOutSeconds: number
  loop: boolean
  reversed: boolean
  pitchSemitones: number
  /** Already resolved by the caller (tracks/tracksOperations.ts's
      resolveTempoMatchRate) - the scheduler stays audio-engine-shaped and
      does not know about tempo detection. 1 when not applicable. */
  tempoRate: number
}

export interface TimelineSchedulerConfig {
  bpm: number
  getClips: () => readonly TimelineSchedulerClip[]
  onClipScheduled?: (clipId: string, trackId: GroupId, scheduledTime: number, durationSeconds: number) => void
}

export interface TimelineSchedulerDiagnostics {
  lateWakeCount: number
  maxLatenessSeconds: number
  skippedExpiredClipCount: number
  recoveredInProgressClipCount: number
}

function beatsToSeconds(beats: number, bpm: number): number {
  return beats * (60 / bpm)
}

function secondsToBeats(seconds: number, bpm: number): number {
  return seconds / (60 / bpm)
}

/**
 * TRACKS' scheduler - a sibling to StepSequencer, not a change to it: this
 * plays a linear arrangement of one-shot clip events from a start position
 * once through, rather than looping a 16-step pattern. Shares the same
 * look-ahead/ticker shape (SequencerTicker, reused directly from
 * StepSequencer.ts) so both read AudioContext time as the only clock and
 * neither is ever driven by React rendering (docs/DECISIONS.md DEC-004).
 *
 * Each clip is scheduled exactly once, via AudioEngine.scheduleClip, the
 * moment its startBeat enters the look-ahead window - never per-step like a
 * pattern. A clip whose span already covers the chosen start position (e.g.
 * resuming playback from where the playhead was left, or after scrubbing
 * it) is special-cased in start() to begin partway through its own source
 * region instead of waiting for a startBeat that has already passed.
 */
export class TimelineScheduler {
  private static readonly maximumLateStartSeconds = 0.0125
  private startedAtAudioTime = 0
  private startBeat = 0
  private scheduledClipIds = new Set<string>()
  private running = false
  private lateWakeCount = 0
  private maxLatenessSeconds = 0
  private skippedExpiredClipCount = 0
  private recoveredInProgressClipCount = 0
  private readonly audioEngine: AudioEngine
  private readonly ticker: SequencerTicker
  private readonly lookAheadSeconds: number

  constructor(
    audioEngine: AudioEngine,
    ticker: SequencerTicker = createTimeoutTicker(),
    lookAheadSeconds = 0.1,
  ) {
    this.audioEngine = audioEngine
    this.ticker = ticker
    this.lookAheadSeconds = lookAheadSeconds
  }

  /** startBeat is the timeline position (in beats) playback begins from - 0
      for "from the top", or the current playhead position for resume/scrub.
      startAt lets a caller hand off an already-scheduled future timestamp
      instead of "now", the same shape StepSequencer.start uses. */
  start(getConfig: () => TimelineSchedulerConfig, startBeat = 0, startAt: number = this.audioEngine.getCurrentTime()): void {
    if (this.running) return
    this.running = true
    this.startBeat = Math.max(0, startBeat)
    this.startedAtAudioTime = startAt
    this.scheduledClipIds = new Set()
    this.scheduleClipsAlreadyInProgress(getConfig())
    this.schedule(getConfig)
  }

  stop(): void {
    this.running = false
    this.ticker.cancel()
  }

  isRunning(): boolean { return this.running }

  getDiagnostics(): TimelineSchedulerDiagnostics {
    return {
      lateWakeCount: this.lateWakeCount,
      maxLatenessSeconds: this.maxLatenessSeconds,
      skippedExpiredClipCount: this.skippedExpiredClipCount,
      recoveredInProgressClipCount: this.recoveredInProgressClipCount,
    }
  }

  /** Clips whose span already covers startBeat begin immediately, partway
      through their own source region, rather than waiting for their own
      startBeat (already in the past) or being silently skipped. Runs once,
      at start() - real elapsed playback time afterwards is handled by the
      normal look-ahead pass, since only clips not yet started remain. */
  private scheduleClipsAlreadyInProgress(config: TimelineSchedulerConfig): void {
    for (const clip of config.getClips()) {
      const clipEndBeat = clip.startBeat + clip.lengthBeats
      if (clip.startBeat >= this.startBeat || clipEndBeat <= this.startBeat) continue
      this.scheduledClipIds.add(clip.clipId)
      this.scheduleInProgressClip(config, clip, this.startBeat, this.startedAtAudioTime)
    }
  }

  private schedule(getConfig: () => TimelineSchedulerConfig): void {
    if (!this.running) return
    const config = getConfig()
    const now = this.audioEngine.getCurrentTime()
    const currentBeat = this.startBeat + Math.max(0, secondsToBeats(now - this.startedAtAudioTime, config.bpm))
    const lookAheadEndBeat = this.startBeat + Math.max(0, secondsToBeats(now + this.lookAheadSeconds - this.startedAtAudioTime, config.bpm))
    const maximumLateStartBeats = secondsToBeats(TimelineScheduler.maximumLateStartSeconds, config.bpm)
    let passWasLate = false
    let passMaxLatenessSeconds = 0

    for (const clip of config.getClips()) {
      if (this.scheduledClipIds.has(clip.clipId)) continue
      if (clip.startBeat < this.startBeat) continue
      if (clip.startBeat < currentBeat - maximumLateStartBeats) {
        this.scheduledClipIds.add(clip.clipId)
        passWasLate = true
        passMaxLatenessSeconds = Math.max(passMaxLatenessSeconds, beatsToSeconds(currentBeat - clip.startBeat, config.bpm))
        const clipEndBeat = clip.startBeat + clip.lengthBeats
        if (clipEndBeat <= currentBeat || !this.scheduleInProgressClip(config, clip, currentBeat, now)) this.skippedExpiredClipCount += 1
        else this.recoveredInProgressClipCount += 1
        continue
      }
      if (clip.startBeat >= lookAheadEndBeat) continue
      this.scheduledClipIds.add(clip.clipId)
      const when = this.startedAtAudioTime + beatsToSeconds(clip.startBeat - this.startBeat, config.bpm)
      const lengthSeconds = beatsToSeconds(clip.lengthBeats, config.bpm)
      this.audioEngine.scheduleClip(clip.trackId, clip.trackId, clip.assetId, when, {
        sourceOffsetSeconds: clip.sourceOffsetSeconds,
        sourceEndSeconds: clip.sourceEndSeconds,
        lengthSeconds,
        gain: clip.gain,
        pitchSemitones: clip.pitchSemitones,
        tempoRate: clip.tempoRate,
        fadeInSeconds: clip.fadeInSeconds,
        fadeOutSeconds: clip.fadeOutSeconds,
        loop: clip.loop,
        reversed: clip.reversed,
      })
      config.onClipScheduled?.(clip.clipId, clip.trackId, when, lengthSeconds)
    }

    if (passWasLate) {
      this.lateWakeCount += 1
      this.maxLatenessSeconds = Math.max(this.maxLatenessSeconds, passMaxLatenessSeconds)
    }

    this.ticker.wake(() => this.schedule(getConfig))
  }

  private scheduleInProgressClip(config: TimelineSchedulerConfig, clip: TimelineSchedulerClip, playheadBeat: number, when: number): boolean {
    const clipEndBeat = clip.startBeat + clip.lengthBeats
    const elapsedTimelineSeconds = beatsToSeconds(playheadBeat - clip.startBeat, config.bpm)
    const remainingLengthSeconds = beatsToSeconds(clipEndBeat - playheadBeat, config.bpm)
    const playbackRate = Math.pow(2, clip.pitchSemitones / 12) * (clip.tempoRate > 0 ? clip.tempoRate : 1)
    const playbackOffsetSeconds = elapsedTimelineSeconds * playbackRate
    const sourceDurationSeconds = Math.max(0, clip.sourceEndSeconds - clip.sourceOffsetSeconds)
    // A pitched-up non-looped source may already be silent even though its
    // fixed-width timeline slot has not ended. Do not manufacture a tail.
    if (remainingLengthSeconds <= 0 || (!clip.loop && playbackOffsetSeconds >= sourceDurationSeconds)) return false

    this.audioEngine.scheduleClip(clip.trackId, clip.trackId, clip.assetId, when, {
      sourceOffsetSeconds: clip.sourceOffsetSeconds,
      sourceEndSeconds: clip.sourceEndSeconds,
      playbackOffsetSeconds,
      lengthSeconds: remainingLengthSeconds,
      gain: clip.gain,
      pitchSemitones: clip.pitchSemitones,
      tempoRate: clip.tempoRate,
      fadeInSeconds: 0,
      fadeOutSeconds: clip.fadeOutSeconds,
      loop: clip.loop,
      reversed: clip.reversed,
    })
    config.onClipScheduled?.(clip.clipId, clip.trackId, when, remainingLengthSeconds)
    return true
  }
}
