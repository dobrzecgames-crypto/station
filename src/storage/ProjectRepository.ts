import type { RuntimeSampleAsset, SampleAssetId } from '../audio/AudioEngine'
import { createProjectState, validateProjectState } from '../project/ProjectState'
import type { ProjectState } from '../project/ProjectState'
import { decodeProjectState } from '../project/projectStateCodec'
import { assetStoreName, metadataStoreName, openStationDatabase, projectStoreName, requestResult, transactionComplete } from './StationDatabase'
import { defaultProjectId } from './storageTypes'
import type { LoadedProject, ProjectDocument, ProjectSummary, StoredAssetRecord, StoredProjectRecord } from './storageTypes'

const lastProjectKey = 'lastProjectId'
const legacyRecoveredKey = 'legacyProjectRecovered'

export class ProjectRepository {
  async listProjects(): Promise<ProjectSummary[]> {
    const database = await openStationDatabase()
    const transaction = database.transaction(projectStoreName, 'readonly')
    const records = await requestResult(transaction.objectStore(projectStoreName).getAll(), 'Could not read the project library.') as unknown[]
    await transactionComplete(transaction, 'Could not read the project library.')
    return records
      .filter(isStoredProjectRecord)
      .map(projectSummary)
      .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
  }

  async createProject(document: ProjectDocument, runtimeAssets: ReadonlyMap<SampleAssetId, RuntimeSampleAsset>): Promise<ProjectDocument> {
    validateDocument(document)
    assertRuntimeAssets(document.state, runtimeAssets)
    const database = await openStationDatabase()
    const transaction = database.transaction([projectStoreName, assetStoreName, metadataStoreName], 'readwrite')
    const projects = transaction.objectStore(projectStoreName)
    const existing = await requestResult(projects.get(document.projectId), 'Could not check the project ID.')
    if (existing) {
      transaction.abort()
      throw new Error('A project with this ID already exists.')
    }
    writeRuntimeAssets(transaction.objectStore(assetStoreName), document.state, runtimeAssets)
    projects.add(toStoredRecord(document))
    transaction.objectStore(metadataStoreName).put({ key: lastProjectKey, projectId: document.projectId })
    await transactionComplete(transaction, 'Project save did not complete. Check available storage and try again.')
    return cloneDocument(document)
  }

  async updateProject(projectId: string, state: ProjectState, runtimeAssets: ReadonlyMap<SampleAssetId, RuntimeSampleAsset>): Promise<ProjectDocument> {
    const errors = validateProjectState(state)
    if (errors.length > 0) throw new Error(`Project cannot be saved: ${errors[0]}`)
    assertRuntimeAssets(state, runtimeAssets)
    const database = await openStationDatabase()
    const transaction = database.transaction([projectStoreName, assetStoreName, metadataStoreName], 'readwrite')
    const projects = transaction.objectStore(projectStoreName)
    const currentValue = await requestResult(projects.get(projectId), 'Could not read the project being saved.')
    if (!isStoredProjectRecord(currentValue)) {
      transaction.abort()
      throw new Error('The project no longer exists in the local library.')
    }
    const next: ProjectDocument = {
      projectId,
      name: currentValue.name,
      createdAt: currentValue.createdAt,
      modifiedAt: new Date().toISOString(),
      schemaVersion: state.schemaVersion,
      bpm: state.bpm,
      state: createProjectState(state),
    }
    writeRuntimeAssets(transaction.objectStore(assetStoreName), state, runtimeAssets)
    projects.put(toStoredRecord(next))
    await deleteAssetsNoLongerReferenced(transaction, currentValue.state.assets.map((asset) => asset.id))
    transaction.objectStore(metadataStoreName).put({ key: lastProjectKey, projectId })
    await transactionComplete(transaction, 'Project save did not complete. Check available storage and try again.')
    return next
  }

  async replaceProject(document: ProjectDocument, runtimeAssets: ReadonlyMap<SampleAssetId, RuntimeSampleAsset>): Promise<ProjectDocument> {
    validateDocument(document)
    assertRuntimeAssets(document.state, runtimeAssets)
    const database = await openStationDatabase()
    const transaction = database.transaction([projectStoreName, assetStoreName, metadataStoreName], 'readwrite')
    const projects = transaction.objectStore(projectStoreName)
    const existing = await requestResult(projects.get(document.projectId), 'Could not read the project being replaced.')
    if (!isStoredProjectRecord(existing)) {
      transaction.abort()
      throw new Error('The project to replace no longer exists.')
    }
    writeRuntimeAssets(transaction.objectStore(assetStoreName), document.state, runtimeAssets)
    projects.put(toStoredRecord(document))
    await deleteAssetsNoLongerReferenced(transaction, existing.state.assets.map((asset) => asset.id))
    transaction.objectStore(metadataStoreName).put({ key: lastProjectKey, projectId: document.projectId })
    await transactionComplete(transaction, 'Project replacement did not complete.')
    return cloneDocument(document)
  }

  async renameProject(projectId: string, name: string): Promise<ProjectSummary> {
    if (name.trim().length === 0) throw new Error('Project name cannot be empty.')
    const database = await openStationDatabase()
    const transaction = database.transaction(projectStoreName, 'readwrite')
    const projects = transaction.objectStore(projectStoreName)
    const value = await requestResult(projects.get(projectId), 'Could not read the project being renamed.')
    if (!isStoredProjectRecord(value)) {
      transaction.abort()
      throw new Error('The project no longer exists in the local library.')
    }
    const record: StoredProjectRecord = { ...value, name, modifiedAt: new Date().toISOString() }
    projects.put(record)
    await transactionComplete(transaction, 'Project rename did not complete.')
    return projectSummary(record)
  }

  async duplicateProject(sourceProjectId: string, newProjectId: string, name: string): Promise<ProjectSummary> {
    if (name.trim().length === 0) throw new Error('Project name cannot be empty.')
    const database = await openStationDatabase()
    const transaction = database.transaction([projectStoreName, assetStoreName], 'readwrite')
    const projects = transaction.objectStore(projectStoreName)
    const sourceValue = await requestResult(projects.get(sourceProjectId), 'Could not read the project being duplicated.')
    const existing = await requestResult(projects.get(newProjectId), 'Could not check the duplicate project ID.')
    if (!isStoredProjectRecord(sourceValue) || existing) {
      transaction.abort()
      throw new Error(existing ? 'A project with the new ID already exists.' : 'The project being duplicated no longer exists.')
    }
    const now = new Date().toISOString()
    const state = decodeProjectState(sourceValue.state)
    const assets = transaction.objectStore(assetStoreName)
    await Promise.all(state.assets.map(async ({ id }) => readStoredAsset(
      await requestResult(assets.get(id), 'Could not verify a WAV used by the project being duplicated.'),
      id,
    )))
    const duplicate: ProjectDocument = {
      projectId: newProjectId,
      name,
      createdAt: now,
      modifiedAt: now,
      schemaVersion: state.schemaVersion,
      bpm: state.bpm,
      state,
    }
    projects.add(toStoredRecord(duplicate))
    await transactionComplete(transaction, 'Project duplication did not complete.')
    return projectSummary(toStoredRecord(duplicate))
  }

  async deleteProject(projectId: string): Promise<void> {
    const database = await openStationDatabase()
    const transaction = database.transaction([projectStoreName, assetStoreName, metadataStoreName], 'readwrite')
    const projects = transaction.objectStore(projectStoreName)
    const removedValue = await requestResult(projects.get(projectId), 'Could not read the project being deleted.')
    if (!isStoredProjectRecord(removedValue)) {
      transaction.abort()
      throw new Error('The project no longer exists in the local library.')
    }
    projects.delete(projectId)
    const remainingValues = await requestResult(projects.getAll(), 'Could not update project assets after deletion.') as unknown[]
    const referenced = new Set<string>()
    for (const value of remainingValues) {
      if (!isRecord(value) || !isRecord(value.state) || !Array.isArray(value.state.assets)) continue
      for (const asset of value.state.assets) if (isRecord(asset) && typeof asset.id === 'string') referenced.add(asset.id)
    }
    const assets = transaction.objectStore(assetStoreName)
    for (const asset of removedValue.state.assets) if (!referenced.has(asset.id)) assets.delete(asset.id)
    const metadata = transaction.objectStore(metadataStoreName)
    const last = await requestResult(metadata.get(lastProjectKey), 'Could not update the last project.') as { projectId?: unknown } | undefined
    if (last?.projectId === projectId) metadata.delete(lastProjectKey)
    await transactionComplete(transaction, 'Project deletion did not complete.')
  }

  async projectExists(projectId: string): Promise<boolean> {
    const database = await openStationDatabase()
    const transaction = database.transaction(projectStoreName, 'readonly')
    const value = await requestResult(transaction.objectStore(projectStoreName).get(projectId), 'Could not check the project library.')
    await transactionComplete(transaction, 'Could not check the project library.')
    return isStoredProjectRecord(value)
  }

  async loadProject(projectId: string): Promise<LoadedProject> {
    const database = await openStationDatabase()
    const projectTransaction = database.transaction(projectStoreName, 'readonly')
    const value = await requestResult(projectTransaction.objectStore(projectStoreName).get(projectId), 'Could not read the saved project.')
    await transactionComplete(projectTransaction, 'Could not read the saved project.')
    if (!isStoredProjectRecord(value)) throw new Error('No saved project.')
    const state = decodeProjectState(value.state)
    const assets = await loadAssets(database, state)
    return {
      projectId,
      name: value.name,
      createdAt: value.createdAt,
      modifiedAt: value.modifiedAt,
      schemaVersion: state.schemaVersion,
      legacy: false,
      state,
      assets,
    }
  }

  async loadLastProject(): Promise<LoadedProject> {
    const database = await openStationDatabase()
    const transaction = database.transaction(metadataStoreName, 'readonly')
    const record = await requestResult(transaction.objectStore(metadataStoreName).get(lastProjectKey), 'Could not read the last saved project.') as { projectId?: unknown } | undefined
    await transactionComplete(transaction, 'Could not read the last saved project.')
    if (!record || typeof record.projectId !== 'string') throw new Error('No saved project.')
    return this.loadProject(record.projectId)
  }

  async hasLegacyProject(): Promise<boolean> {
    const database = await openStationDatabase()
    const transaction = database.transaction([projectStoreName, metadataStoreName], 'readonly')
    const legacy = await requestResult(transaction.objectStore(projectStoreName).get(defaultProjectId), 'Could not inspect the legacy save.')
    const recovered = await requestResult(transaction.objectStore(metadataStoreName).get(legacyRecoveredKey), 'Could not inspect the legacy save.') as { recovered?: unknown } | undefined
    await transactionComplete(transaction, 'Could not inspect the legacy save.')
    return isLegacyProjectRecord(legacy) && recovered?.recovered !== true
  }

  async loadLegacyProject(): Promise<LoadedProject> {
    const database = await openStationDatabase()
    const transaction = database.transaction(projectStoreName, 'readonly')
    const value = await requestResult(transaction.objectStore(projectStoreName).get(defaultProjectId), 'Could not read the legacy project.')
    await transactionComplete(transaction, 'Could not read the legacy project.')
    if (!isLegacyProjectRecord(value)) throw new Error('No legacy project save.')
    const state = decodeProjectState(value.state)
    const assets = await loadAssets(database, state)
    const modifiedAt = typeof value.savedAt === 'string' ? value.savedAt : new Date(0).toISOString()
    return { projectId: defaultProjectId, name: null, createdAt: null, modifiedAt, schemaVersion: state.schemaVersion, legacy: true, state, assets }
  }

  async markLegacyRecovered(): Promise<void> {
    const database = await openStationDatabase()
    const transaction = database.transaction(metadataStoreName, 'readwrite')
    transaction.objectStore(metadataStoreName).put({ key: legacyRecoveredKey, recovered: true })
    await transactionComplete(transaction, 'Could not finish legacy project recovery.')
  }
}

export const projectRepository = new ProjectRepository()

async function loadAssets(database: IDBDatabase, state: ProjectState): Promise<StoredAssetRecord[]> {
  if (state.assets.length === 0) return []
  const transaction = database.transaction(assetStoreName, 'readonly')
  const assets = await Promise.all(state.assets.map(async ({ id }) => readStoredAsset(
    await requestResult(transaction.objectStore(assetStoreName).get(id), 'Could not read a project WAV.'),
    id,
  )))
  await transactionComplete(transaction, 'Could not read the saved project WAV files.')
  return assets
}

function writeRuntimeAssets(store: IDBObjectStore, state: ProjectState, runtimeAssets: ReadonlyMap<SampleAssetId, RuntimeSampleAsset>): void {
  for (const { id } of state.assets) {
    const asset = runtimeAssets.get(id)!
    const record: StoredAssetRecord = { id, filename: asset.filename, mimeType: asset.blob.type, size: asset.blob.size, blob: asset.blob }
    store.put(record)
  }
}

async function deleteAssetsNoLongerReferenced(transaction: IDBTransaction, candidates: readonly SampleAssetId[]): Promise<void> {
  if (candidates.length === 0) return
  const values = await requestResult(transaction.objectStore(projectStoreName).getAll(), 'Could not clean up unused project WAVs.') as unknown[]
  const referenced = new Set<string>()
  for (const value of values) {
    if (!isRecord(value) || !isRecord(value.state) || !Array.isArray(value.state.assets)) continue
    for (const asset of value.state.assets) if (isRecord(asset) && typeof asset.id === 'string') referenced.add(asset.id)
  }
  const assets = transaction.objectStore(assetStoreName)
  for (const assetId of candidates) if (!referenced.has(assetId)) assets.delete(assetId)
}

function assertRuntimeAssets(state: ProjectState, runtimeAssets: ReadonlyMap<SampleAssetId, RuntimeSampleAsset>): void {
  const referenced = new Set(state.assets.map((asset) => asset.id))
  if (runtimeAssets.size !== referenced.size || [...referenced].some((id) => !runtimeAssets.has(id))) throw new Error('Project cannot be saved because a referenced WAV is unavailable.')
}

function validateDocument(document: ProjectDocument): void {
  if (document.projectId.length === 0) throw new Error('Project ID cannot be empty.')
  if (document.name.trim().length === 0) throw new Error('Project name cannot be empty.')
  if (!Number.isFinite(Date.parse(document.createdAt)) || !Number.isFinite(Date.parse(document.modifiedAt))) throw new Error('Project timestamps are invalid.')
  const errors = validateProjectState(document.state)
  if (errors.length > 0) throw new Error(`Project cannot be saved: ${errors[0]}`)
}

function toStoredRecord(document: ProjectDocument): StoredProjectRecord {
  return {
    id: document.projectId,
    projectId: document.projectId,
    name: document.name,
    createdAt: document.createdAt,
    modifiedAt: document.modifiedAt,
    schemaVersion: document.state.schemaVersion,
    state: createProjectState(document.state),
  }
}

function cloneDocument(document: ProjectDocument): ProjectDocument {
  return { ...document, state: createProjectState(document.state) }
}

function projectSummary(record: StoredProjectRecord): ProjectSummary {
  return {
    projectId: record.projectId,
    name: record.name,
    createdAt: record.createdAt,
    modifiedAt: record.modifiedAt,
    schemaVersion: record.schemaVersion,
    bpm: record.state.bpm,
  }
}

function isStoredProjectRecord(value: unknown): value is StoredProjectRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.projectId === 'string'
    && value.id === value.projectId
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && typeof value.createdAt === 'string'
    && typeof value.modifiedAt === 'string'
    && typeof value.schemaVersion === 'number'
    && isRecord(value.state)
    && Array.isArray(value.state.assets)
    && typeof value.state.bpm === 'number'
}

function isLegacyProjectRecord(value: unknown): value is { id: string; state: Record<string, unknown>; savedAt?: unknown } {
  return isRecord(value) && value.id === defaultProjectId && !('projectId' in value) && isRecord(value.state)
}

function readStoredAsset(value: unknown, expectedId: SampleAssetId): StoredAssetRecord {
  if (!isRecord(value) || value.id !== expectedId || typeof value.filename !== 'string' || !(value.blob instanceof Blob)) throw new Error(`Saved project is missing WAV asset ${expectedId}.`)
  return { id: expectedId, filename: value.filename, mimeType: typeof value.mimeType === 'string' ? value.mimeType : value.blob.type, size: typeof value.size === 'number' ? value.size : value.blob.size, blob: value.blob }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
