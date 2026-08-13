import assert from 'node:assert/strict'
import test from 'node:test'
import { createBuiltInLibraryAssetId, builtInLibrarySampleIdFromAssetId } from '../src/library/libraryAssetIdentity.ts'
import { createNamedProjectDocument, duplicateProjectDocument, renameProjectDocument } from '../src/project/projectDocument.ts'
import { createPortableStationProjectFile, parsePortableStationProjectFile, serializePortableStationProjectFile, stationProjectFilename } from '../src/project/stationProjectFileCore.ts'

const now = '2026-08-13T10:00:00.000Z'

test('first named save keeps the exact user name and an independent project ID', () => {
  const project = createNamedProjectDocument('project-a', 'Beat dla Marcina', emptyState(), now)
  assert.equal(project.projectId, 'project-a')
  assert.equal(project.name, 'Beat dla Marcina')
  assert.equal(project.createdAt, now)
  assert.equal(project.modifiedAt, now)
})

test('a project name is required but is not trimmed or auto-corrected', () => {
  assert.throws(() => createNamedProjectDocument('project-a', '   ', emptyState(), now), /cannot be empty/)
  const project = createNamedProjectDocument('project-a', '  Soul Beat  ', emptyState(), now)
  assert.equal(project.name, '  Soul Beat  ')
})

test('two projects with different IDs remain distinct even when their names match', () => {
  const first = createNamedProjectDocument('project-a', 'Soul Beat', emptyState(), now)
  const second = createNamedProjectDocument('project-b', 'Soul Beat', emptyState(), now)
  assert.notEqual(first.projectId, second.projectId)
  assert.equal(first.name, second.name)
})

test('rename preserves project ID and creation time while updating modified time', () => {
  const original = createNamedProjectDocument('project-a', 'Before', emptyState(), now)
  const renamed = renameProjectDocument(original, 'After', '2026-08-13T11:00:00.000Z')
  assert.equal(renamed.projectId, original.projectId)
  assert.equal(renamed.createdAt, original.createdAt)
  assert.equal(renamed.modifiedAt, '2026-08-13T11:00:00.000Z')
  assert.equal(renamed.name, 'After')
})

test('duplicate receives a new ID, chosen name and an identical musical state', () => {
  const original = createNamedProjectDocument('project-a', 'Original', stateWithBuiltInSample(), now)
  const duplicate = duplicateProjectDocument(original, 'project-b', 'My version', '2026-08-13T11:00:00.000Z')
  assert.equal(duplicate.projectId, 'project-b')
  assert.equal(duplicate.name, 'My version')
  assert.deepEqual(duplicate.state, original.state)
  assert.notEqual(duplicate.state, original.state)
})

test('Station library asset IDs are stable and reversible', () => {
  const assetId = createBuiltInLibraryAssetId('sunken11-kick-01')
  assert.equal(assetId, 'station-library:sunken11-kick-01')
  assert.equal(builtInLibrarySampleIdFromAssetId(assetId), 'sunken11-kick-01')
  assert.equal(builtInLibrarySampleIdFromAssetId('asset-user-wav'), null)
})

test('portable export and import round-trip an identical project state', () => {
  const project = createNamedProjectDocument('project-a', 'Round Trip', stateWithBuiltInSample(), now)
  const file = createPortableStationProjectFile(project, (asset) => builtInLibrarySampleIdFromAssetId(asset.id))
  const parsed = parsePortableStationProjectFile(serializePortableStationProjectFile(file), decodeFakeState)
  assert.deepEqual(parsed.document.state, project.state)
  assert.equal(parsed.document.projectId, project.projectId)
  assert.equal(parsed.document.name, project.name)
  assert.deepEqual(parsed.assets, file.assets)
})

test('portable export is blocked when external audio is present', () => {
  const state = stateWithBuiltInSample()
  state.assets[0].id = 'asset-external'
  const project = createNamedProjectDocument('project-a', 'External', state, now)
  assert.throws(() => createPortableStationProjectFile(project, () => null), /only Station library sounds and instruments/)
})

test('corrupted JSON is rejected with a normal import error', () => {
  assert.throws(() => parsePortableStationProjectFile('{broken', decodeFakeState), /not valid JSON/)
})

test('a JSON file with the wrong format is rejected', () => {
  assert.throws(() => parsePortableStationProjectFile(JSON.stringify({ format: 'something-else', schemaVersion: 1 }), decodeFakeState), /not a Station project/)
})

test('an unsupported portable schema version is rejected', () => {
  assert.throws(() => parsePortableStationProjectFile(JSON.stringify({ format: 'station-project', schemaVersion: 99 }), decodeFakeState), /Unsupported \.station schema version/)
})

test('an unsupported musical-state schema version is rejected', () => {
  const project = createNamedProjectDocument('project-a', 'Future', emptyState(), now)
  const file = createPortableStationProjectFile(project, () => null)
  const value = JSON.parse(serializePortableStationProjectFile(file)) as { state: { schemaVersion: number } }
  value.state.schemaVersion = 999
  assert.throws(() => parsePortableStationProjectFile(JSON.stringify(value), decodeFakeState), /Unsupported project schema version/)
})

test('portable asset references must exactly match project state', () => {
  const project = createNamedProjectDocument('project-a', 'Mismatch', stateWithBuiltInSample(), now)
  const file = createPortableStationProjectFile(project, (asset) => builtInLibrarySampleIdFromAssetId(asset.id))
  const value = JSON.parse(serializePortableStationProjectFile(file)) as { assets: unknown[] }
  value.assets = []
  assert.throws(() => parsePortableStationProjectFile(JSON.stringify(value), decodeFakeState), /do not match its musical state/)
})

test('duplicate portable asset references are rejected', () => {
  const project = createNamedProjectDocument('project-a', 'Duplicate assets', stateWithBuiltInSample(), now)
  const file = createPortableStationProjectFile(project, (asset) => builtInLibrarySampleIdFromAssetId(asset.id))
  file.assets.push(file.assets[0])
  assert.throws(() => parsePortableStationProjectFile(serializePortableStationProjectFile(file), decodeFakeState), /duplicate asset references/)
})

test('OPEN AS COPY semantics preserve state and name but replace local identity', () => {
  const imported = createNamedProjectDocument('shared-id', 'Collaboration Beat', stateWithBuiltInSample(), now)
  const copy = duplicateProjectDocument(imported, 'local-copy-id', imported.name, '2026-08-13T12:00:00.000Z')
  assert.equal(copy.projectId, 'local-copy-id')
  assert.equal(copy.name, imported.name)
  assert.deepEqual(copy.state, imported.state)
  assert.equal(copy.createdAt, '2026-08-13T12:00:00.000Z')
})

test('export filename sanitation never changes the actual project name', () => {
  const name = 'Beat: one/two?'
  const project = createNamedProjectDocument('project-a', name, emptyState(), now)
  assert.equal(stationProjectFilename(project.name), 'Beat- one-two-.station')
  assert.equal(project.name, name)
})

function stateWithBuiltInSample() {
  const state = emptyState()
  const assetId = createBuiltInLibraryAssetId('sunken11-kick-01')
  state.bpm = 94
  state.assets = [{ id: assetId, filename: '1998 - Kick 1.wav', durationSeconds: 1 }]
  return state
}

function emptyState() {
  return { schemaVersion: 22, bpm: 120, assets: [] as { id: string; filename: string; durationSeconds: number }[], musicalData: { patterns: ['A', 'B', 'C', 'D'], effects: { delay: 0.25 } } }
}

function decodeFakeState(value: unknown): ReturnType<typeof emptyState> {
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value) || value.schemaVersion !== 22) throw new Error(`Unsupported project schema version: ${String(typeof value === 'object' && value !== null && 'schemaVersion' in value ? value.schemaVersion : undefined)}.`)
  return structuredClone(value) as ReturnType<typeof emptyState>
}
