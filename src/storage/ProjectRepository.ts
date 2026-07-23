import type { RuntimeSampleAsset, SampleAssetId } from '../audio/AudioEngine'
import { createProjectState, legacyProjectSchemaVersion, migrateLegacyProjectState, migrateV2ProjectState, normalizeProjectState, previousProjectSchemaVersion, projectSchemaVersion, validateProjectState } from '../project/ProjectState'
import { defaultProjectKey } from '../music/scales'
import { assetStoreName, metadataStoreName, openStationDatabase, projectStoreName, requestResult, transactionComplete } from './StationDatabase'
import { defaultProjectId } from './storageTypes'
import type { LoadedProject, StoredAssetRecord, StoredProjectRecord } from './storageTypes'

const lastProjectKey = 'lastProjectId'

export class ProjectRepository {
  async saveProject(projectId: string, snapshot: ReturnType<typeof createProjectState>, runtimeAssets: ReadonlyMap<SampleAssetId, RuntimeSampleAsset>): Promise<void> {
    const errors = validateProjectState(snapshot)
    if (errors.length > 0) throw new Error(`Project cannot be saved: ${errors[0]}`)

    const referencedAssetIds = new Set(snapshot.assets.map((asset) => asset.id))
    if (runtimeAssets.size !== referencedAssetIds.size || [...referencedAssetIds].some((id) => !runtimeAssets.has(id))) throw new Error('Project cannot be saved because a referenced WAV is unavailable.')

    const database = await openStationDatabase()
    const transaction = database.transaction([projectStoreName, assetStoreName, metadataStoreName], 'readwrite')
    const projects = transaction.objectStore(projectStoreName)
    const assets = transaction.objectStore(assetStoreName)
    const metadata = transaction.objectStore(metadataStoreName)

    for (const assetId of referencedAssetIds) {
      const asset = runtimeAssets.get(assetId)!
      const record: StoredAssetRecord = { id: assetId, filename: asset.filename, mimeType: asset.blob.type, size: asset.blob.size, blob: asset.blob }
      assets.put(record)
    }
    const project: StoredProjectRecord = { id: projectId, state: snapshot, savedAt: new Date().toISOString() }
    projects.put(project)
    metadata.put({ key: lastProjectKey, projectId })
    await transactionComplete(transaction, 'Project save did not complete. Check available storage and try again.')
  }

  async loadLastProject(): Promise<LoadedProject> {
    const database = await openStationDatabase()
    const transaction = database.transaction(metadataStoreName, 'readonly')
    const record = await requestResult(transaction.objectStore(metadataStoreName).get(lastProjectKey), 'Could not read the last saved project.') as { projectId?: unknown } | undefined
    await transactionComplete(transaction, 'Could not read the last saved project.')
    if (!record || typeof record.projectId !== 'string') throw new Error('No saved project.')
    return this.loadProject(record.projectId)
  }

  async hasSavedProject(): Promise<boolean> {
    try {
      await this.loadLastProject()
      return true
    } catch (error) {
      if (error instanceof Error && error.message === 'No saved project.') return false
      throw error
    }
  }

  async loadProject(projectId = defaultProjectId): Promise<LoadedProject> {
    const database = await openStationDatabase()
    const projectTransaction = database.transaction(projectStoreName, 'readonly')
    const record = await requestResult(projectTransaction.objectStore(projectStoreName).get(projectId), 'Could not read the saved project.')
    await transactionComplete(projectTransaction, 'Could not read the saved project.')
    if (!record) throw new Error('No saved project.')

    const state = readProjectState(record)
    const requiredIds = state.assets.map((asset) => asset.id)
    const assetTransaction = database.transaction(assetStoreName, 'readonly')
    const assets = await Promise.all(requiredIds.map(async (assetId) => {
      const asset = await requestResult(assetTransaction.objectStore(assetStoreName).get(assetId), 'Could not read a project WAV.')
      return readStoredAsset(asset, assetId)
    }))
    await transactionComplete(assetTransaction, 'Could not read the saved project WAV files.')
    return { projectId, state, assets }
  }
}

export const projectRepository = new ProjectRepository()

function readProjectState(record: unknown): ReturnType<typeof createProjectState> {
  if (!isRecord(record) || !isRecord(record.state)) throw new Error('Saved project manifest is corrupted.')
  const schemaVersion = record.state.schemaVersion
  if (schemaVersion !== projectSchemaVersion && schemaVersion !== previousProjectSchemaVersion && schemaVersion !== legacyProjectSchemaVersion) throw new Error(`Unsupported project schema version: ${String(schemaVersion)}.`)
  const baseState = {
    ...record.state,
    // Schema v1 projects written before Project Key used the same stable fields;
    // the new preference can therefore safely default during validation.
    projectKey: 'projectKey' in record.state ? record.state.projectKey : { ...defaultProjectKey },
  }
  const state = schemaVersion === legacyProjectSchemaVersion
    ? migrateLegacyProjectState(baseState as unknown as Parameters<typeof migrateLegacyProjectState>[0])
    : schemaVersion === previousProjectSchemaVersion
      ? migrateV2ProjectState(baseState as unknown as Parameters<typeof migrateV2ProjectState>[0])
      : normalizeProjectState(baseState as ReturnType<typeof createProjectState>)
  const errors = validateProjectState(state)
  if (errors.length > 0) throw new Error(`Saved project manifest is corrupted: ${errors[0]}`)
  return createProjectState(state)
}

function readStoredAsset(value: unknown, expectedId: SampleAssetId): StoredAssetRecord {
  if (!isRecord(value) || value.id !== expectedId || typeof value.filename !== 'string' || !(value.blob instanceof Blob)) throw new Error(`Saved project is missing WAV asset ${expectedId}.`)
  return { id: expectedId, filename: value.filename, mimeType: typeof value.mimeType === 'string' ? value.mimeType : value.blob.type, size: typeof value.size === 'number' ? value.size : value.blob.size, blob: value.blob }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
