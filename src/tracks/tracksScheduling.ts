import type { GroupId } from '../audio/AudioEngine'
import type { TimelineSchedulerClip } from '../audio/TimelineScheduler'
import { resolveTempoMatchRate } from './tracksOperations'
import type { AudioTrack } from './tracksTypes'

/**
 * Converts persisted AudioTrack/AudioClip data into the engine-shaped
 * TimelineSchedulerClip list TimelineScheduler consumes - the same role
 * song/songTracks.ts plays converting PatternGroup into StepSequencerTrack.
 *
 * Mute/solo/track gain are NOT applied to the returned clip gain: a track is
 * its own live engine bus (AudioEngine.setGroupVolume/Muted/Solo, driven
 * directly by App.tsx's track handlers - see tracksTypes.ts's AudioTrack
 * docs), so baking track.gain into every clip here would double it on top
 * of the bus gain node already downstream. Every clip is still scheduled
 * even on a muted/non-solo'd track; the engine's own gain graph silences it,
 * exactly how a muted Pattern Group's pads are handled.
 */
export function toTimelineSchedulerClips(tracks: readonly AudioTrack[], detectedSourceBpmByAsset: Readonly<Record<string, number | null>>, projectBpm: number): TimelineSchedulerClip[] {
  return tracks.flatMap((track) => track.clips.map((clip): TimelineSchedulerClip => ({
    trackId: track.id as GroupId,
    clipId: clip.id,
    assetId: clip.assetId,
    startBeat: clip.startBeat,
    lengthBeats: clip.lengthBeats,
    sourceOffsetSeconds: clip.sourceOffsetSeconds,
    sourceEndSeconds: clip.sourceEndSeconds,
    gain: clip.gain,
    fadeInSeconds: clip.fadeInSeconds,
    fadeOutSeconds: clip.fadeOutSeconds,
    loop: clip.loop,
    reversed: clip.reversed,
    pitchSemitones: clip.pitchSemitones,
    tempoRate: resolveTempoMatchRate(clip.tempoMatch, detectedSourceBpmByAsset[clip.assetId] ?? null, projectBpm),
  })))
}
