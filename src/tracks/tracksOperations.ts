import type { SampleAssetId } from '../audio/AudioEngine'
import { cloneEffectRackState, createEmptyEffectRack, isEffectRackState } from '../audio/effects'
import type { EffectRackState } from '../audio/effects'
import { beatsToSeconds, secondsToBeats } from './timelineGrid'
import { resolveClipSourceRegion } from './clipSourceRegion'
import { maximumAudioTracks } from './tracksTypes'
import type { AudioClip, AudioTrack } from './tracksTypes'
export { resolveTempoMatchRate } from './tempoMatchRate'

/** Matches Waveform.tsx's minimumSliceSeconds - the same "can't trim a
    region to nothing" floor, reused here for clip source regions. */
export const minimumClipSourceSeconds = 0.01
export const maximumClipFadeSeconds = 10

export function createAudioTrack(id: string, order: number): AudioTrack {
  return { id, name: `TRACK ${order + 1}`, order, muted: false, solo: false, gain: 1, effects: createEmptyEffectRack(id), clips: [] }
}

export function createAudioClipFromImport(id: string, assetId: SampleAssetId, fileName: string, durationSeconds: number, startBeat: number, bpm: number): AudioClip {
  return {
    id,
    assetId,
    fileName,
    assetDurationSeconds: durationSeconds,
    startBeat,
    lengthBeats: secondsToBeats(durationSeconds, bpm),
    sourceOffsetSeconds: 0,
    sourceEndSeconds: durationSeconds,
    gain: 1,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    loop: false,
    reversed: false,
    pitchSemitones: 0,
    tempoMatch: false,
  }
}

export function cloneAudioClip(clip: AudioClip): AudioClip {
  return { ...clip }
}

export function cloneAudioTrack(track: AudioTrack): AudioTrack {
  return { ...track, effects: cloneEffectRackState(track.effects), clips: track.clips.map(cloneAudioClip) }
}

/** Track labels describe their current position, while the imported filename
    remains on the clip itself. Sorting here keeps numbering stable after old
    projects are opened and contiguous after reorder or removal. */
export function normalizeAudioTrackOrder(tracks: readonly AudioTrack[]): AudioTrack[] {
  return [...tracks]
    .sort((left, right) => left.order - right.order)
    .map((track, index) => ({ ...cloneAudioTrack(track), name: `TRACK ${index + 1}`, order: index }))
}

export function findAudioTrack(tracks: readonly AudioTrack[], trackId: string): AudioTrack | undefined {
  return tracks.find((track) => track.id === trackId)
}

export function findAudioClip(track: AudioTrack, clipId: string): AudioClip | undefined {
  return track.clips.find((clip) => clip.id === clipId)
}

function mapClip(tracks: readonly AudioTrack[], trackId: string, clipId: string, transform: (clip: AudioClip) => AudioClip): AudioTrack[] {
  return tracks.map((track) => track.id !== trackId ? cloneAudioTrack(track) : { ...cloneAudioTrack(track), clips: track.clips.map((clip) => clip.id === clipId ? transform(cloneAudioClip(clip)) : cloneAudioClip(clip)) })
}

export function addAudioTrack(tracks: readonly AudioTrack[], track: AudioTrack): AudioTrack[] {
  // The maximumAudioTracks cap is enforced at the call site (disable the "add
  // track" control), matching how maximumPatternGroups is enforced in
  // TransportBar rather than inside addPatternClip-style operations.
  return normalizeAudioTrackOrder([...tracks, track])
}

export function removeAudioTrack(tracks: readonly AudioTrack[], trackId: string): AudioTrack[] {
  return normalizeAudioTrackOrder(tracks.filter((track) => track.id !== trackId))
}

/** Swaps the track with its neighbour in order - the only reorder shape
    needed for a small, phone-friendly track list; a free drag is a UI-only
    affordance that still resolves to repeated calls of this. */
export function moveAudioTrack(tracks: readonly AudioTrack[], trackId: string, direction: 'up' | 'down'): AudioTrack[] {
  const sorted = [...tracks].sort((left, right) => left.order - right.order)
  const index = sorted.findIndex((track) => track.id === trackId)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return normalizeAudioTrackOrder(tracks)
  const reordered = [...sorted]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(targetIndex, 0, moved)
  return normalizeAudioTrackOrder(reordered.map((track, newIndex) => ({ ...track, order: newIndex })))
}

export function setAudioTrackMuted(tracks: readonly AudioTrack[], trackId: string, muted: boolean): AudioTrack[] {
  return tracks.map((track) => track.id === trackId ? { ...cloneAudioTrack(track), muted } : cloneAudioTrack(track))
}

export function setAudioTrackSolo(tracks: readonly AudioTrack[], trackId: string, solo: boolean): AudioTrack[] {
  return tracks.map((track) => track.id === trackId ? { ...cloneAudioTrack(track), solo } : cloneAudioTrack(track))
}

export function setAudioTrackGain(tracks: readonly AudioTrack[], trackId: string, gain: number): AudioTrack[] {
  return tracks.map((track) => track.id === trackId ? { ...cloneAudioTrack(track), gain: Math.min(1, Math.max(0, gain)) } : cloneAudioTrack(track))
}

export function setAudioTrackEffects(tracks: readonly AudioTrack[], trackId: string, effects: EffectRackState): AudioTrack[] {
  return tracks.map((track) => track.id === trackId ? { ...cloneAudioTrack(track), effects: cloneEffectRackState(effects) } : cloneAudioTrack(track))
}

/** Generic field patch (gain, fadeIn/Out, reversed, pitchSemitones,
    tempoMatch, and toggling loop on/off) - anything that doesn't need
    cross-field math. Move/trim/split/loop-region below cover the rest. */
export function updateAudioClip(tracks: readonly AudioTrack[], trackId: string, clipId: string, changes: Partial<AudioClip>): AudioTrack[] {
  return mapClip(tracks, trackId, clipId, (clip) => ({ ...clip, ...changes }))
}

export function addAudioClip(tracks: readonly AudioTrack[], trackId: string, clip: AudioClip): AudioTrack[] {
  return tracks.map((track) => track.id !== trackId ? cloneAudioTrack(track) : { ...cloneAudioTrack(track), clips: [...track.clips.map(cloneAudioClip), cloneAudioClip(clip)] })
}

export function removeAudioClip(tracks: readonly AudioTrack[], trackId: string, clipId: string): AudioTrack[] {
  return tracks.map((track) => track.id !== trackId ? cloneAudioTrack(track) : { ...cloneAudioTrack(track), clips: track.clips.filter((clip) => clip.id !== clipId).map(cloneAudioClip) })
}

/** Places the duplicate immediately after the original on the same track,
    so it never silently lands exactly on top of it - the user drags it from
    there. */
export function duplicateAudioClip(tracks: readonly AudioTrack[], trackId: string, clipId: string, newClipId: string): AudioTrack[] {
  const track = findAudioTrack(tracks, trackId)
  const clip = track && findAudioClip(track, clipId)
  if (!track || !clip) return tracks.map(cloneAudioTrack)
  const duplicate: AudioClip = { ...cloneAudioClip(clip), id: newClipId, startBeat: clip.startBeat + clip.lengthBeats }
  return tracks.map((candidate) => candidate.id !== trackId ? cloneAudioTrack(candidate) : { ...cloneAudioTrack(candidate), clips: [...candidate.clips.map(cloneAudioClip), duplicate] })
}

export function moveAudioClip(tracks: readonly AudioTrack[], trackId: string, clipId: string, newStartBeat: number): AudioTrack[] {
  return mapClip(tracks, trackId, clipId, (clip) => ({ ...clip, startBeat: Math.max(0, newStartBeat) }))
}

/**
 * Cuts one clip into two at atBeat, non-destructively: both halves keep
 * referencing the same asset, splitting only the timeline placement and the
 * source region at the same point, so the join is sample-accurate and
 * nothing is re-encoded or copied. Not supported on a looped clip in this
 * version - splitting a single repeating cycle is a separate, deferred
 * question (see AudioClip's docs); the call is a no-op in that case.
 */
export function splitAudioClipAt(tracks: readonly AudioTrack[], trackId: string, clipId: string, atBeat: number, newClipId: string, bpm: number): AudioTrack[] {
  const track = findAudioTrack(tracks, trackId)
  const clip = track && findAudioClip(track, clipId)
  if (!track || !clip || clip.loop) return tracks.map(cloneAudioTrack)
  const clipEndBeat = clip.startBeat + clip.lengthBeats
  const minimumBeats = secondsToBeats(minimumClipSourceSeconds, bpm)
  if (atBeat <= clip.startBeat + minimumBeats || atBeat >= clipEndBeat - minimumBeats) return tracks.map(cloneAudioTrack)
  const splitSourceTime = clip.sourceOffsetSeconds + beatsToSeconds(atBeat - clip.startBeat, bpm)
  const leftClip: AudioClip = { ...cloneAudioClip(clip), lengthBeats: atBeat - clip.startBeat, sourceEndSeconds: splitSourceTime }
  const rightClip: AudioClip = { ...cloneAudioClip(clip), id: newClipId, startBeat: atBeat, lengthBeats: clipEndBeat - atBeat, sourceOffsetSeconds: splitSourceTime }
  return tracks.map((candidate) => candidate.id !== trackId ? cloneAudioTrack(candidate) : { ...cloneAudioTrack(candidate), clips: candidate.clips.flatMap((existing) => existing.id === clipId ? [leftClip, rightClip] : [cloneAudioClip(existing)]) })
}

/**
 * Drags the left edge: the clip's timeline end stays anchored, its start
 * moves and sourceOffsetSeconds absorbs the same delta, exactly like
 * SampleEditor.tsx's region start handle. No-op on a looped clip - see
 * setAudioClipLoopRegion for changing what a loop's cycle sounds like
 * without moving its timeline placement.
 */
export function trimAudioClipStart(tracks: readonly AudioTrack[], trackId: string, clipId: string, newStartBeat: number, bpm: number): AudioTrack[] {
  return mapClip(tracks, trackId, clipId, (clip) => {
    if (clip.loop) return clip
    const requestedOffset = clip.sourceOffsetSeconds + beatsToSeconds(Math.max(0, newStartBeat) - clip.startBeat, bpm)
    const clampedOffset = Math.min(Math.max(0, requestedOffset), clip.sourceEndSeconds - minimumClipSourceSeconds)
    const actualDeltaBeats = secondsToBeats(clampedOffset - clip.sourceOffsetSeconds, bpm)
    const clampedStartBeat = Math.max(0, clip.startBeat + actualDeltaBeats)
    return { ...clip, startBeat: clampedStartBeat, lengthBeats: clip.startBeat + clip.lengthBeats - clampedStartBeat, sourceOffsetSeconds: clampedOffset }
  })
}

/** Drags the right edge: the clip's timeline start stays anchored, its
    length and sourceEndSeconds absorb the delta together. No-op on a looped
    clip - see setAudioClipLoopLengthBeats. */
export function trimAudioClipEnd(tracks: readonly AudioTrack[], trackId: string, clipId: string, newEndBeat: number, bpm: number, sourceDurationSeconds: number): AudioTrack[] {
  return mapClip(tracks, trackId, clipId, (clip) => {
    if (clip.loop) return clip
    const clipEndBeat = clip.startBeat + clip.lengthBeats
    const requestedEnd = clip.sourceEndSeconds + beatsToSeconds(newEndBeat - clipEndBeat, bpm)
    const clampedEnd = Math.min(sourceDurationSeconds, Math.max(clip.sourceOffsetSeconds + minimumClipSourceSeconds, requestedEnd))
    const actualDeltaBeats = secondsToBeats(clampedEnd - clip.sourceEndSeconds, bpm)
    return { ...clip, lengthBeats: Math.max(secondsToBeats(minimumClipSourceSeconds, bpm), clip.lengthBeats + actualDeltaBeats), sourceEndSeconds: clampedEnd }
  })
}

/**
 * Selects a fresh region directly on the full source waveform. Unlike the
 * timeline's left-edge trim, this keeps the clip anchored at its current
 * timeline start: the user is choosing source material, not moving it. A
 * normal clip's visible length follows the selected duration; a looped
 * clip keeps its independent timeline footprint.
 */
export function setAudioClipSourceRegion(tracks: readonly AudioTrack[], trackId: string, clipId: string, startSeconds: number, endSeconds: number, sourceDurationSeconds: number, bpm: number): AudioTrack[] {
  return mapClip(tracks, trackId, clipId, (clip) => resolveClipSourceRegion(clip, startSeconds, endSeconds, sourceDurationSeconds, bpm))
}

/** How long a looped clip's timeline footprint is - independent of its
    source region, since looping tiles that region to fill whatever space
    it's given (see AudioClip's docs). No-op unless the clip is looped. */
export function setAudioClipLoopLengthBeats(tracks: readonly AudioTrack[], trackId: string, clipId: string, lengthBeats: number, bpm: number): AudioTrack[] {
  return mapClip(tracks, trackId, clipId, (clip) => clip.loop ? { ...clip, lengthBeats: Math.max(secondsToBeats(minimumClipSourceSeconds, bpm), lengthBeats) } : clip)
}

/** What one loop cycle sounds like - independent of the clip's timeline
    placement. No-op unless the clip is looped. */
export function setAudioClipLoopRegion(tracks: readonly AudioTrack[], trackId: string, clipId: string, sourceOffsetSeconds: number, sourceEndSeconds: number, sourceDurationSeconds: number): AudioTrack[] {
  return mapClip(tracks, trackId, clipId, (clip) => {
    if (!clip.loop) return clip
    const start = Math.min(Math.max(0, sourceOffsetSeconds), sourceDurationSeconds - minimumClipSourceSeconds)
    const end = Math.min(sourceDurationSeconds, Math.max(start + minimumClipSourceSeconds, sourceEndSeconds))
    return { ...clip, sourceOffsetSeconds: start, sourceEndSeconds: end }
  })
}

export function collectAudioTrackAssetIds(tracks: readonly AudioTrack[]): Set<SampleAssetId> {
  const ids = new Set<SampleAssetId>()
  for (const track of tracks) for (const clip of track.clips) ids.add(clip.assetId)
  return ids
}

export function validateAudioTracks(tracks: readonly AudioTrack[], knownAssetIds: ReadonlySet<SampleAssetId>): string[] {
  const errors: string[] = []
  if (tracks.length > maximumAudioTracks) errors.push(`Project cannot contain more than ${maximumAudioTracks} audio tracks.`)
  const trackIds = new Set<string>()
  const orders = new Set<number>()
  for (const track of tracks) {
    if (!track.id || trackIds.has(track.id)) errors.push('Audio track IDs must be unique.')
    trackIds.add(track.id)
    if (!Number.isInteger(track.order) || track.order < 0 || track.order >= tracks.length) errors.push(`${track.name || track.id} has an invalid order.`)
    orders.add(track.order)
    if (!Number.isFinite(track.gain) || track.gain < 0 || track.gain > 1) errors.push(`${track.name || track.id} has an invalid gain.`)
    if (typeof track.muted !== 'boolean' || typeof track.solo !== 'boolean') errors.push(`${track.name || track.id} has an invalid mute/solo state.`)
    if (!isEffectRackState(track.effects, track.id)) errors.push(`${track.name || track.id} has invalid effects.`)
    const clipIds = new Set<string>()
    for (const clip of track.clips) {
      if (!clip.id || clipIds.has(clip.id)) errors.push(`${track.name || track.id} has duplicate clip IDs.`)
      clipIds.add(clip.id)
      if (!knownAssetIds.has(clip.assetId)) errors.push(`${track.name || track.id} references a missing asset.`)
      if (!clip.fileName || !Number.isFinite(clip.assetDurationSeconds) || clip.assetDurationSeconds <= 0) errors.push(`${track.name || track.id} has a clip with invalid asset metadata.`)
      if (!Number.isFinite(clip.startBeat) || clip.startBeat < 0) errors.push(`${track.name || track.id} has a clip with an invalid start position.`)
      if (!Number.isFinite(clip.lengthBeats) || clip.lengthBeats <= 0) errors.push(`${track.name || track.id} has a clip with an invalid length.`)
      if (!Number.isFinite(clip.sourceOffsetSeconds) || !Number.isFinite(clip.sourceEndSeconds) || clip.sourceEndSeconds <= clip.sourceOffsetSeconds || clip.sourceOffsetSeconds < 0) errors.push(`${track.name || track.id} has a clip with an invalid source region.`)
      if (!Number.isFinite(clip.gain) || clip.gain < 0 || clip.gain > 1) errors.push(`${track.name || track.id} has a clip with an invalid gain.`)
      if (!Number.isFinite(clip.fadeInSeconds) || clip.fadeInSeconds < 0 || clip.fadeInSeconds > maximumClipFadeSeconds) errors.push(`${track.name || track.id} has a clip with an invalid fade in.`)
      if (!Number.isFinite(clip.fadeOutSeconds) || clip.fadeOutSeconds < 0 || clip.fadeOutSeconds > maximumClipFadeSeconds) errors.push(`${track.name || track.id} has a clip with an invalid fade out.`)
      if (!Number.isFinite(clip.pitchSemitones)) errors.push(`${track.name || track.id} has a clip with an invalid pitch.`)
      if (typeof clip.loop !== 'boolean' || typeof clip.reversed !== 'boolean' || typeof clip.tempoMatch !== 'boolean') errors.push(`${track.name || track.id} has a clip with invalid flags.`)
    }
  }
  if (orders.size !== tracks.length) errors.push('Audio track order values must be unique.')
  return errors
}
