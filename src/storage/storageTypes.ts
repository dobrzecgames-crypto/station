import type { SampleAssetId } from '../audio/AudioEngine'
import type { ProjectState } from '../project/ProjectState'

export const defaultProjectId = 'default-project'

export interface StoredProjectRecord {
  id: string
  state: ProjectState
  savedAt: string
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
  state: ProjectState
  assets: StoredAssetRecord[]
}
