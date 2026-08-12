import { createChannelId } from '../audio/channelIdentity'
import type { SampleAssetId } from '../audio/AudioEngine'
import type { StepSequencerTrack } from '../audio/StepSequencer'
import type { PadState } from '../pads/types'
import { getVariant, getVariantLengths, getVariantShifts } from '../patterns/patternOperations'
import type { PatternGroup, PatternVariantName, StepLengthPattern, StepPattern, StepShiftPattern } from '../patterns/patternTypes'
import { getActiveClipsForSlot } from './songOperations'
import type { PatternClip } from './songTypes'
import { getSynthPatch, resolveSynthPadMidiNotes } from '../synth/synthOperations'
import { getStringsPatch, resolveStringsPadMidiNotes } from '../strings/stringsOperations'
import { getOrganicBassPatch, resolveOrganicBassPadMidiNote } from '../organic-bass/organicBassOperations'
import type { ProjectKey } from '../music/scales'
import { getPolyPatch, resolvePolyPadMidiNotes } from '../poly/polyOperations'
import { resolveChordMidiNotes } from '../music/chords'

/** Reports whether the audio engine currently holds a decoded asset. */
export type SampleAssetPredicate = (assetId: SampleAssetId) => boolean

interface ResolvedVariant {
  group: PatternGroup
  steps: StepPattern
  shifts: StepShiftPattern
  lengths: StepLengthPattern
}

/**
 * The transport and the offline render both need to answer "what plays in this
 * slot". They read it from here so a rendered file cannot drift away from what
 * the sequencer plays.
 */
export function getSongTracksForSlot(groups: readonly PatternGroup[], playlist: readonly PatternClip[], slot: number, hasSampleAsset: SampleAssetPredicate, projectKey: ProjectKey): StepSequencerTrack[] {
  const variants = getActiveClipsForSlot(playlist, slot).map((clip) => resolveVariant(groups, clip.patternGroupId, clip.variant))
  return toTracks(variants, hasSampleAsset, projectKey)
}

export function getPatternTracks(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, hasSampleAsset: SampleAssetPredicate, projectKey: ProjectKey): StepSequencerTrack[] {
  return toTracks([resolveVariant(groups, groupId, variant)], hasSampleAsset, projectKey)
}

function resolveVariant(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName): ResolvedVariant | undefined {
  const group = groups.find((candidate) => candidate.id === groupId)
  const steps = getVariant(groups, groupId, variant)
  const shifts = getVariantShifts(groups, groupId, variant)
  const lengths = getVariantLengths(groups, groupId, variant)
  return group && steps && shifts && lengths ? { group, steps, shifts, lengths } : undefined
}

function toTracks(variants: readonly (ResolvedVariant | undefined)[], hasSampleAsset: SampleAssetPredicate, projectKey: ProjectKey): StepSequencerTrack[] {
  return variants.flatMap((pattern) => {
    if (!pattern) return []
    return pattern.group.bank.pads.flatMap<StepSequencerTrack>((pad, padIndex) => {
      const common = {
        groupId: pattern.group.id,
        channelId: createChannelId({ patternGroupId: pattern.group.id, padId: pad.id }),
        steps: pattern.steps[pad.id],
        shifts: pattern.shifts[pad.id],
        lengths: pattern.lengths[pad.id],
      }
      const chordAssignment = pattern.group.padMode === 'chords' ? pattern.group.chordAssignments[padIndex] : null
      const patch = getSynthPatch(pattern.group, pad.synthPatchId)
      if (patch) return chordAssignment
        ? [{ ...common, source: 'synthChord', chordGroupId: pattern.group.id, patch, midiNotes: resolveChordMidiNotes(pattern.group, pad, chordAssignment, projectKey) }]
        : [{ ...common, source: 'synth', patch, midiNotes: resolveSynthPadMidiNotes(patch, pad) }]
      const stringsPatch = getStringsPatch(pattern.group, pad.stringsPatchId)
      if (stringsPatch) return chordAssignment
        ? [{ ...common, source: 'stringsChord', chordGroupId: pattern.group.id, patch: stringsPatch, midiNotes: resolveChordMidiNotes(pattern.group, pad, chordAssignment, projectKey) }]
        : [{ ...common, source: 'strings', patch: stringsPatch, midiNotes: resolveStringsPadMidiNotes(stringsPatch, pad) }]
      const organicBassPatch = getOrganicBassPatch(pattern.group, pad.organicBassPatchId)
      if (organicBassPatch) return [{ ...common, source: 'organicBass', patch: organicBassPatch, midiNote: resolveOrganicBassPadMidiNote(organicBassPatch, pad) }]
      const polyPatch = getPolyPatch(pattern.group, pad.polyPatchId)
      if (polyPatch) return chordAssignment
        ? [{ ...common, source: 'polyChord', chordGroupId: pattern.group.id, patch: polyPatch, midiNotes: resolveChordMidiNotes(pattern.group, pad, chordAssignment, projectKey) }]
        : [{ ...common, source: 'poly', patch: polyPatch, midiNotes: resolvePolyPadMidiNotes(polyPatch, pad) }]
      if (!pad.assetId || !hasSampleAsset(pad.assetId)) return []
      const samplePad = pad as PadState & { assetId: SampleAssetId }
      return [{
        ...common,
        source: 'sample',
        assetId: samplePad.assetId,
        chokeGroupId: pad.chopSessionId ?? undefined,
        options: { pitchSemitones: pad.pitchSemitones, startSeconds: pad.region.startSeconds, endSeconds: pad.region.endSeconds, attackMs: pad.attackMs, releaseMs: pad.releaseMs, reversed: pad.reversed },
      }]
    })
  })
}
