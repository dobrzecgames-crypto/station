import type { PumpCurve, SampleAssetId, SampleId } from '../audio/AudioEngine'
import { defaultProjectKey, isNoteName, isScaleId } from '../music/scales'
import type { ProjectKey } from '../music/scales'
import { createPadBank } from '../pads/padBank'
import type { PadState, SampleSlice } from '../pads/types'
import { clonePatternGroup, createInitialPatternGroups, ensurePatternGroupShifts } from '../patterns/patternOperations'
import { maximumPatternGroups, patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import { validatePatternClipReferences } from '../song/songOperations'
import type { PatternClip, TransportMode } from '../song/songTypes'

export const projectSchemaVersion = 2
export const legacyProjectSchemaVersion = 1
export const padCount = 16
export const stepCount = 16

export interface ProjectAssetReference {
  id: SampleAssetId
  filename: string
  durationSeconds: number
}

export interface PersistedChopSession {
  id: string
  assetId: SampleAssetId | null
  fileName: string | null
  durationSeconds: number | null
  slices: SampleSlice[]
  activeSliceId: string | null
}

export interface ProjectState {
  schemaVersion: typeof projectSchemaVersion
  projectKey: ProjectKey
  assets: ProjectAssetReference[]
  pads: PadState[]
  patternGroups: PatternGroup[]
  selectedPatternGroupId: string
  selectedPatternVariant: PatternVariantName
  playlist: PatternClip[]
  transportMode: TransportMode
  loopSong: boolean
  bpm: number
  swing: number
  pump: { sourcePadId: SampleId | null; targetPadIds: SampleId[]; depth: number; lengthBeats: number; curve: PumpCurve }
  chopSession: PersistedChopSession
}

export function createEmptyProjectState(): ProjectState {
  const pads = createPadBank()
  return {
    schemaVersion: projectSchemaVersion,
    projectKey: { ...defaultProjectKey },
    assets: [],
    pads,
    patternGroups: createInitialPatternGroups(pads.map((pad) => pad.id)),
    selectedPatternGroupId: 'pattern-group-1',
    selectedPatternVariant: 'A',
    playlist: [],
    transportMode: 'pattern',
    loopSong: false,
    bpm: 120,
    swing: 0,
    pump: { sourcePadId: null, targetPadIds: [], depth: 0.5, lengthBeats: 0.5, curve: 'smooth' },
    chopSession: { id: '', assetId: null, fileName: null, durationSeconds: null, slices: [], activeSliceId: null },
  }
}

export function createProjectState(state: ProjectState): ProjectState {
  return {
    ...state,
    projectKey: { ...state.projectKey },
    assets: state.assets.map((asset) => ({ ...asset })),
    pads: state.pads.map((pad) => ({ ...pad, region: { ...pad.region }, slices: pad.slices.map((slice) => ({ ...slice })) })),
    patternGroups: state.patternGroups.map(clonePatternGroup),
    playlist: state.playlist.map((clip) => ({ ...clip })),
    pump: { ...state.pump, targetPadIds: [...state.pump.targetPadIds] },
    chopSession: { ...state.chopSession, slices: state.chopSession.slices.map((slice) => ({ ...slice })) },
  }
}

export function normalizeProjectState(state: ProjectState): ProjectState {
  return createProjectState({ ...state, patternGroups: ensurePatternGroupShifts(state.patternGroups, state.pads.map((pad) => pad.id)) })
}

export function migrateLegacyProjectState(legacy: Omit<ProjectState, 'schemaVersion' | 'patternGroups' | 'selectedPatternGroupId' | 'selectedPatternVariant' | 'playlist' | 'transportMode' | 'loopSong'> & { patterns?: unknown }): ProjectState {
  const group = createInitialPatternGroups(legacy.pads.map((pad) => pad.id))[0]
  const legacyPatterns = typeof legacy.patterns === 'object' && legacy.patterns !== null ? legacy.patterns as Record<string, unknown> : {}
  const { patterns: _legacyPatterns, ...legacyState } = legacy
  group.variants.A = Object.fromEntries(legacy.pads.map((pad) => [pad.id, Array.isArray(legacyPatterns[pad.id]) ? [...legacyPatterns[pad.id] as number[]] : []]))
  return {
    ...legacyState,
    schemaVersion: projectSchemaVersion,
    patternGroups: [group],
    selectedPatternGroupId: group.id,
    selectedPatternVariant: 'A',
    playlist: [],
    transportMode: 'pattern',
    loopSong: false,
  }
}

export function collectReferencedAssetIds(project: ProjectState): Set<SampleAssetId> {
  const ids = new Set<SampleAssetId>()
  for (const pad of project.pads) if (pad.assetId) ids.add(pad.assetId)
  if (project.chopSession.assetId) ids.add(project.chopSession.assetId)
  return ids
}

export function validateProjectState(project: ProjectState): string[] {
  const errors: string[] = []
  if (project.schemaVersion !== projectSchemaVersion) errors.push('Unsupported project schema version: ' + String(project.schemaVersion) + '.')
  if (!isNoteName(project.projectKey?.root) || !isScaleId(project.projectKey?.scale)) errors.push('Project key is invalid.')
  if (project.pads.length !== padCount) errors.push('Project must contain exactly ' + padCount + ' pads.')
  const padIds = new Set(project.pads.map((pad) => pad.id))
  if (padIds.size !== project.pads.length) errors.push('Pad IDs must be unique.')
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]))
  if (assets.size !== project.assets.length) errors.push('Asset IDs must be unique.')
  for (const asset of project.assets) if (!asset.id || !Number.isFinite(asset.durationSeconds) || asset.durationSeconds <= 0) errors.push('Asset has an invalid duration.')
  if (project.patternGroups.length < 1 || project.patternGroups.length > maximumPatternGroups) errors.push(`Project must contain between 1 and ${maximumPatternGroups} Pattern Groups.`)
  const groupIds = new Set(project.patternGroups.map((group) => group.id))
  if (groupIds.size !== project.patternGroups.length) errors.push('Pattern Group IDs must be unique.')
  if (!groupIds.has(project.selectedPatternGroupId)) errors.push('Selected Pattern Group is missing.')
  if (!patternVariantNames.includes(project.selectedPatternVariant)) errors.push('Selected Pattern variant is invalid.')
  for (const group of project.patternGroups) {
    if (!group.id || !group.name || !group.variants.A) errors.push('Every Pattern Group requires variant A.')
    if (Object.keys(group.variants).some((variant) => !patternVariantNames.includes(variant as PatternVariantName))) errors.push('Pattern Groups only support variants A through D.')
    for (const variant of patternVariantNames) {
      const pattern = group.variants[variant]
      if (!pattern) continue
      const shifts = group.shifts[variant]
      if (!shifts) errors.push(`${group.name}${variant} is missing step shifts.`)
      for (const pad of project.pads) {
        if (!pattern[pad.id] || pattern[pad.id].length !== stepCount) errors.push(`${group.name}${variant} must have exactly ${stepCount} steps for ${pad.id}.`)
        for (const velocity of pattern[pad.id] ?? []) if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) errors.push(`${group.name}${variant} has an invalid step velocity.`)
        if (!shifts?.[pad.id] || shifts[pad.id].length !== stepCount) errors.push(`${group.name}${variant} must have exactly ${stepCount} shifts for ${pad.id}.`)
        for (const shift of shifts?.[pad.id] ?? []) if (!Number.isFinite(shift) || shift < -0.5 || shift > 0.5) errors.push(`${group.name}${variant} has an invalid step shift.`)
      }
    }
  }
  if (!project.patternGroups.find((group) => group.id === project.selectedPatternGroupId)?.variants[project.selectedPatternVariant]) errors.push('Selected Pattern variant is missing.')
  errors.push(...validatePatternClipReferences(project.playlist, project.patternGroups))
  if (project.transportMode !== 'pattern' && project.transportMode !== 'song') errors.push('Transport mode is invalid.')
  if (typeof project.loopSong !== 'boolean') errors.push('Loop Song must be a boolean.')
  for (const pad of project.pads) {
    if (pad.assetId && !assets.has(pad.assetId)) errors.push(pad.id + ' references a missing asset.')
    if (pad.assetId || pad.region.startSeconds !== 0 || pad.region.endSeconds !== 0) validateRegion(pad.region.startSeconds, pad.region.endSeconds, pad.assetId ? assets.get(pad.assetId)?.durationSeconds : undefined, pad.id + ' region', errors)
    validateSlices(pad.slices, assets, pad.id + ' slices', errors)
  }
  if (!Number.isFinite(project.bpm) || project.bpm < 60 || project.bpm > 200) errors.push('BPM must be between 60 and 200.')
  if (!Number.isFinite(project.swing) || project.swing < 0 || project.swing > 0.5) errors.push('Swing must be between 0 and 0.5.')
  if (!Number.isFinite(project.pump.depth) || project.pump.depth < 0 || project.pump.depth > 1) errors.push('Pump depth must be between 0 and 1.')
  if (!Number.isFinite(project.pump.lengthBeats) || project.pump.lengthBeats <= 0) errors.push('Pump length must be positive.')
  if (project.pump.sourcePadId && !padIds.has(project.pump.sourcePadId)) errors.push('Pump source references a missing pad.')
  for (const targetId of project.pump.targetPadIds) if (!padIds.has(targetId)) errors.push('Pump target references a missing pad.')
  const chop = project.chopSession
  if (chop.assetId && !assets.has(chop.assetId)) errors.push('Chop Session references a missing asset.')
  if (chop.slices.length > 0 && !chop.assetId) errors.push('Chop Session slices require a source asset.')
  validateSlices(chop.slices, assets, 'Chop Session slices', errors)
  if (chop.activeSliceId && !chop.slices.some((slice) => slice.id === chop.activeSliceId)) errors.push('Chop Session active slice is missing.')
  return errors
}

function validateRegion(start: number, end: number, duration: number | undefined, label: string, errors: string[]): void {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) errors.push(label + ' must have end greater than start.')
  if (duration !== undefined && (start < 0 || end > duration)) errors.push(label + ' is outside its asset duration.')
}

function validateSlices(slices: readonly SampleSlice[], assets: ReadonlyMap<SampleAssetId, ProjectAssetReference>, label: string, errors: string[]): void {
  if (slices.length > padCount) errors.push(label + ' cannot contain more than ' + padCount + ' slices.')
  let previousEnd = -Infinity
  for (const slice of slices) {
    const asset = assets.get(slice.sourceAssetId)
    if (!asset) errors.push(label + ' references a missing asset.')
    validateRegion(slice.startSeconds, slice.endSeconds, asset?.durationSeconds, label, errors)
    if (slice.startSeconds < previousEnd) errors.push(label + ' must be ordered and non-overlapping.')
    previousEnd = slice.endSeconds
  }
}
