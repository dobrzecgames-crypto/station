import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ProjectSummary } from '../storage/storageTypes'
import './projectLibrary.css'

interface ProjectLibraryDialogProps {
  projects: readonly ProjectSummary[]
  currentProjectId: string | null
  legacyAvailable: boolean
  audioReady: boolean
  busy: boolean
  onClose: () => void
  onNew: () => void
  onOpen: (projectId: string) => void
  onRecoverLegacy: () => void
  onRename: (project: ProjectSummary) => void
  onDuplicate: (project: ProjectSummary) => void
  onDelete: (project: ProjectSummary) => void
  onExport: (project: ProjectSummary) => void
  onImport: (file: File) => void
}

export function ProjectLibraryDialog({ projects, currentProjectId, legacyAvailable, audioReady, busy, onClose, onNew, onOpen, onRecoverLegacy, onRename, onDuplicate, onDelete, onExport, onImport }: ProjectLibraryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImport(file)
  }

  return <dialog
    ref={dialogRef}
    className="project-modal project-library-dialog"
    aria-labelledby="project-library-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
  >
    <div className="project-modal-frame project-library-frame">
      <div className="project-library-heading">
        <div>
          <p className="project-modal-kicker">STATION / STORAGE</p>
          <h2 id="project-library-title">PROJECT LIBRARY</h2>
        </div>
        <button className="project-library-close" type="button" aria-label="Close project library" disabled={busy} onClick={onClose}>×</button>
      </div>
      <div className="project-library-toolbar">
        <button className="project-modal-button project-modal-button-primary" type="button" disabled={busy} onClick={onNew}>NEW PROJECT</button>
        <button className="project-modal-button" type="button" disabled={busy || !audioReady} onClick={() => importInputRef.current?.click()}>IMPORT</button>
        <input ref={importInputRef} className="project-library-file-input" type="file" accept=".station,application/json" onChange={importFile} />
      </div>
      {!audioReady && <p className="project-library-note">START AUDIO TO OPEN OR IMPORT A PROJECT.</p>}
      <div className="project-library-list">
        {legacyAvailable && <article className="project-library-row project-library-row-legacy">
          <div className="project-library-copy">
            <strong>LEGACY SAVE</strong>
            <span>UNNAMED / PRESERVED</span>
          </div>
          <button className="project-row-open" type="button" disabled={busy || !audioReady} onClick={onRecoverLegacy}>RECOVER</button>
        </article>}
        {projects.map((project) => {
          const menuOpen = menuProjectId === project.projectId
          return <article className={`project-library-row${project.projectId === currentProjectId ? ' project-library-row-current' : ''}`} key={project.projectId}>
            <div className="project-library-copy">
              <strong>{project.name}</strong>
              <span>{formatModifiedAt(project.modifiedAt)} / {Math.round(project.bpm)} BPM{project.projectId === currentProjectId ? ' / OPEN' : ''}</span>
            </div>
            <button className="project-row-open" type="button" disabled={busy || !audioReady || project.projectId === currentProjectId} onClick={() => onOpen(project.projectId)}>{project.projectId === currentProjectId ? 'OPEN' : 'OPEN'}</button>
            <div className="project-row-menu-wrap">
              <button className={`project-row-menu-trigger${menuOpen ? ' project-row-menu-trigger-active' : ''}`} type="button" aria-label={`More actions for ${project.name}`} aria-expanded={menuOpen} disabled={busy} onClick={() => setMenuProjectId(menuOpen ? null : project.projectId)}>•••</button>
            </div>
            {menuOpen && <div className="project-row-menu">
              <button type="button" onClick={() => onRename(project)}>RENAME</button>
              <button type="button" onClick={() => onDuplicate(project)}>DUPLICATE</button>
              <button type="button" onClick={() => onExport(project)}>EXPORT</button>
              <button className="project-row-menu-delete" type="button" onClick={() => onDelete(project)}>DELETE</button>
            </div>}
          </article>
        })}
        {!legacyAvailable && projects.length === 0 && <p className="project-library-empty">NO SAVED PROJECTS.<br />BUILD A BEAT, THEN CHOOSE SAVE PROJECT.</p>}
      </div>
    </div>
  </dialog>
}

function formatModifiedAt(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'UNKNOWN DATE'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date).toUpperCase()
}
