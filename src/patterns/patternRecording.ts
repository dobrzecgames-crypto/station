import type { SampleId } from '../audio/AudioEngine'
import {
  clearVariant,
  cloneStepLengthPattern,
  cloneStepPattern,
  cloneStepShiftPattern,
  patternStepCount,
  recordVariantStep,
} from './patternOperations.ts'
import { getStepEventRange } from './stepEvents.ts'
import { patternVariantNames } from './patternTypes.ts'
import type { PatternGroup, PatternVariantName, StepLengthPattern, StepPattern, StepShiftPattern } from './patternTypes'

export type PatternRecordingMode = 'overdub' | 'replace'

export interface PatternSequenceSnapshot {
  variants: Partial<Record<PatternVariantName, StepPattern>>
  shifts: Partial<Record<PatternVariantName, StepShiftPattern>>
  lengths: Partial<Record<PatternVariantName, StepLengthPattern>>
}

export interface PatternTakeHit {
  padId: SampleId
  /** Quantized distance from the take's grid origin. It remains unwrapped. */
  takeStepIndex: number
  velocity: number
}

export interface PatternTake {
  groupId: string
  mode: PatternRecordingMode
  before: PatternSequenceSnapshot
  /** Pattern position represented by takeStepIndex 0. */
  originPatternStep: number
  initialSectionCount: number
  autoExtend: boolean
  hits: PatternTakeHit[]
}

export interface PatternTakeCommit {
  groupId: string
  before: PatternSequenceSnapshot
  after: PatternSequenceSnapshot
}

export function getPatternSectionCount(group: PatternGroup): number {
  const lastExistingIndex = patternVariantNames.reduce((last, variant, index) => group.variants[variant] ? index : last, 0)
  return lastExistingIndex + 1
}

export function getPatternLengthSteps(group: PatternGroup): number {
  return getPatternSectionCount(group) * patternStepCount
}

export function patternVariantForSection(sectionIndex: number): PatternVariantName {
  return patternVariantNames[Math.min(patternVariantNames.length - 1, Math.max(0, sectionIndex))]
}

export function snapshotPatternSequence(group: PatternGroup): PatternSequenceSnapshot {
  const variants: PatternSequenceSnapshot['variants'] = {}
  const shifts: PatternSequenceSnapshot['shifts'] = {}
  const lengths: PatternSequenceSnapshot['lengths'] = {}
  for (const variant of patternVariantNames) {
    if (group.variants[variant]) variants[variant] = cloneStepPattern(group.variants[variant]!)
    if (group.shifts[variant]) shifts[variant] = cloneStepShiftPattern(group.shifts[variant]!)
    if (group.lengths[variant]) lengths[variant] = cloneStepLengthPattern(group.lengths[variant]!)
  }
  return { variants, shifts, lengths }
}

export function restorePatternSequence(groups: readonly PatternGroup[], groupId: string, snapshot: PatternSequenceSnapshot): PatternGroup[] {
  return groups.map((group) => group.id !== groupId ? group : {
    ...group,
    variants: cloneVariantPatterns(snapshot.variants),
    shifts: cloneVariantShifts(snapshot.shifts),
    lengths: cloneVariantLengths(snapshot.lengths),
  })
}

export function patternSequenceSnapshotsEqual(left: PatternSequenceSnapshot, right: PatternSequenceSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function createPatternTake(group: PatternGroup, mode: PatternRecordingMode, originPatternStep: number): PatternTake {
  const initialSectionCount = getPatternSectionCount(group)
  const initialLength = initialSectionCount * patternStepCount
  return {
    groupId: group.id,
    mode,
    before: snapshotPatternSequence(group),
    originPatternStep: positiveModulo(originPatternStep, initialLength),
    initialSectionCount,
    autoExtend: initialSectionCount === 1 && isSequenceEmpty(group),
    hits: [],
  }
}

/**
 * Applies one quantized live hit. OVERDUB changes only the target cell.
 * REPLACE is rebuilt from the take's pre-recording snapshot each time, then
 * clears the exact chronological grid range between the first and latest hit.
 * That makes a whole take deterministic and keeps material outside the played
 * range untouched, including events restored by TAKE undo.
 */
export function applyPatternTakeHit(
  groups: readonly PatternGroup[],
  take: PatternTake,
  padId: SampleId,
  takeStepIndex: number,
  velocity = 1,
): { groups: PatternGroup[]; take: PatternTake } {
  if (!Number.isInteger(takeStepIndex) || takeStepIndex < 0) return { groups: [...groups], take }
  const hit: PatternTakeHit = { padId, takeStepIndex, velocity: Math.min(1, Math.max(0, velocity)) }
  const nextTake = { ...take, hits: [...take.hits, hit] }
  const sectionCount = sectionCountForTake(nextTake)
  const patternLength = sectionCount * patternStepCount
  const targetPosition = positiveModulo(take.originPatternStep + takeStepIndex, patternLength)
  const targetVariant = patternVariantForSection(Math.floor(targetPosition / patternStepCount))
  const targetStep = targetPosition % patternStepCount

  let nextGroups = take.mode === 'replace'
    ? restorePatternSequence(groups, take.groupId, take.before)
    : [...groups]
  nextGroups = ensureSections(nextGroups, take.groupId, sectionCount)

  if (take.mode === 'replace') {
    const firstTakeStep = Math.min(...nextTake.hits.map((candidate) => candidate.takeStepIndex))
    const lastTakeStep = Math.max(...nextTake.hits.map((candidate) => candidate.takeStepIndex))
    const affectedPositions = new Set<number>()
    for (let index = firstTakeStep; index <= lastTakeStep; index += 1) {
      affectedPositions.add(positiveModulo(take.originPatternStep + index, patternLength))
    }
    nextGroups = clearPatternPositions(nextGroups, take.groupId, affectedPositions)
    for (const recordedHit of nextTake.hits) {
      const position = positiveModulo(take.originPatternStep + recordedHit.takeStepIndex, patternLength)
      nextGroups = recordVariantStep(
        nextGroups,
        take.groupId,
        patternVariantForSection(Math.floor(position / patternStepCount)),
        recordedHit.padId,
        position % patternStepCount,
        recordedHit.velocity,
      )
    }
    return { groups: nextGroups, take: nextTake }
  }

  return {
    groups: recordVariantStep(nextGroups, take.groupId, targetVariant, padId, targetStep, hit.velocity),
    take: nextTake,
  }
}

export function commitPatternTake(groups: readonly PatternGroup[], take: PatternTake): PatternTakeCommit | null {
  const group = groups.find((candidate) => candidate.id === take.groupId)
  if (!group || take.hits.length === 0) return null
  const after = snapshotPatternSequence(group)
  return patternSequenceSnapshotsEqual(take.before, after) ? null : { groupId: take.groupId, before: take.before, after }
}

function sectionCountForTake(take: PatternTake): number {
  if (!take.autoExtend) return take.initialSectionCount
  const furthestTakeStep = Math.max(0, ...take.hits.map((hit) => hit.takeStepIndex))
  const furthestPatternStep = take.originPatternStep + furthestTakeStep
  return Math.min(patternVariantNames.length, Math.floor(furthestPatternStep / patternStepCount) + 1)
}

function ensureSections(groups: readonly PatternGroup[], groupId: string, sectionCount: number): PatternGroup[] {
  const group = groups.find((candidate) => candidate.id === groupId)
  if (!group) return [...groups]
  let next = [...groups]
  const padIds = group.bank.pads.map((pad) => pad.id)
  for (let index = 0; index < sectionCount; index += 1) {
    const variant = patternVariantForSection(index)
    if (!next.find((candidate) => candidate.id === groupId)?.variants[variant]) next = clearVariant(next, groupId, variant, padIds)
  }
  return next
}

function clearPatternPositions(groups: readonly PatternGroup[], groupId: string, positions: ReadonlySet<number>): PatternGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return group
    const variants = cloneVariantPatterns(group.variants)
    const shifts = cloneVariantShifts(group.shifts)
    const lengths = cloneVariantLengths(group.lengths)
    const positionsByVariant = new Map<PatternVariantName, number[]>()
    for (const position of positions) {
      const variant = patternVariantForSection(Math.floor(position / patternStepCount))
      positionsByVariant.set(variant, [...(positionsByVariant.get(variant) ?? []), position % patternStepCount])
    }
    for (const [variant, stepIndexes] of positionsByVariant) {
      const variantSteps = variants[variant]
      const variantShifts = shifts[variant]
      const variantLengths = lengths[variant]
      if (!variantSteps || !variantShifts || !variantLengths) continue
      for (const padId of Object.keys(variantSteps)) {
        const steps = variantSteps[padId]
        const stepShifts = variantShifts[padId] ?? Array(patternStepCount).fill(0)
        const stepLengths = variantLengths[padId] ?? Array(patternStepCount).fill(0)
        const ranges = stepIndexes.flatMap((stepIndex) => {
          const event = getStepEventRange(steps, stepLengths, stepIndex)
          return event ? [event] : []
        })
        for (const range of ranges) {
          for (let index = range.headIndex; index <= range.endIndex; index += 1) {
            steps[index] = 0
            stepShifts[index] = 0
            stepLengths[index] = 0
          }
        }
        variantShifts[padId] = stepShifts
        variantLengths[padId] = stepLengths
      }
    }
    return { ...group, variants, shifts, lengths }
  })
}

function isSequenceEmpty(group: PatternGroup): boolean {
  return patternVariantNames.every((variant) => {
    const pattern = group.variants[variant]
    return !pattern || Object.values(pattern).every((steps) => steps.every((velocity) => velocity <= 0))
  })
}

function cloneVariantPatterns(source: PatternSequenceSnapshot['variants']): PatternSequenceSnapshot['variants'] {
  return Object.fromEntries(patternVariantNames.flatMap((variant) => source[variant] ? [[variant, cloneStepPattern(source[variant]!)] as const] : []))
}

function cloneVariantShifts(source: PatternSequenceSnapshot['shifts']): PatternSequenceSnapshot['shifts'] {
  return Object.fromEntries(patternVariantNames.flatMap((variant) => source[variant] ? [[variant, cloneStepShiftPattern(source[variant]!)] as const] : []))
}

function cloneVariantLengths(source: PatternSequenceSnapshot['lengths']): PatternSequenceSnapshot['lengths'] {
  return Object.fromEntries(patternVariantNames.flatMap((variant) => source[variant] ? [[variant, cloneStepLengthPattern(source[variant]!)] as const] : []))
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
