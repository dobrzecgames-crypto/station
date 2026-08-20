import { cloneOrganicBassPatch } from '../organic-bass/organicBassOperations.ts'
import type { OrganicBassPatch } from '../organic-bass/organicBassTypes'
import { clonePolyPatch } from '../poly/polyOperations.ts'
import type { PolyPatch } from '../poly/polyTypes'
import { cloneSynthPatch } from '../synth/synthOperations.ts'
import type { SynthPatch } from '../synth/synthTypes'

export const userSynthPresetSchemaVersion = 1
export const userSynthPresetKinds = ['basic', 'monogorg', 'zola-x'] as const

export type UserSynthPresetKind = typeof userSynthPresetKinds[number]

export interface UserSynthPresetPatchMap {
  basic: SynthPatch
  monogorg: OrganicBassPatch
  'zola-x': PolyPatch
}

export interface UserSynthPreset<K extends UserSynthPresetKind = UserSynthPresetKind> {
  schemaVersion: typeof userSynthPresetSchemaVersion
  id: string
  kind: K
  name: string
  createdAt: string
  modifiedAt: string
  patch: UserSynthPresetPatchMap[K]
}

export function normalizeUserSynthPresetName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!normalized) throw new Error('Preset name cannot be empty.')
  return normalized
}

export function createUserSynthPreset<K extends UserSynthPresetKind>(options: {
  id: string
  kind: K
  name: string
  patch: UserSynthPresetPatchMap[K]
  now: string
  createdAt?: string
}): UserSynthPreset<K> {
  const name = normalizeUserSynthPresetName(options.name)
  return {
    schemaVersion: userSynthPresetSchemaVersion,
    id: options.id,
    kind: options.kind,
    name,
    createdAt: options.createdAt ?? options.now,
    modifiedAt: options.now,
    patch: renamePresetPatch(options.kind, options.patch, name),
  }
}

/** A loaded sound keeps the current project patch identity. Pads that share
 * that patch therefore keep sharing it; only the sound parameters and visible
 * name are replaced by the user preset. */
export function applyUserSynthPreset<K extends UserSynthPresetKind>(current: UserSynthPresetPatchMap[K], preset: UserSynthPreset<K>): UserSynthPresetPatchMap[K] {
  return { ...clonePresetPatch(preset.kind, preset.patch), id: current.id, name: preset.name }
}

export function isUserSynthPreset(value: unknown): value is UserSynthPreset {
  if (!isObject(value)) return false
  return value.schemaVersion === userSynthPresetSchemaVersion
    && typeof value.id === 'string'
    && userSynthPresetKinds.includes(value.kind as UserSynthPresetKind)
    && typeof value.name === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.modifiedAt === 'string'
    && isObject(value.patch)
}

function renamePresetPatch<K extends UserSynthPresetKind>(kind: K, patch: UserSynthPresetPatchMap[K], name: string): UserSynthPresetPatchMap[K] {
  return { ...clonePresetPatch(kind, patch), name }
}

function clonePresetPatch<K extends UserSynthPresetKind>(kind: K, patch: UserSynthPresetPatchMap[K]): UserSynthPresetPatchMap[K] {
  switch (kind) {
    case 'basic': return cloneSynthPatch(patch as SynthPatch) as UserSynthPresetPatchMap[K]
    case 'monogorg': return cloneOrganicBassPatch(patch as OrganicBassPatch) as UserSynthPresetPatchMap[K]
    case 'zola-x': return clonePolyPatch(patch as PolyPatch) as UserSynthPresetPatchMap[K]
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
