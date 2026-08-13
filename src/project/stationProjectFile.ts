import { validateProjectState } from './ProjectState'
import type { ProjectAssetReference, ProjectState } from './ProjectState'
import { decodeProjectState } from './projectStateCodec'
import type { ProjectDocument } from '../storage/storageTypes'
import {
  createPortableStationProjectFile,
  parsePortableStationProjectFile,
  serializePortableStationProjectFile,
  stationProjectFileSchemaVersion,
  stationProjectFilename,
} from './stationProjectFileCore'
import type { ParsedPortableStationProject, PortableStationProjectFile, StationLibraryAssetReference } from './stationProjectFileCore'

export { stationProjectFileSchemaVersion, stationProjectFilename }
export type { StationLibraryAssetReference }
export type StationProjectFile = PortableStationProjectFile<ProjectState>
export type ParsedStationProject = ParsedPortableStationProject<ProjectState> & { document: ProjectDocument }

export function createStationProjectFile(project: ProjectDocument, resolveStationLibrarySampleId: (asset: ProjectAssetReference) => string | null): StationProjectFile {
  const errors = validateProjectState(project.state)
  if (errors.length > 0) throw new Error(`Project cannot be exported: ${errors[0]}`)
  return createPortableStationProjectFile(project, resolveStationLibrarySampleId)
}

export function parseStationProjectFile(serialized: string): ParsedStationProject {
  return parsePortableStationProjectFile(serialized, decodeProjectState)
}

export function serializeStationProjectFile(file: StationProjectFile): string {
  return serializePortableStationProjectFile(file)
}
