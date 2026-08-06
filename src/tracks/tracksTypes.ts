import type { SampleAssetId } from '../audio/AudioEngine'
import type { EffectRackState } from '../audio/effects'

/** Matches the existing 8 Pattern Group cap (patterns/patternTypes.ts) - a
    deliberate first-version limit, not a technical ceiling. Raising it later
    is a one-constant change. */
export const maximumAudioTracks = 8

export const timelineGridDivisions = ['1', '1/2', '1/4', '1/8', '1/16', 'off'] as const
export type TimelineGridDivision = typeof timelineGridDivisions[number]

/** Discrete visual sizes for a track lane/waveform/clip in the wide
    TracksArranger view only - a UI preference (see useTracksViewState),
    never persisted project data, deliberately not a continuous/CSS-scale
    value. Ordered mini-to-large so a +/- control can index into this array
    directly. See docs/DECISIONS.md DEC-027's third addendum. */
export const trackHeightLevels = ['mini', 'small', 'medium', 'large'] as const
export type TrackHeightLevel = typeof trackHeightLevels[number]

/**
 * A non-destructive region of one shared SampleAsset placed on a track's
 * timeline - the audio-track equivalent of a Pad's SamplePlaybackRegion
 * (pads/types.ts), never a copy of the source file.
 *
 * Two coordinate spaces on purpose, mirroring how a Pad already separates
 * its region (source seconds) from pattern placement (steps):
 * - sourceOffsetSeconds/sourceEndSeconds: which part of the source plays, at
 *   natural (rate 1) speed - what TRIM edits, exactly like a Pad region.
 * - startBeat/lengthBeats: where this clip sits on the project timeline, in
 *   beats (quarter notes) at the project BPM - what MOVE and the visual
 *   timeline use. For a non-looped clip this is kept in sync with the
 *   source region's natural duration (see tracksOperations.ts); for a
 *   looped clip it is independently draggable, since looping tiles the
 *   region to fill however much timeline space it is given.
 *
 * The engine always truncates actual playback at startBeat+lengthBeats
 * (see AudioEngine.scheduleClip), so a pitched or tempo-matched clip's
 * audible length can differ slightly from its natural region length but
 * never bleeds past its own timeline slot into the next clip.
 */
export interface AudioClip {
  id: string
  assetId: SampleAssetId
  /** Denormalized alongside assetId, the same way PadState/ChopSessionState
      already carry fileName/durationSeconds next to their asset reference -
      lets the project snapshot build its assets list without an extra
      engine round-trip per clip. */
  fileName: string
  assetDurationSeconds: number
  startBeat: number
  lengthBeats: number
  sourceOffsetSeconds: number
  sourceEndSeconds: number
  gain: number
  fadeInSeconds: number
  fadeOutSeconds: number
  loop: boolean
  /** Plays this clip's region back to front, from the same lazily-cached
      whole-asset reversed buffer a reversed Pad or CHOP slice already uses
      (AudioEngine.ensureReversedBuffer) - never a per-clip copy. */
  reversed: boolean
  /** Optional. Implemented as playback-rate like a Pad's pitch (DEC-008) -
      no time-stretching. */
  pitchSemitones: number
  /** Optional. When true, playback rate is additionally scaled by
      projectBpm/detectedSourceBpm (see tracksOperations.ts's
      resolveTempoMatchRate) - a rate-based tempo match, not a real stretch,
      so it also shifts pitch. Stacks with pitchSemitones. */
  tempoMatch: boolean
}

/**
 * A linear audio track - deliberately separate from the existing
 * StepSequencerTrack (audio/StepSequencer.ts), which is an ephemeral,
 * never-persisted "this pad plays this pattern" instruction built on the
 * fly by song/songTracks.ts. AudioTrack/AudioClip are the persisted TRACKS
 * arrangement; nothing here is read by the pattern/song scheduler and
 * nothing there is read by TimelineScheduler.
 *
 * Each track is its own independent mixer bus - structurally identical to a
 * Pattern Group's bus+FX (patterns/patternTypes.ts's GroupBusState/effects),
 * addressed in the engine by the track's own id doing double duty as both
 * groupId and channelId (AudioEngine.ensureGroupBus/ensureGroupEffects/
 * ensureChannel are already generic over any string id - see DECISIONS.md
 * DEC-027). One channel per track, not 16 like a Pattern Group's pad bank,
 * since a track's clips share one fader.
 */
export interface AudioTrack {
  id: string
  name: string
  /** Display/playback order, 0-based, dense - see reorder helpers in
      tracksOperations.ts. */
  order: number
  muted: boolean
  solo: boolean
  gain: number
  effects: EffectRackState
  clips: AudioClip[]
}

/** UI-only selection - never persisted, matching how DATA_MODEL.md already
    treats Pad/Chop selection. Lives in component state, not here. */
export interface AudioTrackSelection {
  trackId: string
  clipId: string | null
}
