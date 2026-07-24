import { createDefaultMasterEffectRack, createEmptyEffectRack, createMigratedMasterEffectRack, cloneEffectRackState, isEffectRackState, normalizeEffectRackState } from '../audio/effects'
import type { EffectRackState } from '../audio/effects'
import type { PumpCurve, SampleAssetId } from '../audio/AudioEngine'
import type { GroupPadReference } from '../audio/channelIdentity'
import { defaultProjectKey, isNoteName, isScaleId } from '../music/scales'
import type { ProjectKey } from '../music/scales'
import { createEmptyChopSession, createPadBankState } from '../pads/padBank'
import type { ChopSessionState, SampleSlice } from '../pads/types'
import { clonePatternGroup, createGroupBusState, createInitialPatternGroups, ensurePatternGroupShifts } from '../patterns/patternOperations'
import { maximumPatternGroups, patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import { validatePatternClipReferences } from '../song/songOperations'
import type { PatternClip, TransportMode } from '../song/songTypes'

export const projectSchemaVersion = 7
export const previousProjectSchemaVersion = 6
export const v5ProjectSchemaVersion = 5
export const v4ProjectSchemaVersion = 4
export const v3ProjectSchemaVersion = 3
export const v2ProjectSchemaVersion = 2
export const legacyProjectSchemaVersion = 1
export const padCount = 16
export const stepCount = 16

export interface ProjectAssetReference {
  id: SampleAssetId
  filename: string
  durationSeconds: number
}

export interface MasterMixerState { volume: number; muted: boolean }

export type PersistedChopSession = ChopSessionState

export interface ProjectState {
  schemaVersion: typeof projectSchemaVersion
  projectKey: ProjectKey
  assets: ProjectAssetReference[]
  patternGroups: PatternGroup[]
  selectedPatternGroupId: string
  selectedPatternVariant: PatternVariantName
  playlist: PatternClip[]
  transportMode: TransportMode
  loopSong: boolean
  bpm: number
  swing: number
  master: MasterMixerState
  masterEffects: EffectRackState
  pump: { source: GroupPadReference | null; targets: GroupPadReference[]; depth: number; lengthBeats: number; curve: PumpCurve }
}

export function createEmptyProjectState(): ProjectState {
  const bank = createPadBankState()
  return {
    schemaVersion: projectSchemaVersion,
    projectKey: { ...defaultProjectKey },
    assets: [],
    patternGroups: createInitialPatternGroups(bank.pads.map((pad) => pad.id)),
    selectedPatternGroupId: 'pattern-group-1',
    selectedPatternVariant: 'A',
    playlist: [],
    transportMode: 'pattern',
    loopSong: false,
    bpm: 120,
    swing: 0,
    master: { volume: 1, muted: false },
    masterEffects: createDefaultMasterEffectRack(),
    pump: { source: null, targets: [], depth: 0.5, lengthBeats: 0.5, curve: 'smooth' },
  }
}

export function createProjectState(state: ProjectState): ProjectState {
  return {
    ...state,
    projectKey: { ...state.projectKey },
    assets: state.assets.map((asset) => ({ ...asset })),
    patternGroups: state.patternGroups.map(clonePatternGroup),
    playlist: state.playlist.map((clip) => ({ ...clip })),
    master: { ...state.master },
    masterEffects: cloneEffectRackState(state.masterEffects),
    pump: { ...state.pump, source: state.pump.source ? { ...state.pump.source } : null, targets: state.pump.targets.map((target) => ({ ...target })) },
  }
}

export function normalizeProjectState(state: ProjectState): ProjectState {
  const padIds = state.patternGroups[0]?.bank?.pads.map((pad) => pad.id)
  if (!padIds) throw new Error('Project has no Pattern Group bank.')
  return createProjectState({ ...state, master: state.master ? { ...state.master } : { volume: 1, muted: false }, masterEffects: normalizeEffectRackState(state.masterEffects, 'master', createDefaultMasterEffectRack()), patternGroups: ensurePatternGroupShifts(state.patternGroups, padIds).map((group) => ({ ...group, bus: group.bus ? { ...group.bus } : createGroupBusState(), effects: normalizeEffectRackState(group.effects, group.id) })) })
}

export function migrateLegacyProjectState(legacy: { pads: ReturnType<typeof createPadBankState>['pads']; patterns?: unknown; [key: string]: unknown }): ProjectState {
  const group = createInitialPatternGroups(legacy.pads.map((pad) => pad.id))[0]
  const legacyPatterns = typeof legacy.patterns === 'object' && legacy.patterns !== null ? legacy.patterns as Record<string, unknown> : {}
  const { patterns: _legacyPatterns, pads, chopSession, schemaVersion: _schemaVersion, ...legacyState } = legacy
  group.bank = { pads: pads.map((pad) => ({ ...pad, region: { ...pad.region }, slices: pad.slices.map((slice) => ({ ...slice })) })), chopSession: isChopSessionState(chopSession) ? cloneChopSession(chopSession) : createEmptyChopSession() }
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
    masterEffects: createDefaultMasterEffectRack(),
    pump: { source: typeof legacy.pump === 'object' && legacy.pump !== null && typeof (legacy.pump as { sourcePadId?: unknown }).sourcePadId === 'string' ? { patternGroupId: group.id, padId: (legacy.pump as { sourcePadId: string }).sourcePadId } : null, targets: typeof legacy.pump === 'object' && legacy.pump !== null && Array.isArray((legacy.pump as { targetPadIds?: unknown }).targetPadIds) ? (legacy.pump as { targetPadIds: string[] }).targetPadIds.map((padId) => ({ patternGroupId: group.id, padId })) : [], depth: (legacy.pump as { depth: number }).depth, lengthBeats: (legacy.pump as { lengthBeats: number }).lengthBeats, curve: (legacy.pump as { curve: PumpCurve }).curve },
  } as unknown as ProjectState
}

export function migrateV2ProjectState(previous: { pads: ReturnType<typeof createPadBankState>['pads']; chopSession: ChopSessionState; pump: { sourcePadId: string | null; targetPadIds: string[]; depth: number; lengthBeats: number; curve: PumpCurve }; [key: string]: unknown }): ProjectState {
  const { pads, chopSession, pump, schemaVersion: _schemaVersion, ...state } = previous
  if (!Array.isArray(state.patternGroups) || !isChopSessionState(chopSession)) throw new Error('Cannot migrate a v2 project with a missing or malformed global bank.')
  const groups = (state.patternGroups as PatternGroup[]).map((group, index) => ({
    ...group,
    // v2 had one global bank. Its complete configuration and only CHOP session
    // become Group 1; later groups deliberately begin empty rather than guessing.
    bank: index === 0 ? { pads: pads.map((pad) => ({ ...pad, region: { ...pad.region }, slices: pad.slices.map((slice) => ({ ...slice })) })), chopSession: cloneChopSession(chopSession) } : createPadBankState(),
  }))
  const firstGroup = groups[0]
  if (!firstGroup) throw new Error('Cannot migrate a v2 project without Pattern Group 1.')
  return {
    ...state,
    schemaVersion: projectSchemaVersion,
    patternGroups: withGroupEffectRacks(groups),
    masterEffects: createDefaultMasterEffectRack(),
    pump: { source: pump.sourcePadId ? { patternGroupId: firstGroup.id, padId: pump.sourcePadId } : null, targets: pump.targetPadIds.map((padId) => ({ patternGroupId: firstGroup.id, padId })), depth: pump.depth, lengthBeats: pump.lengthBeats, curve: pump.curve },
  } as ProjectState
}

export function migrateV3ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return { ...previous, schemaVersion: projectSchemaVersion, patternGroups: withGroupEffectRacks(previous.patternGroups as PatternGroup[]), masterEffects: createDefaultMasterEffectRack() } as ProjectState
}

export function migrateV4ProjectState(previous: { [key: string]: unknown }): ProjectState {
  const { masterCompressor, ...state } = previous
  return { ...state, schemaVersion: projectSchemaVersion, patternGroups: withGroupEffectRacks(state.patternGroups as PatternGroup[]), masterEffects: createMigratedMasterEffectRack(undefined, masterCompressor) } as ProjectState
}

export function migrateV5ProjectState(previous: { [key: string]: unknown }): ProjectState {
  const { masterDelay, masterCompressor, ...state } = previous
  return { ...state, schemaVersion: projectSchemaVersion, patternGroups: withGroupEffectRacks(state.patternGroups as PatternGroup[]), masterEffects: createMigratedMasterEffectRack(masterDelay, masterCompressor) } as ProjectState
}

export function migrateV6ProjectState(previous: { [key: string]: unknown }): ProjectState {
  // Schema v6 FX slots predate the EQ effect type; normalizeProjectState already
  // backfills a default (bypassed) EQConfig onto every slot that is missing one.
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

export function collectReferencedAssetIds(project: ProjectState): Set<SampleAssetId> {
  const ids = new Set<SampleAssetId>()
  for (const group of project.patternGroups) {
    for (const pad of group.bank.pads) if (pad.assetId) ids.add(pad.assetId)
    if (group.bank.chopSession.assetId) ids.add(group.bank.chopSession.assetId)
  }
  return ids
}

export function validateProjectState(project: ProjectState): string[] {
  const errors: string[] = []
  if (project.schemaVersion !== projectSchemaVersion) errors.push('Unsupported project schema version: ' + String(project.schemaVersion) + '.')
  if (!isNoteName(project.projectKey?.root) || !isScaleId(project.projectKey?.scale)) errors.push('Project key is invalid.')
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]))
  if (assets.size !== project.assets.length) errors.push('Asset IDs must be unique.')
  for (const asset of project.assets) if (!asset.id || !Number.isFinite(asset.durationSeconds) || asset.durationSeconds <= 0) errors.push('Asset has an invalid duration.')
  if (project.patternGroups.length < 1 || project.patternGroups.length > maximumPatternGroups) errors.push(`Project must contain between 1 and ${maximumPatternGroups} Pattern Groups.`)
  const groupIds = new Set(project.patternGroups.map((group) => group.id))
  if (groupIds.size !== project.patternGroups.length) errors.push('Pattern Group IDs must be unique.')
  if (!groupIds.has(project.selectedPatternGroupId)) errors.push('Selected Pattern Group is missing.')
  if (!patternVariantNames.includes(project.selectedPatternVariant)) errors.push('Selected Pattern variant is invalid.')
  const chopSessionIds = new Set<string>()
  for (const group of project.patternGroups) {
    if (!group.id || !group.name || !group.variants.A) errors.push('Every Pattern Group requires variant A.')
    if (!group.bus || !Number.isFinite(group.bus.volume) || group.bus.volume < 0 || group.bus.volume > 1 || typeof group.bus.muted !== 'boolean' || typeof group.bus.solo !== 'boolean') errors.push(`${group.name} has an invalid Group Bus.`)
    if (!isEffectRackState(group.effects, group.id)) errors.push(`${group.name} has invalid effects.`)
    if (!group.bank || group.bank.pads.length !== padCount) errors.push(`${group.name} must contain exactly ${padCount} bank pads.`)
    const bankPadIds = new Set(group.bank?.pads.map((pad) => pad.id))
    if (bankPadIds.size !== group.bank?.pads.length) errors.push(`${group.name} bank pad IDs must be unique.`)
    if (Object.keys(group.variants).some((variant) => !patternVariantNames.includes(variant as PatternVariantName))) errors.push('Pattern Groups only support variants A through D.')
    for (const variant of patternVariantNames) {
      const pattern = group.variants[variant]
      if (!pattern) continue
      const shifts = group.shifts[variant]
      if (!shifts) errors.push(`${group.name}${variant} is missing step shifts.`)
      for (const pad of group.bank?.pads ?? []) {
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
  for (const group of project.patternGroups) {
    for (const pad of group.bank?.pads ?? []) {
      if (pad.assetId && !assets.has(pad.assetId)) errors.push(`${group.name} ${pad.id} references a missing asset.`)
      if (pad.assetId || pad.region.startSeconds !== 0 || pad.region.endSeconds !== 0) validateRegion(pad.region.startSeconds, pad.region.endSeconds, pad.assetId ? assets.get(pad.assetId)?.durationSeconds : undefined, `${group.name} ${pad.id} region`, errors)
      validateSlices(pad.slices, assets, `${group.name} ${pad.id} slices`, errors)
    }
    const chop = group.bank?.chopSession
    if (!chop) errors.push(`${group.name} is missing its Chop Session.`)
    else {
      if (chop.id && chopSessionIds.has(chop.id)) errors.push('CHOP session IDs must be unique across Pattern Group banks.')
      if (chop.id) chopSessionIds.add(chop.id)
      if (chop.assetId && !assets.has(chop.assetId)) errors.push(`${group.name} Chop Session references a missing asset.`)
      if (chop.slices.length > 0 && !chop.assetId) errors.push(`${group.name} Chop Session slices require a source asset.`)
      validateSlices(chop.slices, assets, `${group.name} Chop Session slices`, errors)
      if (chop.activeSliceId && !chop.slices.some((slice) => slice.id === chop.activeSliceId)) errors.push(`${group.name} Chop Session active slice is missing.`)
      for (const pad of group.bank.pads) if (pad.chopSessionId && pad.chopSessionId !== chop.id) errors.push(`${group.name} ${pad.id} references a missing CHOP session.`)
    }
  }
  if (!Number.isFinite(project.bpm) || project.bpm < 60 || project.bpm > 200) errors.push('BPM must be between 60 and 200.')
  if (!Number.isFinite(project.swing) || project.swing < 0 || project.swing > 0.5) errors.push('Swing must be between 0 and 0.5.')
  if (!Number.isFinite(project.master?.volume) || project.master.volume < 0 || project.master.volume > 1 || typeof project.master.muted !== 'boolean') errors.push('Master mixer state is invalid.')
  if (!isEffectRackState(project.masterEffects, 'master')) errors.push('Master effects are invalid.')
  if (!Number.isFinite(project.pump.depth) || project.pump.depth < 0 || project.pump.depth > 1) errors.push('Pump depth must be between 0 and 1.')
  if (!Number.isFinite(project.pump.lengthBeats) || project.pump.lengthBeats <= 0) errors.push('Pump length must be positive.')
  if (project.pump.source && !hasPumpPadReference(project.pump.source, project.patternGroups)) errors.push('Pump source references a missing group pad.')
  for (const target of project.pump.targets) if (!hasPumpPadReference(target, project.patternGroups)) errors.push('Pump target references a missing group pad.')
  return errors
}

function withGroupEffectRacks(groups: readonly PatternGroup[]): PatternGroup[] {
  return groups.map((group) => ({ ...group, effects: createEmptyEffectRack(group.id) }))
}

function hasPumpPadReference(reference: GroupPadReference, groups: readonly PatternGroup[]): boolean {
  return groups.some((group) => group.id === reference.patternGroupId && group.bank.pads.some((pad) => pad.id === reference.padId))
}

function isChopSessionState(value: unknown): value is ChopSessionState {
  return typeof value === 'object' && value !== null && Array.isArray((value as ChopSessionState).slices)
}

function cloneChopSession(session: ChopSessionState): ChopSessionState {
  return { ...session, slices: session.slices.map((slice) => ({ ...slice })) }
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
