export const stationProjectFileSchemaVersion = 1

export interface PortableProjectState {
  schemaVersion: number
  bpm: number
  assets: readonly { id: string }[]
}

export interface PortableProjectDocument<TState extends PortableProjectState> {
  projectId: string
  name: string
  createdAt: string
  modifiedAt: string
  schemaVersion: number
  bpm: number
  state: TState
}

export interface StationLibraryAssetReference {
  assetId: string
  source: { kind: 'station-library'; sampleId: string }
}

export interface PortableStationProjectFile<TState extends PortableProjectState> {
  format: 'station-project'
  schemaVersion: typeof stationProjectFileSchemaVersion
  projectId: string
  name: string
  createdAt: string
  modifiedAt: string
  state: TState
  assets: StationLibraryAssetReference[]
}

export interface ParsedPortableStationProject<TState extends PortableProjectState> {
  document: PortableProjectDocument<TState>
  assets: StationLibraryAssetReference[]
}

export function createPortableStationProjectFile<TState extends PortableProjectState>(
  project: PortableProjectDocument<TState>,
  resolveStationLibrarySampleId: (asset: TState['assets'][number]) => string | null,
): PortableStationProjectFile<TState> {
  assertProjectMetadata(project)
  const assets = project.state.assets.map((asset) => {
    const sampleId = resolveStationLibrarySampleId(asset)
    if (!sampleId) throw new Error('Portable project export currently supports only Station library sounds and instruments. Imported or generated audio must be removed before export.')
    return { assetId: asset.id, source: { kind: 'station-library' as const, sampleId } }
  })
  return { format: 'station-project', schemaVersion: stationProjectFileSchemaVersion, projectId: project.projectId, name: project.name, createdAt: project.createdAt, modifiedAt: project.modifiedAt, state: project.state, assets }
}

export function parsePortableStationProjectFile<TState extends PortableProjectState>(serialized: string, decodeState: (value: unknown) => TState): ParsedPortableStationProject<TState> {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    throw new Error('This .station file is not valid JSON.')
  }
  if (!isRecord(value) || value.format !== 'station-project') throw new Error('This is not a Station project file.')
  if (value.schemaVersion !== stationProjectFileSchemaVersion) throw new Error(`Unsupported .station schema version: ${String(value.schemaVersion)}.`)
  const metadata = { projectId: value.projectId, name: value.name, createdAt: value.createdAt, modifiedAt: value.modifiedAt }
  assertProjectMetadata(metadata)
  const state = decodeState(value.state)
  const assets = readPortableAssets(value.assets, state)
  return { document: { ...metadata, schemaVersion: state.schemaVersion, bpm: state.bpm, state }, assets }
}

export function serializePortableStationProjectFile<TState extends PortableProjectState>(file: PortableStationProjectFile<TState>): string {
  return JSON.stringify(file, null, 2)
}

export function stationProjectFilename(name: string): string {
  const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '')
  return `${safe.length > 0 ? safe : 'station-project'}.station`
}

function readPortableAssets(value: unknown, state: PortableProjectState): StationLibraryAssetReference[] {
  if (!Array.isArray(value)) throw new Error('Station project asset references are missing.')
  const assets: StationLibraryAssetReference[] = []
  const seen = new Set<string>()
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.assetId !== 'string' || !isRecord(candidate.source) || candidate.source.kind !== 'station-library' || typeof candidate.source.sampleId !== 'string' || candidate.source.sampleId.length === 0) throw new Error('Station project contains an invalid asset reference.')
    if (seen.has(candidate.assetId)) throw new Error('Station project contains duplicate asset references.')
    seen.add(candidate.assetId)
    assets.push({ assetId: candidate.assetId, source: { kind: 'station-library', sampleId: candidate.source.sampleId } })
  }
  const expected = new Set(state.assets.map((asset) => asset.id))
  if (seen.size !== expected.size || [...expected].some((assetId) => !seen.has(assetId))) throw new Error('Station project asset references do not match its musical state.')
  return assets
}

function assertProjectMetadata(value: { projectId: unknown; name: unknown; createdAt: unknown; modifiedAt: unknown }): asserts value is { projectId: string; name: string; createdAt: string; modifiedAt: string } {
  if (typeof value.projectId !== 'string' || value.projectId.length === 0) throw new Error('Project ID is missing.')
  if (typeof value.name !== 'string' || value.name.trim().length === 0) throw new Error('Project name is missing.')
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.modifiedAt)) throw new Error('Project timestamps are invalid.')
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
