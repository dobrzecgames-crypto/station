import type { AudioEngine, GroupId, SampleAssetId } from './AudioEngine'
import { createTimeoutTicker } from './StepSequencer'
import type { SequencerTicker } from './StepSequencer'

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
  private startedAtAudioTime = 0
  private startBeat = 0
  private scheduledClipIds = new Set<string>()
  private running = false

  constructor(
    private readonly audioEngine: AudioEngine,
    private readonly ticker: SequencerTicker = createTimeoutTicker(),
    private readonly lookAheadSeconds = 0.1,
  ) {}

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

  /** Clips whose span already covers startBeat begin immediately, partway
      through their own source region, rather than waiting for their own
      startBeat (already in the past) or being silently skipped. Runs once,
      at start() - real elapsed playback time afterwards is handled by the
      normal look-ahead pass, since only clips not yet started remain. */
  private scheduleClipsAlreadyInProgress(config: TimelineSchedulerConfig): void {
    for (const clip of config.getClips()) {
      const clipEndBeat = clip.startBeat + clip.lengthBeats
      if (clip.startBeat >= this.startBeat || clipEndBeat <= this.startBeat) continue
      const elapsedSourceSeconds = beatsToSeconds(this.startBeat - clip.startBeat, config.bpm)
      const remainingLengthSeconds = beatsToSeconds(clipEndBeat - this.startBeat, config.bpm)
      this.scheduledClipIds.add(clip.clipId)
      this.audioEngine.scheduleClip(clip.trackId, clip.trackId, clip.assetId, this.startedAtAudioTime, {
        // Region bounds stay in constant forward-source coordinates (see
        // AudioEngine's toPlaybackRegion) - a reversed clip's audible edge is
        // its sourceEndSeconds, so elapsed time eats into that end instead.
        sourceOffsetSeconds: clip.reversed ? clip.sourceOffsetSeconds : clip.sourceOffsetSeconds + elapsedSourceSeconds,
        sourceEndSeconds: clip.reversed ? clip.sourceEndSeconds - elapsedSourceSeconds : clip.sourceEndSeconds,
        lengthSeconds: remainingLengthSeconds,
        gain: clip.gain,
        pitchSemitones: clip.pitchSemitones,
        tempoRate: clip.tempoRate,
        fadeInSeconds: 0, // already mid-clip - the engine's own click-safety floor still applies
        fadeOutSeconds: clip.fadeOutSeconds,
        loop: clip.loop,
        reversed: clip.reversed,
      })
      config.onClipScheduled?.(clip.clipId, clip.trackId, this.startedAtAudioTime, remainingLengthSeconds)
    }
  }

  private schedule(getConfig: () => TimelineSchedulerConfig): void {
    if (!this.running) return
    const config = getConfig()
    const now = this.audioEngine.getCurrentTime()
    const lookAheadEndBeat = this.startBeat + Math.max(0, secondsToBeats(now + this.lookAheadSeconds - this.startedAtAudioTime, config.bpm))

    for (const clip of config.getClips()) {
      if (this.scheduledClipIds.has(clip.clipId)) continue
      if (clip.startBeat < this.startBeat || clip.startBeat >= lookAheadEndBeat) continue
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

    this.ticker.wake(() => this.schedule(getConfig))
  }
}
