import { useEffect, useRef, useState } from 'react'
import './projectLibrary.css'

interface ProjectNameDialogProps {
  title: string
  confirmLabel: string
  initialValue?: string
  busy: boolean
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function ProjectNameDialog({ title, confirmLabel, initialValue = '', busy, onSubmit, onCancel }: ProjectNameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(initialValue)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return <dialog
    ref={dialogRef}
    className="project-modal project-name-dialog"
    aria-labelledby="project-name-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}
  >
    <form className="project-modal-frame" onSubmit={(event) => { event.preventDefault(); if (name.trim().length > 0 && !busy) onSubmit(name) }}>
      <p className="project-modal-kicker">STATION / PROJECT</p>
      <h2 id="project-name-title">{title}</h2>
      <label className="project-name-field">
        <span>PROJECT NAME</span>
        <input autoFocus value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="project-modal-actions">
        <button className="project-modal-button" type="button" disabled={busy} onClick={onCancel}>CANCEL</button>
        <button className="project-modal-button project-modal-button-primary" type="submit" disabled={busy || name.trim().length === 0}>{confirmLabel}</button>
      </div>
    </form>
  </dialog>
}
