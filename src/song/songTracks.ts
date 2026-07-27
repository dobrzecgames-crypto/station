import { createChannelId } from '../audio/channelIdentity'
import type { SampleAssetId } from '../audio/AudioEngine'
import type { StepSequencerTrack } from '../audio/StepSequencer'
import type { PadState } from '../pads/types'
import { getVariant, getVariantShifts } from '../patterns/patternOperations'
import type { PatternGroup, PatternVariantName, StepPattern, StepShiftPattern } from '../patterns/patternTypes'
import { getActiveClipsForSlot } from './songOperations'
import type { PatternClip } from './songTypes'

/** Reports whether the audio engine currently holds a decoded asset. */
export type SampleAssetPredicate = (assetId: SampleAssetId) => boolean

interface ResolvedVariant {
  group: PatternGroup
  steps: StepPattern
  shifts: StepShiftPattern
}

/**
 * The transport and the offline render both need to answer "what plays in this
 * slot". They read it from here so a rendered file cannot drift away from what
 * the sequencer plays.
 */
export function getSongTracksForSlot(groups: readonly PatternGroup[], playlist: readonly PatternClip[], slot: number, hasSampleAsset: SampleAssetPredicate): StepSequencerTrack[] {
  const variants = getActiveClipsForSlot(playlist, slot).map((clip) => resolveVariant(groups, clip.patternGroupId, clip.variant))
  return toTracks(variants, hasSampleAsset)
}

export function getPatternTracks(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, hasSampleAsset: SampleAssetPredicate): StepSequencerTrack[] {
  return toTracks([resolveVariant(groups, groupId, variant)], hasSampleAsset)
}

function resolveVariant(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName): ResolvedVariant | undefined {
  const group = groups.find((candidate) => candidate.id === groupId)
  const steps = getVariant(groups, groupId, variant)
  const shifts = getVariantShifts(groups, groupId, variant)
  return group && steps && shifts ? { group, steps, shifts } : undefined
}

function toTracks(variants: readonly (ResolvedVariant | undefined)[], hasSampleAsset: SampleAssetPredicate): StepSequencerTrack[] {
  return variants.flatMap((pattern) => {
    if (!pattern) return []
    return pattern.group.bank.pads
      .filter((pad): pad is PadState & { assetId: SampleAssetId } => pad.assetId !== null && hasSampleAsset(pad.assetId))
      .map<StepSequencerTrack>((pad) => ({
        groupId: pattern.group.id,
        channelId: createChannelId({ patternGroupId: pattern.group.id, padId: pad.id }),
        assetId: pad.assetId,
        steps: pattern.steps[pad.id],
        shifts: pattern.shifts[pad.id],
        chokeGroupId: pad.chopSessionId ?? undefined,
        options: { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds, attackMs: pad.attackMs, releaseMs: pad.releaseMs },
      }))
  })
}
