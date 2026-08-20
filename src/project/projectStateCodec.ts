import { defaultProjectKey } from '../music/scales'
import {
  createProjectState,
  legacyProjectSchemaVersion,
  migrateLegacyProjectState,
  migrateV2ProjectState,
  migrateV3ProjectState,
  migrateV4ProjectState,
  migrateV5ProjectState,
  migrateV6ProjectState,
  migrateV7ProjectState,
  migrateV8ProjectState,
  migrateV9ProjectState,
  migrateV10ProjectState,
  migrateV11ProjectState,
  migrateV12ProjectState,
  migrateV13ProjectState,
  migrateV14ProjectState,
  migrateV15ProjectState,
  migrateV16ProjectState,
  migrateV17ProjectState,
  migrateV18ProjectState,
  migrateV19ProjectState,
  migrateV20ProjectState,
  migrateV21ProjectState,
  migrateV22ProjectState,
  normalizeProjectState,
  previousProjectSchemaVersion,
  projectSchemaVersion,
  v2ProjectSchemaVersion,
  v3ProjectSchemaVersion,
  v4ProjectSchemaVersion,
  v5ProjectSchemaVersion,
  v6ProjectSchemaVersion,
  v7ProjectSchemaVersion,
  v8ProjectSchemaVersion,
  v9ProjectSchemaVersion,
  v10ProjectSchemaVersion,
  v11ProjectSchemaVersion,
  v12ProjectSchemaVersion,
  v13ProjectSchemaVersion,
  v14ProjectSchemaVersion,
  v15ProjectSchemaVersion,
  v16ProjectSchemaVersion,
  v17ProjectSchemaVersion,
  v18ProjectSchemaVersion,
  v19ProjectSchemaVersion,
  v20ProjectSchemaVersion,
  v21ProjectSchemaVersion,
  validateProjectState,
} from './ProjectState'
import type { ProjectState } from './ProjectState'

const supportedProjectSchemas = new Set<number>([
  legacyProjectSchemaVersion,
  v2ProjectSchemaVersion,
  v3ProjectSchemaVersion,
  v4ProjectSchemaVersion,
  v5ProjectSchemaVersion,
  v6ProjectSchemaVersion,
  v7ProjectSchemaVersion,
  v8ProjectSchemaVersion,
  v9ProjectSchemaVersion,
  v10ProjectSchemaVersion,
  v11ProjectSchemaVersion,
  v12ProjectSchemaVersion,
  v13ProjectSchemaVersion,
  v14ProjectSchemaVersion,
  v15ProjectSchemaVersion,
  v16ProjectSchemaVersion,
  v17ProjectSchemaVersion,
  v18ProjectSchemaVersion,
  v19ProjectSchemaVersion,
  v20ProjectSchemaVersion,
  v21ProjectSchemaVersion,
  previousProjectSchemaVersion,
  projectSchemaVersion,
])

/** One decoder for local IndexedDB records and portable `.station` files. */
export function decodeProjectState(value: unknown): ProjectState {
  if (!isRecord(value)) throw new Error('Project manifest is corrupted.')
  const schemaVersion = value.schemaVersion
  if (typeof schemaVersion !== 'number' || !supportedProjectSchemas.has(schemaVersion)) throw new Error(`Unsupported project schema version: ${String(schemaVersion)}.`)

  const baseState = {
    ...value,
    projectKey: 'projectKey' in value ? value.projectKey : { ...defaultProjectKey },
  }
  let migratedState: unknown = baseState

  switch (schemaVersion) {
    case legacyProjectSchemaVersion:
      migratedState = migrateLegacyProjectState(baseState as unknown as Parameters<typeof migrateLegacyProjectState>[0])
      break
    case v2ProjectSchemaVersion:
      migratedState = migrateV2ProjectState(baseState as unknown as Parameters<typeof migrateV2ProjectState>[0])
      break
    case v3ProjectSchemaVersion:
      migratedState = migrateV3ProjectState(baseState)
      break
    case v4ProjectSchemaVersion:
      migratedState = migrateV4ProjectState(baseState)
      break
    case v5ProjectSchemaVersion:
      migratedState = migrateV5ProjectState(baseState)
      break
    case v6ProjectSchemaVersion:
      migratedState = migrateV6ProjectState(baseState)
      break
    case v7ProjectSchemaVersion:
      migratedState = migrateV7ProjectState(baseState)
      break
    case v8ProjectSchemaVersion:
      migratedState = migrateV8ProjectState(baseState)
      break
    case v9ProjectSchemaVersion:
      migratedState = migrateV9ProjectState(baseState)
      break
    case v10ProjectSchemaVersion:
      migratedState = migrateV10ProjectState(baseState)
      break
    case v11ProjectSchemaVersion:
      migratedState = migrateV11ProjectState(baseState)
      break
    case v12ProjectSchemaVersion:
      migratedState = migrateV12ProjectState(baseState)
      break
    case v13ProjectSchemaVersion:
      migratedState = migrateV13ProjectState(baseState)
      break
    case v14ProjectSchemaVersion:
      migratedState = migrateV14ProjectState(baseState)
      break
    case v15ProjectSchemaVersion:
      migratedState = migrateV15ProjectState(baseState)
      break
    case v16ProjectSchemaVersion:
      migratedState = migrateV16ProjectState(baseState)
      break
    case v17ProjectSchemaVersion:
      migratedState = migrateV17ProjectState(baseState)
      break
    case v18ProjectSchemaVersion:
      migratedState = migrateV18ProjectState(baseState)
      break
    case v19ProjectSchemaVersion:
      migratedState = migrateV19ProjectState(baseState)
      break
    case v20ProjectSchemaVersion:
      migratedState = migrateV20ProjectState(baseState)
      break
    case v21ProjectSchemaVersion:
      migratedState = migrateV21ProjectState(baseState)
      break
    case previousProjectSchemaVersion:
      migratedState = migrateV22ProjectState(baseState)
      break
  }

  const state = normalizeProjectState(migratedState as ProjectState)
  const errors = validateProjectState(state)
  if (errors.length > 0) throw new Error(`Project manifest is corrupted: ${errors[0]}`)
  return createProjectState(state)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
