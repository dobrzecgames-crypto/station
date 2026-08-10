import type { SampleId } from '../audio/AudioEngine'
import { cloneEffectRackState, createEmptyEffectRack } from '../audio/effects.ts'
import { clonePadBank, createPadBankState } from '../pads/padBank.ts'
import { patternVariantNames, maximumPatternGroups } from './patternTypes.ts'
import type { GroupBusState, PatternGroup, PatternVariantName, StepPattern, StepShiftPattern, StepLengthPattern } from './patternTypes'
import { cloneSynthPatch } from '../synth/synthOperations.ts'
import { cloneStringsPatch } from '../strings/stringsOperations.ts'
import { cloneOrganicBassPatch } from '../organic-bass/organicBassOperations.ts'
import type { ChordAssignment } from '../music/chords'
import type { ProjectKey } from '../music/scales'
import { chordFieldsForMode, chordFieldsWithAssignment, normalizePatternChordFields, repairedChordFields } from './patternChordState.ts'
import type { PadMode } from './patternTypes'
import { remapScalarChordBank } from '../music/scaleMapping.ts'
import { getContiguousActiveStepRange, getStepEventRange } from './stepEvents.ts'

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

/** Inactive cells have no event span. Activating one assigns a one-step span. */
export function createEmptyStepLengthPattern(padIds: readonly SampleId[]): StepLengthPattern {
  return Object.fromEntries(padIds.map((padId) => [padId, Array(patternStepCount).fill(0)]))
}

export function cloneStepPattern(pattern: StepPattern): StepPattern {
  return Object.fromEntries(Object.entries(pattern).map(([padId, steps]) => [padId, [...steps]]))
}

export function cloneStepShiftPattern(pattern: StepShiftPattern): StepShiftPattern {
  return Object.fromEntries(Object.entries(pattern).map(([padId, shifts]) => [padId, [...shifts]]))
}

export function cloneStepLengthPattern(pattern: StepLengthPattern): StepLengthPattern {
  return Object.fromEntries(Object.entries(pattern).map(([padId, lengths]) => [padId, [...lengths]]))
}

export function createPatternGroup(id: string, groupNumber: number, padIds: readonly SampleId[]): PatternGroup {
  return { id, name: `Pattern ${groupNumber}`, bank: createPadBankState(), bus: createGroupBusState(), effects: createEmptyEffectRack(id), synthPatches: [], stringsPatches: [], organicBassPatches: [], padMode: 'notes', chordAssignments: Array(padIds.length).fill(null), variants: { A: createEmptyStepPattern(padIds) }, shifts: { A: createEmptyStepShiftPattern(padIds) }, lengths: { A: createEmptyStepLengthPattern(padIds) } }
}

export function createInitialPatternGroups(padIds: readonly SampleId[]): PatternGroup[] {
  return [createPatternGroup('pattern-group-1', 1, padIds)]
}

export function addPatternGroup(groups: readonly PatternGroup[], id: string, padIds: readonly SampleId[]): PatternGroup[] {
  if (groups.length >= maximumPatternGroups) throw new Error(`Station supports up to ${maximumPatternGroups} Pattern Groups.`)
  return [...groups.map(clonePatternGroup), createPatternGroup(id, groups.length + 1, padIds)]
}

export function renamePatternGroup(groups: readonly PatternGroup[], groupId: string, name: string): PatternGroup[] {
  const normalizedName = name.trim().replace(/\s+/g, ' ').slice(0, 24)
  if (!normalizedName) throw new Error('Bank name cannot be empty.')
  if (!groups.some((group) => group.id === groupId)) throw new Error('Pattern Group does not exist.')
  return groups.map((group) => group.id === groupId ? { ...clonePatternGroup(group), name: normalizedName } : clonePatternGroup(group))
}

export function duplicateVariant(groups: readonly PatternGroup[], groupId: string, source: PatternVariantName, target: PatternVariantName, overwrite = false): PatternGroup[] {
  if (source === target) throw new Error('Choose a different variant destination.')
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const sourcePattern = group.variants[source]
    if (!sourcePattern) throw new Error(`Pattern ${group.name}${source} does not exist.`)
    if (group.variants[target] && !overwrite) throw new Error(`Pattern ${group.name}${target} already exists.`)
    return {
      ...clonePatternGroup(group),
      variants: { ...clonePatternGroup(group).variants, [target]: cloneStepPattern(sourcePattern) },
      shifts: { ...clonePatternGroup(group).shifts, [target]: cloneStepShiftPattern(group.shifts[source] ?? createEmptyStepShiftPattern(Object.keys(sourcePattern))) },
      lengths: { ...clonePatternGroup(group).lengths, [target]: cloneStepLengthPattern(group.lengths[source] ?? createEmptyStepLengthPattern(Object.keys(sourcePattern))) },
    }
  })
}

export function clearVariant(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padIds: readonly SampleId[]): PatternGroup[] {
  return groups.map((group) => group.id !== groupId ? clonePatternGroup(group) : {
    ...clonePatternGroup(group),
    variants: { ...clonePatternGroup(group).variants, [variant]: createEmptyStepPattern(padIds) },
    shifts: { ...clonePatternGroup(group).shifts, [variant]: createEmptyStepShiftPattern(padIds) },
    lengths: { ...clonePatternGroup(group).lengths, [variant]: createEmptyStepLengthPattern(padIds) },
  })
}

/** Toggling off a merged head removes its whole event; a new cell is always one independent step. */
export function updateVariantStep(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number): PatternGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const current = group.variants[variant]
    if (!current) throw new Error(`Pattern ${group.name}${variant} does not exist.`)
    const steps = current[padId]
    if (!steps || stepIndex < 0 || stepIndex >= patternStepCount) throw new Error('Pattern step is invalid.')
    const cloned = clonePatternGroup(group)
    const lengths = cloned.lengths[variant] ?? createEmptyStepLengthPattern(Object.keys(current))
    const lengthSteps = lengths[padId] ?? Array(patternStepCount).fill(0)
    const event = getStepEventRange(steps, lengthSteps, stepIndex)
    const nextSteps = [...steps]
    const nextLengths = [...lengthSteps]
    if (event) {
      for (let index = event.headIndex; index <= event.endIndex; index += 1) {
        nextSteps[index] = 0
        nextLengths[index] = 0
      }
    } else {
      nextSteps[stepIndex] = 1
      nextLengths[stepIndex] = 1
    }
    return {
      ...cloned,
      variants: { ...cloned.variants, [variant]: { ...cloneStepPattern(current), [padId]: nextSteps } },
      lengths: { ...cloned.lengths, [variant]: { ...lengths, [padId]: nextLengths } },
    }
  })
}

/** Sets one cell toward a stable state for taps and erase strokes. Existing
 * merged events remain readable: erasing any owned cell clears their whole
 * stored span, while a single-cell addition remains an independent event. */
export function setVariantStepPresence(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number, shouldExist: boolean): PatternGroup[] {
  const group = groups.find((candidate) => candidate.id === groupId)
  const steps = group?.variants[variant]?.[padId]
  const lengths = group?.lengths[variant]?.[padId]
  if (!group || !steps || !lengths || stepIndex < 0 || stepIndex >= patternStepCount) throw new Error('Pattern step is invalid.')
  const exists = getStepEventRange(steps, lengths, stepIndex) !== null
  return exists === shouldExist ? groups.map(clonePatternGroup) : updateVariantStep(groups, groupId, variant, padId, stepIndex)
}

/** Turns one continuous paint gesture into one musical event. The anchor keeps
 * its velocity/SHIFT, every crossed cell becomes part of its span, and only
 * the temporal head is scheduled. Merely adjacent events outside the painted
 * range remain independent. */
export function paintVariantStepSpan(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, anchorIndex: number, endIndex: number): PatternGroup[] {
  if (![anchorIndex, endIndex].every((index) => Number.isInteger(index) && index >= 0 && index < patternStepCount)) throw new Error('Pattern step is invalid.')
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const cloned = clonePatternGroup(group)
    const steps = cloned.variants[variant]?.[padId]
    const shifts = cloned.shifts[variant]?.[padId]
    const lengths = cloned.lengths[variant]?.[padId]
    if (!steps || !shifts || !lengths) throw new Error('Pattern step is invalid.')

    let spanStart = Math.min(anchorIndex, endIndex)
    let spanEnd = Math.max(anchorIndex, endIndex)
    let expanded = true
    while (expanded) {
      expanded = false
      for (let index = spanStart; index <= spanEnd; index += 1) {
        const event = getStepEventRange(steps, lengths, index)
        if (!event) continue
        const nextStart = Math.min(spanStart, event.headIndex)
        const nextEnd = Math.max(spanEnd, event.endIndex)
        if (nextStart !== spanStart || nextEnd !== spanEnd) expanded = true
        spanStart = nextStart
        spanEnd = nextEnd
      }
    }

    const velocity = steps[anchorIndex] > 0 ? steps[anchorIndex] : 1
    const shift = steps[anchorIndex] > 0 ? shifts[anchorIndex] : 0
    const nextSteps = [...steps]
    const nextShifts = [...shifts]
    const nextLengths = [...lengths]
    for (let index = spanStart; index <= spanEnd; index += 1) {
      nextSteps[index] = velocity
      nextShifts[index] = shift
      nextLengths[index] = 1
    }
    nextLengths[spanStart] = spanEnd - spanStart + 1

    return {
      ...cloned,
      variants: { ...cloned.variants, [variant]: { ...cloneStepPattern(cloned.variants[variant]!), [padId]: nextSteps } },
      shifts: { ...cloned.shifts, [variant]: { ...cloneStepShiftPattern(cloned.shifts[variant]!), [padId]: nextShifts } },
      lengths: { ...cloned.lengths, [variant]: { ...cloneStepLengthPattern(cloned.lengths[variant]!), [padId]: nextLengths } },
    }
  })
}

/** Recording reinforces the whole event when it lands inside a merged block. */
export function recordVariantStep(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number, velocity = 1): PatternGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const current = group.variants[variant]
    if (!current) throw new Error(`Pattern ${group.name}${variant} does not exist.`)
    const steps = current[padId]
    if (!steps || stepIndex < 0 || stepIndex >= patternStepCount) throw new Error('Pattern step is invalid.')
    const cloned = clonePatternGroup(group)
    const lengths = cloned.lengths[variant] ?? createEmptyStepLengthPattern(Object.keys(current))
    const lengthSteps = lengths[padId] ?? Array(patternStepCount).fill(0)
    const event = getStepEventRange(steps, lengthSteps, stepIndex)
    const nextSteps = [...steps]
    const nextLengths = [...lengthSteps]
    if (event) {
      for (let index = event.headIndex; index <= event.endIndex; index += 1) nextSteps[index] = velocity
    } else {
      nextSteps[stepIndex] = velocity
      nextLengths[stepIndex] = 1
    }
    return {
      ...cloned,
      variants: { ...cloned.variants, [variant]: { ...cloneStepPattern(current), [padId]: nextSteps } },
      lengths: { ...cloned.lengths, [variant]: { ...lengths, [padId]: nextLengths } },
    }
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
    const cloned = clonePatternGroup(group)
    const steps = cloned.variants[variant]?.[padId]
    const lengths = cloned.lengths[variant]?.[padId]
    if (!steps || !lengths) throw new Error('Pattern step is invalid.')
    const event = getStepEventRange(steps, lengths, stepIndex)
    const firstIndex = event?.headIndex ?? stepIndex
    const lastIndex = event?.endIndex ?? stepIndex
    const next = pattern[padId].map((item, index) => index >= firstIndex && index <= lastIndex ? value : item)
    if (kind === 'velocity') {
      const nextLengths = value <= 0 ? lengths.map((item, index) => index >= firstIndex && index <= lastIndex ? 0 : item) : lengths
      return {
        ...cloned,
        variants: { ...cloned.variants, [variant]: { ...cloneStepPattern(cloned.variants[variant]!), [padId]: next } },
        lengths: { ...cloned.lengths, [variant]: { ...cloneStepLengthPattern(cloned.lengths[variant]!), [padId]: nextLengths } },
      }
    }
    return { ...cloned, shifts: { ...cloned.shifts, [variant]: { ...cloneStepShiftPattern(cloned.shifts[variant]!), [padId]: next } } }
  })
}

export function mergeAdjacentVariantSteps(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number): PatternGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const cloned = clonePatternGroup(group)
    const steps = cloned.variants[variant]?.[padId]
    const shifts = cloned.shifts[variant]?.[padId]
    const lengths = cloned.lengths[variant]?.[padId]
    if (!steps || !shifts || !lengths) throw new Error('Pattern step is invalid.')
    const run = getContiguousActiveStepRange(steps, stepIndex)
    if (!run || run.length < 2) return cloned
    const velocity = steps[run.startIndex]
    const shift = shifts[run.startIndex]
    const nextSteps = steps.map((item, index) => index >= run.startIndex && index <= run.endIndex ? velocity : item)
    const nextShifts = shifts.map((item, index) => index >= run.startIndex && index <= run.endIndex ? shift : item)
    const nextLengths = lengths.map((item, index) => index === run.startIndex ? run.length : index > run.startIndex && index <= run.endIndex ? 1 : item)
    return {
      ...cloned,
      variants: { ...cloned.variants, [variant]: { ...cloneStepPattern(cloned.variants[variant]!), [padId]: nextSteps } },
      shifts: { ...cloned.shifts, [variant]: { ...cloneStepShiftPattern(cloned.shifts[variant]!), [padId]: nextShifts } },
      lengths: { ...cloned.lengths, [variant]: { ...cloneStepLengthPattern(cloned.lengths[variant]!), [padId]: nextLengths } },
    }
  })
}

export function splitMergedVariantStep(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName, padId: SampleId, stepIndex: number): PatternGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return clonePatternGroup(group)
    const cloned = clonePatternGroup(group)
    const steps = cloned.variants[variant]?.[padId]
    const shifts = cloned.shifts[variant]?.[padId]
    const lengths = cloned.lengths[variant]?.[padId]
    if (!steps || !shifts || !lengths) throw new Error('Pattern step is invalid.')
    const event = getStepEventRange(steps, lengths, stepIndex)
    if (!event?.merged) return cloned
    const velocity = steps[event.headIndex]
    const shift = shifts[event.headIndex]
    const nextSteps = steps.map((item, index) => index >= event.headIndex && index <= event.endIndex ? velocity : item)
    const nextShifts = shifts.map((item, index) => index >= event.headIndex && index <= event.endIndex ? shift : item)
    const nextLengths = lengths.map((item, index) => index >= event.headIndex && index <= event.endIndex ? 1 : item)
    return {
      ...cloned,
      variants: { ...cloned.variants, [variant]: { ...cloneStepPattern(cloned.variants[variant]!), [padId]: nextSteps } },
      shifts: { ...cloned.shifts, [variant]: { ...cloneStepShiftPattern(cloned.shifts[variant]!), [padId]: nextShifts } },
      lengths: { ...cloned.lengths, [variant]: { ...cloneStepLengthPattern(cloned.lengths[variant]!), [padId]: nextLengths } },
    }
  })
}

export function clonePatternGroup(group: PatternGroup): PatternGroup {
  return { ...group, ...normalizePatternChordFields(group, group.bank.pads.length), bank: clonePadBank(group.bank), bus: group.bus ? { ...group.bus } : createGroupBusState(), effects: cloneEffectRackState(group.effects ?? createEmptyEffectRack(group.id)), synthPatches: (group.synthPatches ?? []).map(cloneSynthPatch), stringsPatches: (group.stringsPatches ?? []).map(cloneStringsPatch), organicBassPatches: (group.organicBassPatches ?? []).map(cloneOrganicBassPatch), variants: Object.fromEntries(patternVariantNames.flatMap((variant) => group.variants[variant] ? [[variant, cloneStepPattern(group.variants[variant]!)] as const] : [])), shifts: Object.fromEntries(patternVariantNames.flatMap((variant) => group.shifts?.[variant] ? [[variant, cloneStepShiftPattern(group.shifts[variant]!)] as const] : [])), lengths: Object.fromEntries(patternVariantNames.flatMap((variant) => group.lengths?.[variant] ? [[variant, cloneStepLengthPattern(group.lengths[variant]!)] as const] : [])) }
}

export function setPatternGroupPadMode(groups: readonly PatternGroup[], groupId: string, mode: PadMode, projectKey: ProjectKey): PatternGroup[] {
  return groups.map((group) => group.id === groupId ? { ...clonePatternGroup(group), ...chordFieldsForMode(group.bank.pads, normalizePatternChordFields(group, group.bank.pads.length), mode, projectKey) } : clonePatternGroup(group))
}

export function setPatternGroupChordAssignment(groups: readonly PatternGroup[], groupId: string, padIndex: number, assignment: ChordAssignment): PatternGroup[] {
  return groups.map((group) => group.id === groupId ? { ...clonePatternGroup(group), ...chordFieldsWithAssignment(normalizePatternChordFields(group, group.bank.pads.length), padIndex, assignment) } : clonePatternGroup(group))
}

export function repairPatternGroupChords(groups: readonly PatternGroup[], projectKey: ProjectKey): PatternGroup[] {
  return groups.map((group) => {
    const cloned = clonePatternGroup(group)
    const prepared = cloned.padMode === 'chords' ? remapScalarChordBank(cloned, projectKey) : cloned
    return { ...prepared, ...repairedChordFields(prepared.bank.pads, prepared, projectKey) }
  })
}

export function getVariant(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName): StepPattern | undefined {
  return groups.find((group) => group.id === groupId)?.variants[variant]
}

export function getVariantShifts(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName): StepShiftPattern | undefined {
  return groups.find((group) => group.id === groupId)?.shifts[variant]
}

export function getVariantLengths(groups: readonly PatternGroup[], groupId: string, variant: PatternVariantName): StepLengthPattern | undefined {
  return groups.find((group) => group.id === groupId)?.lengths[variant]
}

export function ensurePatternGroupShifts(groups: readonly PatternGroup[], padIds: readonly SampleId[]): PatternGroup[] {
  return groups.map((group) => ({
    ...clonePatternGroup(group),
    shifts: Object.fromEntries(patternVariantNames.flatMap((variant) => group.variants[variant] ? [[variant, group.shifts?.[variant] ? cloneStepShiftPattern(group.shifts[variant]!) : createEmptyStepShiftPattern(padIds)] as const] : [])),
  }))
}

/**
 * Missing legacy spans become independent one-step events. The earlier LENGTH
 * editor could stretch one active head across inactive cells; those stored
 * spans are converted to the equivalent explicit active-cell merge so their
 * single trigger and duration survive the data-model change.
 */
export function ensurePatternGroupLengths(groups: readonly PatternGroup[]): PatternGroup[] {
  return groups.map((group) => {
    const cloned = clonePatternGroup(group)
    const variants = { ...cloned.variants }
    const shifts = { ...cloned.shifts }
    const lengths: PatternGroup['lengths'] = {}
    const legacyUnboundedSamplePadIds = new Set(group.bank.pads.filter((pad) => pad.assetId).map((pad) => pad.id))
    for (const variant of patternVariantNames) {
      const pattern = variants[variant]
      const shiftPattern = shifts[variant]
      if (!pattern || !shiftPattern) continue
      const storedLengths = group.lengths?.[variant]
      const nextPattern = cloneStepPattern(pattern)
      const nextShifts = cloneStepShiftPattern(shiftPattern)
      const nextLengths = createEmptyStepLengthPattern(Object.keys(pattern))
      for (const padId of Object.keys(pattern)) {
        const steps = nextPattern[padId]
        const stepShifts = nextShifts[padId]
        const oldLengths = storedLengths?.[padId] ?? []
        let mergedThrough = -1
        for (let index = 0; index < patternStepCount; index += 1) {
          if (steps[index] <= 0) continue
          if (index <= mergedThrough) continue
          const candidateLength = oldLengths[index]
          const preservesUnboundedSample = legacyUnboundedSamplePadIds.has(padId) && (candidateLength === undefined || candidateLength === 0)
          const storedLength = preservesUnboundedSample ? 0 : Number.isInteger(candidateLength) ? Math.max(1, Math.min(patternStepCount - index, candidateLength!)) : 1
          nextLengths[padId][index] = storedLength
          if (storedLength <= 1) continue
          mergedThrough = index + storedLength - 1
          for (let tail = index + 1; tail < index + storedLength; tail += 1) {
            if (steps[tail] <= 0) {
              steps[tail] = steps[index]
              stepShifts[tail] = stepShifts[index]
            }
            nextLengths[padId][tail] = Math.max(1, nextLengths[padId][tail])
          }
        }
      }
      variants[variant] = nextPattern
      shifts[variant] = nextShifts
      lengths[variant] = nextLengths
    }
    return {
      ...cloned,
      variants,
      shifts,
      lengths,
    }
  })
}
