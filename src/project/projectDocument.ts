import type { ProjectState } from './ProjectState'
import type { ProjectDocument } from '../storage/storageTypes'

export function createNamedProjectDocument(projectId: string, name: string, state: ProjectState, now = new Date().toISOString()): ProjectDocument {
  assertProjectId(projectId)
  assertProjectName(name)
  return { projectId, name, createdAt: now, modifiedAt: now, schemaVersion: state.schemaVersion, bpm: state.bpm, state: structuredClone(state) }
}

export function renameProjectDocument(project: ProjectDocument, name: string, modifiedAt = new Date().toISOString()): ProjectDocument {
  assertProjectName(name)
  return { ...project, name, modifiedAt, state: structuredClone(project.state) }
}

export function duplicateProjectDocument(project: ProjectDocument, projectId: string, name: string, now = new Date().toISOString()): ProjectDocument {
  assertProjectId(projectId)
  assertProjectName(name)
  return { ...project, projectId, name, createdAt: now, modifiedAt: now, state: structuredClone(project.state) }
}

function assertProjectId(projectId: string): void {
  if (projectId.length === 0) throw new Error('Project ID cannot be empty.')
}

function assertProjectName(name: string): void {
  if (name.trim().length === 0) throw new Error('Project name cannot be empty.')
}
