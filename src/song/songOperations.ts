import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import type { PatternClip } from './songTypes'

export function addPatternClip(clips: readonly PatternClip[], clip: PatternClip): PatternClip[] {
  if (!Number.isInteger(clip.startSlot) || clip.startSlot < 1) throw new Error('Playlist slot must be a positive whole number.')
  return [...clips.map((item) => ({ ...item })), { ...clip }]
}

export function removePatternClip(clips: readonly PatternClip[], clipId: string): PatternClip[] {
  return clips.filter((clip) => clip.id !== clipId).map((clip) => ({ ...clip }))
}

export function copyPatternClip(clips: readonly PatternClip[], clipId: string, id: string): PatternClip[] {
  const clip = clips.find((item) => item.id === clipId)
  if (!clip) throw new Error('Playlist clip was not found.')
  return addPatternClip(clips, { ...clip, id })
}

export function movePatternClip(clips: readonly PatternClip[], clipId: string, startSlot: number): PatternClip[] {
  if (!Number.isInteger(startSlot) || startSlot < 1) throw new Error('Playlist slot must be a positive whole number.')
  return clips.map((clip) => clip.id === clipId ? { ...clip, startSlot } : { ...clip })
}

export function getActiveClipsForSlot(clips: readonly PatternClip[], slot: number): PatternClip[] {
  return clips.filter((clip) => clip.startSlot === slot).map((clip) => ({ ...clip }))
}

export function getLastOccupiedSlot(clips: readonly PatternClip[]): number | null {
  return clips.length === 0 ? null : Math.max(...clips.map((clip) => clip.startSlot))
}

export function removeClipsForVariant(clips: readonly PatternClip[], patternGroupId: string, variant: PatternVariantName): PatternClip[] {
  return clips.filter((clip) => clip.patternGroupId !== patternGroupId || clip.variant !== variant).map((clip) => ({ ...clip }))
}

export function removeClipsForGroup(clips: readonly PatternClip[], patternGroupId: string): PatternClip[] {
  return clips.filter((clip) => clip.patternGroupId !== patternGroupId).map((clip) => ({ ...clip }))
}

export function validatePatternClipReferences(clips: readonly PatternClip[], groups: readonly PatternGroup[]): string[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]))
  const ids = new Set<string>()
  const errors: string[] = []
  for (const clip of clips) {
    if (!clip.id || ids.has(clip.id)) errors.push('Playlist clip IDs must be unique.')
    ids.add(clip.id)
    if (!Number.isInteger(clip.startSlot) || clip.startSlot < 1) errors.push('Playlist clips require a positive whole-number start slot.')
    const group = groupsById.get(clip.patternGroupId)
    if (!group || !group.variants[clip.variant]) errors.push('Playlist clip references a missing Pattern Group variant.')
  }
  return errors
}
