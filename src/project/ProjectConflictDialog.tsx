import { useEffect, useRef } from 'react'
import './projectLibrary.css'

interface ProjectConflictDialogProps {
  name: string
  busy: boolean
  onOpenAsCopy: () => void
  onReplace: () => void
  onCancel: () => void
}

export function ProjectConflictDialog({ name, busy, onOpenAsCopy, onReplace, onCancel }: ProjectConflictDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return <dialog
    ref={dialogRef}
    className="project-modal project-conflict-dialog"
    aria-labelledby="project-conflict-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}
  >
    <div className="project-modal-frame">
      <p className="project-modal-kicker">STATION / IMPORT</p>
      <h2 id="project-conflict-title">PROJECT ALREADY EXISTS</h2>
      <p className="project-conflict-name">{name}</p>
      <div className="project-conflict-actions">
        <button className="project-modal-button project-modal-button-primary" type="button" autoFocus disabled={busy} onClick={onOpenAsCopy}>OPEN AS COPY</button>
        <button className="project-modal-button project-modal-button-danger" type="button" disabled={busy} onClick={onReplace}>REPLACE</button>
        <button className="project-modal-button" type="button" disabled={busy} onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  </dialog>
}
