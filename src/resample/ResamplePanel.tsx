import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ResampleLoopCount, ResampleSource } from '../project/renderPattern'
import './resample.css'

export interface ResampleReadyState {
  filename: string
  source: ResampleSource
  sourceLabel: string
  loopCount: ResampleLoopCount
  durationSeconds: number
  peak: number
  nearlySilent: boolean
}

interface ResamplePanelProps {
  source: ResampleSource
  loopCount: ResampleLoopCount
  captureTail: boolean
  selectedPadLabel: string
  busy: boolean
  progress: number
  ready: ResampleReadyState | null
  error?: string
  onSourceChange: (source: ResampleSource) => void
  onLoopCountChange: (loopCount: ResampleLoopCount) => void
  onCaptureTailChange: (captureTail: boolean) => void
  onRender: () => void
  onAddToPad: () => void
  onSendToChop: () => void
  onDownload: () => void
  onClose: () => void
}

export function ResamplePanel(props: ResamplePanelProps) {
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
      className="resample-dialog"
      aria-labelledby="resample-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!props.busy) props.onClose()
      }}
    >
      <div className="resample-frame">
        <div className="resample-heading">
          <div>
            <p className="resample-kicker">STATION / SAMPLER</p>
            <h2 id="resample-title">RESAMPLE</h2>
          </div>
          <button className="resample-close" type="button" disabled={props.busy} aria-label="Close resample" onClick={props.onClose}>×</button>
        </div>

        <fieldset className="resample-control" disabled={props.busy}>
          <legend>SOURCE</legend>
          <div className="resample-choice-row">
            <Choice active={props.source === 'master'} onClick={() => props.onSourceChange('master')}>MASTER</Choice>
            <Choice active={props.source === 'selectedPad'} onClick={() => props.onSourceChange('selectedPad')}>{props.selectedPadLabel}</Choice>
          </div>
        </fieldset>

        <fieldset className="resample-control" disabled={props.busy}>
          <legend>LENGTH</legend>
          <div className="resample-choice-row resample-loop-row">
            {([1, 2, 4] as const).map((count) => (
              <Choice key={count} active={props.loopCount === count} onClick={() => props.onLoopCountChange(count)}>{count} LOOP{count === 1 ? '' : 'S'}</Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className="resample-control" disabled={props.busy}>
          <legend>CAPTURE TAIL</legend>
          <div className="resample-choice-row">
            <Choice active={!props.captureTail} onClick={() => props.onCaptureTailChange(false)}>OFF</Choice>
            <Choice active={props.captureTail} onClick={() => props.onCaptureTailChange(true)}>ON</Choice>
          </div>
        </fieldset>

        <button className="resample-render" type="button" disabled={props.busy} onClick={props.onRender}>
          {props.busy ? `RENDERING ${Math.round(props.progress * 100)}%` : 'RENDER'}
        </button>

        {props.error && <p className="resample-error" role="alert">{props.error}</p>}

        {props.ready && (
          <section className="resample-ready" aria-live="polite">
            <p className="resample-ready-label">RESAMPLE READY</p>
            <strong>{props.ready.sourceLabel} · {props.ready.loopCount} LOOP{props.ready.loopCount === 1 ? '' : 'S'} · {props.ready.durationSeconds.toFixed(2)} s</strong>
            <span title={props.ready.filename}>{props.ready.filename}</span>
            {props.ready.nearlySilent && <em>RESULT IS SILENT OR NEARLY SILENT</em>}
            {props.ready.peak > 1 && <em>PEAK ABOVE 0 dBFS — WAV WILL CLIP</em>}
            <div className="resample-destinations">
              <button type="button" disabled={props.busy} onClick={props.onAddToPad}>ADD TO PAD</button>
              <button type="button" disabled={props.busy} onClick={props.onSendToChop}>SEND TO CHOP</button>
              <button type="button" disabled={props.busy} onClick={props.onDownload}>DOWNLOAD WAV</button>
            </div>
          </section>
        )}
      </div>
    </dialog>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={active ? 'resample-choice resample-choice-active' : 'resample-choice'} type="button" aria-pressed={active} onClick={onClick}>{children}</button>
}
