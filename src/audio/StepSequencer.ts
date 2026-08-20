import type { AudioEngine, ChannelId, GroupId, SampleAssetId, TriggerSampleOptions } from './AudioEngine'
import type { SynthPatch } from '../synth/synthTypes'
import type { OrganicBassPatch } from '../organic-bass/organicBassTypes'
import type { PolyPatch } from '../poly/polyTypes'
import { getStepEventRange } from '../patterns/stepEvents.ts'
import type { ChordVoice } from '../music/chords'
import type { ChordPerformanceSettings } from '../music/chordPerformance'

export interface StepSequencerConfig {
  bpm: number
  swing: number
  metronomeEnabled: boolean
  mode: 'pattern' | 'song'
  loopSong: boolean
  lastSongSlot: number | null
  /** PATTERN mode walks the existing 16-step A-D sections in order. */
  getPatternSectionCount?: () => number
  /** A first take may continue through all four sections before they exist. */
  shouldAutoExtendPattern?: () => boolean
  getTracksForSlot: (slot: number) => readonly StepSequencerTrack[]
  onStepScheduled?: (stepIndex: number, scheduledTime: number, durationSeconds: number, patternSectionIndex: number) => void
  onSongSlotChange?: (slot: number) => void
  /** Called when the final grid boundary has been scheduled. The timestamp is
      in AudioContext time and may still be ahead of the planning callback. */
  onSongComplete?: (completionTime: number) => void
}

interface StepSequencerTrackBase {
  groupId: GroupId
  channelId: ChannelId
  steps: readonly number[]
  shifts: readonly number[]
  /** A merged event stores its whole-step span on its first active cell. */
  lengths: readonly number[]
}

export interface SampleSequencerTrack extends StepSequencerTrackBase {
  source: 'sample'
  assetId: SampleAssetId
  /** Slices from one CHOP session share a mono choke group. */
  chokeGroupId?: string
  options: TriggerSampleOptions
}

export interface SynthSequencerTrack extends StepSequencerTrackBase {
  source: 'synth'
  patch: SynthPatch
  midiNotes: readonly number[]
}

export interface SynthChordSequencerTrack extends StepSequencerTrackBase {
  source: 'synthChord'
  patch: SynthPatch
  voices: readonly ChordVoice[]
  performance: ChordPerformanceSettings
  chordGroupId: string
}

export interface OrganicBassSequencerTrack extends StepSequencerTrackBase {
  source: 'organicBass'
  patch: OrganicBassPatch
  midiNote: number
}

export interface PolySequencerTrack extends StepSequencerTrackBase {
  source: 'poly'
  patch: PolyPatch
  midiNotes: readonly number[]
}

export interface PolyChordSequencerTrack extends StepSequencerTrackBase {
  source: 'polyChord'
  patch: PolyPatch
  voices: readonly ChordVoice[]
  performance: ChordPerformanceSettings
  chordGroupId: string
}

export type StepSequencerTrack = SampleSequencerTrack | SynthSequencerTrack | SynthChordSequencerTrack | OrganicBassSequencerTrack | PolySequencerTrack | PolyChordSequencerTrack

/**
 * Decides when the next scheduling pass happens. Live playback wakes on a
 * timer; an offline render wakes on the render clock itself. Neither is a
 * source of musical time — every event is still stamped against the audio
 * context, and the pass only decides how far ahead the stamps are written.
 */
export interface SequencerTicker {
  wake(callback: () => void): void
  /** No further passes. A render driver uses this to let the tail play out. */
  cancel(): void
}

export interface StepSequencerDiagnostics {
  lateWakeCount: number
  maxLatenessSeconds: number
  skippedExpiredStepCount: number
  skippedExpiredEventCount: number
}

class TimeoutTicker implements SequencerTicker {
  private timer: number | undefined
  private readonly intervalMilliseconds: number

  constructor(intervalMilliseconds: number) { this.intervalMilliseconds = intervalMilliseconds }

  wake(callback: () => void): void {
    this.timer = window.setTimeout(callback, this.intervalMilliseconds)
  }

  cancel(): void {
    if (this.timer !== undefined) window.clearTimeout(this.timer)
    this.timer = undefined
  }
}

export function createTimeoutTicker(intervalMilliseconds = 25): SequencerTicker {
  return new TimeoutTicker(intervalMilliseconds)
}

export class StepSequencer {
  /** Half the normal 25 ms ticker interval. A tiny late wake remains an
      immediate Web Audio start; anything older is musically expired. */
  private static readonly maximumLateStartSeconds = 0.0125
  private nextStepTime = 0
  private nextStepIndex = 0
  private currentSongSlot = 1
  private currentPatternSection = 0
  private running = false
  private hasCompletedSchedulingPass = false
  private lateWakeCount = 0
  private maxLatenessSeconds = 0
  private skippedExpiredStepCount = 0
  private skippedExpiredEventCount = 0
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

  /** `startAt` lets a count-in hand off a future, already-scheduled timestamp instead of "now" - the look-ahead loop in `schedule` reaches it with the same sample accuracy as any other step. */
  start(getConfig: () => StepSequencerConfig, startAt: number = this.audioEngine.getCurrentTime()): void {
    if (this.running) return
    this.running = true
    this.nextStepIndex = 0
    this.currentSongSlot = 1
    this.currentPatternSection = 0
    this.nextStepTime = startAt
    this.hasCompletedSchedulingPass = false
    this.schedule(getConfig)
  }

  stop(): void {
    this.running = false
    this.ticker.cancel()
  }

  isRunning(): boolean { return this.running }

  getDiagnostics(): StepSequencerDiagnostics {
    return {
      lateWakeCount: this.lateWakeCount,
      maxLatenessSeconds: this.maxLatenessSeconds,
      skippedExpiredStepCount: this.skippedExpiredStepCount,
      skippedExpiredEventCount: this.skippedExpiredEventCount,
    }
  }

  private schedule(getConfig: () => StepSequencerConfig): void {
    if (!this.running) return
    const config = getConfig()
    const now = this.audioEngine.getCurrentTime()
    const stepDuration = 60 / config.bpm / 4
    // The ordinary 100 ms look-ahead means a healthy timer wake always finds
    // nextStepTime in the future. If it is already in the past after an
    // earlier pass, the main thread missed part of the transport. Advance the
    // musical cursor without firing expired transient starts; never restart a
    // section/song merely because JavaScript woke late.
    if (this.hasCompletedSchedulingPass && this.nextStepTime < now - StepSequencer.maximumLateStartSeconds) {
      const latenessSeconds = now - this.nextStepTime
      this.lateWakeCount += 1
      this.maxLatenessSeconds = Math.max(this.maxLatenessSeconds, latenessSeconds)
      while (this.running && this.nextStepTime < now - StepSequencer.maximumLateStartSeconds) {
        this.skippedExpiredStepCount += 1
        this.skippedExpiredEventCount += this.countCurrentStepEvents(config, stepDuration)
        if (!this.advanceStep(config, stepDuration)) return
      }
    }
    while (this.nextStepTime < now + this.lookAheadSeconds) {
      const scheduledTime = this.nextStepTime + (this.nextStepIndex % 2 === 1 ? stepDuration * config.swing * 0.5 : 0)
      config.onStepScheduled?.(this.nextStepIndex, scheduledTime, stepDuration, this.currentPatternSection)
      if (config.metronomeEnabled && this.nextStepIndex % 4 === 0) this.audioEngine.scheduleMetronome(scheduledTime, this.nextStepIndex === 0)
      if (config.mode === 'song' && this.nextStepIndex === 0) config.onSongSlotChange?.(this.currentSongSlot)
      const tracks = config.getTracksForSlot(config.mode === 'song' ? this.currentSongSlot : this.currentPatternSection + 1)
      const activeTracks = tracks.flatMap((track) => {
        const velocity = track.steps[this.nextStepIndex]
        if (velocity <= 0) return []
        const event = getStepEventRange(track.steps, track.lengths, this.nextStepIndex)
        if (!event || event.headIndex !== this.nextStepIndex) return []
        const shift = track.shifts[event.headIndex] ?? 0
        const length = event.length
        const unboundedSample = track.source === 'sample' && track.lengths[event.headIndex] === 0
        return [{ track, velocity, length, unboundedSample, when: scheduledTime + shift * stepDuration }]
      })
      const orderedTracks = activeTracks.sort((left, right) => left.when - right.when)
      const lastSimultaneousChord = new Map<string, number>()
      orderedTracks.forEach(({ track, when }, index) => {
        if (track.source === 'synthChord' || track.source === 'polyChord') lastSimultaneousChord.set(`${track.chordGroupId}:${when}`, index)
      })
      for (const [index, { track, velocity, length, unboundedSample, when }] of orderedTracks.entries()) {
        if ((track.source === 'synthChord' || track.source === 'polyChord') && lastSimultaneousChord.get(`${track.chordGroupId}:${when}`) !== index) continue
        if (track.source === 'sample') {
          if (track.chokeGroupId) this.audioEngine.stopSequencerChokeGroupAt(track.chokeGroupId, when)
          const maxDurationSeconds = unboundedSample ? undefined : length * stepDuration
          this.audioEngine.scheduleSample(track.groupId, track.channelId, track.assetId, when, { ...track.options, gain: (track.options.gain ?? 1) * velocity, chokeGroupId: track.chokeGroupId, maxDurationSeconds }, 'sequencer')
        } else if (track.source === 'synthChord') {
          this.audioEngine.releaseSequencerChordAt(track.chordGroupId, when)
          this.audioEngine.scheduleSynthChord(track.groupId, track.channelId, track.patch, track.voices, track.performance, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        } else if (track.source === 'synth') {
          this.audioEngine.scheduleSynthPad(track.groupId, track.channelId, track.patch, track.midiNotes, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        } else if (track.source === 'organicBass') {
          this.audioEngine.scheduleOrganicBassPad(track.groupId, track.channelId, track.patch, track.midiNote, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        } else if (track.source === 'polyChord') {
          this.audioEngine.releaseSequencerChordAt(track.chordGroupId, when)
          this.audioEngine.schedulePolyChord(track.groupId, track.channelId, track.patch, track.voices, track.performance, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        } else if (track.source === 'poly') {
          this.audioEngine.schedulePolyPad(track.groupId, track.channelId, track.patch, track.midiNotes, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        }
      }
      if (!this.advanceStep(config, stepDuration)) return
    }
    this.hasCompletedSchedulingPass = true
    this.ticker.wake(() => this.schedule(getConfig))
  }

  private advanceStep(config: StepSequencerConfig, stepDuration: number): boolean {
    const wasLastStep = this.nextStepIndex === 15
    this.nextStepIndex = (this.nextStepIndex + 1) % 16
    this.nextStepTime += stepDuration
    if (config.mode === 'pattern' && wasLastStep) {
      const requestedSectionCount = config.shouldAutoExtendPattern?.() ? 4 : config.getPatternSectionCount?.() ?? 1
      const sectionCount = Math.min(4, Math.max(1, Math.floor(requestedSectionCount)))
      this.currentPatternSection = (this.currentPatternSection + 1) % sectionCount
    }
    if (config.mode === 'song' && wasLastStep) {
      if (config.lastSongSlot === null || this.currentSongSlot >= config.lastSongSlot) {
        if (config.loopSong && config.lastSongSlot !== null) this.currentSongSlot = 1
        else {
          this.running = false
          this.ticker.cancel()
          config.onSongComplete?.(this.nextStepTime)
          return false
        }
      } else this.currentSongSlot += 1
    }
    return true
  }

  private countCurrentStepEvents(config: StepSequencerConfig, stepDuration: number): number {
    const tracks = config.getTracksForSlot(config.mode === 'song' ? this.currentSongSlot : this.currentPatternSection + 1)
    const simultaneousChordKeys = new Set<string>()
    let count = 0
    for (const track of tracks) {
      if (track.steps[this.nextStepIndex] <= 0) continue
      const event = getStepEventRange(track.steps, track.lengths, this.nextStepIndex)
      if (!event || event.headIndex !== this.nextStepIndex) continue
      if (track.source === 'synthChord' || track.source === 'polyChord') {
        const shift = track.shifts[event.headIndex] ?? 0
        const when = this.nextStepTime + (this.nextStepIndex % 2 === 1 ? stepDuration * config.swing * 0.5 : 0) + shift * stepDuration
        const key = `${track.chordGroupId}:${when}`
        if (simultaneousChordKeys.has(key)) continue
        simultaneousChordKeys.add(key)
      }
      count += 1
    }
    return count
  }
}
