import { createDefaultMasterEffectRack, createEmptyEffectRack, createMigratedMasterEffectRack, cloneEffectRackState, isEffectRackState, normalizeEffectRackState } from '../audio/effects'
import type { EffectRackState } from '../audio/effects'
import type { PumpCurve, SampleAssetId } from '../audio/AudioEngine'
import type { GroupPadReference } from '../audio/channelIdentity'
import { cloneDrumKickPatch, cloneDrumSnarePatch, createDefaultDrumKickPatch, createDefaultDrumSnarePatch, createDefaultDrumSynthState } from '../drumsynth/drumSynthOperations'
import { drumInstrumentTypes } from '../drumsynth/drumSynthTypes'
import type { DrumKickPatch, DrumSnarePatch, DrumSynthState } from '../drumsynth/drumSynthTypes'
import { defaultProjectKey, isNoteName, isScaleId } from '../music/scales'
import type { ProjectKey } from '../music/scales'
import { createEmptyChopSession, createPadBankState } from '../pads/padBank'
import type { ChopSessionState, PadState, SampleSlice } from '../pads/types'
import { clonePatternGroup, createGroupBusState, createInitialPatternGroups, ensurePatternGroupLengths, ensurePatternGroupShifts } from '../patterns/patternOperations'
import { maximumPatternGroups, patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import { validatePatternClipReferences } from '../song/songOperations'
import type { PatternClip, TransportMode } from '../song/songTypes'
import { maximumChordInterval, maximumSynthMidiNote, maximumSynthVoices, minimumChordInterval, minimumSynthMidiNote, resolveSynthPadMidiNotes } from '../synth/synthOperations'
import { subWaveforms, synthLfoDivisions, synthVoiceModes, synthWaveforms } from '../synth/synthTypes'
import type { SynthOscillatorState, SynthPatch } from '../synth/synthTypes'
import { maximumStringsVoices, resolveStringsPadMidiNotes } from '../strings/stringsOperations'
import { stringsCharacters, stringsOctaveLayers, stringsOctaves } from '../strings/stringsTypes'
import type { StringsPatch } from '../strings/stringsTypes'
import { isChordType } from '../music/chords'

export const projectSchemaVersion = 19
export const previousProjectSchemaVersion = 18
export const v17ProjectSchemaVersion = 17
export const v16ProjectSchemaVersion = 16
export const v15ProjectSchemaVersion = 15
export const v14ProjectSchemaVersion = 14
export const v13ProjectSchemaVersion = 13
export const v12ProjectSchemaVersion = 12
export const v11ProjectSchemaVersion = 11
export const v10ProjectSchemaVersion = 10
export const v9ProjectSchemaVersion = 9
export const v8ProjectSchemaVersion = 8
export const v7ProjectSchemaVersion = 7
export const v6ProjectSchemaVersion = 6
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

/**
 * One independent sidechain link: `source` is a single pad trigger, `target`
 * is a whole Pattern Group - there is no per-pad target. Several routes can
 * coexist (e.g. kick ducking one bank, snare ducking another).
 */
export interface PumpRoute {
  id: string
  source: GroupPadReference
  targetGroupId: string
  depth: number
  lengthBeats: number
  curve: PumpCurve
}

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
  pumpRoutes: PumpRoute[]
  /** DRUM SYNTH's current workbench - not per-pad, not per-Pattern-Group. See docs/DECISIONS.md DEC-024. */
  drumSynth: DrumSynthState
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
    pumpRoutes: [],
    drumSynth: createDefaultDrumSynthState(),
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
    pumpRoutes: state.pumpRoutes.map((route) => ({ ...route, source: { ...route.source } })),
    drumSynth: { selectedInstrument: state.drumSynth.selectedInstrument, kick: cloneDrumKickPatch(state.drumSynth.kick), snare: cloneDrumSnarePatch(state.drumSynth.snare) },
  }
}

export function normalizeProjectState(state: ProjectState): ProjectState {
  const padIds = state.patternGroups[0]?.bank?.pads.map((pad) => pad.id)
  if (!padIds) throw new Error('Project has no Pattern Group bank.')
  return createProjectState({ ...state, schemaVersion: projectSchemaVersion, master: state.master ? { ...state.master } : { volume: 1, muted: false }, masterEffects: normalizeEffectRackState(state.masterEffects, 'master', createDefaultMasterEffectRack()), drumSynth: normalizeDrumSynthState(state.drumSynth), patternGroups: ensurePatternGroupLengths(ensurePatternGroupShifts(state.patternGroups, padIds)).map((group) => ({ ...group, synthPatches: group.synthPatches ?? [], stringsPatches: (group.stringsPatches ?? []).map(normalizeStringsPatch), bank: { ...group.bank, pads: group.bank.pads.map(normalizePadState) }, bus: group.bus ? { ...group.bus } : createGroupBusState(), effects: normalizeEffectRackState(group.effects, group.id) })) })
}

export function migrateLegacyProjectState(legacy: { pads: ReturnType<typeof createPadBankState>['pads']; patterns?: unknown; [key: string]: unknown }): ProjectState {
  const group = createInitialPatternGroups(legacy.pads.map((pad) => pad.id))[0]
  const legacyPatterns = typeof legacy.patterns === 'object' && legacy.patterns !== null ? legacy.patterns as Record<string, unknown> : {}
  const { patterns: _legacyPatterns, pads, chopSession, pump, schemaVersion: _schemaVersion, ...legacyState } = legacy
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
    pumpRoutes: migratePumpRoutes(pump, group.id),
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
    pumpRoutes: migratePumpRoutes(pump, firstGroup.id),
  } as ProjectState
}

export function migrateV3ProjectState(previous: { [key: string]: unknown }): ProjectState {
  const { pump, ...rest } = previous
  return { ...rest, schemaVersion: projectSchemaVersion, patternGroups: withGroupEffectRacks(rest.patternGroups as PatternGroup[]), masterEffects: createDefaultMasterEffectRack(), pumpRoutes: migratePumpRoutes(pump) } as ProjectState
}

export function migrateV4ProjectState(previous: { [key: string]: unknown }): ProjectState {
  const { masterCompressor, pump, ...state } = previous
  return { ...state, schemaVersion: projectSchemaVersion, patternGroups: withGroupEffectRacks(state.patternGroups as PatternGroup[]), masterEffects: createMigratedMasterEffectRack(undefined, masterCompressor), pumpRoutes: migratePumpRoutes(pump) } as ProjectState
}

export function migrateV5ProjectState(previous: { [key: string]: unknown }): ProjectState {
  const { masterDelay, masterCompressor, pump, ...state } = previous
  return { ...state, schemaVersion: projectSchemaVersion, patternGroups: withGroupEffectRacks(state.patternGroups as PatternGroup[]), masterEffects: createMigratedMasterEffectRack(masterDelay, masterCompressor), pumpRoutes: migratePumpRoutes(pump) } as ProjectState
}

export function migrateV6ProjectState(previous: { [key: string]: unknown }): ProjectState {
  // Schema v6 FX slots predate the EQ effect type; normalizeProjectState already
  // backfills a default (bypassed) EQConfig onto every slot that is missing one.
  const { pump, ...rest } = previous
  return normalizeProjectState({ ...rest, schemaVersion: projectSchemaVersion, pumpRoutes: migratePumpRoutes(pump) } as ProjectState)
}

/** v7 predates the per-pad AR fields; defaults reproduce the prior edge fades. */
export function migrateV7ProjectState(previous: { [key: string]: unknown }): ProjectState {
  const { pump, ...rest } = previous
  return normalizeProjectState({ ...rest, schemaVersion: projectSchemaVersion, pumpRoutes: migratePumpRoutes(pump) } as ProjectState)
}

/** v8 predates multi-route Pump; its single source/targets pair becomes one route per distinct target group. */
export function migrateV8ProjectState(previous: { [key: string]: unknown }): ProjectState {
  const { pump, ...rest } = previous
  return normalizeProjectState({ ...rest, schemaVersion: projectSchemaVersion, pumpRoutes: migratePumpRoutes(pump) } as ProjectState)
}

/** v9 predates MONO-3; normalization adds empty patch collections and neutral pad fields. */
export function migrateV9ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v10 predates STRINGS; normalization adds empty patch collections and neutral pad fields. */
export function migrateV10ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v11 predates the STRINGS v2 parameters (OCTAVE, OCTAVE LAYER, OCTAVE LAYER MIX, CHARACTER, BODY, MOTION, WIDTH); normalization backfills neutral defaults that reproduce the pre-v2 sound exactly. */
export function migrateV11ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v12 predates STRINGS' BOW, VIBRATO DELAY, WARMTH and SPACE; normalization backfills 0 for all four, reproducing the pre-v2b sound exactly. */
export function migrateV12ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v13 predates the TIGHT ROOM effect type; normalization backfills a bypassed, neutral-default TightRoomConfig onto every FX slot missing one - no existing slot's active effect or settings change. */
export function migrateV13ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v14 predates DRUM SYNTH; normalization backfills a default KICK patch. No pad or Pattern Group field changes - DRUM SYNTH is a sample-generating instrument, not a pad source. See docs/DECISIONS.md DEC-024. */
export function migrateV14ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v15 predates SNARE, DRUM SYNTH's second voice; normalization backfills a default SNARE patch alongside the existing KICK one. See docs/DECISIONS.md DEC-025. */
export function migrateV15ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v16 predates TAPE; normalization adds its bypassed 32% default config to every slot without changing the selected effect or sound. */
export function migrateV16ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v17 had two FX slots per rack; normalization preserves slots 1-2 and appends empty slots 3-4 for every Pattern Group and the master. */
export function migrateV17ProjectState(previous: { [key: string]: unknown }): ProjectState {
  return normalizeProjectState({ ...previous, schemaVersion: projectSchemaVersion } as ProjectState)
}

/** v18 predates per-Pattern NOTES/CHORDS state. */
export function migrateV18ProjectState(previous: { [key: string]: unknown }): ProjectState {
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
  const synthPatchIds = new Set<string>()
  const stringsPatchIds = new Set<string>()
  for (const group of project.patternGroups) {
    if (!group.id || !group.name || !group.variants.A) errors.push('Every Pattern Group requires variant A.')
    if (group.padMode !== 'notes' && group.padMode !== 'chords') errors.push(`${group.name} has an invalid pad mode.`)
    if (!Array.isArray(group.chordAssignments) || group.chordAssignments.length !== padCount) errors.push(`${group.name} must contain exactly ${padCount} chord assignments.`)
    else {
      for (const assignment of group.chordAssignments) if (assignment !== null && (typeof assignment !== 'object' || !isChordType(assignment.type))) errors.push(`${group.name} has an invalid chord assignment.`)
      if (group.padMode === 'chords' && group.chordAssignments.some((assignment) => assignment === null)) errors.push(`${group.name} CHORDS mode requires an assignment for every pad.`)
    }
    if (!group.bus || !Number.isFinite(group.bus.volume) || group.bus.volume < 0 || group.bus.volume > 1 || typeof group.bus.muted !== 'boolean' || typeof group.bus.solo !== 'boolean') errors.push(`${group.name} has an invalid Group Bus.`)
    if (!isEffectRackState(group.effects, group.id)) errors.push(`${group.name} has invalid effects.`)
    if (!group.bank || group.bank.pads.length !== padCount) errors.push(`${group.name} must contain exactly ${padCount} bank pads.`)
    if (!Array.isArray(group.synthPatches)) errors.push(`${group.name} has an invalid MONOPOLY patch collection.`)
    for (const patch of group.synthPatches ?? []) {
      if (synthPatchIds.has(patch.id)) errors.push('MONOPOLY patch IDs must be unique.')
      synthPatchIds.add(patch.id)
      validateSynthPatch(patch, `${group.name} MONOPOLY patch`, errors)
    }
    if (!Array.isArray(group.stringsPatches)) errors.push(`${group.name} has an invalid STRINGS patch collection.`)
    for (const patch of group.stringsPatches ?? []) {
      if (stringsPatchIds.has(patch.id)) errors.push('STRINGS patch IDs must be unique.')
      stringsPatchIds.add(patch.id)
      validateStringsPatch(patch, `${group.name} STRINGS patch`, errors)
    }
    const bankPadIds = new Set(group.bank?.pads.map((pad) => pad.id))
    if (bankPadIds.size !== group.bank?.pads.length) errors.push(`${group.name} bank pad IDs must be unique.`)
    if (Object.keys(group.variants).some((variant) => !patternVariantNames.includes(variant as PatternVariantName))) errors.push('Pattern Groups only support variants A through D.')
    for (const variant of patternVariantNames) {
      const pattern = group.variants[variant]
      if (!pattern) continue
      const shifts = group.shifts[variant]
      if (!shifts) errors.push(`${group.name}${variant} is missing step shifts.`)
      const lengths = group.lengths[variant]
      if (!lengths) errors.push(`${group.name}${variant} is missing step lengths.`)
      for (const pad of group.bank?.pads ?? []) {
        if (!pattern[pad.id] || pattern[pad.id].length !== stepCount) errors.push(`${group.name}${variant} must have exactly ${stepCount} steps for ${pad.id}.`)
        for (const velocity of pattern[pad.id] ?? []) if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) errors.push(`${group.name}${variant} has an invalid step velocity.`)
        if (!shifts?.[pad.id] || shifts[pad.id].length !== stepCount) errors.push(`${group.name}${variant} must have exactly ${stepCount} shifts for ${pad.id}.`)
        for (const shift of shifts?.[pad.id] ?? []) if (!Number.isFinite(shift) || shift < -0.5 || shift > 0.5) errors.push(`${group.name}${variant} has an invalid step shift.`)
        if (!lengths?.[pad.id] || lengths[pad.id].length !== stepCount) errors.push(`${group.name}${variant} must have exactly ${stepCount} lengths for ${pad.id}.`)
        for (const length of lengths?.[pad.id] ?? []) if (!Number.isInteger(length) || length < 0 || length > stepCount) errors.push(`${group.name}${variant} has an invalid step length.`)
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
      if (pad.assetId && pad.synthPatchId) errors.push(`${group.name} ${pad.id} cannot use a sample and MONOPOLY at the same time.`)
      if (pad.assetId && pad.stringsPatchId) errors.push(`${group.name} ${pad.id} cannot use a sample and STRINGS at the same time.`)
      if (pad.synthPatchId && pad.stringsPatchId) errors.push(`${group.name} ${pad.id} cannot use MONOPOLY and STRINGS at the same time.`)
      const patch = pad.synthPatchId ? group.synthPatches.find((candidate) => candidate.id === pad.synthPatchId) : undefined
      if (pad.synthPatchId && !patch) errors.push(`${group.name} ${pad.id} references a missing MONOPOLY patch.`)
      const stringsPatch = pad.stringsPatchId ? group.stringsPatches.find((candidate) => candidate.id === pad.stringsPatchId) : undefined
      if (pad.stringsPatchId && !stringsPatch) errors.push(`${group.name} ${pad.id} references a missing STRINGS patch.`)
      validateChordIntervals(pad.chordIntervals, pad.stringsPatchId ? maximumStringsVoices : maximumSynthVoices, `${group.name} ${pad.id}`, errors)
      if (!pad.synthPatchId && !pad.stringsPatchId && (pad.chordIntervals.length !== 1 || pad.chordIntervals[0] !== 0)) errors.push(`${group.name} ${pad.id} has chord data without a MONOPOLY or STRINGS source.`)
      if (patch?.mode === 'mono' && (pad.chordIntervals.length !== 1 || pad.chordIntervals[0] !== 0)) errors.push(`${group.name} ${pad.id} cannot use a chord in MONO mode.`)
      if (patch) for (const note of resolveSynthPadMidiNotes(patch, pad)) {
        if (!Number.isInteger(note) || note < minimumSynthMidiNote || note > maximumSynthMidiNote) errors.push(`${group.name} ${pad.id} produces a MONOPOLY note outside C0-C8.`)
      }
      if (stringsPatch) for (const note of resolveStringsPadMidiNotes(stringsPatch, pad)) {
        if (!Number.isInteger(note) || note < minimumSynthMidiNote || note > maximumSynthMidiNote) errors.push(`${group.name} ${pad.id} produces a STRINGS note outside C0-C8.`)
      }
      if (!Number.isFinite(pad.attackMs) || pad.attackMs < 0 || pad.attackMs > 250) errors.push(`${group.name} ${pad.id} has an invalid attack.`)
      if (!Number.isFinite(pad.releaseMs) || pad.releaseMs < 4 || pad.releaseMs > 120) errors.push(`${group.name} ${pad.id} has an invalid release.`)
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
  if (!project.drumSynth || !drumInstrumentTypes.includes(project.drumSynth.selectedInstrument)) errors.push('DRUM SYNTH selected instrument is invalid.')
  validateDrumKickPatch(project.drumSynth?.kick, 'DRUM SYNTH KICK', errors)
  validateDrumSnarePatch(project.drumSynth?.snare, 'DRUM SYNTH SNARE', errors)
  const pumpRouteIds = new Set<string>()
  for (const route of project.pumpRoutes) {
    if (pumpRouteIds.has(route.id)) errors.push('Pump route IDs must be unique.')
    pumpRouteIds.add(route.id)
    if (!Number.isFinite(route.depth) || route.depth < 0 || route.depth > 1) errors.push('Pump depth must be between 0 and 1.')
    if (!Number.isFinite(route.lengthBeats) || route.lengthBeats <= 0) errors.push('Pump length must be positive.')
    if (!hasPumpPadReference(route.source, project.patternGroups)) errors.push('Pump route source references a missing group pad.')
    if (!hasPatternGroup(route.targetGroupId, project.patternGroups)) errors.push('Pump route target references a missing Pattern Group.')
  }
  return errors
}

function withGroupEffectRacks(groups: readonly PatternGroup[]): PatternGroup[] {
  return groups.map((group) => ({ ...group, effects: createEmptyEffectRack(group.id) }))
}

function hasPumpPadReference(reference: GroupPadReference, groups: readonly PatternGroup[]): boolean {
  return groups.some((group) => group.id === reference.patternGroupId && group.bank.pads.some((pad) => pad.id === reference.padId))
}

function hasPatternGroup(groupId: string, groups: readonly PatternGroup[]): boolean {
  return groups.some((group) => group.id === groupId)
}

function isGroupPadReference(value: unknown): value is GroupPadReference {
  return typeof value === 'object' && value !== null && typeof (value as GroupPadReference).patternGroupId === 'string' && typeof (value as GroupPadReference).padId === 'string'
}

/**
 * Every schema before v9 stored Pump as one global source/targets pair. This
 * spreads it into one route per distinct target group, so an old project's
 * behaviour carries over to independent per-group routes as closely as
 * possible. `legacyGroupId` supplies the group for pre-v2 saves, which
 * addressed pads by a bare id with no group of their own.
 */
function migratePumpRoutes(pump: unknown, legacyGroupId?: string): PumpRoute[] {
  if (typeof pump !== 'object' || pump === null) return []
  const candidate = pump as { source?: unknown; sourcePadId?: unknown; targets?: unknown; targetPadIds?: unknown; depth?: unknown; lengthBeats?: unknown; curve?: unknown }
  const source = isGroupPadReference(candidate.source)
    ? candidate.source
    : typeof candidate.sourcePadId === 'string' && legacyGroupId
      ? { patternGroupId: legacyGroupId, padId: candidate.sourcePadId }
      : null
  const targets = Array.isArray(candidate.targets) && candidate.targets.every(isGroupPadReference)
    ? candidate.targets as GroupPadReference[]
    : Array.isArray(candidate.targetPadIds) && legacyGroupId
      ? (candidate.targetPadIds as string[]).map((padId) => ({ patternGroupId: legacyGroupId, padId }))
      : []
  if (!source || targets.length === 0) return []
  const depth = typeof candidate.depth === 'number' ? candidate.depth : 0.5
  const lengthBeats = typeof candidate.lengthBeats === 'number' ? candidate.lengthBeats : 0.5
  const curve = candidate.curve === 'snap' || candidate.curve === 'smooth' || candidate.curve === 'swell' ? candidate.curve : 'smooth'
  const targetGroupIds = [...new Set(targets.map((target) => target.patternGroupId))]
  return targetGroupIds.map((targetGroupId) => ({
    id: `pump-route-${source.patternGroupId}-${source.padId}-${targetGroupId}`,
    source: { ...source },
    targetGroupId,
    depth,
    lengthBeats,
    curve,
  }))
}

function isChopSessionState(value: unknown): value is ChopSessionState {
  return typeof value === 'object' && value !== null && Array.isArray((value as ChopSessionState).slices)
}

function cloneChopSession(session: ChopSessionState): ChopSessionState {
  // Only an absent field is migrated, matching normalizePadEnvelope below.
  const legacySession = session as ChopSessionState & { pitchSemitones?: unknown }
  return {
    ...session,
    pitchSemitones: legacySession.pitchSemitones === undefined ? 0 : legacySession.pitchSemitones as number,
    slices: session.slices.map((slice) => ({ ...slice })),
  }
}

function normalizePadState(pad: PadState): PadState {
  // Only absent fields are migrated. Present malformed values remain for
  // validation to reject rather than being silently changed on project load.
  const legacyPad = pad as PadState & { attackMs?: unknown; releaseMs?: unknown; synthPatchId?: unknown; stringsPatchId?: unknown; chordIntervals?: unknown }
  return {
    ...pad,
    attackMs: legacyPad.attackMs === undefined ? 0 : legacyPad.attackMs as number,
    releaseMs: legacyPad.releaseMs === undefined ? 4 : legacyPad.releaseMs as number,
    synthPatchId: legacyPad.synthPatchId === undefined ? null : legacyPad.synthPatchId as PadState['synthPatchId'],
    stringsPatchId: legacyPad.stringsPatchId === undefined ? null : legacyPad.stringsPatchId as PadState['stringsPatchId'],
    chordIntervals: legacyPad.chordIntervals === undefined ? [0] : legacyPad.chordIntervals as number[],
  }
}

/**
 * Only absent fields are migrated, matching normalizePadState above - a
 * present-but-malformed value is left for validation to reject rather than
 * silently rewritten. Defaults reproduce the pre-v2 STRINGS sound exactly:
 * OCTAVE 0, OCTAVE LAYER off, BODY 0.5 (the old fixed equal oscillator mix),
 * WIDTH 1 (the old fixed +/-0.7 ensemble pan), and BOW/VIBRATO DELAY/WARMTH/
 * SPACE all 0 (silent/instant/dry/no send - none of them existed before).
 */
function normalizeStringsPatch(patch: StringsPatch): StringsPatch {
  const legacyPatch = patch as StringsPatch & { octave?: unknown; octaveLayer?: unknown; octaveLayerMix?: unknown; character?: unknown; body?: unknown; motion?: unknown; width?: unknown; bow?: unknown; vibratoDelayMs?: unknown; warmth?: unknown; space?: unknown }
  return {
    ...patch,
    octave: legacyPatch.octave === undefined ? 0 : legacyPatch.octave as StringsPatch['octave'],
    octaveLayer: legacyPatch.octaveLayer === undefined ? 'off' : legacyPatch.octaveLayer as StringsPatch['octaveLayer'],
    octaveLayerMix: legacyPatch.octaveLayerMix === undefined ? 0 : legacyPatch.octaveLayerMix as number,
    character: legacyPatch.character === undefined ? 'strings' : legacyPatch.character as StringsPatch['character'],
    body: legacyPatch.body === undefined ? 0.5 : legacyPatch.body as number,
    motion: legacyPatch.motion === undefined ? 0 : legacyPatch.motion as number,
    width: legacyPatch.width === undefined ? 1 : legacyPatch.width as number,
    bow: legacyPatch.bow === undefined ? 0 : legacyPatch.bow as number,
    vibratoDelayMs: legacyPatch.vibratoDelayMs === undefined ? 0 : legacyPatch.vibratoDelayMs as number,
    warmth: legacyPatch.warmth === undefined ? 0 : legacyPatch.warmth as number,
    space: legacyPatch.space === undefined ? 0 : legacyPatch.space as number,
  }
}

/**
 * Only absent fields are migrated, matching normalizePadState/normalizeStringsPatch
 * above - a present-but-malformed value is left for validation to reject
 * rather than silently rewritten. A project entirely predating DRUM SYNTH
 * (schema v14 and earlier) has no `drumSynth` at all and falls back to the
 * full default patch.
 */
function normalizeDrumSynthState(state: DrumSynthState | undefined): DrumSynthState {
  if (!state) return createDefaultDrumSynthState()
  const kickDefaults = createDefaultDrumKickPatch()
  const legacyKick = state.kick as Partial<DrumKickPatch> | undefined
  const snareDefaults = createDefaultDrumSnarePatch()
  const legacySnare = state.snare as Partial<DrumSnarePatch> | undefined
  return {
    selectedInstrument: drumInstrumentTypes.includes(state.selectedInstrument) ? state.selectedInstrument : 'kick',
    kick: {
      instrument: 'kick',
      tune: legacyKick?.tune === undefined ? kickDefaults.tune : legacyKick.tune,
      punch: legacyKick?.punch === undefined ? kickDefaults.punch : legacyKick.punch,
      body: legacyKick?.body === undefined ? kickDefaults.body : legacyKick.body,
      click: legacyKick?.click === undefined ? kickDefaults.click : legacyKick.click,
      decay: legacyKick?.decay === undefined ? kickDefaults.decay : legacyKick.decay,
      tone: legacyKick?.tone === undefined ? kickDefaults.tone : legacyKick.tone,
      drive: legacyKick?.drive === undefined ? kickDefaults.drive : legacyKick.drive,
      dust: legacyKick?.dust === undefined ? kickDefaults.dust : legacyKick.dust,
    },
    snare: {
      instrument: 'snare',
      tune: legacySnare?.tune === undefined ? snareDefaults.tune : legacySnare.tune,
      body: legacySnare?.body === undefined ? snareDefaults.body : legacySnare.body,
      snap: legacySnare?.snap === undefined ? snareDefaults.snap : legacySnare.snap,
      rattle: legacySnare?.rattle === undefined ? snareDefaults.rattle : legacySnare.rattle,
      bodyDecay: legacySnare?.bodyDecay === undefined ? snareDefaults.bodyDecay : legacySnare.bodyDecay,
      rattleDecay: legacySnare?.rattleDecay === undefined ? snareDefaults.rattleDecay : legacySnare.rattleDecay,
      tone: legacySnare?.tone === undefined ? snareDefaults.tone : legacySnare.tone,
      dust: legacySnare?.dust === undefined ? snareDefaults.dust : legacySnare.dust,
    },
  }
}

function validateSynthPatch(patch: SynthPatch, label: string, errors: string[]): void {
  if (!patch.id || !patch.name) errors.push(`${label} requires an ID and name.`)
  if (!synthVoiceModes.includes(patch.mode)) errors.push(`${label} has an unsupported voice mode.`)
  if (!isIntegerInRange(patch.baseMidiNote, minimumSynthMidiNote, maximumSynthMidiNote)) errors.push(`${label} has an invalid base note.`)
  validateOscillator(patch.oscillator1, `${label} OSC 1`, errors)
  validateOscillator(patch.oscillator2, `${label} OSC 2`, errors)
  if (!subWaveforms.includes(patch.sub?.waveform) || (patch.sub?.octave !== -1 && patch.sub?.octave !== -2) || !isFiniteInRange(patch.sub?.level, 0, 1)) errors.push(`${label} has an invalid SUB oscillator.`)
  if (!isFiniteInRange(patch.ampEnvelope?.attackSeconds, 0, 5) || !isFiniteInRange(patch.ampEnvelope?.decaySeconds, 0, 5) || !isFiniteInRange(patch.ampEnvelope?.sustain, 0, 1) || !isFiniteInRange(patch.ampEnvelope?.releaseSeconds, 0.005, 10)) errors.push(`${label} has an invalid AMP envelope.`)
  if (!isFiniteInRange(patch.filter?.cutoffHz, 20, 20000) || !isFiniteInRange(patch.filter?.resonance, 0, 20) || !isFiniteInRange(patch.filter?.envelopeAttackSeconds, 0, 5) || !isFiniteInRange(patch.filter?.envelopeDecaySeconds, 0, 5) || !isFiniteInRange(patch.filter?.envelopeAmountSemitones, -60, 60)) errors.push(`${label} has invalid filter settings.`)
  if (!synthWaveforms.includes(patch.lfo?.waveform) || !synthLfoDivisions.includes(patch.lfo?.division) || !isFiniteInRange(patch.lfo?.depthSemitones, 0, 48)) errors.push(`${label} has invalid LFO settings.`)
  if (!isFiniteInRange(patch.drive, 0, 1) || !isFiniteInRange(patch.glideSeconds, 0, 2) || !isFiniteInRange(patch.gate, 0.05, 2)) errors.push(`${label} has invalid DRIVE, GLIDE or GATE settings.`)
}

function validateOscillator(oscillator: SynthOscillatorState, label: string, errors: string[]): void {
  if (!synthWaveforms.includes(oscillator?.waveform) || !isIntegerInRange(oscillator?.octave, -2, 2) || !isFiniteInRange(oscillator?.detuneCents, -50, 50) || !isFiniteInRange(oscillator?.level, 0, 1)) errors.push(`${label} is invalid.`)
}

function validateChordIntervals(intervals: readonly number[], maxNotes: number, label: string, errors: string[]): void {
  if (!Array.isArray(intervals) || intervals.length < 1 || intervals.length > maxNotes) {
    errors.push(`${label} must contain between one and ${maxNotes} chord notes.`)
    return
  }
  if (new Set(intervals).size !== intervals.length) errors.push(`${label} chord intervals must be unique.`)
  if (!intervals.includes(0)) errors.push(`${label} chord must include its base note.`)
  for (const interval of intervals) if (!isIntegerInRange(interval, minimumChordInterval, maximumChordInterval)) errors.push(`${label} has an invalid chord interval.`)
}

function validateStringsPatch(patch: StringsPatch, label: string, errors: string[]): void {
  if (!patch.id || !patch.name) errors.push(`${label} requires an ID and name.`)
  if (!isIntegerInRange(patch.baseMidiNote, minimumSynthMidiNote, maximumSynthMidiNote)) errors.push(`${label} has an invalid base note.`)
  if (!isFiniteInRange(patch.detuneCents, 0, 40)) errors.push(`${label} has an invalid DETUNE.`)
  if (!isFiniteInRange(patch.brightness, 0, 1)) errors.push(`${label} has an invalid BRIGHTNESS.`)
  if (!isFiniteInRange(patch.ensemble, 0, 1)) errors.push(`${label} has an invalid ENSEMBLE.`)
  if (!isFiniteInRange(patch.vibrato, 0, 1)) errors.push(`${label} has an invalid VIBRATO.`)
  if (!isFiniteInRange(patch.level, 0, 1)) errors.push(`${label} has an invalid LEVEL.`)
  if (!isFiniteInRange(patch.gate, 0.05, 2)) errors.push(`${label} has an invalid GATE.`)
  if (!isFiniteInRange(patch.ampEnvelope?.attackSeconds, 0, 5) || !isFiniteInRange(patch.ampEnvelope?.decaySeconds, 0, 5) || !isFiniteInRange(patch.ampEnvelope?.sustain, 0, 1) || !isFiniteInRange(patch.ampEnvelope?.releaseSeconds, 0.005, 10)) errors.push(`${label} has an invalid AMP envelope.`)
  if (!stringsOctaves.includes(patch.octave)) errors.push(`${label} has an invalid OCTAVE.`)
  if (!stringsOctaveLayers.includes(patch.octaveLayer)) errors.push(`${label} has an invalid OCTAVE LAYER.`)
  if (!isFiniteInRange(patch.octaveLayerMix, 0, 1)) errors.push(`${label} has an invalid OCTAVE LAYER MIX.`)
  if (!stringsCharacters.includes(patch.character)) errors.push(`${label} has an invalid CHARACTER.`)
  if (!isFiniteInRange(patch.body, 0, 1)) errors.push(`${label} has an invalid BODY.`)
  if (!isFiniteInRange(patch.motion, 0, 1)) errors.push(`${label} has an invalid MOTION.`)
  if (!isFiniteInRange(patch.width, 0, 1)) errors.push(`${label} has an invalid WIDTH.`)
  if (!isFiniteInRange(patch.bow, 0, 1)) errors.push(`${label} has an invalid BOW.`)
  if (!isFiniteInRange(patch.vibratoDelayMs, 0, 2000)) errors.push(`${label} has an invalid VIBRATO DELAY.`)
  if (!isFiniteInRange(patch.warmth, 0, 1)) errors.push(`${label} has an invalid WARMTH.`)
  if (!isFiniteInRange(patch.space, 0, 1)) errors.push(`${label} has an invalid SPACE.`)
}

function validateDrumKickPatch(patch: DrumKickPatch | undefined, label: string, errors: string[]): void {
  if (patch?.instrument !== 'kick') { errors.push(`${label} has an invalid instrument.`); return }
  if (!isFiniteInRange(patch.tune, 0, 1)) errors.push(`${label} has an invalid TUNE.`)
  if (!isFiniteInRange(patch.punch, 0, 1)) errors.push(`${label} has an invalid PUNCH.`)
  if (!isFiniteInRange(patch.body, 0, 1)) errors.push(`${label} has an invalid BODY.`)
  if (!isFiniteInRange(patch.click, 0, 1)) errors.push(`${label} has an invalid CLICK.`)
  if (!isFiniteInRange(patch.decay, 0, 1)) errors.push(`${label} has an invalid DECAY.`)
  if (!isFiniteInRange(patch.tone, 0, 1)) errors.push(`${label} has an invalid TONE.`)
  if (!isFiniteInRange(patch.drive, 0, 1)) errors.push(`${label} has an invalid DRIVE.`)
  if (!isFiniteInRange(patch.dust, 0, 1)) errors.push(`${label} has an invalid DUST.`)
}

function validateDrumSnarePatch(patch: DrumSnarePatch | undefined, label: string, errors: string[]): void {
  if (patch?.instrument !== 'snare') { errors.push(`${label} has an invalid instrument.`); return }
  if (!isFiniteInRange(patch.tune, 0, 1)) errors.push(`${label} has an invalid TUNE.`)
  if (!isFiniteInRange(patch.body, 0, 1)) errors.push(`${label} has an invalid BODY.`)
  if (!isFiniteInRange(patch.snap, 0, 1)) errors.push(`${label} has an invalid SNAP.`)
  if (!isFiniteInRange(patch.rattle, 0, 1)) errors.push(`${label} has an invalid RATTLE.`)
  if (!isFiniteInRange(patch.bodyDecay, 0, 1)) errors.push(`${label} has an invalid BODY DECAY.`)
  if (!isFiniteInRange(patch.rattleDecay, 0, 1)) errors.push(`${label} has an invalid RATTLE DECAY.`)
  if (!isFiniteInRange(patch.tone, 0, 1)) errors.push(`${label} has an invalid TONE.`)
  if (!isFiniteInRange(patch.dust, 0, 1)) errors.push(`${label} has an invalid DUST.`)
}

function isFiniteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && isFiniteInRange(value, minimum, maximum)
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
