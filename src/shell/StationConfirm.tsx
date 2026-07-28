import { useEffect, useRef } from 'react'
import './stationConfirm.css'

interface StationConfirmProps {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A modal surface without a synchronous, browser-owned confirmation call.
 * `showModal()` keeps focus and pointer input inside Station while leaving the
 * event loop and Web Audio lifecycle untouched.
 */
export function StationConfirm({ message, confirmLabel, onConfirm, onCancel }: StationConfirmProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="station-confirm-dialog"
      aria-labelledby="station-confirm-title"
      aria-describedby="station-confirm-message"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="station-confirm-frame">
        <p className="station-confirm-kicker">STATION / CONFIRM</p>
        <h2 id="station-confirm-title">CONFIRM ACTION?</h2>
        <p id="station-confirm-message" className="station-confirm-message">{message}</p>
        <div className="station-confirm-actions">
          <button className="station-confirm-button" type="button" autoFocus onClick={onCancel}>CANCEL</button>
          <button className="station-confirm-button station-confirm-button-primary" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  )
}
