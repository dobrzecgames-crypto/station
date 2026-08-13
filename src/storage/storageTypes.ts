import type { SampleAssetId } from '../audio/AudioEngine'
import type { ProjectState } from '../project/ProjectState'

export const defaultProjectId = 'default-project'

export interface ProjectSummary {
  projectId: string
  name: string
  createdAt: string
  modifiedAt: string
  schemaVersion: number
  bpm: number
}

export interface ProjectDocument extends ProjectSummary {
  state: ProjectState
}

export interface StoredProjectRecord {
  id: string
  projectId: string
  name: string
  createdAt: string
  modifiedAt: string
  schemaVersion: number
  state: ProjectState
}

export interface StoredAssetRecord {
  id: SampleAssetId
  filename: string
  mimeType: string
  size: number
  blob: Blob
}

export interface LoadedProject {
  projectId: string
  name: string | null
  createdAt: string | null
  modifiedAt: string
  schemaVersion: number
  legacy: boolean
  state: ProjectState
  assets: StoredAssetRecord[]
}
