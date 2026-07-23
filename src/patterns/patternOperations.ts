import type { SampleId } from '../audio/AudioEngine'
import { cloneEffectRackState, createEmptyEffectRack } from '../audio/effects'
import { clonePadBank, createPadBankState } from '../pads/padBank'
import { patternVariantNames, maximumPatternGroups } from './patternTypes'
import type { GroupBusState, PatternGroup, PatternVariantName, StepPattern, StepShiftPattern } from './patternTypes'

export const patternStepCount = 16

export function createGroupBusState(): GroupBusState {
  return { volume: 1, muted: false, solo: false }
}

export function createEmptyStepPattern(padIds: readonly SampleId[]): StepPattern {
  return Object.fromEntries(padIds.map((padId) => [padId, Array(patternStepCount).fill(0)]))
}

export function createEmptyStepShiftPattern(padIds: readonly SampleId[]): StepShiftPattern {
  return Object.fromEntries(padIds.map((padId) => [padId, Array(patternStepCount).fill(0)]))
}

export function cloneStepPattern(pattern: StepPattern): StepPattern {
  return Object.fromEntries(Object.entries(pattern).map(([padId, steps]) => [padId, [...steps]]))
}

export function cloneStepShiftPattern(pattern: StepShiftPattern): StepShiftPattern {
  return Object.fromEntries(Object.entries(pattern).map(([padId, shifts]) => [padId, [...shifts]]))
}

export function createPatternGroup(id: string, groupNumber: number, padIds: readonly SampleId[]): PatternGroup {
  return { id, name: `Pattern ${groupNumber}`, bank: createPadBankState(), bus: createGroupBusState(), effects: createEmptyEffectRack(id), variants: { A: createEmptyStepPattern(padIds) }, shifts: { A: createEmptyStepShiftPattern(padIds) } }
}

export function createInitialPatternGroups(padIds: readonly SampleId[]): PatternGroup[] {
  return [createPatternGroup('pattern-group-1', 1, padIds)]
}

export function addPatternGroup(groups: readonly PatternGroup[], id: string, padIds: readonly SampleId[]): PatternGroup[] {
  if (groups.length >= maximumPatternGroups) throw new Error(`Station supports up to ${maximumPatternGroups} Pattern Groups.`)
  return [...groups.map(clonePatternGroup), createPatternGroup(id, groups.length + 1, padIds)]
}

export function duplicateVariant(groups: readonly PatternGroup[], groupId: string, source: PatternVariantName, target: PatternVariantName, overwrite = false): PatternGroup[] {
  if (source === target) throw new Error('Choose a different variant destination.')
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const sourcePattern = group.variants[source]
    if (!sourcePattern) throw new Error(`Pattern ${group.name}${source} does not exist.`)
    if (group.variants[target] && !overwrite) throw new Error(`Pattern ${group.name}${target} already exists.`)
    return { ...clonePatternGroup(group), variants: { ...clonePatternGroup(group).variants, [target]: cloneStepPattern(sourcePattern) }, shifts: { ...clonePatternGroup(group).shifts, [target]: cloneStepShiftPattern(group.shifts[source] ?? createEmptyStepShiftPattern(Object.keys(sourcePattern))) } }
  })
}

export function clearVariant(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padIds: readonly SampleId[]): PatternGroup[] {
  return groups.map((group) => group.id !== groupId ? clonePatternGroup(group) : {
    ...clonePatternGroup(group),
    variants: { ...clonePatternGroup(group).variants, [variant]: createEmptyStepPattern(padIds) },
    shifts: { ...clonePatternGroup(group).shifts, [variant]: createEmptyStepShiftPattern(padIds) },
  })
}

export function updateVariantStep(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number): PatternGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const current = group.variants[variant]
    if (!current) throw new Error(`Pattern ${group.name}${variant} does not exist.`)
    const steps = current[padId]
    if (!steps || stepIndex < 0 || stepIndex >= patternStepCount) throw new Error('Pattern step is invalid.')
    const nextVelocity = steps[stepIndex] === 0 ? 0.6 : steps[stepIndex] === 0.6 ? 1 : 0
    return { ...clonePatternGroup(group), variants: { ...clonePatternGroup(group).variants, [variant]: { ...cloneStepPattern(current), [padId]: steps.map((velocity, index) => index === stepIndex ? nextVelocity : velocity) } } }
  })
}

export function setVariantStepVelocity(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number, velocity: number): PatternGroup[] {
  return updateVariantPatternValue(groups, groupId, variant, padId, stepIndex, Math.min(1, Math.max(0, velocity)), 'velocity')
}

export function setVariantStepShift(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number, shift: number): PatternGroup[] {
  return updateVariantPatternValue(groups, groupId, variant, padId, stepIndex, Math.min(0.5, Math.max(-0.5, shift)), 'shift')
}

function updateVariantPatternValue(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number, value: number, kind: 'velocity' | 'shift'): PatternGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const pattern = kind === 'velocity' ? group.variants[variant] : group.shifts[variant]
    if (!pattern?.[padId] || stepIndex < 0 || stepIndex >= patternStepCount) throw new Error('Pattern step is invalid.')
    const next = pattern[padId].map((item, index) => index === stepIndex ? value : item)
    const cloned = clonePatternGroup(group)
    return kind === 'velocity'
      ? { ...cloned, variants: { ...cloned.variants, [variant]: { ...cloneStepPattern(cloned.variants[variant]!), [padId]: next } } }
      : { ...cloned, shifts: { ...cloned.shifts, [variant]: { ...cloneStepShiftPattern(cloned.shifts[variant]!), [padId]: next } } }
  })
}

export function clonePatternGroup(group: PatternGroup): PatternGroup {
  return { ...group, bank: clonePadBank(group.bank), bus: group.bus ? { ...group.bus } : createGroupBusState(), effects: cloneEffectRackState(group.effects ?? createEmptyEffectRack(group.id)), variants: Object.fromEntries(patternVariantNames.flatMap((variant) => group.variants[variant] ? [[variant, cloneStepPattern(group.variants[variant]!)] as const] : [])), shifts: Object.fromEntries(patternVariantNames.flatMap((variant) => group.shifts?.[variant] ? [[variant, cloneStepShiftPattern(group.shifts[variant]!)] as const] : [])) }
}

export function getVariant(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName): StepPattern | undefined {
  return groups.find((group) => group.id === groupId)?.variants[variant]
}

export function getVariantShifts(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName): StepShiftPattern | undefined {
  return groups.find((group) => group.id === groupId)?.shifts[variant]
}

export function ensurePatternGroupShifts(groups: readonly PatternGroup[], padIds: readonly SampleId[]): PatternGroup[] {
  return groups.map((group) => ({
    ...clonePatternGroup(group),
    shifts: Object.fromEntries(patternVariantNames.flatMap((variant) => group.variants[variant] ? [[variant, group.shifts?.[variant] ? cloneStepShiftPattern(group.shifts[variant]!) : createEmptyStepShiftPattern(padIds)] as const] : [])),
  }))
}
