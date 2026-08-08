import type { AudioEngine, ChannelId, GroupId, SampleAssetId, TriggerSampleOptions } from './AudioEngine'
import type { SynthPatch } from '../synth/synthTypes'
import type { StringsPatch } from '../strings/stringsTypes'

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

interface StepSequencerTrackBase {
  groupId: GroupId
  channelId: ChannelId
  steps: readonly number[]
  shifts: readonly number[]
  /** Whole steps per index; 0 means unbounded and only applies to a sample track. */
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
  midiNotes: readonly number[]
  chordGroupId: string
}

export interface StringsSequencerTrack extends StepSequencerTrackBase {
  source: 'strings'
  patch: StringsPatch
  midiNotes: readonly number[]
}

export interface StringsChordSequencerTrack extends StepSequencerTrackBase {
  source: 'stringsChord'
  patch: StringsPatch
  midiNotes: readonly number[]
  chordGroupId: string
}

export type StepSequencerTrack = SampleSequencerTrack | SynthSequencerTrack | SynthChordSequencerTrack | StringsSequencerTrack | StringsChordSequencerTrack

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
  private nextStepTime = 0
  private nextStepIndex = 0
  private currentSongSlot = 1
  private running = false
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
    this.nextStepTime = startAt
    this.schedule(getConfig)
  }

  stop(): void {
    this.running = false
    this.ticker.cancel()
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
      const activeTracks = tracks.flatMap((track) => {
        const velocity = track.steps[this.nextStepIndex]
        if (velocity <= 0) return []
        const shift = track.shifts[this.nextStepIndex] ?? 0
        const length = track.lengths[this.nextStepIndex] ?? 0
        return [{ track, velocity, length, when: scheduledTime + shift * stepDuration }]
      })
      const orderedTracks = activeTracks.sort((left, right) => left.when - right.when)
      const lastSimultaneousChord = new Map<string, number>()
      orderedTracks.forEach(({ track, when }, index) => {
        if (track.source === 'synthChord' || track.source === 'stringsChord') lastSimultaneousChord.set(`${track.chordGroupId}:${when}`, index)
      })
      for (const [index, { track, velocity, length, when }] of orderedTracks.entries()) {
        if ((track.source === 'synthChord' || track.source === 'stringsChord') && lastSimultaneousChord.get(`${track.chordGroupId}:${when}`) !== index) continue
        if (track.source === 'sample') {
          if (track.chokeGroupId) this.audioEngine.stopSequencerChokeGroupAt(track.chokeGroupId, when)
          const maxDurationSeconds = length > 0 ? length * stepDuration : undefined
          this.audioEngine.scheduleSample(track.groupId, track.channelId, track.assetId, when, { ...track.options, gain: (track.options.gain ?? 1) * velocity, chokeGroupId: track.chokeGroupId, maxDurationSeconds }, 'sequencer')
        } else if (track.source === 'synthChord') {
          this.audioEngine.releaseSequencerChordAt(track.chordGroupId, when)
          this.audioEngine.scheduleSynthChord(track.groupId, track.channelId, track.patch, track.midiNotes, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        } else if (track.source === 'synth') {
          this.audioEngine.scheduleSynthPad(track.groupId, track.channelId, track.patch, track.midiNotes, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        } else if (track.source === 'stringsChord') {
          this.audioEngine.releaseSequencerChordAt(track.chordGroupId, when)
          this.audioEngine.scheduleStringsPad(track.groupId, track.channelId, track.patch, track.midiNotes, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        } else {
          this.audioEngine.scheduleStringsPad(track.groupId, track.channelId, track.patch, track.midiNotes, when, when + Math.max(1, length) * track.patch.gate * stepDuration, velocity)
        }
      }
      const wasLastStep = this.nextStepIndex === 15
      this.nextStepIndex = (this.nextStepIndex + 1) % 16
      this.nextStepTime += stepDuration
      if (config.mode === 'song' && wasLastStep) {
        if (config.lastSongSlot === null || this.currentSongSlot >= config.lastSongSlot) {
          if (config.loopSong && config.lastSongSlot !== null) this.currentSongSlot = 1
          else {
            this.running = false
            this.ticker.cancel()
            config.onSongComplete?.()
            return
          }
        } else this.currentSongSlot += 1
      }
    }
    this.ticker.wake(() => this.schedule(getConfig))
  }
}
